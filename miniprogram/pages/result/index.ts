import type { MealCandidate } from '../../models/meal';
import { getLocalRecommendations } from '../../services/mealService';
import type { UserQuestionnaireResult } from '../../types/userPreference';

const MAX_SWITCH_COUNT = 3;

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
    mealNameText: ''
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
    this.setData({ loading: true });

    try {
      const candidates = await getLocalRecommendations(result);
      this.setCurrentRecommendation(candidates, 0, {
        loading: false,
        switchCount: 0,
        locked: false,
        accepted: false
      });
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

  setCurrentRecommendation(
    candidates: MealCandidate[],
    currentIndex: number,
    extraData: Partial<WechatMiniprogram.Page.DataOption> = {}
  ) {
    const recommendation = candidates[currentIndex] ?? null;
    const distanceMeters = recommendation?.restaurant?.distanceMeters;
    const averageCostYuan = recommendation?.restaurant?.averageCostYuan;

    this.setData({
      candidates,
      currentIndex,
      recommendation,
      matchPercent: recommendation ? Math.round(recommendation.confidenceScore ?? 0) : 0,
      distanceText:
        typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
      averageCostText: typeof averageCostYuan === 'number' ? `¥${averageCostYuan}/人` : '人均未知',
      mealNameText: recommendation?.mealName || recommendation?.name || '',
      ...extraData
    });
  }
});
