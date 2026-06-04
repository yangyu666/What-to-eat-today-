import type { MealCandidate } from '../models/meal';
import type { UserQuestionnaireResult } from '../types/userPreference';
import { buildAmapRestaurantQuery } from './amapQueryBuilder';
import { getNearbyRestaurants } from './amapPoiService';
import type { HistoryFilterContext } from './historyService';
import { mapAnswersToPreferenceProfile } from './preferenceMapper';
import { recommendRestaurants } from './recommendationEngine';

export async function getTodayRecommendation(): Promise<MealCandidate> {
  const [candidate] = await getRecommendations(undefined, 1);

  if (!candidate) {
    throw new Error('No recommendation candidates available.');
  }

  return candidate;
}

export async function getLocalRecommendations(
  questionnaire?: UserQuestionnaireResult,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  return getRecommendations(questionnaire, 4, historyFilterContext);
}

async function getRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  const poiCandidates = await getAmapRecommendations(questionnaire, limit, historyFilterContext);

  if (poiCandidates.length > 0) {
    return poiCandidates;
  }

  throw new Error('No real nearby restaurant candidates available from AMap.');
}

async function getAmapRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  const preferenceSnapshot = mapAnswersToPreferenceProfile(questionnaire?.answers ?? []);
  const recommendationContext = buildRecommendationContext(preferenceSnapshot, historyFilterContext);
  const amapQuery = buildAmapRestaurantQuery(preferenceSnapshot);
  const attempts = buildAmapQueryAttempts(amapQuery);
  const restaurantPool = new Map<string, Awaited<ReturnType<typeof getNearbyRestaurants>>[number]>();

  for (const attempt of attempts) {
    const restaurants = await getNearbyRestaurants({
      radiusMeters: attempt.radiusMeters,
      keyword: attempt.keyword,
      types: attempt.types,
      pageSize: 25
    }).catch((error) => {
      console.warn('Nearby AMap POI recommendation attempt failed.', attempt, error);
      return [];
    });

    if (restaurants.length === 0) {
      continue;
    }

    restaurants.forEach((restaurant) => {
      const key = normalizeRestaurantPoolKey(restaurant);
      restaurantPool.set(key, restaurant);
    });
  }

  if (restaurantPool.size === 0) {
    return [];
  }

  const result = recommendRestaurants({
    restaurants: [...restaurantPool.values()],
    context: recommendationContext,
    limit,
    source: 'amap'
  });

  return result.candidates;
}

function buildAmapQueryAttempts(
  amapQuery: ReturnType<typeof buildAmapRestaurantQuery>
): Array<{ radiusMeters: number; keyword: string; types: string }> {
  const baseRadius = amapQuery.radiusMeters;
  const wideRadius = Math.max(baseRadius, 3000);
  const baseKeyword = amapQuery.keywords ?? '';
  const relaxedKeyword = getStrictCategoryKeyword(baseKeyword) ?? '';
  const premiumKeywords = getPremiumKeywordAttempts(baseKeyword);
  const premiumSearch = premiumKeywords.length > 0;
  const maxRadius = Math.max(baseRadius, premiumSearch ? 15000 : 10000);

  return [
    {
      radiusMeters: baseRadius,
      keyword: baseKeyword,
      types: amapQuery.types
    },
    {
      radiusMeters: wideRadius,
      keyword: relaxedKeyword,
      types: amapQuery.types
    },
    {
      radiusMeters: maxRadius,
      keyword: relaxedKeyword,
      types: amapQuery.types
    },
    ...premiumKeywords.flatMap((keyword) => [
      {
        radiusMeters: wideRadius,
        keyword,
        types: amapQuery.types
      },
      {
        radiusMeters: 10000,
        keyword,
        types: amapQuery.types
      },
      {
        radiusMeters: maxRadius,
        keyword,
        types: amapQuery.types
      }
    ])
  ].filter((attempt, index, attempts) => {
    return attempts.findIndex((item) => {
      return item.radiusMeters === attempt.radiusMeters && item.keyword === attempt.keyword && item.types === attempt.types;
    }) === index;
  });
}

function normalizeRestaurantPoolKey(restaurant: Awaited<ReturnType<typeof getNearbyRestaurants>>[number]): string {
  const name = (restaurant.name ?? '').toLowerCase().replace(/\s+/g, '');
  const location = restaurant.location;
  const locationKey =
    location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
      ? `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`
      : '';

  return restaurant.id || `${name}|${locationKey}`;
}

function getPremiumKeywordAttempts(keyword: string): string[] {
  if (!/高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑/.test(keyword)) {
    return [];
  }

  return [
    '黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining',
    '炳胜|利苑|大董|新荣记|甬府|莆田|松鹤楼|广州酒家|白天鹅',
    '高端餐厅|私房菜'
  ];
}

function getStrictCategoryKeyword(keyword: string): string | undefined {
  if (/奶茶|茶饮|饮品|霸王茶姬|喜茶|奈雪|一点点/.test(keyword)) {
    return '奶茶|茶饮|霸王茶姬|喜茶|奈雪|一点点';
  }

  if (/咖啡|cafe|coffee|下午茶/.test(keyword)) {
    return '咖啡|cafe|coffee|下午茶';
  }

  if (/甜品|蛋糕|面包|烘焙|西点/.test(keyword)) {
    return '甜品|蛋糕|面包|烘焙|西点';
  }

  if (/高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑/.test(keyword)) {
    return '高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑';
  }

  return undefined;
}

function buildRecommendationContext(
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>,
  historyFilterContext?: HistoryFilterContext
) {
  const historyFilterEnabled = historyFilterContext?.historyFilterEnabled === true;

  return {
    preferenceSnapshot,
    excludeRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.excludedHistoryRestaurantIds ?? []
      : [],
    historyFilterEnabled,
    excludedHistoryRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.excludedHistoryRestaurantIds ?? []
      : [],
    historyPenaltyRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.historyPenaltyRestaurantIds ?? []
      : [],
    historyPenaltyReasons: historyFilterEnabled
      ? historyFilterContext?.historyPenaltyReasons ?? []
      : []
  };
}
