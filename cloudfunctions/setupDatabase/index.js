const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const COLLECTIONS = ['users', 'recommendation_history'];

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || createRequestId();

  try {
    const results = [];

    for (const name of COLLECTIONS) {
      results.push(await ensureCollection(name));
    }

    return {
      ok: true,
      data: {
        collections: results,
        indexes: [
          {
            collection: 'recommendation_history',
            fields: ['_openid', 'createdAt']
          },
          {
            collection: 'recommendation_history',
            fields: ['_openid', 'action', 'createdAt']
          },
          {
            collection: 'users',
            fields: ['_id']
          }
        ]
      },
      requestId
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'SETUP_DATABASE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to setup database.'
      },
      requestId
    };
  }
};

async function ensureCollection(name) {
  const database = cloud.database();

  try {
    await database.collection(name).limit(1).get();

    return {
      name,
      status: 'exists'
    };
  } catch (error) {
    await database.createCollection(name);

    return {
      name,
      status: 'created'
    };
  }
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
