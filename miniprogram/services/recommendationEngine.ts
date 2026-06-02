import type { Restaurant, RestaurantId, TagId } from '../types/restaurant';
import type {
  RecommendationCandidate,
  RecommendationConfidenceLabel,
  RecommendationSource,
  RecommendationResult,
  RecommendationScoreBreakdown
} from '../types/recommendation';
import type { UserPreferenceProfile } from '../types/userPreference';

export interface RecommendationEngineContext {
  preferenceSnapshot?: UserPreferenceProfile;
  excludeRestaurantIds?: RestaurantId[];
}

export interface RecommendationEngineOptions {
  restaurants: Restaurant[];
  context?: RecommendationEngineContext;
  limit?: number;
  now?: Date;
  random?: () => number;
  source?: RecommendationSource;
}

interface HardFilterResult {
  passed: boolean;
  reasons: string[];
}

interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  confidenceScore: number;
  confidenceLabel: RecommendationConfidenceLabel;
  breakdown: RecommendationScoreBreakdown;
  reasons: string[];
}

const DEFAULT_LIMIT = 3;
const MAX_SCORE = 100;
const MIN_SCORE = 0;

export function recommendRestaurants(options: RecommendationEngineOptions): RecommendationResult {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const preference = options.context?.preferenceSnapshot;
  const excludeRestaurantIds = new Set(options.context?.excludeRestaurantIds ?? []);

  const scored = options.restaurants
    .filter((restaurant) => {
      const filterResult = applyHardFilters(restaurant, preference, excludeRestaurantIds);
      return filterResult.passed;
    })
    .map((restaurant) => scoreRestaurant(restaurant, preference));

  const candidates = rankWithLightRandom(scored, random)
    .slice(0, limit)
    .map((scoredRestaurant) =>
      toRecommendationCandidate(scoredRestaurant, options.source ?? 'mock')
    );

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source: options.source ?? 'mock',
    candidates,
    selectedCandidateId: candidates[0]?.id,
    reasonSummary: buildReasonSummary(candidates[0])
  };
}

export function scoreRestaurant(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile
): ScoredRestaurant {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = preference?.preferredTagIds ?? [];
  const avoidedTagIds = preference?.avoidedTagIds ?? [];
  const matchedPreferredTagIds = intersect(tagIds, preferredTagIds);
  const matchedAvoidedTagIds = intersect(tagIds, avoidedTagIds);

  const baseScore = 40;
  const preferenceScore = Math.min(24, matchedPreferredTagIds.length * 8);
  const negativePreferencePenalty = Math.min(30, matchedAvoidedTagIds.length * 12);
  const distanceScore = getDistanceScore(restaurant, preference);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = getOpenStatusScore(restaurant);
  const finalScore = clamp(
    baseScore +
      preferenceScore -
      negativePreferencePenalty +
      distanceScore +
      priceScore +
      timeScore +
      ratingScore +
      openStatusScore,
    MIN_SCORE,
    MAX_SCORE
  );
  const confidenceScore = calculateConfidenceScore(finalScore, matchedPreferredTagIds.length);

  return {
    restaurant,
    score: finalScore,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    breakdown: {
      baseScore,
      preferenceScore,
      negativePreferencePenalty,
      distanceScore,
      priceScore,
      timeScore,
      ratingScore,
      openStatusScore,
      finalScore,
      matchedPreferredTagIds,
      matchedAvoidedTagIds
    },
    reasons: buildReasons(restaurant, matchedPreferredTagIds, matchedAvoidedTagIds, preference)
  };
}

function applyHardFilters(
  restaurant: Restaurant,
  preference: UserPreferenceProfile | undefined,
  excludeRestaurantIds: Set<RestaurantId>
): HardFilterResult {
  const reasons: string[] = [];

  if (restaurant.status !== 'active') {
    reasons.push('餐厅不可用');
  }

  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') {
    reasons.push('当前不在营业');
  }

  if (excludeRestaurantIds.has(restaurant.id)) {
    reasons.push('近期已推荐过');
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
  ) {
    reasons.push('距离超出偏好');
  }

  if (
    preference?.budgetLevel !== undefined &&
    restaurant.priceLevel !== undefined &&
    restaurant.priceLevel > preference.budgetLevel + 1
  ) {
    reasons.push('价格明显超出预算');
  }

  if (
    preference?.maxEstimatedMinutes !== undefined &&
    estimateMinutes(restaurant) > preference.maxEstimatedMinutes
  ) {
    reasons.push('预计耗时超出偏好');
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function rankWithLightRandom(scored: ScoredRestaurant[], random: () => number): ScoredRestaurant[] {
  const sorted = [...scored].sort((left, right) => right.score - left.score);
  const topThree = sorted.slice(0, 3);

  if (topThree.length <= 1) {
    return sorted;
  }

  const totalWeight = topThree.reduce((sum, item, index) => {
    return sum + Math.max(1, item.score) * (1 - index * 0.18);
  }, 0);
  let cursor = random() * totalWeight;
  const selectedIndex = topThree.findIndex((item, index) => {
    cursor -= Math.max(1, item.score) * (1 - index * 0.18);
    return cursor <= 0;
  });
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selected = topThree[safeIndex];
  const remaining = sorted.filter((item) => item.restaurant.id !== selected.restaurant.id);

  return [selected, ...remaining];
}

function toRecommendationCandidate(
  scored: ScoredRestaurant,
  source: RecommendationSource
): RecommendationCandidate {
  const restaurant = scored.restaurant;

  return {
    id: `candidate-${restaurant.id}`,
    restaurantId: restaurant.id,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      tags: restaurant.tags,
      distanceMeters: restaurant.distanceMeters,
      averageCostYuan: restaurant.averageCostYuan,
      openStatus: restaurant.openStatus,
      rating: restaurant.rating
    },
    name: restaurant.name,
    mealName: restaurant.signatureDishes?.[0] ?? restaurant.name,
    tags: restaurant.tags,
    reason: scored.reasons.join('；'),
    estimatedMinutes: estimateMinutes(restaurant),
    score: scored.score,
    confidenceScore: scored.confidenceScore,
    confidenceLabel: scored.confidenceLabel,
    scoreBreakdown: scored.breakdown,
    matchedTagIds: scored.breakdown.matchedPreferredTagIds,
    imageUrl: restaurant.coverImageUrl,
    source
  };
}

function buildReasonSummary(candidate: RecommendationCandidate | undefined): string | undefined {
  if (!candidate) {
    return undefined;
  }

  return `${candidate.name} 匹配度 ${candidate.confidenceScore ?? 0}%，${candidate.reason}`;
}

function buildReasons(
  restaurant: Restaurant,
  matchedPreferredTagIds: TagId[],
  matchedAvoidedTagIds: TagId[],
  preference?: UserPreferenceProfile
): string[] {
  const reasons: string[] = [];

  if (matchedPreferredTagIds.length > 0) {
    reasons.push(`匹配 ${matchedPreferredTagIds.length} 个偏好标签`);
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters <= preference.maxDistanceMeters
  ) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }

  if (
    preference?.budgetLevel !== undefined &&
    restaurant.priceLevel !== undefined &&
    restaurant.priceLevel <= preference.budgetLevel
  ) {
    reasons.push('价格在预算内');
  }

  if (restaurant.rating !== undefined && restaurant.rating >= 4.4) {
    reasons.push(`评分 ${restaurant.rating.toFixed(1)} 较稳定`);
  }

  if (restaurant.openStatus === 'busy') {
    reasons.push('当前较忙但仍可选');
  } else if (restaurant.openStatus === 'open') {
    reasons.push('当前营业中');
  }

  if (matchedAvoidedTagIds.length > 0) {
    reasons.push(`含 ${matchedAvoidedTagIds.length} 个负向偏好标签，已扣分`);
  }

  if (reasons.length === 0) {
    reasons.push(restaurant.description ?? '综合距离、价格和口味后较适合今天');
  }

  return reasons.slice(0, 4);
}

function getRestaurantTagIds(restaurant: Restaurant): TagId[] {
  return restaurant.tagIds ?? restaurant.tagRefs?.map((tag) => tag.id) ?? restaurant.tags;
}

function intersect(left: TagId[], right: TagId[]): TagId[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function getDistanceScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  if (restaurant.distanceMeters === undefined) {
    return 4;
  }

  const maxDistance = preference?.maxDistanceMeters ?? 2000;
  const ratio = restaurant.distanceMeters / maxDistance;

  if (ratio <= 0.25) {
    return 14;
  }

  if (ratio <= 0.5) {
    return 10;
  }

  if (ratio <= 0.8) {
    return 6;
  }

  return 2;
}

function getPriceScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  if (restaurant.priceLevel === undefined || preference?.budgetLevel === undefined) {
    return 4;
  }

  const diff = restaurant.priceLevel - preference.budgetLevel;

  if (diff <= 0) {
    return 10;
  }

  if (diff === 1) {
    return 4;
  }

  return -8;
}

function getTimeScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  const minutes = estimateMinutes(restaurant);
  const maxMinutes = preference?.maxEstimatedMinutes ?? 45;

  if (minutes <= Math.min(25, maxMinutes)) {
    return 8;
  }

  if (minutes <= maxMinutes) {
    return 4;
  }

  return -6;
}

function getRatingScore(restaurant: Restaurant): number {
  if (restaurant.rating === undefined) {
    return 3;
  }

  return clamp((restaurant.rating - 3.5) * 8, 0, 10);
}

function getOpenStatusScore(restaurant: Restaurant): number {
  if (restaurant.openStatus === 'open') {
    return 6;
  }

  if (restaurant.openStatus === 'busy') {
    return 1;
  }

  return 0;
}

function calculateConfidenceScore(score: number, matchedPreferredCount: number): number {
  const preferenceBoost = Math.min(8, matchedPreferredCount * 2);
  return Math.round(clamp(score + preferenceBoost, 0, 98));
}

function getConfidenceLabel(score: number): RecommendationConfidenceLabel {
  if (score >= 78) {
    return 'high';
  }

  if (score >= 58) {
    return 'medium';
  }

  return 'low';
}

function estimateMinutes(restaurant: Restaurant): number {
  const distanceMinutes =
    restaurant.distanceMeters === undefined ? 8 : Math.ceil(restaurant.distanceMeters / 120);
  const diningMinutes = restaurant.category === 'Brunch' ? 35 : 20;
  const busyMinutes = restaurant.openStatus === 'busy' ? 10 : 0;

  return distanceMinutes + diningMinutes + busyMinutes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
