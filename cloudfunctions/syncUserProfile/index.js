const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const COLLECTION_NAME = 'users';

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || createRequestId();

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      throw new Error('OPENID is required.');
    }

    const now = new Date();
    const database = cloud.database();
    const userRef = database.collection(COLLECTION_NAME).doc(openid);
    const existingUser = await getExistingUser(userRef);
    const user = {
      openid,
      nickname: normalizeNickname(event.nickname),
      avatarUrl: normalizeAvatarUrl(event.avatarUrl),
      createdAt: existingUser && existingUser.createdAt ? existingUser.createdAt : now,
      updatedAt: now
    };

    await userRef.set({
      data: user
    });

    return {
      ok: true,
      data: {
        user: {
          _id: openid,
          ...user
        }
      },
      requestId
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'SYNC_USER_PROFILE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to sync user profile.'
      },
      requestId
    };
  }
};

async function getExistingUser(userRef) {
  try {
    const result = await userRef.get();

    return result.data || undefined;
  } catch (error) {
    return undefined;
  }
}

function normalizeNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : '';

  return nickname || '未登录用户';
}

function normalizeAvatarUrl(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
