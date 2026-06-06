import type { ApiResponse } from '../types/recommendation';
import type { GeoPoint, Restaurant } from '../types/restaurant';

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
const PREFETCH_RADIUS_METERS = 5000;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE_COUNT = 1;
const DEFAULT_TYPES = '050000';
const DEFAULT_SEARCH_MODE: AmapPoiSearchMode = 'polygon';
const DEFAULT_FETCH_PROFILE = 'default';
const PREFETCH_FETCH_PROFILE = 'prefetch-broad-food';
const CACHE_KEY = 'nearby_restaurants_amap_cache';
export const POI_CACHE_TTL_MS = 45 * 60 * 1000;
export const POI_CACHE_LOCATION_TOLERANCE_METERS = 2000;
export const POI_CACHE_MAX_RESTAURANTS = 250;
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

  const fetched = await fetchNearbyRestaurantsFromCloud(location, {
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

export async function prefetchNearbyRestaurantCandidates(
  options: NearbyRestaurantOptions = {}
): Promise<PoiFetchMeta> {
  const result = await getNearbyRestaurantsWithMeta({
    ...options,
    radiusMeters: options.radiusMeters ?? PREFETCH_RADIUS_METERS,
    mode: options.mode ?? DEFAULT_SEARCH_MODE,
    pageSize: options.pageSize ?? 25,
    pageCount: options.pageCount ?? 3,
    keyword: options.keyword ?? '',
    types: options.types ?? DEFAULT_TYPES,
    fetchProfile: options.fetchProfile ?? PREFETCH_FETCH_PROFILE,
    fetchReason: options.fetchReason ?? 'home-prefetch',
    maxAmapApiCalls: options.maxAmapApiCalls ?? 3
  });

  console.warn('AMap POI prefetch finished.', {
    cacheHit: result.meta.poiCacheHit,
    cacheKey: result.meta.poiCacheKey,
    mode: result.meta.poiFetchMode,
    count: result.restaurants.length,
    apiCalls: result.meta.amapApiCallCount,
    reason: result.meta.poiFetchReason
  });

  return result.meta;
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

async function fetchNearbyRestaurantsFromCloud(
  location: GeoPoint,
  options: Required<Pick<NearbyRestaurantOptions, 'radiusMeters' | 'pageSize'>> &
    Pick<NearbyRestaurantOptions, 'mode' | 'pageCount' | 'keyword' | 'city' | 'adcode' | 'polygon' | 'id' | 'types' | 'fetchReason' | 'maxAmapApiCalls'>
): Promise<{ restaurants: Restaurant[]; meta?: Partial<PoiFetchMeta> }> {
  if (cloudFetcherForTest) {
    return cloudFetcherForTest(location, options);
  }

  const app = getApp() as { globalData?: { cloudReady?: boolean } };

  if (!wx.cloud || !app.globalData?.cloudReady) {
    throw new Error('Cloud is not ready.');
  }

  const response = await wx.cloud.callFunction({
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
      maxAmapApiCalls: options.maxAmapApiCalls
    }
  });
  const result = response.result as AmapPoiCloudResponse | undefined;

  if (!result?.ok) {
    throw new Error(result?.error.message ?? 'Failed to fetch nearby restaurants.');
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

function readNearbyRestaurantsCache(request: PoiCacheRequest): CacheLookupResult | undefined {
  const store = getNearbyRestaurantsCacheStore();
  const now = Date.now();
  const candidates = store.entries
    .map((entry) => {
      const ageMs = now - entry.createdAt;

      if (ageMs > POI_CACHE_TTL_MS) {
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
        reason: getCacheHitReason(modeCoverage.mode, keywordCoverage.mode)
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
