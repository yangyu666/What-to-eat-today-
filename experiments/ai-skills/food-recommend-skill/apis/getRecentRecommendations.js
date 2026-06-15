const {
  errorResult,
  getHistory,
  successResult
} = require('./_shared.js')

function formatHistoryItem(record) {
  return {
    historyId: record.id || '',
    candidateId: record.candidateId || '',
    restaurantId: record.restaurantId || '',
    name: record.restaurantName || record.mealName || '历史推荐',
    mealName: record.mealName || '',
    action: record.action || 'shown',
    dateText: record.dateText || '',
    matchPercent: record.matchPercent || 0,
    tags: Array.isArray(record.tags) ? record.tags.slice(0, 4) : [],
    reasonSummary: record.reasonSummary || record.note || '',
    fallbackReason: record.fallbackReason || '',
    source: record.source || 'rule'
  }
}

async function getRecentRecommendations(params = {}) {
  const pageSize = Math.max(1, Math.min(Number(params.pageSize) || 5, 20))

  try {
    const history = await getHistory()
    const items = history.slice(0, pageSize).map(formatHistoryItem)

    return successResult(
      items.length > 0 ? '已读取最近推荐历史。' : '最近还没有推荐历史。',
      {
        items
      },
      {
        componentHint: 'food-history-card',
        pageSize
      }
    )
  } catch (error) {
    const message = error && error.message ? error.message : String(error || '')
    return errorResult('读取历史推荐失败。', {
      code: 'LIST_HISTORY_FAILED',
      details: message
    })
  }
}

module.exports = getRecentRecommendations
