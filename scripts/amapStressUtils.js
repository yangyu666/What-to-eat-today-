const path = require('path');

const DEFAULT_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'amap-poi');

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith('--')) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function getPointInput(args) {
  const lat = Number(args.lat || args.latitude);
  const lng = Number(args.lng || args.longitude);

  return {
    label: typeof args.label === 'string' ? args.label : undefined,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    cityName: typeof args.cityName === 'string' ? args.cityName : undefined
  };
}

function requirePointForSeed(point) {
  if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
    throw new Error('Seed requires --lat and --lng.');
  }
}

function requireCacheSelector(point) {
  if (!point.label && (typeof point.latitude !== 'number' || typeof point.longitude !== 'number')) {
    throw new Error('Stress requires --label or both --lat and --lng.');
  }
}

function buildCacheFilePath(point, cacheDir = DEFAULT_CACHE_DIR) {
  const fileLabel = normalizeFilePart(
    point.label || `${roundCoordinate(point.latitude)}_${roundCoordinate(point.longitude)}`
  );

  return path.join(cacheDir, `${fileLabel}.json`);
}

function validateStressCachePolicy({ cacheFileExists, allowLive, liveRequested }) {
  if (cacheFileExists) {
    return {
      ok: true,
      mayCallAmap: false,
      reason: 'cache-file-present'
    };
  }

  if (allowLive && liveRequested) {
    return {
      ok: true,
      mayCallAmap: true,
      reason: 'explicit-live-stress'
    };
  }

  return {
    ok: false,
    mayCallAmap: false,
    reason: 'cache-file-missing'
  };
}

function normalizeFilePart(value) {
  return String(value || 'unnamed')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function roundCoordinate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'unknown';
  }

  return number.toFixed(3);
}

module.exports = {
  DEFAULT_CACHE_DIR,
  parseArgs,
  getPointInput,
  requirePointForSeed,
  requireCacheSelector,
  buildCacheFilePath,
  validateStressCachePolicy
};
