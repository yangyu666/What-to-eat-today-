const MAX_SWITCH_COUNT = 3;
const CLOUD_ENV_ID = 'cloud1-d7g5ft07k29226d0e';
const AMAP_CACHE_KEY = 'nearby_restaurants_amap_cache';
const AMAP_CACHE_TTL_MS = 10 * 60 * 1000;
let cloudInitialized = false;

const DEFAULT_PREFERENCE = {
  selectedOptionIds: [],
  preferredTagIds: ['quick', 'staple'],
  avoidedTagIds: [],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 45
};

const FALLBACK_CANDIDATES = [
  {
    id: 'fallback-1',
    name: '杨国福麻辣烫',
    mealName: '骨汤麻辣烫',
    tags: ['热食', '正餐', '可堂食'],
    reason: '附近餐厅加载失败时的本地兜底推荐',
    confidenceScore: 86,
    restaurant: {
      name: '杨国福麻辣烫',
      distanceMeters: 420,
      averageCostYuan: 35
    }
  }
];

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
    mealNameText: ''
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
      ensureCloudInitialized();
      const candidates = await getAmapCandidates(result, 4);

      if (candidates.length > 0) {
        this.setCurrentRecommendation(candidates, 0, {
          loading: false,
          switchCount: 0,
          locked: false,
          accepted: false
        });
        return;
      }
    } catch (error) {
      console.warn('AMap nearby recommendation failed, fallback to cloud.', error);
    }

    try {
      const candidates = await getCloudCandidates(result, 4);
      this.setCurrentRecommendation(candidates.length > 0 ? candidates : FALLBACK_CANDIDATES, 0, {
        loading: false,
        switchCount: 0,
        locked: false,
        accepted: false
      });
    } catch (error) {
      console.error('Failed to load recommendation.', error);
      this.setCurrentRecommendation(FALLBACK_CANDIDATES, 0, { loading: false });
    }
  },

  switchRestaurant() {
    if (this.data.locked || this.data.accepted) {
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
    this.setCurrentRecommendation(this.data.candidates, nextIndex, {
      switchCount: nextSwitchCount,
      locked: nextSwitchCount >= MAX_SWITCH_COUNT
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

    wx.showToast({
      title: '就吃这家',
      icon: 'success'
    });
  },

  setCurrentRecommendation(candidates, currentIndex, extraData = {}) {
    const recommendation = candidates[currentIndex] || null;
    const distanceMeters = recommendation?.restaurant?.distanceMeters;
    const averageCostYuan = recommendation?.restaurant?.averageCostYuan;

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore || 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      mealNameText: recommendation?.mealName || recommendation?.name || '',
      ...extraData
    });
  }
});

async function getAmapCandidates(questionnaire, limit) {
  const preference = buildPreferenceProfile(questionnaire?.answers || []);
  const location = await getUserLocation();
  const radiusMeters = preference.maxDistanceMeters || DEFAULT_PREFERENCE.maxDistanceMeters;
  const cachedRestaurants = readNearbyRestaurantsCache(location, radiusMeters);
  const restaurants =
    cachedRestaurants.length > 0
      ? cachedRestaurants
      : await fetchNearbyRestaurants(location, radiusMeters, 25);

  if (restaurants.length === 0) {
    return [];
  }

  writeNearbyRestaurantsCache({
    restaurants,
    createdAt: Date.now(),
    location,
    radiusMeters
  });

  return restaurants
    .map((restaurant) => scoreRestaurant(restaurant, preference))
    .filter((item) => item.passed)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(toCandidate);
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

async function fetchNearbyRestaurants(location, radiusMeters, pageSize) {
  const response = await wx.cloud.callFunction({
    name: 'amapPoi',
    data: {
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters,
      pageSize
    }
  });
  const payload = response.result;

  if (!payload?.ok) {
    throw new Error(payload?.error?.message || 'amapPoi failed.');
  }

  return payload.data.restaurants || [];
}

function getCloudCandidates(questionnaire, limit) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'recommendRestaurant',
      data: {
        questionnaire,
        limit
      },
      success: (response) => {
        const payload = response.result;
        resolve(payload?.ok ? payload.data.recommendation.candidates : []);
      },
      fail: reject
    });
  });
}

function ensureCloudInitialized() {
  if (!wx.cloud) {
    throw new Error('Current base library does not support cloud development.');
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

function readNearbyRestaurantsCache(location, radiusMeters) {
  const cached = wx.getStorageSync(AMAP_CACHE_KEY);

  if (!cached || !Array.isArray(cached.restaurants)) {
    return [];
  }

  const isFresh = Date.now() - cached.createdAt < AMAP_CACHE_TTL_MS;
  const isNearby = getDistanceMeters(location, cached.location) <= Math.min(500, radiusMeters / 2);

  return isFresh && isNearby ? cached.restaurants : [];
}

function writeNearbyRestaurantsCache(cache) {
  wx.setStorageSync(AMAP_CACHE_KEY, cache);
}

function scoreRestaurant(restaurant, preference) {
  const tagIds = restaurant.tagIds || restaurant.tags || [];
  const preferredTagIds = preference.preferredTagIds || [];
  const avoidedTagIds = preference.avoidedTagIds || [];
  const matchedPreferredTagIds = tagIds.filter((tagId) => preferredTagIds.includes(tagId));
  const matchedAvoidedTagIds = tagIds.filter((tagId) => avoidedTagIds.includes(tagId));
  const distanceScore = getDistanceScore(restaurant, preference);
  const priceScore = getPriceScore(restaurant, preference);
  const ratingScore =
    typeof restaurant.rating === 'number' ? Math.max(0, Math.min(10, (restaurant.rating - 3.5) * 8)) : 3;
  const score = Math.max(
    0,
    Math.min(
      100,
      45 + matchedPreferredTagIds.length * 9 - matchedAvoidedTagIds.length * 12 + distanceScore + priceScore + ratingScore
    )
  );

  return {
    restaurant,
    score,
    matchedPreferredTagIds,
    passed:
      restaurant.status === 'active' &&
      (preference.maxDistanceMeters === undefined ||
        restaurant.distanceMeters === undefined ||
        restaurant.distanceMeters <= preference.maxDistanceMeters)
  };
}

function toCandidate(scored) {
  const restaurant = scored.restaurant;
  const confidenceScore = Math.round(Math.max(55, Math.min(98, scored.score + scored.matchedPreferredTagIds.length * 2)));
  const reasons = [];

  if (scored.matchedPreferredTagIds.length > 0) {
    reasons.push(`匹配 ${scored.matchedPreferredTagIds.length} 个偏好标签`);
  }

  if (typeof restaurant.distanceMeters === 'number') {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }

  if (typeof restaurant.rating === 'number') {
    reasons.push(`评分 ${restaurant.rating.toFixed(1)} 较稳定`);
  }

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
    reason: reasons.length > 0 ? reasons.join('，') : restaurant.description || '附近真实餐厅，符合当前偏好',
    estimatedMinutes:
      restaurant.distanceMeters === undefined ? 25 : Math.ceil(restaurant.distanceMeters / 120) + 20,
    score: scored.score,
    confidenceScore,
    confidenceLabel: confidenceScore >= 78 ? 'high' : confidenceScore >= 58 ? 'medium' : 'low',
    matchedTagIds: scored.matchedPreferredTagIds,
    imageUrl: restaurant.coverImageUrl
  };
}

function buildPreferenceProfile(answers) {
  const selectedOptionIds = answers.flatMap((answer) => answer.optionIds || []);
  const preferredTagIds = new Set(DEFAULT_PREFERENCE.preferredTagIds);
  const avoidedTagIds = new Set(DEFAULT_PREFERENCE.avoidedTagIds);
  let budgetLevel = DEFAULT_PREFERENCE.budgetLevel;
  let maxDistanceMeters = DEFAULT_PREFERENCE.maxDistanceMeters;
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;

  answers.forEach((answer) => {
    if (answer.questionId === 'budget') {
      budgetLevel = answer.value === 'under_30' ? 2 : answer.value === 'over_60' ? 4 : 3;
    }

    if (answer.questionId === 'distance') {
      if (answer.value === 500 || answer.value === 1000) {
        maxDistanceMeters = answer.value;
      } else if (answer.value === 'any') {
        maxDistanceMeters = 3000;
      }
    }

    if (answer.questionId === 'flavor') {
      if (answer.value === 'strong') {
        preferredTagIds.add('spicy');
        preferredTagIds.add('strong_flavor');
        avoidedTagIds.delete('strong_flavor');
      } else if (answer.value === 'light') {
        preferredTagIds.add('light');
        preferredTagIds.add('healthy');
        avoidedTagIds.add('strong_flavor');
      }
    }

    if (answer.questionId === 'temperature') {
      if (answer.value === 'hot') {
        preferredTagIds.add('hot');
        preferredTagIds.add('comfort');
      } else if (answer.value === 'cold') {
        preferredTagIds.add('light');
        preferredTagIds.add('salad');
      }
    }

    if (answer.questionId === 'meal_type') {
      if (answer.value === 'meal') {
        preferredTagIds.add('staple');
        preferredTagIds.add('rice');
        preferredTagIds.add('noodle');
      } else if (answer.value === 'snack') {
        preferredTagIds.add('snack');
        preferredTagIds.add('quick');
        preferredTagIds.add('solo');
      }
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters,
    maxEstimatedMinutes
  };
}

function getDistanceScore(restaurant, preference) {
  if (restaurant.distanceMeters === undefined) {
    return 4;
  }

  const maxDistance = preference.maxDistanceMeters || 2000;
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
  if (restaurant.priceLevel === undefined || preference.budgetLevel === undefined) {
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

function getDistanceMeters(left, right) {
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
