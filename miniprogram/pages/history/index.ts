import type { MealHistoryItem } from '../../models/meal';
import { getHistory } from '../../services/historyService';
import type { RecommendationAction, RecommendationSource } from '../../types/recommendation';

type HistoryFilter = 'all' | 'accepted' | 'skipped';

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
      { value: 'accepted', label: '已采纳' },
      { value: 'skipped', label: '已跳过' }
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
      subtitleText:
        item.restaurantName && item.mealName !== item.restaurantName
          ? `推荐菜：${item.mealName}`
          : '推荐菜待补充',
      actionText: getActionText(item.action),
      sourceText: getSourceText(item.source),
      matchText:
        typeof item.matchPercent === 'number' ? `${Math.round(item.matchPercent)}% 匹配` : '匹配度未知',
      reasonText: item.reasonSummary || item.note || '暂无推荐理由摘要'
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

  if (filter === 'skipped') {
    return history.filter((item) => item.action === 'skipped');
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
    accepted: '还没有采纳记录',
    skipped: '还没有跳过记录'
  };

  return emptyTextMap[filter];
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
