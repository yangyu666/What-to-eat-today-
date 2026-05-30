import type { IsoDateString, PriceLevel, TagId } from './restaurant';

export type UserId = string;
export type QuestionId = string;
export type PreferenceOptionId = string;
export type PreferenceQuestionType = 'single' | 'multiple' | 'range' | 'boolean' | 'text';
export type PreferenceAnswerValue = string | string[] | number | boolean | null;
export type PreferenceSource = 'onboarding' | 'settings' | 'recommendation_filter';

export interface PreferenceOption {
  id: PreferenceOptionId;
  label: string;
  selected: boolean;
  tagId?: TagId;
  value?: string | number | boolean;
}

export interface PreferenceQuestion {
  id: QuestionId;
  title: string;
  type: PreferenceQuestionType;
  options?: PreferenceOption[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface UserPreferenceAnswer {
  questionId: QuestionId;
  type: PreferenceQuestionType;
  value: PreferenceAnswerValue;
  optionIds?: PreferenceOptionId[];
  answeredAt: IsoDateString;
}

export interface UserQuestionnaireResult {
  id?: string;
  userId?: UserId;
  version: string;
  source: PreferenceSource;
  answers: UserPreferenceAnswer[];
  submittedAt: IsoDateString;
}

export interface UserPreferenceProfile {
  userId?: UserId;
  selectedOptionIds: PreferenceOptionId[];
  preferredTagIds: TagId[];
  avoidedTagIds: TagId[];
  budgetLevel?: PriceLevel;
  maxDistanceMeters?: number;
  maxEstimatedMinutes?: number;
  peopleCount?: number;
  lastQuestionnaireResultId?: string;
  updatedAt?: IsoDateString;
}

export interface UserPreferenceDocument extends UserPreferenceProfile {
  _id: string;
  _openid?: string;
  questionnaire: UserQuestionnaireResult;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface SavePreferenceRequest {
  questionnaire: UserQuestionnaireResult;
  profile: UserPreferenceProfile;
}

export interface SavePreferenceResponse {
  preference: UserPreferenceDocument;
}

export const USER_PREFERENCE_COLLECTION = 'user_preferences' as const;
