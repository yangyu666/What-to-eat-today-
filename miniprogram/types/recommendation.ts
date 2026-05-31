import type {
  GeoPoint,
  IsoDateString,
  RestaurantId,
  RestaurantSummary,
  TagId
} from './restaurant';
import type { UserPreferenceAnswer, UserPreferenceProfile } from './userPreference';

export type RecommendationId = string;
export type RecommendationCandidateId = string;
export type RecommendationSource = 'mock' | 'cloud' | 'rule' | 'manual' | 'amap';
export type RecommendationAction = 'shown' | 'accepted' | 'skipped' | 'dismissed';
export type RecommendationConfidenceLabel = 'low' | 'medium' | 'high';

export interface RecommendationScoreBreakdown {
  baseScore: number;
  preferenceScore: number;
  negativePreferencePenalty: number;
  distanceScore: number;
  priceScore: number;
  timeScore: number;
  ratingScore: number;
  openStatusScore: number;
  finalScore: number;
  matchedPreferredTagIds: TagId[];
  matchedAvoidedTagIds: TagId[];
}

export interface RecommendationCandidate {
  id: RecommendationCandidateId;
  name: string;
  tags: string[];
  reason: string;
  estimatedMinutes: number;
  restaurantId?: RestaurantId;
  restaurant?: RestaurantSummary;
  mealName?: string;
  score?: number;
  confidenceScore?: number;
  confidenceLabel?: RecommendationConfidenceLabel;
  scoreBreakdown?: RecommendationScoreBreakdown;
  matchedTagIds?: TagId[];
  imageUrl?: string;
}

export type MealCandidate = RecommendationCandidate;

export interface RecommendationContext {
  location?: GeoPoint;
  answerSnapshot?: UserPreferenceAnswer[];
  preferenceSnapshot?: UserPreferenceProfile;
  excludeRestaurantIds?: RestaurantId[];
  excludeHistoryDays?: number;
}

export interface RecommendMealRequest {
  userId?: string;
  context?: RecommendationContext;
  limit?: number;
}

export interface RecommendationResult {
  id: RecommendationId;
  generatedAt: IsoDateString;
  source: RecommendationSource;
  candidates: RecommendationCandidate[];
  selectedCandidateId?: RecommendationCandidateId;
  reasonSummary?: string;
}

export interface RecommendMealResponse {
  recommendation: RecommendationResult;
}

export interface RecommendationHistoryRecord {
  id: string;
  userId?: string;
  recommendationId?: RecommendationId;
  candidateId?: RecommendationCandidateId;
  restaurantId?: RestaurantId;
  mealName: string;
  restaurantName?: string;
  tags?: string[];
  dateText: string;
  note?: string;
  action?: RecommendationAction;
  selectedAt?: IsoDateString;
  createdAt?: IsoDateString;
}

export type MealHistoryItem = RecommendationHistoryRecord;

export interface RecommendationHistoryDocument extends RecommendationHistoryRecord {
  _id: string;
  _openid?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ListHistoryRequest {
  userId?: string;
  pageSize?: number;
  cursor?: string;
  action?: RecommendationAction;
}

export interface ListHistoryResponse {
  items: RecommendationHistoryRecord[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      requestId: string;
    }
  | {
      ok: false;
      error: ApiError;
      requestId: string;
    };

export type CloudFunctionName =
  | 'recommendRestaurant'
  | 'recommendMeal'
  | 'amapPoi'
  | 'savePreference'
  | 'listHistory';

export const RECOMMENDATION_HISTORY_COLLECTION = 'recommendation_history' as const;
