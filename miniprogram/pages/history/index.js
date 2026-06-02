const { getHistory } = require('../../services/historyService');

Page({
  data: {
    history: [],
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
        history: history.map(toHistoryViewItem),
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
  }
});

function toHistoryViewItem(item) {
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

function getActionText(action) {
  const actionTextMap = {
    shown: '已展示',
    skipped: '已跳过',
    accepted: '已采纳',
    dismissed: '已关闭'
  };

  return action ? actionTextMap[action] : '已记录';
}

function getSourceText(source) {
  const sourceTextMap = {
    amap: '高德',
    cloud: '云端',
    mock: '本地',
    rule: '规则',
    manual: '手动'
  };

  return source ? sourceTextMap[source] : '未知来源';
}
