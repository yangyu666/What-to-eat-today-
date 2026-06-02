import { questionBank, type QuestionBankItem } from '../data/questionBank';
import type { PreferenceDimension } from '../types/userPreference';

export interface SelectQuestionsOptions {
  count?: number;
  random?: () => number;
}

const DEFAULT_QUESTION_COUNT = 6;
const EXCLUDED_DIMENSIONS: PreferenceDimension[] = ['dining_mode'];
const QUESTION_FLOWS = [
  ['avoidance', 'distance', 'budget', 'meal_intent', 'dietary_restriction', 'time_slot'],
  ['category_preference', 'budget', 'distance', 'dietary_restriction', 'temperature', 'speed'],
  ['meal_intent', 'category_avoidance', 'health', 'distance', 'budget', 'time_slot'],
  ['spice_tolerance', 'dietary_restriction', 'budget', 'meal_type', 'category_preference', 'distance'],
  ['avoidance', 'time_slot', 'budget', 'satiety', 'category_avoidance', 'speed'],
  ['meal_intent', 'flavor', 'dietary_restriction', 'distance', 'budget', 'mood']
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
    const fallbackPool = selectableQuestions.filter((question) => !selectedIds.has(question.id));
    selected.push(...shuffle(fallbackPool, random).slice(0, count - selected.length));
  }

  return selected;
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
