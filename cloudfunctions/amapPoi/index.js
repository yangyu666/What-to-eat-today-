const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';
const AMAP_REGEOCODE_URL = 'https://restapi.amap.com/v3/geocode/regeo';
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

Object.assign(TAG_LABELS, {
  dessert: '甜品',
  milk_tea: '奶茶',
  coffee: '咖啡',
  drink: '饮品',
  afternoon_tea: '下午茶',
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  late_night: '夜宵',
  vegetarian: '素食',
  halal: '清真',
  allergy_sensitive: '忌口友好',
  low_sugar: '低糖',
  low_carb: '低碳',
  high_protein: '高蛋白',
  non_meal: '非正餐',
  pork: '猪肉',
  meat_heavy: '重肉',
  seafood: '海鲜',
  peanut: '花生坚果',
  unclear_ingredients: '配料风险',
  sweet: '偏甜',
  sugary_drink: '含糖饮品'
});

Object.assign(TAG_LABELS, {
  chain_brand: '品牌连锁',
  low_chain: '平价连锁',
  mid_chain: '中档品牌',
  premium_brand: '高端品牌',
  independent_store: '街边小店',
  street_shop: '本地小店',
  dim_sum: '点心',
  mall_store: '商场店'
});

const LOW_CHAIN_KEYWORDS = ['肯德基', 'kfc', '麦当劳', 'mcdonald', '汉堡王', '华莱士', '塔斯汀', '必胜客', '达美乐', '真功夫', '老乡鸡', '乡村基', '吉野家', '永和大王', '霸王茶姬', '喜茶', '奈雪', '一点点'];
const MID_CHAIN_KEYWORDS = ['费大厨', '太二', '探鱼', '西贝', '海底捞', '巴奴', '木屋烧烤', '绿茶餐厅', '外婆家', '九毛九', '蛙来哒', '农耕记', '陈鹏鹏', '怂火锅', '大龙燚', '点都德', '陶陶居'];
const PREMIUM_CHAIN_KEYWORDS = ['高端餐厅', '高端日料', '米其林', 'omakase', 'fine dining', '法餐', '私房菜', '炳胜', '利苑', '大董', '新荣记', '甬府', '莆田', '松鹤楼', '广州酒家', '白天鹅', '黑珍珠'];
const INDEPENDENT_STORE_KEYWORDS = ['街边', '小店', '老店', '大排档', '排档', '小馆', '家常', '本地'];
const MALL_STORE_KEYWORDS = ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', '综合体', '购物公园'];
const NON_RESTAURANT_SALES_KEYWORDS = ['销售中心', '批发', '团购', '月饼', '礼盒', '礼品', '年货', '食品销售', '商贸', '展销', '经销'];

const TAG_RULES = [
  { pattern: /重庆小面|小面|酸辣粉|川味面/, ids: ['spicy', 'strong_flavor', 'heavy', 'chongqing_noodle', 'noodle', 'quick', 'hot'] },
  { pattern: /麻辣烫|麻辣拌/, ids: ['spicy', 'strong_flavor', 'heavy', 'malatang', 'hot', 'quick'] },
  { pattern: /冒菜/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'maocai', 'hot'] },
  { pattern: /麻辣香锅|香锅|干锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'dry_pot', 'hot'] },
  { pattern: /火锅|串串|涮锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'hotpot', 'group', 'hot'] },
  { pattern: /川菜|川味|水煮|麻婆|辣子/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'rice'] },
  { pattern: /湘菜|湖南|小炒|剁椒/, ids: ['spicy', 'strong_flavor', 'heavy', 'hunan', 'rice'] },
  { pattern: /烧烤|烤肉|烤串|烤鱼/, ids: ['bbq', 'heavy', 'strong_flavor', 'group'] },
  { pattern: /炸鸡|鸡柳|鸡排|肯德基|kfc|麦当劳|汉堡王|油炸|汉堡|薯条/i, ids: ['fried', 'heavy', 'burger', 'quick', 'snack'] },
  { pattern: /粥|粉面|云吞|馄饨|粤菜|广式|茶餐厅/, ids: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { pattern: /兰州|牛肉面|拉面|刀削面|米线|面馆/, ids: ['hot', 'staple', 'noodle', 'quick'] },
  { pattern: /快餐|简餐|便当|盖饭|黄焖鸡|卤肉饭|套餐/, ids: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { pattern: /小吃|包子|饺子|煎饼|烧麦|点心/, ids: ['quick', 'snack', 'solo', 'hot'] },
  { pattern: /轻食|沙拉|健康|素食|低卡|减脂/, ids: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { pattern: /日式|日本|寿司|咖喱|拉面/, ids: ['rice', 'not_spicy', 'stable', 'solo'] },
  { pattern: /西餐|披萨|意式|brunch|牛排|咖啡/, ids: ['western', 'relaxed', 'slow', 'not_spicy'] }
];

TAG_RULES.push(
  { pattern: /咖啡|cafe|coffee/i, ids: ['coffee', 'drink', 'non_meal', 'afternoon_tea'] },
  { pattern: /奶茶|茶饮|喜茶|奈雪|一点点|霸王茶姬/, ids: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { pattern: /饮品|果茶|糖水/, ids: ['drink', 'non_meal', 'sweet', 'sugary_drink'] },
  { pattern: /甜品|蛋糕|面包|烘焙|点心|西点/, ids: ['dessert', 'non_meal', 'afternoon_tea', 'sweet'] },
  { pattern: /早餐|包子|豆浆|油条|早茶/, ids: ['breakfast', 'quick', 'hot', 'staple', 'snack'] },
  { pattern: /粥|粥粉面/, ids: ['breakfast', 'congee', 'quick', 'hot', 'not_spicy'] },
  { pattern: /夜宵|宵夜/, ids: ['late_night', 'quick', 'hot', 'snack'] },
  { pattern: /清真|兰州拉面|牛肉面/, ids: ['halal', 'noodle', 'hot', 'high_protein'] },
  { pattern: /素食|素菜|素面/, ids: ['vegetarian', 'healthy', 'light', 'not_spicy'] },
  { pattern: /健身餐|鸡胸肉|高蛋白|牛肉饭/, ids: ['high_protein', 'healthy', 'low_carb'] },
  { pattern: /猪肉|卤肉|叉烧|五花肉/, ids: ['pork', 'meat_heavy'] },
  { pattern: /海鲜|虾|蟹/, ids: ['seafood', 'unclear_ingredients'] },
  { pattern: /花生|坚果/, ids: ['peanut', 'unclear_ingredients'] },
  { pattern: /轻食|沙拉|健康餐|低卡|减脂/, ids: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'low_carb'] }
);

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

    if (event.action === 'reverseGeocode') {
      const amapResponse = await requestAmapRegeo({ key, latitude, longitude });

      if (amapResponse.status !== '1' || amapResponse.infocode !== '10000') {
        return fail(requestId, 'AMAP_REGEOCODE_FAILED', amapResponse.info || 'AMap reverse geocode failed.', {
          infocode: amapResponse.infocode,
          status: amapResponse.status
        });
      }

      const addressComponent = amapResponse.regeocode && amapResponse.regeocode.addressComponent;

      return {
        ok: true,
        data: {
          location: { latitude, longitude },
          province: normalizeAmapText(addressComponent && addressComponent.province),
          city: normalizeAmapText(addressComponent && addressComponent.city),
          district: normalizeAmapText(addressComponent && addressComponent.district),
          address: normalizeAmapText(amapResponse.regeocode && amapResponse.regeocode.formatted_address)
        },
        requestId
      };
    }

    const radius = clampInteger(event.radiusMeters, 300, 15000, DEFAULT_RADIUS_METERS);
    const pageSize = clampInteger(event.pageSize, 1, 25, DEFAULT_PAGE_SIZE);
    const keyword = typeof event.keyword === 'string' ? event.keyword.trim() : '';
    const types = typeof event.types === 'string' && event.types.trim() ? event.types.trim() : AMAP_FOOD_TYPE;

    let amapResponse = await requestAmap({
      key,
      latitude,
      longitude,
      radius,
      pageSize,
      keyword,
      types
    });
    let keywordFallbackUsed = false;

    if (amapResponse.status !== '1' || amapResponse.infocode !== '10000') {
      return fail(requestId, 'AMAP_REQUEST_FAILED', amapResponse.info || 'AMap request failed.', {
        infocode: amapResponse.infocode,
        status: amapResponse.status
      });
    }

    if (keyword && (!Array.isArray(amapResponse.pois) || amapResponse.pois.length === 0)) {
      const fallbackResponse = await requestAmap({
        key,
        latitude,
        longitude,
        radius,
        pageSize,
        keyword: '',
        types
      });

      if (fallbackResponse.status === '1' && fallbackResponse.infocode === '10000') {
        amapResponse = fallbackResponse;
        keywordFallbackUsed = true;
      }
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
        radiusMeters: radius,
        keywordFallbackUsed
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

  return requestJson(url);
}

function requestAmapRegeo({ key, latitude, longitude }) {
  const params = new URLSearchParams({
    key,
    location: `${longitude},${latitude}`,
    extensions: 'base',
    output: 'json'
  });
  const url = `${AMAP_REGEOCODE_URL}?${params.toString()}`;

  return requestJson(url);
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
  const text = [poi.type, poi.typecode, poi.name, poi.address, poi.pname, poi.cityname, poi.adname].filter(Boolean).join(';');

  if (isNonRestaurantSalesPoi(text)) {
    return null;
  }

  const explicitAverageCostYuan = parsePositiveNumber(poi.biz_ext && poi.biz_ext.cost);
  const tagIds = mapCategoryToTagIds(text);
  const inferredAverageCostYuan = inferAverageCostYuan(text, tagIds);
  const averageCostYuan = explicitAverageCostYuan || inferredAverageCostYuan;
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

function isNonRestaurantSalesPoi(text) {
  const normalizedText = String(text || '').toLowerCase();

  return NON_RESTAURANT_SALES_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()));
}

function buildKeywordPattern(keywords) {
  return new RegExp(keywords.map(escapeRegExp).join('|'), 'i');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferAverageCostYuan(text, tagIds) {
  const normalizedText = String(text || '').toLowerCase();

  if (PREMIUM_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    return 260;
  }

  if (MID_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    return 140;
  }

  if (LOW_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    return tagIds.includes('milk_tea') || tagIds.includes('drink') ? 25 : 45;
  }

  return undefined;
}

function mapCategoryToTagIds(text) {
  const ids = new Set();
  const explicitlyNotSpicy = /不辣|清淡|白汤|原味|广式|粥|沙拉|轻食/.test(text);

  TAG_RULES.forEach((rule) => {
    if (rule.pattern.test(text)) {
      rule.ids.forEach((id) => ids.add(id));
    }
  });

  addBrandTags(ids, text);

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

function addBrandTags(ids, text) {
  const normalizedText = String(text || '').toLowerCase();

  if (['虾饺', '烧卖', '烧麦', '茶点', '早茶', '点心'].some((keyword) => normalizedText.includes(keyword))) {
    ['dim_sum', 'meal', 'snack'].forEach((id) => ids.add(id));
  }

  if (LOW_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'low_chain'].forEach((id) => ids.add(id));
  }

  if (MID_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((id) => ids.add(id));
  }

  if (PREMIUM_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((id) => ids.add(id));
  }

  if (MALL_STORE_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    ids.add('mall_store');
  }

  if (INDEPENDENT_STORE_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase()))) {
    ['independent_store', 'street_shop'].forEach((id) => ids.add(id));
  }
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
