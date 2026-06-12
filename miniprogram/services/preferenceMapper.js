"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PREFERENCE_PROFILE = void 0;
exports.mapAnswersToPreferenceProfile = mapAnswersToPreferenceProfile;
const questionBank_1 = require("../data/questionBank");
exports.DEFAULT_PREFERENCE_PROFILE = {
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
function mapAnswersToPreferenceProfile(answers = []) {
    const draft = {
        selectedOptionIds: new Set(answers.flatMap((answer) => answer.optionIds ?? [])),
        preferredTagIds: new Set(exports.DEFAULT_PREFERENCE_PROFILE.preferredTagIds),
        avoidedTagIds: new Set(exports.DEFAULT_PREFERENCE_PROFILE.avoidedTagIds),
        constraints: { ...exports.DEFAULT_PREFERENCE_PROFILE.constraints },
        softPreferences: { ...exports.DEFAULT_PREFERENCE_PROFILE.softPreferences },
        budgetLevel: exports.DEFAULT_PREFERENCE_PROFILE.budgetLevel ?? 3,
        maxDistanceMeters: exports.DEFAULT_PREFERENCE_PROFILE.maxDistanceMeters ?? 1500,
        maxEstimatedMinutes: exports.DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes ?? 45
    };
    answers.forEach((answer) => {
        const option = (0, questionBank_1.findQuestionOption)(answer.questionId, answer.optionIds, answer.value);
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
function applyOptionEffect(draft, effect) {
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
        const defaultMaxEstimatedMinutes = exports.DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes ?? 45;
        const nextMaxEstimatedMinutes = effect.constraints.maxEstimatedMinutes;
        if (draft.maxEstimatedMinutes === defaultMaxEstimatedMinutes ||
            nextMaxEstimatedMinutes < draft.maxEstimatedMinutes) {
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
function applyLegacyAnswer(draft, answer) {
    if (answer.questionId === 'budget') {
        draft.budgetLevel =
            answer.value === 'under_30'
                ? 2
                : answer.value === '60_100' || answer.value === 'over_60'
                    ? 4
                    : answer.value === '100_200'
                        ? 5
                        : answer.value === 'over_200'
                            ? 6
                            : 3;
    }
    if (answer.questionId === 'distance') {
        if (answer.value === 500 || answer.value === 1000) {
            draft.maxDistanceMeters = answer.value;
        }
        else if (answer.value === 'any') {
            draft.maxDistanceMeters = 10000;
            draft.maxEstimatedMinutes = 120;
        }
    }
    if (answer.questionId === 'flavor') {
        if (answer.value === 'strong') {
            ['spicy', 'strong_flavor', 'stir_fry'].forEach((tagId) => draft.preferredTagIds.add(tagId));
            draft.avoidedTagIds.delete('strong_flavor');
        }
        else if (answer.value === 'light') {
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
        }
        else if (answer.value === 'mild') {
            ['strong_flavor', 'hotpot', 'malatang'].forEach((tagId) => draft.avoidedTagIds.add(tagId));
        }
        else if (answer.value === 'spicy_ok') {
            ['spicy', 'strong_flavor'].forEach((tagId) => draft.preferredTagIds.add(tagId));
            ['spicy', 'strong_flavor'].forEach((tagId) => draft.avoidedTagIds.delete(tagId));
        }
    }
    if (answer.questionId === 'temperature') {
        if (answer.value === 'hot') {
            ['hot', 'comfort'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
        else if (answer.value === 'cold') {
            ['light', 'salad'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
    }
    if (answer.questionId === 'meal_type') {
        if (answer.value === 'meal') {
            ['staple', 'rice', 'noodle'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
        else if (answer.value === 'snack') {
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
        }
        else if (answer.value === 'avoid_greasy') {
            ['bbq', 'fried', 'heavy', 'strong_flavor', 'burger'].forEach((tagId) => draft.avoidedTagIds.add(tagId));
            ['healthy', 'light', 'low_burden', 'fresh'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
    }
    if (answer.questionId === 'health' && answer.value === 'light_burden') {
        ['healthy', 'low_burden', 'light', 'fresh', 'salad'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        ['strong_flavor', 'spicy', 'bbq', 'fried', 'heavy'].forEach((tagId) => draft.avoidedTagIds.add(tagId));
    }
    if (answer.questionId === 'satiety') {
        if (answer.value === 'filling') {
            ['staple', 'rice', 'noodle', 'meal', 'set_meal'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
        else if (answer.value === 'light') {
            ['snack', 'light', 'solo'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
    }
}
function mergeSoftPreferences(current, next) {
    const merged = { ...current };
    Object.entries(next).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }
        if (Array.isArray(value)) {
            const currentValues = Array.isArray(merged[key]) ? merged[key] : [];
            if (value.every((item) => typeof item === 'number')) {
                const numberValues = currentValues.filter((item) => typeof item === 'number');
                merged[key] = [...new Set([...numberValues, ...value])];
                return;
            }
            const stringValues = currentValues.filter((item) => typeof item === 'string');
            merged[key] = [...new Set([...stringValues, ...value.map(String)])];
            return;
        }
        merged[key] = value;
    });
    return merged;
}
