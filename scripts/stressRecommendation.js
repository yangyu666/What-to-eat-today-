const fs = require('fs');
const {
  buildCacheFilePath,
  getPointInput,
  parseArgs,
  requireCacheSelector,
  validateStressCachePolicy
} = require('./amapStressUtils');
const { recommendRestaurants } = require('../miniprogram/services/recommendationEngine');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const point = getPointInput(args);
  const runs = clampInteger(args.runs, 1, 10000, 500);
  const cacheFile = buildCacheFilePath(point);
  const cacheFileExists = fs.existsSync(cacheFile);
  const allowLive = process.env.ALLOW_LIVE_AMAP_STRESS === '1';
  const liveRequested = args.live === true;
  const policy = validateStressCachePolicy({ cacheFileExists, allowLive, liveRequested });

  requireCacheSelector(point);

  if (!policy.ok) {
    throw new Error(
      `AMap stress cache not found: ${cacheFile}. Run seed first, for example: npm.cmd run seed:amap-cache -- --label ${point.label || 'your-label'} --lat <latitude> --lng <longitude> --radius 5000`
    );
  }

  if (policy.mayCallAmap) {
    throw new Error(
      'Live AMap stress is intentionally not implemented in stress. Run seed:amap-cache first so stress remains repeatable.'
    );
  }

  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8').replace(/^\uFEFF/, ''));
  const restaurants = Array.isArray(cache.restaurants) ? cache.restaurants : [];

  if (restaurants.length === 0) {
    throw new Error(`AMap stress cache has no restaurants: ${cacheFile}`);
  }

  const scenarios = buildScenarios();
  const startedAt = Date.now();
  const top1ByScenario = new Map();
  let recommendationSuccessCount = 0;
  let noResultCount = 0;

  for (let index = 0; index < runs; index += 1) {
    const scenario = scenarios[index % scenarios.length];
    const result = recommendRestaurants({
      restaurants,
      context: { preferenceSnapshot: scenario.preference },
      limit: 3,
      now: new Date('2026-06-05T04:00:00.000Z'),
      random: () => (index % 10) / 100,
      source: 'amap'
    });
    const top = result.candidates[0];

    if (top) {
      recommendationSuccessCount += 1;
      const current = top1ByScenario.get(scenario.name) || new Map();
      current.set(top.name, (current.get(top.name) || 0) + 1);
      top1ByScenario.set(scenario.name, current);
    } else {
      noResultCount += 1;
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const top1Reasonable = scenarios.every((scenario) => {
    const counts = top1ByScenario.get(scenario.name);

    return counts && counts.size > 0;
  });
  const summary = {
    label: cache.label || point.label,
    latitude: cache.latitude ?? point.latitude,
    longitude: cache.longitude ?? point.longitude,
    runs,
    seedSearchModes: cache.searchModes ?? ['around'],
    seedAmapApiCallCount: cache.amapApiCallCount ?? 0,
    seedQuotaStats: cache.quotaStats ?? {
      aroundCallCount: cache.amapApiCallCount ?? 0,
      polygonCallCount: 0,
      keywordCallCount: 0,
      idCallCount: 0,
      totalAmapApiCallCount: cache.amapApiCallCount ?? 0
    },
    amapApiCallCount: 0,
    totalAmapApiCallCount: 0,
    aroundCallCount: 0,
    polygonCallCount: 0,
    keywordCallCount: 0,
    idCallCount: 0,
    cacheHitCount: runs,
    cacheHitRate: runs > 0 ? Number((runs / runs).toFixed(4)) : 0,
    amapApiCallsAvoidedByCache: runs,
    recommendationSuccessCount,
    noResultCount,
    averageElapsedMs: Number((elapsedMs / runs).toFixed(2)),
    top1Reasonable,
    top1ByScenario: Object.fromEntries(
      [...top1ByScenario.entries()].map(([scenario, counts]) => [
        scenario,
        [...counts.entries()]
          .sort((left, right) => right[1] - left[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }))
      ])
    )
  };

  console.log(JSON.stringify(summary, null, 2));
}

function buildScenarios() {
  return [
    {
      name: 'quick-light',
      preference: {
        selectedOptionIds: [],
        preferredTagIds: ['quick', 'light', 'staple'],
        avoidedTagIds: ['spicy', 'strong_flavor'],
        budgetLevel: 3,
        maxDistanceMeters: 1500,
        maxEstimatedMinutes: 30
      }
    },
    {
      name: 'spicy-meal',
      preference: {
        selectedOptionIds: [],
        preferredTagIds: ['spicy', 'strong_flavor', 'meal'],
        avoidedTagIds: [],
        budgetLevel: 3,
        maxDistanceMeters: 3000,
        maxEstimatedMinutes: 45
      }
    },
    {
      name: 'drink-dessert',
      preference: {
        selectedOptionIds: ['intent_drink'],
        preferredTagIds: ['drink', 'coffee', 'milk_tea', 'non_meal'],
        avoidedTagIds: ['meal'],
        budgetLevel: 4,
        maxDistanceMeters: 3000,
        maxEstimatedMinutes: 45
      }
    },
    {
      name: 'premium-relaxed',
      preference: {
        selectedOptionIds: ['brand_chain', 'distance_any'],
        preferredTagIds: ['relaxed', 'slow', 'premium_brand', 'mall_store'],
        avoidedTagIds: [],
        budgetLevel: 5,
        maxDistanceMeters: 10000,
        maxEstimatedMinutes: 60
      }
    }
  ];
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  buildScenarios,
  main,
  validateStressCachePolicy
};
