import type { MealHistoryItem } from '../../models/meal';
import { getHistory } from '../../services/historyService';
import type { RecommendationAction, RecommendationSource } from '../../types/recommendation';

type HistoryFilter = 'all' | 'accepted';

const TAG_LABEL_MAP: Record<string, string> = {
  afternoon_tea: '下午茶',
  allergy_sensitive: '过敏友好',
  bbq: '烧烤',
  breakfast: '早餐',
  burger: '汉堡',
  chain_brand: '连锁品牌',
  coffee: '咖啡',
  cold: '清爽',
  comfort: '暖胃',
  congee: '粥粉面',
  customizable: '可定制',
  dessert: '甜品',
  dim_sum: '点心',
  dinner: '晚餐',
  drink: '饮品',
  dry_pot: '干锅',
  fresh: '清新',
  fried: '油炸',
  group: '多人聚餐',
  halal: '清真',
  healthy: '健康',
  high_protein: '高蛋白',
  hot: '热乎',
  hotpot: '火锅',
  independent_store: '街边小店',
  late_night: '夜宵',
  light: '清淡',
  low_burden: '低负担',
  low_carb: '低碳',
  low_chain: '大众连锁',
  lunch: '午餐',
  maocai: '冒菜',
  meal: '正餐',
  mid_chain: '品质连锁',
  milk_tea: '奶茶',
  noodle: '面食',
  non_meal: '非正餐',
  not_spicy: '不辣',
  premium_brand: '高品质品牌',
  quick: '出餐快',
  relaxed: '放松',
  rice: '米饭',
  salad: '沙拉',
  set_meal: '套餐',
  sichuan: '川菜',
  slow: '慢节奏',
  snack: '小吃',
  solo: '一人食',
  spicy: '辣味',
  staple: '主食',
  street_shop: '街边小店',
  strong_flavor: '重口味',
  sweet: '甜口',
  sugary_drink: '含糖饮品',
  vegetarian: '素食友好',
  western: '西式'
};

const ENGLISH_REASON_MAP: Record<string, string> = {
  'brand preference conflicts with independent store': '品牌偏好与街边小店不完全匹配',
  'drink intent conflicts with restaurant candidate': '想喝点东西，但候选更偏正餐',
  'drink intent conflicts with snack or dim sum candidate': '想喝点东西，但候选更偏小吃点心',
  'explicit coffee intent conflicts with milk tea candidate': '咖啡偏好与奶茶候选不完全匹配',
  'explicit milk tea intent conflicts with coffee candidate': '奶茶偏好与咖啡候选不完全匹配',
  'independent store preference conflicts with chain brand': '街边小店偏好与连锁品牌不完全匹配',
  'price clearly below requested budget': '价格低于预算偏好',
  'price unknown for strict high budget': '价格信息暂不明确',
  'temperature preference conflict': '温度偏好不完全匹配',
  'wanted cold or light food, candidate is hot-heavy': '想吃清爽一点，但候选偏热乎厚重',
  'wanted hot food, candidate is cold or light': '想吃热乎一点，但候选偏清爽'
};

interface HistoryViewItem extends MealHistoryItem {
  titleText: string;
  subtitleText: string;
  actionText: string;
  sourceText: string;
  matchText: string;
  reasonText: string;
}

Page({
  data: {
    allHistory: [] as MealHistoryItem[],
    history: [] as HistoryViewItem[],
    loading: false,
    activeFilter: 'accepted' as HistoryFilter,
    emptyText: '还没有采纳记录',
    filterTabs: [
      { value: 'all', label: '全部' },
      { value: 'accepted', label: '已采纳' }
    ] as Array<{ value: HistoryFilter; label: string }>
  },

  onLoad() {
    this.loadHistory();
  },

  onShow() {
    this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true });

    try {
      const history = await getHistory();
      const activeFilter = this.data.activeFilter as HistoryFilter;

      this.setData({
        allHistory: history,
        history: filterHistory(history, activeFilter).map(this.toHistoryViewItem),
        emptyText: getEmptyText(activeFilter),
        loading: false
      });
    } catch (error) {
      console.error('Failed to load recommendation history.', error);
      this.setData({
        history: [],
        loading: false
      });
      wx.showToast({
        title: '历史记录加载失败',
        icon: 'none'
      });
    }
  },

  changeFilter(event: WechatMiniprogram.TouchEvent) {
    const activeFilter = event.currentTarget.dataset.filter as HistoryFilter | undefined;

    if (!activeFilter || activeFilter === this.data.activeFilter) {
      return;
    }

    this.setData({
      activeFilter,
      history: filterHistory(this.data.allHistory, activeFilter).map(this.toHistoryViewItem),
      emptyText: getEmptyText(activeFilter)
    });
  },

  toHistoryViewItem(item: MealHistoryItem): HistoryViewItem {
    return {
      ...item,
      titleText: item.restaurantName || item.mealName,
      dateText: getDisplayDateText(item),
      subtitleText:
        item.restaurantName && item.mealName !== item.restaurantName
          ? `推荐菜：${item.mealName}`
          : '推荐菜待补充',
      actionText: getActionText(item.action),
      sourceText: getSourceText(item.source),
      matchText:
        typeof item.matchPercent === 'number' ? `${Math.round(item.matchPercent)}% 匹配` : '匹配度未知',
      reasonText: getDisplayReasonText(item)
    };
  }
});

function getActionText(action?: RecommendationAction): string {
  const actionTextMap: Record<RecommendationAction, string> = {
    shown: '已展示',
    skipped: '已跳过',
    accepted: '已采纳',
    dismissed: '已关闭'
  };

  return action ? actionTextMap[action] : '已记录';
}

function filterHistory(history: MealHistoryItem[], filter: HistoryFilter): MealHistoryItem[] {
  if (filter === 'accepted') {
    return history.filter((item) => item.action === 'accepted');
  }

  return [...history].sort((left, right) => getActionPriority(left.action) - getActionPriority(right.action));
}

function getActionPriority(action?: RecommendationAction): number {
  if (action === 'accepted') {
    return 0;
  }

  if (action === 'skipped') {
    return 1;
  }

  if (action === 'shown') {
    return 2;
  }

  return 3;
}

function getEmptyText(filter: HistoryFilter): string {
  const emptyTextMap: Record<HistoryFilter, string> = {
    all: '还没有推荐历史',
    accepted: '还没有采纳记录'
  };

  return emptyTextMap[filter];
}

function getDisplayReasonText(item: MealHistoryItem): string {
  return localizeReasonText(item.reasonSummary || item.note) || '暂无推荐理由摘要';
}

function getDisplayDateText(item: MealHistoryItem): string {
  const rawDate = item.createdAt || item.selectedAt;

  if (!rawDate) {
    return item.dateText;
  }

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return item.dateText;
  }

  return formatHistoryDate(date);
}

function formatHistoryDate(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfTarget - startOfToday) / 86400000);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (dayDiff === 0) {
    return `今天 ${time}`;
  }

  if (dayDiff === -1) {
    return `昨天 ${time}`;
  }

  return `${date.getMonth() + 1}-${date.getDate()} ${time}`;
}

function localizeReasonText(text?: string): string {
  if (!text) {
    return '';
  }

  let result = text;

  Object.entries(ENGLISH_REASON_MAP).forEach(([englishText, chineseText]) => {
    result = result.replace(new RegExp(escapeRegExp(englishText), 'gi'), chineseText);
  });

  result = result.replace(/[A-Za-z][A-Za-z0-9_]*/g, (token) => TAG_LABEL_MAP[token] ?? '');

  return result
    .replace(/\s+/g, ' ')
    .replace(/匹配\s+/g, '匹配')
    .replace(/\s+等偏好/g, '等偏好')
    .replace(/[、，,]\s*[、，,]+/g, '、')
    .replace(/[、，,]\s*等/g, '等')
    .replace(/[:：]\s*[；;，,、]/g, '：')
    .replace(/[\s、，,；;:：]+$/g, '')
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSourceText(source?: RecommendationSource): string {
  const sourceTextMap: Record<RecommendationSource, string> = {
    amap: '高德',
    cloud: '云端',
    mock: '本地',
    rule: '规则',
    manual: '手动'
  };

  return source ? sourceTextMap[source] : '未知来源';
}
