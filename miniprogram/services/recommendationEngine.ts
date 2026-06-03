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
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
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
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
}

interface ScoreOptions {
  fallbackReason?: string;
  relativeLeadScore?: number;
  candidatePoolWeak?: boolean;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
}

const DEFAULT_LIMIT = 3;
const MIN_PRIMARY_POOL_SIZE = 3;
const MAX_SCORE = 100;
const MIN_SCORE = 0;
export const ALGORITHM_VERSION: RecommendationAlgorithmVersion = 'recommendation-v2';
export const WEIGHT_PROFILE_ID = 'breadth-v2';
export const DEFAULT_EXPERIMENT_ID = 'default';

const BUDGET_LEVEL_TO_YUAN: Record<number, number> = {
  1: 20,
  2: 30,
  3: 60,
  4: 100,
  5: 200
};

const BUDGET_LEVEL_TO_RANGE: Record<number, { min?: number; max: number }> = {
  1: { max: 20 },
  2: { max: 30 },
  3: { min: 30, max: 60 },
  4: { min: 60, max: 100 },
  5: { min: 100, max: 200 }
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
  strong_flavor: 7,
  dessert: 12,
  milk_tea: 12,
  coffee: 12,
  drink: 11,
  afternoon_tea: 11,
  breakfast: 12,
  lunch: 9,
  dinner: 9,
  late_night: 12,
  vegetarian: 16,
  halal: 16,
  allergy_sensitive: 16,
  low_sugar: 15,
  low_carb: 13,
  high_protein: 15,
  non_meal: 12,
  pork: 6,
  meat_heavy: 7,
  seafood: 6,
  peanut: 6,
  unclear_ingredients: 6,
  sweet: 6,
  sugary_drink: 6
};

const HOT_FOOD_TAGS = ['hot', 'comfort', 'congee', 'noodle', 'hotpot', 'malatang'];
const COLD_FOOD_TAGS = ['cold', 'salad', 'fresh', 'light', 'healthy', 'low_burden'];

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
const LIGHT_HEALTHY_PREFERENCE_TAGS = ['light', 'healthy', 'low_burden', 'salad', 'fresh'];
const NON_MEAL_TAGS = ['dessert', 'milk_tea', 'coffee', 'drink', 'afternoon_tea', 'non_meal'];
const MEAL_TAGS = ['meal', 'rice', 'noodle', 'staple', 'set_meal', 'hotpot', 'stir_fry'];
const VEGETARIAN_CONFLICT_TAGS = ['bbq', 'meat_heavy', 'pork'];
const HALAL_CONFLICT_TAGS = ['pork'];
const LOW_SUGAR_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const HIGH_PROTEIN_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const ALLERGY_CONFLICT_TAGS = ['seafood', 'peanut', 'unclear_ingredients'];
const DEFAULT_SPICY_HEAVY_TAGS = ['spicy', 'strong_flavor', 'heavy'];
const NOT_SPICY_KEYWORDS = ['不辣', '微辣可选', '清淡', '白汤', '原味', '广式', '粥', '沙拉', '轻食'];
const SPICY_HEAVY_KEYWORDS = [
  '辣',
  '麻辣',
  '小面',
  '重庆小面',
  '酸辣粉',
  '川',
  '川味',
  '川菜',
  '湘',
  '湘菜',
  '麻辣烫',
  '冒菜',
  '香锅',
  '麻辣香锅',
  '火锅',
  '串串',
  '水煮',
  '剁椒',
  '干锅',
  '螺蛳粉'
];
const INFERRED_TAG_RULES: Array<{ keywords: string[]; tags: TagId[]; skipWhenNotSpicy?: boolean }> = [
  { keywords: ['重庆小面', '小面'], tags: ['spicy', 'strong_flavor', 'heavy', 'chongqing_noodle', 'noodle', 'hot', 'quick'], skipWhenNotSpicy: true },
  { keywords: ['麻辣烫'], tags: ['spicy', 'strong_flavor', 'heavy', 'malatang', 'hot', 'quick'], skipWhenNotSpicy: true },
  { keywords: ['冒菜'], tags: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'maocai', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['麻辣香锅', '香锅', '干锅'], tags: ['spicy', 'strong_flavor', 'heavy', 'dry_pot', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['川菜', '川味', '水煮', '辣子'], tags: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'rice'], skipWhenNotSpicy: true },
  { keywords: ['湘菜', '湖南', '小炒', '剁椒'], tags: ['spicy', 'strong_flavor', 'heavy', 'hunan', 'rice'], skipWhenNotSpicy: true },
  { keywords: ['酸辣粉'], tags: ['spicy', 'strong_flavor', 'heavy', 'chongqing', 'noodle', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['火锅', '串串'], tags: ['spicy', 'strong_flavor', 'heavy', 'hotpot', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['炸鸡', '鸡柳', '鸡排', '肯德基', 'kfc', '麦当劳', '汉堡王', '油炸', '汉堡', '薯条'], tags: ['fried', 'heavy', 'burger', 'quick', 'snack'] },
  { keywords: ['烧烤', '烤肉', '烤串'], tags: ['bbq', 'heavy', 'strong_flavor', 'group'] },
  { keywords: ['粥', '粉面', '云吞', '馄饨', '广式', '茶餐厅'], tags: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { keywords: ['轻食', '沙拉', '健康', '低卡', '减脂'], tags: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { keywords: ['盖饭', '便当', '简餐', '套餐'], tags: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { keywords: ['包子', '饺子', '煎饼', '烧麦', '小吃'], tags: ['quick', 'snack', 'solo', 'hot'] },
  { keywords: ['日式', '日本', '寿司', '咖喱'], tags: ['rice', 'not_spicy', 'stable', 'solo'] }
  , { keywords: ['咖啡', 'cafe', 'coffee'], tags: ['coffee', 'drink', 'non_meal', 'afternoon_tea'] },
  { keywords: ['奶茶', '茶饮', '喜茶', '奈雪', '一点点', '霸王茶姬'], tags: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { keywords: ['饮品', '果茶', '糖水'], tags: ['drink', 'non_meal', 'sweet', 'sugary_drink'] },
  { keywords: ['甜品', '蛋糕', '面包', '烘焙', '点心', '西点'], tags: ['dessert', 'non_meal', 'afternoon_tea', 'sweet'] },
  { keywords: ['早餐', '包子', '豆浆', '油条'], tags: ['breakfast', 'quick', 'hot', 'staple', 'snack'] },
  { keywords: ['夜宵', '宵夜'], tags: ['late_night', 'quick', 'hot', 'snack'] },
  { keywords: ['清真', '兰州拉面', '牛肉面'], tags: ['halal', 'noodle', 'hot', 'high_protein'] },
  { keywords: ['素食', '素菜', '素面'], tags: ['vegetarian', 'healthy', 'light', 'not_spicy'] },
  { keywords: ['健身餐', '鸡胸肉', '高蛋白', '牛肉饭'], tags: ['high_protein', 'healthy', 'low_carb'] },
  { keywords: ['猪肉', '卤肉', '叉烧', '五花肉'], tags: ['pork', 'meat_heavy'] },
  { keywords: ['海鲜', '虾', '蟹'], tags: ['seafood', 'unclear_ingredients'] },
  { keywords: ['花生', '坚果'], tags: ['peanut', 'unclear_ingredients'] }
];
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
const GREASY_KEYWORDS = ['炸', '炸鸡', '鸡柳', '鸡排', '肯德基', 'kfc', '麦当劳', '汉堡王', '烧烤', '烤肉', '汉堡', '薯条', '油炸'];

const NON_MEAL_KEYWORDS = ['咖啡', '奶茶', '茶饮', '饮品', '甜品', '蛋糕', '面包', '烘焙', '下午茶'];
const MEAL_KEYWORDS = ['盖饭', '套餐', '简餐', '小炒', '炒菜', '火锅', '米饭'];
const PORK_KEYWORDS = ['猪肉', '卤肉', '叉烧', '五花肉'];
const MEAT_HEAVY_KEYWORDS = ['烤肉', '烧烤', '牛排', '炸鸡', '猪肉', '肉蟹煲'];
const SWEET_KEYWORDS = ['甜品', '蛋糕', '奶茶', '茶饮', '糖水'];
const ALLERGY_KEYWORDS = ['海鲜', '虾', '蟹', '花生', '坚果'];

export function recommendRestaurants(options: RecommendationEngineOptions): RecommendationResult {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const source = options.source ?? 'mock';
  const preference = options.context?.preferenceSnapshot;
  const excludedHistoryRestaurantIds =
    options.context?.excludedHistoryRestaurantIds ?? options.context?.excludeRestaurantIds ?? [];
  const excludeRestaurantIds = new Set(excludedHistoryRestaurantIds);
  const historyFilterEnabled =
    options.context?.historyFilterEnabled === true && excludedHistoryRestaurantIds.length > 0;
  const historyPenaltyRestaurantIds = options.context?.historyPenaltyRestaurantIds ?? [];
  const historyPenaltyReasons = options.context?.historyPenaltyReasons ?? [];
  const experimentId = options.context?.experimentId ?? DEFAULT_EXPERIMENT_ID;
  const totalFetched = options.restaurants.length;
  const scoreOptionsBase: ScoreOptions = {
    historyFilterEnabled: options.context?.historyFilterEnabled === true,
    excludedHistoryRestaurantIds,
    historyPenaltyRestaurantIds,
    historyPenaltyReasons
  };
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
  let historyFallbackUsed = false;
  let scored = primaryHardFiltered.map((restaurant) =>
    scoreRestaurant(restaurant, preference, scoreOptionsBase)
  );

  if (historyFilterEnabled && scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = '附近新选择较少，已放宽历史过滤';
    historyFallbackUsed = true;
    scored = options.restaurants
      .filter((restaurant) => {
        return applyHardFilters(restaurant, preference, new Set(), {
          allowDistanceFallback: false,
          allowNegativeFallback: false
        }).passed;
      })
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason
        })
      );
  }

  if (scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = '附近符合条件较少，已放宽部分距离条件';
    scored = options.restaurants
      .filter((restaurant) => {
        return applyHardFilters(restaurant, preference, historyFallbackUsed ? new Set() : excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: false
        }).passed;
      })
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason
        })
      );
  }

  if (scored.length === 0) {
    fallbackReason = '附近符合条件较少，已放宽部分负向条件';
    scored = options.restaurants
      .filter((restaurant) => {
        return applyHardFilters(restaurant, preference, historyFallbackUsed ? new Set() : excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: true
        }).passed;
      })
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason
        })
      );
  }

  const poolStats: CandidatePoolStats = {
    totalFetched,
    afterHardFilter: baseHardFiltered.length,
    afterHistoryFilter: primaryHardFiltered.length,
    afterNegativeFilter,
    finalCandidateCount: Math.min(limit, scored.length),
    fallbackUsed: fallbackReason !== undefined,
    historyFallbackUsed
  };
  const ranked = rankWithLightRandom(scored, random);
  const candidates = ranked.slice(0, limit).map((scoredRestaurant, index) => {
    const next = scoreRestaurant(scoredRestaurant.restaurant, preference, {
      fallbackReason: scoredRestaurant.fallbackReason,
      relativeLeadScore: getRelativeLeadScore(ranked, index),
      candidatePoolWeak: poolStats.fallbackUsed || poolStats.afterNegativeFilter < MIN_PRIMARY_POOL_SIZE,
      historyFilterEnabled: scoreOptionsBase.historyFilterEnabled,
      excludedHistoryRestaurantIds: scoreOptionsBase.excludedHistoryRestaurantIds,
      historyPenaltyRestaurantIds: scoreOptionsBase.historyPenaltyRestaurantIds,
      historyPenaltyReasons: scoreOptionsBase.historyPenaltyReasons
    });

    return {
      ...toRecommendationCandidate(next, source, experimentId),
      candidatePoolStats: poolStats
    };
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
    historyFilterEnabled: scoreOptionsBase.historyFilterEnabled,
    excludedHistoryRestaurantIds,
    historyPenaltyReasons,
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
  const temperatureConflict = getTemperatureConflict(restaurant, preference);
  const matchedAvoidedTagIds = [...new Set([...intersect(tagIds, avoidedTagIds), ...negativeConflict.tags])];
  const baseScore = 32;
  const preferenceScore = getPreferenceScore(matchedPreferredTagIds);
  const negativePreferencePenalty = getNegativePenalty(negativeConflict) + temperatureConflict.penalty;
  const historyPenaltyApplies =
    options.historyPenaltyRestaurantIds?.includes(restaurant.id) === true;
  const historyPenalty = historyPenaltyApplies ? 8 : 0;
  const distanceScore = getDistanceScore(restaurant, preference, options.fallbackReason !== undefined);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = getOpenStatusScore(restaurant);
  const dataCompletenessScore = getDataCompletenessScore(restaurant);
  const rawFinalScore = clamp(
    baseScore +
      preferenceScore -
      negativePreferencePenalty +
      - historyPenalty +
      distanceScore +
      priceScore +
      timeScore +
      ratingScore +
      openStatusScore +
      dataCompletenessScore,
    MIN_SCORE,
    MAX_SCORE
  );
  const finalScore =
    options.fallbackReason !== undefined &&
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
      ? Math.min(rawFinalScore, 54)
      : rawFinalScore;
  const hardConstraintScore = getHardConstraintConfidence(restaurant, preference, options.fallbackReason);
  const positivePreferenceScore = getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds);
  const negativeAvoidanceScore = getNegativeAvoidanceConfidence(negativeConflict);
  const relativeLeadScore = options.relativeLeadScore ?? 0;
  const rawConfidenceScore = calculateConfidenceScore({
    hardConstraintScore,
    positivePreferenceScore,
    negativeAvoidanceScore,
    dataCompletenessScore,
    relativeLeadScore,
    negativeConflict,
    temperatureConflict,
    priceOverBudget: isOverBudget(restaurant, preference),
    timeOverPreference: isOverTimePreference(restaurant, preference),
    fallbackUsed: options.fallbackReason !== undefined,
    candidatePoolWeak: options.candidatePoolWeak ?? false
  });
  const confidenceScore = historyPenaltyApplies
    ? Math.min(rawConfidenceScore, 72)
    : rawConfidenceScore;

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
      finalScoreSource:
        'base + preferred tag weights - negative/temperature penalties + distance + price + time + rating + open status + data completeness',
      matchPercentSource:
        'hard constraints + positive preference coverage + negative avoidance + data completeness + relative lead, capped by conflict/fallback calibration',
      matchedPreferredTagIds,
      matchedAvoidedTagIds
    },
    reasons: buildReasons(
      restaurant,
      matchedPreferredTagIds,
      negativeConflict,
      preference,
      options.fallbackReason,
      temperatureConflict
    ),
    hardFilterReasons: applyHardFilters(restaurant, preference, new Set(), {
      allowDistanceFallback: options.fallbackReason !== undefined,
      allowNegativeFallback: true
    }).reasons,
    penaltyReasons: [
      ...buildPenaltyReasons(
        restaurant,
        negativeConflict,
        preference,
        options.fallbackReason,
        temperatureConflict
      ),
      ...(historyPenaltyApplies ? ['近期跳过，已降低权重'] : [])
    ],
    matchedPreferredTagIds,
    matchedAvoidedTagIds,
    fallbackReason: options.fallbackReason,
    historyFilterEnabled: options.historyFilterEnabled,
    excludedHistoryRestaurantIds: options.excludedHistoryRestaurantIds,
    historyPenaltyReasons: options.historyPenaltyReasons
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
  const temperatureConflict = getTemperatureConflict(restaurant, preference);

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

  if (!options.allowNegativeFallback && temperatureConflict.severity === 'soft') {
    reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);
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
    ...nonConflict.sort(compareScoredRestaurants),
    ...conflict.sort(compareScoredRestaurants)
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

function compareScoredRestaurants(left: ScoredRestaurant, right: ScoredRestaurant): number {
  return (
    right.score - left.score ||
    right.confidenceScore - left.confidenceScore ||
    right.breakdown.preferenceScore - left.breakdown.preferenceScore ||
    right.breakdown.distanceScore - left.breakdown.distanceScore
  );
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
    historyFilterEnabled: scored.historyFilterEnabled,
    excludedHistoryRestaurantIds: scored.excludedHistoryRestaurantIds,
    historyPenaltyReasons: scored.historyPenaltyReasons,
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
  fallbackReason?: string,
  temperatureConflict: ReturnType<typeof getTemperatureConflict> = { severity: 'none', label: '', penalty: 0 }
): string[] {
  const reasons: string[] = [];

  if (matchedPreferredTagIds.length > 0) {
    reasons.push(`匹配 ${matchedPreferredTagIds.slice(0, 3).join('、')} 等偏好`);
  }

  if (temperatureConflict.severity !== 'none') {
    reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);
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
  fallbackReason?: string,
  temperatureConflict: ReturnType<typeof getTemperatureConflict> = { severity: 'none', label: '', penalty: 0 }
): string[] {
  const reasons: string[] = [];

  if (negativeConflict.severity !== 'none') {
    reasons.push(`负向偏好冲突：${negativeConflict.labels.join('、')}`);
  }

  if (temperatureConflict.severity !== 'none') {
    reasons.push(`温度偏好冲突：${temperatureConflict.label}`);
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
  const preferred = new Set(getPreferredTagIds(preference));
  const selected = new Set(preference?.selectedOptionIds ?? []);
  const wantsNonMeal =
    selected.has('intent_drink') ||
    selected.has('intent_dessert') ||
    selected.has('time_afternoon_tea') ||
    selected.has('prefer_milk_tea') ||
    selected.has('prefer_coffee') ||
    selected.has('prefer_bakery_dessert') ||
    selected.has('avoid_category_heavy_meal');
  const wantsMeal =
    selected.has('intent_meal') ||
    selected.has('meal_type_meal') ||
    selected.has('satiety_filling') ||
    selected.has('time_lunch') ||
    selected.has('time_dinner') ||
    selected.has('avoid_category_drinks');

  if (LIGHT_HEALTHY_PREFERENCE_TAGS.some((tagId) => preferred.has(tagId))) {
    [...GREASY_CONFLICT_TAGS, ...LIGHT_CONFLICT_TAGS].forEach((tagId) => avoided.add(tagId));
  }

  if (wantsNonMeal || (NON_MEAL_TAGS.some((tagId) => preferred.has(tagId)) && !wantsMeal)) {
    MEAL_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (wantsMeal) {
    NON_MEAL_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('vegetarian') || avoided.has('meat_heavy') || avoided.has('pork')) {
    VEGETARIAN_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('halal') || avoided.has('pork')) {
    HALAL_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet')) {
    LOW_SUGAR_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('high_protein')) {
    HIGH_PROTEIN_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('allergy_sensitive')) {
    ALLERGY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

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
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantText(restaurant);
  const tags = new Set<TagId>();
  const labels = new Set<string>();
  let severity: 'none' | 'soft' | 'hard' = 'none';
  const explicitNoSpicy = avoided.has('spicy');
  const explicitVegetarian = preferred.has('vegetarian');
  const explicitHalal = preferred.has('halal') || avoided.has('pork');
  const explicitLowSugar = preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet');
  const explicitHighProtein = preferred.has('high_protein');
  const explicitAllergy = preferred.has('allergy_sensitive');
  const setSeverity = (next: 'soft' | 'hard') => {
    severity = severity === 'hard' || next === 'hard' ? 'hard' : 'soft';
  };

  tagIds.forEach((tagId) => {
    if (avoided.has(tagId)) {
      tags.add(tagId);
      labels.add(tagId);
      if (
        (explicitNoSpicy && SPICY_CONFLICT_TAGS.includes(tagId)) ||
        (explicitHalal && HALAL_CONFLICT_TAGS.includes(tagId)) ||
        (explicitVegetarian && VEGETARIAN_CONFLICT_TAGS.includes(tagId)) ||
        (explicitAllergy && ALLERGY_CONFLICT_TAGS.includes(tagId))
      ) {
        setSeverity('hard');
      } else {
        setSeverity('soft');
      }
    }
  });

  if (explicitNoSpicy && [...SPICY_KEYWORDS, ...SPICY_HEAVY_KEYWORDS].some((keyword) => text.includes(keyword))) {
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

  if (explicitHalal && PORK_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HALAL_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('pork related');
    setSeverity('hard');
  }

  if (explicitVegetarian && MEAT_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    VEGETARIAN_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('meat-heavy related');
    setSeverity('hard');
  }

  if (explicitLowSugar && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    LOW_SUGAR_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('sweet or sugary related');
    setSeverity('soft');
  }

  if (explicitHighProtein && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HIGH_PROTEIN_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('low protein sweet related');
    setSeverity('soft');
  }

  if (explicitAllergy && ALLERGY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    ALLERGY_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('allergy risk related');
    setSeverity('hard');
  }

  if (avoided.has('meal') && MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    MEAL_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('meal category conflict');
    setSeverity('soft');
  }

  if (avoided.has('non_meal') && NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    NON_MEAL_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('non-meal category conflict');
    setSeverity('soft');
  }

  return {
    severity,
    tags: [...tags],
    labels: [...labels]
  };
}

function getTemperatureConflict(restaurant: Restaurant, preference?: UserPreferenceProfile) {
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const wantsHot = preferred.has('hot') || preferred.has('comfort') || preferred.has('congee');
  const wantsCold = preferred.has('cold') || preferred.has('salad') || preferred.has('fresh');
  const hasHot = tagIds.some((tagId) => HOT_FOOD_TAGS.includes(tagId));
  const hasCold = tagIds.some((tagId) => COLD_FOOD_TAGS.includes(tagId));

  if (wantsHot && hasCold && !hasHot) {
    return { severity: 'soft' as const, label: 'wanted hot food, candidate is cold or light', penalty: 24 };
  }

  if (wantsCold && hasHot && !hasCold) {
    return { severity: 'soft' as const, label: 'wanted cold or light food, candidate is hot-heavy', penalty: 16 };
  }

  return { severity: 'none' as const, label: '', penalty: 0 };
}

function getRestaurantTagIds(restaurant: Restaurant): TagId[] {
  const explicitTagIds = restaurant.tagIds ?? restaurant.tagRefs?.map((tag) => tag.id) ?? restaurant.tags ?? [];
  const inferredTagIds = inferTagIdsFromRestaurantText(restaurant, explicitTagIds);

  return [...new Set([...explicitTagIds, ...inferredTagIds])];
}

function inferTagIdsFromRestaurantText(restaurant: Restaurant, explicitTagIds: TagId[]): TagId[] {
  const text = getRestaurantText(restaurant);
  const inferred = new Set<TagId>();
  const explicitlyNotSpicy =
    explicitTagIds.includes('not_spicy') || NOT_SPICY_KEYWORDS.some((keyword) => text.includes(keyword));

  INFERRED_TAG_RULES.forEach((rule) => {
    if (rule.skipWhenNotSpicy && explicitlyNotSpicy) {
      return;
    }

    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      rule.tags.forEach((tagId) => inferred.add(tagId));
    }
  });

  if (!explicitlyNotSpicy && SPICY_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    DEFAULT_SPICY_HEAVY_TAGS.forEach((tagId) => inferred.add(tagId));
  }

  return [...inferred];
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
    return fallbackUsed ? -22 : -16;
  }

  return fallbackUsed ? -42 : -30;
}

function getPriceScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  if (preference?.budgetLevel === undefined) {
    return 0;
  }

  const estimatedCost = getEstimatedCost(restaurant);

  if (estimatedCost === undefined) {
    return 0;
  }

  const range = getBudgetRange(preference);

  if (estimatedCost <= range.max && (range.min === undefined || estimatedCost >= range.min)) {
    return 14;
  }

  if (range.min !== undefined && estimatedCost < range.min) {
    return estimatedCost >= range.min * 0.75 ? 7 : 3;
  }

  if (estimatedCost <= range.max * 1.1) {
    return -10;
  }

  if (estimatedCost <= range.max * 1.2) {
    return -22;
  }

  return -34;
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
  temperatureConflict: ReturnType<typeof getTemperatureConflict>;
  priceOverBudget: boolean;
  timeOverPreference: boolean;
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
    score = Math.min(score, 70);
  }

  if (input.temperatureConflict.severity === 'soft') {
    score = Math.min(score, 64);
  }

  if (input.priceOverBudget) {
    score = Math.min(score, 70);
  }

  if (input.timeOverPreference) {
    score = Math.min(score, 70);
  }

  if (input.fallbackUsed) {
    score = Math.min(Math.max(score - 10, 45), 64);
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

  const estimatedCost = getEstimatedCost(restaurant);

  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max;
}

function isClearlyOverBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (preference?.budgetLevel === undefined) {
    return false;
  }

  const estimatedCost = getEstimatedCost(restaurant);

  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max * 1.2;
}

function isOverTimePreference(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  return preference?.maxEstimatedMinutes !== undefined && estimateMinutes(restaurant) > preference.maxEstimatedMinutes;
}

function getBudgetMaxYuan(preference: UserPreferenceProfile): number {
  return getBudgetRange(preference).max;
}

function getBudgetRange(preference: UserPreferenceProfile): { min?: number; max: number } {
  return BUDGET_LEVEL_TO_RANGE[preference.budgetLevel ?? 3] ?? BUDGET_LEVEL_TO_RANGE[3];
}

function getEstimatedCost(restaurant: Restaurant): number | undefined {
  if (restaurant.averageCostYuan !== undefined && restaurant.averageCostYuan > 0) {
    return restaurant.averageCostYuan;
  }

  if (restaurant.priceLevel !== undefined) {
    return getPriceLevelCost(restaurant.priceLevel);
  }

  return undefined;
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
