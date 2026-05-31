import { cloudConfig } from '../config/cloud';
import { mockRestaurants } from '../data/mockRestaurants';
import type { MealCandidate } from '../models/meal';
import type { ApiResponse, RecommendMealResponse } from '../types/recommendation';
import type {
  UserPreferenceAnswer,
  UserPreferenceProfile,
  UserQuestionnaireResult
} from '../types/userPreference';
import { getNearbyRestaurants } from './amapPoiService';
import { recommendRestaurants } from './recommendationEngine';

const DEFAULT_PREFERENCE: UserPreferenceProfile = {
  selectedOptionIds: [],
  preferredTagIds: ['quick', 'staple'],
  avoidedTagIds: [],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 45
};

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

  return getMockRecommendations(questionnaire, limit);
}

async function getAmapRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): Promise<MealCandidate[]> {
  const preferenceSnapshot = buildPreferenceProfile(questionnaire?.answers ?? []);

  try {
    const restaurants = await getNearbyRestaurants({
      radiusMeters: preferenceSnapshot.maxDistanceMeters,
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
  if (!wx.cloud) {
    throw new Error('Current base library does not support cloud development.');
  }

  const response = await wx.cloud.callFunction({
    name: cloudConfig.recommendRestaurantFunctionName,
    data: {
      questionnaire,
      limit
    }
  });
  const payload = response.result as ApiResponse<RecommendMealResponse> | undefined;

  if (!payload?.ok) {
    const message = payload?.ok === false ? payload.error.message : 'Cloud recommendation failed.';
    throw new Error(message);
  }

  return payload.data.recommendation.candidates;
}

function getMockRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number
): MealCandidate[] {
  const result = recommendRestaurants({
    restaurants: mockRestaurants,
    context: {
      preferenceSnapshot: buildPreferenceProfile(questionnaire?.answers ?? [])
    },
    limit,
    random: () => 0,
    source: 'mock'
  });

  return result.candidates;
}

function buildPreferenceProfile(answers: UserPreferenceAnswer[]): UserPreferenceProfile {
  const selectedOptionIds = answers.flatMap((answer) => answer.optionIds ?? []);
  const preferredTagIds = new Set(DEFAULT_PREFERENCE.preferredTagIds);
  const avoidedTagIds = new Set(DEFAULT_PREFERENCE.avoidedTagIds);
  let budgetLevel = DEFAULT_PREFERENCE.budgetLevel;
  let maxDistanceMeters = DEFAULT_PREFERENCE.maxDistanceMeters;
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;

  answers.forEach((answer) => {
    if (answer.questionId === 'dining_mode') {
      if (answer.value === 'dine_in') {
        maxEstimatedMinutes = 45;
      }

      if (answer.value === 'delivery') {
        maxEstimatedMinutes = 60;
        preferredTagIds.add('quick');
      }
    }

    if (answer.questionId === 'budget') {
      if (answer.value === 'under_30') {
        budgetLevel = 2;
      } else if (answer.value === 'over_60') {
        budgetLevel = 4;
      } else {
        budgetLevel = 3;
      }
    }

    if (answer.questionId === 'distance') {
      if (answer.value === 500 || answer.value === 1000) {
        maxDistanceMeters = answer.value;
      }

      if (answer.value === 'any') {
        maxDistanceMeters = 3000;
      }
    }

    if (answer.questionId === 'flavor') {
      if (answer.value === 'strong') {
        preferredTagIds.add('spicy');
        preferredTagIds.add('strong_flavor');
        preferredTagIds.add('stir_fry');
        avoidedTagIds.delete('strong_flavor');
      }

      if (answer.value === 'light') {
        preferredTagIds.add('light');
        preferredTagIds.add('healthy');
        avoidedTagIds.add('strong_flavor');
      }
    }

    if (answer.questionId === 'temperature') {
      if (answer.value === 'hot') {
        preferredTagIds.add('hot');
        preferredTagIds.add('comfort');
      }

      if (answer.value === 'cold') {
        preferredTagIds.add('light');
        preferredTagIds.add('salad');
      }
    }

    if (answer.questionId === 'meal_type') {
      if (answer.value === 'meal') {
        preferredTagIds.add('staple');
        preferredTagIds.add('rice');
        preferredTagIds.add('noodle');
      }

      if (answer.value === 'snack') {
        preferredTagIds.add('snack');
        preferredTagIds.add('quick');
        preferredTagIds.add('solo');
      }
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters,
    maxEstimatedMinutes
  };
}
