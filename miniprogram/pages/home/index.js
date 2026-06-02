Page({
  data: {
    locationStatus: '北京 · 海淀区',
    recentMeals: [
      {
        id: 'recent-1',
        name: '杨国福麻辣烫',
        timeText: '今天 12:30',
        matchText: '86% 匹配',
        coverClass: 'is-red'
      },
      {
        id: 'recent-2',
        name: '黄焖鸡米饭',
        timeText: '昨天 12:15',
        matchText: '78% 匹配',
        coverClass: 'is-orange'
      },
      {
        id: 'recent-3',
        name: '兰州拉面',
        timeText: '05-20 12:40',
        matchText: '82% 匹配',
        coverClass: 'is-green'
      }
    ]
  },

  startQuestionnaire() {
    wx.setStorageSync('meal_questionnaire_draft', {
      startedAt: new Date().toISOString()
    });

    wx.navigateTo({
      url: '/pages/question/index'
    });
  },

  openHistory() {
    wx.switchTab({
      url: '/pages/history/index'
    });
  }
});
