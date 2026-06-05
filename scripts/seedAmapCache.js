const fs = require('fs');
const https = require('https');
const path = require('path');
const {
  buildCacheFilePath,
  getPointInput,
  parseArgs,
  requirePointForSeed
} = require('./amapStressUtils');

const AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';
const DEFAULT_TYPES = '050000';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const point = getPointInput(args);
  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY;

  requirePointForSeed(point);

  if (!key) {
    throw new Error('AMAP_WEB_SERVICE_KEY or AMAP_KEY is required for seed:amap-cache.');
  }

  const radius = clampInteger(args.radius, 300, 15000, 5000);
  const pageSize = clampInteger(args.pageSize, 1, 25, 25);
  const pageCount = clampInteger(args.pageCount, 1, 10, 3);
  const keyword = typeof args.keyword === 'string' ? args.keyword.trim() : '';
  const types = typeof args.types === 'string' && args.types.trim() ? args.types.trim() : DEFAULT_TYPES;
  const startedAt = Date.now();
  const result = await fetchAmapPages({
    key,
    latitude: point.latitude,
    longitude: point.longitude,
    radius,
    pageSize,
    pageCount,
    keyword,
    types
  });
  const restaurants = result.pois
    .map(convertPoiToRestaurant)
    .filter(Boolean)
    .slice(0, 250);
  const cacheFile = buildCacheFilePath(point);
  const payload = {
    version: 1,
    label: point.label,
    cityName: point.cityName,
    latitude: point.latitude,
    longitude: point.longitude,
    radiusMeters: radius,
    pageSize,
    pageCount,
    keyword,
    types,
    createdAt: new Date().toISOString(),
    amapApiCallCount: result.apiCallCount,
    restaurants
  };

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        label: point.label,
        latitude: point.latitude,
        longitude: point.longitude,
        cacheFile,
        restaurants: restaurants.length,
        amapApiCallCount: result.apiCallCount,
        elapsedMs: Date.now() - startedAt
      },
      null,
      2
    )
  );
}

async function fetchAmapPages({ key, latitude, longitude, radius, pageSize, pageCount, keyword, types }) {
  const seen = new Set();
  const pois = [];
  let apiCallCount = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    apiCallCount += 1;
    const response = await requestAmap({ key, latitude, longitude, radius, pageSize, page, keyword, types });

    if (response.status !== '1' || response.infocode !== '10000') {
      throw new Error(`AMap request failed: ${response.info || response.infocode || response.status}`);
    }

    const pagePois = Array.isArray(response.pois) ? response.pois : [];

    pagePois.forEach((poi) => {
      const poiKey = poi && (poi.id || `${poi.name || ''}|${poi.location || ''}`);

      if (poiKey && !seen.has(poiKey)) {
        seen.add(poiKey);
        pois.push(poi);
      }
    });

    if (pagePois.length < pageSize) {
      break;
    }
  }

  return { pois, apiCallCount };
}

function requestAmap({ key, latitude, longitude, radius, pageSize, page, keyword, types }) {
  const params = new URLSearchParams({
    key,
    location: `${longitude},${latitude}`,
    types,
    radius: String(radius),
    sortrule: 'distance',
    offset: String(pageSize),
    page: String(page),
    extensions: 'all',
    output: 'json'
  });

  if (keyword) {
    params.set('keywords', keyword);
  }

  return requestJson(`${AMAP_PLACE_AROUND_URL}?${params.toString()}`);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function convertPoiToRestaurant(poi) {
  if (!poi || !poi.id || !poi.name) {
    return null;
  }

  const location = parseAmapLocation(poi.location);
  const category = normalizeAmapText(poi.type);
  const cost = parsePositiveNumber(poi.biz_ext && poi.biz_ext.cost);
  const rating = parsePositiveNumber(poi.biz_ext && poi.biz_ext.rating);
  const tags = inferTags(`${poi.name} ${poi.type || ''} ${poi.address || ''}`);

  return {
    id: `amap-${poi.id}`,
    name: poi.name,
    tags,
    tagIds: inferTagIds(tags),
    description: category,
    category,
    address: normalizeAmapText(poi.address),
    location,
    distanceMeters: parseNumber(poi.distance),
    priceLevel: toPriceLevel(cost),
    averageCostYuan: cost,
    openStatus: 'unknown',
    signatureDishes: [],
    rating,
    source: 'amap',
    status: 'active'
  };
}

function inferTags(text) {
  const normalized = String(text || '').toLowerCase();
  const tags = ['餐饮'];

  if (/咖啡|coffee|cafe|starbucks|luckin|manner/i.test(normalized)) {
    tags.push('咖啡');
  }

  if (/奶茶|茶饮|饮品|喜茶|奈雪|koi/i.test(normalized)) {
    tags.push('奶茶');
  }

  if (/甜品|蛋糕|面包|bakery|dessert/i.test(normalized)) {
    tags.push('甜品');
  }

  if (/火锅|麻辣|川菜|湘菜|辣/i.test(normalized)) {
    tags.push('重口味');
  }

  if (/轻食|沙拉|健康/i.test(normalized)) {
    tags.push('轻食');
  }

  if (/快餐|简餐|盖饭|便当|小吃/i.test(normalized)) {
    tags.push('快餐');
  }

  return [...new Set(tags)];
}

function inferTagIds(tags) {
  const ids = new Set();
  const text = tags.join(' ');

  if (/咖啡/.test(text)) {
    ids.add('coffee');
    ids.add('drink');
    ids.add('non_meal');
  }

  if (/奶茶/.test(text)) {
    ids.add('milk_tea');
    ids.add('drink');
    ids.add('non_meal');
  }

  if (/甜品/.test(text)) {
    ids.add('dessert');
    ids.add('non_meal');
  }

  if (/重口味/.test(text)) {
    ids.add('spicy');
    ids.add('strong_flavor');
  }

  if (/轻食/.test(text)) {
    ids.add('light');
    ids.add('healthy');
  }

  if (/快餐/.test(text)) {
    ids.add('quick');
  }

  if (!hasNonMealTagIds(ids)) {
    ids.add('meal');
  }

  return [...ids];
}

function hasNonMealTagIds(ids) {
  return ['coffee', 'milk_tea', 'drink', 'dessert', 'non_meal'].some((id) => ids.has(id));
}

function parseAmapLocation(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const [longitudeText, latitudeText] = value.split(',');
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return { latitude, longitude };
}

function normalizeAmapText(value) {
  return typeof value === 'string' && value !== '[]' ? value : undefined;
}

function parseNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function parsePositiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function toPriceLevel(cost) {
  if (cost === undefined) {
    return undefined;
  }

  if (cost <= 20) {
    return 1;
  }

  if (cost <= 40) {
    return 2;
  }

  if (cost <= 70) {
    return 3;
  }

  if (cost <= 110) {
    return 4;
  }

  if (cost <= 200) {
    return 5;
  }

  return 6;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
