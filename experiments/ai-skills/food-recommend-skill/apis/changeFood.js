const {
  MAX_SWITCH_COUNT,
  errorResult,
  formatCandidate,
  readState,
  saveState,
  successResult,
  trackAction
} = require('./_shared.js')

async function changeFood(params = {}) {
  const state = readState()
  const candidates = Array.isArray(state.candidates) ? state.candidates : []
  const previousCandidateId = params.previousCandidateId

  if (!previousCandidateId) {
    return errorResult('换一家需要基于上一张推荐卡片，不能凭空生成 candidateId。', {
      code: 'MISSING_PREVIOUS_CANDIDATE_ID'
    })
  }

  if (candidates.length === 0) {
    return errorResult('当前没有可切换的推荐上下文，请先让 AI 推荐一次。', {
      code: 'MISSING_RECOMMENDATION_CONTEXT'
    })
  }

  const currentIndex = typeof state.currentIndex === 'number' ? state.currentIndex : 0
  const switchCount = typeof state.switchCount === 'number' ? state.switchCount : 0

  if (switchCount >= MAX_SWITCH_COUNT) {
    return errorResult('连续换一家次数已达上限，请先锁定当前结果或重新发起推荐。', {
      code: 'SWITCH_LIMIT_REACHED',
      maxSwitchCount: MAX_SWITCH_COUNT
    })
  }

  const previousCandidate = candidates.find((candidate) => {
    return formatCandidate(candidate).candidateId === previousCandidateId
  })

  if (!previousCandidate) {
    return errorResult('previousCandidateId 必须来自上一张推荐卡片，不能由 AI 猜测。', {
      code: 'INVALID_PREVIOUS_CANDIDATE_ID'
    })
  }

  const nextIndex = currentIndex + 1
  const nextCandidate = candidates[nextIndex]

  if (!nextCandidate) {
    return errorResult('没有更多新候选，本轮推荐已锁定。', {
      code: 'NO_MORE_CANDIDATES',
      fallbackReason: '候选池不足，不能伪造新的门店。'
    })
  }

  const nextSwitchCount = switchCount + 1
  const questionnaire = state.questionnaire

  if (state.previewMode !== true) {
    void trackAction('skipped', previousCandidate, questionnaire, nextSwitchCount).catch((error) => {
      console.warn('[food-recommend-skill] Failed to track skipped recommendation.', error)
    })

    void trackAction('shown', nextCandidate, questionnaire, nextSwitchCount).catch((error) => {
      console.warn('[food-recommend-skill] Failed to track shown recommendation.', error)
    })
  }

  saveState({
    ...state,
    currentIndex: nextIndex,
    switchCount: nextSwitchCount
  })

  return successResult('已换一家，新的推荐卡片如下。', formatCandidate(nextCandidate), {
    componentHint: 'food-recommend-card',
    switchCount: nextSwitchCount,
    maxSwitchCount: MAX_SWITCH_COUNT
  })
}

module.exports = changeFood
