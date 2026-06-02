const cloud = initCloudSdk();

const DEFAULT_LIMIT = 3;
const MIN_PRIMARY_POOL_SIZE = 3;
const ALGORITHM_VERSION = 'recommendation-v2';
const WEIGHT_PROFILE_ID = 'default-v2';
const DEFAULT_EXPERIMENT_ID = 'default';
const BUDGET_LEVEL_TO_YUAN = { 1: 20, 2: 30, 3: 60, 4: 100, 5: 200 };
const TAG_WEIGHTS = {
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
const SPICY_KEYWORDS = ['辣', '麻辣', '小面', '重庆小面', '川', '川味', '川菜', '湘', '湘菜', '麻辣烫', '冒菜', '香锅', '火锅', '串串'];
const GREASY_KEYWORDS = ['炸', '炸鸡', '烧烤', '烤肉', '汉堡', '油炸'];

const DEFAULT_PREFERENCE = {
  selectedOptionIds: ['quick', 'light'],
  preferredTagIds: ['quick', 'staple'],
  avoidedTagIds: [],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 45
};

const mockRestaurants = [
  {
    id: 'r-cantonese-congee',
    name: '广式粥粉面',
    tags: ['清淡', '热乎', '粥粉面', '暖胃', '快餐'],
    tagIds: ['light', 'hot', 'congee', 'comfort', 'quick', 'not_spicy'],
    category: '粤式简餐',
    distanceMeters: 300,
    priceLevel: 2,
    averageCostYuan: 29,
    openStatus: 'open',
    signatureDishes: ['皮蛋瘦肉粥', '云吞面'],
    rating: 4.4,
    status: 'active'
  },
  {
    id: 'r-light-salad',
    name: '轻食研究所',
    tags: ['清淡', '健康', '沙拉', '低负担', '清爽'],
    tagIds: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'not_spicy', 'cold'],
    category: '轻食',
    distanceMeters: 650,
    priceLevel: 3,
    averageCostYuan: 42,
    openStatus: 'open',
    signatureDishes: ['鸡胸藜麦碗', '牛油果沙拉'],
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'r-rice-set',
    name: '家常盖饭小站',
    tags: ['正餐', '米饭', '套餐', '快餐', '饱腹'],
    tagIds: ['staple', 'rice', 'meal', 'set_meal', 'quick', 'not_spicy'],
    category: '简餐',
    distanceMeters: 480,
    priceLevel: 2,
    averageCostYuan: 26,
    openStatus: 'open',
    signatureDishes: ['番茄鸡蛋盖饭', '卤肉饭'],
    rating: 4.1,
    status: 'active'
  },
  {
    id: 'r-snack-buns',
    name: '巷口小吃铺',
    tags: ['小吃', '快餐', '一人食', '热乎', '便宜'],
    tagIds: ['snack', 'quick', 'solo', 'hot', 'not_spicy'],
    category: '小吃',
    distanceMeters: 380,
    priceLevel: 1,
    averageCostYuan: 18,
    openStatus: 'open',
    signatureDishes: ['鲜肉小笼', '鸡蛋煎饼'],
    rating: 4.0,
    status: 'active'
  },
  {
    id: 'r-chongqing-noodle',
    name: '重庆小面',
    tags: ['小面', '麻辣', '热乎', '面食', '重口味'],
    tagIds: ['spicy', 'strong_flavor', 'chongqing_noodle', 'noodle', 'hot', 'quick'],
    category: '重庆小面',
    distanceMeters: 420,
    priceLevel: 2,
    averageCostYuan: 24,
    openStatus: 'open',
    signatureDishes: ['招牌重庆小面', '酸辣粉'],
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'r-hunan-rice',
    name: '湘味小炒饭堂',
    tags: ['下饭', '辣', '米饭', '多人', '重口味'],
    tagIds: ['rice', 'spicy', 'hunan', 'stir_fry', 'group', 'strong_flavor'],
    category: '湘菜',
    distanceMeters: 900,
    priceLevel: 3,
    averageCostYuan: 54,
    openStatus: 'busy',
    signatureDishes: ['小炒黄牛肉', '辣椒炒肉'],
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'r-malatang',
    name: '小锅麻辣烫',
    tags: ['麻辣烫', '辣', '热乎', '自选', '重口味'],
    tagIds: ['spicy', 'malatang', 'hot', 'customizable', 'strong_flavor'],
    category: '麻辣烫',
    distanceMeters: 760,
    priceLevel: 2,
    averageCostYuan: 35,
    openStatus: 'open',
    signatureDishes: ['骨汤麻辣烫', '番茄麻辣烫'],
    rating: 4.1,
    status: 'active'
  },
  {
    id: 'r-maocai',
    name: '川味冒菜香锅',
    tags: ['冒菜', '麻辣香锅', '川味', '重口味'],
    tagIds: ['spicy', 'sichuan', 'maocai', 'dry_pot', 'strong_flavor'],
    category: '冒菜',
    distanceMeters: 820,
    priceLevel: 3,
    averageCostYuan: 46,
    openStatus: 'open',
    signatureDishes: ['招牌冒菜', '麻辣香锅'],
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'r-fried-chicken',
    name: '脆皮炸鸡汉堡',
    tags: ['炸鸡', '汉堡', '油炸', '小吃', '高热量'],
    tagIds: ['fried', 'burger', 'heavy', 'snack', 'quick'],
    category: '炸鸡汉堡',
    distanceMeters: 520,
    priceLevel: 2,
    averageCostYuan: 32,
    openStatus: 'open',
    signatureDishes: ['脆皮炸鸡', '牛肉汉堡'],
    rating: 4.0,
    status: 'active'
  }
];

exports.main = async (event = {}, cloudContext = {}) => {
  const requestId = createRequestId();

  try {
    const context = event.context || {};
    const answers = getAnswers(event, context);
    const preferenceSnapshot = context.preferenceSnapshot || buildPreferenceProfile(answers);
    const result = recommendRestaurants({
      restaurants: Array.isArray(event.restaurants) && event.restaurants.length > 0 ? event.restaurants : mockRestaurants,
      context: {
        preferenceSnapshot,
        excludeRestaurantIds: context.excludeRestaurantIds || [],
        experimentId: context.experimentId || DEFAULT_EXPERIMENT_ID
      },
      limit: normalizeLimit(event.limit),
      source: 'cloud',
      now: new Date()
    });

    return {
      ok: true,
      data: {
        recommendation: result
      },
      requestId,
      openid: getOpenId(cloudContext)
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'RECOMMEND_RESTAURANT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to recommend restaurants.'
      },
      requestId
    };
  }
};

function initCloudSdk() {
  try {
    const sdk = require('wx-server-sdk');
    sdk.init({ env: sdk.DYNAMIC_CURRENT_ENV });
    return sdk;
  } catch (error) {
    return null;
  }
}

function getOpenId(cloudContext) {
  if (!cloud || typeof cloud.getWXContext !== 'function') {
    return cloudContext.OPENID;
  }

  return cloud.getWXContext().OPENID;
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAnswers(event, context) {
  if (Array.isArray(event.questionnaire && event.questionnaire.answers)) {
    return event.questionnaire.answers;
  }

  if (Array.isArray(context.answerSnapshot)) {
    return context.answerSnapshot;
  }

  return [];
}

function normalizeLimit(limit) {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(10, Math.floor(limit)));
}

function buildPreferenceProfile(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { ...DEFAULT_PREFERENCE };
  }

  const selectedOptionIds = answers.flatMap((answer) => answer.optionIds || []);
  const preferredTagIds = new Set(DEFAULT_PREFERENCE.preferredTagIds);
  const avoidedTagIds = new Set(DEFAULT_PREFERENCE.avoidedTagIds);
  let budgetLevel = DEFAULT_PREFERENCE.budgetLevel;
  let maxDistanceMeters = DEFAULT_PREFERENCE.maxDistanceMeters;
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;

  answers.forEach((answer) => {
    applyAnswerEffect(answer, preferredTagIds, avoidedTagIds);

    if (answer.questionId === 'budget') {
      budgetLevel = answer.value === 'under_30' ? 2 : answer.value === 'over_60' ? 4 : 3;
    }

    if (answer.questionId === 'distance') {
      maxDistanceMeters = answer.value === 500 || answer.value === 1000 ? answer.value : 3000;
      maxEstimatedMinutes = answer.value === 500 ? 30 : answer.value === 1000 ? 40 : 60;
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    positiveTags: [...preferredTagIds],
    negativeTags: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters,
    maxEstimatedMinutes,
    constraints: { budgetLevel, maxDistanceMeters, maxEstimatedMinutes },
    softPreferences: {}
  };
}

function applyAnswerEffect(answer, preferredTagIds, avoidedTagIds) {
  const value = answer.value;

  if (value === 'avoid_spicy' || value === 'no_spicy') {
    ['not_spicy', 'light', 'congee'].forEach((tag) => preferredTagIds.add(tag));
    SPICY_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'avoid_greasy' || value === 'light_burden') {
    ['healthy', 'light', 'low_burden', 'fresh'].forEach((tag) => preferredTagIds.add(tag));
    GREASY_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
    ['spicy', 'strong_flavor'].forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'light') {
    ['light', 'healthy', 'not_spicy', 'low_burden'].forEach((tag) => preferredTagIds.add(tag));
    LIGHT_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'strong' || value === 'spicy_ok') {
    ['spicy', 'strong_flavor'].forEach((tag) => preferredTagIds.add(tag));
    ['spicy', 'strong_flavor'].forEach((tag) => avoidedTagIds.delete(tag));
  }

  if (value === 'filling' || value === 'meal') {
    ['staple', 'rice', 'noodle', 'meal', 'set_meal'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'snack') {
    ['snack', 'quick', 'solo'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'fast') {
    ['quick', 'solo', 'snack'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'hot') {
    ['hot', 'comfort', 'congee'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'cold') {
    ['cold', 'light', 'salad', 'fresh'].forEach((tag) => preferredTagIds.add(tag));
  }
}

function recommendRestaurants(options) {
  const now = options.now || new Date();
  const limit = options.limit || DEFAULT_LIMIT;
  const preference = options.context && options.context.preferenceSnapshot;
  const excludeRestaurantIds = new Set((options.context && options.context.excludeRestaurantIds) || []);
  const experimentId = (options.context && options.context.experimentId) || DEFAULT_EXPERIMENT_ID;
  const baseHardFiltered = options.restaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, true, false).passed;
  });
  const primaryHardFiltered = options.restaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, false, false).passed;
  });
  let fallbackReason;
  let scored = primaryHardFiltered.map((restaurant) => scoreRestaurant(restaurant, preference));

  if (scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = '附近符合条件较少，已放宽部分距离条件';
    scored = options.restaurants
      .filter((restaurant) => applyHardFilters(restaurant, preference, excludeRestaurantIds, true, false).passed)
      .map((restaurant) => scoreRestaurant(restaurant, preference, { fallbackReason }));
  }

  if (scored.length === 0) {
    fallbackReason = '附近符合条件较少，已放宽部分负向条件';
    scored = options.restaurants
      .filter((restaurant) => applyHardFilters(restaurant, preference, excludeRestaurantIds, true, true).passed)
      .map((restaurant) => scoreRestaurant(restaurant, preference, { fallbackReason }));
  }

  const poolStats = {
    totalFetched: options.restaurants.length,
    afterHardFilter: baseHardFiltered.length,
    afterNegativeFilter: primaryHardFiltered.length,
    finalCandidateCount: Math.min(limit, scored.length),
    fallbackUsed: fallbackReason !== undefined
  };
  const ranked = rankWithLightRandom(scored);
  const candidates = ranked.slice(0, limit).map((item, index) => {
    const rescored = scoreRestaurant(item.restaurant, preference, {
      fallbackReason: item.fallbackReason,
      relativeLeadScore: getRelativeLeadScore(ranked, index),
      candidatePoolWeak: poolStats.fallbackUsed || poolStats.afterNegativeFilter < MIN_PRIMARY_POOL_SIZE
    });
    return {
      ...toRecommendationCandidate(rescored, options.source || 'cloud', experimentId),
      candidatePoolStats: poolStats
    };
  });

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source: options.source || 'cloud',
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
    candidates,
    selectedCandidateId: candidates[0] && candidates[0].id,
    reasonSummary: candidates[0] && `${candidates[0].name} 匹配度 ${candidates[0].confidenceScore || 0}%，${candidates[0].reason}`,
    fallbackReason,
    candidatePoolStats: poolStats
  };
}

function scoreRestaurant(restaurant, preference, options = {}) {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = getPreferredTagIds(preference);
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const matchedPreferredTagIds = intersect(tagIds, preferredTagIds);
  const matchedAvoidedTagIds = [...new Set([...intersect(tagIds, getAvoidedTagIds(preference)), ...negativeConflict.tags])];
  const baseScore = 32;
  const preferenceScore = Math.min(34, matchedPreferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0));
  const negativePreferencePenalty = negativeConflict.severity === 'hard' ? 88 : negativeConflict.severity === 'soft' ? Math.min(45, 22 + negativeConflict.tags.length * 7) : 0;
  const distanceScore = getDistanceScore(restaurant, preference, options.fallbackReason !== undefined);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = restaurant.openStatus === 'open' ? 6 : restaurant.openStatus === 'busy' ? 1 : 0;
  const dataCompletenessScore = getDataCompletenessScore(restaurant);
  const finalScore = clamp(baseScore + preferenceScore - negativePreferencePenalty + distanceScore + priceScore + timeScore + ratingScore + openStatusScore + dataCompletenessScore, 0, 100);
  const hardConstraintScore = getHardConstraintConfidence(restaurant, preference, options.fallbackReason);
  const positivePreferenceScore = getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds);
  const negativeAvoidanceScore = negativeConflict.severity === 'hard' ? 0 : negativeConflict.severity === 'soft' ? 8 : 25;
  const relativeLeadScore = options.relativeLeadScore || 0;
  const confidenceScore = calculateConfidenceScore({
    hardConstraintScore,
    positivePreferenceScore,
    negativeAvoidanceScore,
    dataCompletenessScore,
    relativeLeadScore,
    negativeConflict,
    fallbackUsed: options.fallbackReason !== undefined,
    candidatePoolWeak: options.candidatePoolWeak || false
  });

  return {
    restaurant,
    score: finalScore,
    confidenceScore,
    confidenceLabel: confidenceScore >= 76 ? 'high' : confidenceScore >= 55 ? 'medium' : 'low',
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
    hardFilterReasons: applyHardFilters(restaurant, preference, new Set(), true, true).reasons,
    penaltyReasons: buildPenaltyReasons(restaurant, negativeConflict, preference, options.fallbackReason),
    matchedPreferredTagIds,
    matchedAvoidedTagIds,
    fallbackReason: options.fallbackReason
  };
}

function applyHardFilters(restaurant, preference, excludeRestaurantIds, allowDistanceFallback, allowNegativeFallback) {
  const reasons = [];
  const negativeConflict = getNegativeConflict(restaurant, preference);

  if (restaurant.status !== 'active') reasons.push('餐厅不可用');
  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') reasons.push('当前不在营业');
  if (excludeRestaurantIds.has(restaurant.id)) reasons.push('近期已推荐过');
  if (!allowDistanceFallback && preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters > preference.maxDistanceMeters) {
    reasons.push(`距离 ${restaurant.distanceMeters} 米，超出 ${preference.maxDistanceMeters} 米偏好`);
  }
  if (isClearlyOverBudget(restaurant, preference)) reasons.push('价格明显超出预算');
  if (preference && preference.maxEstimatedMinutes !== undefined && estimateMinutes(restaurant) > preference.maxEstimatedMinutes + 20) reasons.push('预计耗时明显超出偏好');
  if (!allowNegativeFallback && negativeConflict.severity === 'hard') reasons.push(`命中明确负向偏好：${negativeConflict.labels.join('、')}`);

  return { passed: reasons.length === 0, reasons };
}

function rankWithLightRandom(scored) {
  const nonConflict = scored.filter((item) => item.matchedAvoidedTagIds.length === 0).sort(compareScoredRestaurants);
  const conflict = scored.filter((item) => item.matchedAvoidedTagIds.length > 0).sort(compareScoredRestaurants);
  return [...nonConflict, ...conflict];
}

function compareScoredRestaurants(left, right) {
  return (
    right.score - left.score ||
    right.confidenceScore - left.confidenceScore ||
    right.breakdown.preferenceScore - left.breakdown.preferenceScore ||
    right.breakdown.distanceScore - left.breakdown.distanceScore
  );
}

function toRecommendationCandidate(scored, source, experimentId) {
  const restaurant = scored.restaurant;
  return {
    id: `candidate-${restaurant.id}`,
    restaurantId: restaurant.id,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      tags: restaurant.tags || [],
      distanceMeters: restaurant.distanceMeters,
      averageCostYuan: restaurant.averageCostYuan,
      openStatus: restaurant.openStatus,
      rating: restaurant.rating
    },
    name: restaurant.name,
    mealName: (restaurant.signatureDishes && restaurant.signatureDishes[0]) || restaurant.name,
    tags: restaurant.tags || [],
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

function buildReasons(restaurant, matchedPreferredTagIds, negativeConflict, preference, fallbackReason) {
  const reasons = [];
  if (matchedPreferredTagIds.length > 0) reasons.push(`匹配 ${matchedPreferredTagIds.slice(0, 3).join('、')} 等偏好`);
  if (preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters <= preference.maxDistanceMeters) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米，在你的范围内`);
  } else if (restaurant.distanceMeters !== undefined) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }
  if (preference && preference.budgetLevel !== undefined && restaurant.averageCostYuan !== undefined) {
    const budgetMax = getBudgetMaxYuan(preference);
    reasons.push(restaurant.averageCostYuan <= budgetMax ? `人均约 ${restaurant.averageCostYuan} 元，符合预算` : `人均约 ${restaurant.averageCostYuan} 元，略高于预算`);
  }
  if (restaurant.openStatus === 'open') reasons.push('当前营业中');
  if (negativeConflict.severity !== 'none') reasons.push(`含负向偏好 ${negativeConflict.labels.join('、')}，已明显降权`);
  if (fallbackReason) reasons.push(fallbackReason);
  return reasons.length > 0 ? reasons.slice(0, 5) : ['综合距离、价格和口味后较适合今天'];
}

function buildPenaltyReasons(restaurant, negativeConflict, preference, fallbackReason) {
  const reasons = [];
  if (negativeConflict.severity !== 'none') reasons.push(`负向偏好冲突：${negativeConflict.labels.join('、')}`);
  if (preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters > preference.maxDistanceMeters) reasons.push(`超出距离偏好 ${restaurant.distanceMeters - preference.maxDistanceMeters} 米`);
  if (isOverBudget(restaurant, preference)) reasons.push('超出预算偏好');
  if (fallbackReason) reasons.push(fallbackReason);
  return reasons;
}

function getPreferredTagIds(preference) {
  return [...new Set([...(preference && preference.preferredTagIds ? preference.preferredTagIds : []), ...(preference && preference.positiveTags ? preference.positiveTags : [])])];
}

function getAvoidedTagIds(preference) {
  const avoided = new Set([...(preference && preference.avoidedTagIds ? preference.avoidedTagIds : []), ...(preference && preference.negativeTags ? preference.negativeTags : [])]);
  if (avoided.has('spicy')) SPICY_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (avoided.has('strong_flavor')) LIGHT_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) GREASY_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  return [...avoided];
}

function getNegativeConflict(restaurant, preference) {
  const avoided = new Set(getAvoidedTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantText(restaurant);
  const tags = new Set();
  const labels = new Set();
  let severity = 'none';
  const explicitNoSpicy = avoided.has('spicy');

  tagIds.forEach((tagId) => {
    if (avoided.has(tagId)) {
      tags.add(tagId);
      labels.add(tagId);
      severity = explicitNoSpicy && SPICY_CONFLICT_TAGS.includes(tagId) ? 'hard' : 'soft';
    }
  });

  if (explicitNoSpicy && SPICY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    tags.add('spicy');
    labels.add('辣/麻辣/川湘相关');
    severity = 'hard';
  }

  if ((avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) && GREASY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    GREASY_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('油腻/油炸/烧烤相关');
    severity = severity === 'hard' ? 'hard' : 'soft';
  }

  return { severity, tags: [...tags], labels: [...labels] };
}

function getRestaurantTagIds(restaurant) {
  return restaurant.tagIds || (restaurant.tagRefs || []).map((tag) => tag.id) || restaurant.tags || [];
}

function getRestaurantText(restaurant) {
  return [restaurant.name, restaurant.category, restaurant.description, ...(restaurant.tags || []), ...(restaurant.signatureDishes || [])].filter(Boolean).join(' ').toLowerCase();
}

function intersect(left, right) {
  const rightSet = new Set(right);
  return [...new Set((left || []).filter((item) => rightSet.has(item)))];
}

function getDistanceScore(restaurant, preference, fallbackUsed) {
  if (restaurant.distanceMeters === undefined) return 0;
  const maxDistance = (preference && preference.maxDistanceMeters) || 1500;
  const ratio = restaurant.distanceMeters / maxDistance;
  if (ratio <= 0.5) return fallbackUsed ? 10 : 18;
  if (ratio <= 1) return fallbackUsed ? 5 : 12;
  if (ratio <= 1.5) return -12;
  return -24;
}

function getPriceScore(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return 0;
  if (restaurant.averageCostYuan === undefined && restaurant.priceLevel === undefined) return 0;
  const budgetMax = getBudgetMaxYuan(preference);
  const estimatedCost = restaurant.averageCostYuan === undefined ? getPriceLevelCost(restaurant.priceLevel) : restaurant.averageCostYuan;
  if (estimatedCost <= budgetMax) return 12;
  if (estimatedCost <= budgetMax * 1.2) return -10;
  return -28;
}

function getTimeScore(restaurant, preference) {
  const minutes = estimateMinutes(restaurant);
  const maxMinutes = (preference && preference.maxEstimatedMinutes) || 45;
  if (minutes <= Math.min(25, maxMinutes)) return 8;
  if (minutes <= maxMinutes) return 4;
  return -8;
}

function getRatingScore(restaurant) {
  if (restaurant.rating === undefined) return 0;
  return clamp((restaurant.rating - 3.6) * 6, 0, 8);
}

function getDataCompletenessScore(restaurant) {
  const checks = [
    restaurant.distanceMeters !== undefined,
    restaurant.averageCostYuan !== undefined || restaurant.priceLevel !== undefined,
    restaurant.rating !== undefined,
    restaurant.openStatus !== undefined && restaurant.openStatus !== 'unknown',
    getRestaurantTagIds(restaurant).length > 0
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 10);
}

function getHardConstraintConfidence(restaurant, preference, fallbackReason) {
  let score = 0;
  if (restaurant.openStatus === 'open' || restaurant.openStatus === 'busy' || restaurant.openStatus === 'unknown') score += 10;
  if (!preference || preference.maxDistanceMeters === undefined || restaurant.distanceMeters === undefined || restaurant.distanceMeters <= preference.maxDistanceMeters) score += 10;
  else score += fallbackReason ? 3 : 0;
  if (!isOverBudget(restaurant, preference)) score += 10;
  else if (!isClearlyOverBudget(restaurant, preference)) score += 3;
  return score;
}

function getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds) {
  if (preferredTagIds.length === 0) return 12;
  const preferredWeight = preferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0);
  const matchedWeight = matchedPreferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0);
  return Math.round(clamp((matchedWeight / Math.max(1, preferredWeight)) * 25, 0, 25));
}

function getRelativeLeadScore(ranked, index) {
  if (index !== 0 || ranked.length < 2) return 3;
  return Math.round(clamp((ranked[0].score - ranked[1].score) / 3, 2, 10));
}

function calculateConfidenceScore(input) {
  let score = input.hardConstraintScore + input.positivePreferenceScore + input.negativeAvoidanceScore + input.dataCompletenessScore + input.relativeLeadScore;
  if (input.negativeConflict.severity === 'hard') score = Math.min(score, 42);
  else if (input.negativeConflict.severity === 'soft') score = Math.min(score, 58);
  if (input.fallbackUsed) score = Math.min(score - 8, 70);
  if (input.candidatePoolWeak) score = Math.min(score, 72);
  return Math.round(clamp(score, 0, 95));
}

function isOverBudget(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return false;
  const estimatedCost = restaurant.averageCostYuan === undefined ? getPriceLevelCost(restaurant.priceLevel) : restaurant.averageCostYuan;
  return estimatedCost > getBudgetMaxYuan(preference);
}

function isClearlyOverBudget(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return false;
  const estimatedCost = restaurant.averageCostYuan === undefined ? getPriceLevelCost(restaurant.priceLevel) : restaurant.averageCostYuan;
  return estimatedCost > getBudgetMaxYuan(preference) * 1.45;
}

function getBudgetMaxYuan(preference) {
  return BUDGET_LEVEL_TO_YUAN[preference.budgetLevel || 3] || 60;
}

function getPriceLevelCost(priceLevel) {
  return BUDGET_LEVEL_TO_YUAN[priceLevel] || 60;
}

function estimateMinutes(restaurant) {
  const distanceMinutes = restaurant.distanceMeters === undefined ? 8 : Math.ceil(restaurant.distanceMeters / 120);
  const diningMinutes = restaurant.category === 'Brunch' ? 35 : 20;
  const busyMinutes = restaurant.openStatus === 'busy' ? 10 : 0;
  return distanceMinutes + diningMinutes + busyMinutes;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
