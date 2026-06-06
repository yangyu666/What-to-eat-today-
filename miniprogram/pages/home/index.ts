import {
  getHistory,
  getHistoryFilterEnabled,
  setHistoryFilterEnabled
} from '../../services/historyService';
import { prefetchNearbyRestaurantCandidates } from '../../services/amapPoiService';
import type { MealHistoryItem } from '../../models/meal';

interface RecentMealItem {
  id: string;
  name: string;
  timeText: string;
  matchText: string;
  imageUrl: string;
}

const MAX_RECENT_MEALS = 3;
const DEFAULT_USER_NAME = '朋友';
const USER_PROFILE_STORAGE_KEY = 'meal_user_profile';
const DEFAULT_RECENT_IMAGES = {
  spicy: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  light: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=360&q=80',
  snack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80',
  general: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=360&q=80'
} as const;

Page({
  data: {
    userName: DEFAULT_USER_NAME,
    locationStatus: '定位中',
    locationAuthDenied: false,
    historyFilterEnabled: true,
    recentMeals: [] as RecentMealItem[]
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
    this.setData({
      userName: getStoredUserName()
    });
  },

  initLocation() {
    if (this.data.locationAuthDenied) {
      this.openLocationSetting();
      return;
    }

    this.requestLocation();
  },

  requestLocation() {
    this.setData({ locationStatus: '定位中' });

    wx.getLocation({
      type: 'gcj02',
      success: async (result) => {
        this.prefetchNearbyRestaurants(result.latitude, result.longitude);
        const locationLabel = await getLocationLabel(result.latitude, result.longitude);

        this.setData({
          locationStatus: locationLabel || '位置未授权',
          locationAuthDenied: !locationLabel
        });
      },
      fail: () => {
        this.setData({
          locationStatus: '位置未授权',
          locationAuthDenied: true
        });
      }
    });
  },

  prefetchNearbyRestaurants(latitude: number, longitude: number) {
    void prefetchNearbyRestaurantCandidates({
      location: { latitude, longitude },
      mode: 'polygon',
      radiusMeters: 5000,
      pageSize: 25,
      pageCount: 3,
      fetchReason: 'home-location-success-polygon-prefetch',
      maxAmapApiCalls: 3
    }).catch((error) => {
      console.warn('Nearby restaurant prefetch failed.', error);
    });
  },

  openLocationSetting() {
    wx.openSetting({
      success: (result) => {
        if (result.authSetting['scope.userLocation']) {
          this.setData({ locationAuthDenied: false });
          this.requestLocation();
          return;
        }

        this.setData({
          locationStatus: '位置未授权',
          locationAuthDenied: true
        });
      },
      fail: () => {
        this.setData({
          locationStatus: '位置未授权',
          locationAuthDenied: true
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

  toggleHistoryFilter(event: WechatMiniprogram.SwitchChange) {
    const enabled = event.detail.value;

    this.setData({
      historyFilterEnabled: enabled
    });
    setHistoryFilterEnabled(enabled);
  }
});

function getStoredUserName(): string {
  const app = getApp<IAppOption>();
  const appNickName = app.globalData.userInfo?.nickName;

  if (appNickName) {
    return appNickName;
  }

  const profile = wx.getStorageSync(USER_PROFILE_STORAGE_KEY) as { nickname?: string } | undefined;

  if (profile?.nickname) {
    return profile.nickname;
  }

  const storageKeys = ['userInfo', 'user_profile', 'profile'];

  for (const key of storageKeys) {
    const value = wx.getStorageSync(key) as
      | WechatMiniprogram.UserInfo
      | { userInfo?: WechatMiniprogram.UserInfo }
      | { nickname?: string }
      | undefined;

    if (!value) {
      continue;
    }

    if ('nickName' in value && value.nickName) {
      return value.nickName;
    }

    if ('nickname' in value && value.nickname) {
      return value.nickname;
    }

    if ('userInfo' in value && value.userInfo?.nickName) {
      return value.userInfo.nickName;
    }
  }

  return DEFAULT_USER_NAME;
}

async function getLocationLabel(latitude: number, longitude: number): Promise<string | undefined> {
  if (!wx.cloud) {
    return undefined;
  }

  try {
    // wx.getLocation itself only obtains coordinates. This reverseGeocode cloud action
    // calls AMap regeo and therefore consumes AMap WebService quota.
    const response = await wx.cloud.callFunction({
      name: 'amapPoi',
      data: {
        action: 'reverseGeocode',
        latitude,
        longitude
      }
    });
    const result = response.result as
      | {
          ok?: boolean;
          data?: {
            province?: string;
            city?: string;
            district?: string;
          };
        }
      | undefined;

    if (!result?.ok || !result.data) {
      return undefined;
    }

    return formatLocationLabel(result.data.province, result.data.city, result.data.district);
  } catch (error) {
    console.warn('Failed to resolve location label.', error);
    return undefined;
  }
}

function formatLocationLabel(
  province?: string,
  city?: string,
  district?: string
): string | undefined {
  const parts = [province, city, district]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replace(/省|市|自治区|特别行政区|地区|盟|区|县$/g, ''));
  const uniqueParts = parts.filter((part, index) => part && parts.indexOf(part) === index);

  return uniqueParts.length > 0 ? uniqueParts.slice(0, 2).join(' · ') : undefined;
}

function toRecentMealItem(item: MealHistoryItem): RecentMealItem {
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

function selectRecentHistory(history: MealHistoryItem[]): MealHistoryItem[] {
  const accepted = history.filter((item) => item.action === 'accepted');

  if (accepted.length > 0) {
    return accepted.slice(0, MAX_RECENT_MEALS);
  }

  return history.filter((item) => item.action === 'shown').slice(0, MAX_RECENT_MEALS);
}

function getFallbackImageUrl(tags: string[] | undefined, name: string): string {
  const text = `${name} ${(tags ?? []).join(' ')}`;

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

  if (/小吃|炸|包子|饺子|馄饨/.test(text)) {
    return DEFAULT_RECENT_IMAGES.snack;
  }

  return DEFAULT_RECENT_IMAGES.general;
}
