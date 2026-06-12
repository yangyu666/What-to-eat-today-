const assert = require('assert');
const Module = require('module');
const {
  classifyAmapFailure,
  createSeedAmapKeyManager,
  parseAmapKeysFromEnv
} = require('./seedAmapCache');
const { validateStressCachePolicy } = require('./amapStressUtils');

const originalLoad = Module._load;
Module._load = function loadWithWxStub(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init() {},
      database() {
        throw new Error('database should not be used by amapKeySwitch.test.js');
      }
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const cloudAmap = require('../cloudfunctions/amapPoi/index');
Module._load = originalLoad;

const SECRET_1 = 'real-secret-key-one';
const SECRET_2 = 'real-secret-key-two';

function captureWarn(fn) {
  const originalWarn = console.warn;
  const lines = [];
  console.warn = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    fn(lines);
  } finally {
    console.warn = originalWarn;
  }

  return lines.join('\n');
}

assert.deepStrictEqual(parseAmapKeysFromEnv({ AMAP_KEY: SECRET_1 }), [SECRET_1], 'single AMAP_KEY should work');
assert.deepStrictEqual(
  parseAmapKeysFromEnv({ AMAP_WEB_SERVICE_KEYS: ` ${SECRET_1},, ${SECRET_2} , ` }),
  [SECRET_1, SECRET_2],
  'multi key strings should trim and drop blanks'
);
assert.deepStrictEqual(
  parseAmapKeysFromEnv({
    AMAP_WEB_SERVICE_KEYS: `${SECRET_1},${SECRET_2}`,
    AMAP_KEYS: 'lower-priority',
    AMAP_WEB_SERVICE_KEY: 'legacy-web',
    AMAP_KEY: 'legacy'
  }),
  [SECRET_1, SECRET_2],
  'AMAP_WEB_SERVICE_KEYS should have highest priority'
);

assert.deepStrictEqual(
  cloudAmap.parseAmapKeysFromEnv({ AMAP_WEB_SERVICE_KEYS: ` ${SECRET_1},, ${SECRET_2} ` }),
  [SECRET_1, SECRET_2],
  'cloud function should parse multi-key env strings'
);

const manager = createSeedAmapKeyManager({ env: { AMAP_KEYS: `${SECRET_1},${SECRET_2}` } });
const firstKey = manager.getCurrentKey();
assert.strictEqual(firstKey.index, 0, 'seed scripts should start from the first key');
manager.markFailure(firstKey.index, classifyAmapFailure({ status: '0', infocode: '10021', info: 'QPS over limit' }));
const secondKey = manager.getCurrentKey();
assert.strictEqual(secondKey.index, 1, 'QPS errors should switch to the next key');
assert.deepStrictEqual(
  manager.getStats(),
  { amapKeyIndex: 2, amapKeyCount: 2, amapKeySwitchCount: 1, quotaErrorCount: 0 },
  'QPS errors should switch keys without increasing daily quota error stats'
);

const cloudManager = cloudAmap.createAmapKeyManager({
  env: { AMAP_KEYS: `${SECRET_1},${SECRET_2}` },
  requestId: 'stable-request',
  now: () => 1000
});
const cloudFirstKey = cloudManager.getCurrentKey();
cloudManager.markFailure(cloudFirstKey.index, cloudAmap.classifyAmapFailure({ status: '0', infocode: '10021', info: 'QPS over limit' }));
const cloudSecondKey = cloudManager.getCurrentKey();
assert.notStrictEqual(cloudSecondKey.index, cloudFirstKey.index, 'cloud QPS errors should switch to another key');
assert.strictEqual(cloudManager.getMeta().quotaErrorCount, 0, 'cloud QPS errors should not be counted as daily quota errors');

const cloudQuotaManager = cloudAmap.createAmapKeyManager({
  env: { AMAP_KEYS: `${SECRET_1},${SECRET_2}` },
  requestId: 'stable-quota-request',
  now: () => 60000
});
const cloudQuotaFirstKey = cloudQuotaManager.getCurrentKey();
cloudQuotaManager.markFailure(
  cloudQuotaFirstKey.index,
  cloudAmap.classifyAmapFailure({ status: '0', infocode: '10003', info: 'USER_DAILY_QUERY_OVER_LIMIT' })
);
const cloudQuotaSecondKey = cloudQuotaManager.getCurrentKey();
assert(cloudQuotaSecondKey, 'cloud quota errors should try another configured key before failing');
assert.notStrictEqual(cloudQuotaSecondKey.index, cloudQuotaFirstKey.index, 'cloud quota errors should switch to another key');
assert.strictEqual(cloudQuotaManager.getMeta().quotaErrorCount, 1, 'cloud quota errors should be counted per exhausted key');

const failingManager = createSeedAmapKeyManager({ env: { AMAP_KEYS: `${SECRET_1},${SECRET_2}` } });
for (let index = 0; index < 2; index += 1) {
  const keyEntry = failingManager.getCurrentKey();
  failingManager.markFailure(keyEntry.index, classifyAmapFailure({ status: '0', infocode: '10003', info: 'daily quota exhausted' }));
}
assert.strictEqual(failingManager.getCurrentKey(), null, 'all quota-exhausted keys should become unavailable for this run');
assert.strictEqual(failingManager.getStats().quotaErrorCount, 2, 'daily quota errors should be counted per failed key');

const logText = captureWarn(() => {
  console.warn(`AMap seed request failed on ${secondKey.label}; trying next key when available.`);
});
assert(!logText.includes(SECRET_1), 'logs must not include the first real key');
assert(!logText.includes(SECRET_2), 'logs must not include the second real key');
assert(!JSON.stringify(manager.getStats()).includes(SECRET_1), 'stats must not include real keys');
assert(!JSON.stringify(manager.getStats()).includes(SECRET_2), 'stats must not include real keys');

const stressPolicy = validateStressCachePolicy({ cacheFileExists: false, allowLive: true, liveRequested: true });
assert.strictEqual(stressPolicy.ok, false, 'stress without cache should still require explicit seed');
assert.strictEqual(stressPolicy.mayCallAmap, false, 'stress should never hit AMap directly');
assert.strictEqual(stressPolicy.reason, 'live-stress-disabled-seed-required', 'stress should explain that seed is required');

console.log('amapKeySwitch.test.js passed');
