import { questionBank, type QuestionBankItem } from '../data/questionBank';
import type { PreferenceDimension } from '../types/userPreference';

export interface SelectQuestionsOptions {
  count?: number;
  random?: () => number;
}

const DEFAULT_QUESTION_COUNT = 6;
const EXCLUDED_DIMENSIONS: PreferenceDimension[] = ['dining_mode'];
const QUESTION_FLOWS = [
  ['avoidance', 'distance', 'flavor', 'budget', 'satiety', 'mood'],
  ['spice_tolerance', 'budget', 'health', 'distance', 'meal_type', 'speed'],
  ['avoidance', 'health', 'distance', 'budget', 'temperature', 'scene'],
  ['spice_tolerance', 'distance', 'budget', 'flavor', 'meal_type', 'mood'],
  ['avoidance', 'budget', 'satiety', 'distance', 'temperature', 'speed']
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
