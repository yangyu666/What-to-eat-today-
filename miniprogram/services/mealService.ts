import { cloudConfig } from '../config/cloud';
import { mockRestaurants } from '../data/mockRestaurants';
import type { MealCandidate } from '../models/meal';
import type { ApiResponse, RecommendMealResponse } from '../types/recommendation';
import type { UserQuestionnaireResult } from '../types/userPreference';
import { buildAmapRestaurantQuery } from './amapQueryBuilder';
import { getNearbyRestaurants } from './amapPoiService';
import { mapAnswersToPreferenceProfile } from './preferenceMapper';
import { recommendRestaurants } from './recommendationEngine';

let cloudInitialized = false;

export async function getTodayRecommendation(): Promise<MealCandidate> {
  const [candidate] = await getRecommendations(undefined, 1);

  if (!candidate) {
    throw new Error('No recommendation candidates available.');
  }

  return candidate;
}

export async function getLocalRecommendations(
  questionnaire?: UserQuestionnaireResult
): Promise<MealCandidate[]> {
  return getRecommendations(questionnaire, 4);
}

async function getRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): Promise<MealCandidate[]> {
  const poiCandidates = await getAmapRecommendations(questionnaire, limit);

  if (poiCandidates.length > 0) {
    return poiCandidates;
  }

  try {
    const cloudCandidates = await getCloudRecommendations(questionnaire, limit);

    if (cloudCandidates.length > 0) {
      return cloudCandidates;
    }
  } catch (error) {
    console.warn('Fallback to local mock recommendation after cloud recommendation failed.', error);
  }

  const mockCandidates = getMockRecommendations(questionnaire, limit);

  if (mockCandidates.length === 0) {
    throw new Error('No recommendation candidates available after all fallbacks.');
  }

  return mockCandidates;
}

async function getAmapRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): Promise<MealCandidate[]> {
  const preferenceSnapshot = mapAnswersToPreferenceProfile(questionnaire?.answers ?? []);
  const amapQuery = buildAmapRestaurantQuery(preferenceSnapshot);

  try {
    const restaurants = await getNearbyRestaurants({
      radiusMeters: amapQuery.radiusMeters,
      keyword: amapQuery.keywords,
      types: amapQuery.types,
      pageSize: 25
    });

    if (restaurants.length === 0) {
      return [];
    }

    const result = recommendRestaurants({
      restaurants,
      context: {
        preferenceSnapshot
      },
      limit,
      source: 'amap'
    });

    return result.candidates;
  } catch (error) {
    console.warn('Fallback after nearby AMap POI recommendation failed.', error);
    return [];
  }
}

async function getCloudRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): Promise<MealCandidate[]> {
  ensureCloudInitialized();

  const response = await wx.cloud.callFunction({
    name: cloudConfig.recommendRestaurantFunctionName,
    data: {
      questionnaire,
      context: {
        preferenceSnapshot: mapAnswersToPreferenceProfile(questionnaire?.answers ?? [])
      },
      limit
    }
  });
  const payload = response.result as ApiResponse<RecommendMealResponse> | undefined;

  if (!payload?.ok) {
    const message = payload?.ok === false ? payload.error.message : 'Cloud recommendation failed.';
    throw new Error(message);
  }

  return payload.data.recommendation.candidates.map((candidate) => ({
    ...candidate,
    source: candidate.source ?? payload.data.recommendation.source ?? 'cloud'
  }));
}

function ensureCloudInitialized() {
  if (!wx.cloud) {
    throw new Error('Current base library does not support cloud development.');
  }

  if (cloudInitialized) {
    return;
  }

  wx.cloud.init({
    env: cloudConfig.envId || undefined,
    traceUser: true
  });
  cloudInitialized = true;
}

function getMockRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): MealCandidate[] {
  const result = recommendRestaurants({
    restaurants: mockRestaurants,
    context: {
      preferenceSnapshot: mapAnswersToPreferenceProfile(questionnaire?.answers ?? [])
    },
    limit,
    random: () => 0,
    source: 'mock'
  });

  return result.candidates;
}
