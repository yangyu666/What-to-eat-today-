import { mockRestaurants } from '../data/mockRestaurants';
import type { MealCandidate } from '../models/meal';
import type { UserPreferenceAnswer, UserPreferenceProfile, UserQuestionnaireResult } from '../types/userPreference';
import { recommendRestaurants } from './recommendationEngine';

const DEFAULT_PREFERENCE: UserPreferenceProfile = {
  selectedOptionIds: ['quick', 'light'],
  preferredTagIds: ['quick', 'hot', 'light', 'comfort'],
  avoidedTagIds: ['strong_flavor'],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 40
};

export async function getTodayRecommendation(): Promise<MealCandidate> {
  const result = recommendRestaurants({
    restaurants: mockRestaurants,
    context: {
      preferenceSnapshot: DEFAULT_PREFERENCE
    },
    limit: 1
  });

  const [candidate] = result.candidates;

  if (!candidate) {
    throw new Error('No recommendation candidates available.');
  }

  return candidate;
}

export async function getLocalRecommendations(
  questionnaire?: UserQuestionnaireResult
): Promise<MealCandidate[]> {
  const result = recommendRestaurants({
    restaurants: mockRestaurants,
    context: {
      preferenceSnapshot: questionnaire
        ? buildPreferenceProfile(questionnaire.answers)
        : DEFAULT_PREFERENCE
    },
    limit: 4,
    random: () => 0
  });

  return result.candidates;
}

function buildPreferenceProfile(answers: UserPreferenceAnswer[]): UserPreferenceProfile {
  const selectedOptionIds = answers.flatMap((answer) => answer.optionIds ?? []);
  const preferredTagIds = new Set(DEFAULT_PREFERENCE.preferredTagIds);
  const avoidedTagIds = new Set(DEFAULT_PREFERENCE.avoidedTagIds);
  let budgetLevel = DEFAULT_PREFERENCE.budgetLevel;
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;
  let peopleCount = DEFAULT_PREFERENCE.peopleCount;

  answers.forEach((answer) => {
    if (answer.questionId === 'flavor') {
      if (answer.value === 'spicy') {
        preferredTagIds.add('spicy');
        preferredTagIds.add('strong_flavor');
        avoidedTagIds.delete('strong_flavor');
      }

      if (answer.value === 'light') {
        preferredTagIds.add('light');
        preferredTagIds.add('healthy');
        avoidedTagIds.add('strong_flavor');
      }
    }

    if (answer.questionId === 'staple' && typeof answer.value === 'string') {
      preferredTagIds.add(answer.value);
    }

    if (answer.questionId === 'speed' && typeof answer.value === 'number') {
      maxEstimatedMinutes = answer.value;
      preferredTagIds.add('quick');
    }

    if (answer.questionId === 'budget') {
      budgetLevel = answer.value === 'low' ? 2 : answer.value === 'high' ? 4 : 3;
    }

    if (answer.questionId === 'people' && typeof answer.value === 'number') {
      peopleCount = answer.value;
      if (answer.value >= 3) {
        preferredTagIds.add('group');
      } else {
        preferredTagIds.add('solo');
      }
    }

    if (answer.questionId === 'scene' && typeof answer.value === 'string') {
      const sceneTagMap: Record<string, string[]> = {
        fast: ['quick'],
        comfort: ['comfort', 'relaxed'],
        healthy: ['healthy', 'light', 'low_burden']
      };

      sceneTagMap[answer.value]?.forEach((tagId) => preferredTagIds.add(tagId));
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters: DEFAULT_PREFERENCE.maxDistanceMeters,
    maxEstimatedMinutes,
    peopleCount
  };
}
