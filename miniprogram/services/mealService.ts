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

    const result = recommendRestaurants({
      restaurants,
      context: recommendationContext,
      limit,
      source: 'amap'
    });

    if (result.candidates.length > 0) {
      return result.candidates;
    }
  }

  return [];
}

function buildAmapQueryAttempts(
  amapQuery: ReturnType<typeof buildAmapRestaurantQuery>
): Array<{ radiusMeters: number; keyword: string; types: string }> {
  const baseRadius = amapQuery.radiusMeters;
  const wideRadius = Math.max(baseRadius, 3000);
  const baseKeyword = amapQuery.keywords ?? '';
  const relaxedKeyword = getStrictCategoryKeyword(baseKeyword) ?? '';

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
      radiusMeters: 5000,
      keyword: relaxedKeyword,
      types: amapQuery.types
    }
  ].filter((attempt, index, attempts) => {
    return attempts.findIndex((item) => {
      return item.radiusMeters === attempt.radiusMeters && item.keyword === attempt.keyword && item.types === attempt.types;
    }) === index;
  });
}

function getStrictCategoryKeyword(keyword: string): string | undefined {
  if (/奶茶|茶饮|饮品|霸王茶姬|喜茶|奈雪|一点点/.test(keyword)) {
    return '奶茶|茶饮|饮品|霸王茶姬|喜茶|奈雪|一点点';
  }

  if (/咖啡|cafe|coffee|下午茶/.test(keyword)) {
    return '咖啡|cafe|coffee|下午茶';
  }

  if (/甜品|蛋糕|面包|烘焙|西点/.test(keyword)) {
    return '甜品|蛋糕|面包|烘焙|西点';
  }

  if (/炳胜|利苑|黑珍珠|高端餐厅|私房菜|酒家/.test(keyword)) {
    return '炳胜|利苑|黑珍珠|高端餐厅|私房菜|酒家';
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
