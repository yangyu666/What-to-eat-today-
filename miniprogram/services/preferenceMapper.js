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
    var _a, _b, _c;
    const draft = {
        selectedOptionIds: new Set(answers.flatMap((answer) => { var _a; return (_a = answer.optionIds) !== null && _a !== void 0 ? _a : []; })),
        preferredTagIds: new Set(exports.DEFAULT_PREFERENCE_PROFILE.preferredTagIds),
        avoidedTagIds: new Set(exports.DEFAULT_PREFERENCE_PROFILE.avoidedTagIds),
        constraints: { ...exports.DEFAULT_PREFERENCE_PROFILE.constraints },
        softPreferences: { ...exports.DEFAULT_PREFERENCE_PROFILE.softPreferences },
        budgetLevel: (_a = exports.DEFAULT_PREFERENCE_PROFILE.budgetLevel) !== null && _a !== void 0 ? _a : 3,
        maxDistanceMeters: (_b = exports.DEFAULT_PREFERENCE_PROFILE.maxDistanceMeters) !== null && _b !== void 0 ? _b : 1500,
        maxEstimatedMinutes: (_c = exports.DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes) !== null && _c !== void 0 ? _c : 45
    };
    answers.forEach((answer) => {
        const option = (0, questionBank_1.findQuestionOption)(answer.questionId, answer.optionIds, answer.value);
        if (option === null || option === void 0 ? void 0 : option.effect) {
            applyOptionEffect(draft, option.effect);
            return;
        }
        applyLegacyAnswer(draft, answer);
    });
    applyDefensivePreferenceInferences(draft);
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
function applyDefensivePreferenceInferences(draft) {
    const nonMealOptionIds = new Set([
        'intent_drink',
        'intent_dessert',
        'prefer_milk_tea',
        'prefer_coffee',
        'prefer_bakery_dessert',
        'time_afternoon_tea'
    ]);
    const hasNonMealSignal = [...nonMealOptionIds].some((optionId) => draft.selectedOptionIds.has(optionId));
    const isLuxuryBudget = draft.budgetLevel >= 6 || draft.selectedOptionIds.has('budget_over_200');
    if (isLuxuryBudget && !hasNonMealSignal) {
        ['quick', 'staple', 'rice', 'noodle', 'set_meal', 'solo'].forEach((tagId) => {
            draft.preferredTagIds.delete(tagId);
        });
        ['meal', 'premium_brand', 'fine_dining', 'hotel_restaurant', 'omakase', 'chef', 'steak', 'relaxed'].forEach((tagId) => {
            draft.preferredTagIds.add(tagId);
        });
        draft.softPreferences = mergeSoftPreferences(draft.softPreferences, {
            mealWeight: 'filling',
            budgetStrictness: 'high'
        });
        if (draft.selectedOptionIds.has('speed_fast')) {
            ['fast_service', 'low_queue'].forEach((tagId) => draft.preferredTagIds.add(tagId));
        }
    }
    if (!hasNonMealSignal) {
        return;
    }
    ['staple', 'rice', 'noodle', 'meal', 'set_meal'].forEach((tagId) => {
        draft.preferredTagIds.delete(tagId);
    });
    ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'].forEach((tagId) => {
        draft.avoidedTagIds.add(tagId);
    });
    draft.preferredTagIds.add('non_meal');
    draft.softPreferences = mergeSoftPreferences(draft.softPreferences, { mealWeight: 'light' });
    if (draft.selectedOptionIds.has('prefer_milk_tea') || draft.selectedOptionIds.has('intent_drink')) {
        ['drink', 'milk_tea', 'afternoon_tea'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
    if (draft.selectedOptionIds.has('prefer_coffee')) {
        ['drink', 'coffee', 'afternoon_tea'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
    if (draft.selectedOptionIds.has('prefer_bakery_dessert') || draft.selectedOptionIds.has('intent_dessert')) {
        ['dessert', 'afternoon_tea'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
    if (draft.selectedOptionIds.has('time_afternoon_tea')) {
        ['afternoon_tea', 'dessert', 'coffee', 'drink'].forEach((tagId) => draft.preferredTagIds.add(tagId));
    }
}
function applyOptionEffect(draft, effect) {
    var _a, _b, _c, _d, _e, _f, _g;
    (_a = effect.positiveTags) === null || _a === void 0 ? void 0 : _a.forEach((tagId) => draft.preferredTagIds.add(tagId));
    (_b = effect.negativeTags) === null || _b === void 0 ? void 0 : _b.forEach((tagId) => draft.avoidedTagIds.add(tagId));
    (_c = effect.removeNegativeTags) === null || _c === void 0 ? void 0 : _c.forEach((tagId) => draft.avoidedTagIds.delete(tagId));
    if (((_d = effect.constraints) === null || _d === void 0 ? void 0 : _d.budgetLevel) !== undefined) {
        draft.budgetLevel = effect.constraints.budgetLevel;
    }
    if (((_e = effect.constraints) === null || _e === void 0 ? void 0 : _e.maxDistanceMeters) !== undefined) {
        draft.maxDistanceMeters = effect.constraints.maxDistanceMeters;
    }
    if (((_f = effect.constraints) === null || _f === void 0 ? void 0 : _f.maxEstimatedMinutes) !== undefined) {
        const defaultMaxEstimatedMinutes = (_g = exports.DEFAULT_PREFERENCE_PROFILE.maxEstimatedMinutes) !== null && _g !== void 0 ? _g : 45;
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
