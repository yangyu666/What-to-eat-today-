const HISTORY_STORAGE_KEY = 'meal_recommendation_history';
const MAX_LOCAL_HISTORY = 50;
const SAVE_HISTORY_FUNCTION_NAME = 'saveRecommendationHistory';
const RECOMMENDATION_HISTORY_COLLECTION = 'recommendation_history';
const CLOUD_ENV_ID = 'cloud1-d7g5ft07k29226d0e';

let cloudInitialized = false;

async function trackRecommendationAction(options) {
  const record = buildHistoryRecord(options);

  saveHistoryRecordLocal(record);
  saveHistoryRecordCloud(record).catch((error) => {
    console.warn('Fallback to local history after cloud history save failed.', error);
  });

  return record;
}

async function getHistory() {
  try {
    const cloudHistory = await getCloudHistory();

    if (cloudHistory.length > 0) {
      syncLocalHistory(cloudHistory);
      return cloudHistory;
    }
  } catch (error) {
    console.warn('Fallback to local history after cloud history query failed.', error);
  }

  return getLocalHistory();
}

function getLocalHistory() {
  try {
    const history = wx.getStorageSync(HISTORY_STORAGE_KEY);

    return Array.isArray(history) ? history.slice(0, MAX_LOCAL_HISTORY) : [];
  } catch (error) {
    console.warn('Failed to read local recommendation history.', error);
    return [];
  }
}

function buildHistoryRecord(options) {
  const now = new Date();
  const candidate = options.candidate;
  const restaurant = candidate && candidate.restaurant;
  const selectedAt = now.toISOString();
  const restaurantId = candidate.restaurantId || (restaurant && restaurant.id);
  const restaurantName = (restaurant && restaurant.name) || candidate.name;
  const reasonSummary = buildReasonSummary(candidate);

  return {
    id: `history-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    candidateId: candidate.id,
    restaurantId,
    mealName: candidate.mealName || candidate.name,
    restaurantName,
    tags: candidate.tags || [],
    dateText: formatDateText(now),
    note: buildHistoryNote(candidate, options.switchCount || 0),
    reasonSummary,
    action: options.action,
    selectedAt,
    createdAt: selectedAt,
    updatedAt: selectedAt,
    source: inferRecommendationSource(candidate),
    matchPercent:
      typeof candidate.confidenceScore === 'number'
        ? Math.round(candidate.confidenceScore)
        : undefined,
    switchCount: options.switchCount || 0,
    questionnaire: buildQuestionnaireSnapshot(options.questionnaire)
  };
}

function saveHistoryRecordLocal(record) {
  const history = getLocalHistory();
  const deduped = history.filter((item) => item.id !== record.id);

  wx.setStorageSync(HISTORY_STORAGE_KEY, [record, ...deduped].slice(0, MAX_LOCAL_HISTORY));
}

function syncLocalHistory(records) {
  const localHistory = getLocalHistory();
  const recordMap = new Map();

  [...records, ...localHistory].forEach((record) => {
    recordMap.set(record.id, record);
  });

  wx.setStorageSync(
    HISTORY_STORAGE_KEY,
    [...recordMap.values()]
      .sort((left, right) => getRecordTime(right) - getRecordTime(left))
      .slice(0, MAX_LOCAL_HISTORY)
  );
}

async function saveHistoryRecordCloud(record) {
  ensureCloudInitialized();

  const response = await wx.cloud.callFunction({
    name: SAVE_HISTORY_FUNCTION_NAME,
    data: {
      record
    }
  });
  const payload = response && response.result;

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error.message : 'Cloud history save failed.');
  }
}

async function getCloudHistory() {
  ensureCloudInitialized();

  const response = await wx.cloud
    .database()
    .collection(RECOMMENDATION_HISTORY_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(MAX_LOCAL_HISTORY)
    .get();
  const data = response && response.data;

  return Array.isArray(data) ? data.map(normalizeHistoryRecord) : [];
}

function normalizeHistoryRecord(record) {
  const createdAt = normalizeIsoDate(record.createdAt) || new Date().toISOString();

  return {
    ...record,
    id: record.id || record._id || `history-${createdAt}`,
    dateText: record.dateText || formatDateText(new Date(createdAt)),
    createdAt,
    updatedAt: normalizeIsoDate(record.updatedAt) || createdAt
  };
}

function buildQuestionnaireSnapshot(questionnaire) {
  if (!questionnaire) {
    return undefined;
  }

  return {
    version: questionnaire.version,
    answerCount: questionnaire.answers ? questionnaire.answers.length : 0,
    submittedAt: questionnaire.submittedAt,
    answers: questionnaire.answers
  };
}

function ensureCloudInitialized() {
  if (!wx.cloud) {
    throw new Error('Current base library does not support cloud development.');
  }

  if (cloudInitialized) {
    return;
  }

  wx.cloud.init({
    env: CLOUD_ENV_ID,
    traceUser: true
  });
  cloudInitialized = true;
}

function buildHistoryNote(candidate, switchCount) {
  const parts = [];

  if (typeof candidate.confidenceScore === 'number') {
    parts.push(`${Math.round(candidate.confidenceScore)}% 匹配`);
  }

  if (switchCount > 0) {
    parts.push(`换了 ${switchCount} 次`);
  }

  const reasonSummary = buildReasonSummary(candidate);

  if (reasonSummary) {
    parts.push(reasonSummary);
  }

  return parts.join(' · ');
}

function buildReasonSummary(candidate) {
  if (!candidate.reason) {
    return undefined;
  }

  const [firstReason] = candidate.reason.split(/[；;，,]/).filter(Boolean);

  return firstReason ? firstReason.trim() : undefined;
}

function inferRecommendationSource(candidate) {
  const restaurant = candidate.restaurant;

  if (candidate.source) {
    return candidate.source;
  }

  if (
    (candidate.restaurantId && candidate.restaurantId.indexOf('amap-') === 0) ||
    (restaurant && restaurant.id && restaurant.id.indexOf('amap-') === 0)
  ) {
    return 'amap';
  }

  if (
    (candidate.restaurantId && candidate.restaurantId.indexOf('mock-') === 0) ||
    (restaurant && restaurant.id && restaurant.id.indexOf('mock-') === 0)
  ) {
    return 'mock';
  }

  return 'rule';
}

function formatDateText(date) {
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

function normalizeIsoDate(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getRecordTime(record) {
  const timestamp = new Date(record.createdAt || record.selectedAt || '').getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

module.exports = {
  trackRecommendationAction,
  getHistory,
  getLocalHistory
};
