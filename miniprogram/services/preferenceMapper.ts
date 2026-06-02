import { findQuestionOption, type PreferenceOptionEffect } from '../data/questionBank';
import type { PriceLevel, TagId } from '../types/restaurant';
import type { UserPreferenceAnswer, UserPreferenceProfile } from '../types/userPreference';

export const DEFAULT_PREFERENCE_PROFILE: UserPreferenceProfile = {
  selectedOptionIds: [],
  preferredTagIds: ['quick', 'staple'],
  avoidedTagIds: [],
  positiveTags: ['quick', 'staple'],
  negativeTags: [],
  constraints: { diningMode: 'either' },
  softPreferences: {},
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 45
};

interface MutablePreferenceProfile {
  selectedOptionIds: Set<string>;
  preferredTagIds: Set<TagId>;
  avoidedTagIds: Set<TagId>;
  constraints: Record<string, string | number | boolean | undefined>;
  softPreferences: Record<string, string | number | boolean | string[] | number[] | undefined>;
  budgetLevel: PriceLevel;
  maxDistanceMeters: number;
  maxEstimatedMinutes: number;
}

export function mapAnswersToPreferenceProfile(
  answers: UserPreferenceAnswer[] = []
): UserPreferenceProfile {
  const draft: MutablePreferenceProfile = {
    selectedOptionIds: new Set(answers.flatMap((answer) => answer.optionIds ?? [])),
    preferredTagIds: new Set(DEFAULT_PREFERENCE_PROFILE.preferredTagIds),
    avoidedTagIds: new Set(DEFAULT_PREFERENCE_PROFILE.avoidedTagIds),
    constraints: { ...DEFAULT_PREFERENCE_PROFILE.constraints },
    softPreferences: { ...DEFAULT_PREFERENCE_PROFILE.softPreferences },
    budgetLevel: DEFAULT_PREFERENCE_PROFILE.budgetLevel ?? 3,
    maxDistanceMeters: DEFAULT_PREFERENCE_PROFILE.maxDistanceMeters ?? 1500,
    maxEstimatedMinutes: DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes ?? 45
  };

  answers.forEach((answer) => {
    const option = findQuestionOption(answer.questionId, answer.optionIds, answer.value);

    if (option?.effect) {
      applyOptionEffect(draft, option.effect);
      return;
    }

    applyLegacyAnswer(draft, answer);
  });

  const preferredTagIds = [...draft.preferredTagIds];
  const avoidedTagIds = [...draft.avoidedTagIds];

  return {
    selectedOptionIds: [...draft.selectedOptionIds],
    preferredTagIds,
    avoidedTagIds,
    positiveTags: preferredTagIds,
    negativeTags: avoidedTagIds,
    constraints: {
      ...draft.constraints,
      budgetLevel: draft.budgetLevel,
      maxDistanceMeters: draft.maxDistanceMeters,
      maxEstimatedMinutes: draft.maxEstimatedMinutes
    },
    softPreferences: draft.softPreferences,
    budgetLevel: draft.budgetLevel,
    maxDistanceMeters: draft.maxDistanceMeters,
    maxEstimatedMinutes: draft.maxEstimatedMinutes
  };
}

function applyOptionEffect(
  draft: MutablePreferenceProfile,
  effect: PreferenceOptionEffect
) {
  effect.positiveTags?.forEach((tagId) => draft.preferredTagIds.add(tagId));
  effect.negativeTags?.forEach((tagId) => draft.avoidedTagIds.add(tagId));
  effect.removeNegativeTags?.forEach((tagId) => draft.avoidedTagIds.delete(tagId));

  if (effect.constraints?.budgetLevel !== undefined) {
    draft.budgetLevel = effect.constraints.budgetLevel;
  }

  if (effect.constraints?.maxDistanceMeters !== undefined) {
    draft.maxDistanceMeters = effect.constraints.maxDistanceMeters;
  }

  if (effect.constraints?.maxEstimatedMinutes !== undefined) {
    const defaultMaxEstimatedMinutes = DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes ?? 45;
    const nextMaxEstimatedMinutes = effect.constraints.maxEstimatedMinutes;

    if (
      draft.maxEstimatedMinutes === defaultMaxEstimatedMinutes ||
      nextMaxEstimatedMinutes < draft.maxEstimatedMinutes
    ) {
      draft.maxEstimatedMinutes = nextMaxEstimatedMinutes;
    }
  }

  draft.constraints = {
    ...draft.constraints,
    ...effect.constraints
  };

  if (effect.softPreferences) {
    draft.softPreferences = mergeSoftPreferences(draft.softPreferences, effect.softPreferences);
  }
}

function applyLegacyAnswer(draft: MutablePreferenceProfile, answer: UserPreferenceAnswer) {
  if (answer.questionId === 'budget') {
    draft.budgetLevel = answer.value === 'under_30' ? 2 : answer.value === 'over_60' ? 4 : 3;
  }

  if (answer.questionId === 'distance') {
    if (answer.value === 500 || answer.value === 1000) {
      draft.maxDistanceMeters = answer.value;
    } else if (answer.value === 'any') {
      draft.maxDistanceMeters = 3000;
    }
  }

  if (answer.questionId === 'flavor') {
    if (answer.value === 'strong') {
      ['spicy', 'strong_flavor', 'stir_fry'].forEach((tagId) =>
        draft.preferredTagIds.add(tagId)
      );
      draft.avoidedTagIds.delete('strong_flavor');
    } else if (answer.value === 'light') {
      ['light', 'healthy'].forEach((tagId) => draft.preferredTagIds.add(tagId));
      draft.avoidedTagIds.add('strong_flavor');
    }
  }

  if (answer.questionId === 'spice_tolerance') {
    if (answer.value === 'no_spicy') {
      [
        'spicy',
        'strong_flavor',
        'hotpot',
        'malatang',
        'sichuan',
        'hunan',
        'chongqing_noodle',
        'maocai',
        'dry_pot'
      ].forEach((tagId) => draft.avoidedTagIds.add(tagId));
      ['not_spicy', 'light', 'congee'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    } else if (answer.value === 'mild') {
      ['strong_flavor', 'hotpot', 'malatang'].forEach((tagId) => draft.avoidedTagIds.add(tagId));
    } else if (answer.value === 'spicy_ok') {
      ['spicy', 'strong_flavor'].forEach((tagId) => draft.preferredTagIds.add(tagId));
      ['spicy', 'strong_flavor'].forEach((tagId) => draft.avoidedTagIds.delete(tagId));
    }
  }

  if (answer.questionId === 'temperature') {
    if (answer.value === 'hot') {
      ['hot', 'comfort'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    } else if (answer.value === 'cold') {
      ['light', 'salad'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
  }

  if (answer.questionId === 'meal_type') {
    if (answer.value === 'meal') {
      ['staple', 'rice', 'noodle'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    } else if (answer.value === 'snack') {
      ['snack', 'quick', 'solo'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
  }

  if (answer.questionId === 'avoidance') {
    if (answer.value === 'avoid_spicy') {
      [
        'spicy',
        'strong_flavor',
        'hotpot',
        'malatang',
        'sichuan',
        'hunan',
        'chongqing_noodle',
        'maocai',
        'dry_pot'
      ].forEach((tagId) => draft.avoidedTagIds.add(tagId));
      ['not_spicy', 'light'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    } else if (answer.value === 'avoid_greasy') {
      ['bbq', 'fried', 'heavy', 'strong_flavor', 'burger'].forEach((tagId) =>
        draft.avoidedTagIds.add(tagId)
      );
      ['healthy', 'light', 'low_burden', 'fresh'].forEach((tagId) =>
        draft.preferredTagIds.add(tagId)
      );
    }
  }

  if (answer.questionId === 'health' && answer.value === 'light_burden') {
    ['healthy', 'low_burden', 'light', 'fresh', 'salad'].forEach((tagId) =>
      draft.preferredTagIds.add(tagId)
    );
    ['strong_flavor', 'spicy', 'bbq', 'fried', 'heavy'].forEach((tagId) =>
      draft.avoidedTagIds.add(tagId)
    );
  }

  if (answer.questionId === 'satiety') {
    if (answer.value === 'filling') {
      ['staple', 'rice', 'noodle', 'meal', 'set_meal'].forEach((tagId) =>
        draft.preferredTagIds.add(tagId)
      );
    } else if (answer.value === 'light') {
      ['snack', 'light', 'solo'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
  }
}

function mergeSoftPreferences(
  current: MutablePreferenceProfile['softPreferences'],
  next: MutablePreferenceProfile['softPreferences']
) {
  const merged = { ...current };

  Object.entries(next).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      const currentValues = Array.isArray(merged[key]) ? merged[key] : [];

      if (value.every((item) => typeof item === 'number')) {
        const numberValues = currentValues.filter((item): item is number => typeof item === 'number');
        merged[key] = [...new Set([...numberValues, ...value])] as number[];
        return;
      }

      const stringValues = currentValues.filter((item): item is string => typeof item === 'string');
      merged[key] = [...new Set([...stringValues, ...value.map(String)])] as string[];
      return;
    }

    merged[key] = value;
  });

  return merged;
}
