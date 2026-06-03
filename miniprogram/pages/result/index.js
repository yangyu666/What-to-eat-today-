const {
  getRecentHistoryFilterContext,
  trackRecommendationAction
} = require('../../services/historyService');

const MAX_SWITCH_COUNT = 3;
const CLOUD_ENV_ID = 'cloud1-d7g5ft07k29226d0e';
const DEFAULT_RESULT_IMAGE_URL = '/assets/images/meals/general.png';

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
    sourceText: '',
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

  reloadRecommendation() {
    this.loadRecommendation(this.getQuestionnaireResult());
  },

  setCurrentRecommendation(candidates, currentIndex, extraData = {}) {
    const recommendation = candidates[currentIndex] || null;
    const restaurant = recommendation && recommendation.restaurant;
    const distanceMeters = restaurant && restaurant.distanceMeters;
    const averageCostYuan = restaurant && restaurant.averageCostYuan;
    const walkingMinutes =
      typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : null;
    const rating = restaurant && restaurant.rating;
    const source = getRecommendationSource(recommendation);

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore || 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
      ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分未知',
      mealNameText: recommendation ? recommendation.mealName || recommendation.name || '' : '',
      coverImageUrl: getStableCoverImageUrl(recommendation),
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
  },

  handleCoverImageError() {
    this.setData({
      coverImageUrl: DEFAULT_RESULT_IMAGE_URL
    });
  }
});

async function getRecommendations(questionnaire, historyFilterContext = getRecentHistoryFilterContext()) {
  ensureCloudInitialized();
  const historyFilterEnabled = historyFilterContext.historyFilterEnabled === true;

  const response = await wx.cloud.callFunction({
    name: 'recommendRestaurant',
    data: {
      questionnaire,
      limit: 4,
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
  const algorithmReasons = String(recommendation.reason || '')
    .split('；')
    .map((reason) => reason.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((reason) => ({
      title: reason,
      desc: '来自推荐算法对距离、预算、口味和负向偏好的综合判断'
    }));

  if (recommendation.fallbackReason) {
    algorithmReasons.push({
      title: recommendation.fallbackReason,
      desc: '候选池不足时会降低匹配度，并记录在推荐诊断数据中'
    });
  }

  if (algorithmReasons.length > 0) {
    return algorithmReasons;
  }

  return [
    {
      title: walkingMinutes ? `步行约 ${walkingMinutes} 分钟` : '距离信息可用',
      desc: '距离是当前推荐的核心约束之一'
    },
    {
      title: typeof averageCostYuan === 'number' ? `人均约 ${averageCostYuan} 元` : '人均未知',
      desc: '预算未知不会默认加高分'
    }
  ];
}

function getStableCoverImageUrl(recommendation) {
  if (!recommendation) {
    return DEFAULT_RESULT_IMAGE_URL;
  }

  const restaurant = recommendation.restaurant || {};
  const imageUrl = recommendation.imageUrl || restaurant.coverImageUrl;

  if (imageUrl && !/images\.unsplash\.com/i.test(imageUrl)) {
    return imageUrl;
  }

  return DEFAULT_RESULT_IMAGE_URL;
}

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
