import type { MealHistoryItem } from '../../models/meal';
import { getHistory } from '../../services/historyService';
import type { RecommendationAction, RecommendationSource } from '../../types/recommendation';

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
    history: [] as HistoryViewItem[],
    loading: false,
    emptyText: '还没有推荐历史'
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

      this.setData({
        history: history.map(this.toHistoryViewItem),
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
