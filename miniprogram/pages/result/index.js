const MAX_SWITCH_COUNT = 3;
const CLOUD_ENV_ID = 'cloud1-d7g5ft07k29226d0e';
const CACHE_KEY = 'nearby_restaurants_amap_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LOCATION_TOLERANCE_METERS = 100;
const { trackRecommendationAction } = require('../../services/historyService');

const MOCK_RESTAURANTS = [
  {
    id: 'mock-lanzhou-noodle',
    name: '兰州牛肉面小馆',
    tags: ['热乎', '主食', '面食', '快餐', '牛肉'],
    tagIds: ['hot', 'staple', 'noodle', 'quick', 'beef'],
    distanceMeters: 420,
    averageCostYuan: 28,
    rating: 4.5,
    source: 'mock'
  },
  {
    id: 'mock-cantonese-congee',
    name: '广式粥粉面',
    tags: ['清淡', '热乎', '粥粉面', '暖胃', '快餐'],
    tagIds: ['light', 'hot', 'congee', 'comfort', 'quick'],
    distanceMeters: 300,
    averageCostYuan: 32,
    rating: 4.4,
    source: 'mock'
  },
  {
    id: 'mock-hunan-rice',
    name: '湘味小炒饭堂',
    tags: ['重口', '米饭', '小炒', '热乎'],
    tagIds: ['strong_flavor', 'rice', 'stir_fry', 'hot'],
    distanceMeters: 760,
    averageCostYuan: 45,
    rating: 4.6,
    source: 'mock'
  },
  {
    id: 'mock-light-salad',
    name: '轻食沙拉研究所',
    tags: ['清淡', '健康', '凉食', '低负担'],
    tagIds: ['light', 'healthy', 'salad', 'low_burden'],
    distanceMeters: 650,
    averageCostYuan: 38,
    rating: 4.3,
    source: 'mock'
  }
];

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
    sourceText: '',
    reasonItems: [],
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
    this.setData({ loading: true });

    try {
      const candidates = await getRecommendations(result);
      this.setCurrentRecommendation(candidates, 0, {
        loading: false,
        switchCount: 0,
        locked: false,
        accepted: false
      });
      this.trackCurrentRecommendation('shown', candidates[0], 0, result);
    } catch (error) {
      console.error('Failed to load recommendation.', error);
      this.setData({ loading: false });
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
      this.setData({ locked: true });
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
      switchButtonText: nextSwitchCount >= MAX_SWITCH_COUNT ? '锁定结果' : '换一家'
    });
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

  setCurrentRecommendation(candidates, currentIndex, extraData = {}) {
    const recommendation = candidates[currentIndex] || null;
    const restaurant = recommendation ? recommendation.restaurant : null;
    const distanceMeters = restaurant && restaurant.distanceMeters;
    const averageCostYuan = restaurant && restaurant.averageCostYuan;
    const walkingMinutes =
      typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : null;
    const rating = restaurant && restaurant.rating;
    const source = getRecommendationSource(recommendation);
    const isAmapRestaurant = source === 'amap';

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore || 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
      ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分稳定',
      mealNameText: recommendation ? recommendation.mealName || recommendation.name || '' : '',
      coverImageUrl: isAmapRestaurant && recommendation && recommendation.imageUrl ? recommendation.imageUrl : '',
      sourceText: getSourceText(source),
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
  }
});

function getRecommendationSource(candidate) {
  const restaurant = candidate && candidate.restaurant;

  if (candidate && candidate.source) {
    return candidate.source;
  }

  if (
    candidate &&
    ((candidate.restaurantId && candidate.restaurantId.indexOf('amap-') === 0) ||
      (restaurant && restaurant.id && restaurant.id.indexOf('amap-') === 0))
  ) {
    return 'amap';
  }

  if (
    candidate &&
    ((candidate.restaurantId && candidate.restaurantId.indexOf('mock-') === 0) ||
      (restaurant && restaurant.id && restaurant.id.indexOf('mock-') === 0))
  ) {
    return 'mock';
  }

  return 'rule';
}

function getSourceText(source) {
  const sourceTextMap = {
    amap: '高德 POI 实时推荐',
    cloud: '云端推荐',
    mock: '本地备用推荐',
    rule: '规则匹配推荐',
    manual: '手动记录'
  };

  return sourceTextMap[source] || sourceTextMap.rule;
}

function buildReasonItems(recommendation, walkingMinutes, averageCostYuan) {
  const tags = new Set(recommendation.tags || []);

  return [
    {
      title: tags.has('热乎') || tags.has('麻辣烫') ? '热食偏好匹配' : '口味偏好匹配',
      desc: tags.has('热乎') || tags.has('麻辣烫') ? '符合你选择的“想吃热食”' : '符合你今天的口味倾向'
    },
    {
      title: walkingMinutes ? `步行${walkingMinutes}分钟` : '距离较近',
      desc: '距离你的位置很近'
    },
    {
      title: typeof averageCostYuan === 'number' ? `人均${averageCostYuan}元` : '人均适中',
      desc: '符合你的预算范围'
    },
    {
      title: '出餐速度快',
      desc: '高峰期平均等待10分钟'
    },
    {
      title: '符合预算',
      desc: '在你的预算范围内'
    }
  ];
}

async function getRecommendations(questionnaire) {
  const preference = mapAnswersToPreference(questionnaire && questionnaire.answers);
  const restaurants = await getNearbyRestaurants(preference).catch((error) => {
    console.warn('AMap nearby recommendation failed, fallback to mock.', error);
    return [];
  });
  const source = restaurants.length > 0 ? restaurants : MOCK_RESTAURANTS;

  return rankRestaurants(source, preference).slice(0, 4);
}

async function getNearbyRestaurants(preference) {
  const location = await getUserLocation();
  const radiusMeters = preference.radiusMeters;
  const queryKey = [preference.keyword, preference.types].join('|');
  const cached = readNearbyRestaurantsCache(location, radiusMeters, queryKey);

  if (cached.length > 0) {
    return cached;
  }

  ensureCloudInitialized();

  const response = await wx.cloud.callFunction({
    name: 'amapPoi',
    data: {
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters,
      pageSize: 25,
      keyword: preference.keyword,
      types: preference.types
    }
  });
  const result = response && response.result;

  if (!result || !result.ok) {
    throw new Error(result && result.error ? result.error.message : 'Failed to fetch AMap POI.');
  }

  const restaurants = result.data && Array.isArray(result.data.restaurants) ? result.data.restaurants : [];

  if (restaurants.length > 0) {
    wx.setStorageSync(CACHE_KEY, {
      restaurants,
      createdAt: Date.now(),
      location,
      radiusMeters,
      queryKey
    });
  }

  return restaurants;
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success(result) {
        console.warn('Location resolved for nearby restaurants.', {
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: result.accuracy,
          horizontalAccuracy: result.horizontalAccuracy
        });

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

function readNearbyRestaurantsCache(location, radiusMeters, queryKey) {
  const cached = wx.getStorageSync(CACHE_KEY);

  if (!cached || !Array.isArray(cached.restaurants)) {
    return [];
  }

  const isFresh = Date.now() - cached.createdAt < CACHE_TTL_MS;
  const isNearby =
    getDistanceMeters(location, cached.location) <=
    Math.min(CACHE_LOCATION_TOLERANCE_METERS, radiusMeters / 2);
  const isSameQuery = cached.queryKey === queryKey;

  return isFresh && isNearby && isSameQuery ? cached.restaurants : [];
}

function mapAnswersToPreference(answers = []) {
  const values = answers.map((answer) => answer.value);
  const hasValue = (value) => values.includes(value);
  const radiusAnswer = values.find((value) => typeof value === 'number');

  return {
    budgetMax: hasValue('under_30') ? 30 : hasValue('30_60') ? 60 : undefined,
    radiusMeters: typeof radiusAnswer === 'number' ? radiusAnswer : hasValue('any') ? 3000 : 1500,
    flavor: hasValue('strong') ? 'strong' : hasValue('light') ? 'light' : '',
    temperature: hasValue('cold') ? 'cold' : hasValue('hot') ? 'hot' : '',
    mealType: hasValue('snack') ? 'snack' : hasValue('meal') ? 'meal' : '',
    keyword: buildKeyword(values),
    types: '050000'
  };
}

function buildKeyword(values) {
  if (values.includes('strong')) {
    return '火锅|川菜|湘菜|麻辣烫';
  }

  if (values.includes('light')) {
    return '粥|粉面|轻食|沙拉';
  }

  if (values.includes('cold')) {
    return '轻食|沙拉|凉面';
  }

  if (values.includes('snack')) {
    return '小吃|包子|饺子|快餐';
  }

  return '';
}

function rankRestaurants(restaurants, preference) {
  return restaurants
    .map((restaurant) => {
      const tags = Array.isArray(restaurant.tagIds) ? restaurant.tagIds : [];
      const labelText = `${restaurant.name || ''};${restaurant.category || ''};${(restaurant.tags || []).join(';')}`;
      let score = 70;

      if (preference.budgetMax && restaurant.averageCostYuan && restaurant.averageCostYuan <= preference.budgetMax) {
        score += 8;
      }

      if (preference.flavor === 'strong' && /辣|麻|火锅|川|湘|烧烤/.test(labelText)) {
        score += 10;
      }

      if (preference.flavor === 'light' && /清淡|粥|粉|面|轻食|沙拉/.test(labelText)) {
        score += 10;
      }

      if (preference.temperature === 'hot' && (tags.includes('hot') || /热|面|锅|粥|饭/.test(labelText))) {
        score += 6;
      }

      if (preference.temperature === 'cold' && /凉|沙拉|轻食/.test(labelText)) {
        score += 6;
      }

      if (preference.mealType === 'snack' && /小吃|包子|饺子|炸|饼/.test(labelText)) {
        score += 6;
      }

      if (preference.mealType === 'meal' && /饭|面|粉|粥|正餐|主食/.test(labelText)) {
        score += 6;
      }

      if (restaurant.rating) {
        score += Math.min(6, Math.max(0, restaurant.rating - 3.5) * 4);
      }

      if (restaurant.distanceMeters) {
        score += Math.max(0, 8 - restaurant.distanceMeters / 250);
      }

      const confidenceScore = Math.max(60, Math.min(98, Math.round(score)));

      return {
        id: `candidate-${restaurant.id}`,
        name: restaurant.name,
        mealName: getMealName(restaurant),
        restaurant,
        tags: restaurant.tags || [],
        confidenceScore,
        reason: buildReason(restaurant, confidenceScore),
        imageUrl: restaurant.coverImageUrl || restaurant.imageUrl || '',
        source: restaurant.source || 'amap'
      };
    })
    .sort((left, right) => right.confidenceScore - left.confidenceScore);
}

function getMealName(restaurant) {
  const tags = Array.isArray(restaurant.tags) ? restaurant.tags.join(' ') : '';

  if (/粥|粉|面/.test(`${restaurant.name}${tags}`)) {
    return '招牌粥粉面';
  }

  if (/牛肉/.test(`${restaurant.name}${tags}`)) {
    return '招牌牛肉面';
  }

  if (/沙拉|轻食/.test(`${restaurant.name}${tags}`)) {
    return '轻食套餐';
  }

  return restaurant.category || '店内招牌';
}

function buildReason(restaurant, confidenceScore) {
  const distance = typeof restaurant.distanceMeters === 'number' ? Math.round(restaurant.distanceMeters) : null;
  const price = typeof restaurant.averageCostYuan === 'number' ? `，人均 ¥${restaurant.averageCostYuan}` : '';
  const rating = typeof restaurant.rating === 'number' ? `，评分 ${restaurant.rating}` : '';
  const distanceText = distance === null ? '距离合适' : `距离约 ${distance} 米`;

  return `匹配度 ${confidenceScore}%，${distanceText}${price}${rating}`;
}

function getDistanceMeters(left, right) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusMeters = 6371000;
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
