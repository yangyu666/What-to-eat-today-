import type { MealCandidate } from '../../models/meal';
import { getTodayRecommendation } from '../../services/mealService';

Page({
  data: {
    recommendation: null as MealCandidate | null,
    loading: false
  },

  onLoad() {
    this.refreshRecommendation();
  },

  async refreshRecommendation() {
    this.setData({ loading: true });

    const recommendation = await getTodayRecommendation();

    this.setData({
      recommendation,
      loading: false
    });
  }
});
