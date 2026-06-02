import type { MealCandidate } from '../../models/meal';
import { trackRecommendationAction } from '../../services/historyService';
import { getLocalRecommendations } from '../../services/mealService';
import type { RecommendationAction, RecommendationSource } from '../../types/recommendation';
import type { UserQuestionnaireResult } from '../../types/userPreference';

const MAX_SWITCH_COUNT = 3;
const DEFAULT_RESULT_IMAGE_URL = '';

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
    coverImageUrl: DEFAULT_RESULT_IMAGE_URL,
    errorText: '',
    sourceText: '',
    reasonItems: [] as ReasonItem[],
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
      const candidates = await getLocalRecommendations(result);

      if (candidates.length === 0) {
        this.setCurrentRecommendation([], 0, {
          loading: false,
          switchCount: 0,
          locked: false,
          accepted: false,
          errorText: '暂无可推荐候选'
        });
        return;
      }

      this.setCurrentRecommendation(candidates, 0, {
        loading: false,
        switchCount: 0,
        locked: false,
        accepted: false,
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

    if (this.data.switchCount >= MAX_SWITCH_COUNT) {
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

    const nextSwitchCount = this.data.switchCount + 1;
    const nextIndex = (this.data.currentIndex + 1) % this.data.candidates.length;

    this.trackCurrentRecommendation(
      'skipped',
      this.data.recommendation,
      nextSwitchCount,
      this.getQuestionnaireResult()
    );
    this.setCurrentRecommendation(this.data.candidates, nextIndex, {
      switchCount: nextSwitchCount,
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

  handleCoverImageError() {
    this.setData({
      coverImageUrl: DEFAULT_RESULT_IMAGE_URL
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
    const source = this.getRecommendationSource(recommendation);

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore ?? 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
      ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分稳定',
      mealNameText: recommendation?.mealName || recommendation?.name || '',
      coverImageUrl: getStableCoverImageUrl(recommendation),
      sourceText: this.getSourceText(source),
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
    const tags = new Set(recommendation.tags);
    const isHot = tags.has('热乎') || tags.has('麻辣烫') || tags.has('hot');

    return [
      {
        title: isHot ? '热食偏好匹配' : '口味偏好匹配',
        desc: isHot ? '符合你选择的热食倾向' : '符合你今天的口味倾向'
      },
      {
        title: walkingMinutes ? `步行${walkingMinutes}分钟` : '距离较近',
        desc: '距离和用餐便利性已纳入排序'
      },
      {
        title: typeof averageCostYuan === 'number' ? `人均${averageCostYuan}元` : '人均适中',
        desc: '预算信息已参与推荐匹配'
      },
      {
        title: `${Math.round(recommendation.confidenceScore ?? 0)}% 匹配`,
        desc: recommendation.reason || '根据你的问答偏好综合排序'
      }
    ];
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

  getRecommendationSource(candidate: MealCandidate | null): RecommendationSource {
    if (candidate?.source) {
      return candidate.source;
    }

    if (candidate?.restaurantId?.startsWith('amap-') || candidate?.restaurant?.id?.startsWith('amap-')) {
      return 'amap';
    }

    if (candidate?.restaurantId?.startsWith('mock-') || candidate?.restaurant?.id?.startsWith('mock-')) {
      return 'mock';
    }

    return 'rule';
  },

  getSourceText(source: RecommendationSource): string {
    const sourceTextMap: Record<RecommendationSource, string> = {
      amap: '高德 POI 实时推荐',
      cloud: '云端推荐',
      mock: '本地备用推荐',
      rule: '规则匹配推荐',
      manual: '手动记录'
    };

    return sourceTextMap[source];
  }
});

function getStableCoverImageUrl(recommendation: MealCandidate | null): string {
  if (!recommendation) {
    return DEFAULT_RESULT_IMAGE_URL;
  }

  const imageUrl = recommendation.imageUrl;

  if (imageUrl) {
    return imageUrl;
  }

  return DEFAULT_RESULT_IMAGE_URL;
}
