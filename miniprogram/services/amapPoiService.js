"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POI_CACHE_MAX_RESTAURANTS = exports.POI_CACHE_LOCATION_TOLERANCE_METERS = exports.POI_CACHE_TTL_MS = void 0;
exports.getNearbyRestaurants = getNearbyRestaurants;
exports.getNearbyRestaurantsWithMeta = getNearbyRestaurantsWithMeta;
exports.prefetchNearbyRestaurantCandidates = prefetchNearbyRestaurantCandidates;
exports.buildPoiCacheKey = buildPoiCacheKey;
exports.__resetNearbyRestaurantCacheForTest = __resetNearbyRestaurantCacheForTest;
exports.__setAmapPoiStorageAdapterForTest = __setAmapPoiStorageAdapterForTest;
exports.__setAmapPoiLocationProviderForTest = __setAmapPoiLocationProviderForTest;
exports.__setAmapPoiCloudFetcherForTest = __setAmapPoiCloudFetcherForTest;
const CLOUD_FUNCTION_NAME = 'amapPoi';
const DEFAULT_RADIUS_METERS = 1500;
const PREFETCH_RADIUS_METERS = 5000;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE_COUNT = 1;
const DEFAULT_TYPES = '050000';
const DEFAULT_FETCH_PROFILE = 'default';
const PREFETCH_FETCH_PROFILE = 'prefetch-broad-food';
const CACHE_KEY = 'nearby_restaurants_amap_cache';
exports.POI_CACHE_TTL_MS = 45 * 60 * 1000;
exports.POI_CACHE_LOCATION_TOLERANCE_METERS = 2000;
exports.POI_CACHE_MAX_RESTAURANTS = 250;
const MAX_CACHE_ENTRIES = 8;
let sessionCacheStore;
let storageAdapterForTest;
let locationProviderForTest;
let cloudFetcherForTest;
async function getNearbyRestaurants(options = {}) {
    const result = await getNearbyRestaurantsWithMeta(options);
    return result.restaurants;
}
async function getNearbyRestaurantsWithMeta(options = {}) {
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
                amapApiCallCount: 0
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
                amapApiCallCount: 0
            }
        };
    }
    console.warn('AMap POI live request.', {
        cacheKey: request.key,
        reason: options.fetchReason ?? 'cache-miss',
        maxAmapApiCalls: options.maxAmapApiCalls
    });
    const fetched = await fetchNearbyRestaurantsFromCloud(location, {
        radiusMeters: request.radiusMeters,
        pageSize: request.pageSize,
        pageCount: request.pageCount,
        keyword: request.keyword,
        types: request.types,
        fetchReason: options.fetchReason,
        maxAmapApiCalls: options.maxAmapApiCalls
    });
    const restaurants = normalizeRestaurantsForCache(fetched.restaurants);
    if (restaurants.length > 0) {
        writeNearbyRestaurantsCache({
            ...request,
            restaurants,
            createdAt: Date.now()
        });
    }
    return {
        restaurants,
        meta: {
            poiCacheHit: false,
            poiCacheKey: fetched.meta?.poiCacheKey ?? request.key,
            poiCacheAgeMs: fetched.meta?.poiCacheAgeMs,
            poiFetchReason: fetched.meta?.poiFetchReason ?? options.fetchReason ?? 'cache-miss-live-fetch',
            amapApiCallCount: fetched.meta?.amapApiCallCount ?? Math.max(1, request.pageCount)
        }
    };
}
async function prefetchNearbyRestaurantCandidates(options = {}) {
    const result = await getNearbyRestaurantsWithMeta({
        ...options,
        radiusMeters: options.radiusMeters ?? PREFETCH_RADIUS_METERS,
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
        count: result.restaurants.length,
        apiCalls: result.meta.amapApiCallCount,
        reason: result.meta.poiFetchReason
    });
    return result.meta;
}
function buildPoiCacheKey(options) {
    return buildPoiCacheRequest(options.location, options).key;
}
function __resetNearbyRestaurantCacheForTest() {
    sessionCacheStore = undefined;
    storageAdapterForTest = undefined;
    locationProviderForTest = undefined;
    cloudFetcherForTest = undefined;
}
function __setAmapPoiStorageAdapterForTest(adapter) {
    storageAdapterForTest = adapter;
    sessionCacheStore = undefined;
}
function __setAmapPoiLocationProviderForTest(provider) {
    locationProviderForTest = provider;
}
function __setAmapPoiCloudFetcherForTest(fetcher) {
    cloudFetcherForTest = fetcher;
}
async function getUserLocation() {
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
async function fetchNearbyRestaurantsFromCloud(location, options) {
    if (cloudFetcherForTest) {
        return cloudFetcherForTest(location, options);
    }
    const app = getApp();
    if (!wx.cloud || !app.globalData?.cloudReady) {
        throw new Error('Cloud is not ready.');
    }
    const response = await wx.cloud.callFunction({
        name: CLOUD_FUNCTION_NAME,
        data: {
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: options.radiusMeters,
            pageSize: options.pageSize,
            pageCount: options.pageCount,
            keyword: options.keyword,
            types: options.types,
            fetchReason: options.fetchReason,
            maxAmapApiCalls: options.maxAmapApiCalls
        }
    });
    const result = response.result;
    if (!result?.ok) {
        throw new Error(result?.error.message ?? 'Failed to fetch nearby restaurants.');
    }
    return {
        restaurants: result.data.restaurants,
        meta: {
            poiCacheHit: result.data.cacheHit === true,
            poiCacheKey: result.data.cacheKey,
            poiCacheAgeMs: result.data.cacheAgeMs,
            poiFetchReason: result.data.fetchReason,
            amapApiCallCount: result.data.amapApiCallCount
        }
    };
}
function readNearbyRestaurantsCache(request) {
    const store = getNearbyRestaurantsCacheStore();
    const now = Date.now();
    const candidates = store.entries
        .map((entry) => {
        const ageMs = now - entry.createdAt;
        if (ageMs > exports.POI_CACHE_TTL_MS) {
            return undefined;
        }
        if (getDistanceMeters(request.location, entry.location) > exports.POI_CACHE_LOCATION_TOLERANCE_METERS) {
            return undefined;
        }
        if (request.radiusMeters > entry.radiusMeters) {
            return undefined;
        }
        if (!isTypesCovered(request.types, entry.types)) {
            return undefined;
        }
        const keywordCoverage = getKeywordCoverage(request.keyword, entry.keyword);
        if (!keywordCoverage.covered) {
            return undefined;
        }
        const restaurants = keywordCoverage.mode === 'local-filter'
            ? filterRestaurantsByKeyword(entry.restaurants, request.keyword)
            : entry.restaurants;
        return {
            entry,
            restaurants: restaurants.length > 0 ? restaurants : entry.restaurants,
            ageMs,
            reason: keywordCoverage.mode === 'exact' ? 'session-cache-hit' : 'broad-food-cache-hit'
        };
    })
        .filter((item) => Boolean(item))
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
function writeNearbyRestaurantsCache(entry) {
    const store = getNearbyRestaurantsCacheStore();
    const normalizedEntry = {
        ...entry,
        restaurants: normalizeRestaurantsForCache(entry.restaurants)
    };
    const entries = [
        normalizedEntry,
        ...store.entries.filter((item) => item.key !== normalizedEntry.key)
    ]
        .filter((item) => Date.now() - item.createdAt <= exports.POI_CACHE_TTL_MS)
        .slice(0, MAX_CACHE_ENTRIES);
    const nextStore = {
        version: 2,
        entries
    };
    sessionCacheStore = nextStore;
    try {
        getStorageAdapter()?.set(CACHE_KEY, nextStore);
    }
    catch (error) {
        console.warn('Failed to write nearby restaurants cache.', error);
    }
}
function getNearbyRestaurantsCacheStore() {
    if (sessionCacheStore) {
        return sessionCacheStore;
    }
    let rawCache;
    try {
        rawCache = getStorageAdapter()?.get(CACHE_KEY);
    }
    catch (error) {
        console.warn('Failed to read nearby restaurants cache.', error);
    }
    sessionCacheStore = normalizeCacheStore(rawCache);
    return sessionCacheStore;
}
function normalizeCacheStore(rawCache) {
    if (rawCache &&
        typeof rawCache === 'object' &&
        rawCache.version === 2 &&
        Array.isArray(rawCache.entries)) {
        return {
            version: 2,
            entries: rawCache.entries.filter((entry) => Array.isArray(entry.restaurants))
        };
    }
    const legacy = rawCache;
    if (legacy?.location && Array.isArray(legacy.restaurants)) {
        const request = buildPoiCacheRequest(legacy.location, {
            radiusMeters: legacy.radiusMeters,
            keyword: '',
            types: DEFAULT_TYPES,
            fetchProfile: DEFAULT_FETCH_PROFILE
        });
        return {
            version: 2,
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
        version: 2,
        entries: []
    };
}
function getStorageAdapter() {
    if (storageAdapterForTest) {
        return storageAdapterForTest;
    }
    if (typeof wx === 'undefined') {
        return undefined;
    }
    return {
        get: (key) => wx.getStorageSync(key),
        set: (key, value) => wx.setStorageSync(key, value)
    };
}
function buildPoiCacheRequest(location, options) {
    const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageCount = options.pageCount ?? DEFAULT_PAGE_COUNT;
    const keyword = normalizeKeyword(options.keyword);
    const types = normalizeTypes(options.types);
    const fetchProfile = normalizeFetchProfile(options.fetchProfile);
    const locationBucket = buildLocationBucket(location);
    const radiusBucket = buildRadiusBucket(radiusMeters);
    const key = [
        'v2',
        `loc-${locationBucket}`,
        `r-${radiusBucket}`,
        `types-${normalizeKeySegment(types)}`,
        `kw-${normalizeKeySegment(keyword || 'broad')}`,
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
        key
    };
}
function buildLocationBucket(location) {
    return `${roundCoordinate(location.latitude)}_${roundCoordinate(location.longitude)}`;
}
function roundCoordinate(value) {
    return (Math.round(value * 100) / 100).toFixed(2);
}
function buildRadiusBucket(radiusMeters) {
    return Math.ceil(radiusMeters / 500) * 500;
}
function normalizeKeyword(keyword) {
    return (keyword ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function normalizeTypes(types) {
    return (types ?? DEFAULT_TYPES).trim() || DEFAULT_TYPES;
}
function normalizeFetchProfile(fetchProfile) {
    return (fetchProfile ?? DEFAULT_FETCH_PROFILE).trim() || DEFAULT_FETCH_PROFILE;
}
function normalizeKeySegment(value) {
    return value
        .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
}
function isTypesCovered(requestTypes, cacheTypes) {
    return requestTypes === cacheTypes || cacheTypes === DEFAULT_TYPES;
}
function getKeywordCoverage(requestKeyword, cacheKeyword) {
    if (requestKeyword === cacheKeyword) {
        return { covered: true, mode: 'exact' };
    }
    if (requestKeyword && !cacheKeyword) {
        return { covered: true, mode: 'local-filter' };
    }
    return { covered: false, mode: 'exact' };
}
function filterRestaurantsByKeyword(restaurants, keyword) {
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
function normalizeRestaurantsForCache(restaurants) {
    return restaurants
        .map((restaurant, index) => ({
        restaurant: normalizeRestaurantForCache(restaurant),
        index
    }))
        .sort((left, right) => {
        const openScore = getOpenStatusRank(left.restaurant.openStatus) - getOpenStatusRank(right.restaurant.openStatus);
        if (openScore !== 0) {
            return openScore;
        }
        const distanceScore = (left.restaurant.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
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
        .slice(0, exports.POI_CACHE_MAX_RESTAURANTS)
        .map((item) => item.restaurant);
}
function normalizeRestaurantForCache(restaurant) {
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
function getOpenStatusRank(openStatus) {
    if (openStatus === 'open') {
        return 0;
    }
    if (openStatus === 'busy' || openStatus === 'unknown' || openStatus === undefined) {
        return 1;
    }
    return 2;
}
function getDistanceMeters(left, right) {
    const earthRadiusMeters = 6371000;
    const leftLatitude = toRadians(left.latitude);
    const rightLatitude = toRadians(right.latitude);
    const latitudeDelta = toRadians(right.latitude - left.latitude);
    const longitudeDelta = toRadians(right.longitude - left.longitude);
    const haversine = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
        Math.cos(leftLatitude) *
            Math.cos(rightLatitude) *
            Math.sin(longitudeDelta / 2) *
            Math.sin(longitudeDelta / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
function toRadians(value) {
    return (value * Math.PI) / 180;
}
