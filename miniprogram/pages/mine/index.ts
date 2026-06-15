import { clearLocalRecommendationHistory } from '../../services/historyService';

interface UserProfile {
  nickname: string;
  avatarUrl: string;
  updatedAt: string;
}

interface GuideSection {
  title: string;
  content: string;
}

interface MineAction {
  key: string;
  title: string;
  desc: string;
  danger?: boolean;
  feedback?: boolean;
}

const USER_PROFILE_STORAGE_KEY = 'meal_user_profile';
const SYNC_USER_PROFILE_FUNCTION_NAME = 'syncUserProfile';
const DEFAULT_NICKNAME = '未登录用户';
const VERSION = 'v0.1.0';

const ACTIONS: MineAction[] = [
  {
    key: 'guide',
    title: '关于与说明',
    desc: '产品、隐私、推荐和数据来源'
  },
  {
    key: 'feedback',
    title: '意见反馈',
    desc: '告诉我们哪里不好用或想吃什么',
    feedback: true
  },
  {
    key: 'clearCache',
    title: '清除本地缓存',
    desc: '清除头像昵称和本地推荐记录',
    danger: true
  }
];

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: '关于今天吃什么',
    content: '这是一个饮食决策辅助工具，目标是在 30-60 秒内帮你结束选择困难。'
  },
  {
    title: '隐私说明',
    content: '头像昵称仅在你主动设置后保存，用于展示个人资料；问答偏好和推荐记录用于帮助生成更合适的推荐。'
  },
  {
    title: '推荐说明',
    content:
      '推荐结果会综合你的问答偏好、附近餐厅、预算、距离、口味和历史记录等信息计算。若暂时没有推荐结果，可能是附近缺少符合条件的餐厅、定位或网络异常，或筛选条件过窄，可以稍后重试或放宽偏好。'
  },
  {
    title: '数据来源',
    content: '餐厅信息来自互联网公开信息。人均、营业状态等字段可能存在偏差，请以实际店铺为准。'
  }
];

Page({
  data: {
    nickname: DEFAULT_NICKNAME,
    avatarUrl: '',
    statusText: '主动设置头像昵称，吃饭决定更有归属感',
    actions: ACTIONS,
    guideVisible: false,
    guideSections: GUIDE_SECTIONS,
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
      nickname: profile?.nickname || DEFAULT_NICKNAME,
      avatarUrl: profile?.avatarUrl || ''
    });
  },

  onChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl?: string }>) {
    const avatarUrl = event.detail.avatarUrl;

    if (!avatarUrl) {
      return;
    }

    this.saveProfile({
      nickname: this.data.nickname === DEFAULT_NICKNAME ? '' : this.data.nickname,
      avatarUrl
    });
  },

  onNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({
      nickname: event.detail.value || ''
    });
  },

  onNicknameConfirm(event: WechatMiniprogram.Input) {
    this.commitNickname(event.detail.value);
  },

  onNicknameBlur(event: WechatMiniprogram.Input) {
    this.commitNickname(event.detail.value);
  },

  commitNickname(value: string) {
    const nickname = normalizeNickname(value);

    this.saveProfile({
      nickname,
      avatarUrl: this.data.avatarUrl
    });
  },

  saveProfile(nextProfile: Pick<UserProfile, 'nickname' | 'avatarUrl'>) {
    const profile: UserProfile = {
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

  onActionTap(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key as string | undefined;

    if (!key) {
      return;
    }

    if (key === 'clearCache') {
      this.confirmClearCache();
      return;
    }

    if (key === 'feedback') {
      return;
    }

    if (key === 'guide') {
      this.setData({ guideVisible: true });
    }
  },

  closeGuideModal() {
    this.setData({ guideVisible: false });
  },

  noop() {
    return;
  },

  confirmClearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除当前设备上的头像昵称和推荐记录缓存，历史页不会再显示旧记录。',
      confirmText: '清除',
      confirmColor: '#e5484d',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        wx.removeStorageSync(USER_PROFILE_STORAGE_KEY);
        clearLocalRecommendationHistory();

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
  }
});

function getStoredProfile(): UserProfile | undefined {
  const profile = wx.getStorageSync(USER_PROFILE_STORAGE_KEY) as UserProfile | undefined;

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

function normalizeNickname(value: string | undefined): string {
  const nickname = typeof value === 'string' ? value.trim() : '';

  return nickname || DEFAULT_NICKNAME;
}

async function syncUserProfile(profile: UserProfile): Promise<void> {
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
