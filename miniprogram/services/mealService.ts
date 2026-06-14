/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-array-constructor */
// @ts-nocheck
import { buildAmapRestaurantQuery } from './amapQueryBuilder';
import { getNearbyRestaurantsWithMeta } from './amapPoiService';
import { mapAnswersToPreferenceProfile } from './preferenceMapper';
import { recommendRestaurants } from './recommendationEngine';
const MAX_AMAP_API_CALLS_PER_RECOMMENDATION = 3;
const MAX_AMAP_KEY_RETRY_CALLS_PER_POI_REQUEST = 2;
const MAX_AROUND_API_CALLS_PER_RECOMMENDATION = 1;
const MIN_POOL_BEFORE_FALLBACK = 12;
const MIN_PREMIUM_POOL_BEFORE_FALLBACK = 6;
const EMPTY_QUESTIONNAIRE_RESULT = {
    version: 'empty',
    source: 'recommendation_filter',
    answers: Array(),
    submittedAt: ''
};
const EMPTY_HISTORY_FILTER_CONTEXT = {
    historyFilterEnabled: false,
    excludedHistoryRestaurantIds: Array(),
    historyPenaltyRestaurantIds: Array(),
    historyPenaltyReasons: Array()
};
export async function getTodayRecommendation() {
    const [candidate] = await getRecommendations(EMPTY_QUESTIONNAIRE_RESULT, 1);
    if (!candidate) {
        throw new Error('No recommendation candidates available.');
    }
    return candidate;
}
export async function getLocalRecommendations(questionnaire = EMPTY_QUESTIONNAIRE_RESULT, historyFilterContext = EMPTY_HISTORY_FILTER_CONTEXT) {
    return getRecommendations(questionnaire || EMPTY_QUESTIONNAIRE_RESULT, 4, historyFilterContext);
}
async function getRecommendations(questionnaire, limit, historyFilterContext = EMPTY_HISTORY_FILTER_CONTEXT) {
    const poiCandidates = await getAmapRecommendations(questionnaire, limit, historyFilterContext);
    if (poiCandidates.length > 0) {
        return poiCandidates;
    }
    throw new Error('No real nearby restaurant candidates available from AMap.');
}
async function getAmapRecommendations(questionnaire, limit, historyFilterContext = EMPTY_HISTORY_FILTER_CONTEXT) {
    const rawPreferenceSnapshot = mapAnswersToPreferenceProfile(questionnaire.answers);
    const preferenceSnapshot = normalizePreferenceProfileShape(rawPreferenceSnapshot);
    const recommendationContext = buildRecommendationContext(preferenceSnapshot, historyFilterContext);
    const amapQuery = normalizeAmapQueryShape(buildAmapRestaurantQuery(rawPreferenceSnapshot));
    const attempts = buildAmapQueryAttempts(amapQuery, preferenceSnapshot);
    const restaurantPool = new Map();
    const metaList = [];
    let remainingAmapApiCalls = MAX_AMAP_API_CALLS_PER_RECOMMENDATION;
    let remainingAroundCalls = MAX_AROUND_API_CALLS_PER_RECOMMENDATION;
    let quotaErrorSeen = false;
    for (const attempt of attempts) {
        if (remainingAmapApiCalls <= 0) {
            break;
        }
        if (attempt.mode === 'keyword' && !attempt.city && !attempt.adcode) {
            continue;
        }
        if (attempt.reason.includes('fallback') && shouldSkipFallbackAttempt(restaurantPool, preferenceSnapshot)) {
            continue;
        }
        if (attempt.mode === 'around') {
            if (shouldSkipFallbackAttempt(restaurantPool, preferenceSnapshot) || remainingAroundCalls <= 0) {
                continue;
            }
        }
        const attemptAmapBudget = getAttemptAmapBudget(attempt, remainingAmapApiCalls);
        if (!attempt.cacheOnly && attemptAmapBudget <= 0) {
            break;
        }
        let restaurants = [];
        let meta;
        try {
            const result = await getNearbyRestaurantsWithMeta({
                mode: attempt.mode,
                radiusMeters: attempt.radiusMeters,
                keyword: attempt.keyword,
                city: attempt.city,
                adcode: attempt.adcode,
                types: attempt.types,
                pageSize: 25,
                pageCount: attempt.pageCount,
                fetchProfile: 'recommendation',
                fetchReason: attempt.reason,
                cacheOnly: attempt.cacheOnly === true,
                maxAmapApiCalls: attemptAmapBudget
            });
            restaurants = result.restaurants.map((restaurant) => normalizeRestaurantShape(restaurant));
            meta = normalizePoiFetchMeta(result.meta, attempt.mode);
        }
        catch (error) {
            console.warn('Nearby AMap POI recommendation attempt failed.', attempt, error);
            if (isAmapDailyQuotaError(error)) {
                quotaErrorSeen = true;
                if (!attempt.cacheOnly) {
                    remainingAmapApiCalls = Math.max(0, remainingAmapApiCalls - attemptAmapBudget);
                    remainingAroundCalls = Math.max(0, remainingAroundCalls - (attempt.mode === 'around' ? 1 : 0));
                }
                metaList.push({
                    poiCacheHit: false,
                    poiCacheKey: '',
                    poiCacheAgeMs: 0,
                    poiFetchReason: `amap-quota-exhausted-${attempt.mode}-try-next`,
                    amapApiCallCount: 0,
                    poiFetchMode: attempt.mode,
                    aroundCallCount: 0,
                    polygonCallCount: 0,
                    keywordCallCount: 0,
                    idCallCount: 0,
                    cacheHitCount: 0,
                    totalAmapApiCallCount: 0,
                    quotaBucket: ''
                });
                if (restaurantPool.size > 0) {
                    break;
                }
                continue;
            }
            meta = {
                poiCacheHit: false,
                poiCacheKey: '',
                poiCacheAgeMs: 0,
                poiFetchReason: 'amap-failed-fallback',
                amapApiCallCount: 0,
                poiFetchMode: attempt.mode,
                aroundCallCount: 0,
                polygonCallCount: 0,
                keywordCallCount: 0,
                idCallCount: 0,
                cacheHitCount: 0,
                totalAmapApiCallCount: 0,
                quotaBucket: ''
            };
        }
        metaList.push(meta);
        remainingAmapApiCalls = Math.max(0, remainingAmapApiCalls - meta.amapApiCallCount);
        const aroundAttemptUsed = attempt.mode === 'around' && (meta.amapApiCallCount > 0 || meta.aroundCallCount > 0) ? 1 : 0;
        remainingAroundCalls = Math.max(0, remainingAroundCalls - aroundAttemptUsed);
        if (restaurants.length === 0) {
            if (!attempt.cacheOnly && remainingAmapApiCalls <= 0) {
                console.warn('AMap POI recommendation live request budget exhausted.', {
                    attempt,
                    maxAmapApiCalls: MAX_AMAP_API_CALLS_PER_RECOMMENDATION
                });
            }
            continue;
        }
        restaurants.forEach((restaurant) => {
            const key = normalizeRestaurantPoolKey(restaurant);
            restaurantPool.set(key, restaurant);
        });
    }
    if (restaurantPool.size === 0) {
        if (quotaErrorSeen) {
            throw new Error('AMAP_DAILY_QUOTA_EXHAUSTED');
        }
        return [];
    }
    const result = recommendRestaurants({
        restaurants: [...restaurantPool.values()],
        context: recommendationContext,
        limit,
        source: 'amap'
    });
    const poiMeta = mergePoiFetchMeta(metaList);
    return result.candidates.map((candidate) => ({
        ...candidate,
        ...poiMeta
    }));
}
function getAttemptAmapBudget(attempt, remainingAmapApiCalls) {
    if (attempt.cacheOnly) {
        return 0;
    }
    return Math.max(0, Math.min(MAX_AMAP_KEY_RETRY_CALLS_PER_POI_REQUEST, remainingAmapApiCalls));
}
function isAmapDailyQuotaError(error) {
    const payload = (error || {});
    const text = `${payload?.message ?? ''} ${payload?.code ?? ''} ${JSON.stringify(payload?.details ?? {})}`;
    return /USER_DAILY_QUERY_OVER_LIMIT|DAILY_QUERY_OVER_LIMIT|AMAP_KEYS_UNAVAILABLE|10003|quota|daily|额度|配额|上限|耗尽|超限/i.test(text);
}
function normalizeRestaurantShape(restaurant) {
    const location = (restaurant.location || {});
    return {
        ...restaurant,
        id: typeof restaurant.id === 'string' ? restaurant.id : '',
        name: typeof restaurant.name === 'string' ? restaurant.name : '',
        tags: Array.isArray(restaurant.tags) ? restaurant.tags.filter((tag) => typeof tag === 'string') : [],
        tagIds: Array.isArray(restaurant.tagIds) ? restaurant.tagIds.filter((tag) => typeof tag === 'string') : [],
        category: typeof restaurant.category === 'string' ? restaurant.category : '',
        location: {
            latitude: typeof location.latitude === 'number' ? location.latitude : 0,
            longitude: typeof location.longitude === 'number' ? location.longitude : 0
        },
        averageCostYuan: typeof restaurant.averageCostYuan === 'number' ? restaurant.averageCostYuan : 0,
        priceLevel: typeof restaurant.priceLevel === 'number' ? restaurant.priceLevel : 0,
        status: typeof restaurant.status === 'string' ? restaurant.status : 'active'
    };
}
function normalizePoiFetchMeta(meta, mode) {
    return {
        poiCacheHit: meta.poiCacheHit === true,
        poiCacheKey: typeof meta.poiCacheKey === 'string' ? meta.poiCacheKey : '',
        poiCacheAgeMs: typeof meta.poiCacheAgeMs === 'number' ? meta.poiCacheAgeMs : 0,
        poiFetchReason: typeof meta.poiFetchReason === 'string' ? meta.poiFetchReason : '',
        amapApiCallCount: typeof meta.amapApiCallCount === 'number' ? meta.amapApiCallCount : 0,
        poiFetchMode: typeof meta.poiFetchMode === 'string' ? meta.poiFetchMode : mode,
        aroundCallCount: typeof meta.aroundCallCount === 'number' ? meta.aroundCallCount : 0,
        polygonCallCount: typeof meta.polygonCallCount === 'number' ? meta.polygonCallCount : 0,
        keywordCallCount: typeof meta.keywordCallCount === 'number' ? meta.keywordCallCount : 0,
        idCallCount: typeof meta.idCallCount === 'number' ? meta.idCallCount : 0,
        cacheHitCount: typeof meta.cacheHitCount === 'number' ? meta.cacheHitCount : 0,
        totalAmapApiCallCount: typeof meta.totalAmapApiCallCount === 'number' ? meta.totalAmapApiCallCount : 0,
        quotaBucket: typeof meta.quotaBucket === 'string' ? meta.quotaBucket : ''
    };
}
function normalizeAmapQueryShape(query) {
    return {
        radiusMeters: typeof query.radiusMeters === 'number' ? query.radiusMeters : 1500,
        keywords: typeof query.keywords === 'string' ? query.keywords : '',
        types: typeof query.types === 'string' ? query.types : '050000'
    };
}
function normalizePreferenceProfileShape(profile) {
    return {
        ...profile,
        selectedOptionIds: Array.isArray(profile.selectedOptionIds)
            ? profile.selectedOptionIds.filter((value) => typeof value === 'string')
            : [],
        preferredTagIds: Array.isArray(profile.preferredTagIds)
            ? profile.preferredTagIds.filter((value) => typeof value === 'string')
            : [],
        avoidedTagIds: Array.isArray(profile.avoidedTagIds)
            ? profile.avoidedTagIds.filter((value) => typeof value === 'string')
            : [],
        budgetLevel: typeof profile.budgetLevel === 'number' ? profile.budgetLevel : 3,
        maxDistanceMeters: typeof profile.maxDistanceMeters === 'number' ? profile.maxDistanceMeters : 1500,
        constraints: isPlainRecord(profile.constraints) ? profile.constraints : {},
        softPreferences: isPlainRecord(profile.softPreferences) ? profile.softPreferences : {}
    };
}
function isPlainRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function buildAmapQueryAttempts(amapQuery, preferenceSnapshot) {
    const baseRadius = amapQuery.radiusMeters;
    const polygonRadius = Math.max(baseRadius, 3000);
    const baseKeyword = amapQuery.keywords ?? '';
    const relaxedKeyword = getStrictCategoryKeyword(baseKeyword) ?? '';
    const premiumKeywords = (preferenceSnapshot.budgetLevel ?? 3) >= 6 ? getPremiumKeywordAttempts(baseKeyword) : [];
    const midHighBudgetKeywords = getMidHighBudgetKeywordAttempts(preferenceSnapshot);
    const nonMealPremiumKeywords = getNonMealPremiumKeywordAttempts(preferenceSnapshot);
    const brandChainKeywords = getBrandChainKeywordAttempts(preferenceSnapshot);
    const mallKeywords = getMallKeywordAttempts(preferenceSnapshot);
    const luxuryFocusedKeywords = getLuxuryFocusedKeywordAttempts(preferenceSnapshot);
    const premiumSearch =
        premiumKeywords.length > 0 ||
        midHighBudgetKeywords.length > 0 ||
        nonMealPremiumKeywords.length > 0 ||
        brandChainKeywords.length > 0;
    const maxRadius = Math.max(baseRadius, premiumSearch ? 15000 : 10000);
    const scopedLocation = getScopedKeywordSearchLocation(preferenceSnapshot);
    const isLuxuryMealSearch = (preferenceSnapshot.budgetLevel ?? 3) >= 6 && luxuryFocusedKeywords.length > 0;
    const keywordAttempts = (isLuxuryMealSearch
        ? [
            ...luxuryFocusedKeywords,
            ...brandChainKeywords,
            ...premiumKeywords,
            ...mallKeywords,
            relaxedKeyword || baseKeyword
        ]
        : [
            ...luxuryFocusedKeywords,
            relaxedKeyword || baseKeyword,
            ...midHighBudgetKeywords,
            ...premiumKeywords,
            ...nonMealPremiumKeywords,
            ...brandChainKeywords,
            ...mallKeywords
        ]).filter(Boolean);
    const attempts = [];
    const primaryKeyword = keywordAttempts[0] ?? baseKeyword;
    const fallbackKeyword = keywordAttempts.find((keyword) => keyword !== primaryKeyword) ?? primaryKeyword;
    const primaryRadius = premiumSearch ? maxRadius : polygonRadius;
    const primaryPageCount = isLuxuryMealSearch ? 2 : 1;
    const secondaryPolygonKeyword =
        fallbackKeyword !== primaryKeyword
            ? fallbackKeyword
            : keywordAttempts.find((keyword) => keyword !== primaryKeyword && keyword !== fallbackKeyword) ?? fallbackKeyword;
    attempts.push({
        mode: 'polygon',
        radiusMeters: maxRadius,
        keyword: '',
        types: amapQuery.types,
        pageCount: 1,
        city: '',
        adcode: '',
        reason: 'recommendation-broad-cache-first',
        cacheOnly: true
    });
    attempts.push({
        mode: 'polygon',
        radiusMeters: primaryRadius,
        keyword: primaryKeyword || '',
        types: amapQuery.types,
        pageCount: primaryPageCount,
        city: '',
        adcode: '',
        reason: primaryKeyword ? 'recommendation-polygon-keyword-primary' : 'recommendation-polygon-broad-primary'
    });
    if (secondaryPolygonKeyword && secondaryPolygonKeyword !== primaryKeyword) {
        attempts.push({
            mode: 'polygon',
            radiusMeters: maxRadius,
            keyword: secondaryPolygonKeyword,
            types: amapQuery.types,
            pageCount: 1,
            city: '',
            adcode: '',
            reason: 'recommendation-polygon-keyword-secondary'
        });
    }
    attempts.push({
        mode: 'polygon',
        radiusMeters: maxRadius,
        keyword: '',
        types: amapQuery.types,
        pageCount: 1,
        city: '',
        adcode: '',
        reason: 'recommendation-polygon-broad-fallback'
    });
    if (fallbackKeyword && (scopedLocation.city || scopedLocation.adcode)) {
        attempts.push({
            mode: 'keyword',
            radiusMeters: maxRadius,
            keyword: fallbackKeyword,
            city: scopedLocation.city,
            adcode: scopedLocation.adcode,
            types: amapQuery.types,
            pageCount: 1,
            reason: 'recommendation-keyword-fallback'
        });
    }
    else {
        attempts.push({
            mode: 'around',
            radiusMeters: maxRadius,
            keyword: fallbackKeyword || primaryKeyword || '',
            types: amapQuery.types,
            pageCount: 1,
            city: '',
            adcode: '',
            reason: 'recommendation-around-fallback'
        });
    }
    return attempts.filter((attempt, index, allAttempts) => {
        return allAttempts.findIndex((item) => {
            return (item.mode === attempt.mode &&
                item.radiusMeters === attempt.radiusMeters &&
                item.keyword === attempt.keyword &&
                item.types === attempt.types &&
                (item.city ?? '') === (attempt.city ?? '') &&
                (item.adcode ?? '') === (attempt.adcode ?? '') &&
                Boolean(item.cacheOnly) === Boolean(attempt.cacheOnly));
        }) === index;
    });
}
function shouldSkipFallbackAttempt(restaurantPool, preferenceSnapshot) {
    const restaurants = [...restaurantPool.values()];
    if ((preferenceSnapshot.budgetLevel ?? 3) >= 6) {
        return countEffectivePremiumCandidates(restaurants) >= MIN_PREMIUM_POOL_BEFORE_FALLBACK;
    }
    return restaurants.length >= MIN_POOL_BEFORE_FALLBACK;
}
function countEffectivePremiumCandidates(restaurants) {
    return restaurants.filter((restaurant) => {
        const cost = restaurant.averageCostYuan ?? estimateCostFromPriceLevel(restaurant.priceLevel);
        const tagIds = new Set(restaurant.tagIds ?? []);
        const text = `${restaurant.name ?? ''} ${restaurant.category ?? ''} ${(restaurant.tags ?? []).join(' ')}`;
        const hasPremiumSignal = tagIds.has('premium_brand') ||
            /高端|黑珍珠|米其林|omakase|fine dining|chef|主厨|私厨|私房|牛排馆|海鲜放题|法餐|高端日料|酒店餐厅|星级酒店|GRILL|grill|烧肉|融合料理|创意菜/.test(text);
        return (cost !== undefined && cost >= 180) || (cost === undefined && hasPremiumSignal) || tagIds.has('premium_brand');
    }).length;
}
function getLuxuryFocusedKeywordAttempts(preferenceSnapshot) {
    if ((preferenceSnapshot.budgetLevel ?? 3) < 6) {
        return [];
    }
    const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);
    const preferred = new Set(preferenceSnapshot.preferredTagIds ?? []);
    const isExplicitNonMeal = selected.has('prefer_milk_tea') ||
        selected.has('prefer_coffee') ||
        selected.has('prefer_bakery_dessert') ||
        selected.has('intent_drink') ||
        selected.has('intent_dessert') ||
        preferred.has('non_meal') ||
        preferred.has('drink') ||
        preferred.has('coffee') ||
        preferred.has('milk_tea') ||
        preferred.has('dessert');
    if (isExplicitNonMeal) {
        return [];
    }
    return [
        '黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining',
        '酒店餐厅|私房菜|主厨餐厅|牛排馆|融合料理|海鲜放题'
    ];
}
function estimateCostFromPriceLevel(priceLevel) {
    if (!Number.isFinite(priceLevel)) {
        return 0;
    }
    if (priceLevel >= 5) {
        return 260;
    }
    if (priceLevel >= 4) {
        return 160;
    }
    if (priceLevel >= 3) {
        return 90;
    }
    if (priceLevel >= 2) {
        return 50;
    }
    return 25;
}
function getScopedKeywordSearchLocation(preferenceSnapshot) {
    const city = getStringPreferenceValue(preferenceSnapshot.softPreferences?.amapCity ?? preferenceSnapshot.constraints?.city);
    const adcode = getStringPreferenceValue(preferenceSnapshot.softPreferences?.amapAdcode ?? preferenceSnapshot.constraints?.adcode);
    return {
        city,
        adcode
    };
}
function getStringPreferenceValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}
function getMidHighBudgetKeywordAttempts(preferenceSnapshot) {
    const budgetLevel = preferenceSnapshot.budgetLevel ?? 3;
    const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);
    const preferred = new Set(preferenceSnapshot.preferredTagIds ?? []);
    const isExplicitNonMeal =
        selected.has('prefer_milk_tea') ||
        selected.has('prefer_coffee') ||
        selected.has('prefer_bakery_dessert') ||
        selected.has('intent_drink') ||
        selected.has('intent_dessert') ||
        preferred.has('non_meal') ||
        preferred.has('drink') ||
        preferred.has('coffee') ||
        preferred.has('milk_tea') ||
        preferred.has('dessert');

    if (budgetLevel < 5 || budgetLevel >= 6 || isExplicitNonMeal) {
        return [];
    }

    if (selected.has('brand_chain')) {
        return [
            '粤菜|江浙菜|日料|西餐|烤肉|火锅|融合料理',
            '费大厨|小菜园|西贝|海底捞|太二|探鱼|点都德|陶陶居|广州酒家|绿茶餐厅|外婆家|九毛九',
            '商场餐厅|购物中心餐厅|品牌餐厅|连锁餐厅'
        ];
    }

    return [
        '粤菜|江浙菜|日料|西餐|烤肉|火锅|融合料理',
        '本帮菜|湘菜|川菜|东南亚菜|韩餐|牛排|烧肉',
        '品牌餐厅|商场餐厅|购物中心餐厅'
    ];
}
function getNonMealPremiumKeywordAttempts(preferenceSnapshot) {
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
function getBrandChainKeywordAttempts(preferenceSnapshot) {
    const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);
    if (!selected.has('brand_chain')) {
        return [];
    }
    if ((preferenceSnapshot.budgetLevel ?? 3) >= 6) {
        return [
            '黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining',
            '酒店餐厅|私房菜|主厨餐厅|牛排馆|融合料理|海鲜放题',
            '炳胜|利苑|大董|新荣记|甬府|莆田|松鹤楼|广州酒家|白天鹅',
            '铁板烧|GRILL|grill|烧肉|创意菜'
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
function getMallKeywordAttempts(preferenceSnapshot) {
    const selected = new Set(preferenceSnapshot.selectedOptionIds ?? []);
    const preferred = new Set(preferenceSnapshot.preferredTagIds ?? []);
    const shouldSearchMall = selected.has('brand_chain') ||
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
        return [
            '商场|购物中心|黑珍珠|米其林|高端日料|法餐',
            '购物中心|商场|酒店餐厅|私房菜|主厨餐厅|融合料理',
            '购物中心|商场|炳胜|利苑|广州酒家|白天鹅'
        ];
    }
    return ['商场|购物中心|广场|mall|餐厅', '购物中心|商场|连锁餐厅|品牌餐厅'];
}
function mergePoiFetchMeta(metaList) {
    const apiCallCount = metaList.reduce((sum, meta) => sum + meta.amapApiCallCount, 0);
    const firstKey = metaList.find((meta) => meta.poiCacheKey)?.poiCacheKey ?? '';
    const cacheAges = metaList
        .map((meta) => meta.poiCacheAgeMs)
        .filter((age) => typeof age === 'number');
    const modes = uniqueText(metaList.map((meta) => meta.poiFetchMode).filter(Boolean));
    const quotaBuckets = uniqueText(metaList.map((meta) => meta.quotaBucket).filter(Boolean));
    const aroundCallCount = metaList.reduce((sum, meta) => sum + (meta.aroundCallCount ?? 0), 0);
    const polygonCallCount = metaList.reduce((sum, meta) => sum + (meta.polygonCallCount ?? 0), 0);
    const keywordCallCount = metaList.reduce((sum, meta) => sum + (meta.keywordCallCount ?? 0), 0);
    const idCallCount = metaList.reduce((sum, meta) => sum + (meta.idCallCount ?? 0), 0);
    const cacheHitCount = metaList.reduce((sum, meta) => sum + (meta.cacheHitCount ?? (meta.poiCacheHit ? 1 : 0)), 0);
    return {
        poiCacheHit: apiCallCount === 0 && metaList.some((meta) => meta.poiCacheHit),
        poiCacheKey: firstKey,
        poiCacheAgeMs: cacheAges.length > 0 ? Math.min(...cacheAges) : 0,
        poiFetchReason: metaList.map((meta) => meta.poiFetchReason).join(',') || 'no-poi-fetch',
        amapApiCallCount: apiCallCount,
        poiFetchMode: getFirstPoiFetchMode(modes),
        aroundCallCount,
        polygonCallCount,
        keywordCallCount,
        idCallCount,
        cacheHitCount,
        totalAmapApiCallCount: apiCallCount,
        quotaBucket: quotaBuckets.join(',')
    };
}
function uniqueText(values) {
    return [...new Set(values.filter((value) => typeof value === 'string' && Boolean(value)))];
}
function getFirstPoiFetchMode(modes) {
    const mode = modes[0];
    if (mode === 'around' || mode === 'polygon' || mode === 'keyword' || mode === 'id') {
        return mode;
    }
    return 'polygon';
}
function normalizeRestaurantPoolKey(restaurant) {
    const name = (restaurant.name ?? '').toLowerCase().replace(/\s+/g, '');
    const location = restaurant.location;
    const locationKey = location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
        ? `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`
        : '';
    return restaurant.id || `${name}|${locationKey}`;
}
function getPremiumKeywordAttempts(keyword) {
    if (!/高端餐厅|私房菜|私厨|主厨|Chef|铁板烧|牛排|西餐|融合料理|创意菜|酒店餐厅|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|GRILL|炳胜|利苑/.test(keyword)) {
        return [];
    }
    return [
        '黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining',
        '酒店餐厅|私房菜|主厨餐厅|牛排馆|融合料理|海鲜放题',
        '炳胜|利苑|大董|新荣记|甬府|莆田|松鹤楼|广州酒家|白天鹅',
        '铁板烧|GRILL|grill|烧肉|创意菜'
    ];
}
function getStrictCategoryKeyword(keyword) {
    if (/奶茶|茶饮|饮品|霸王茶姬|喜茶|奈雪|一点点|1点点|阿嬷手作|去茶山|KOI|古茗|茉莉奶白|爷爷不泡茶|茶理宜世/.test(keyword)) {
        return '奶茶|茶饮|霸王茶姬|喜茶|奈雪|一点点|1点点|阿嬷手作|去茶山|KOI|古茗|茉莉奶白|爷爷不泡茶|茶理宜世';
    }
    if (/咖啡|cafe|coffee|下午茶|星巴克|瑞幸|Manner/.test(keyword)) {
        return '咖啡|cafe|coffee|下午茶|星巴克|瑞幸|Manner';
    }
    if (/甜品|蛋糕|面包|烘焙|西点|Gelato|冰淇淋|Bakery|哈根达斯|贝果|双皮奶/.test(keyword)) {
        return '甜品|蛋糕|面包|烘焙|西点|Gelato|冰淇淋|Bakery|哈根达斯|贝果|双皮奶';
    }
    if (/高端餐厅|私房菜|私厨|主厨|Chef|铁板烧|牛排|西餐|融合料理|创意菜|酒店餐厅|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining|GRILL|炳胜|利苑/.test(keyword)) {
        return '黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining';
    }
    return '';
}
function buildRecommendationContext(preferenceSnapshot, historyFilterContext = EMPTY_HISTORY_FILTER_CONTEXT) {
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
