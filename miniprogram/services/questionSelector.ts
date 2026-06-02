import { questionBank, type QuestionBankItem } from '../data/questionBank';
import type { PreferenceDimension } from '../types/userPreference';

export interface SelectQuestionsOptions {
  count?: number;
  random?: () => number;
}

const DEFAULT_QUESTION_COUNT = 6;
const BASE_DIMENSIONS: PreferenceDimension[] = ['distance', 'budget', 'dining_mode'];

export function selectQuestionSet(options: SelectQuestionsOptions = {}): QuestionBankItem[] {
  const count = options.count ?? DEFAULT_QUESTION_COUNT;
  const random = options.random ?? Math.random;
  const baseQuestions = BASE_DIMENSIONS.map((dimension) => {
    return questionBank.find((question) => question.dimension === dimension);
  }).filter((question): question is QuestionBankItem => question !== undefined);

  const requiredBaseCount = Math.min(2, baseQuestions.length, count);
  const selected = shuffle(baseQuestions, random).slice(0, requiredBaseCount);
  const selectedIds = new Set(selected.map((question) => question.id));
  const flexiblePool = questionBank.filter((question) => !selectedIds.has(question.id));

  selected.push(...shuffle(flexiblePool, random).slice(0, Math.max(0, count - selected.length)));

  return shuffle(selected, random).slice(0, count);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
