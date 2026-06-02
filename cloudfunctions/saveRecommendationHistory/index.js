const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const COLLECTION_NAME = 'recommendation_history';
const VALID_ACTIONS = new Set(['shown', 'accepted', 'skipped', 'dismissed']);
const VALID_SOURCES = new Set(['amap', 'cloud', 'mock', 'rule', 'manual']);

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || createRequestId();

  try {
    const wxContext = cloud.getWXContext();
    const record = normalizeRecord(event.record, wxContext.OPENID);
    const database = cloud.database();
    const result = await database.collection(COLLECTION_NAME).add({
      data: record
    });
    const savedRecord = {
      ...record,
      _id: result._id
    };

    return {
      ok: true,
      data: {
        record: savedRecord
      },
      requestId
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'SAVE_RECOMMENDATION_HISTORY_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to save recommendation history.'
      },
      requestId
    };
  }
};

function normalizeRecord(record, openid) {
  if (!record || typeof record !== 'object') {
    throw new Error('record is required.');
  }

  if (!record.candidateId || !record.mealName) {
    throw new Error('candidateId and mealName are required.');
  }

  const now = new Date().toISOString();
  const action = VALID_ACTIONS.has(record.action) ? record.action : 'shown';
  const source = VALID_SOURCES.has(record.source) ? record.source : 'rule';

  return removeUndefined({
    _openid: openid,
    id: record.id || `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: record.userId,
    recommendationId: record.recommendationId,
    candidateId: record.candidateId,
    restaurantId: record.restaurantId,
    mealName: String(record.mealName),
    restaurantName: record.restaurantName ? String(record.restaurantName) : undefined,
    tags: Array.isArray(record.tags) ? record.tags.slice(0, 20) : [],
    dateText: record.dateText,
    note: record.note,
    reasonSummary: record.reasonSummary,
    action,
    selectedAt: normalizeIsoDate(record.selectedAt) || now,
    createdAt: normalizeIsoDate(record.createdAt) || now,
    updatedAt: now,
    source,
    matchPercent: normalizePercent(record.matchPercent),
    switchCount: normalizeSwitchCount(record.switchCount),
    questionnaire: normalizeQuestionnaire(record.questionnaire)
  });
}

function normalizeQuestionnaire(questionnaire) {
  if (!questionnaire || typeof questionnaire !== 'object') {
    return undefined;
  }

  return removeUndefined({
    version: questionnaire.version,
    answerCount:
      typeof questionnaire.answerCount === 'number'
        ? Math.max(0, Math.floor(questionnaire.answerCount))
        : Array.isArray(questionnaire.answers)
          ? questionnaire.answers.length
          : 0,
    submittedAt: normalizeIsoDate(questionnaire.submittedAt),
    answers: Array.isArray(questionnaire.answers) ? questionnaire.answers : []
  });
}

function normalizeIsoDate(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizePercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSwitchCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
