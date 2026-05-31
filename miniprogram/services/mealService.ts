import { cloudConfig } from '../config/cloud';
import type { MealCandidate } from '../models/meal';
import type { ApiResponse, RecommendMealResponse } from '../types/recommendation';
import type { UserQuestionnaireResult } from '../types/userPreference';

export async function getTodayRecommendation(): Promise<MealCandidate> {
  const [candidate] = await getCloudRecommendations(undefined, 1);

  if (!candidate) {
    throw new Error('No recommendation candidates available.');
  }

  return candidate;
}

export async function getLocalRecommendations(
  questionnaire?: UserQuestionnaireResult
): Promise<MealCandidate[]> {
  return getCloudRecommendations(questionnaire, 4);
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
