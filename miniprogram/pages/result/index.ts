import type { MealCandidate } from '../../models/meal';
import {
  getRecentHistoryFilterContext,
  trackRecommendationAction
} from '../../services/historyService';
import { getLocalRecommendations } from '../../services/mealService';
import type { RecommendationAction } from '../../types/recommendation';
import type { UserQuestionnaireResult } from '../../types/userPreference';

const MAX_SWITCH_COUNT = 3;

const TAG_LABEL_MAP: Record<string, string> = {
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

interface ReasonItem {
  title: string;
  desc: string;
}

Page({
  data: {
    candidates: [] as MealCandidate[],
    currentIndex: 0,
    recommendation: null as MealCandidate | null,
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
    reasonItems: [] as ReasonItem[],
    historyFilterEnabled: true,
    excludedHistoryRestaurantIds: [] as string[],
    historyPenaltyReasons: [] as string[],
    switchButtonText: '换一家'
  },

  onLoad() {
    const result = wx.getStorageSync('meal_questionnaire_result') as
      | UserQuestionnaireResult
      | undefined;

    this.setData({
      answerCount: result?.answers?.length || 0
    });

    this.loadRecommendation(result);
  },

  async loadRecommendation(result?: UserQuestionnaireResult) {
    this.setData({ loading: true, errorText: '' });

    try {
      const historyFilterContext = getRecentHistoryFilterContext();
      const candidates = await getLocalRecommendations(result, historyFilterContext);

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

  handleCoverImageError() {
    this.setData({
      coverImageUrl: ''
    });
  },

  navigateToRestaurant() {
    const restaurant = this.data.recommendation?.restaurant;
    const location = restaurant?.location;

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
      name: restaurant?.name || this.data.recommendation?.name || '推荐门店',
      address: restaurant?.address || '',
      scale: 16
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({
          url: '/pages/home/index'
        });
      }
    });
  },

  setCurrentRecommendation(
    candidates: MealCandidate[],
    currentIndex: number,
    extraData: Partial<WechatMiniprogram.Page.DataOption> = {}
  ) {
    const recommendation = candidates[currentIndex] ?? null;
    const distanceMeters = recommendation?.restaurant?.distanceMeters;
    const averageCostYuan = recommendation?.restaurant?.averageCostYuan;
    const walkingMinutes =
      typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : null;
    const rating = recommendation?.restaurant?.rating;

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore ?? 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
      ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分未知',
      mealNameText: recommendation?.mealName || recommendation?.name || '',
      coverImageUrl: getStableCoverImageUrl(recommendation),
      reasonItems: recommendation
        ? this.buildReasonItems(recommendation, walkingMinutes, averageCostYuan)
        : [],
      ...extraData
    });
  },

  buildReasonItems(
    recommendation: MealCandidate,
    walkingMinutes: number | null,
    averageCostYuan: number | undefined
  ): ReasonItem[] {
    const preferenceLabels = this.getPreferenceLabels(recommendation);
    const distanceMeters = recommendation.restaurant?.distanceMeters;

    const items: ReasonItem[] = [
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
  },

  getPreferenceLabels(recommendation: MealCandidate): string[] {
    const preferredTags = recommendation.matchedPreferredTagIds ?? recommendation.matchedTagIds ?? [];
    const labels = preferredTags
      .map((tagId) => TAG_LABEL_MAP[tagId] ?? tagId)
      .filter((label) => !/^[a-z_]+$/i.test(label));

    if (labels.length > 0) {
      return [...new Set(labels)].slice(0, 3);
    }

    return [...new Set(recommendation.tags)].slice(0, 3);
  },

  trackCurrentRecommendation(
    action: RecommendationAction,
    candidate: MealCandidate | null | undefined,
    switchCount: number,
    questionnaire?: UserQuestionnaireResult
  ) {
    if (!candidate) {
      return;
    }

    void trackRecommendationAction({
      action,
      candidate,
      questionnaire,
      switchCount
    }).catch((error) => {
      console.warn('Recommendation tracking failed.', error);
    });
  },

  getQuestionnaireResult(): UserQuestionnaireResult | undefined {
    return wx.getStorageSync('meal_questionnaire_result') as
      | UserQuestionnaireResult
      | undefined;
  },

});

function getStableCoverImageUrl(recommendation: MealCandidate | null): string {
  if (!recommendation) {
    return '';
  }

  const restaurantImageUrl = (recommendation.restaurant as { coverImageUrl?: string } | undefined)
    ?.coverImageUrl;
  const imageUrl = recommendation.imageUrl || restaurantImageUrl;
  const isAmapRestaurant =
    recommendation.source === 'amap' ||
    recommendation.restaurantId?.startsWith('amap-') ||
    recommendation.restaurant?.id?.startsWith('amap-');

  if (isAmapRestaurant && imageUrl && !/images\.unsplash\.com/i.test(imageUrl)) {
    return imageUrl;
  }

  return '';
}
