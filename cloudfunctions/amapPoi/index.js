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
  spicy: '辣',
  not_spicy: '不辣',
  strong_flavor: '重口味',
  light: '清淡',
  healthy: '健康',
  hot: '热食',
  cold: '凉食',
  staple: '主食',
  rice: '米饭',
  noodle: '面食',
  snack: '小吃',
  quick: '快餐',
  slow: '慢吃',
  fried: '油炸',
  bbq: '烧烤',
  malatang: '麻辣烫',
  hotpot: '火锅',
  sichuan: '川菜',
  hunan: '湘菜',
  chongqing_noodle: '重庆小面',
  congee: '粥粉面',
  salad: '沙拉',
  low_burden: '低负担',
  comfort: '暖胃',
  fresh: '清爽',
  maocai: '冒菜',
  dry_pot: '麻辣香锅',
  burger: '汉堡',
  heavy: '油腻',
  meal: '正餐',
  set_meal: '套餐',
  solo: '一人食',
  group: '多人'
};

const TAG_RULES = [
  { pattern: /重庆小面|小面|酸辣粉|川味面/, ids: ['spicy', 'strong_flavor', 'heavy', 'chongqing_noodle', 'noodle', 'quick', 'hot'] },
  { pattern: /麻辣烫|麻辣拌/, ids: ['spicy', 'strong_flavor', 'heavy', 'malatang', 'hot', 'quick'] },
  { pattern: /冒菜/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'maocai', 'hot'] },
  { pattern: /麻辣香锅|香锅|干锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'dry_pot', 'hot'] },
  { pattern: /火锅|串串|涮锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'hotpot', 'group', 'hot'] },
  { pattern: /川菜|川味|水煮|麻婆|辣子/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'rice'] },
  { pattern: /湘菜|湖南|小炒|剁椒/, ids: ['spicy', 'strong_flavor', 'heavy', 'hunan', 'rice'] },
  { pattern: /烧烤|烤肉|烤串|烤鱼/, ids: ['bbq', 'heavy', 'strong_flavor', 'group'] },
  { pattern: /炸鸡|油炸|汉堡|薯条/, ids: ['fried', 'heavy', 'burger', 'quick', 'snack'] },
  { pattern: /粥|粉面|云吞|馄饨|粤菜|广式|茶餐厅/, ids: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { pattern: /兰州|牛肉面|拉面|刀削面|米线|面馆/, ids: ['hot', 'staple', 'noodle', 'quick'] },
  { pattern: /快餐|简餐|便当|盖饭|黄焖鸡|卤肉饭|套餐/, ids: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { pattern: /小吃|包子|饺子|煎饼|烧麦|点心/, ids: ['quick', 'snack', 'solo', 'hot'] },
  { pattern: /轻食|沙拉|健康|素食|低卡|减脂/, ids: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { pattern: /日式|日本|寿司|咖喱|拉面/, ids: ['rice', 'not_spicy', 'stable', 'solo'] },
  { pattern: /西餐|披萨|意式|brunch|牛排|咖啡/, ids: ['western', 'relaxed', 'slow', 'not_spicy'] }
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
    const types = typeof event.types === 'string' && event.types.trim() ? event.types.trim() : AMAP_FOOD_TYPE;

    const amapResponse = await requestAmap({
      key,
      latitude,
      longitude,
      radius,
      pageSize,
      keyword,
      types
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

function requestAmap({ key, latitude, longitude, radius, pageSize, keyword, types }) {
  const params = new URLSearchParams({
    key,
    location: `${longitude},${latitude}`,
    types,
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
  const explicitlyNotSpicy = /不辣|清淡|白汤|原味|广式|粥|沙拉|轻食/.test(text);

  TAG_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) {
      rule.ids.forEach((id) => ids.add(id));
    }
  });

  if (explicitlyNotSpicy) {
    ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'hunan', 'malatang', 'maocai', 'dry_pot', 'hotpot'].forEach((id) => ids.delete(id));
    ids.add('not_spicy');
  }

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
