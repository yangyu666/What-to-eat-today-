import { questionBank, type QuestionBankItem } from '../data/questionBank';
import type { PreferenceDimension } from '../types/userPreference';

export interface SelectQuestionsOptions {
  count?: number;
  random?: () => number;
}

const DEFAULT_QUESTION_COUNT = 6;
const EXCLUDED_DIMENSIONS: PreferenceDimension[] = ['dining_mode'];
const QUESTION_FLOWS = [
  ['meal_intent', 'dietary_restriction', 'distance', 'budget', 'time_slot', 'category_avoidance'],
  ['category_preference', 'budget', 'distance', 'dietary_restriction', 'temperature', 'speed'],
  ['meal_intent', 'category_avoidance', 'time_slot', 'distance', 'budget', 'mood'],
  ['meal_intent', 'spice_tolerance', 'dietary_restriction', 'budget', 'category_preference', 'distance'],
  ['meal_intent', 'flavor', 'time_slot', 'budget', 'distance', 'speed'],
  ['meal_intent', 'category_preference', 'dietary_restriction', 'distance', 'budget', 'scene']
];

const CONFLICTING_QUESTION_GROUPS = [
  ['avoidance', 'spice_tolerance'],
  ['satiety', 'meal_type', 'meal_intent'],
  ['avoidance', 'flavor', 'health']
];

export function selectQuestionSet(options: SelectQuestionsOptions = {}): QuestionBankItem[] {
  const count = options.count ?? DEFAULT_QUESTION_COUNT;
  const random = options.random ?? Math.random;
  const selectableQuestions = questionBank.filter((question) => {
    return !EXCLUDED_DIMENSIONS.includes(question.dimension);
  });
  const flow = QUESTION_FLOWS[Math.floor(random() * QUESTION_FLOWS.length)] ?? QUESTION_FLOWS[0];
  const selected = flow
    .map((id) => selectableQuestions.find((question) => question.id === id))
    .filter(isQuestion)
    .slice(0, count);

  if (selected.length < count) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const fallbackPool = selectableQuestions.filter((question) => {
      return !selectedIds.has(question.id) && !conflictsWithSelected(question.id, selectedIds);
    });
    selected.push(...shuffle(fallbackPool, random).slice(0, count - selected.length));
  }

  return selected;
}

function conflictsWithSelected(questionId: string, selectedIds: Set<string>): boolean {
  return CONFLICTING_QUESTION_GROUPS.some((group) => {
    return group.includes(questionId) && group.some((id) => selectedIds.has(id));
  });
}

function isQuestion(question: QuestionBankItem | undefined): question is QuestionBankItem {
  return question !== undefined;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
