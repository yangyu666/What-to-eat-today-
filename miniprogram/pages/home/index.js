const {
  getHistory,
  getHistoryFilterEnabled,
  setHistoryFilterEnabled
} = require('../../services/historyService');

const MAX_RECENT_MEALS = 3;
const DEFAULT_USER_NAME = '朋友';
const DEFAULT_RECENT_IMAGES = {
  spicy: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  light: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=360&q=80',
  snack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80',
  general: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=360&q=80'
};

Page({
  data: {
    userName: DEFAULT_USER_NAME,
    locationStatus: '定位中',
    historyFilterEnabled: true,
    recentMeals: []
  },

  onLoad() {
    this.initUserName();
    this.initLocation();
    this.initHistoryFilter();
  },

  onShow() {
    this.initUserName();
    this.initHistoryFilter();
    this.loadRecentMeals();
  },

  initHistoryFilter() {
    this.setData({
      historyFilterEnabled: getHistoryFilterEnabled()
    });
  },

  initUserName() {
    const app = getApp();
    const storedUserInfo = getStoredUserInfo();
    const nickName = (app.globalData.userInfo && app.globalData.userInfo.nickName) ||
      (storedUserInfo && storedUserInfo.nickName);

    this.setData({
      userName: nickName || DEFAULT_USER_NAME
    });
  },

  initLocation() {
    this.setData({ locationStatus: '定位中' });

    wx.getLocation({
      type: 'gcj02',
      success: () => {
        this.setData({
          locationStatus: '当前位置已获取'
        });
      },
      fail: () => {
        this.setData({
          locationStatus: '点击获取位置'
        });
      }
    });
  },

  async loadRecentMeals() {
    try {
      const history = await getHistory();
      const recentHistory = selectRecentHistory(history);

      this.setData({
        recentMeals: recentHistory.map(toRecentMealItem)
      });
    } catch (error) {
      console.warn('Failed to load recent recommendations.', error);
      this.setData({ recentMeals: [] });
    }
  },

  startQuestionnaire() {
    setHistoryFilterEnabled(this.data.historyFilterEnabled);

    wx.setStorageSync('meal_questionnaire_draft', {
      startedAt: new Date().toISOString(),
      historyFilterEnabled: this.data.historyFilterEnabled
    });

    wx.navigateTo({
      url: '/pages/question/index'
    });
  },

  openHistory() {
    wx.switchTab({
      url: '/pages/history/index'
    });
  },

  toggleHistoryFilter(event) {
    const enabled = event.detail.value;

    this.setData({
      historyFilterEnabled: enabled
    });
    setHistoryFilterEnabled(enabled);
  }
});

function getStoredUserInfo() {
  const storageKeys = ['userInfo', 'user_profile', 'profile'];

  for (const key of storageKeys) {
    const value = wx.getStorageSync(key);

    if (!value) {
      continue;
    }

    if (value.nickName) {
      return value;
    }

    if (value.userInfo && value.userInfo.nickName) {
      return value.userInfo;
    }
  }

  return undefined;
}

function toRecentMealItem(item) {
  const name = item.restaurantName || item.mealName;

  return {
    id: item.id,
    name,
    timeText: item.dateText,
    matchText:
      typeof item.matchPercent === 'number' ? `${Math.round(item.matchPercent)}% 匹配` : '已推荐',
    imageUrl: item.imageUrl || getFallbackImageUrl(item.tags, name)
  };
}

function selectRecentHistory(history) {
  const accepted = history.filter((item) => item.action === 'accepted');

  if (accepted.length > 0) {
    return accepted.slice(0, MAX_RECENT_MEALS);
  }

  return history.filter((item) => item.action === 'shown').slice(0, MAX_RECENT_MEALS);
}

function getFallbackImageUrl(tags, name) {
  const text = `${name} ${(tags || []).join(' ')}`;

  if (/辣|麻辣|火锅|川|湘|烧烤|重口/.test(text)) {
    return DEFAULT_RECENT_IMAGES.spicy;
  }

  if (/饭|米|炒|盖饭|咖喱/.test(text)) {
    return DEFAULT_RECENT_IMAGES.rice;
  }

  if (/轻食|沙拉|健康|清淡/.test(text)) {
    return DEFAULT_RECENT_IMAGES.light;
  }

  if (/面|粉|粥|拉面|牛肉面/.test(text)) {
    return DEFAULT_RECENT_IMAGES.noodle;
  }

  if (/小吃|点心|包子|饺子|馄饨/.test(text)) {
    return DEFAULT_RECENT_IMAGES.snack;
  }

  return DEFAULT_RECENT_IMAGES.general;
}
