const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';
const DEFAULT_RADIUS_METERS = 1500;
const DEFAULT_PAGE_SIZE = 20;
const AMAP_FOOD_TYPE = '050000';

const TAG_LABELS = {
  hot: '热乎',
  staple: '主食',
  noodle: '面食',
  quick: '快餐',
  beef: '牛肉',
  rice: '米饭',
  spicy: '辣',
  stir_fry: '小炒',
  group: '多人',
  strong_flavor: '重口味',
  light: '清淡',
  healthy: '健康',
  salad: '沙拉',
  low_burden: '低负担',
  vegetarian: '素食友好',
  congee: '粥粉面',
  comfort: '暖胃',
  curry: '咖喱',
  not_spicy: '不辣',
  solo: '一人食',
  stable: '稳定',
  customizable: '自选',
  vegetable: '蔬菜',
  western: '西式',
  relaxed: '轻松',
  coffee: '咖啡',
  slow: '慢吃',
  bbq: '烧烤',
  late_night: '夜宵',
  snack: '小吃'
};

const TAG_RULES = [
  { pattern: /火锅|串串|冒菜/, ids: ['spicy', 'hot', 'group', 'strong_flavor'] },
  { pattern: /麻辣烫|麻辣香锅/, ids: ['spicy', 'hot', 'customizable', 'vegetable'] },
  { pattern: /川菜|湘菜|赣菜|辣/, ids: ['rice', 'spicy', 'stir_fry', 'strong_flavor'] },
  { pattern: /粤菜|港式|茶餐厅|粥|肠粉/, ids: ['light', 'congee', 'comfort', 'quick'] },
  { pattern: /面|粉|拉面|兰州|牛肉面|刀削面|米线/, ids: ['hot', 'staple', 'noodle', 'quick'] },
  { pattern: /快餐|简餐|便当|盖饭|黄焖鸡|汉堡/, ids: ['quick', 'staple', 'solo'] },
  { pattern: /小吃|炸鸡|煎饼|包子|饺子|馄饨/, ids: ['quick', 'snack', 'solo'] },
  { pattern: /轻食|沙拉|健康|素食/, ids: ['light', 'healthy', 'salad', 'low_burden', 'vegetarian'] },
  { pattern: /日式|日本|寿司|咖喱/, ids: ['curry', 'rice', 'not_spicy', 'stable'] },
  { pattern: /西餐|披萨|意式|brunch|牛排/, ids: ['western', 'relaxed', 'not_spicy'] },
  { pattern: /咖啡|甜品|面包|烘焙/, ids: ['coffee', 'relaxed', 'slow'] },
  { pattern: /烧烤|烤肉|烤串/, ids: ['bbq', 'late_night', 'strong_flavor', 'group'] }
];

exports.main = async (event = {}, context = {}) => {
  const requestId = context.requestId || `amap-poi-${Date.now()}`;

  try {
    const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY;

    if (!key) {
      return fail(requestId, 'AMAP_KEY_MISSING', 'AMap WebService key is not configured.');
    }

    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return fail(requestId, 'INVALID_LOCATION', 'latitude and longitude are required.');
    }

    const radius = clampInteger(event.radiusMeters, 300, 5000, DEFAULT_RADIUS_METERS);
    const pageSize = clampInteger(event.pageSize, 1, 25, DEFAULT_PAGE_SIZE);
    const keyword = typeof event.keyword === 'string' ? event.keyword.trim() : '';

    const amapResponse = await requestAmap({
      key,
      latitude,
      longitude,
      radius,
      pageSize,
      keyword
    });

    if (amapResponse.status !== '1' || amapResponse.infocode !== '10000') {
      return fail(requestId, 'AMAP_REQUEST_FAILED', amapResponse.info || 'AMap request failed.', {
        infocode: amapResponse.infocode,
        status: amapResponse.status
      });
    }

    const restaurants = (Array.isArray(amapResponse.pois) ? amapResponse.pois : [])
      .map(convertPoiToRestaurant)
      .filter(Boolean);

    return {
      ok: true,
      data: {
        restaurants,
        source: 'amap',
        fetchedAt: new Date().toISOString(),
        location: { latitude, longitude },
        radiusMeters: radius
      },
      requestId
    };
  } catch (error) {
    return fail(requestId, 'AMAP_POI_ERROR', error.message || 'Failed to fetch AMap POI.');
  }
};

function requestAmap({ key, latitude, longitude, radius, pageSize, keyword }) {
  const params = new URLSearchParams({
    key,
    location: `${longitude},${latitude}`,
    types: AMAP_FOOD_TYPE,
    radius: String(radius),
    sortrule: 'distance',
    offset: String(pageSize),
    page: '1',
    extensions: 'all',
    output: 'json'
  });

  if (keyword) {
    params.set('keywords', keyword);
  }

  const url = `${AMAP_PLACE_AROUND_URL}?${params.toString()}`;

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
  const averageCostYuan = parseNumber(poi.biz_ext && poi.biz_ext.cost);
  const tagIds = mapCategoryToTagIds([poi.type, poi.typecode, poi.name].filter(Boolean).join(';'));
  const photos = Array.isArray(poi.photos) ? poi.photos : [];
  const firstPhoto = photos.find((photo) => photo && photo.url);

  return {
    id: `amap-${poi.id}`,
    name: poi.name,
    tags: tagIds.map((id) => TAG_LABELS[id] || id),
    tagIds,
    description: poi.type || undefined,
    category: poi.type || undefined,
    address: normalizeAmapText(poi.address),
    location,
    distanceMeters: parseNumber(poi.distance),
    priceLevel: toPriceLevel(averageCostYuan),
    averageCostYuan,
    phone: normalizeAmapText(poi.tel),
    openStatus: 'unknown',
    signatureDishes: [],
    coverImageUrl: firstPhoto && firstPhoto.url,
    rating: parseNumber(poi.biz_ext && poi.biz_ext.rating),
    source: 'amap',
    status: 'active'
  };
}

function mapCategoryToTagIds(text) {
  const ids = new Set();

  TAG_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) {
      rule.ids.forEach((id) => ids.add(id));
    }
  });

  if (ids.size === 0) {
    ids.add('quick');
    ids.add('staple');
  }

  return [...ids];
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

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
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

  return 5;
}

function normalizeAmapText(value) {
  if (typeof value !== 'string' || value === '[]') {
    return undefined;
  }

  return value;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(number)));
}

function fail(requestId, code, message, details) {
  return {
    ok: false,
    error: {
      code,
      message,
      details
    },
    requestId
  };
}
