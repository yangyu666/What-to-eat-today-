import { mockMeals } from '../data/mockMeals';
import type { MealCandidate } from '../models/meal';
import { pickRandom } from '../utils/random';

export async function getTodayRecommendation(): Promise<MealCandidate> {
  return pickRandom(mockMeals);
}
