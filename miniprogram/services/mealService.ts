import type { MealCandidate } from '../models/meal';
import type { UserQuestionnaireResult } from '../types/userPreference';
import { buildAmapRestaurantQuery } from './amapQueryBuilder';
import { getNearbyRestaurants } from './amapPoiService';
import type { HistoryFilterContext } from './historyService';
import { mapAnswersToPreferenceProfile } from './preferenceMapper';
import { recommendRestaurants } from './recommendationEngine';

export async function getTodayRecommendation(): Promise<MealCandidate> {
  const [candidate] = await getRecommendations(undefined, 1);

  if (!candidate) {
    throw new Error('No recommendation candidates available.');
  }

  return candidate;
}

export async function getLocalRecommendations(
  questionnaire?: UserQuestionnaireResult,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  return getRecommendations(questionnaire, 4, historyFilterContext);
}

async function getRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  const poiCandidates = await getAmapRecommendations(questionnaire, limit, historyFilterContext);

  if (poiCandidates.length > 0) {
    return poiCandidates;
  }

  throw new Error('No real nearby restaurant candidates available from AMap.');
}

async function getAmapRecommendations(
  questionnaire: UserQuestionnaireResult | undefined,
  limit: number,
  historyFilterContext?: HistoryFilterContext
): Promise<MealCandidate[]> {
  const preferenceSnapshot = mapAnswersToPreferenceProfile(questionnaire?.answers ?? []);
  const recommendationContext = buildRecommendationContext(preferenceSnapshot, historyFilterContext);
  const amapQuery = buildAmapRestaurantQuery(preferenceSnapshot);
  const attempts = buildAmapQueryAttempts(amapQuery, preferenceSnapshot);
  const restaurantPool = new Map<string, Awaited<ReturnType<typeof getNearbyRestaurants>>[number]>();

  for (const attempt of attempts) {
    const restaurants = await getNearbyRestaurants({
      radiusMeters: attempt.radiusMeters,
      keyword: attempt.keyword,
      types: attempt.types,
      pageSize: 25,
      pageCount: attempt.pageCount
    }).catch((error) => {
      console.warn('Nearby AMap POI recommendation attempt failed.', attempt, error);
      return [];
    });

    if (restaurants.length === 0) {
      continue;
    }

    restaurants.forEach((restaurant) => {
      const key = normalizeRestaurantPoolKey(restaurant);
      restaurantPool.set(key, restaurant);
    });
  }

  if (restaurantPool.size === 0) {
    return [];
  }

  const result = recommendRestaurants({
    restaurants: [...restaurantPool.values()],
    context: recommendationContext,
    limit,
    source: 'amap'
  });

  return result.candidates;
}

function buildAmapQueryAttempts(
  amapQuery: ReturnType<typeof buildAmapRestaurantQuery>,
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>
): Array<{ radiusMeters: number; keyword: string; types: string; pageCount: number }> {
  const baseRadius = amapQuery.radiusMeters;
  const wideRadius = Math.max(baseRadius, 3000);
  const baseKeyword = amapQuery.keywords ?? '';
  const relaxedKeyword = getStrictCategoryKeyword(baseKeyword) ?? '';
  const premiumKeywords = getPremiumKeywordAttempts(baseKeyword);
  const nonMealPremiumKeywords = getNonMealPremiumKeywordAttempts(preferenceSnapshot);
  const brandChainKeywords = getBrandChainKeywordAttempts(preferenceSnapshot);
  const mallKeywords = getMallKeywordAttempts(preferenceSnapshot);
  const premiumSearch = premiumKeywords.length > 0 || nonMealPremiumKeywords.length > 0 || brandChainKeywords.length > 0;
  const maxRadius = Math.max(baseRadius, premiumSearch ? 15000 : 10000);

  return [
    {
      radiusMeters: baseRadius,
      keyword: baseKeyword,
      types: amapQuery.types,
      pageCount: 2
    },
    {
      radiusMeters: wideRadius,
      keyword: relaxedKeyword,
      types: amapQuery.types,
      pageCount: 2
    },
    {
      radiusMeters: maxRadius,
      keyword: relaxedKeyword,
      types: amapQuery.types,
      pageCount: premiumSearch ? 3 : 2
    },
    ...premiumKeywords.flatMap((keyword) => [
      {
        radiusMeters: wideRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 2
      },
      {
        radiusMeters: 10000,
        keyword,
        types: amapQuery.types,
        pageCount: 2
      },
      {
        radiusMeters: maxRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 3
      }
    ]),
    ...nonMealPremiumKeywords.flatMap((keyword) => [
      {
        radiusMeters: wideRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 2
      },
      {
        radiusMeters: maxRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 3
      }
    ]),
    ...brandChainKeywords.flatMap((keyword) => [
      {
        radiusMeters: wideRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 2
      },
      {
        radiusMeters: maxRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 3
      }
    ]),
    ...mallKeywords.flatMap((keyword) => [
      {
        radiusMeters: wideRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 2
      },
      {
        radiusMeters: maxRadius,
        keyword,
        types: amapQuery.types,
        pageCount: 3
      }
    ])
  ].filter((attempt, index, attempts) => {
    return attempts.findIndex((item) => {
      return item.radiusMeters === attempt.radiusMeters && item.keyword === attempt.keyword && item.types === attempt.types;
    }) === index;
  });
}

function getNonMealPremiumKeywordAttempts(
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>
): string[] {
  if ((preferenceSnapshot.budgetLevel ?? 3) < 5) {
    return [];
  }

  const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);

  if (selected.has('prefer_milk_tea') || selected.has('intent_drink')) {
    return [
      '精品咖啡|茶饮|奶茶|酒店下午茶|下午茶',
      '喜茶|奈雪|霸王茶姬|KOI|麒麟大口茶|阿嬷手作|去茶山|古茗|茉莉奶白|爷爷不泡茶|茶理宜世|茶饮'
    ];
  }

  if (selected.has('prefer_coffee')) {
    return ['精品咖啡|咖啡馆|cafe|酒店下午茶|下午茶', '星巴克|瑞幸|Manner|Peet|Costa|Tims'];
  }

  if (selected.has('prefer_bakery_dessert') || selected.has('intent_dessert')) {
    return ['甜品|蛋糕|面包|烘焙|西点|Gelato|冰淇淋|Bakery|哈根达斯|贝果|双皮奶|酒店下午茶|下午茶'];
  }

  return [];
}

function getBrandChainKeywordAttempts(
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>
): string[] {
  const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);

  if (!selected.has('brand_chain')) {
    return [];
  }

  if ((preferenceSnapshot.budgetLevel ?? 3) >= 6) {
    return [
      '炳胜|利苑|广州酒家|白天鹅|黑珍珠|米其林',
      '高端餐厅|私房菜|omakase|Fine Dining'
    ];
  }

  if ((preferenceSnapshot.budgetLevel ?? 3) >= 5) {
    return [
      '费大厨|小菜园|西贝|海底捞|太二|探鱼',
      '点都德|陶陶居|广州酒家|绿茶餐厅|外婆家|九毛九'
    ];
  }

  return [];
}

function getMallKeywordAttempts(
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>
): string[] {
  const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);
  const preferred = new Set(preferenceSnapshot.preferredTagIds ?? []);
  const shouldSearchMall =
    selected.has('brand_chain') ||
    selected.has('distance_any') ||
    (preferenceSnapshot.budgetLevel ?? 3) >= 5 ||
    preferred.has('mall_store') ||
    preferred.has('premium_brand') ||
    preferred.has('mid_chain');

  if (!shouldSearchMall) {
    return [];
  }

  if (selected.has('prefer_milk_tea') || selected.has('intent_drink')) {
    return ['商场|购物中心|广场|mall|茶饮|奶茶', '购物中心|商场|下午茶|饮品', '商场|购物中心|阿嬷手作|去茶山|KOI|古茗|茉莉奶白|爷爷不泡茶'];
  }

  if (selected.has('prefer_coffee')) {
    return ['商场|购物中心|广场|mall|咖啡', '购物中心|商场|下午茶|咖啡', '商场|购物中心|星巴克|瑞幸|Manner'];
  }

  if (selected.has('prefer_bakery_dessert') || selected.has('intent_dessert')) {
    return ['商场|购物中心|广场|mall|甜品', '购物中心|商场|下午茶|蛋糕'];
  }

  if ((preferenceSnapshot.budgetLevel ?? 3) >= 6) {
    return ['商场|购物中心|高端餐厅|黑珍珠', '购物中心|商场|炳胜|利苑|广州酒家'];
  }

  return ['商场|购物中心|广场|mall|餐厅', '购物中心|商场|连锁餐厅|品牌餐厅'];
}

function normalizeRestaurantPoolKey(restaurant: Awaited<ReturnType<typeof getNearbyRestaurants>>[number]): string {
  const name = (restaurant.name ?? '').toLowerCase().replace(/\s+/g, '');
  const location = restaurant.location;
  const locationKey =
    location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
      ? `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`
      : '';

  return restaurant.id || `${name}|${locationKey}`;
}

function getPremiumKeywordAttempts(keyword: string): string[] {
  if (!/高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑/.test(keyword)) {
    return [];
  }

  return [
    '黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining',
    '炳胜|利苑|大董|新荣记|甬府|莆田|松鹤楼|广州酒家|白天鹅',
    '高端餐厅|私房菜'
  ];
}

function getStrictCategoryKeyword(keyword: string): string | undefined {
  if (/奶茶|茶饮|饮品|霸王茶姬|喜茶|奈雪|一点点|1点点|阿嬷手作|去茶山|KOI|古茗|茉莉奶白|爷爷不泡茶|茶理宜世/.test(keyword)) {
    return '奶茶|茶饮|霸王茶姬|喜茶|奈雪|一点点|1点点|阿嬷手作|去茶山|KOI|古茗|茉莉奶白|爷爷不泡茶|茶理宜世';
  }

  if (/咖啡|cafe|coffee|下午茶|星巴克|瑞幸|Manner/.test(keyword)) {
    return '咖啡|cafe|coffee|下午茶|星巴克|瑞幸|Manner';
  }

  if (/甜品|蛋糕|面包|烘焙|西点|Gelato|冰淇淋|Bakery|哈根达斯|贝果|双皮奶/.test(keyword)) {
    return '甜品|蛋糕|面包|烘焙|西点|Gelato|冰淇淋|Bakery|哈根达斯|贝果|双皮奶';
  }

  if (/高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑/.test(keyword)) {
    return '高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|炳胜|利苑';
  }

  return undefined;
}

function buildRecommendationContext(
  preferenceSnapshot: ReturnType<typeof mapAnswersToPreferenceProfile>,
  historyFilterContext?: HistoryFilterContext
) {
  const historyFilterEnabled = historyFilterContext?.historyFilterEnabled === true;

  return {
    preferenceSnapshot,
    excludeRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.excludedHistoryRestaurantIds ?? []
      : [],
    historyFilterEnabled,
    excludedHistoryRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.excludedHistoryRestaurantIds ?? []
      : [],
    historyPenaltyRestaurantIds: historyFilterEnabled
      ? historyFilterContext?.historyPenaltyRestaurantIds ?? []
      : [],
    historyPenaltyReasons: historyFilterEnabled
      ? historyFilterContext?.historyPenaltyReasons ?? []
      : []
  };
}
