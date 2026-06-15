const { getLocalRecommendations } = require('../../../services/mealService.js')
const {
  getHistory,
  getRecentHistoryFilterContext,
  trackRecommendationAction
} = require('../../../services/historyService.js')
const { hasLocationConsent } = require('../../../services/privacyConsent.js')

const PREVIEW_MODE_KEY = 'mp_skills_preview_mode'
const STATE_KEY = 'food_recommend_skill_state_v1'
const MAX_SWITCH_COUNT = 3

function isPreviewMode() {
  try {
    return wx.getStorageSync(PREVIEW_MODE_KEY) !== false
  } catch (error) {
    console.warn('[food-recommend-skill] Failed to read preview mode.', error)
    return true
  }
}

function successResult(message, structuredContent, meta) {
  return {
    isError: false,
    content: [{ type: 'text', text: message }],
    structuredContent,
    _meta: meta || {}
  }
}

function errorResult(message, details) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: {},
    _meta: details || {}
  }
}

function nowIso() {
  return new Date().toISOString()
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.max(min, Math.min(max, numberValue))
}

function pushAnswer(answers, questionId, value, optionId) {
  answers.push({
    questionId,
    type: 'single',
    value,
    optionIds: optionId ? [optionId] : [],
    answeredAt: nowIso()
  })
}

function buildQuestionnaire(params) {
  const answers = []
  const taste = params.taste || 'any'
  const mealType = params.mealType || 'any'
  const temperature = params.temperature || 'any'
  const speed = params.speed || 'normal'
  const scene = params.scene || 'any'
  const budgetLevel = clampNumber(params.budgetLevel, 1, 5, 2)
  const maxDistanceMeters = clampNumber(params.maxDistanceMeters, 300, 10000, 1500)
  const avoidTags = Array.isArray(params.avoidTags) ? params.avoidTags.join(' ') : ''

  if (taste === 'light') {
    pushAnswer(answers, 'flavor', 'light', 'flavor_light')
    pushAnswer(answers, 'health', 'light_burden', 'health_light')
  } else if (taste === 'spicy') {
    pushAnswer(answers, 'spice_tolerance', 'spicy_ok', 'spice_yes')
  } else if (taste === 'heavy') {
    pushAnswer(answers, 'flavor', 'strong', 'flavor_strong')
  }

  if (/辣|spicy|麻辣|川|湘/.test(avoidTags)) {
    pushAnswer(answers, 'spice_tolerance', 'no_spicy', 'spice_no')
    pushAnswer(answers, 'avoidance', 'avoid_spicy', 'avoidance_spicy')
  }

  if (/油|腻|炸|fried|greasy|heavy/.test(avoidTags)) {
    pushAnswer(answers, 'avoidance', 'avoid_greasy', 'avoidance_greasy')
  }

  const budgetMap = {
    1: ['under_30', 'budget_under_30'],
    2: ['30_60', 'budget_30_60'],
    3: ['60_100', 'budget_60_100'],
    4: ['100_200', 'budget_100_200'],
    5: ['over_200', 'budget_over_200']
  }
  const budget = budgetMap[budgetLevel] || budgetMap[2]
  pushAnswer(answers, 'budget', budget[0], budget[1])

  if (maxDistanceMeters <= 500) {
    pushAnswer(answers, 'distance', 500, 'distance_500m')
  } else if (maxDistanceMeters <= 1000) {
    pushAnswer(answers, 'distance', 1000, 'distance_1km')
  } else {
    pushAnswer(answers, 'distance', 'any', 'distance_any')
  }

  if (mealType === 'meal') {
    pushAnswer(answers, 'meal_intent', 'meal', 'intent_meal')
  } else if (mealType === 'snack') {
    pushAnswer(answers, 'meal_type', 'snack', 'meal_type_snack')
  } else if (mealType === 'drink') {
    pushAnswer(answers, 'meal_intent', 'drink', 'intent_drink')
  } else if (mealType === 'dessert') {
    pushAnswer(answers, 'meal_intent', 'dessert', 'intent_dessert')
  }

  if (temperature === 'hot') {
    pushAnswer(answers, 'temperature', 'hot', 'temperature_hot')
  } else if (temperature === 'cold') {
    pushAnswer(answers, 'temperature', 'cold', 'temperature_cold')
  }

  if (speed === 'fast') {
    pushAnswer(answers, 'speed', 'fast', 'speed_fast')
  } else if (speed === 'relaxed') {
    pushAnswer(answers, 'speed', 'slow', 'speed_slow')
  }

  if (scene === 'solo') {
    pushAnswer(answers, 'scene', 'solo', 'scene_solo')
  } else if (scene === 'group') {
    pushAnswer(answers, 'scene', 'group', 'scene_group')
  }

  return {
    id: `food-skill-questionnaire-${Date.now()}`,
    version: 'food-recommend-skill-v1',
    source: 'recommendation_filter',
    answers,
    submittedAt: nowIso()
  }
}

function getHistoryContext(enabled) {
  if (enabled === false) {
    return {
      historyFilterEnabled: false,
      excludedHistoryRestaurantIds: [],
      historyPenaltyRestaurantIds: [],
      historyPenaltyReasons: []
    }
  }

  return getRecentHistoryFilterContext()
}

function formatDistanceText(distanceMeters) {
  if (typeof distanceMeters !== 'number') {
    return '距离未知'
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`
}

function estimateMinutes(candidate) {
  if (typeof candidate.estimatedMinutes === 'number') {
    return candidate.estimatedMinutes
  }

  const distanceMeters = candidate.restaurant && candidate.restaurant.distanceMeters
  return typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : 0
}

function inferSource(candidate) {
  if (candidate.source) {
    return candidate.source
  }

  if (
    candidate.restaurantId && candidate.restaurantId.indexOf('amap-') === 0 ||
    candidate.restaurant && candidate.restaurant.id && candidate.restaurant.id.indexOf('amap-') === 0
  ) {
    return 'amap'
  }

  if (
    candidate.restaurantId && candidate.restaurantId.indexOf('mock-') === 0 ||
    candidate.restaurant && candidate.restaurant.id && candidate.restaurant.id.indexOf('mock-') === 0
  ) {
    return 'mock'
  }

  return 'rule'
}

function formatCandidate(candidate) {
  const restaurant = candidate.restaurant || {}
  const restaurantId = candidate.restaurantId || restaurant.id || ''
  const distanceMeters = restaurant.distanceMeters
  const averageCost = typeof restaurant.averageCostYuan === 'number' ? restaurant.averageCostYuan : 0
  const reasonParts = String(candidate.reason || '')
    .split(/[；;，,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    candidateId: candidate.id || '',
    restaurantId,
    name: restaurant.name || candidate.mealName || candidate.name || '推荐美食',
    distanceText: formatDistanceText(distanceMeters),
    estimatedMinutes: estimateMinutes(candidate),
    averageCost,
    matchPercent: Math.round(candidate.confidenceScore || candidate.score || 0),
    tags: Array.isArray(candidate.tags) ? candidate.tags.slice(0, 6) : [],
    reasons: reasonParts.length > 0 ? reasonParts.slice(0, 4) : ['符合本次偏好'],
    fallbackReason: candidate.fallbackReason || '',
    source: inferSource(candidate),
    candidatePoolStats: candidate.candidatePoolStats || {
      totalFetched: 0,
      afterHardFilter: 0,
      afterNegativeFilter: 0,
      finalCandidateCount: 0,
      fallbackUsed: Boolean(candidate.fallbackReason)
    }
  }
}

function getMockCandidates(params) {
  const light = params.taste === 'light' || /辣|油|腻/.test((params.avoidTags || []).join(' '))
  const drink = params.mealType === 'drink'
  const dessert = params.mealType === 'dessert'
  const base = [
    {
      id: 'food-skill-mock-light-bowl',
      name: '清爽鸡胸轻食碗',
      mealName: '清爽鸡胸轻食碗',
      tags: ['清淡', '低负担', '出餐快'],
      reason: '少油少辣，预算友好，适合一个人快速解决',
      estimatedMinutes: 12,
      confidenceScore: light ? 86 : 74,
      restaurantId: 'mock-light-bowl',
      source: 'mock',
      restaurant: {
        id: 'mock-light-bowl',
        name: '轻盈食堂',
        distanceMeters: 480,
        averageCostYuan: 28
      },
      candidatePoolStats: {
        totalFetched: 3,
        afterHardFilter: 3,
        afterNegativeFilter: 3,
        finalCandidateCount: 3,
        fallbackUsed: false
      }
    },
    {
      id: 'food-skill-mock-congee',
      name: '皮蛋瘦肉粥',
      mealName: '皮蛋瘦肉粥',
      tags: ['热乎', '不辣', '粥粉面'],
      reason: '热乎不刺激，距离近，人均在预算内',
      estimatedMinutes: 10,
      confidenceScore: 82,
      restaurantId: 'mock-congee',
      source: 'mock',
      restaurant: {
        id: 'mock-congee',
        name: '巷口粥铺',
        distanceMeters: 650,
        averageCostYuan: 22
      },
      candidatePoolStats: {
        totalFetched: 3,
        afterHardFilter: 3,
        afterNegativeFilter: 3,
        finalCandidateCount: 3,
        fallbackUsed: false
      }
    },
    {
      id: 'food-skill-mock-tea',
      name: dessert ? '芋泥甜品杯' : '低糖茉莉茶',
      mealName: dessert ? '芋泥甜品杯' : '低糖茉莉茶',
      tags: dessert ? ['甜品', '下午茶', '轻食'] : ['饮品', '低糖', '清爽'],
      reason: drink || dessert ? '匹配饮品甜点意图，适合轻量解馋' : '作为轻量备选，不会冒充正餐高匹配',
      estimatedMinutes: 8,
      confidenceScore: drink || dessert ? 84 : 62,
      fallbackReason: drink || dessert ? '' : '主餐候选不足时的低信心备选',
      restaurantId: 'mock-tea',
      source: 'mock',
      restaurant: {
        id: 'mock-tea',
        name: dessert ? '甜口研究所' : '茶饮小站',
        distanceMeters: 720,
        averageCostYuan: dessert ? 32 : 18
      },
      candidatePoolStats: {
        totalFetched: 3,
        afterHardFilter: 3,
        afterNegativeFilter: 3,
        finalCandidateCount: 3,
        fallbackUsed: !(drink || dessert)
      }
    }
  ]

  return base
}

async function loadCandidates(params) {
  if (!hasLocationConsent()) {
    return {
      error: errorResult('需要先在小程序内同意位置使用说明，才能推荐附近美食。', {
        code: 'LOCATION_CONSENT_REQUIRED',
        guide: '请回到首页完成位置授权后，再让 AI 推荐附近美食。'
      })
    }
  }

  const questionnaire = buildQuestionnaire(params || {})
  const historyContext = getHistoryContext((params || {}).historyFilterEnabled)

  if (isPreviewMode()) {
    return {
      candidates: getMockCandidates(params || {}),
      questionnaire,
      historyContext,
      previewMode: true
    }
  }

  try {
    const candidates = await getLocalRecommendations(questionnaire, historyContext)
    return {
      candidates,
      questionnaire,
      historyContext,
      previewMode: false
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error || '')
    return {
      error: errorResult('附近餐厅数据暂时不可用，已停止本次推荐。', {
        code: /quota|额度|配额|AMAP/i.test(message) ? 'AMAP_UNAVAILABLE' : 'NO_RECOMMENDATION',
        fallbackReason: `高德 POI 或候选池不可用：${message}`
      })
    }
  }
}

function readState() {
  try {
    const state = wx.getStorageSync(STATE_KEY)
    return state && typeof state === 'object' ? state : {}
  } catch (error) {
    console.warn('[food-recommend-skill] Failed to read state.', error)
    return {}
  }
}

function saveState(state) {
  try {
    wx.setStorageSync(STATE_KEY, {
      ...state,
      updatedAt: nowIso()
    })
  } catch (error) {
    console.warn('[food-recommend-skill] Failed to save state.', error)
  }
}

function findCandidate(state, candidateId, restaurantId) {
  const candidates = Array.isArray(state.candidates) ? state.candidates : []

  return candidates.find((candidate) => {
    const formatted = formatCandidate(candidate)
    return (
      formatted.candidateId === candidateId &&
      (!restaurantId || formatted.restaurantId === restaurantId)
    )
  })
}

async function trackAction(action, candidate, questionnaire, switchCount) {
  return trackRecommendationAction({
    action,
    candidate,
    questionnaire,
    switchCount: switchCount || 0
  })
}

module.exports = {
  MAX_SWITCH_COUNT,
  errorResult,
  findCandidate,
  formatCandidate,
  getHistory,
  loadCandidates,
  readState,
  saveState,
  successResult,
  trackAction
}
