import type { ApiResponse } from '../types/recommendation';
import type { GeoPoint, Restaurant } from '../types/restaurant';
import { requireLocationConsent } from './privacyConsent';

interface AmapPoiCloudData {
  restaurants: Restaurant[];
  source: 'amap';
  fetchedAt: string;
  location: GeoPoint;
  radiusMeters: number;
  cacheHit?: boolean;
  cacheKey?: string;
  cacheAgeMs?: number;
  fetchReason?: string;
  amapApiCallCount?: number;
  searchMeta?: Partial<PoiSearchMeta>;
}

type AmapPoiCloudResponse = ApiResponse<AmapPoiCloudData>;
export type AmapPoiSearchMode = 'around' | 'polygon' | 'keyword' | 'id';

export interface PoiSearchMeta {
  mode: AmapPoiSearchMode;
  cacheHit: boolean;
  cacheKey: string;
  apiCallCount: number;
  quotaBucket: string;
  radiusMeters?: number;
  keyword?: string;
  city?: string;
  adcode?: string;
  aroundCallCount: number;
  polygonCallCount: number;
  keywordCallCount: number;
  idCallCount: number;
  cacheHitCount: number;
  totalAmapApiCallCount: number;
}

export interface NearbyRestaurantOptions {
  mode?: AmapPoiSearchMode;
  location?: GeoPoint;
  radiusMeters?: number;
  pageSize?: number;
  pageCount?: number;
  keyword?: string;
  city?: string;
  adcode?: string;
  polygon?: string;
  id?: string;
  types?: string;
  fetchProfile?: string;
  fetchReason?: string;
  cacheOnly?: boolean;
  maxAmapApiCalls?: number;
}

export interface PoiFetchMeta {
  poiCacheHit: boolean;
  poiCacheKey: string;
  poiCacheAgeMs?: number;
  poiFetchReason: string;
  amapApiCallCount: number;
  poiFetchMode?: AmapPoiSearchMode;
  aroundCallCount?: number;
  polygonCallCount?: number;
  keywordCallCount?: number;
  idCallCount?: number;
  cacheHitCount?: number;
  totalAmapApiCallCount?: number;
  quotaBucket?: string;
}

export interface NearbyRestaurantsResult {
  restaurants: Restaurant[];
  meta: PoiFetchMeta;
}

interface PoiCacheRequest {
  location: GeoPoint;
  locationBucket: string;
  radiusMeters: number;
  radiusBucket: number;
  keyword: string;
  types: string;
  pageSize: number;
  pageCount: number;
  fetchProfile: string;
  mode: AmapPoiSearchMode;
  city: string;
  adcode: string;
  polygon: string;
  id: string;
  quotaBucket: string;
  key: string;
}

interface CachedNearbyRestaurantsEntry extends PoiCacheRequest {
  restaurants: Restaurant[];
  createdAt: number;
}

interface NearbyRestaurantsCacheStore {
  version: 3;
  entries: CachedNearbyRestaurantsEntry[];
}

interface LegacyCachedNearbyRestaurants {
  restaurants: Restaurant[];
  createdAt: number;
  location: GeoPoint;
  radiusMeters: number;
  queryKey: string;
}

interface CacheLookupResult {
  entry: CachedNearbyRestaurantsEntry;
  restaurants: Restaurant[];
  ageMs: number;
  reason: string;
}

interface StorageAdapter {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

type LocationProvider = () => Promise<GeoPoint>;
type CloudFetcher = (
  location: GeoPoint,
  options: Required<Pick<NearbyRestaurantOptions, 'radiusMeters' | 'pageSize'>> &
    Pick<NearbyRestaurantOptions, 'mode' | 'pageCount' | 'keyword' | 'city' | 'adcode' | 'polygon' | 'id' | 'types' | 'fetchReason' | 'maxAmapApiCalls'>
) => Promise<{ restaurants: Restaurant[]; meta?: Partial<PoiFetchMeta> }>;

const CLOUD_FUNCTION_NAME = 'amapPoi';
const DEFAULT_RADIUS_METERS = 1500;
const PREFETCH_RADIUS_METERS = 10000;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE_COUNT = 1;
const DEFAULT_TYPES = '050000';
const DEFAULT_SEARCH_MODE: AmapPoiSearchMode = 'polygon';
const DEFAULT_FETCH_PROFILE = 'default';
const PREFETCH_FETCH_PROFILE = 'prefetch-broad-food';
const CACHE_KEY = 'nearby_restaurants_amap_cache';
export const POI_CACHE_TTL_MS = 45 * 60 * 1000;
export const POI_STALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const POI_CACHE_LOCATION_TOLERANCE_METERS = 2000;
export const POI_CACHE_MAX_RESTAURANTS = 1000;
const MAX_CACHE_ENTRIES = 8;

let sessionCacheStore: NearbyRestaurantsCacheStore | undefined;
let storageAdapterForTest: StorageAdapter | undefined;
let locationProviderForTest: LocationProvider | undefined;
let cloudFetcherForTest: CloudFetcher | undefined;

export async function getNearbyRestaurants(
  options: NearbyRestaurantOptions = {}
): Promise<Restaurant[]> {
  const result = await getNearbyRestaurantsWithMeta(options);

  return result.restaurants;
}

export async function getNearbyRestaurantsWithMeta(
  options: NearbyRestaurantOptions = {}
): Promise<NearbyRestaurantsResult> {
  requireLocationConsent();

  const location = options.location ?? (await getUserLocation());
  const request = buildPoiCacheRequest(location, options);
  const cached = readNearbyRestaurantsCache(request);

  if (cached) {
    return {
      restaurants: cached.restaurants,
      meta: {
        poiCacheHit: true,
        poiCacheKey: cached.entry.key,
        poiCacheAgeMs: cached.ageMs,
        poiFetchReason: cached.reason,
        amapApiCallCount: 0,
        poiFetchMode: request.mode,
        aroundCallCount: 0,
        polygonCallCount: 0,
        keywordCallCount: 0,
        idCallCount: 0,
        cacheHitCount: 1,
        totalAmapApiCallCount: 0,
        quotaBucket: request.quotaBucket
      }
    };
  }

  if (options.cacheOnly || (options.maxAmapApiCalls ?? 1) <= 0) {
    console.warn('AMap POI live request skipped.', {
      cacheKey: request.key,
      reason: options.cacheOnly ? 'cache-only-miss' : 'live-request-limit',
      requestedBy: options.fetchReason
    });

    return {
      restaurants: [],
      meta: {
        poiCacheHit: false,
        poiCacheKey: request.key,
        poiFetchReason: options.cacheOnly ? 'cache-only-miss' : 'live-request-limit',
        amapApiCallCount: 0,
        poiFetchMode: request.mode,
        aroundCallCount: 0,
        polygonCallCount: 0,
        keywordCallCount: 0,
        idCallCount: 0,
        cacheHitCount: 0,
        totalAmapApiCallCount: 0,
        quotaBucket: request.quotaBucket
      }
    };
  }

  console.warn('AMap POI live request.', {
    cacheKey: request.key,
    mode: request.mode,
    reason: options.fetchReason ?? 'cache-miss',
    maxAmapApiCalls: options.maxAmapApiCalls
  });

  let fetched: { restaurants: Restaurant[]; meta?: Partial<PoiFetchMeta> };

  try {
    fetched = await fetchNearbyRestaurantsFromCloud(location, {
      mode: request.mode,
      radiusMeters: request.radiusMeters,
      pageSize: request.pageSize,
      pageCount: request.pageCount,
      keyword: request.keyword,
      city: request.city,
      adcode: request.adcode,
      polygon: request.polygon,
      id: request.id,
      types: request.types,
      fetchReason: options.fetchReason,
      maxAmapApiCalls: options.maxAmapApiCalls
    });
  } catch (error) {
    const staleCached = isAmapQuotaError(error) ? readNearbyRestaurantsCache(request, { allowStale: true }) : undefined;

    if (staleCached) {
      console.warn('AMap quota exhausted; using stale local POI cache.', {
        cacheKey: staleCached.entry.key,
        ageMs: staleCached.ageMs,
        reason: options.fetchReason
      });

      return {
        restaurants: staleCached.restaurants,
        meta: {
          poiCacheHit: true,
          poiCacheKey: staleCached.entry.key,
          poiCacheAgeMs: staleCached.ageMs,
          poiFetchReason: `stale-cache-hit-after-quota:${staleCached.reason}`,
          amapApiCallCount: 0,
          poiFetchMode: request.mode,
          aroundCallCount: 0,
          polygonCallCount: 0,
          keywordCallCount: 0,
          idCallCount: 0,
          cacheHitCount: 1,
          totalAmapApiCallCount: 0,
          quotaBucket: request.quotaBucket
        }
      };
    }

    throw error;
  }
  const restaurants = normalizeRestaurantsForCache(fetched.restaurants);
  const liveMeta = normalizeLivePoiFetchMeta(request, fetched.meta, options.fetchReason);

  if (restaurants.length > 0) {
    writeNearbyRestaurantsCache({
      ...request,
      restaurants,
      createdAt: Date.now()
    });
  }

  return {
    restaurants,
    meta: liveMeta
  };
}

// 首页预取的多类目关键词 + 各自拉取页数：覆盖正餐、高端、快餐小吃、各菜系、饮品甜品，
// 让缓存池包含全价位全品类，避免不选品牌/高预算时池子里没有合适的店。
// 页数差异化：broad 拉满（高德 polygon 单次上限约 8 页/200 条），高端类目加深到 4 页
// （高端店在高德默认热度排序里靠后，broad 即使拉满也只能覆盖约 25 家高端，需专项搜索补足），
// 其余高频类目保持 2 页即可。稀疏区域云函数会在某页返回不足时自动提前停止，不会空耗调用。
//
// ⚠️ 顺序很关键：带关键词的类目组必须排在 broad（空关键词）之前。
// 缓存命中判定里"空关键词条目可经本地过滤覆盖任何带词请求"，若 broad 先写入缓存，
// 后续类目组会直接命中 broad 缓存、不再真正按类目搜索（高端等专项店就补不进池子）。
// 把 broad 放最后，保证各类目都真实搜索一次、把各自品类的店补进池，broad 最后再补全量正餐。
const PREFETCH_BROAD_PAGE_COUNT = 8;
const PREFETCH_PREMIUM_PAGE_COUNT = 4;
const PREFETCH_CATEGORY_PAGE_COUNT = 2;
const PREFETCH_KEYWORD_GROUPS: Array<{ keyword: string; pageCount: number }> = [
  { keyword: '黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining', pageCount: PREFETCH_PREMIUM_PAGE_COUNT },
  { keyword: '酒店餐厅|私房菜|主厨餐厅|牛排馆|融合料理|海鲜放题', pageCount: PREFETCH_PREMIUM_PAGE_COUNT },
  { keyword: '快餐|简餐|盖饭|面|套餐|小吃|粥|粉', pageCount: PREFETCH_CATEGORY_PAGE_COUNT },
  { keyword: '火锅|烧烤|川菜|湘菜|粤菜|江浙|日料|西餐|东北菜', pageCount: PREFETCH_CATEGORY_PAGE_COUNT },
  { keyword: '奶茶|咖啡|茶饮|甜品|烘焙|酒店下午茶|精品咖啡', pageCount: PREFETCH_CATEGORY_PAGE_COUNT },
  { keyword: '', pageCount: PREFETCH_BROAD_PAGE_COUNT }
];

export async function prefetchNearbyRestaurantCandidates(
  options: NearbyRestaurantOptions = {}
): Promise<PoiFetchMeta> {
  requireLocationConsent();

  const location = options.location ?? (await getUserLocation());
  // 预取半径至少为 PREFETCH_RADIUS_METERS，确保缓存能覆盖推荐可能用到的较大半径（如距离不限）
  const radiusMeters = Math.max(options.radiusMeters ?? PREFETCH_RADIUS_METERS, PREFETCH_RADIUS_METERS);
  const pool = new Map<string, Restaurant>();
  let lastMeta: PoiFetchMeta | undefined;

  // 多类目串行预取（经串行节流不会超 QPS），累积去重成一个大池
  for (let index = 0; index < PREFETCH_KEYWORD_GROUPS.length; index += 1) {
    const { keyword, pageCount } = PREFETCH_KEYWORD_GROUPS[index];
    const result = await getNearbyRestaurantsWithMeta({
      ...options,
      location,
      radiusMeters,
      mode: 'polygon',
      pageSize: 25,
      pageCount,
      keyword,
      types: options.types ?? DEFAULT_TYPES,
      fetchProfile: PREFETCH_FETCH_PROFILE,
      fetchReason: keyword ? 'home-prefetch-category' : 'home-prefetch-broad',
      // API 调用预算需 >= 该组页数，否则云函数会在拉到预算上限时提前截断，加深就失效了
      maxAmapApiCalls: Math.max(options.maxAmapApiCalls ?? 0, pageCount)
    }).catch((error: unknown) => {
      console.warn('AMap POI prefetch group failed.', { keyword, error });
      return undefined;
    });

    if (result) {
      result.restaurants.forEach((restaurant) => pool.set(restaurant.id, restaurant));
      lastMeta = result.meta;
    }
  }

  const restaurants = [...pool.values()];

  // 把累积的全品类大池写入一个 broad 缓存条目（keyword 为空），供推荐直接复用，
  // 避免推荐再逐个实时请求高德，并保证不选品牌/高预算时也有合适候选。
  if (restaurants.length > 0) {
    const broadRequest = buildPoiCacheRequest(location, {
      radiusMeters,
      mode: 'polygon',
      keyword: '',
      types: options.types ?? DEFAULT_TYPES,
      pageSize: 25,
      pageCount: PREFETCH_BROAD_PAGE_COUNT,
      fetchProfile: PREFETCH_FETCH_PROFILE
    });

    writeNearbyRestaurantsCache({
      ...broadRequest,
      restaurants,
      createdAt: Date.now()
    });
  }

  console.warn('AMap POI prefetch finished.', {
    groups: PREFETCH_KEYWORD_GROUPS.length,
    count: restaurants.length,
    reason: lastMeta?.poiFetchReason ?? 'home-prefetch'
  });

  return (
    lastMeta ?? {
      poiCacheHit: false,
      poiCacheKey: '',
      poiFetchReason: 'home-prefetch-empty',
      amapApiCallCount: 0
    }
  );
}

export function buildPoiCacheKey(options: NearbyRestaurantOptions & { location: GeoPoint }): string {
  return buildPoiCacheRequest(options.location, options).key;
}

export function __resetNearbyRestaurantCacheForTest() {
  sessionCacheStore = undefined;
  storageAdapterForTest = undefined;
  locationProviderForTest = undefined;
  cloudFetcherForTest = undefined;
}

export function __setAmapPoiStorageAdapterForTest(adapter: StorageAdapter | undefined) {
  storageAdapterForTest = adapter;
  sessionCacheStore = undefined;
}

export function __setAmapPoiLocationProviderForTest(provider: LocationProvider | undefined) {
  locationProviderForTest = provider;
}

export function __setAmapPoiCloudFetcherForTest(fetcher: CloudFetcher | undefined) {
  cloudFetcherForTest = fetcher;
}

async function getUserLocation(): Promise<GeoPoint> {
  if (locationProviderForTest) {
    return locationProviderForTest();
  }

  requireLocationConsent();

  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      // wx.getLocation only reads device coordinates and does not consume AMap search quota.
      // Quota is consumed by amapPoi cloud calls that hit place/around, regeo, or IP location.
      success: (result) => {
        resolve({
          latitude: result.latitude,
          longitude: result.longitude
        });
      },
      fail: reject
    });
  });
}

// 高德请求串行节流：所有实时请求排队执行并保证相邻间隔，避免首页 prefetch 与推荐
// 并发打高德触发 QPS 限流（infocode 10021）。个人 key QPS 约 3，350ms 间隔约 2.8 次/秒。
const AMAP_MIN_REQUEST_INTERVAL_MS = 350;
let amapRequestQueue: Promise<unknown> = Promise.resolve();
let lastAmapRequestAt = 0;

function scheduleAmapRequest<T>(task: () => Promise<T>): Promise<T> {
  const result = amapRequestQueue.then(async () => {
    const wait = AMAP_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastAmapRequestAt);

    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), wait));
    }

    lastAmapRequestAt = Date.now();
    return task();
  });

  // 无论成功或失败都让队列继续流转，避免单次失败卡住后续请求
  amapRequestQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

async function fetchNearbyRestaurantsFromCloud(
  location: GeoPoint,
  options: Required<Pick<NearbyRestaurantOptions, 'radiusMeters' | 'pageSize'>> &
    Pick<NearbyRestaurantOptions, 'mode' | 'pageCount' | 'keyword' | 'city' | 'adcode' | 'polygon' | 'id' | 'types' | 'fetchReason' | 'maxAmapApiCalls'>
): Promise<{ restaurants: Restaurant[]; meta?: Partial<PoiFetchMeta> }> {
  if (cloudFetcherForTest) {
    return cloudFetcherForTest(location, options);
  }

  requireLocationConsent();

  const app = getApp() as { globalData?: { cloudReady?: boolean } };

  if (!wx.cloud || !app.globalData?.cloudReady) {
    throw new Error('Cloud is not ready.');
  }

  // 通过串行节流队列发起，避免与 prefetch 等其他高德请求并发触发 QPS 限流
  const response = await scheduleAmapRequest(() =>
    wx.cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        mode: options.mode,
        radiusMeters: options.radiusMeters,
        pageSize: options.pageSize,
        pageCount: options.pageCount,
        keyword: options.keyword,
        city: options.city,
        adcode: options.adcode,
        polygon: options.polygon,
        id: options.id,
        types: options.types,
        fetchReason: options.fetchReason,
        maxAmapApiCalls: options.maxAmapApiCalls,
        cache: false
      }
    })
  );
  const result = response.result as AmapPoiCloudResponse | undefined;

  if (!result?.ok) {
    const error = new Error(result?.error.message ?? 'Failed to fetch nearby restaurants.') as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = result?.error.code;
    error.details = result?.error.details;
    throw error;
  }

  const searchMeta = result.data.searchMeta;
  const mode = normalizeSearchMode(searchMeta?.mode ?? options.mode);
  const apiCallCount = searchMeta?.totalAmapApiCallCount ?? searchMeta?.apiCallCount ?? result.data.amapApiCallCount ?? 0;

  return {
    restaurants: result.data.restaurants,
    meta: {
      poiCacheHit: result.data.cacheHit === true,
      poiCacheKey: result.data.cacheKey,
      poiCacheAgeMs: result.data.cacheAgeMs,
      poiFetchReason: result.data.fetchReason,
      amapApiCallCount: apiCallCount,
      poiFetchMode: mode,
      aroundCallCount: searchMeta?.aroundCallCount ?? (mode === 'around' ? apiCallCount : 0),
      polygonCallCount: searchMeta?.polygonCallCount ?? (mode === 'polygon' ? apiCallCount : 0),
      keywordCallCount: searchMeta?.keywordCallCount ?? (mode === 'keyword' ? apiCallCount : 0),
      idCallCount: searchMeta?.idCallCount ?? (mode === 'id' ? apiCallCount : 0),
      cacheHitCount: searchMeta?.cacheHitCount ?? (result.data.cacheHit === true ? 1 : 0),
      totalAmapApiCallCount: apiCallCount,
      quotaBucket: searchMeta?.quotaBucket ?? getQuotaBucket(mode)
    }
  };
}

function readNearbyRestaurantsCache(
  request: PoiCacheRequest,
  options: { allowStale?: boolean } = {}
): CacheLookupResult | undefined {
  const store = getNearbyRestaurantsCacheStore();
  const now = Date.now();
  const maxAgeMs = options.allowStale ? POI_STALE_CACHE_TTL_MS : POI_CACHE_TTL_MS;
  const candidates = store.entries
    .map((entry) => {
      const ageMs = now - entry.createdAt;

      if (ageMs > maxAgeMs) {
        return undefined;
      }

      if (getDistanceMeters(request.location, entry.location) > POI_CACHE_LOCATION_TOLERANCE_METERS) {
        return undefined;
      }

      if (request.radiusMeters > entry.radiusMeters) {
        return undefined;
      }

      if (!isTypesCovered(request.types, entry.types)) {
        return undefined;
      }

      const modeCoverage = getModeCoverage(request, entry);

      if (!modeCoverage.covered) {
        return undefined;
      }

      if (!isScopeCovered(request, entry)) {
        return undefined;
      }

      const keywordCoverage = getKeywordCoverage(request.keyword, entry.keyword);

      if (!keywordCoverage.covered) {
        return undefined;
      }

      const restaurants =
        keywordCoverage.mode === 'local-filter'
          ? filterRestaurantsByKeyword(entry.restaurants, request.keyword)
          : entry.restaurants;

      return {
        entry,
        restaurants: restaurants.length > 0 ? restaurants : entry.restaurants,
        ageMs,
        reason: options.allowStale
          ? `stale-${getCacheHitReason(modeCoverage.mode, keywordCoverage.mode)}`
          : getCacheHitReason(modeCoverage.mode, keywordCoverage.mode)
      };
    })
    .filter((item): item is CacheLookupResult => Boolean(item))
    .sort((left, right) => {
      if (left.entry.key === request.key && right.entry.key !== request.key) {
        return -1;
      }

      if (right.entry.key === request.key && left.entry.key !== request.key) {
        return 1;
      }

      return left.ageMs - right.ageMs;
    });

  return candidates[0];
}

function isAmapQuotaError(error: unknown): boolean {
  const payload = error as { message?: string; code?: string; details?: unknown } | undefined;
  const text = `${payload?.message ?? ''} ${payload?.code ?? ''} ${JSON.stringify(payload?.details ?? {})}`;

  return /AMAP_DAILY_QUOTA_EXHAUSTED|USER_DAILY_QUERY_OVER_LIMIT|DAILY_QUERY_OVER_LIMIT|10003|quota|daily|额度|配额|上限|耗尽|超限/i.test(text);
}

function writeNearbyRestaurantsCache(entry: CachedNearbyRestaurantsEntry) {
  const store = getNearbyRestaurantsCacheStore();
  const normalizedEntry: CachedNearbyRestaurantsEntry = {
    ...entry,
    restaurants: normalizeRestaurantsForCache(entry.restaurants)
  };
  const entries = [
    normalizedEntry,
    ...store.entries.filter((item) => item.key !== normalizedEntry.key)
  ]
    .filter((item) => Date.now() - item.createdAt <= POI_CACHE_TTL_MS)
    .slice(0, MAX_CACHE_ENTRIES);
  const nextStore: NearbyRestaurantsCacheStore = {
    version: 3,
    entries
  };

  sessionCacheStore = nextStore;

  try {
    getStorageAdapter()?.set(CACHE_KEY, nextStore);
  } catch (error) {
    console.warn('Failed to write nearby restaurants cache.', error);
  }
}

function getNearbyRestaurantsCacheStore(): NearbyRestaurantsCacheStore {
  if (sessionCacheStore) {
    return sessionCacheStore;
  }

  let rawCache: unknown;

  try {
    rawCache = getStorageAdapter()?.get(CACHE_KEY);
  } catch (error) {
    console.warn('Failed to read nearby restaurants cache.', error);
  }

  sessionCacheStore = normalizeCacheStore(rawCache);

  return sessionCacheStore;
}

function normalizeCacheStore(rawCache: unknown): NearbyRestaurantsCacheStore {
  if (
    rawCache &&
    typeof rawCache === 'object' &&
    ((rawCache as { version?: number }).version === 3 || (rawCache as { version?: number }).version === 2) &&
    Array.isArray((rawCache as { entries?: unknown[] }).entries)
  ) {
    return {
      version: 3,
      entries: ((rawCache as { entries: unknown[] }).entries)
        .map(normalizeCachedNearbyRestaurantsEntry)
        .filter((entry): entry is CachedNearbyRestaurantsEntry => Boolean(entry))
    };
  }

  const legacy = rawCache as LegacyCachedNearbyRestaurants | undefined;

  if (legacy?.location && Array.isArray(legacy.restaurants)) {
    const request = buildPoiCacheRequest(legacy.location, {
      radiusMeters: legacy.radiusMeters,
      keyword: '',
      types: DEFAULT_TYPES,
      fetchProfile: DEFAULT_FETCH_PROFILE
    });

    return {
      version: 3,
      entries: [
        {
          ...request,
          restaurants: normalizeRestaurantsForCache(legacy.restaurants),
          createdAt: legacy.createdAt
        }
      ]
    };
  }

  return {
    version: 3,
    entries: []
  };
}

function normalizeCachedNearbyRestaurantsEntry(
  entry: unknown
): CachedNearbyRestaurantsEntry | undefined {
  if (!entry || typeof entry !== 'object' || !Array.isArray((entry as CachedNearbyRestaurantsEntry).restaurants)) {
    return undefined;
  }

  const rawEntry = entry as Partial<CachedNearbyRestaurantsEntry>;

  if (!rawEntry.location || typeof rawEntry.createdAt !== 'number') {
    return undefined;
  }

  const request = buildPoiCacheRequest(rawEntry.location, {
    mode: normalizeSearchMode(rawEntry.mode ?? 'around'),
    radiusMeters: rawEntry.radiusMeters,
    pageSize: rawEntry.pageSize,
    pageCount: rawEntry.pageCount,
    keyword: rawEntry.keyword,
    types: rawEntry.types,
    fetchProfile: rawEntry.fetchProfile,
    city: rawEntry.city,
    adcode: rawEntry.adcode,
    polygon: rawEntry.polygon,
    id: rawEntry.id
  });

  return {
    ...request,
    key: typeof rawEntry.key === 'string' && rawEntry.key ? rawEntry.key : request.key,
    restaurants: normalizeRestaurantsForCache(rawEntry.restaurants ?? []),
    createdAt: rawEntry.createdAt
  };
}

function getStorageAdapter(): StorageAdapter | undefined {
  if (storageAdapterForTest) {
    return storageAdapterForTest;
  }

  if (typeof wx === 'undefined') {
    return undefined;
  }

  return {
    get: (key: string) => wx.getStorageSync(key),
    set: (key: string, value: unknown) => wx.setStorageSync(key, value)
  };
}

function buildPoiCacheRequest(location: GeoPoint, options: NearbyRestaurantOptions): PoiCacheRequest {
  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = options.pageCount ?? DEFAULT_PAGE_COUNT;
  const mode = normalizeSearchMode(options.mode);
  const keyword = normalizeKeyword(options.keyword);
  const types = normalizeTypes(options.types);
  const fetchProfile = normalizeFetchProfile(options.fetchProfile);
  const city = normalizeOptionalText(options.city);
  const adcode = normalizeOptionalText(options.adcode);
  const id = normalizeOptionalText(options.id);
  const polygon =
    mode === 'polygon'
      ? normalizeOptionalText(options.polygon) || buildRectanglePolygon(location, radiusMeters)
      : '';
  const quotaBucket = getQuotaBucket(mode);
  const locationBucket = buildLocationBucket(location);
  const radiusBucket = buildRadiusBucket(radiusMeters);
  const key = [
    'v3',
    `mode-${mode}`,
    `loc-${locationBucket}`,
    `r-${radiusBucket}`,
    `types-${normalizeKeySegment(types)}`,
    `kw-${normalizeKeySegment(keyword || 'broad')}`,
    `city-${normalizeKeySegment(city || 'none')}`,
    `ad-${normalizeKeySegment(adcode || 'none')}`,
    `poly-${polygon ? hashString(polygon) : 'none'}`,
    `id-${normalizeKeySegment(id || 'none')}`,
    `ps-${pageSize}`,
    `pc-${pageCount}`,
    `fp-${normalizeKeySegment(fetchProfile)}`
  ].join('|');

  return {
    location,
    locationBucket,
    radiusMeters,
    radiusBucket,
    keyword,
    types,
    pageSize,
    pageCount,
    fetchProfile,
    mode,
    city,
    adcode,
    polygon,
    id,
    quotaBucket,
    key
  };
}

function normalizeLivePoiFetchMeta(
  request: PoiCacheRequest,
  meta: Partial<PoiFetchMeta> | undefined,
  fetchReason: string | undefined
): PoiFetchMeta {
  const apiCallCount =
    meta?.totalAmapApiCallCount ?? meta?.amapApiCallCount ?? Math.max(1, request.pageCount);
  const defaultCounts = buildDefaultModeCallCounts(request.mode, apiCallCount);

  return {
    poiCacheHit: false,
    poiCacheKey: meta?.poiCacheKey ?? request.key,
    poiCacheAgeMs: meta?.poiCacheAgeMs,
    poiFetchReason: meta?.poiFetchReason ?? fetchReason ?? `cache-miss-${request.mode}-live-fetch`,
    amapApiCallCount: apiCallCount,
    poiFetchMode: meta?.poiFetchMode ?? request.mode,
    aroundCallCount: meta?.aroundCallCount ?? defaultCounts.aroundCallCount,
    polygonCallCount: meta?.polygonCallCount ?? defaultCounts.polygonCallCount,
    keywordCallCount: meta?.keywordCallCount ?? defaultCounts.keywordCallCount,
    idCallCount: meta?.idCallCount ?? defaultCounts.idCallCount,
    cacheHitCount: meta?.cacheHitCount ?? 0,
    totalAmapApiCallCount: meta?.totalAmapApiCallCount ?? apiCallCount,
    quotaBucket: meta?.quotaBucket ?? request.quotaBucket
  };
}

function buildDefaultModeCallCounts(mode: AmapPoiSearchMode, apiCallCount: number) {
  return {
    aroundCallCount: mode === 'around' ? apiCallCount : 0,
    polygonCallCount: mode === 'polygon' ? apiCallCount : 0,
    keywordCallCount: mode === 'keyword' ? apiCallCount : 0,
    idCallCount: mode === 'id' ? apiCallCount : 0
  };
}

function normalizeSearchMode(mode: string | undefined): AmapPoiSearchMode {
  if (mode === 'around' || mode === 'polygon' || mode === 'keyword' || mode === 'id') {
    return mode;
  }

  return DEFAULT_SEARCH_MODE;
}

function normalizeOptionalText(value: string | undefined): string {
  return (value ?? '').trim();
}

function getQuotaBucket(mode: AmapPoiSearchMode): string {
  if (mode === 'around') {
    return 'place-around';
  }

  if (mode === 'polygon') {
    return 'place-polygon';
  }

  if (mode === 'keyword') {
    return 'place-keyword';
  }

  return 'place-id';
}

function buildRectanglePolygon(location: GeoPoint, radiusMeters: number): string {
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.cos(toRadians(location.latitude)) || 1);
  const west = formatCoordinate(clampCoordinate(location.longitude - longitudeDelta, -180, 180));
  const south = formatCoordinate(clampCoordinate(location.latitude - latitudeDelta, -90, 90));
  const east = formatCoordinate(clampCoordinate(location.longitude + longitudeDelta, -180, 180));
  const north = formatCoordinate(clampCoordinate(location.latitude + latitudeDelta, -90, 90));

  return `${west},${south}|${east},${north}`;
}

function clampCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function buildLocationBucket(location: GeoPoint): string {
  return `${roundCoordinate(location.latitude)}_${roundCoordinate(location.longitude)}`;
}

function roundCoordinate(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function buildRadiusBucket(radiusMeters: number): number {
  return Math.ceil(radiusMeters / 500) * 500;
}

function normalizeKeyword(keyword: string | undefined): string {
  return (keyword ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeTypes(types: string | undefined): string {
  return (types ?? DEFAULT_TYPES).trim() || DEFAULT_TYPES;
}

function normalizeFetchProfile(fetchProfile: string | undefined): string {
  return (fetchProfile ?? DEFAULT_FETCH_PROFILE).trim() || DEFAULT_FETCH_PROFILE;
}

function normalizeKeySegment(value: string): string {
  return value
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function isTypesCovered(requestTypes: string, cacheTypes: string): boolean {
  return requestTypes === cacheTypes || cacheTypes === DEFAULT_TYPES;
}

function getModeCoverage(
  request: PoiCacheRequest,
  entry: CachedNearbyRestaurantsEntry
): { covered: boolean; mode: 'exact' | 'broad-polygon' | 'broad-around' | 'keyword-cache' } {
  if (request.mode === 'id') {
    return {
      covered: entry.mode === 'id' && request.id === entry.id,
      mode: 'exact'
    };
  }

  if (request.mode === entry.mode) {
    return { covered: true, mode: request.mode === 'keyword' ? 'keyword-cache' : 'exact' };
  }

  if (entry.mode === 'polygon' && (request.mode === 'around' || request.mode === 'keyword')) {
    return { covered: true, mode: 'broad-polygon' };
  }

  if (entry.mode === 'around' && (request.mode === 'polygon' || request.mode === 'keyword')) {
    return { covered: true, mode: 'broad-around' };
  }

  return { covered: false, mode: 'exact' };
}

function isScopeCovered(request: PoiCacheRequest, entry: CachedNearbyRestaurantsEntry): boolean {
  if (request.mode === 'keyword' || entry.mode === 'keyword') {
    if (request.adcode && entry.adcode && request.adcode !== entry.adcode) {
      return false;
    }

    if (!request.adcode && request.city && entry.city && request.city !== entry.city) {
      return false;
    }
  }

  return true;
}

function getCacheHitReason(
  modeCoverage: 'exact' | 'broad-polygon' | 'broad-around' | 'keyword-cache',
  keywordCoverage: 'exact' | 'local-filter'
): string {
  if (modeCoverage === 'broad-polygon') {
    return keywordCoverage === 'local-filter'
      ? 'polygon-cache-local-keyword-hit'
      : 'polygon-cache-cover-hit';
  }

  if (modeCoverage === 'broad-around') {
    return keywordCoverage === 'local-filter'
      ? 'around-cache-local-keyword-hit'
      : 'around-cache-cover-hit';
  }

  if (modeCoverage === 'keyword-cache') {
    return 'keyword-cache-hit';
  }

  return keywordCoverage === 'exact' ? 'session-cache-hit' : 'broad-food-cache-hit';
}

function getKeywordCoverage(
  requestKeyword: string,
  cacheKeyword: string
): { covered: boolean; mode: 'exact' | 'local-filter' } {
  if (requestKeyword === cacheKeyword) {
    return { covered: true, mode: 'exact' };
  }

  if (requestKeyword && !cacheKeyword) {
    return { covered: true, mode: 'local-filter' };
  }

  return { covered: false, mode: 'exact' };
}

function filterRestaurantsByKeyword(restaurants: Restaurant[], keyword: string): Restaurant[] {
  const terms = keyword
    .split('|')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  if (terms.length === 0) {
    return restaurants;
  }

  return restaurants.filter((restaurant) => {
    const text = [
      restaurant.name,
      restaurant.category,
      restaurant.description,
      restaurant.address,
      ...(restaurant.tags ?? []),
      ...(restaurant.tagIds ?? []),
      ...(restaurant.signatureDishes ?? [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return terms.some((term) => text.includes(term));
  });
}

function normalizeRestaurantsForCache(restaurants: Restaurant[]): Restaurant[] {
  return restaurants
    .map((restaurant, index) => ({
      restaurant: normalizeRestaurantForCache(restaurant),
      index
    }))
    .sort((left, right) => {
      const openScore =
        getOpenStatusRank(left.restaurant.openStatus) - getOpenStatusRank(right.restaurant.openStatus);

      if (openScore !== 0) {
        return openScore;
      }

      const distanceScore =
        (left.restaurant.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
        (right.restaurant.distanceMeters ?? Number.MAX_SAFE_INTEGER);

      if (distanceScore !== 0) {
        return distanceScore;
      }

      const ratingScore = (right.restaurant.rating ?? 0) - (left.restaurant.rating ?? 0);

      if (ratingScore !== 0) {
        return ratingScore;
      }

      return left.index - right.index;
    })
    .slice(0, POI_CACHE_MAX_RESTAURANTS)
    .map((item) => item.restaurant);
}

function normalizeRestaurantForCache(restaurant: Restaurant): Restaurant {
  return {
    id: restaurant.id,
    name: restaurant.name,
    tags: restaurant.tags ?? [],
    tagIds: restaurant.tagIds,
    tagRefs: restaurant.tagRefs,
    description: restaurant.description,
    category: restaurant.category,
    address: restaurant.address,
    location: restaurant.location,
    distanceMeters: restaurant.distanceMeters,
    priceLevel: restaurant.priceLevel,
    averageCostYuan: restaurant.averageCostYuan,
    openStatus: restaurant.openStatus,
    signatureDishes: restaurant.signatureDishes,
    coverImageUrl: restaurant.coverImageUrl,
    rating: restaurant.rating,
    source: restaurant.source ?? 'amap',
    status: restaurant.status
  };
}

function getOpenStatusRank(openStatus: Restaurant['openStatus']): number {
  if (openStatus === 'open') {
    return 0;
  }

  if (openStatus === 'busy' || openStatus === 'unknown' || openStatus === undefined) {
    return 1;
  }

  return 2;
}

function getDistanceMeters(left: GeoPoint, right: GeoPoint): number {
  const earthRadiusMeters = 6371000;
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
