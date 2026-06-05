import type { ApiResponse } from '../types/recommendation';
import type { GeoPoint, Restaurant } from '../types/restaurant';

interface AmapPoiCloudData {
  restaurants: Restaurant[];
  source: 'amap';
  fetchedAt: string;
  location: GeoPoint;
  radiusMeters: number;
}

type AmapPoiCloudResponse = ApiResponse<AmapPoiCloudData>;

interface NearbyRestaurantOptions {
  radiusMeters?: number;
  pageSize?: number;
  pageCount?: number;
  keyword?: string;
  types?: string;
}

interface CachedNearbyRestaurants {
  restaurants: Restaurant[];
  createdAt: number;
  location: GeoPoint;
  radiusMeters: number;
  queryKey: string;
}

const CLOUD_FUNCTION_NAME = 'amapPoi';
const DEFAULT_RADIUS_METERS = 1500;
const DEFAULT_PAGE_SIZE = 20;
const CACHE_KEY = 'nearby_restaurants_amap_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LOCATION_TOLERANCE_METERS = 100;

export async function getNearbyRestaurants(
  options: NearbyRestaurantOptions = {}
): Promise<Restaurant[]> {
  const location = await getUserLocation();
  const radiusMeters = options.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const queryKey = buildQueryKey(options);
  const cached = readNearbyRestaurantsCache(location, radiusMeters, queryKey);

  if (cached.length > 0) {
    return cached;
  }

  const restaurants = await fetchNearbyRestaurantsFromCloud(location, {
      radiusMeters,
      pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
      pageCount: options.pageCount,
      keyword: options.keyword,
      types: options.types
  });

  if (restaurants.length > 0) {
    writeNearbyRestaurantsCache({
      restaurants,
      createdAt: Date.now(),
      location,
      radiusMeters,
      queryKey
    });
  }

  return restaurants;
}

async function getUserLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
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
    Pick<NearbyRestaurantOptions, 'pageCount' | 'keyword' | 'types'>
): Promise<Restaurant[]> {
  const app = getApp<IAppOption>();

  if (!wx.cloud || !app.globalData.cloudReady) {
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
      types: options.types
    }
  });
  const result = response.result as AmapPoiCloudResponse | undefined;

  if (!result?.ok) {
    throw new Error(result?.error.message ?? 'Failed to fetch nearby restaurants.');
  }

  return result.data.restaurants;
}

function readNearbyRestaurantsCache(
  location: GeoPoint,
  radiusMeters: number,
  queryKey: string
): Restaurant[] {
  let cached: CachedNearbyRestaurants | undefined;

  try {
    cached = wx.getStorageSync(CACHE_KEY) as CachedNearbyRestaurants | undefined;
  } catch (error) {
    console.warn('Failed to read nearby restaurants cache.', error);
    return [];
  }

  if (!cached || !Array.isArray(cached.restaurants)) {
    return [];
  }

  const isFresh = Date.now() - cached.createdAt < CACHE_TTL_MS;
  const isNearby =
    getDistanceMeters(location, cached.location) <=
    Math.min(CACHE_LOCATION_TOLERANCE_METERS, radiusMeters / 2);
  const isSameQuery = cached.queryKey === queryKey;

  return isFresh && isNearby && isSameQuery ? cached.restaurants : [];
}

function writeNearbyRestaurantsCache(cache: CachedNearbyRestaurants) {
  try {
    wx.setStorageSync(CACHE_KEY, cache);
  } catch (error) {
    console.warn('Failed to write nearby restaurants cache.', error);
  }
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

function buildQueryKey(options: NearbyRestaurantOptions): string {
  return [
    options.radiusMeters ?? DEFAULT_RADIUS_METERS,
    options.pageSize ?? DEFAULT_PAGE_SIZE,
    options.pageCount ?? 1,
    options.keyword?.trim() ?? '',
    options.types?.trim() ?? ''
  ].join('|');
}
