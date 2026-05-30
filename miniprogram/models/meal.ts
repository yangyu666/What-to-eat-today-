export interface MealCandidate {
  id: string;
  name: string;
  tags: string[];
  reason: string;
  estimatedMinutes: number;
}

export interface PreferenceOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface MealHistoryItem {
  id: string;
  mealName: string;
  dateText: string;
  note?: string;
}
