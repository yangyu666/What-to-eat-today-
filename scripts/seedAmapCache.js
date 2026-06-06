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
const AMAP_PLACE_POLYGON_URL = 'https://restapi.amap.com/v3/place/polygon';
const AMAP_PLACE_TEXT_URL = 'https://restapi.amap.com/v3/place/text';
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
  const city = typeof args.city === 'string' ? args.city.trim() : '';
  const adcode = typeof args.adcode === 'string' ? args.adcode.trim() : '';
  const modes = parseSearchModes(args.modes, keyword);
  const types = typeof args.types === 'string' && args.types.trim() ? args.types.trim() : DEFAULT_TYPES;
  const startedAt = Date.now();
  const result = await fetchAmapSeedPool({
    key,
    latitude: point.latitude,
    longitude: point.longitude,
    radius,
    pageSize,
    pageCount,
    keyword,
    city,
    adcode,
    modes,
    types
  });
  const restaurants = result.pois
    .map((poi) => convertPoiToRestaurant(poi, { latitude: point.latitude, longitude: point.longitude }))
    .filter(Boolean)
    .filter((restaurant) => {
      return typeof restaurant.distanceMeters !== 'number' || restaurant.distanceMeters <= radius;
    })
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
    city,
    adcode,
    searchModes: modes,
    types,
    createdAt: new Date().toISOString(),
    amapApiCallCount: result.apiCallCount,
    quotaStats: result.quotaStats,
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
        quotaStats: result.quotaStats,
        elapsedMs: Date.now() - startedAt
      },
      null,
      2
    )
  );
}

async function fetchAmapSeedPool(options) {
  const seen = new Set();
  const pois = [];
  let apiCallCount = 0;
  const quotaStats = {
    aroundCallCount: 0,
    polygonCallCount: 0,
    keywordCallCount: 0,
    idCallCount: 0,
    totalAmapApiCallCount: 0
  };

  for (const mode of options.modes) {
    if (mode === 'keyword' && (!options.keyword || (!options.city && !options.adcode))) {
      continue;
    }

    const result = await fetchAmapPages({
      ...options,
      keyword: mode === 'polygon' && options.modes.includes('keyword') ? '' : options.keyword,
      mode
    });
    apiCallCount += result.apiCallCount;
    quotaStats[`${mode}CallCount`] += result.apiCallCount;

    result.pois.forEach((poi) => {
      const poiKey = poi && (poi.id || `${poi.name || ''}|${poi.location || ''}`);

      if (poiKey && !seen.has(poiKey)) {
        seen.add(poiKey);
        pois.push(poi);
      }
    });
  }

  quotaStats.totalAmapApiCallCount = apiCallCount;

  return { pois, apiCallCount, quotaStats };
}

async function fetchAmapPages({ key, latitude, longitude, radius, pageSize, pageCount, keyword, city, adcode, mode, types }) {
  const seen = new Set();
  const pois = [];
  let apiCallCount = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    apiCallCount += 1;
    const response = await requestAmap({ key, latitude, longitude, radius, pageSize, page, keyword, city, adcode, mode, types });

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

function requestAmap({ key, latitude, longitude, radius, pageSize, page, keyword, city, adcode, mode, types }) {
  const endpoint =
    mode === 'polygon'
      ? AMAP_PLACE_POLYGON_URL
      : mode === 'keyword'
        ? AMAP_PLACE_TEXT_URL
        : AMAP_PLACE_AROUND_URL;
  const params = new URLSearchParams({
    key,
    types,
    offset: String(pageSize),
    page: String(page),
    extensions: 'all',
    output: 'json'
  });

  if (mode === 'polygon') {
    params.set('polygon', buildRectanglePolygon({ latitude, longitude }, radius));
  } else if (mode === 'keyword') {
    params.set('city', adcode || city);
    params.set('citylimit', 'true');
  } else {
    params.set('location', `${longitude},${latitude}`);
    params.set('radius', String(radius));
    params.set('sortrule', 'distance');
  }

  if (keyword) {
    params.set('keywords', keyword);
  }

  return requestJson(`${endpoint}?${params.toString()}`);
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

function convertPoiToRestaurant(poi, center) {
  if (!poi || !poi.id || !poi.name) {
    return null;
  }

  const location = parseAmapLocation(poi.location);
  const category = normalizeAmapText(poi.type);
  const cost = parsePositiveNumber(poi.biz_ext && poi.biz_ext.cost);
  const rating = parsePositiveNumber(poi.biz_ext && poi.biz_ext.rating);
  const poiText = `${poi.name} ${poi.type || ''} ${poi.address || ''}`;
  const tagIds = inferTagIdsFromText(poiText);
  const photos = Array.isArray(poi.photos) ? poi.photos : [];
  const firstPhoto = photos.find((photo) => photo && photo.url);

  if (isNonRestaurantSalesPoi(poiText)) {
    return null;
  }

  return {
    id: `amap-${poi.id}`,
    name: poi.name,
    tags: tagIds,
    tagIds,
    description: category,
    category,
    address: normalizeAmapText(poi.address),
    location,
    distanceMeters: parseNumber(poi.distance) ?? getDistanceMeters(center, location),
    priceLevel: toPriceLevel(cost),
    averageCostYuan: cost,
    openStatus: 'unknown',
    signatureDishes: [],
    coverImageUrl: firstPhoto ? normalizeImageUrl(firstPhoto.url) : undefined,
    rating,
    source: 'amap',
    status: 'active'
  };
}

function normalizeImageUrl(url) {
  return typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : undefined;
}

function parseSearchModes(value, keyword) {
  const modes = typeof value === 'string' && value.trim()
    ? value.split(',').map((item) => item.trim().toLowerCase())
    : keyword
      ? ['polygon', 'keyword']
      : ['polygon'];
  const allowed = new Set(['polygon', 'keyword', 'around']);
  const uniqueModes = [...new Set(modes.filter((mode) => allowed.has(mode)))];

  return uniqueModes.length > 0 ? uniqueModes : ['polygon'];
}

function buildRectanglePolygon(location, radiusMeters) {
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.cos(toRadians(location.latitude)) || 1);
  const west = formatCoordinate(clampNumber(location.longitude - longitudeDelta, -180, 180));
  const south = formatCoordinate(clampNumber(location.latitude - latitudeDelta, -90, 90));
  const east = formatCoordinate(clampNumber(location.longitude + longitudeDelta, -180, 180));
  const north = formatCoordinate(clampNumber(location.latitude + latitudeDelta, -90, 90));

  return `${west},${south}|${east},${north}`;
}

function getDistanceMeters(left, right) {
  if (
    !left ||
    !right ||
    typeof left.latitude !== 'number' ||
    typeof left.longitude !== 'number' ||
    typeof right.latitude !== 'number' ||
    typeof right.longitude !== 'number'
  ) {
    return undefined;
  }

  const earthRadiusMeters = 6371000;
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatCoordinate(value) {
  return Number(value.toFixed(6)).toString();
}

function inferTagIdsFromText(text) {
  const normalized = String(text || '').toLowerCase();
  const ids = new Set();
  const hasAny = (keywords) => keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));

  if (hasAny(['咖啡', 'coffee', 'cafe', 'starbucks', '星巴克', 'luckin', '瑞幸', 'manner', 'peet', 'costa', 'tims', '库迪', 'm stand', 'seesaw', 'arabica'])) {
    ['coffee', 'drink', 'non_meal', 'afternoon_tea'].forEach((id) => ids.add(id));
  }

  if (hasAny(['奶茶', '茶饮', '冷饮', '饮品', '凉茶', '果茶', '喜茶', '奈雪', '霸王茶姬', '茉莉奶白', '爷爷不泡茶', '古茗', '茶百道', '沪上阿姨', '柠季', '一点点', '1点点', '蜜雪冰城', 'koi', 'linlee'])) {
    ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'].forEach((id) => ids.add(id));
  }

  if (hasAny(['甜品', '蛋糕', '面包', '烘焙', '西点', '钵仔糕', '糖水', '冰淇淋', 'gelato', 'bakery', 'dessert', '哈根达斯'])) {
    ['dessert', 'non_meal', 'afternoon_tea', 'sweet'].forEach((id) => ids.add(id));
  }

  if (hasAny(['重庆小面', '小面', '麻辣烫', '冒菜', '麻辣香锅', '香锅', '川菜', '川味', '湘菜', '酸辣粉', '火锅', '串串', '水煮', '剁椒'])) {
    ['spicy', 'strong_flavor', 'heavy', 'hot'].forEach((id) => ids.add(id));
  }

  if (hasAny(['轻食', '沙拉', '健康', '低卡', '减脂', '健身餐'])) {
    ['light', 'healthy', 'salad', 'low_burden', 'fresh'].forEach((id) => ids.add(id));
  }

  if (hasAny(['快餐', '简餐', '盖饭', '便当', '套餐', '小吃'])) {
    ['quick', 'meal', 'staple'].forEach((id) => ids.add(id));
  }

  if (hasAny(['粥', '粉面', '云吞', '包子', '饺子', '烧麦', '早茶', '茶餐厅'])) {
    ['quick', 'hot', 'snack', 'staple'].forEach((id) => ids.add(id));
  }

  if (hasAny(['中餐厅', '餐厅', '餐馆', '饭店', '酒楼', '酒家', '私房菜', '炒菜', '粤菜', '海鲜', '牛扒', '外国餐厅', '日本料理', '寿司'])) {
    ids.add('meal');
  }

  if (hasAny(['广州酒家', '陶陶居', '点都德', '炳胜', '利苑', '白天鹅', '黑珍珠', '米其林', '大董', '新荣记', '甬府', '莆田', '松鹤楼'])) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((id) => ids.add(id));
  }

  if (hasAny(['绿茶餐厅', '外婆家', '九毛九', '太二', '探鱼', '西贝', '海底捞', '巴奴', '木屋烧烤', '农耕记', '费大厨', '湘辣辣', '蛙来哒', '江渔儿', '杨国福', '遇见小面', '大家乐', '大快活'])) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((id) => ids.add(id));
  }

  if (hasAny(['麦当劳', '肯德基', 'kfc', '星巴克', '瑞幸', '库迪', '奈雪', '喜茶', '霸王茶姬', '一点点', '1点点', '蜜雪冰城'])) {
    ['chain_brand', 'low_chain'].forEach((id) => ids.add(id));
  }

  if (hasAny(['商场', '购物中心', '广场', 'mall', '百货'])) {
    ids.add('mall_store');
  }

  if (!hasNonMealTagIds(ids)) {
    ids.add('meal');
  } else {
    ids.delete('meal');
  }

  return [...ids];
}

function isNonRestaurantSalesPoi(text) {
  const normalized = String(text || '').toLowerCase();
  return ['销售中心', '批发', '团购', '月饼', '礼盒', '礼品', '年货', '食品销售', '商贸', '展销', '经销'].some((keyword) =>
    normalized.includes(keyword)
  );
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
