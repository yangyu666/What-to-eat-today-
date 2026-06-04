const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const COLLECTION_NAME = 'recommendation_history';
const VALID_ACTIONS = new Set(['shown', 'accepted', 'skipped', 'dismissed']);
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || createRequestId();

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      throw new Error('OPENID is required.');
    }

    const database = cloud.database();
    const command = database.command;
    const pageSize = normalizePageSize(event.pageSize);
    const query = removeUndefined({
      _openid: openid,
      action: VALID_ACTIONS.has(event.action) ? event.action : undefined,
      createdAt: event.cursor ? command.lt(event.cursor) : undefined
    });
    const response = await database
      .collection(COLLECTION_NAME)
      .where(query)
      .orderBy('createdAt', 'desc')
      .limit(pageSize + 1)
      .get();
    const records = Array.isArray(response.data) ? response.data : [];
    const hasMore = records.length > pageSize;
    const items = records.slice(0, pageSize).map(toClientRecord);
    const lastItem = items[items.length - 1];

    return {
      ok: true,
      data: {
        items,
        nextCursor: hasMore && lastItem ? lastItem.createdAt : undefined,
        hasMore
      },
      requestId
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'LIST_HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list history.'
      },
      requestId
    };
  }
};

function toClientRecord(record) {
  const { _openid, ...clientRecord } = record;

  return clientRecord;
}

function normalizePageSize(value) {
  const pageSize = Number(value);

  if (!Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
