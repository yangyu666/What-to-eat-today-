const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';
const AMAP_PLACE_POLYGON_URL = 'https://restapi.amap.com/v3/place/polygon';
const AMAP_PLACE_TEXT_URL = 'https://restapi.amap.com/v3/place/text';
const AMAP_PLACE_DETAIL_URL = 'https://restapi.amap.com/v3/place/detail';
const AMAP_REGEOCODE_URL = 'https://restapi.amap.com/v3/geocode/regeo';
const DEFAULT_RADIUS_METERS = 1500;
const DEFAULT_PAGE_SIZE = 20;
const AMAP_FOOD_TYPE = '050000';
const CACHE_COLLECTION = 'amap_poi_cache';
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_RESTAURANTS = 250;
const AMAP_QPS_COOLDOWN_MS = 45 * 1000;
const amapKeyCooldowns = new Map();
let cloudPoiCacheCollectionReady = false;
let cloudPoiCacheCollectionUnavailable = false;

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

const LOW_CHAIN_KEYWORDS = ['肯德基', 'kfc', '麦当劳', 'mcdonald', '赛百味', 'subway', '汉堡王', '华莱士', '塔斯汀', '必胜客', '达美乐', '真功夫', '老乡鸡', '乡村基', '吉野家', '永和大王', '霸王茶姬', '喜茶', '奈雪', '一点点', '1点点', '蜜雪冰城', 'linlee', '麒麟大口茶', '大口茶', 'koi', '阿嬷手作', '去茶山', '古茗', '茉莉奶白', '爷爷不泡茶', '茶理宜世', '茶记大咖', 't9tea', 'tamkoko', '星巴克', 'starbucks', '瑞幸', 'luckin', 'manner', 'peet', 'costa', 'tims', 'tim hortons'];
const MID_CHAIN_KEYWORDS = ['费大厨', '太二', '探鱼', '西贝', '海底捞', '巴奴', '木屋烧烤', '绿茶餐厅', '外婆家', '九毛九', '蛙来哒', '农耕记', '陈鹏鹏', '怂火锅', '大龙燚', '点都德', '陶陶居', '小菜园', '小菜园新徽菜'];
const PREMIUM_CHAIN_KEYWORDS = ['高端餐厅', '高端日料', '米其林', 'omakase', 'fine dining', '法餐', '私房菜', '炳胜', '利苑', '大董', '新荣记', '甬府', '莆田', '松鹤楼', '广州酒家', '白天鹅', '黑珍珠'];
const pushUniqueKeyword = (target, keywords) => {
  keywords.forEach((keyword) => {
    if (!target.includes(keyword)) {
      target.push(keyword);
    }
  });
};
pushUniqueKeyword(LOW_CHAIN_KEYWORDS, [
  '德克士', '派乐汉堡', '享哆味', '萨莉亚', '南城香', '大米先生', '米村拌饭', '超意兴', '杨铭宇黄焖鸡', '猪角',
  '正新鸡排', '绝味鸭脖', '紫燕百味鸡', '周黑鸭', '煌上煌', '久久丫', '巴比', '小杨生煎',
  '书亦烧仙草', 'CoCo', '都可', '益禾堂', '甜啦啦', '柠季', '林里', '茶颜悦色', '茶话弄', '悸动', '快乐番薯', '阿水大杯茶', '700CC',
  '库迪', 'cotti', '幸运咖', 'NOWWA', '挪瓦', 'M Stand', 'Seesaw'
]);
pushUniqueKeyword(MID_CHAIN_KEYWORDS, [
  '呷哺呷哺', '凑凑', '小龙坎', '朱光玉', '熊喵来了', '半天妖', '烤匠', '很久以前', '西塔老太太', '九田家', '刘炭长',
  '大家乐', '大快活', '捞王', '左庭右院', '八合里', '润园四季', '四季椰林',
  '王品牛排', '豪客来', '大渔铁板烧',
  '和府捞面', '味千拉面', '李先生', '马记永', '陈香贵', '蒙自源', '阿香米线', '五谷渔粉', '喜家德', '袁记云饺', '吉祥馄饨'
]);
pushUniqueKeyword(PREMIUM_CHAIN_KEYWORDS, [
  '高端粤菜', '潮菜', '铁板烧', '创意菜', '鮨', '花园酒店', '康莱德', '大渔铁板烧', '1218 GRILL', '中侨会', '雍颐庭',
  '菁禧荟', '遇外滩', '成隆行', '眉州东坡1996', '蓝麒麟', '新长福', '南景饭店', '晴溪莊园',
  '至正潮菜', 'AVANT', 'La Tablée', 'Stone Sal', '言盐', '粤海荟', '齐武', '晴空', '水岸十里', '云璟', '鹏瑞莱佛士',
  '雲鹤', '雲鹤手握', '鮨海老'
]);
const INDEPENDENT_STORE_KEYWORDS = ['街边', '小店', '老店', '大排档', '排档', '小馆', '家常', '本地', '路边摊', '苍蝇馆', '苍蝇小馆', '简陋', '破旧', '破店', '档口', '摊档'];
const MALL_STORE_KEYWORDS = ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', '综合体', '购物公园'];
const NON_RESTAURANT_SALES_KEYWORDS = ['销售中心', '批发', '团购', '月饼', '礼盒', '礼品', '年货', '食品销售', '商贸', '展销', '经销', '有礼'];

const TAG_RULES = [
  { pattern: /重庆小面|小面|酸辣粉|川味面/, ids: ['spicy', 'strong_flavor', 'heavy', 'chongqing_noodle', 'noodle', 'quick', 'hot'] },
  { pattern: /麻辣烫|麻辣拌/, ids: ['spicy', 'strong_flavor', 'heavy', 'malatang', 'hot', 'quick'] },
  { pattern: /冒菜/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'maocai', 'hot'] },
  { pattern: /麻辣香锅|香锅|干锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'dry_pot', 'hot'] },
  { pattern: /火锅|串串|涮锅/, ids: ['spicy', 'strong_flavor', 'heavy', 'hotpot', 'group', 'hot'] },
  { pattern: /川菜|川味|水煮|麻婆|辣子/, ids: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'rice'] },
  { pattern: /湘菜|湖南|小炒|剁椒/, ids: ['spicy', 'strong_flavor', 'heavy', 'hunan', 'rice'] },
  { pattern: /烧烤|烤肉|烤串|烤鱼/, ids: ['bbq', 'heavy', 'strong_flavor', 'group', 'meal'] },
  { pattern: /炸鸡|鸡柳|鸡排|肯德基|kfc|麦当劳|汉堡王|油炸|汉堡|薯条/i, ids: ['fried', 'heavy', 'burger', 'quick', 'snack'] },
  { pattern: /赛百味|subway|三明治|三文治/i, ids: ['cold', 'quick', 'snack', 'low_chain'] },
  { pattern: /粥|粉面|云吞|馄饨|粤菜|广式|茶餐厅/, ids: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { pattern: /茶楼|早茶/, ids: ['dim_sum', 'meal', 'snack', 'light', 'not_spicy'] },
  { pattern: /兰州|牛肉面|拉面|刀削面|米线|面馆/, ids: ['hot', 'staple', 'noodle', 'quick'] },
  { pattern: /快餐|简餐|便当|盖饭|黄焖鸡|卤肉饭|套餐/, ids: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { pattern: /小吃|包子|饺子|煎饼|烧麦|点心/, ids: ['quick', 'snack', 'solo', 'hot'] },
  { pattern: /热卤|卤味|盛香亭/, ids: ['snack', 'meal', 'hot', 'heavy', 'strong_flavor'] },
  { pattern: /料理|南洋料理/, ids: ['meal', 'rice', 'relaxed', 'stable'] },
  { pattern: /春饼|东北菜|东北|脆肚|私房菜|啫啫煲|煲仔饭|蛙来哒|鲜笋|外婆小聚/, ids: ['meal', 'rice', 'staple', 'relaxed'] },
  { pattern: /轻食|沙拉|健康|素食|低卡|减脂/, ids: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { pattern: /日式|日本|寿司|咖喱|拉面/, ids: ['rice', 'not_spicy', 'stable', 'solo'] },
  { pattern: /西餐|披萨|意式|brunch|牛排|咖啡/, ids: ['western', 'relaxed', 'slow', 'not_spicy'] }
];

TAG_RULES.push(
  { pattern: /咖啡|cafe|coffee|星巴克|starbucks|瑞幸|luckin|manner|peet|costa|tims|tim hortons|m stand|seesaw|arabica/i, ids: ['coffee', 'drink', 'non_meal', 'afternoon_tea'] },
  { pattern: /奶茶|茶饮|冷饮店|冷饮|喜茶|奈雪|一点点|1点点|霸王茶姬|蜜雪冰城|柠檬茶|linlee|麒麟大口茶|大口茶|coco|都可|koi|thé|阿嬷手作|去茶山|古茗|茉莉奶白|爷爷不泡茶|不泡茶|茶理宜世|茶记大咖|t9tea|tamkoko/i, ids: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { pattern: /饮品|饮品店|果茶|糖水|手打柠檬茶|麒麟大口茶|大口茶|coco|都可|koi|thé|混果汁|酸奶|牛奶|麦记牛奶|blueglass|茶道|茶园/i, ids: ['drink', 'dessert', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { pattern: /甜品|甜品店|糕饼|糕饼店|蛋糕|蛋糕店|面包|面包店|烘焙|烘焙店|点心|西点|gelato|pinvita|butterful|creamorous|珞珞|bakery|冰淇淋|paper stone|哈根达斯|haagen|baker|spice|bagel|贝果|zakuzaku|双皮奶|marmalade|bake land|老鼎丰/i, ids: ['dessert', 'non_meal', 'afternoon_tea', 'sweet'] },
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
    const keyManager = createAmapKeyManager({ requestId });

    if (keyManager.keyCount === 0) {
      return fail(requestId, 'AMAP_KEY_MISSING', 'AMap WebService key is not configured.');
    }

    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return fail(requestId, 'INVALID_LOCATION', 'latitude and longitude are required.');
    }

    if (event.action === 'reverseGeocode') {
      const amapResponse = await requestAmapRegeoWithKeySwitch({
        keyManager,
        latitude,
        longitude,
        maxAmapApiCalls: keyManager.keyCount
      });

      if (amapResponse.status !== '1' || amapResponse.infocode !== '10000') {
        return fail(requestId, 'AMAP_REGEOCODE_FAILED', amapResponse.info || 'AMap reverse geocode failed.', {
          infocode: amapResponse.infocode,
          status: amapResponse.status,
          ...keyManager.getMeta()
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
        requestId,
        meta: keyManager.getMeta()
      };
    }

    const mode = normalizeSearchMode(event.mode);
    const radius = clampInteger(event.radiusMeters, 300, 15000, DEFAULT_RADIUS_METERS);
    const pageSize = clampInteger(event.pageSize, 1, 25, DEFAULT_PAGE_SIZE);
    // 拉取页数上限放宽到 8（默认仍为 1）：高德 polygon 单次最多约返回 200 条(8页×25)，
    // 此前锁死在 3 页(75家)导致 CBD 等密集区高端店被默认排序挤到后面、召回不全。
    const pageCount = clampInteger(event.pageCount || event.pageNum, 1, 8, 1);
    const keyword = typeof event.keyword === 'string' ? event.keyword.trim() : '';
    const city = typeof event.city === 'string' ? event.city.trim() : '';
    const adcode = typeof event.adcode === 'string' ? event.adcode.trim() : '';
    const poiId = typeof event.id === 'string' ? event.id.trim() : typeof event.poiId === 'string' ? event.poiId.trim() : '';
    const types = typeof event.types === 'string' && event.types.trim() ? event.types.trim() : AMAP_FOOD_TYPE;
    const polygon = typeof event.polygon === 'string' && event.polygon.trim()
      ? event.polygon.trim()
      : buildRectanglePolygon({ latitude, longitude, radiusMeters: radius });
    const fetchReason = typeof event.fetchReason === 'string' ? event.fetchReason.trim() : 'unspecified';
    // API 调用预算上限同步放宽到 8（默认仍为 3），与 pageCount 配合让首页预取可一次拉满较深页数；
    // 实际并发仍由小程序端串行节流(约2.8 QPS)控制，不会触发 QPS 限流。
    const maxAmapApiCalls = clampInteger(event.maxAmapApiCalls, 0, 8, 3);
    const quotaBucket = getQuotaBucket(mode);
    const cacheKey = buildCloudCacheKey({
      mode,
      latitude,
      longitude,
      radius,
      pageSize,
      pageCount,
      keyword,
      types,
      city,
      adcode,
      polygon,
      poiId
    });
    const useCloudCache = event.cache === true;
    const cached = useCloudCache ? await readCloudPoiCache(cacheKey) : null;

    if (cached) {
      const searchMeta = buildSearchMeta({
        mode,
        cacheHit: true,
        cacheKey,
        apiCallCount: 0,
        quotaBucket,
        radiusMeters: radius,
        keyword,
        city,
        adcode,
        cacheAgeMs: Date.now() - cached.createdAt,
        keyMeta: keyManager.getMeta()
      });

      return {
        ok: true,
        data: {
          restaurants: cached.restaurants,
          source: 'amap',
          fetchedAt: new Date(cached.createdAt).toISOString(),
          location: { latitude, longitude },
          radiusMeters: radius,
          keywordFallbackUsed: cached.keywordFallbackUsed === true,
          pageCount,
          cacheHit: true,
          cacheKey,
          cacheAgeMs: Date.now() - cached.createdAt,
          fetchReason: 'cloud-cache-hit',
          amapApiCallCount: 0,
          ...keyManager.getMeta(),
          searchMeta
        },
        requestId
      };
    }

    if (maxAmapApiCalls <= 0) {
      return fail(requestId, useCloudCache ? 'AMAP_CACHE_MISS_LIVE_DISABLED' : 'AMAP_LIVE_REQUEST_LIMIT', 'Live AMap POI request is not allowed for this call.', {
        cacheKey,
        fetchReason
      });
    }

    if (mode === 'keyword' && !keyword) {
      return fail(requestId, 'AMAP_KEYWORD_MISSING', 'Keyword search requires keyword.', { cacheKey, fetchReason });
    }

    if (mode === 'keyword' && !city && !adcode) {
      return fail(requestId, 'AMAP_KEYWORD_SCOPE_MISSING', 'Keyword search requires city or adcode to avoid national search.', {
        cacheKey,
        fetchReason
      });
    }

    if (mode === 'id' && !poiId) {
      return fail(requestId, 'AMAP_ID_MISSING', 'ID search requires id or poiId.', { cacheKey, fetchReason });
    }

    console.warn('AMap POI live request.', {
      mode,
      cacheKey,
      fetchReason,
      radius,
      pageSize,
      pageCount,
      keyword,
      city,
      adcode,
      types,
      maxAmapApiCalls
    });

    const pageResult = await requestAmapPages({
      keyManager,
      mode,
      latitude,
      longitude,
      radius,
      polygon,
      pageSize,
      pageCount,
      keyword,
      city,
      adcode,
      poiId,
      types,
      maxAmapApiCalls
    });
    const amapResponse = pageResult.response;
    const amapApiCallCount = pageResult.apiCallCount;

    if (amapResponse.status !== '1' || amapResponse.infocode !== '10000') {
      return fail(requestId, 'AMAP_REQUEST_FAILED', amapResponse.info || 'AMap request failed.', {
        infocode: amapResponse.infocode,
        status: amapResponse.status,
        apiCallCount: amapApiCallCount,
        totalAmapApiCallCount: amapApiCallCount,
        mode,
        quotaBucket,
        ...pageResult.keyMeta
      });
    }

    const restaurants = (Array.isArray(amapResponse.pois) ? amapResponse.pois : [])
      .map((poi) => convertPoiToRestaurant(poi, { latitude, longitude }))
      .filter(Boolean)
      .filter((restaurant) => shouldKeepRestaurantByDistance(restaurant, mode, radius))
      .sort(compareRestaurantForPoiSearch)
      .slice(0, MAX_CACHE_RESTAURANTS);
    const searchMeta = buildSearchMeta({
      mode,
      cacheHit: false,
      cacheKey,
      apiCallCount: amapApiCallCount,
      quotaBucket,
      radiusMeters: radius,
      keyword,
      city,
      adcode,
      keyMeta: pageResult.keyMeta
    });

    if (restaurants.length > 0 && useCloudCache) {
      await writeCloudPoiCache(cacheKey, {
        restaurants,
        createdAt: Date.now(),
        location: { latitude, longitude },
        radiusMeters: radius,
        pageSize,
        pageCount,
        mode,
        keyword,
        types,
        city,
        adcode,
        quotaBucket,
        searchMeta
      });
    }

    return {
      ok: true,
      data: {
        restaurants,
        source: 'amap',
        fetchedAt: new Date().toISOString(),
        location: { latitude, longitude },
        radiusMeters: radius,
        keywordFallbackUsed: false,
        pageCount,
        cacheHit: false,
        cacheKey,
        fetchReason: `cloud-cache-miss-${mode}-fetch`,
        amapApiCallCount,
        ...pageResult.keyMeta,
        searchMeta
      },
      requestId
    };
  } catch (error) {
    return fail(requestId, 'AMAP_POI_ERROR', error.message || 'Failed to fetch AMap POI.');
  }
};

async function requestAmapPages({
  keyManager,
  mode,
  latitude,
  longitude,
  radius,
  polygon,
  pageSize,
  pageCount,
  keyword,
  city,
  adcode,
  poiId,
  types,
  maxAmapApiCalls
}) {
  let mergedResponse;
  const seenIds = new Set();
  const pois = [];
  let apiCallCount = 0;

  for (let page = 1; page <= pageCount && apiCallCount < maxAmapApiCalls; page += 1) {
    const response = await requestAmapSearchWithRetry({
      keyManager,
      mode,
      latitude,
      longitude,
      radius,
      polygon,
      pageSize,
      page,
      keyword,
      city,
      adcode,
      poiId,
      types,
      getRemainingApiCalls: () => maxAmapApiCalls - apiCallCount,
      recordApiCall: () => {
        apiCallCount += 1;
      }
    });

    if (response.status !== '1' || response.infocode !== '10000') {
      return {
        response,
        apiCallCount,
        keyMeta: keyManager.getMeta()
      };
    }

    mergedResponse = mergedResponse || response;
    const pagePois = Array.isArray(response.pois) ? response.pois : [];

    pagePois.forEach((poi) => {
      const key = poi && (poi.id || `${poi.name || ''}|${poi.location || ''}`);

      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        pois.push(poi);
      }
    });

    if (pagePois.length < pageSize) {
      break;
    }
  }

  return {
    response: {
      ...(mergedResponse || { status: '1', infocode: '10000' }),
      pois
    },
    apiCallCount,
    keyMeta: keyManager.getMeta()
  };
}

async function readCloudPoiCache(cacheKey) {
  try {
    const db = cloud.database();

    if (!(await ensureCloudPoiCacheCollection(db))) {
      return null;
    }

    const result = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
    const data = result && result.data;

    if (!data || !Array.isArray(data.restaurants)) {
      return null;
    }

    const createdAt = Number(data.createdAt);

    if (!Number.isFinite(createdAt) || Date.now() - createdAt > CACHE_TTL_MS) {
      return null;
    }

    return {
      ...data,
      restaurants: data.restaurants.slice(0, MAX_CACHE_RESTAURANTS),
      createdAt
    };
  } catch (error) {
    console.warn('AMap cloud POI cache read skipped.', {
      cacheKey,
      message: error && error.message
    });
    return null;
  }
}

async function writeCloudPoiCache(cacheKey, data) {
  try {
    const db = cloud.database();

    if (!(await ensureCloudPoiCacheCollection(db))) {
      return;
    }

    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      data: {
        ...data,
        restaurants: data.restaurants.slice(0, MAX_CACHE_RESTAURANTS),
        updatedAt: Date.now()
      }
    });
  } catch (error) {
    console.warn('AMap cloud POI cache write skipped.', {
      cacheKey,
      message: error && error.message
    });
  }
}

async function ensureCloudPoiCacheCollection(db) {
  if (cloudPoiCacheCollectionReady) {
    return true;
  }

  if (cloudPoiCacheCollectionUnavailable) {
    return false;
  }

  try {
    await db.collection(CACHE_COLLECTION).limit(1).get();
    cloudPoiCacheCollectionReady = true;
    return true;
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      console.warn('AMap cloud POI cache collection check skipped.', {
        message: error && error.message
      });
      cloudPoiCacheCollectionUnavailable = true;
      return false;
    }
  }

  try {
    await db.createCollection(CACHE_COLLECTION);
    cloudPoiCacheCollectionReady = true;
    return true;
  } catch (error) {
    if (isCollectionAlreadyExistsError(error)) {
      cloudPoiCacheCollectionReady = true;
      return true;
    }

    console.warn('AMap cloud POI cache collection create skipped.', {
      collection: CACHE_COLLECTION,
      message: error && error.message
    });
    cloudPoiCacheCollectionUnavailable = true;
    return false;
  }
}

function isCollectionMissingError(error) {
  const text = `${(error && error.errCode) || ''} ${(error && error.code) || ''} ${(error && error.message) || ''}`;

  return /COLLECTION_NOT_EXIST|DATABASE_COLLECTION_NOT_EXIST|collection.*not.*exist|集合.*不存在|-502005|-502003/i.test(text);
}

function isCollectionAlreadyExistsError(error) {
  const text = `${(error && error.errCode) || ''} ${(error && error.code) || ''} ${(error && error.message) || ''}`;

  return /COLLECTION_ALREADY_EXISTS|collection.*exist|集合.*存在|-502004/i.test(text);
}

function buildCloudCacheKey({
  mode,
  latitude,
  longitude,
  radius,
  pageSize,
  pageCount,
  keyword,
  types,
  city,
  adcode,
  polygon,
  poiId
}) {
  const locationBucket = `${roundCoordinate(latitude)}_${roundCoordinate(longitude)}`;
  const radiusBucket = Math.ceil(radius / 500) * 500;
  const normalizedKeyword = normalizeKeyword(keyword) || 'broad';
  const raw = [
    'v3',
    `mode-${mode || 'polygon'}`,
    `loc-${locationBucket}`,
    `r-${radiusBucket}`,
    `types-${normalizeKeySegment(types)}`,
    `kw-${normalizeKeySegment(normalizedKeyword)}`,
    `city-${normalizeKeySegment(city || 'none')}`,
    `adcode-${normalizeKeySegment(adcode || 'none')}`,
    `poly-${hashString(polygon || 'none')}`,
    `id-${normalizeKeySegment(poiId || 'none')}`,
    `ps-${pageSize}`,
    `pc-${pageCount}`,
    'fp-cloud'
  ].join('|');

  return `amap_${hashString(raw)}_${normalizeKeySegment(raw).slice(0, 80)}`;
}

function roundCoordinate(value) {
  return (Math.round(Number(value) * 100) / 100).toFixed(2);
}

function normalizeKeyword(keyword) {
  return String(keyword || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeKeySegment(value) {
  return String(value || '')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function hashString(value) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

// 高德"访问过于频繁 / 并发(QPS)超限"类错误码：这些是瞬时限制（每秒滑动窗口），
// 短暂退避后重试通常即可成功。不含日配额耗尽(10003)和权限类错误（重试无意义）。
const AMAP_QPS_INFOCODES = new Set(['10004', '10019', '10020', '10021', '10022', '10023', '10024', '10025', '10026', '10029']);
const AMAP_QUOTA_EXHAUSTED_INFOCODES = new Set(['10003']);
const AMAP_RETRY_MAX_ATTEMPTS = 3;
const AMAP_RETRY_BASE_DELAY_MS = 250;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 调用高德搜索；遇到 QPS/并发限流类错误（如 infocode 10021）时按指数退避重试。
// 首页 prefetch 与推荐流程可能并发打高德，瞬时并发超过个人 key 的 QPS 上限会整批失败，
// 这里让被限流的单个请求自动错开重试，避免推荐因瞬时限流而拿到空结果。
async function requestAmapSearchWithRetry(params) {
  let response;
  const maxAttempts = Math.max(AMAP_RETRY_MAX_ATTEMPTS, params.keyManager.keyCount);

  for (let attempt = 0; attempt < maxAttempts && params.getRemainingApiCalls() > 0; attempt += 1) {
    if (attempt > 0) {
      // 指数退避：250ms、500ms，错开瞬时并发高峰
      await delay(AMAP_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const keyEntry = params.keyManager.getCurrentKey();

    if (!keyEntry) {
      return response || { status: '0', infocode: 'AMAP_KEYS_UNAVAILABLE', info: 'No AMap key is available for this request.' };
    }

    params.recordApiCall();

    try {
      response = await requestAmapSearch({
        ...params,
        key: keyEntry.key
      });
    } catch (error) {
      response = {
        status: '0',
        infocode: 'NETWORK_ERROR',
        info: error && error.message ? error.message : 'AMap network request failed.'
      };
    }
    const infocode = response && response.infocode != null ? String(response.infocode) : '';
    const errorClass = classifyAmapFailure(response);

    if (response && response.status === '1') {
      return response;
    }

    if (!errorClass.retryable) {
      return response; // 非限流类错误（如参数错误）重试无意义，直接返回
    }

    params.keyManager.markFailure(keyEntry.index, errorClass);

    console.warn('AMap request failed, switching key when available.', {
      infocode,
      info: response && response.info,
      attempt: attempt + 1,
      key: keyEntry.label,
      reason: errorClass.reason,
      nextKeyIndex: params.keyManager.peekNextKeyIndex()
    });
  }

  return response;
}

async function requestAmapRegeoWithKeySwitch({ keyManager, latitude, longitude, maxAmapApiCalls }) {
  let response;

  for (let attempt = 0; attempt < maxAmapApiCalls; attempt += 1) {
    const keyEntry = keyManager.getCurrentKey();

    if (!keyEntry) {
      return response || { status: '0', infocode: 'AMAP_KEYS_UNAVAILABLE', info: 'No AMap key is available for this request.' };
    }

    try {
      response = await requestAmapRegeo({ key: keyEntry.key, latitude, longitude });
    } catch (error) {
      response = {
        status: '0',
        infocode: 'NETWORK_ERROR',
        info: error && error.message ? error.message : 'AMap network request failed.'
      };
    }

    if (response && response.status === '1' && response.infocode === '10000') {
      return response;
    }

    const errorClass = classifyAmapFailure(response);

    if (!errorClass.retryable) {
      return response;
    }

    keyManager.markFailure(keyEntry.index, errorClass);
  }

  return response;
}

function parseAmapKeysFromEnv(env = process.env) {
  const raw =
    env.AMAP_WEB_SERVICE_KEYS ||
    env.AMAP_KEYS ||
    env.AMAP_WEB_SERVICE_KEY ||
    env.AMAP_KEY ||
    '';

  return String(raw)
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function createAmapKeyManager({ env = process.env, requestId = '', now = Date.now } = {}) {
  const keys = parseAmapKeysFromEnv(env);
  const requestSalt = requestId || String(now());
  let currentIndex = keys.length > 0 ? parseInt(hashString(requestSalt), 36) % keys.length : 0;
  let switchCount = 0;
  let quotaErrorCount = 0;
  const exhaustedForRequest = new Set();

  function isAvailable(index) {
    if (exhaustedForRequest.has(index)) {
      return false;
    }

    const cooldownUntil = amapKeyCooldowns.get(keys[index]);
    return !cooldownUntil || cooldownUntil <= now();
  }

  function findAvailableIndex(startIndex) {
    if (keys.length === 0) {
      return -1;
    }

    for (let offset = 0; offset < keys.length; offset += 1) {
      const index = (startIndex + offset) % keys.length;

      if (isAvailable(index)) {
        return index;
      }
    }

    return -1;
  }

  function moveToNextAvailable() {
    const nextIndex = findAvailableIndex((currentIndex + 1) % keys.length);

    if (nextIndex >= 0 && nextIndex !== currentIndex) {
      switchCount += 1;
      currentIndex = nextIndex;
    }

    return nextIndex;
  }

  return {
    get keyCount() {
      return keys.length;
    },
    getCurrentKey() {
      const availableIndex = findAvailableIndex(currentIndex);

      if (availableIndex < 0) {
        return null;
      }

      if (availableIndex !== currentIndex) {
        switchCount += 1;
        currentIndex = availableIndex;
      }

      return {
        key: keys[currentIndex],
        index: currentIndex,
        label: maskAmapKey(keys[currentIndex], currentIndex)
      };
    },
    markFailure(index, errorClass) {
      if (errorClass.countAsQuota) {
        quotaErrorCount += 1;
      }

      if (errorClass.cooldown === 'qps') {
        amapKeyCooldowns.set(keys[index], now() + AMAP_QPS_COOLDOWN_MS);
      } else if (errorClass.cooldown === 'quota') {
        exhaustedForRequest.add(index);
      }

      moveToNextAvailable();
    },
    peekNextKeyIndex() {
      const nextIndex = findAvailableIndex((currentIndex + 1) % keys.length);
      return nextIndex >= 0 ? nextIndex + 1 : null;
    },
    getMeta() {
      return {
        amapKeyIndex: keys.length > 0 ? currentIndex + 1 : null,
        amapKeyCount: keys.length,
        amapKeySwitchCount: switchCount,
        quotaErrorCount
      };
    }
  };
}

function classifyAmapFailure(response) {
  const infocode = response && response.infocode != null ? String(response.infocode) : '';
  const info = String((response && response.info) || '').toLowerCase();

  if (infocode === 'NETWORK_ERROR') {
    return { retryable: true, cooldown: null, countAsQuota: false, reason: 'network' };
  }

  if (AMAP_QPS_INFOCODES.has(infocode) || /qps|throttle|频繁|并发|繁忙/.test(info)) {
    return { retryable: true, cooldown: 'qps', countAsQuota: false, reason: 'qps' };
  }

  if (AMAP_QUOTA_EXHAUSTED_INFOCODES.has(infocode) || /quota|daily|limit|exceed|配额|额度|上限|超限|耗尽/.test(info)) {
    return { retryable: true, cooldown: 'quota', countAsQuota: true, reason: 'quota' };
  }

  return { retryable: false, cooldown: null, countAsQuota: false, reason: 'fatal' };
}

function maskAmapKey(key, index) {
  const tail = String(key || '').slice(-4);
  return tail ? `key#${index + 1}(...${tail})` : `key#${index + 1}`;
}

function requestAmapSearch({
  key,
  mode,
  latitude,
  longitude,
  radius,
  polygon,
  pageSize,
  page,
  keyword,
  city,
  adcode,
  poiId,
  types
}) {
  const params = new URLSearchParams({
    key,
    types,
    offset: String(pageSize),
    page: String(page),
    extensions: 'all',
    output: 'json'
  });
  let url = AMAP_PLACE_AROUND_URL;

  if (keyword) {
    params.set('keywords', keyword);
  }

  if (mode === 'polygon') {
    url = AMAP_PLACE_POLYGON_URL;
    params.set('polygon', polygon || buildRectanglePolygon({ latitude, longitude, radiusMeters: radius }));
  } else if (mode === 'keyword') {
    url = AMAP_PLACE_TEXT_URL;
    params.delete('page');
    params.set('page', String(page));
    if (adcode) {
      params.set('city', adcode);
    } else if (city) {
      params.set('city', city);
    }
    params.set('citylimit', 'true');
  } else if (mode === 'id') {
    url = AMAP_PLACE_DETAIL_URL;
    params.delete('types');
    params.delete('offset');
    params.delete('page');
    params.delete('keywords');
    params.set('id', poiId);
  } else {
    params.set('location', `${longitude},${latitude}`);
    params.set('radius', String(radius));
    params.set('sortrule', 'distance');
  }

  return requestJson(`${url}?${params.toString()}`);
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

function convertPoiToRestaurant(poi, center) {
  if (!poi || !poi.id || !poi.name) {
    return null;
  }

  const location = parseAmapLocation(poi.location);
  const text = [poi.type, poi.typecode, poi.name].filter(Boolean).join(';');

  if (isNonRestaurantSalesPoi(text)) {
    return null;
  }

  const explicitAverageCostYuan = parsePositiveNumber(poi.biz_ext && poi.biz_ext.cost);
  const tagIds = mapCategoryToTagIds(text);
  const inferredAverageCostYuan = inferAverageCostYuan(text, tagIds);
  const averageCostYuan = explicitAverageCostYuan || inferredAverageCostYuan;
  const photos = Array.isArray(poi.photos) ? poi.photos : [];
  const firstPhoto = photos.find((photo) => photo && photo.url);
  const coverImageUrl = firstPhoto && normalizeImageUrl(firstPhoto.url);

  const distanceMeters = parseNumber(poi.distance) || (location && center ? Math.round(getDistanceMeters(center, location)) : undefined);

  return {
    id: `amap-${poi.id}`,
    name: poi.name,
    tags: tagIds.map((id) => TAG_LABELS[id] || id),
    tagIds,
    description: poi.type || undefined,
    category: poi.type || undefined,
    address: normalizeAmapText(poi.address),
    location,
    distanceMeters,
    priceLevel: toPriceLevel(averageCostYuan),
    averageCostYuan,
    phone: normalizeAmapText(poi.tel),
    openStatus: 'unknown',
    signatureDishes: [],
    coverImageUrl,
    rating: parseNumber(poi.biz_ext && poi.biz_ext.rating),
    source: 'amap',
    status: 'active'
  };
}

function normalizeImageUrl(url) {
  if (typeof url !== 'string') {
    return undefined;
  }

  return url.replace(/^http:\/\//i, 'https://');
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

  const strongNonMealPoiEvidence = hasStrongNonMealPoiEvidence(text);

  if (strongNonMealPoiEvidence) {
    ids.add('non_meal');
    ['meal', 'staple', 'rice', 'noodle', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum'].forEach((id) => ids.delete(id));

    if (['drink', 'milk_tea', 'coffee', 'dessert'].some((id) => ids.has(id))) {
      ids.delete('quick');
    }
  }

  if (!strongNonMealPoiEvidence && hasPremiumMealPoiEvidence(ids, text)) {
    ['quick', 'fast_service', 'low_queue', 'congee', 'hot', 'snack', 'solo', 'set_meal'].forEach((id) => ids.delete(id));
    ['meal', 'premium_brand', 'relaxed', 'slow'].forEach((id) => ids.add(id));
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

function hasStrongNonMealPoiEvidence(text) {
  return /冷饮店|饮品店|饮品|奶茶|茶饮|咖啡厅|咖啡店|咖啡馆|cafe|coffee|甜品店|甜品|糕饼店|糕饼|蛋糕店|蛋糕|面包店|面包|烘焙店|烘焙|冰淇淋|gelato|星巴克|starbucks|瑞幸|luckin|manner|库迪|cotti|喜茶|奈雪|霸王茶姬|coco|都可|古茗|蜜雪冰城|茶百道|沪上阿姨/i.test(
    String(text || '')
  );
}

function hasPremiumMealPoiEvidence(ids, text) {
  const normalizedText = String(text || '').toLowerCase();
  return (
    ids.has('premium_brand') ||
    PREMIUM_CHAIN_KEYWORDS.some((keyword) => normalizedText.includes(keyword.toLowerCase())) ||
    /高端|黑珍珠|米其林|omakase|fine dining|hotel restaurant|private kitchen|chef restaurant|chef|主厨|私厨|私房|牛排馆|海鲜放题|法餐|高端日料|酒店餐厅|星级酒店|白天鹅|炳胜|利苑|大董|新荣记|甬府|GRILL|grill|烧肉|融合料理|创意菜/i.test(normalizedText)
  );
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

function normalizeSearchMode(mode) {
  return ['around', 'polygon', 'keyword', 'id'].includes(mode) ? mode : 'polygon';
}

function getQuotaBucket(mode) {
  if (mode === 'polygon') return 'place-polygon';
  if (mode === 'keyword') return 'place-text';
  if (mode === 'id') return 'place-detail';
  return 'place-around';
}

function buildSearchMeta({
  mode,
  cacheHit,
  cacheKey,
  apiCallCount,
  quotaBucket,
  radiusMeters,
  keyword,
  city,
  adcode,
  cacheAgeMs,
  keyMeta
}) {
  return {
    mode,
    cacheHit,
    cacheKey,
    apiCallCount,
    quotaBucket,
    radiusMeters,
    keyword,
    city,
    adcode,
    cacheAgeMs,
    aroundCallCount: mode === 'around' && !cacheHit ? apiCallCount : 0,
    polygonCallCount: mode === 'polygon' && !cacheHit ? apiCallCount : 0,
    keywordCallCount: mode === 'keyword' && !cacheHit ? apiCallCount : 0,
    idCallCount: mode === 'id' && !cacheHit ? apiCallCount : 0,
    cacheHitCount: cacheHit ? 1 : 0,
    totalAmapApiCallCount: cacheHit ? 0 : apiCallCount,
    ...(keyMeta || {})
  };
}

function buildRectanglePolygon({ latitude, longitude, radiusMeters }) {
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.cos(toRadians(latitude)) || 1);
  const west = clampCoordinate(longitude - longitudeDelta, -180, 180);
  const east = clampCoordinate(longitude + longitudeDelta, -180, 180);
  const north = clampCoordinate(latitude + latitudeDelta, -90, 90);
  const south = clampCoordinate(latitude - latitudeDelta, -90, 90);

  return `${formatCoordinate(west)},${formatCoordinate(south)}|${formatCoordinate(east)},${formatCoordinate(north)}`;
}

function shouldKeepRestaurantByDistance(restaurant, mode, radiusMeters) {
  if (mode !== 'polygon' && mode !== 'keyword') {
    return true;
  }

  return typeof restaurant.distanceMeters !== 'number' || restaurant.distanceMeters <= radiusMeters;
}

function compareRestaurantForPoiSearch(left, right) {
  const distanceScore = (left.distanceMeters || Number.MAX_SAFE_INTEGER) - (right.distanceMeters || Number.MAX_SAFE_INTEGER);
  if (distanceScore !== 0) return distanceScore;

  const ratingScore = (right.rating || 0) - (left.rating || 0);
  if (ratingScore !== 0) return ratingScore;

  return 0;
}

function getDistanceMeters(left, right) {
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

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function clampCoordinate(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
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

module.exports = {
  ...module.exports,
  classifyAmapFailure,
  createAmapKeyManager,
  maskAmapKey,
  parseAmapKeysFromEnv
};
