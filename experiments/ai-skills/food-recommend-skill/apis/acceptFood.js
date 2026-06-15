const {
  errorResult,
  findCandidate,
  readState,
  successResult,
  trackAction
} = require('./_shared.js')

async function acceptFood(params = {}) {
  const candidateId = params.candidateId
  const restaurantId = params.restaurantId
  const name = params.name

  if (!candidateId || !restaurantId) {
    return errorResult('采纳推荐必须使用上游推荐卡片返回的 candidateId 和 restaurantId。', {
      code: 'MISSING_ACCEPT_IDS'
    })
  }

  const state = readState()
  const candidate = findCandidate(state, candidateId, restaurantId)

  if (!candidate) {
    return errorResult('未找到对应推荐上下文，不能用 AI 猜测的 ID 保存历史。', {
      code: 'INVALID_ACCEPT_TARGET'
    })
  }

  const restaurantName = candidate.restaurant && candidate.restaurant.name
  const candidateName = restaurantName || candidate.mealName || candidate.name

  if (name && candidateName && name !== candidateName) {
    return errorResult('name 与上游推荐卡片不一致，请基于卡片原值重新采纳。', {
      code: 'ACCEPT_NAME_MISMATCH'
    })
  }

  try {
    const record = await trackAction(
      'accepted',
      candidate,
      state.questionnaire,
      typeof state.switchCount === 'number' ? state.switchCount : 0
    )

    return successResult('已保存到推荐历史。', {
      success: true,
      savedHistoryId: record.id,
      message: `已记录：就吃${candidateName || '这家'}。`
    })
  } catch (error) {
    const message = error && error.message ? error.message : String(error || '')
    return errorResult('保存推荐历史失败，请稍后再试。', {
      code: 'SAVE_HISTORY_FAILED',
      details: message
    })
  }
}

module.exports = acceptFood
