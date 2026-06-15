const {
  formatCandidate,
  loadCandidates,
  saveState,
  successResult,
  trackAction
} = require('./_shared.js')

async function recommendFood(params = {}) {
  const loaded = await loadCandidates(params)

  if (loaded.error) {
    return loaded.error
  }

  const candidates = loaded.candidates || []
  const candidate = candidates[0]

  if (!candidate) {
    return {
      isError: true,
      content: [{ type: 'text', text: '没有找到可推荐的附近美食。' }],
      structuredContent: {},
      _meta: {
        code: 'EMPTY_CANDIDATE_POOL',
        fallbackReason: '候选池为空，不能伪造推荐结果。'
      }
    }
  }

  const structuredContent = formatCandidate(candidate)
  saveState({
    candidates,
    currentIndex: 0,
    switchCount: 0,
    questionnaire: loaded.questionnaire,
    historyContext: loaded.historyContext,
    lastParams: params,
    previewMode: loaded.previewMode === true
  })

  if (loaded.previewMode !== true) {
    void trackAction('shown', candidate, loaded.questionnaire, 0).catch((error) => {
      console.warn('[food-recommend-skill] Failed to track shown recommendation.', error)
    })
  }

  return successResult('已按这次偏好生成推荐卡片。', structuredContent, {
    componentHint: 'food-recommend-card',
    previewMode: loaded.previewMode === true
  })
}

module.exports = recommendFood
