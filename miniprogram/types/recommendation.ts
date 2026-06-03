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
export type RecommendationAlgorithmVersion = 'recommendation-v2';

export interface CandidatePoolStats {
  totalFetched: number;
  afterHardFilter: number;
  afterHistoryFilter?: number;
  afterNegativeFilter: number;
  finalCandidateCount: number;
  fallbackUsed: boolean;
  historyFallbackUsed?: boolean;
}

export interface RecommendationScoreBreakdown {
  baseScore: number;
  preferenceScore: number;
  negativePreferencePenalty: number;
  distanceScore: number;
  priceScore: number;
  timeScore: number;
  ratingScore: number;
  openStatusScore: number;
  dataCompletenessScore?: number;
  hardConstraintScore?: number;
  positivePreferenceScore?: number;
  negativeAvoidanceScore?: number;
  relativeLeadScore?: number;
  confidenceScore?: number;
  finalScore: number;
  finalScoreSource?: string;
  matchPercentSource?: string;
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
  matchedPreferredTagIds?: TagId[];
  matchedAvoidedTagIds?: TagId[];
  hardFilterReasons?: string[];
  penaltyReasons?: string[];
  fallbackReason?: string;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
  candidatePoolStats?: CandidatePoolStats;
  algorithmVersion?: RecommendationAlgorithmVersion;
  weightProfileId?: string;
  experimentId?: string;
  imageUrl?: string;
  source?: RecommendationSource;
}

export type MealCandidate = RecommendationCandidate;

export interface RecommendationContext {
  location?: GeoPoint;
  answerSnapshot?: UserPreferenceAnswer[];
  preferenceSnapshot?: UserPreferenceProfile;
  excludeRestaurantIds?: RestaurantId[];
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
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
  algorithmVersion?: RecommendationAlgorithmVersion;
  weightProfileId?: string;
  experimentId?: string;
  candidates: RecommendationCandidate[];
  selectedCandidateId?: RecommendationCandidateId;
  reasonSummary?: string;
  fallbackReason?: string;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
  candidatePoolStats?: CandidatePoolStats;
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
  reasonSummary?: string;
  imageUrl?: string;
  action?: RecommendationAction;
  selectedAt?: IsoDateString;
  createdAt?: IsoDateString;
  updatedAt?: IsoDateString;
  source?: RecommendationSource;
  algorithmVersion?: RecommendationAlgorithmVersion;
  weightProfileId?: string;
  experimentId?: string;
  matchPercent?: number;
  switchCount?: number;
  scoreBreakdown?: RecommendationScoreBreakdown;
  matchedPreferredTagIds?: TagId[];
  matchedAvoidedTagIds?: TagId[];
  hardFilterReasons?: string[];
  penaltyReasons?: string[];
  fallbackReason?: string;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
  candidatePoolStats?: CandidatePoolStats;
  questionnaire?: {
    version?: string;
    answerCount: number;
    submittedAt?: IsoDateString;
    answers?: UserPreferenceAnswer[];
  };
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

export interface SaveRecommendationHistoryRequest {
  record: RecommendationHistoryRecord;
}

export interface SaveRecommendationHistoryResponse {
  record: RecommendationHistoryRecord;
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
  | 'saveRecommendationHistory'
  | 'savePreference'
  | 'listHistory';

export const RECOMMENDATION_HISTORY_COLLECTION = 'recommendation_history' as const;
