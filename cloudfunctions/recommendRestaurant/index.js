const cloud = initCloudSdk();

const DEFAULT_LIMIT = 3;
const MAX_SCORE = 100;
const MIN_SCORE = 0;
const DEFAULT_PREFERENCE = {
  selectedOptionIds: ['quick', 'light'],
  preferredTagIds: ['quick', 'hot', 'light', 'comfort'],
  avoidedTagIds: ['strong_flavor'],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 40
};

const mockRestaurants = [
  {
    id: 'r-lan-zhou-noodles',
    name: '兰州牛肉面小馆',
    tags: ['热乎', '主食', '面食', '快餐', '牛肉'],
    tagIds: ['hot', 'staple', 'noodle', 'quick', 'beef'],
    description: '出餐快，汤面稳定，适合没太多时间但想吃口热的。',
    category: '面馆',
    address: '人民路 18 号',
    distanceMeters: 420,
    priceLevel: 2,
    averageCostYuan: 28,
    openStatus: 'open',
    signatureDishes: ['招牌牛肉面', '凉拌牛肉'],
    rating: 4.5,
    status: 'active'
  },
  {
    id: 'r-hunan-rice',
    name: '湘味小炒饭堂',
    tags: ['下饭', '辣', '米饭', '多人', '重口味'],
    tagIds: ['rice', 'spicy', 'stir_fry', 'group', 'strong_flavor'],
    description: '锅气足，菜量大，适合想吃得热闹一点的时候。',
    category: '湘菜',
    address: '学院街 6 号',
    distanceMeters: 900,
    priceLevel: 3,
    averageCostYuan: 54,
    openStatus: 'busy',
    signatureDishes: ['小炒黄牛肉', '辣椒炒肉'],
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'r-light-salad',
    name: '轻食研究所',
    tags: ['清淡', '健康', '沙拉', '低负担', '素食友好'],
    tagIds: ['light', 'healthy', 'salad', 'low_burden', 'vegetarian'],
    description: '口味清爽，热量压力小，适合想吃轻一点的午餐。',
    category: '轻食',
    address: '绿地广场 B1',
    distanceMeters: 650,
    priceLevel: 3,
    averageCostYuan: 42,
    openStatus: 'open',
    signatureDishes: ['鸡胸藜麦碗', '牛油果沙拉'],
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'r-cantonese-congee',
    name: '广式粥粉面',
    tags: ['清淡', '热乎', '粥粉面', '暖胃', '快餐'],
    tagIds: ['light', 'hot', 'congee', 'comfort', 'quick'],
    description: '粥和汤粉都比较稳，胃口一般时也容易接受。',
    category: '粥式简餐',
    address: '和平巷 12 号',
    distanceMeters: 300,
    priceLevel: 2,
    averageCostYuan: 32,
    openStatus: 'open',
    signatureDishes: ['皮蛋瘦肉粥', '云吞面'],
    rating: 4.4,
    status: 'active'
  },
  {
    id: 'r-japanese-curry',
    name: '日式咖喱屋',
    tags: ['咖喱', '米饭', '不辣', '一人食', '稳定'],
    tagIds: ['curry', 'rice', 'not_spicy', 'solo', 'stable'],
    description: '味道稳定，选择成本低，适合想快速定下来的一餐。',
    category: '日式简餐',
    address: '银杏路 88 号',
    distanceMeters: 1200,
    priceLevel: 3,
    averageCostYuan: 48,
    openStatus: 'open',
    signatureDishes: ['炸猪排咖喱饭', '芝士咖喱蛋包饭'],
    rating: 4.3,
    status: 'active'
  },
  {
    id: 'r-hotpot-small',
    name: '小锅麻辣烫',
    tags: ['辣', '热乎', '自选', '蔬菜', '重口味'],
    tagIds: ['spicy', 'hot', 'customizable', 'vegetable', 'strong_flavor'],
    description: '可自选菜品，想吃蔬菜和热汤时比较灵活。',
    category: '麻辣烫',
    address: '建设路 21 号',
    distanceMeters: 760,
    priceLevel: 2,
    averageCostYuan: 35,
    openStatus: 'open',
    signatureDishes: ['番茄麻辣烫', '骨汤麻辣烫'],
    rating: 4.1,
    status: 'active'
  },
  {
    id: 'r-western-brunch',
    name: '街角早午餐',
    tags: ['西式', '轻松', '咖啡', '慢吃', '不辣'],
    tagIds: ['western', 'relaxed', 'coffee', 'slow', 'not_spicy'],
    description: '环境安静，适合不赶时间、想坐一会儿。',
    category: 'Brunch',
    address: '梧桐街 9 号',
    distanceMeters: 1800,
    priceLevel: 4,
    averageCostYuan: 78,
    openStatus: 'open',
    signatureDishes: ['班尼迪克蛋', '烟熏三文鱼贝果'],
    rating: 4.7,
    status: 'active'
  },
  {
    id: 'r-closed-bbq',
    name: '夜宵烧烤铺',
    tags: ['烧烤', '夜宵', '重口味', '多人'],
    tagIds: ['bbq', 'late_night', 'strong_flavor', 'group'],
    description: '夜里更合适，白天通常不营业。',
    category: '烧烤',
    address: '河边路 3 号',
    distanceMeters: 500,
    priceLevel: 3,
    averageCostYuan: 65,
    openStatus: 'closed',
    signatureDishes: ['烤牛油', '烤茄子'],
    rating: 4.5,
    status: 'active'
  }
];

exports.main = async (event = {}, cloudContext = {}) => {
  const requestId = createRequestId();

  try {
    const context = event.context || {};
    const answers = getAnswers(event, context);
    const preferenceSnapshot =
      context.preferenceSnapshot || buildPreferenceProfile(answers);
    const result = recommendRestaurants({
      restaurants: mockRestaurants,
      context: {
        preferenceSnapshot,
        excludeRestaurantIds: context.excludeRestaurantIds || []
      },
      limit: normalizeLimit(event.limit),
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
    sdk.init({
      env: sdk.DYNAMIC_CURRENT_ENV
    });
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
  if (Array.isArray(event.questionnaire?.answers)) {
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
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;
  let peopleCount = DEFAULT_PREFERENCE.peopleCount;

  answers.forEach((answer) => {
    if (answer.questionId === 'flavor') {
      if (answer.value === 'spicy') {
        preferredTagIds.add('spicy');
        preferredTagIds.add('strong_flavor');
        avoidedTagIds.delete('strong_flavor');
      }

      if (answer.value === 'light') {
        preferredTagIds.add('light');
        preferredTagIds.add('healthy');
        avoidedTagIds.add('strong_flavor');
      }
    }

    if (answer.questionId === 'staple' && typeof answer.value === 'string') {
      preferredTagIds.add(answer.value);
    }

    if (answer.questionId === 'speed' && typeof answer.value === 'number') {
      maxEstimatedMinutes = answer.value;
      preferredTagIds.add('quick');
    }

    if (answer.questionId === 'budget') {
      budgetLevel = answer.value === 'low' ? 2 : answer.value === 'high' ? 4 : 3;
    }

    if (answer.questionId === 'people' && typeof answer.value === 'number') {
      peopleCount = answer.value;

      if (answer.value >= 3) {
        preferredTagIds.add('group');
      } else {
        preferredTagIds.add('solo');
      }
    }

    if (answer.questionId === 'scene' && typeof answer.value === 'string') {
      const sceneTagMap = {
        fast: ['quick'],
        comfort: ['comfort', 'relaxed'],
        healthy: ['healthy', 'light', 'low_burden']
      };

      (sceneTagMap[answer.value] || []).forEach((tagId) => preferredTagIds.add(tagId));
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters: DEFAULT_PREFERENCE.maxDistanceMeters,
    maxEstimatedMinutes,
    peopleCount
  };
}

function recommendRestaurants(options) {
  const now = options.now || new Date();
  const limit = options.limit || DEFAULT_LIMIT;
  const preference = options.context?.preferenceSnapshot;
  const excludeRestaurantIds = new Set(options.context?.excludeRestaurantIds || []);
  const scored = options.restaurants
    .filter((restaurant) => applyHardFilters(restaurant, preference, excludeRestaurantIds).passed)
    .map((restaurant) => scoreRestaurant(restaurant, preference));
  const candidates = rankWithLightRandom(scored)
    .slice(0, limit)
    .map(toRecommendationCandidate);

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source: 'cloud',
    candidates,
    selectedCandidateId: candidates[0]?.id,
    reasonSummary: buildReasonSummary(candidates[0])
  };
}

function scoreRestaurant(restaurant, preference) {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = preference?.preferredTagIds || [];
  const avoidedTagIds = preference?.avoidedTagIds || [];
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

function applyHardFilters(restaurant, preference, excludeRestaurantIds) {
  const reasons = [];

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

function rankWithLightRandom(scored) {
  const sorted = [...scored].sort((left, right) => right.score - left.score);
  const topThree = sorted.slice(0, 3);

  if (topThree.length <= 1) {
    return sorted;
  }

  const totalWeight = topThree.reduce((sum, item, index) => {
    return sum + Math.max(1, item.score) * (1 - index * 0.18);
  }, 0);
  let cursor = Math.random() * totalWeight;
  const selectedIndex = topThree.findIndex((item, index) => {
    cursor -= Math.max(1, item.score) * (1 - index * 0.18);
    return cursor <= 0;
  });
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selected = topThree[safeIndex];
  const remaining = sorted.filter((item) => item.restaurant.id !== selected.restaurant.id);

  return [selected, ...remaining];
}

function toRecommendationCandidate(scored) {
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
      openStatus: restaurant.openStatus
    },
    name: restaurant.name,
    mealName: restaurant.signatureDishes?.[0] || restaurant.name,
    tags: restaurant.tags,
    reason: scored.reasons.join('，'),
    estimatedMinutes: estimateMinutes(restaurant),
    score: scored.score,
    confidenceScore: scored.confidenceScore,
    confidenceLabel: scored.confidenceLabel,
    scoreBreakdown: scored.breakdown,
    matchedTagIds: scored.breakdown.matchedPreferredTagIds,
    imageUrl: restaurant.coverImageUrl
  };
}

function buildReasonSummary(candidate) {
  if (!candidate) {
    return undefined;
  }

  return `${candidate.name} 匹配度 ${candidate.confidenceScore || 0}%，${candidate.reason}`;
}

function buildReasons(restaurant, matchedPreferredTagIds, matchedAvoidedTagIds, preference) {
  const reasons = [];

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
    reasons.push(restaurant.description || '综合距离、价格和口味后较适合今天');
  }

  return reasons.slice(0, 4);
}

function getRestaurantTagIds(restaurant) {
  return restaurant.tagIds || restaurant.tagRefs?.map((tag) => tag.id) || restaurant.tags;
}

function intersect(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function getDistanceScore(restaurant, preference) {
  if (restaurant.distanceMeters === undefined) {
    return 4;
  }

  const maxDistance = preference?.maxDistanceMeters || 2000;
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

function getPriceScore(restaurant, preference) {
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

function getTimeScore(restaurant, preference) {
  const minutes = estimateMinutes(restaurant);
  const maxMinutes = preference?.maxEstimatedMinutes || 45;

  if (minutes <= Math.min(25, maxMinutes)) {
    return 8;
  }

  if (minutes <= maxMinutes) {
    return 4;
  }

  return -6;
}

function getRatingScore(restaurant) {
  if (restaurant.rating === undefined) {
    return 3;
  }

  return clamp((restaurant.rating - 3.5) * 8, 0, 10);
}

function getOpenStatusScore(restaurant) {
  if (restaurant.openStatus === 'open') {
    return 6;
  }

  if (restaurant.openStatus === 'busy') {
    return 1;
  }

  return 0;
}

function calculateConfidenceScore(score, matchedPreferredCount) {
  const preferenceBoost = Math.min(8, matchedPreferredCount * 2);
  return Math.round(clamp(score + preferenceBoost, 0, 98));
}

function getConfidenceLabel(score) {
  if (score >= 78) {
    return 'high';
  }

  if (score >= 58) {
    return 'medium';
  }

  return 'low';
}

function estimateMinutes(restaurant) {
  const distanceMinutes =
    restaurant.distanceMeters === undefined ? 8 : Math.ceil(restaurant.distanceMeters / 120);
  const diningMinutes = restaurant.category === 'Brunch' ? 35 : 20;
  const busyMinutes = restaurant.openStatus === 'busy' ? 10 : 0;

  return distanceMinutes + diningMinutes + busyMinutes;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
