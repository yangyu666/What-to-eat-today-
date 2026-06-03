const USER_PROFILE_STORAGE_KEY = 'meal_user_profile';
const HISTORY_STORAGE_KEY = 'meal_recommendation_history';
const HISTORY_FILTER_STORAGE_KEY = 'meal_filter_recent_history';
const QUESTIONNAIRE_RESULT_STORAGE_KEY = 'meal_questionnaire_result';
const SYNC_USER_PROFILE_FUNCTION_NAME = 'syncUserProfile';
const DEFAULT_NICKNAME = '未登录用户';
const VERSION = 'v0.1.0';

const ACTIONS = [
  {
    key: 'about',
    title: '关于今天吃什么',
    desc: '30-60 秒结束选择困难'
  },
  {
    key: 'privacy',
    title: '隐私说明',
    desc: '了解本地与云端资料保存方式'
  },
  {
    key: 'recommendation',
    title: '推荐说明',
    desc: '查看推荐结果如何产生'
  },
  {
    key: 'dataSource',
    title: '数据来源说明',
    desc: '查看餐厅数据来源与限制'
  },
  {
    key: 'clearCache',
    title: '清除本地缓存',
    desc: '清除头像昵称、历史缓存和历史过滤开关',
    danger: true
  },
  {
    key: 'clearPreference',
    title: '清除问答偏好',
    desc: '清除已保存的问答结果',
    danger: true
  }
];

const MODAL_CONTENT = {
  about: '今天吃什么是一个饮食决策辅助工具，目标是在 30-60 秒内帮你结束选择困难。',
  privacy:
    '当前 MVP 会在本地保存你的头像昵称、问答偏好和推荐历史。头像昵称会在你主动设置后同步到云端，用于识别你的个人资料。',
  recommendation:
    '推荐结果由问答偏好、附近餐厅、预算、距离、口味、历史过滤等规则综合计算。AI 不直接决定餐厅。',
  dataSource:
    '餐厅信息优先来自高德 POI，部分测试阶段会使用 mock 数据。人均、营业状态等字段可能存在偏差，请以实际店铺为准。'
};

Page({
  data: {
    nickname: DEFAULT_NICKNAME,
    avatarUrl: '',
    statusText: '可设置微信头像和昵称',
    actions: ACTIONS,
    version: VERSION
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const profile = getStoredProfile();

    this.setData({
      nickname: (profile && profile.nickname) || DEFAULT_NICKNAME,
      avatarUrl: (profile && profile.avatarUrl) || ''
    });
  },

  onChooseAvatar(event) {
    const avatarUrl = event.detail.avatarUrl;

    if (!avatarUrl) {
      return;
    }

    this.saveProfile({
      nickname: this.data.nickname === DEFAULT_NICKNAME ? '' : this.data.nickname,
      avatarUrl
    });
  },

  onNicknameInput(event) {
    this.setData({
      nickname: event.detail.value || ''
    });
  },

  onNicknameConfirm(event) {
    this.commitNickname(event.detail.value);
  },

  onNicknameBlur(event) {
    this.commitNickname(event.detail.value);
  },

  commitNickname(value) {
    const nickname = normalizeNickname(value);

    this.saveProfile({
      nickname,
      avatarUrl: this.data.avatarUrl
    });
  },

  saveProfile(nextProfile) {
    const profile = {
      nickname: normalizeNickname(nextProfile.nickname),
      avatarUrl: nextProfile.avatarUrl || '',
      updatedAt: new Date().toISOString()
    };

    wx.setStorageSync(USER_PROFILE_STORAGE_KEY, profile);
    this.setData({
      nickname: profile.nickname || DEFAULT_NICKNAME,
      avatarUrl: profile.avatarUrl
    });
    void syncUserProfile(profile);
  },

  onActionTap(event) {
    const key = event.currentTarget.dataset.key;

    if (!key) {
      return;
    }

    if (key === 'clearCache') {
      this.confirmClearCache();
      return;
    }

    if (key === 'clearPreference') {
      this.confirmClearPreference();
      return;
    }

    const content = MODAL_CONTENT[key];

    if (content) {
      wx.showModal({
        title: getActionTitle(key),
        content,
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  confirmClearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除头像昵称、历史过滤开关和本地推荐历史缓存，不会删除云端资料。',
      confirmText: '清除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        [
          USER_PROFILE_STORAGE_KEY,
          HISTORY_FILTER_STORAGE_KEY,
          HISTORY_STORAGE_KEY
        ].forEach((key) => wx.removeStorageSync(key));

        this.setData({
          nickname: DEFAULT_NICKNAME,
          avatarUrl: ''
        });

        wx.showToast({
          title: '已清除',
          icon: 'success'
        });
      }
    });
  },

  confirmClearPreference() {
    wx.showModal({
      title: '清除问答偏好',
      content: '将清除已保存的问答偏好，下次推荐会重新问答。',
      confirmText: '清除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        wx.removeStorageSync(QUESTIONNAIRE_RESULT_STORAGE_KEY);
        wx.showToast({
          title: '已清除',
          icon: 'success'
        });
      }
    });
  }
});

function getStoredProfile() {
  const profile = wx.getStorageSync(USER_PROFILE_STORAGE_KEY);

  if (!profile || typeof profile !== 'object') {
    return undefined;
  }

  return {
    nickname: normalizeNickname(profile.nickname),
    avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : '',
    updatedAt:
      typeof profile.updatedAt === 'string' && profile.updatedAt
        ? profile.updatedAt
        : new Date().toISOString()
  };
}

function normalizeNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : '';

  return nickname || DEFAULT_NICKNAME;
}

function getActionTitle(key) {
  const action = ACTIONS.find((item) => item.key === key);

  return action ? action.title : '说明';
}

async function syncUserProfile(profile) {
  if (!wx.cloud) {
    return;
  }

  try {
    await wx.cloud.callFunction({
      name: SYNC_USER_PROFILE_FUNCTION_NAME,
      data: {
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl
      }
    });
  } catch (error) {
    console.warn('Failed to sync user profile.', error);
  }
}
