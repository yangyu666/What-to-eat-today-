"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectQuestionSet = selectQuestionSet;
const questionBank_1 = require("../data/questionBank");
const DEFAULT_QUESTION_COUNT = 6;
const EXCLUDED_DIMENSIONS = ['dining_mode'];
const QUESTION_FLOWS = [
    ['meal_intent', 'budget', 'distance', 'brand_preference', 'time_slot', 'speed'],
    ['meal_intent', 'budget', 'distance', 'brand_preference', 'category_preference', 'speed'],
    ['meal_intent', 'budget', 'distance', 'brand_preference', 'spice_tolerance', 'flavor'],
    ['meal_intent', 'budget', 'distance', 'brand_preference', 'health', 'speed'],
    ['meal_intent', 'budget', 'distance', 'brand_preference', 'flavor', 'time_slot']
];
const CONFLICTING_QUESTION_GROUPS = [
    ['avoidance', 'spice_tolerance'],
    ['satiety', 'meal_type', 'meal_intent'],
    ['avoidance', 'flavor', 'health']
];
const NON_MEAL_OPTION_IDS = new Set([
    'intent_drink',
    'intent_dessert',
    'prefer_milk_tea',
    'prefer_coffee',
    'prefer_bakery_dessert',
    'time_afternoon_tea'
]);
const MEAL_OPTION_IDS = new Set([
    'intent_meal',
    'time_lunch',
    'time_dinner'
]);
const MEAL_ONLY_QUESTION_IDS = new Set(['category_preference']);
function selectQuestionSet(options = {}) {
    const count = options.count ?? DEFAULT_QUESTION_COUNT;
    const random = options.random ?? Math.random;
    const selectedOptionIds = new Set(options.answers?.flatMap((answer) => answer.optionIds ?? []) ?? []);
    const selectableQuestions = questionBank_1.questionBank.filter((question) => {
        return !EXCLUDED_DIMENSIONS.includes(question.dimension);
    }).map((question) => filterQuestionByAnswers(question, selectedOptionIds)).filter(isQuestion);
    const flow = QUESTION_FLOWS[Math.floor(random() * QUESTION_FLOWS.length)] ?? QUESTION_FLOWS[0];
    const answeredQuestionIds = options.answers?.map((answer) => answer.questionId) ?? [];
    const selected = answeredQuestionIds
        .map((id) => selectableQuestions.find((question) => question.id === id))
        .filter(isQuestion)
        .slice(0, count);
    const selectedIds = new Set(selected.map((question) => question.id));
    const previousQuestions = options.previousQuestions ?? [];
    previousQuestions.forEach((question) => {
        const nextQuestion = selectableQuestions.find((item) => item.id === question.id);
        if (nextQuestion &&
            selected.length < count &&
            !selectedIds.has(nextQuestion.id) &&
            !conflictsWithSelected(nextQuestion.id, selectedIds)) {
            selected.push(nextQuestion);
            selectedIds.add(nextQuestion.id);
        }
    });
    const flowSelected = flow
        .map((id) => selectableQuestions.find((question) => question.id === id))
        .filter(isQuestion)
        .filter((question) => !selectedIds.has(question.id) && !conflictsWithSelected(question.id, selectedIds));
    flowSelected.slice(0, count - selected.length).forEach((question) => {
        selected.push(question);
        selectedIds.add(question.id);
    });
    if (selected.length < count) {
        const fallbackPool = selectableQuestions.filter((question) => {
            return !selectedIds.has(question.id) && !conflictsWithSelected(question.id, selectedIds);
        });
        selected.push(...shuffle(fallbackPool, random).slice(0, count - selected.length));
    }
    return selected;
}
function filterQuestionByAnswers(question, selectedOptionIds) {
    const wantsMeal = [...selectedOptionIds].some((id) => MEAL_OPTION_IDS.has(id));
    const wantsNonMeal = [...selectedOptionIds].some((id) => NON_MEAL_OPTION_IDS.has(id));
    if (wantsMeal && MEAL_ONLY_QUESTION_IDS.has(question.id)) {
        return undefined;
    }
    const options = question.options.filter((option) => {
        if (wantsMeal && NON_MEAL_OPTION_IDS.has(option.id)) {
            return false;
        }
        if (wantsNonMeal && MEAL_OPTION_IDS.has(option.id)) {
            return false;
        }
        return true;
    });
    if (options.length === 0) {
        return undefined;
    }
    return {
        ...question,
        options
    };
}
function conflictsWithSelected(questionId, selectedIds) {
    return CONFLICTING_QUESTION_GROUPS.some((group) => {
        return group.includes(questionId) && group.some((id) => selectedIds.has(id));
    });
}
function isQuestion(question) {
    return question !== undefined;
}
function shuffle(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}
