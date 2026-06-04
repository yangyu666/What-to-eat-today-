const {
  getRecentHistoryFilterContext,
  trackRecommendationAction
} = require('../../services/historyService');

const MAX_SWITCH_COUNT = 3;
const CLOUD_ENV_ID = 'cloud1-d7g5ft07k29226d0e';
const AMAP_POI_FUNCTION_NAME = 'amapPoi';
const AMAP_SEARCH_ATTEMPTS = [
  { radiusMeters: 3000, keyword: '' },
  { radiusMeters: 5000, keyword: '' }
];
const MILK_TEA_SEARCH_ATTEMPTS = [
  { radiusMeters: 3000, keyword: '奶茶|茶饮|霸王茶姬|喜茶|奈雪|一点点' },
  { radiusMeters: 5000, keyword: '奶茶|茶饮|霸王茶姬|喜茶|奈雪|一点点' }
];
const COFFEE_SEARCH_ATTEMPTS = [
  { radiusMeters: 3000, keyword: '咖啡|cafe|coffee|下午茶' },
  { radiusMeters: 5000, keyword: '咖啡|cafe|coffee|下午茶' }
];
const DESSERT_SEARCH_ATTEMPTS = [
  { radiusMeters: 3000, keyword: '甜品|蛋糕|面包|烘焙|西点' },
  { radiusMeters: 5000, keyword: '甜品|蛋糕|面包|烘焙|西点' }
];
const PREMIUM_AMAP_SEARCH_ATTEMPTS = [
  { radiusMeters: 3000, keyword: '高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑' },
  { radiusMeters: 5000, keyword: '高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑' },
  { radiusMeters: 10000, keyword: '高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑' }
];
const TAG_LABEL_MAP = {
  coffee: '咖啡',
  relaxed: '放松',
  slow: '慢节奏',
  quick: '出餐快',
  light: '清淡',
  healthy: '健康',
  hot: '热乎',
  comfort: '暖胃',
  rice: '米饭',
  noodle: '面食',
  staple: '主食',
  spicy: '辣味',
  strong_flavor: '重口味',
  not_spicy: '不辣',
  salad: '沙拉',
  low_burden: '低负担',
  vegetarian: '素食友好',
  solo: '一人食',
  group: '多人',
  snack: '小吃',
  dessert: '甜品',
  milk_tea: '奶茶',
  drink: '饮品',
  afternoon_tea: '下午茶'
};

let cloudInitialized = false;

Page({
  data: {
    candidates: [],
    currentIndex: 0,
    recommendation: null,
    answerCount: 0,
    loading: false,
    switchCount: 0,
    maxSwitchCount: MAX_SWITCH_COUNT,
    locked: false,
    accepted: false,
    matchPercent: 0,
    distanceText: '',
    averageCostText: '',
    walkText: '',
    ratingText: '',
    mealNameText: '',
    coverImageUrl: '',
    errorText: '',
    reasonItems: [],
    historyFilterEnabled: true,
    excludedHistoryRestaurantIds: [],
    historyPenaltyReasons: [],
    switchButtonText: '换一家'
  },

  onLoad() {
    const result = wx.getStorageSync('meal_questionnaire_result');

    this.setData({
      answerCount: result && result.answers ? result.answers.length : 0
    });

    this.loadRecommendation(result);
  },

  async loadRecommendation(result) {
    this.setData({ loading: true, errorText: '' });

    try {
      const historyFilterContext = getRecentHistoryFilterContext();
      const candidates = await getRecommendations(result, historyFilterContext);

      if (candidates.length === 0) {
        this.setCurrentRecommendation([], 0, {
          loading: false,
          switchCount: 0,
          locked: false,
          accepted: false,
          historyFilterEnabled: historyFilterContext.historyFilterEnabled,
          excludedHistoryRestaurantIds: historyFilterContext.excludedHistoryRestaurantIds,
          historyPenaltyReasons: historyFilterContext.historyPenaltyReasons,
          errorText: '推荐加载失败，请稍后重试'
        });
        return;
      }

      this.setCurrentRecommendation(candidates, 0, {
        loading: false,
        switchCount: 0,
        locked: false,
        accepted: false,
        historyFilterEnabled: historyFilterContext.historyFilterEnabled,
        excludedHistoryRestaurantIds: historyFilterContext.excludedHistoryRestaurantIds,
        historyPenaltyReasons: historyFilterContext.historyPenaltyReasons,
        switchButtonText: '换一家'
      });
      this.trackCurrentRecommendation('shown', candidates[0], 0, result);
    } catch (error) {
      console.error('Failed to load recommendation.', error);
      this.setData({
        loading: false,
        candidates: [],
        recommendation: null,
        errorText: '推荐加载失败，请稍后重试'
      });
      wx.showToast({
        title: '推荐加载失败',
        icon: 'none'
      });
    }
  },

  switchRestaurant() {
    if (this.data.locked || this.data.accepted || this.data.candidates.length === 0) {
      return;
    }

    const nextSwitchCount = this.data.switchCount + 1;

    if (nextSwitchCount > MAX_SWITCH_COUNT) {
      this.setData({
        locked: true,
        switchButtonText: '已锁定'
      });
      wx.showToast({
        title: '结果已锁定',
        icon: 'none'
      });
      return;
    }

    const nextIndex = (this.data.currentIndex + 1) % this.data.candidates.length;
    this.trackCurrentRecommendation(
      'skipped',
      this.data.recommendation,
      nextSwitchCount,
      this.getQuestionnaireResult()
    );
    this.setCurrentRecommendation(this.data.candidates, nextIndex, {
      switchCount: nextSwitchCount,
      locked: nextSwitchCount >= MAX_SWITCH_COUNT,
      switchButtonText: nextSwitchCount >= MAX_SWITCH_COUNT ? '已锁定' : '换一家'
    });

    if (nextSwitchCount >= MAX_SWITCH_COUNT) {
      wx.showToast({
        title: '已自动锁定',
        icon: 'none'
      });
    }
  },

  acceptRestaurant() {
    if (!this.data.recommendation) {
      return;
    }

    this.setData({
      accepted: true,
      locked: true
    });

    this.trackCurrentRecommendation(
      'accepted',
      this.data.recommendation,
      this.data.switchCount,
      this.getQuestionnaireResult()
    );

    wx.showToast({
      title: '就吃这家',
      icon: 'success'
    });
  },

  reloadRecommendation() {
    this.loadRecommendation(this.getQuestionnaireResult());
  },

  navigateToRestaurant() {
    const recommendation = this.data.recommendation;
    const restaurant = recommendation && recommendation.restaurant;
    const location = restaurant && restaurant.location;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      wx.showToast({
        title: '暂无门店位置',
        icon: 'none'
      });
      return;
    }

    wx.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: (restaurant && restaurant.name) || (recommendation && recommendation.name) || '推荐门店',
      address: (restaurant && restaurant.address) || '',
      scale: 16
    });
  },

  setCurrentRecommendation(candidates, currentIndex, extraData = {}) {
    const recommendation = candidates[currentIndex] || null;
    const restaurant = recommendation && recommendation.restaurant;
    const distanceMeters = restaurant && restaurant.distanceMeters;
    const averageCostYuan = restaurant && restaurant.averageCostYuan;
    const walkingMinutes =
      typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : null;
    const rating = restaurant && restaurant.rating;

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore || 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥ ${averageCostYuan}/人` : '人均未知',
      walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
      ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分未知',
      mealNameText: recommendation ? recommendation.mealName || recommendation.name || '' : '',
      coverImageUrl: getStableCoverImageUrl(recommendation),
      reasonItems: recommendation ? buildReasonItems(recommendation, walkingMinutes, averageCostYuan) : [],
      ...extraData
    });
  },

  trackCurrentRecommendation(action, candidate, switchCount, questionnaire) {
    if (!candidate) {
      return;
    }

    trackRecommendationAction({
      action,
      candidate,
      questionnaire,
      switchCount
    }).catch((error) => {
      console.warn('Recommendation tracking failed.', error);
    });
  },

  getQuestionnaireResult() {
    return wx.getStorageSync('meal_questionnaire_result');
  },

  handleCoverImageError() {
    this.setData({
      coverImageUrl: ''
    });
  }
});

async function getRecommendations(questionnaire, historyFilterContext = getRecentHistoryFilterContext()) {
  ensureCloudInitialized();
  const historyFilterEnabled = historyFilterContext.historyFilterEnabled === true;
  const restaurants = await getNearbyAmapRestaurants(questionnaire);

  if (restaurants.length === 0) {
    throw new Error('No real nearby restaurant candidates available from AMap.');
  }

  const response = await wx.cloud.callFunction({
    name: 'recommendRestaurant',
    data: {
      questionnaire,
      limit: 4,
      restaurants,
      context: {
        experimentId: 'default',
        excludeRestaurantIds: historyFilterEnabled
          ? historyFilterContext.excludedHistoryRestaurantIds
          : [],
        historyFilterEnabled,
        excludedHistoryRestaurantIds: historyFilterEnabled
          ? historyFilterContext.excludedHistoryRestaurantIds
          : [],
        historyPenaltyRestaurantIds: historyFilterEnabled
          ? historyFilterContext.historyPenaltyRestaurantIds
          : [],
        historyPenaltyReasons: historyFilterEnabled
          ? historyFilterContext.historyPenaltyReasons
          : []
      }
    }
  });
  const payload = response && response.result;

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error.message : 'Cloud recommendation failed.');
  }

  const recommendation = payload.data && payload.data.recommendation;
  const candidates = recommendation && Array.isArray(recommendation.candidates)
    ? recommendation.candidates
    : [];

  return candidates.map((candidate) => ({
    ...candidate,
    source: candidate.source || (recommendation && recommendation.source) || 'cloud',
    candidatePoolStats: candidate.candidatePoolStats || (recommendation && recommendation.candidatePoolStats),
    historyFilterEnabled:
      candidate.historyFilterEnabled ?? (recommendation && recommendation.historyFilterEnabled) ?? historyFilterEnabled,
    excludedHistoryRestaurantIds:
      candidate.excludedHistoryRestaurantIds ??
      (recommendation && recommendation.excludedHistoryRestaurantIds) ??
      historyFilterContext.excludedHistoryRestaurantIds,
    historyPenaltyReasons:
      candidate.historyPenaltyReasons ??
      (recommendation && recommendation.historyPenaltyReasons) ??
      historyFilterContext.historyPenaltyReasons
  }));
}

async function getNearbyAmapRestaurants(questionnaire) {
  const location = await getUserLocation();
  const attempts = getAmapSearchAttempts(questionnaire);

  for (const attempt of attempts) {
    const response = await wx.cloud.callFunction({
      name: AMAP_POI_FUNCTION_NAME,
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: attempt.radiusMeters,
        pageSize: 25,
        keyword: attempt.keyword,
        types: '050000'
      }
    });
    const payload = response && response.result;
    const restaurants =
      payload &&
      payload.ok &&
      payload.data &&
      Array.isArray(payload.data.restaurants)
        ? payload.data.restaurants
        : [];

    if (restaurants.length > 0) {
      return restaurants;
    }
  }

  return [];
}

function getAmapSearchAttempts(questionnaire) {
  const optionIds = getQuestionnaireOptionIds(questionnaire);
  const allowsWideDistance = optionIds.has('distance_any');

  if (optionIds.has('prefer_milk_tea') || optionIds.has('intent_drink')) {
    return expandSearchAttemptsForDistance(MILK_TEA_SEARCH_ATTEMPTS, allowsWideDistance);
  }

  if (optionIds.has('prefer_coffee')) {
    return expandSearchAttemptsForDistance(COFFEE_SEARCH_ATTEMPTS, allowsWideDistance);
  }

  if (optionIds.has('prefer_bakery_dessert') || optionIds.has('intent_dessert')) {
    return expandSearchAttemptsForDistance(DESSERT_SEARCH_ATTEMPTS, allowsWideDistance);
  }

  if (optionIds.has('budget_over_200')) {
    return PREMIUM_AMAP_SEARCH_ATTEMPTS;
  }

  return expandSearchAttemptsForDistance(AMAP_SEARCH_ATTEMPTS, allowsWideDistance);
}

function expandSearchAttemptsForDistance(attempts, allowsWideDistance) {
  if (!allowsWideDistance) {
    return attempts;
  }

  const lastAttempt = attempts[attempts.length - 1];
  const wideAttempt = {
    radiusMeters: 10000,
    keyword: lastAttempt ? lastAttempt.keyword : ''
  };

  return [...attempts, wideAttempt].filter((attempt, index, allAttempts) => {
    return allAttempts.findIndex((item) => {
      return item.radiusMeters === attempt.radiusMeters && item.keyword === attempt.keyword;
    }) === index;
  });
}

function getQuestionnaireOptionIds(questionnaire) {
  const answers = questionnaire && Array.isArray(questionnaire.answers) ? questionnaire.answers : [];
  const optionIds = new Set();

  answers.forEach((answer) => {
    if (Array.isArray(answer.optionIds)) {
      answer.optionIds.forEach((optionId) => optionIds.add(optionId));
    }
  });

  return optionIds;
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (result) => {
        resolve({
          latitude: result.latitude,
          longitude: result.longitude
        });
      },
      fail: reject
    });
  });
}

function ensureCloudInitialized() {
  if (!wx.cloud) {
    throw new Error('当前基础库不支持云开发');
  }

  if (cloudInitialized) {
    return;
  }

  wx.cloud.init({
    env: CLOUD_ENV_ID,
    traceUser: true
  });
  cloudInitialized = true;
}

function buildReasonItems(recommendation, walkingMinutes, averageCostYuan) {
  const preferenceLabels = getPreferenceLabels(recommendation);
  const distanceMeters = recommendation.restaurant && recommendation.restaurant.distanceMeters;
  const items = [
    {
      title: preferenceLabels.length > 0
        ? `匹配${preferenceLabels.join('、')}偏好`
        : '匹配今天的口味偏好',
      desc: '符合你今天的口味倾向'
    },
    {
      title: typeof distanceMeters === 'number'
        ? `距离约 ${distanceMeters} 米，在你的范围内`
        : walkingMinutes
          ? `步行${walkingMinutes}分钟`
          : '距离较近',
      desc: '距离你的位置很近'
    },
    {
      title: typeof averageCostYuan === 'number' ? `人均约 ${averageCostYuan} 元，符合预算` : '人均适中',
      desc: '符合你的预算范围'
    },
    {
      title: '出餐速度快',
      desc: '预计等待时间较短'
    }
  ];

  return items.slice(0, 4);
}

function getPreferenceLabels(recommendation) {
  const preferredTags = recommendation.matchedPreferredTagIds || recommendation.matchedTagIds || [];
  const labels = preferredTags
    .map((tagId) => TAG_LABEL_MAP[tagId] || tagId)
    .filter((label) => !/^[a-z_]+$/i.test(label));

  if (labels.length > 0) {
    return [...new Set(labels)].slice(0, 3);
  }

  return [...new Set(recommendation.tags || [])].slice(0, 3);
}

function getStableCoverImageUrl(recommendation) {
  if (!recommendation) {
    return '';
  }

  const restaurant = recommendation.restaurant || {};
  const imageUrl = recommendation.imageUrl || restaurant.coverImageUrl;
  const isAmapRestaurant =
    recommendation.source === 'amap' ||
    (recommendation.restaurantId && recommendation.restaurantId.indexOf('amap-') === 0) ||
    (restaurant.id && restaurant.id.indexOf('amap-') === 0);

  if (isAmapRestaurant && imageUrl && !/images\.unsplash\.com/i.test(imageUrl)) {
    return imageUrl;
  }

  return '';
}
