import type { Restaurant, RestaurantId, TagId } from '../types/restaurant';
import type {
  CandidatePoolStats,
  RecommendationAlgorithmVersion,
  RecommendationCandidate,
  RecommendationConfidenceLabel,
  RecommendationResult,
  RecommendationScoreBreakdown,
  RecommendationSource
} from '../types/recommendation';
import type { UserPreferenceProfile } from '../types/userPreference';

export interface RecommendationEngineContext {
  preferenceSnapshot?: UserPreferenceProfile;
  excludeRestaurantIds?: RestaurantId[];
  experimentId?: string;
}

export interface RecommendationEngineOptions {
  restaurants: Restaurant[];
  context?: RecommendationEngineContext;
  limit?: number;
  now?: Date;
  random?: () => number;
  source?: RecommendationSource;
}

export interface HardFilterResult {
  passed: boolean;
  reasons: string[];
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  confidenceScore: number;
  confidenceLabel: RecommendationConfidenceLabel;
  breakdown: RecommendationScoreBreakdown;
  reasons: string[];
  hardFilterReasons: string[];
  penaltyReasons: string[];
  matchedPreferredTagIds: TagId[];
  matchedAvoidedTagIds: TagId[];
  fallbackReason?: string;
}

interface ScoreOptions {
  fallbackReason?: string;
  relativeLeadScore?: number;
  candidatePoolWeak?: boolean;
}

const DEFAULT_LIMIT = 3;
const MIN_PRIMARY_POOL_SIZE = 3;
const MAX_SCORE = 100;
const MIN_SCORE = 0;
export const ALGORITHM_VERSION: RecommendationAlgorithmVersion = 'recommendation-v2';
export const WEIGHT_PROFILE_ID = 'default-v2';
export const DEFAULT_EXPERIMENT_ID = 'default';

const BUDGET_LEVEL_TO_YUAN: Record<number, number> = {
  1: 20,
  2: 30,
  3: 60,
  4: 100,
  5: 200
};

const TAG_WEIGHTS: Record<string, number> = {
  light: 14,
  healthy: 12,
  low_burden: 12,
  not_spicy: 12,
  salad: 10,
  congee: 10,
  fresh: 9,
  hot: 8,
  cold: 8,
  comfort: 8,
  staple: 11,
  rice: 10,
  noodle: 10,
  meal: 10,
  set_meal: 10,
  snack: 12,
  quick: 11,
  solo: 8,
  slow: 5,
  spicy: 8,
  strong_flavor: 7
};

const SPICY_CONFLICT_TAGS = [
  'spicy',
  'strong_flavor',
  'hotpot',
  'malatang',
  'sichuan',
  'hunan',
  'chongqing',
  'chongqing_noodle',
  'maocai',
  'dry_pot'
];
const GREASY_CONFLICT_TAGS = ['bbq', 'fried', 'heavy', 'strong_flavor', 'burger'];
const LIGHT_CONFLICT_TAGS = ['spicy', 'strong_flavor', 'bbq', 'fried', 'heavy', 'hotpot', 'malatang'];
const SPICY_KEYWORDS = [
  '辣',
  '麻辣',
  '小面',
  '重庆小面',
  '川',
  '川味',
  '川菜',
  '湘',
  '湘菜',
  '麻辣烫',
  '冒菜',
  '香锅',
  '火锅',
  '串串'
];
const GREASY_KEYWORDS = ['炸', '炸鸡', '烧烤', '烤肉', '汉堡', '油炸'];

export function recommendRestaurants(options: RecommendationEngineOptions): RecommendationResult {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const source = options.source ?? 'mock';
  const preference = options.context?.preferenceSnapshot;
  const excludeRestaurantIds = new Set(options.context?.excludeRestaurantIds ?? []);
  const experimentId = options.context?.experimentId ?? DEFAULT_EXPERIMENT_ID;
  const totalFetched = options.restaurants.length;
  const baseHardFiltered = options.restaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
      allowDistanceFallback: false,
      allowNegativeFallback: true
    }).passed;
  });
  const primaryHardFiltered = options.restaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
      allowDistanceFallback: false,
      allowNegativeFallback: false
    }).passed;
  });
  const afterNegativeFilter = primaryHardFiltered.length;

  let fallbackReason: string | undefined;
  let scored = primaryHardFiltered.map((restaurant) => scoreRestaurant(restaurant, preference));

  if (scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = '附近符合条件较少，已放宽部分距离条件';
    scored = options.restaurants
      .filter((restaurant) => {
        return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: false
        }).passed;
      })
      .map((restaurant) => scoreRestaurant(restaurant, preference, { fallbackReason }));
  }

  if (scored.length === 0) {
    fallbackReason = '附近符合条件较少，已放宽部分负向条件';
    scored = options.restaurants
      .filter((restaurant) => {
        return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: true
        }).passed;
      })
      .map((restaurant) => scoreRestaurant(restaurant, preference, { fallbackReason }));
  }

  const poolStats: CandidatePoolStats = {
    totalFetched,
    afterHardFilter: baseHardFiltered.length,
    afterNegativeFilter,
    finalCandidateCount: Math.min(limit, scored.length),
    fallbackUsed: fallbackReason !== undefined
  };
  const ranked = rankWithLightRandom(scored, random);
  const candidates = ranked.slice(0, limit).map((scoredRestaurant, index) => {
    const next = scoreRestaurant(scoredRestaurant.restaurant, preference, {
      fallbackReason: scoredRestaurant.fallbackReason,
      relativeLeadScore: getRelativeLeadScore(ranked, index),
      candidatePoolWeak: poolStats.fallbackUsed || poolStats.afterNegativeFilter < MIN_PRIMARY_POOL_SIZE
    });

    return toRecommendationCandidate(next, source, experimentId);
  });

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source,
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
    candidates,
    selectedCandidateId: candidates[0]?.id,
    reasonSummary: buildReasonSummary(candidates[0]),
    fallbackReason,
    candidatePoolStats: poolStats
  };
}

export function scoreRestaurant(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  options: ScoreOptions = {}
): ScoredRestaurant {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = getPreferredTagIds(preference);
  const avoidedTagIds = getAvoidedTagIds(preference);
  const matchedPreferredTagIds = intersect(tagIds, preferredTagIds);
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const matchedAvoidedTagIds = [...new Set([...intersect(tagIds, avoidedTagIds), ...negativeConflict.tags])];
  const baseScore = 32;
  const preferenceScore = getPreferenceScore(matchedPreferredTagIds);
  const negativePreferencePenalty = getNegativePenalty(negativeConflict);
  const distanceScore = getDistanceScore(restaurant, preference, options.fallbackReason !== undefined);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = getOpenStatusScore(restaurant);
  const dataCompletenessScore = getDataCompletenessScore(restaurant);
  const finalScore = clamp(
    baseScore +
      preferenceScore -
      negativePreferencePenalty +
      distanceScore +
      priceScore +
      timeScore +
      ratingScore +
      openStatusScore +
      dataCompletenessScore,
    MIN_SCORE,
    MAX_SCORE
  );
  const hardConstraintScore = getHardConstraintConfidence(restaurant, preference, options.fallbackReason);
  const positivePreferenceScore = getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds);
  const negativeAvoidanceScore = getNegativeAvoidanceConfidence(negativeConflict);
  const relativeLeadScore = options.relativeLeadScore ?? 0;
  const confidenceScore = calculateConfidenceScore({
    hardConstraintScore,
    positivePreferenceScore,
    negativeAvoidanceScore,
    dataCompletenessScore,
    relativeLeadScore,
    negativeConflict,
    fallbackUsed: options.fallbackReason !== undefined,
    candidatePoolWeak: options.candidatePoolWeak ?? false
  });

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
      dataCompletenessScore,
      hardConstraintScore,
      positivePreferenceScore,
      negativeAvoidanceScore,
      relativeLeadScore,
      confidenceScore,
      finalScore,
      matchedPreferredTagIds,
      matchedAvoidedTagIds
    },
    reasons: buildReasons(restaurant, matchedPreferredTagIds, negativeConflict, preference, options.fallbackReason),
    hardFilterReasons: applyHardFilters(restaurant, preference, new Set(), {
      allowDistanceFallback: options.fallbackReason !== undefined,
      allowNegativeFallback: true
    }).reasons,
    penaltyReasons: buildPenaltyReasons(restaurant, negativeConflict, preference, options.fallbackReason),
    matchedPreferredTagIds,
    matchedAvoidedTagIds,
    fallbackReason: options.fallbackReason
  };
}

export function applyHardFilters(
  restaurant: Restaurant,
  preference: UserPreferenceProfile | undefined,
  excludeRestaurantIds: Set<RestaurantId>,
  options: { allowDistanceFallback: boolean; allowNegativeFallback: boolean }
): HardFilterResult {
  const reasons: string[] = [];
  const negativeConflict = getNegativeConflict(restaurant, preference);

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
    !options.allowDistanceFallback &&
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
  ) {
    reasons.push(`距离 ${restaurant.distanceMeters} 米，超出 ${preference.maxDistanceMeters} 米偏好`);
  }

  if (isClearlyOverBudget(restaurant, preference)) {
    reasons.push('价格明显超出预算');
  }

  if (
    preference?.maxEstimatedMinutes !== undefined &&
    estimateMinutes(restaurant) > preference.maxEstimatedMinutes + 20
  ) {
    reasons.push('预计耗时明显超出偏好');
  }

  if (!options.allowNegativeFallback && negativeConflict.severity === 'hard') {
    reasons.push(`命中明确负向偏好：${negativeConflict.labels.join('、')}`);
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function rankWithLightRandom(scored: ScoredRestaurant[], random: () => number): ScoredRestaurant[] {
  const nonConflict = scored.filter((item) => item.matchedAvoidedTagIds.length === 0);
  const conflict = scored.filter((item) => item.matchedAvoidedTagIds.length > 0);
  const sorted = [
    ...nonConflict.sort((left, right) => right.score - left.score),
    ...conflict.sort((left, right) => right.score - left.score)
  ];
  const topThree = sorted.slice(0, 3);

  if (topThree.length <= 1) {
    return sorted;
  }

  const totalWeight = topThree.reduce((sum, item, index) => {
    return sum + Math.max(1, item.score) * (1 - index * 0.22);
  }, 0);
  let cursor = random() * totalWeight;
  const selectedIndex = topThree.findIndex((item, index) => {
    cursor -= Math.max(1, item.score) * (1 - index * 0.22);
    return cursor <= 0;
  });
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selected = topThree[safeIndex];
  const remaining = sorted.filter((item) => item.restaurant.id !== selected.restaurant.id);

  return [selected, ...remaining];
}

function toRecommendationCandidate(
  scored: ScoredRestaurant,
  source: RecommendationSource,
  experimentId: string
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
    matchedTagIds: scored.matchedPreferredTagIds,
    matchedPreferredTagIds: scored.matchedPreferredTagIds,
    matchedAvoidedTagIds: scored.matchedAvoidedTagIds,
    hardFilterReasons: scored.hardFilterReasons,
    penaltyReasons: scored.penaltyReasons,
    fallbackReason: scored.fallbackReason,
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
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
  negativeConflict: ReturnType<typeof getNegativeConflict>,
  preference?: UserPreferenceProfile,
  fallbackReason?: string
): string[] {
  const reasons: string[] = [];

  if (matchedPreferredTagIds.length > 0) {
    reasons.push(`匹配 ${matchedPreferredTagIds.slice(0, 3).join('、')} 等偏好`);
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters <= preference.maxDistanceMeters
  ) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米，在你的范围内`);
  } else if (restaurant.distanceMeters !== undefined) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }

  if (preference?.budgetLevel !== undefined && restaurant.averageCostYuan !== undefined) {
    const budgetMax = getBudgetMaxYuan(preference);
    reasons.push(
      restaurant.averageCostYuan <= budgetMax
        ? `人均约 ${restaurant.averageCostYuan} 元，符合预算`
        : `人均约 ${restaurant.averageCostYuan} 元，略高于预算`
    );
  }

  if (restaurant.openStatus === 'open') {
    reasons.push('当前营业中');
  }

  if (negativeConflict.severity !== 'none') {
    reasons.push(`含负向偏好 ${negativeConflict.labels.join('、')}，已明显降权`);
  }

  if (fallbackReason) {
    reasons.push(fallbackReason);
  }

  if (reasons.length === 0) {
    reasons.push(restaurant.description ?? '综合距离、价格和口味后较适合今天');
  }

  return reasons.slice(0, 5);
}

function buildPenaltyReasons(
  restaurant: Restaurant,
  negativeConflict: ReturnType<typeof getNegativeConflict>,
  preference?: UserPreferenceProfile,
  fallbackReason?: string
): string[] {
  const reasons: string[] = [];

  if (negativeConflict.severity !== 'none') {
    reasons.push(`负向偏好冲突：${negativeConflict.labels.join('、')}`);
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
  ) {
    reasons.push(`超出距离偏好 ${restaurant.distanceMeters - preference.maxDistanceMeters} 米`);
  }

  if (isOverBudget(restaurant, preference)) {
    reasons.push('超出预算偏好');
  }

  if (fallbackReason) {
    reasons.push(fallbackReason);
  }

  return reasons;
}

function getPreferredTagIds(preference?: UserPreferenceProfile): TagId[] {
  return [...new Set([...(preference?.preferredTagIds ?? []), ...(preference?.positiveTags ?? [])])];
}

function getAvoidedTagIds(preference?: UserPreferenceProfile): TagId[] {
  const avoided = new Set([...(preference?.avoidedTagIds ?? []), ...(preference?.negativeTags ?? [])]);

  if (avoided.has('spicy')) {
    SPICY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (avoided.has('strong_flavor')) {
    LIGHT_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) {
    GREASY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  return [...avoided];
}

function getNegativeConflict(restaurant: Restaurant, preference?: UserPreferenceProfile) {
  const avoided = new Set(getAvoidedTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantText(restaurant);
  const tags = new Set<TagId>();
  const labels = new Set<string>();
  let severity: 'none' | 'soft' | 'hard' = 'none';
  const explicitNoSpicy = avoided.has('spicy');

  tagIds.forEach((tagId) => {
    if (avoided.has(tagId)) {
      tags.add(tagId);
      labels.add(tagId);
      severity = explicitNoSpicy && SPICY_CONFLICT_TAGS.includes(tagId) ? 'hard' : 'soft';
    }
  });

  if (explicitNoSpicy && SPICY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    SPICY_CONFLICT_TAGS.forEach((tagId) => {
      if (tagIds.includes(tagId) || tagId === 'spicy') {
        tags.add(tagId);
      }
    });
    labels.add('辣/麻辣/川湘相关');
    severity = 'hard';
  }

  if (
    (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) &&
    GREASY_KEYWORDS.some((keyword) => text.includes(keyword))
  ) {
    GREASY_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('油腻/油炸/烧烤相关');
    severity = severity === 'hard' ? 'hard' : 'soft';
  }

  return {
    severity,
    tags: [...tags],
    labels: [...labels]
  };
}

function getRestaurantTagIds(restaurant: Restaurant): TagId[] {
  return restaurant.tagIds ?? restaurant.tagRefs?.map((tag) => tag.id) ?? restaurant.tags;
}

function getRestaurantText(restaurant: Restaurant): string {
  return [
    restaurant.name,
    restaurant.category,
    restaurant.description,
    ...(restaurant.tags ?? []),
    ...(restaurant.signatureDishes ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function intersect(left: TagId[], right: TagId[]): TagId[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((item) => rightSet.has(item)))];
}

function getPreferenceScore(matchedPreferredTagIds: TagId[]): number {
  return Math.min(
    34,
    matchedPreferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0)
  );
}

function getNegativePenalty(conflict: ReturnType<typeof getNegativeConflict>): number {
  if (conflict.severity === 'hard') {
    return 88;
  }

  if (conflict.severity === 'soft') {
    return Math.min(45, 22 + conflict.tags.length * 7);
  }

  return 0;
}

function getDistanceScore(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  fallbackUsed = false
): number {
  if (restaurant.distanceMeters === undefined) {
    return 0;
  }

  const maxDistance = preference?.maxDistanceMeters ?? 1500;
  const ratio = restaurant.distanceMeters / maxDistance;

  if (ratio <= 0.5) {
    return fallbackUsed ? 10 : 18;
  }

  if (ratio <= 1) {
    return fallbackUsed ? 5 : 12;
  }

  if (ratio <= 1.5) {
    return -12;
  }

  return -24;
}

function getPriceScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  if (preference?.budgetLevel === undefined) {
    return 0;
  }

  if (restaurant.averageCostYuan === undefined && restaurant.priceLevel === undefined) {
    return 0;
  }

  const budgetMax = getBudgetMaxYuan(preference);
  const estimatedCost = restaurant.averageCostYuan ?? getPriceLevelCost(restaurant.priceLevel);

  if (estimatedCost <= budgetMax) {
    return 12;
  }

  if (estimatedCost <= budgetMax * 1.2) {
    return -10;
  }

  return -28;
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

  return -8;
}

function getRatingScore(restaurant: Restaurant): number {
  if (restaurant.rating === undefined) {
    return 0;
  }

  return clamp((restaurant.rating - 3.6) * 6, 0, 8);
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

function getDataCompletenessScore(restaurant: Restaurant): number {
  const checks = [
    restaurant.distanceMeters !== undefined,
    restaurant.averageCostYuan !== undefined || restaurant.priceLevel !== undefined,
    restaurant.rating !== undefined,
    restaurant.openStatus !== undefined && restaurant.openStatus !== 'unknown',
    getRestaurantTagIds(restaurant).length > 0
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 10);
}

function getHardConstraintConfidence(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  fallbackReason?: string
): number {
  let score = 0;

  if (restaurant.openStatus === 'open' || restaurant.openStatus === 'busy' || restaurant.openStatus === 'unknown') {
    score += 10;
  }

  if (
    preference?.maxDistanceMeters === undefined ||
    restaurant.distanceMeters === undefined ||
    restaurant.distanceMeters <= preference.maxDistanceMeters
  ) {
    score += 10;
  } else {
    score += fallbackReason ? 3 : 0;
  }

  if (!isOverBudget(restaurant, preference)) {
    score += 10;
  } else if (!isClearlyOverBudget(restaurant, preference)) {
    score += 3;
  }

  return score;
}

function getPositivePreferenceConfidence(preferredTagIds: TagId[], matchedPreferredTagIds: TagId[]): number {
  if (preferredTagIds.length === 0) {
    return 12;
  }

  const preferredWeight = preferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0);
  const matchedWeight = matchedPreferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0);

  return Math.round(clamp((matchedWeight / Math.max(1, preferredWeight)) * 25, 0, 25));
}

function getNegativeAvoidanceConfidence(conflict: ReturnType<typeof getNegativeConflict>): number {
  if (conflict.severity === 'hard') {
    return 0;
  }

  if (conflict.severity === 'soft') {
    return 8;
  }

  return 25;
}

function getRelativeLeadScore(ranked: ScoredRestaurant[], index: number): number {
  if (index !== 0 || ranked.length < 2) {
    return 3;
  }

  const lead = ranked[0].score - ranked[1].score;
  return Math.round(clamp(lead / 3, 2, 10));
}

function calculateConfidenceScore(input: {
  hardConstraintScore: number;
  positivePreferenceScore: number;
  negativeAvoidanceScore: number;
  dataCompletenessScore: number;
  relativeLeadScore: number;
  negativeConflict: ReturnType<typeof getNegativeConflict>;
  fallbackUsed: boolean;
  candidatePoolWeak: boolean;
}): number {
  let score =
    input.hardConstraintScore +
    input.positivePreferenceScore +
    input.negativeAvoidanceScore +
    input.dataCompletenessScore +
    input.relativeLeadScore;

  if (input.negativeConflict.severity === 'hard') {
    score = Math.min(score, 42);
  } else if (input.negativeConflict.severity === 'soft') {
    score = Math.min(score, 58);
  }

  if (input.fallbackUsed) {
    score = Math.min(score - 8, 70);
  }

  if (input.candidatePoolWeak) {
    score = Math.min(score, 72);
  }

  return Math.round(clamp(score, 0, 95));
}

function getConfidenceLabel(score: number): RecommendationConfidenceLabel {
  if (score >= 76) {
    return 'high';
  }

  if (score >= 55) {
    return 'medium';
  }

  return 'low';
}

function isOverBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (preference?.budgetLevel === undefined) {
    return false;
  }

  const estimatedCost = restaurant.averageCostYuan ?? getPriceLevelCost(restaurant.priceLevel);

  return estimatedCost > getBudgetMaxYuan(preference);
}

function isClearlyOverBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (preference?.budgetLevel === undefined) {
    return false;
  }

  const estimatedCost = restaurant.averageCostYuan ?? getPriceLevelCost(restaurant.priceLevel);

  return estimatedCost > getBudgetMaxYuan(preference) * 1.45;
}

function getBudgetMaxYuan(preference: UserPreferenceProfile): number {
  return BUDGET_LEVEL_TO_YUAN[preference.budgetLevel ?? 3] ?? 60;
}

function getPriceLevelCost(priceLevel: Restaurant['priceLevel']): number {
  if (priceLevel === undefined) {
    return 60;
  }

  return BUDGET_LEVEL_TO_YUAN[priceLevel] ?? 60;
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
