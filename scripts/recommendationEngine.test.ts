import { mockRestaurants } from '../miniprogram/data/mockRestaurants';
import { questionBank } from '../miniprogram/data/questionBank';
import { buildAmapRestaurantQuery } from '../miniprogram/services/amapQueryBuilder';
import {
  __resetNearbyRestaurantCacheForTest,
  __setAmapPoiCloudFetcherForTest,
  __setAmapPoiLocationProviderForTest,
  __setAmapPoiStorageAdapterForTest,
  getNearbyRestaurantsWithMeta,
  POI_CACHE_TTL_MS
} from '../miniprogram/services/amapPoiService';
import { mapAnswersToPreferenceProfile } from '../miniprogram/services/preferenceMapper';
import { getLocalRecommendations } from '../miniprogram/services/mealService';
import { recommendRestaurants, scoreRestaurant } from '../miniprogram/services/recommendationEngine';
import { selectQuestionSet } from '../miniprogram/services/questionSelector';
import type { Restaurant } from '../miniprogram/types/restaurant';
import type { UserPreferenceAnswer, UserPreferenceProfile } from '../miniprogram/types/userPreference';

declare const require: (path: string) => {
  validateStressCachePolicy: (input: {
    cacheFileExists: boolean;
    allowLive: boolean;
    liveRequested: boolean;
  }) => { ok: boolean; mayCallAmap: boolean; reason: string };
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function recommend(preferenceSnapshot: UserPreferenceProfile, restaurants: Restaurant[] = mockRestaurants) {
  return recommendRestaurants({
    restaurants,
    context: { preferenceSnapshot },
    limit: 3,
    now: new Date('2026-06-02T04:00:00.000Z'),
    random: () => 0
  });
}

function profile(partial: Partial<UserPreferenceProfile>): UserPreferenceProfile {
  return {
    selectedOptionIds: [],
    preferredTagIds: ['quick', 'staple'],
    avoidedTagIds: [],
    budgetLevel: 3,
    maxDistanceMeters: 1500,
    maxEstimatedMinutes: 45,
    ...partial
  };
}

const noSpicy = profile({
  preferredTagIds: ['not_spicy', 'light', 'congee'],
  avoidedTagIds: [
    'spicy',
    'strong_flavor',
    'hotpot',
    'malatang',
    'sichuan',
    'hunan',
    'chongqing_noodle',
    'maocai',
    'dry_pot'
  ]
});
const noSpicyResult = recommend(noSpicy);
const noSpicyTopIds = noSpicyResult.candidates.map((candidate) => candidate.restaurantId);

assert(!noSpicyTopIds.includes('r-chongqing-noodle'), '不吃辣时不能推荐重庆小面');
assert(!noSpicyTopIds.includes('r-malatang'), '不吃辣时不能推荐麻辣烫');
assert(!noSpicyTopIds.includes('r-hunan-rice'), '不吃辣时不能推荐川湘重口');
assert(!noSpicyTopIds.includes('r-maocai'), '不吃辣时不能推荐冒菜/香锅');
assert(noSpicyResult.candidates[0]?.matchedAvoidedTagIds?.length === 0, 'Top1 不能命中负向偏好');

const distance500 = profile({
  preferredTagIds: ['quick', 'staple'],
  maxDistanceMeters: 500
});
const distanceResult = recommend(distance500);
assert(
  distanceResult.candidates.every((candidate) => {
    return (candidate.restaurant?.distanceMeters ?? 0) <= 500 || candidate.fallbackReason;
  }),
  '500 米偏好应过滤超距离候选，除非 fallback'
);

const slowButMatchingScore = scoreRestaurant(
  {
    id: 'slow-matching',
    name: '慢但匹配的盖饭',
    tags: ['盖饭'],
    tagIds: ['quick', 'rice', 'meal', 'set_meal', 'not_spicy'],
    category: '简餐',
    distanceMeters: 1800,
    averageCostYuan: 32,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  profile({
    preferredTagIds: ['quick', 'rice', 'meal'],
    budgetLevel: 3,
    maxDistanceMeters: 3000,
    maxEstimatedMinutes: 25
  })
);
assert((slowButMatchingScore.confidenceScore ?? 100) <= 70, '超过耗时偏好的候选不能拿到高匹配度');

const cheap = profile({
  preferredTagIds: ['rice', 'staple', 'quick'],
  budgetLevel: 2,
  maxDistanceMeters: 3000
});
const cheapResult = recommend(cheap);
assert(
  (cheapResult.candidates[0]?.restaurant?.averageCostYuan ?? 999) <= 30,
  '30 元以下预算时高价餐厅不能排第一'
);

const budgetRangePreference = profile({
  preferredTagIds: ['rice', 'meal', 'quick'],
  budgetLevel: 3,
  maxDistanceMeters: 1000
});
const budgetRangeResult = recommend(budgetRangePreference, [
  {
    id: 'budget-too-low',
    name: '便宜小吃',
    tags: ['小吃'],
    tagIds: ['quick', 'snack', 'solo'],
    category: '小吃',
    distanceMeters: 220,
    averageCostYuan: 16,
    openStatus: 'open',
    rating: 4.5,
    status: 'active'
  },
  {
    id: 'budget-in-range',
    name: '范围内盖饭',
    tags: ['盖饭'],
    tagIds: ['quick', 'rice', 'meal', 'set_meal'],
    category: '简餐',
    distanceMeters: 240,
    averageCostYuan: 45,
    openStatus: 'open',
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'budget-slightly-over',
    name: '略超预算套餐',
    tags: ['套餐'],
    tagIds: ['quick', 'rice', 'meal', 'set_meal'],
    category: '简餐',
    distanceMeters: 230,
    averageCostYuan: 66,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  }
]);
assert(budgetRangeResult.candidates[0]?.restaurantId === 'budget-in-range', '30~60 预算应优先范围内候选');
const slightlyOverBudgetScore = scoreRestaurant(
  {
    id: 'score-over-budget',
    name: '略超预算好店',
    tags: ['套餐'],
    tagIds: ['quick', 'rice', 'meal', 'set_meal'],
    category: '简餐',
    distanceMeters: 200,
    averageCostYuan: 66,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  },
  budgetRangePreference
);
assert((slightlyOverBudgetScore.confidenceScore ?? 100) <= 70, '略超预算候选不能拿到高匹配度');

const premiumBudgetPreference = profile({
  preferredTagIds: ['relaxed', 'slow', 'group'],
  budgetLevel: 5,
  maxDistanceMeters: 1000
});
const premiumBudgetResult = recommend(premiumBudgetPreference, [
  {
    id: 'premium-too-cheap',
    name: '??????',
    tags: ['??'],
    tagIds: ['quick', 'meal', 'set_meal'],
    category: '??',
    distanceMeters: 150,
    averageCostYuan: 28,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  },
  {
    id: 'premium-in-range',
    name: '?????',
    tags: ['??', '??'],
    tagIds: ['relaxed', 'slow', 'group', 'meal'],
    category: '??',
    distanceMeters: 260,
    averageCostYuan: 138,
    openStatus: 'open',
    rating: 4.3,
    status: 'active'
  },
  {
    id: 'premium-over',
    name: '????',
    tags: ['??'],
    tagIds: ['relaxed', 'slow', 'group', 'meal'],
    category: '??',
    distanceMeters: 260,
    averageCostYuan: 260,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  }
]);
assert(premiumBudgetResult.candidates[0]?.restaurantId === 'premium-in-range', '100-200 budget should prefer candidates inside the requested price range');

const cheapForPremiumScore = scoreRestaurant(
  {
    id: 'cheap-for-premium',
    name: '????',
    tags: ['??'],
    tagIds: ['quick', 'meal', 'set_meal'],
    category: '??',
    distanceMeters: 100,
    averageCostYuan: 25,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  },
  premiumBudgetPreference
);
assert(cheapForPremiumScore.breakdown.priceScore < 0, 'high budget preference should penalize candidates far below the requested range');

const luxuryBudgetResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'slow', 'group'],
    budgetLevel: 6,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'luxury-too-cheap',
      name: '?????',
      tags: ['??'],
      tagIds: ['quick', 'meal', 'set_meal'],
      category: '??',
      distanceMeters: 120,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    },
    {
      id: 'luxury-in-range',
      name: '??????',
      tags: ['??', '??'],
      tagIds: ['relaxed', 'slow', 'group', 'meal'],
      category: '??',
      distanceMeters: 300,
      averageCostYuan: 240,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    }
  ]
);
assert(luxuryBudgetResult.candidates[0]?.restaurantId === 'luxury-in-range', '200+ budget should not recommend a dozens-yuan restaurant when in-range candidates exist');

const luxuryLowOnlyResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'slow', 'group'],
    budgetLevel: 6,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'luxury-low-only',
      name: 'low price fast food',
      tags: ['fast food'],
      tagIds: ['quick', 'meal', 'set_meal'],
      category: 'fast food',
      distanceMeters: 120,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(luxuryLowOnlyResult.candidates.length === 0, '200+ budget should not fallback to clearly low-price candidates');

const luxuryUnknownOnlyResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'slow', 'group'],
    budgetLevel: 6,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'luxury-unknown-price',
      name: 'unknown price restaurant',
      tags: ['restaurant'],
      tagIds: ['meal', 'relaxed', 'slow'],
      category: 'restaurant',
      distanceMeters: 120,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(
  luxuryUnknownOnlyResult.candidates[0]?.restaurantId === 'luxury-unknown-price',
  '200+ budget fallback may include price-unknown candidates'
);
assert(
  luxuryUnknownOnlyResult.candidatePoolStats?.fallbackUsed === true,
  '200+ budget price-unknown fallback should be marked as fallback'
);
assert(
  (luxuryUnknownOnlyResult.candidates[0]?.confidenceScore ?? 100) <= 64,
  '200+ budget price-unknown fallback should keep confidence capped'
);

const luxuryWeakUnknownOnlyResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'slow', 'group'],
    budgetLevel: 6,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'luxury-weak-unknown-price',
      name: 'ordinary restaurant without price',
      tags: ['restaurant'],
      tagIds: ['meal'],
      category: 'restaurant',
      distanceMeters: 120,
      openStatus: 'open',
      rating: 4.1,
      status: 'active'
    }
  ]
);
assert(luxuryWeakUnknownOnlyResult.candidates.length === 0, '200+ fallback should not use weak unknown-price ordinary restaurants');

const premiumLowOnlyResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'group'],
    budgetLevel: 5,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'premium-low-only',
      name: 'cheap set meal',
      tags: ['set meal'],
      tagIds: ['meal', 'set_meal', 'quick'],
      category: 'set meal',
      distanceMeters: 120,
      averageCostYuan: 55,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(premiumLowOnlyResult.candidates.length === 0, '100-200 budget should not recommend dozens-yuan restaurants');

const premiumNearBudgetFallbackResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'group', 'meal'],
    budgetLevel: 5,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'premium-near-budget',
      name: 'near budget bistro',
      tags: ['bistro'],
      tagIds: ['meal', 'relaxed'],
      category: 'restaurant',
      distanceMeters: 120,
      averageCostYuan: 88,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    }
  ]
);
assert(premiumNearBudgetFallbackResult.candidates[0]?.restaurantId === 'premium-near-budget', '100-200 budget may use 80-99 yuan restaurants only as fallback');
assert(premiumNearBudgetFallbackResult.candidatePoolStats?.fallbackUsed === true, '100-200 near-budget supplement should be marked as fallback');
assert(
  (premiumNearBudgetFallbackResult.candidates[0]?.confidenceScore ?? 100) <= 64,
  '100-200 near-budget fallback should not show high confidence'
);
assert(
  Boolean(premiumNearBudgetFallbackResult.candidates[0]?.reason.includes('近预算补位')),
  '100-200 near-budget fallback should explain the price mismatch'
);

const premiumInRangeBeatsNearBudgetResult = recommend(
  profile({
    preferredTagIds: ['relaxed', 'group', 'meal'],
    budgetLevel: 5,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'premium-near-budget-with-real',
      name: 'near budget bistro again',
      tags: ['bistro'],
      tagIds: ['meal', 'relaxed'],
      category: 'restaurant',
      distanceMeters: 120,
      averageCostYuan: 92,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    },
    {
      id: 'premium-real-range',
      name: 'real 100-200 restaurant',
      tags: ['restaurant'],
      tagIds: ['meal', 'relaxed'],
      category: 'restaurant',
      distanceMeters: 500,
      averageCostYuan: 128,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    }
  ]
);
assert(premiumInRangeBeatsNearBudgetResult.candidates[0]?.restaurantId === 'premium-real-range', '100-200 true in-range candidates should outrank 80-99 yuan supplements');

const premiumDrinkLowOnlyResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink'],
    preferredTagIds: ['drink', 'milk_tea', 'coffee', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
    budgetLevel: 5,
    maxDistanceMeters: 10000
  }),
  [
    {
      id: 'premium-drink-low-price',
      name: 'Naixue Tea',
      tags: ['milk tea'],
      tagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'chain_brand'],
      category: 'tea drink',
      distanceMeters: 120,
      averageCostYuan: 28,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    }
  ]
);
assert(premiumDrinkLowOnlyResult.candidates.length === 1, '100-200 non-meal budget should not filter out real drink candidates solely for being low price');

const luxuryDrinkVsMealResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'budget_over_200'],
    preferredTagIds: ['drink', 'milk_tea', 'coffee', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
    budgetLevel: 6,
    maxDistanceMeters: 10000
  }),
  [
    {
      id: 'luxury-drink-real',
      name: 'Premium Tea Lounge',
      tags: ['tea drink'],
      tagIds: ['drink', 'milk_tea', 'non_meal', 'afternoon_tea', 'chain_brand'],
      category: 'tea drink',
      distanceMeters: 200,
      averageCostYuan: 48,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    },
    {
      id: 'luxury-meal-restaurant',
      name: 'Jiang by Chef Fei',
      tags: [],
      tagIds: [],
      category: 'Fine Dining Restaurant',
      distanceMeters: 260,
      averageCostYuan: 664,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(luxuryDrinkVsMealResult.candidates[0]?.restaurantId === 'luxury-drink-real', 'drink intent should outrank high-budget fine dining restaurants');
assert(!luxuryDrinkVsMealResult.candidates.some((candidate) => candidate.restaurantId === 'luxury-meal-restaurant'), 'drink intent should hard-filter likely meal restaurants even when they match high budget');

const luxuryDessertVsMealResult = recommend(
  profile({
    selectedOptionIds: ['intent_dessert', 'budget_over_200'],
    preferredTagIds: ['dessert', 'afternoon_tea', 'non_meal', 'drink'],
    avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
    budgetLevel: 6,
    maxDistanceMeters: 10000
  }),
  [
    {
      id: 'luxury-dessert-real',
      name: 'Hotel Afternoon Tea',
      tags: ['dessert'],
      tagIds: ['dessert', 'afternoon_tea', 'non_meal'],
      category: 'dessert',
      distanceMeters: 240,
      averageCostYuan: 88,
      openStatus: 'open',
      rating: 4.3,
      status: 'active'
    },
    {
      id: 'luxury-dessert-meal',
      name: 'Li Chateau',
      tags: [],
      tagIds: [],
      category: 'Fine Dining Restaurant',
      distanceMeters: 80,
      averageCostYuan: 347,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(luxuryDessertVsMealResult.candidates[0]?.restaurantId === 'luxury-dessert-real', 'dessert intent should not drift into fine dining just because budget is high');

const realWorldDrinkKeywordResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea'],
    preferredTagIds: ['drink', 'milk_tea', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
    budgetLevel: 4,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'real-mixue',
      name: '蜜雪冰城(正佳广场店)',
      tags: [],
      tagIds: [],
      category: '餐饮服务;冷饮店;冷饮店',
      distanceMeters: 75,
      averageCostYuan: 8,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    },
    {
      id: 'real-linlee',
      name: 'LINLEE·手打柠檬茶(天河正佳广场店)',
      tags: [],
      tagIds: [],
      category: '餐饮服务;冷饮店;冷饮店',
      distanceMeters: 7,
      averageCostYuan: 18,
      openStatus: 'open',
      rating: 4.3,
      status: 'active'
    },
    {
      id: 'real-xiaocaiyuan',
      name: '小菜园新徽菜(天河正佳广场店)',
      tags: [],
      tagIds: [],
      category: '餐饮服务;中餐厅;中餐厅',
      distanceMeters: 10,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.7,
      status: 'active'
    }
  ]
);
assert(['real-mixue', 'real-linlee'].includes(realWorldDrinkKeywordResult.candidates[0]?.restaurantId ?? ''), 'real drink brands such as Mixue and LINLEE should be inferred as drink candidates');
assert(!realWorldDrinkKeywordResult.candidates.some((candidate) => candidate.restaurantId === 'real-xiaocaiyuan'), 'drink intent should filter Chinese meal restaurants such as Xiaocaiyuan');

const realWorldDessertKeywordResult = recommend(
  profile({
    selectedOptionIds: ['intent_dessert'],
    preferredTagIds: ['dessert', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
    budgetLevel: 4,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'real-sugar-water',
      name: '庆虹糖水',
      tags: [],
      tagIds: [],
      category: '餐饮服务;甜品店;甜品店',
      distanceMeters: 6,
      averageCostYuan: 16,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    },
    {
      id: 'real-meal-nearby',
      name: '小菜园新徽菜(天河正佳广场店)',
      tags: [],
      tagIds: [],
      category: '餐饮服务;中餐厅;中餐厅',
      distanceMeters: 8,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert(realWorldDessertKeywordResult.candidates[0]?.restaurantId === 'real-sugar-water', 'dessert intent should recognize sugar-water dessert shops and avoid nearby meal restaurants');

const dedupeResult = recommend(
  profile({
    preferredTagIds: ['meal', 'rice'],
    budgetLevel: 3,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'same-store-1',
      name: 'same rice shop',
      tags: ['rice'],
      tagIds: ['meal', 'rice'],
      category: 'rice',
      distanceMeters: 100,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    },
    {
      id: 'same-store-2',
      name: 'same rice shop',
      tags: ['rice'],
      tagIds: ['meal', 'rice'],
      category: 'rice',
      distanceMeters: 120,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.7,
      status: 'active'
    },
    {
      id: 'other-store',
      name: 'other rice shop',
      tags: ['rice'],
      tagIds: ['meal', 'rice'],
      category: 'rice',
      distanceMeters: 200,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    }
  ]
);
assert(new Set(dedupeResult.candidates.map((candidate) => candidate.restaurant?.name)).size === dedupeResult.candidates.length, 'Top recommendations should not contain duplicate restaurant names');

const historyNoRepeatResult = recommendRestaurants({
  restaurants: [
    {
      id: 'history-old',
      name: 'shown before premium',
      tags: ['omakase'],
      tagIds: ['meal', 'premium_brand', 'chain_brand'],
      category: 'high end',
      distanceMeters: 500,
      averageCostYuan: 380,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    },
    {
      id: 'history-new-a',
      name: 'new premium a',
      tags: ['omakase'],
      tagIds: ['meal', 'premium_brand', 'chain_brand'],
      category: 'high end',
      distanceMeters: 900,
      averageCostYuan: 320,
      openStatus: 'open',
      rating: 4.7,
      status: 'active'
    },
    {
      id: 'history-new-b',
      name: 'new premium b',
      tags: ['fine dining'],
      tagIds: ['meal', 'premium_brand', 'chain_brand'],
      category: 'high end',
      distanceMeters: 1200,
      averageCostYuan: 260,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    }
  ],
  context: {
    preferenceSnapshot: profile({
      selectedOptionIds: ['budget_over_200', 'brand_chain'],
      preferredTagIds: ['meal', 'chain_brand', 'premium_brand'],
      avoidedTagIds: ['low_chain', 'mid_chain'],
      budgetLevel: 6,
      maxDistanceMeters: 10000
    }),
    historyFilterEnabled: true,
    excludedHistoryRestaurantIds: ['history-old']
  },
  limit: 3,
  now: new Date('2026-06-02T04:00:00.000Z'),
  random: () => 0
});
assert(historyNoRepeatResult.candidates.length === 2, 'history filter should return fewer fresh candidates instead of repeating shown restaurants');
assert(!historyNoRepeatResult.candidates.some((candidate) => candidate.restaurantId === 'history-old'), 'shown restaurants should not be repeated when fresh candidates exist');

const luxuryPriceOnlyResult = recommend(
  profile({
    selectedOptionIds: ['budget_over_200', 'brand_chain'],
    preferredTagIds: ['meal', 'chain_brand', 'premium_brand'],
    avoidedTagIds: ['low_chain', 'mid_chain'],
    budgetLevel: 6,
    maxDistanceMeters: 10000
  }),
  [
    {
      id: 'premium-by-price',
      name: '人均两百以上餐厅',
      tags: ['fine dining'],
      tagIds: ['meal'],
      category: '餐厅',
      distanceMeters: 1500,
      averageCostYuan: 260,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    },
    {
      id: 'cheap-brand',
      name: '低价连锁',
      tags: ['fast food'],
      tagIds: ['meal', 'chain_brand', 'low_chain'],
      category: '快餐',
      distanceMeters: 300,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(luxuryPriceOnlyResult.candidates[0]?.restaurantId === 'premium-by-price', '200+ budget should accept restaurants by averageCostYuan >= 200 even without a known brand keyword');

const chainPreferenceNoIndependentResult = recommend(
  profile({
    selectedOptionIds: ['brand_chain', 'budget_100_200'],
    preferredTagIds: ['meal', 'chain_brand', 'mid_chain'],
    avoidedTagIds: ['independent_store', 'street_shop', 'low_chain'],
    budgetLevel: 5,
    maxDistanceMeters: 5000,
    maxEstimatedMinutes: 120
  }),
  [
    {
      id: 'rough-independent',
      name: '破旧家常小馆',
      tags: ['家常菜'],
      category: '中餐厅',
      distanceMeters: 300,
      averageCostYuan: 150,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    },
    {
      id: 'mid-brand-restaurant',
      name: '费大厨辣椒炒肉',
      tags: ['湘菜'],
      tagIds: ['meal', 'chain_brand', 'mid_chain'],
      category: '中餐厅',
      distanceMeters: 1200,
      averageCostYuan: 138,
      openStatus: 'open',
      rating: 4.4,
      status: 'active'
    }
  ]
);
assert(!chainPreferenceNoIndependentResult.candidates.some((candidate) => candidate.restaurantId === 'rough-independent'), 'chain preference should hard-filter rough independent storefronts');
assert(chainPreferenceNoIndependentResult.candidates[0]?.restaurantId === 'mid-brand-restaurant', 'chain preference should keep actual chain or brand restaurants');

const mallPremiumResult = recommend(
  profile({
    selectedOptionIds: ['budget_over_200', 'brand_chain'],
    preferredTagIds: ['meal', 'chain_brand', 'premium_brand', 'mall_store'],
    avoidedTagIds: ['low_chain', 'mid_chain'],
    budgetLevel: 6,
    maxDistanceMeters: 15000,
    maxEstimatedMinutes: 140
  }),
  [
    {
      id: 'mall-premium',
      name: '商场高端日料',
      tags: ['日料'],
      category: '日本料理',
      address: '天河城购物中心 6 层',
      distanceMeters: 6800,
      averageCostYuan: 260,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    }
  ]
);
assert(Boolean(mallPremiumResult.candidates[0]?.matchedPreferredTagIds?.includes('mall_store')), 'mall restaurant address should infer mall_store and remain recommendable');

const salesCenterResult = recommend(
  profile({
    selectedOptionIds: ['budget_over_200', 'brand_chain'],
    preferredTagIds: ['meal', 'chain_brand', 'premium_brand'],
    avoidedTagIds: ['low_chain', 'mid_chain'],
    budgetLevel: 6,
    maxDistanceMeters: 15000,
    maxEstimatedMinutes: 140
  }),
  [
    {
      id: 'sales-center',
      name: '广州酒家月饼批发团购销售中心',
      tags: ['酒家'],
      category: '餐饮相关场所',
      address: '广州酒家旁',
      distanceMeters: 1521,
      averageCostYuan: 260,
      openStatus: 'open',
      rating: 4.1,
      status: 'active'
    },
    {
      id: 'real-premium',
      name: '真实高端餐厅',
      tags: ['fine dining'],
      tagIds: ['meal', 'premium_brand', 'chain_brand'],
      category: '餐厅',
      distanceMeters: 2500,
      averageCostYuan: 300,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    }
  ]
);
assert(!salesCenterResult.candidates.some((candidate) => candidate.restaurantId === 'sales-center'), 'sales, wholesale, group-buy, and mooncake centers should not be recommended as restaurants');
assert(salesCenterResult.candidates[0]?.restaurantId === 'real-premium', 'real restaurant should remain after filtering sales centers');

const imageFallbackResult = recommend(
  profile({
    preferredTagIds: ['rice', 'meal'],
    budgetLevel: 3,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'no-image-rice',
      name: '盖饭小店',
      tags: ['盖饭'],
      tagIds: ['rice', 'meal'],
      category: '简餐',
      distanceMeters: 100,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    }
  ]
);
assert(Boolean(imageFallbackResult.candidates[0]?.imageUrl), 'recommendation candidate should provide a fallback image when POI has no photo');
assert(/^https:\/\//.test(imageFallbackResult.candidates[0]?.imageUrl ?? ''), 'recommendation image should use HTTPS');

const imageHttpsResult = recommend(
  profile({
    preferredTagIds: ['rice', 'meal'],
    budgetLevel: 3,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'http-image-rice',
      name: '盖饭门店',
      tags: ['盖饭'],
      tagIds: ['rice', 'meal'],
      category: '简餐',
      coverImageUrl: 'http://aos-cdn-image.amap.com/example.jpg',
      distanceMeters: 100,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    }
  ]
);
assert(imageHttpsResult.candidates[0]?.imageUrl === 'https://aos-cdn-image.amap.com/example.jpg', 'AMap http image URL should be upgraded to HTTPS');



const unknownZeroCostScore = scoreRestaurant(
  {
    id: 'zero-cost-amap',
    name: '高德价格未知盖饭',
    tags: ['盖饭'],
    tagIds: ['quick', 'rice', 'meal', 'set_meal'],
    category: '简餐',
    distanceMeters: 200,
    averageCostYuan: 0,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  budgetRangePreference
);
assert(unknownZeroCostScore.breakdown.priceScore < 0, '高德 cost=0 应按价格未知处理并降权，不能当作 0 元加分');

const light = profile({
  preferredTagIds: ['light', 'healthy', 'low_burden', 'not_spicy'],
  avoidedTagIds: ['spicy', 'strong_flavor', 'bbq', 'fried', 'heavy']
});
const lightHeavyScore = scoreRestaurant(
  mockRestaurants.find((restaurant) => restaurant.id === 'r-hunan-rice') as Restaurant,
  light
);
const lightCongeeScore = scoreRestaurant(
  mockRestaurants.find((restaurant) => restaurant.id === 'r-cantonese-congee') as Restaurant,
  light
);
assert(lightCongeeScore.score > lightHeavyScore.score, '清淡偏好下重口味餐厅不能高分');

const implicitLight = profile({
  preferredTagIds: ['light', 'healthy', 'low_burden'],
  avoidedTagIds: []
});
const implicitLightFriedScore = scoreRestaurant(
  mockRestaurants.find((restaurant) => restaurant.id === 'r-fried-chicken') as Restaurant,
  implicitLight
);
assert(implicitLightFriedScore.matchedAvoidedTagIds.includes('fried'), '轻食/健康偏好应隐含避开炸物油腻');
assert((implicitLightFriedScore.confidenceScore ?? 100) <= 70, '轻食/健康偏好下油腻候选不能高匹配');

const implicitLightKfcScore = scoreRestaurant(
  {
    id: 'keyword-kfc',
    name: '肯德基(商场店)',
    tags: ['快餐'],
    category: '西式快餐',
    distanceMeters: 200,
    averageCostYuan: 44,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  implicitLight
);
assert(implicitLightKfcScore.matchedAvoidedTagIds.includes('fried'), '轻食/健康偏好应把肯德基类快餐识别为油炸油腻');
assert((implicitLightKfcScore.confidenceScore ?? 100) <= 70, '轻食/健康偏好下肯德基类候选不能高匹配');

const snack = profile({
  preferredTagIds: ['snack', 'quick', 'solo'],
  maxDistanceMeters: 1500
});
const snackResult = recommend(snack);
assert(
  snackResult.candidates[0]?.restaurantId === 'r-snack-buns' ||
    snackResult.candidates[0]?.matchedPreferredTagIds?.includes('snack') === true,
  '选择小吃时小吃类应优先'
);

const farOnlyRestaurants = mockRestaurants
  .filter((restaurant) => ['r-light-salad', 'r-japanese-curry'].includes(restaurant.id))
  .map((restaurant) => ({ ...restaurant, distanceMeters: 1800 }));
const fallbackResult = recommend(
  profile({
    preferredTagIds: ['light', 'healthy'],
    maxDistanceMeters: 500
  }),
  farOnlyRestaurants
);
assert(fallbackResult.candidatePoolStats?.fallbackUsed === true, '候选池不足时 fallback 应生效');
assert(fallbackResult.candidates[0]?.fallbackReason !== undefined, 'fallback 候选应记录 fallbackReason');
assert((fallbackResult.candidates[0]?.confidenceScore ?? 100) <= 70, 'fallback 后匹配度不能虚高');

const spicyOnlyFallback = recommend(noSpicy, [
  mockRestaurants.find((restaurant) => restaurant.id === 'r-chongqing-noodle') as Restaurant,
  mockRestaurants.find((restaurant) => restaurant.id === 'r-malatang') as Restaurant
]);
assert(spicyOnlyFallback.candidates.length === 0, '明确不吃辣时，即使候选池只有辣味冲突项，也不能 fallback 出明显辣味 Top1');
assert(spicyOnlyFallback.candidatePoolStats?.afterHardFilter === 2, '不吃辣冲突池的 afterHardFilter 应表示非负向硬过滤后的候选数');
assert(spicyOnlyFallback.candidatePoolStats?.afterNegativeFilter === 0, '不吃辣冲突池的 afterNegativeFilter 应为 0');
assert(spicyOnlyFallback.candidatePoolStats?.finalCandidateCount === 0, '不吃辣冲突池最终候选数应为 0');

const spicyKeywordRestaurants: Restaurant[] = [
  {
    id: 'keyword-xiaomian',
    name: '重庆小面',
    tags: ['面馆'],
    category: '面馆',
    distanceMeters: 180,
    averageCostYuan: 18,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  {
    id: 'keyword-malatang',
    name: '麻辣烫',
    tags: ['小吃'],
    category: '小吃',
    distanceMeters: 200,
    averageCostYuan: 25,
    openStatus: 'open',
    rating: 4.7,
    status: 'active'
  },
  {
    id: 'keyword-maocai',
    name: '冒菜',
    tags: ['简餐'],
    category: '简餐',
    distanceMeters: 210,
    averageCostYuan: 28,
    openStatus: 'open',
    rating: 4.7,
    status: 'active'
  },
  {
    id: 'keyword-drypot',
    name: '麻辣香锅',
    tags: ['香锅'],
    category: '香锅',
    distanceMeters: 240,
    averageCostYuan: 35,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'keyword-sichuan',
    name: '家常川菜',
    tags: ['中餐'],
    category: '川菜',
    distanceMeters: 260,
    averageCostYuan: 45,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'keyword-hunan',
    name: '湘菜小炒',
    tags: ['中餐'],
    category: '湘菜',
    distanceMeters: 280,
    averageCostYuan: 45,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'keyword-suanlafen',
    name: '酸辣粉',
    tags: ['粉面'],
    category: '粉面',
    distanceMeters: 300,
    averageCostYuan: 16,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'keyword-congee',
    name: '广式粥粉面',
    tags: ['粥粉面'],
    category: '广式简餐',
    distanceMeters: 320,
    averageCostYuan: 24,
    openStatus: 'open',
    rating: 4.2,
    status: 'active'
  }
];
const spicyKeywordResult = recommend(noSpicy, spicyKeywordRestaurants);
const spicyKeywordTopIds = spicyKeywordResult.candidates.map((candidate) => candidate.restaurantId);
[
  'keyword-xiaomian',
  'keyword-malatang',
  'keyword-maocai',
  'keyword-drypot',
  'keyword-sichuan',
  'keyword-hunan',
  'keyword-suanlafen'
].forEach((restaurantId) => {
  assert(!spicyKeywordTopIds.includes(restaurantId), `no spicy should filter keyword inferred spicy restaurant ${restaurantId}`);
});
assert(spicyKeywordResult.candidates[0]?.restaurantId === 'keyword-congee', 'no spicy should prefer non-spicy inferred tags');

const lightSpicyKeywordScore = scoreRestaurant(spicyKeywordRestaurants[0], light);
assert((lightSpicyKeywordScore.confidenceScore ?? 100) <= 70, '清淡偏好下辛辣关键词候选不能高匹配');
assert(lightSpicyKeywordScore.score < lightCongeeScore.score, '清淡偏好下辛辣关键词候选不能高分');

const expensiveOnlyResult = recommend(cheap, [
  {
    id: 'expensive-only',
    name: '高价西餐',
    tags: ['西餐'],
    tagIds: ['western', 'slow', 'relaxed'],
    category: '西餐',
    distanceMeters: 300,
    averageCostYuan: 128,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  }
]);
assert(expensiveOnlyResult.candidates.length === 0, '30 以下预算应硬过滤明显高价候选');

const nearDistanceResult = recommend(
  profile({
    preferredTagIds: ['light', 'healthy', 'salad', 'fresh', 'low_burden'],
    maxDistanceMeters: 500,
    maxEstimatedMinutes: 45
  }),
  [
    {
      id: 'near-basic',
      name: '近处清淡简餐',
      tags: ['简餐'],
      tagIds: ['light', 'healthy', 'rice', 'meal', 'quick', 'not_spicy'],
      category: '简餐',
      distanceMeters: 260,
      averageCostYuan: 24,
      openStatus: 'open',
      rating: 4.0,
      status: 'active'
    },
    {
      id: 'far-perfect',
      name: '远处轻食沙拉',
      tags: ['轻食', '沙拉'],
      tagIds: ['light', 'healthy', 'salad', 'fresh', 'low_burden', 'cold', 'not_spicy'],
      category: '轻食',
      distanceMeters: 1800,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(nearDistanceResult.candidates[0]?.restaurantId !== 'far-perfect', '远距离候选不能只靠标签匹配排到 Top1');

const flexibleDistanceResult = recommend(
  profile({
    selectedOptionIds: ['distance_any'],
    preferredTagIds: ['light', 'healthy', 'salad', 'fresh', 'low_burden'],
    maxDistanceMeters: 5000,
    maxEstimatedMinutes: 90
  }),
  [
    {
      id: 'near-weak',
      name: 'near weak match',
      tags: ['meal'],
      tagIds: ['meal', 'rice', 'quick'],
      category: 'meal',
      distanceMeters: 180,
      averageCostYuan: 35,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    },
    {
      id: 'far-better-match',
      name: 'far better light food',
      tags: ['light'],
      tagIds: ['light', 'healthy', 'salad', 'fresh', 'low_burden', 'not_spicy'],
      category: 'light food',
      distanceMeters: 2600,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.3,
      status: 'active'
    }
  ]
);
assert(flexibleDistanceResult.candidates[0]?.restaurantId === 'far-better-match', 'distance_any should allow farther candidates to win when they better match preferences');


const hotPreference = profile({
  preferredTagIds: ['hot', 'comfort', 'congee'],
  maxDistanceMeters: 1000
});
const hotWithEnoughCandidates = recommend(hotPreference, [
  {
    id: 'hot-congee',
    name: '热粥铺',
    tags: ['粥'],
    tagIds: ['hot', 'congee', 'comfort', 'not_spicy'],
    category: '粥',
    distanceMeters: 200,
    averageCostYuan: 22,
    openStatus: 'open',
    rating: 4.3,
    status: 'active'
  },
  {
    id: 'cold-salad',
    name: '冷食沙拉',
    tags: ['沙拉'],
    tagIds: ['cold', 'salad', 'light', 'healthy', 'not_spicy'],
    category: '轻食',
    distanceMeters: 180,
    averageCostYuan: 32,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  },
  {
    id: 'hot-noodle',
    name: '热汤面',
    tags: ['面'],
    tagIds: ['hot', 'noodle', 'comfort', 'not_spicy'],
    category: '面馆',
    distanceMeters: 240,
    averageCostYuan: 26,
    openStatus: 'open',
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'hot-buns',
    name: '热包子铺',
    tags: ['包子'],
    tagIds: ['hot', 'snack', 'quick', 'not_spicy'],
    category: '小吃',
    distanceMeters: 260,
    averageCostYuan: 16,
    openStatus: 'open',
    rating: 4.1,
    status: 'active'
  }
]);
assert(!hotWithEnoughCandidates.candidates.some((candidate) => candidate.restaurantId === 'cold-salad'), '热食偏好且候选充足时不应推荐冷食/轻食');

const hotFallback = recommend(hotPreference, [
  {
    id: 'cold-only',
    name: '冷食轻食',
    tags: ['沙拉'],
    tagIds: ['cold', 'salad', 'light', 'healthy', 'not_spicy'],
    category: '轻食',
    distanceMeters: 180,
    averageCostYuan: 32,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  }
]);
assert(hotFallback.candidatePoolStats?.fallbackUsed === true, '冷食补位应标记 fallbackUsed');
assert(hotFallback.candidates[0]?.fallbackReason !== undefined, '冷食补位应写入 fallbackReason');
assert((hotFallback.candidates[0]?.confidenceScore ?? 100) >= 45 && (hotFallback.candidates[0]?.confidenceScore ?? 0) <= 64, 'fallback 匹配百分比应在 45-64');

const strongMatchResult = recommend(
  profile({
    preferredTagIds: ['light', 'healthy', 'salad', 'fresh', 'low_burden', 'not_spicy'],
    avoidedTagIds: ['spicy', 'strong_flavor', 'fried', 'bbq', 'heavy'],
    budgetLevel: 3,
    maxDistanceMeters: 1000
  }),
  [
    mockRestaurants.find((restaurant) => restaurant.id === 'r-light-salad') as Restaurant,
    mockRestaurants.find((restaurant) => restaurant.id === 'r-cantonese-congee') as Restaurant,
    mockRestaurants.find((restaurant) => restaurant.id === 'r-rice-set') as Restaurant
  ]
);
assert((strongMatchResult.candidates[0]?.confidenceScore ?? 0) >= 80, '强匹配应达到 80-95');

const observableCandidate = strongMatchResult.candidates[0];
assert(strongMatchResult.algorithmVersion === 'recommendation-v3.0', '结果应暴露 algorithmVersion');
assert(strongMatchResult.weightProfileId !== undefined, '结果应暴露 weightProfileId');
assert(strongMatchResult.experimentId !== undefined, '结果应暴露 experimentId');
assert(strongMatchResult.candidatePoolStats !== undefined, '结果应暴露 candidatePoolStats');
assert(observableCandidate?.algorithmVersion === 'recommendation-v3.0', '候选应暴露 algorithmVersion');
assert(observableCandidate?.weightProfileId !== undefined, '候选应暴露 weightProfileId');
assert(observableCandidate?.experimentId !== undefined, '候选应暴露 experimentId');
assert(observableCandidate?.candidatePoolStats !== undefined, '候选应暴露 candidatePoolStats');
assert(Array.isArray(observableCandidate?.hardFilterReasons), '候选应暴露 hardFilterReasons');
assert(Array.isArray(observableCandidate?.penaltyReasons), '候选应暴露 penaltyReasons');
assert(observableCandidate?.scoreBreakdown?.finalScoreSource !== undefined, '候选应说明 finalScore 来源');
assert(observableCandidate?.scoreBreakdown?.matchPercentSource !== undefined, '候选应说明 matchPercent 来源');

const noSpicyQuery = buildAmapRestaurantQuery(noSpicy);
assert(!/川菜|湘菜|麻辣烫|小面|冒菜|香锅/.test(noSpicyQuery.keywords ?? ''), '避辣时高德关键词不能包含辣味冲突词');

const selectedQuestions = selectQuestionSet({ random: () => 0.1 });
assert(selectedQuestions.length === 6, '题目选择应返回 6 题');
assert(!selectedQuestions.some((question) => question.id === 'dining_mode'), '当前 6 题不应出现堂食/外卖');
assert(selectedQuestions.some((question) => question.id === 'distance'), '6 题应覆盖距离');
assert(selectedQuestions.some((question) => question.id === 'budget'), '6 题应覆盖预算');
assert(selectedQuestions.some((question) => question.id === 'meal_intent'), '6 questions should prioritize meal intent');
assert(
  selectedQuestions.filter((question) => ['meal_intent', 'dietary_restriction', 'nutrition_goal', 'time_slot', 'category_avoidance', 'category_preference'].includes(question.id)).length >= 2,
  '6 题应覆盖至少两个口味/健康/饱腹相关维度'
);
const selectedQuestionIds = new Set(selectedQuestions.map((question) => question.id));
assert(!(selectedQuestionIds.has('avoidance') && selectedQuestionIds.has('spice_tolerance')), 'avoidance and spice_tolerance should not appear together');
assert(
  ['satiety', 'meal_type', 'meal_intent'].filter((id) => selectedQuestionIds.has(id)).length <= 1,
  'satiety, meal_type, and meal_intent should not appear together'
);
assert(
  ['avoidance', 'flavor', 'health'].filter((id) => selectedQuestionIds.has(id)).length <= 1,
  'avoidance, flavor, and health should not repeat the same light or healthy intent'
);
const mealFollowUpQuestions = selectQuestionSet({
  answers: [
    {
      questionId: 'meal_intent',
      type: 'single',
      value: 'meal',
      optionIds: ['intent_meal'],
      answeredAt: '2026-06-02T04:00:10.000Z'
    }
  ],
  previousQuestions: selectedQuestions,
  random: () => 0.2
});
assert(!mealFollowUpQuestions.some((question) => question.id === 'category_preference'), 'meal intent should skip non-meal category preference follow-up');
assert(
  mealFollowUpQuestions.every((question) => {
    return question.options.every((option) => !['prefer_milk_tea', 'prefer_coffee', 'prefer_bakery_dessert'].includes(option.id));
  }),
  'meal intent should remove drink and dessert follow-up options'
);

const optionWithoutEffect = questionBank.flatMap((question) => question.options).find((option) => !option.effect);
assert(optionWithoutEffect === undefined, '每个选项都必须有 effect');

const optionWithoutImageOrIcon = questionBank
  .flatMap((question) => question.options)
  .find((option) => !option.imageUrl || !option.icon);
assert(optionWithoutImageOrIcon === undefined, '每个选项都必须有 imageUrl 和 icon');

const questionWithTooManyOptions = questionBank.find((question) => question.options.length > 5);
assert(questionWithTooManyOptions === undefined, 'each question should have no more than five options');

const answers: UserPreferenceAnswer[] = [
  {
    questionId: 'spice_tolerance',
    type: 'single',
    value: 'no_spicy',
    optionIds: ['spice_no'],
    answeredAt: '2026-06-02T04:00:00.000Z'
  }
];
const mapped = mapAnswersToPreferenceProfile(answers);
assert(mapped.avoidedTagIds.includes('chongqing_noodle'), '问答映射应扩展避辣负向标签');

const breadthRestaurants: Restaurant[] = [
  {
    id: 'breadth-milk-tea',
    name: '喜茶奶茶',
    tags: ['奶茶'],
    category: '茶饮',
    distanceMeters: 160,
    averageCostYuan: 24,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  {
    id: 'breadth-coffee',
    name: '街角咖啡',
    tags: ['咖啡'],
    category: '咖啡店',
    distanceMeters: 180,
    averageCostYuan: 28,
    openStatus: 'open',
    rating: 4.7,
    status: 'active'
  },
  {
    id: 'breadth-dessert',
    name: '甜品面包房',
    tags: ['甜品', '面包'],
    category: '甜品/面包',
    distanceMeters: 220,
    averageCostYuan: 32,
    openStatus: 'open',
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'breadth-rice-meal',
    name: '家常盖饭套餐',
    tags: ['盖饭'],
    tagIds: ['meal', 'rice', 'set_meal', 'quick', 'staple'],
    category: '简餐',
    distanceMeters: 120,
    averageCostYuan: 30,
    openStatus: 'open',
    rating: 4.9,
    status: 'active'
  },
  {
    id: 'breadth-breakfast-congee',
    name: '早餐粥包子铺',
    tags: ['早餐', '粥', '包子'],
    category: '早餐',
    distanceMeters: 140,
    averageCostYuan: 16,
    openStatus: 'open',
    rating: 4.5,
    status: 'active'
  },
  {
    id: 'breadth-late-snack',
    name: '夜宵热小吃',
    tags: ['夜宵', '小吃'],
    category: '小吃',
    distanceMeters: 150,
    averageCostYuan: 22,
    openStatus: 'open',
    rating: 4.5,
    status: 'active'
  },
  {
    id: 'breadth-bbq',
    name: '烤肉烧烤店',
    tags: ['烤肉', '烧烤'],
    category: '烧烤',
    distanceMeters: 150,
    averageCostYuan: 58,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  {
    id: 'breadth-halal-noodle',
    name: '清真兰州牛肉面',
    tags: ['清真', '牛肉面'],
    category: '清真面馆',
    distanceMeters: 170,
    averageCostYuan: 26,
    openStatus: 'open',
    rating: 4.4,
    status: 'active'
  },
  {
    id: 'breadth-pork-rice',
    name: '卤肉饭叉烧店',
    tags: ['卤肉', '叉烧'],
    category: '快餐',
    distanceMeters: 130,
    averageCostYuan: 28,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  {
    id: 'breadth-fitness',
    name: '高蛋白健身餐鸡胸肉',
    tags: ['健身餐', '鸡胸肉'],
    category: '轻食健康餐',
    distanceMeters: 190,
    averageCostYuan: 42,
    openStatus: 'open',
    rating: 4.7,
    status: 'active'
  },
  {
    id: 'breadth-seafood',
    name: '海鲜虾蟹饭',
    tags: ['海鲜', '虾', '蟹'],
    category: '海鲜',
    distanceMeters: 170,
    averageCostYuan: 48,
    openStatus: 'open',
    rating: 4.8,
    status: 'active'
  },
  {
    id: 'breadth-veggie',
    name: '素食轻食沙拉',
    tags: ['素食', '轻食', '沙拉'],
    category: '素食',
    distanceMeters: 180,
    averageCostYuan: 36,
    openStatus: 'open',
    rating: 4.3,
    status: 'active'
  }
];

const drinkPreference = profile({
  selectedOptionIds: ['intent_drink'],
  preferredTagIds: ['drink', 'coffee', 'milk_tea', 'non_meal', 'afternoon_tea'],
  avoidedTagIds: ['meal', 'set_meal', 'rice', 'hotpot', 'stir_fry'],
  maxDistanceMeters: 1000
});
const drinkResult = recommend(drinkPreference, breadthRestaurants);
assert(['breadth-milk-tea', 'breadth-coffee'].includes(drinkResult.candidates[0]?.restaurantId ?? ''), 'when user wants milk tea or coffee, Top1 should not be a meal');

const drinkVsDimSumResult = recommend(
  profile({
    selectedOptionIds: ['prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'milk-tea-real',
      name: '霸王茶姬',
      tags: ['milk tea'],
      category: '奶茶饮品',
      distanceMeters: 400,
      averageCostYuan: 25,
      openStatus: 'open',
      rating: 4.5,
      status: 'active'
    },
    {
      id: 'dim-sum-close',
      name: '虾饺点心铺',
      tags: ['dim sum'],
      category: '广式点心',
      distanceMeters: 80,
      averageCostYuan: 32,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(drinkVsDimSumResult.candidates[0]?.restaurantId === 'milk-tea-real', 'milk tea preference should not rank dim sum or shrimp dumpling above drinks');

const milkTeaVsCoffeeResult = recommend(
  profile({
    selectedOptionIds: ['prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal'],
    avoidedTagIds: ['meal', 'coffee', 'dessert'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'milk-tea-brand',
      name: '霸王茶姬',
      tags: ['奶茶', '茶饮'],
      category: '奶茶饮品',
      distanceMeters: 500,
      averageCostYuan: 24,
      openStatus: 'open',
      rating: 4.3,
      status: 'active'
    },
    {
      id: 'coffee-nearby',
      name: '精品咖啡',
      tags: ['coffee'],
      category: '咖啡馆',
      distanceMeters: 120,
      averageCostYuan: 36,
      openStatus: 'open',
      rating: 4.9,
      status: 'active'
    }
  ]
);
assert(milkTeaVsCoffeeResult.candidates[0]?.restaurantId === 'milk-tea-brand', 'explicit milk tea preference should rank milk tea above nearby coffee');

const dessertPreference = profile({
  selectedOptionIds: ['intent_dessert'],
  preferredTagIds: ['dessert', 'afternoon_tea', 'non_meal', 'drink'],
  avoidedTagIds: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
  maxDistanceMeters: 1000
});
const dessertResult = recommend(dessertPreference, breadthRestaurants);
assert(['breadth-dessert', 'breadth-milk-tea', 'breadth-coffee'].includes(dessertResult.candidates[0]?.restaurantId ?? ''), 'dessert preference should prioritize dessert, bakery, or afternoon tea');

const breakfastResult = recommend(
  profile({
    selectedOptionIds: ['time_breakfast'],
    preferredTagIds: ['breakfast', 'congee', 'noodle', 'staple', 'hot', 'quick'],
    maxDistanceMeters: 1000,
    maxEstimatedMinutes: 35
  }),
  breadthRestaurants
);
assert(breakfastResult.candidates[0]?.restaurantId === 'breadth-breakfast-congee', 'breakfast should prioritize congee, buns, noodles, or breakfast shops');

const lateNightResult = recommend(
  profile({
    selectedOptionIds: ['time_late_night'],
    preferredTagIds: ['late_night', 'quick', 'hot', 'snack'],
    maxDistanceMeters: 1000,
    maxEstimatedMinutes: 35
  }),
  breadthRestaurants
);
assert(lateNightResult.candidates[0]?.restaurantId === 'breadth-late-snack', 'late night should prioritize quick, hot, snack-like food');

const vegetarianPreference = profile({
  selectedOptionIds: ['dietary_vegetarian'],
  preferredTagIds: ['vegetarian', 'healthy', 'light'],
  avoidedTagIds: ['bbq', 'meat_heavy', 'pork', 'fried', 'heavy'],
  maxDistanceMeters: 1000
});
const vegetarianBbqScore = scoreRestaurant(breadthRestaurants.find((restaurant) => restaurant.id === 'breadth-bbq') as Restaurant, vegetarianPreference);
assert((vegetarianBbqScore.confidenceScore ?? 100) <= 45, 'vegetarian restriction should not give BBQ or meat-heavy candidates a high score');
assert(vegetarianBbqScore.matchedAvoidedTagIds.includes('meat_heavy') || vegetarianBbqScore.matchedAvoidedTagIds.includes('bbq'), 'vegetarian restriction should expose meat-heavy avoided tags');

const halalPreference = profile({
  selectedOptionIds: ['dietary_halal'],
  preferredTagIds: ['halal', 'high_protein'],
  avoidedTagIds: ['pork'],
  maxDistanceMeters: 1000
});
const halalPorkScore = scoreRestaurant(breadthRestaurants.find((restaurant) => restaurant.id === 'breadth-pork-rice') as Restaurant, halalPreference);
assert((halalPorkScore.confidenceScore ?? 100) <= 45, 'halal restriction should hard-conflict with pork related candidates');
const halalResult = recommend(halalPreference, breadthRestaurants);
assert(halalResult.candidates[0]?.restaurantId === 'breadth-halal-noodle', 'halal preference should prioritize halal candidates');

const lowSugarPreference = profile({
  selectedOptionIds: ['nutrition_low_sugar'],
  preferredTagIds: ['low_sugar', 'healthy', 'low_burden'],
  avoidedTagIds: ['dessert', 'milk_tea', 'sweet', 'sugary_drink'],
  maxDistanceMeters: 1000
});
const lowSugarMilkTeaScore = scoreRestaurant(breadthRestaurants.find((restaurant) => restaurant.id === 'breadth-milk-tea') as Restaurant, lowSugarPreference);
assert((lowSugarMilkTeaScore.confidenceScore ?? 100) <= 70, 'low sugar preference should strongly downgrade milk tea and desserts unless fallback');

const allergyPreference = profile({
  selectedOptionIds: ['dietary_allergy_sensitive'],
  preferredTagIds: ['allergy_sensitive', 'light', 'customizable'],
  avoidedTagIds: ['seafood', 'peanut', 'unclear_ingredients', 'spicy', 'strong_flavor'],
  maxDistanceMeters: 1000
});
const allergySeafoodScore = scoreRestaurant(breadthRestaurants.find((restaurant) => restaurant.id === 'breadth-seafood') as Restaurant, allergyPreference);
assert((allergySeafoodScore.confidenceScore ?? 100) <= 45, 'allergy sensitive preference should hard-conflict with common allergen keywords');

const proteinResult = recommend(
  profile({
    selectedOptionIds: ['nutrition_high_protein'],
    preferredTagIds: ['high_protein', 'healthy', 'low_carb'],
    avoidedTagIds: ['dessert', 'milk_tea', 'sweet'],
    maxDistanceMeters: 1000
  }),
  breadthRestaurants
);
assert(proteinResult.candidates[0]?.restaurantId === 'breadth-fitness', 'high protein should prioritize fitness meals, chicken breast, or beef rice candidates');

const mealPreference = profile({
  selectedOptionIds: ['intent_meal'],
  preferredTagIds: ['meal', 'staple', 'rice', 'noodle', 'set_meal'],
  avoidedTagIds: ['non_meal', 'drink', 'coffee', 'milk_tea', 'dessert'],
  maxDistanceMeters: 1000
});
const mealResult = recommend(mealPreference, breadthRestaurants);
assert(mealResult.candidates[0]?.restaurantId === 'breadth-rice-meal', 'when user explicitly wants a meal, milk tea coffee and dessert should not be Top1');

const avoidDrinkProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'category_avoidance',
    type: 'single',
    value: 'avoid_drinks',
    optionIds: ['avoid_category_drinks'],
    answeredAt: '2026-06-02T04:10:00.000Z'
  }
]);
const avoidDrinkQuery = buildAmapRestaurantQuery(avoidDrinkProfile);
assert(!/奶茶|咖啡|甜品|饮品/.test(avoidDrinkQuery.keywords ?? ''), 'avoided drink or dessert categories should not be included in AMap keywords');
const avoidDrinkResult = recommend(avoidDrinkProfile, breadthRestaurants);
assert(!['breadth-milk-tea', 'breadth-coffee', 'breadth-dessert'].includes(avoidDrinkResult.candidates[0]?.restaurantId ?? ''), 'avoided category should not be Top1');

const nonMealFallbackGuardResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_coffee'],
    preferredTagIds: ['drink', 'coffee', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'meal-chain-nearby',
      name: '蛙来哒',
      tags: ['连锁餐厅'],
      category: '湘菜餐厅',
      distanceMeters: 120,
      averageCostYuan: 95,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    },
    {
      id: 'coffee-farther',
      name: '精品咖啡馆',
      tags: ['咖啡', '下午茶'],
      category: '咖啡馆',
      distanceMeters: 900,
      averageCostYuan: 42,
      openStatus: 'open',
      rating: 4.1,
      status: 'active'
    }
  ]
);
assert(nonMealFallbackGuardResult.candidates[0]?.restaurantId === 'coffee-farther', 'explicit drink or coffee intent must not fallback to meal restaurants while non-meal candidates exist');

const realTeaBrandResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'koi-tea',
      name: 'KOI Thé',
      tags: [],
      category: '餐饮服务;冷饮店;冷饮店',
      distanceMeters: 800,
      averageCostYuan: 24,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    },
    {
      id: 'rice-shop',
      name: '小菜园新徽菜',
      tags: [],
      category: '中餐厅',
      distanceMeters: 200,
      averageCostYuan: 88,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert(realTeaBrandResult.candidates[0]?.restaurantId === 'koi-tea', 'KOI and similar real tea brands should be recognized as drink candidates');

const observedMilkTeaBrandResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'observed-tea-house',
      name: '裕莲茶楼',
      tags: [],
      category: '粤式茶楼',
      distanceMeters: 100,
      averageCostYuan: 26,
      openStatus: 'open',
      rating: 4.7,
      status: 'active'
    },
    {
      id: 'observed-milk-tea',
      name: '阿嬷手作',
      tags: [],
      category: '餐饮服务;冷饮店',
      distanceMeters: 280,
      averageCostYuan: 30,
      openStatus: 'open',
      rating: 4.3,
      status: 'active'
    }
  ]
);
assert(observedMilkTeaBrandResult.candidates[0]?.restaurantId === 'observed-milk-tea', 'tea houses should not beat observed milk tea brands for milk tea intent');

const observedDessertBrandResult = recommend(
  profile({
    selectedOptionIds: ['intent_dessert'],
    preferredTagIds: ['dessert', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'observed-dessert',
      name: 'Pinvita Gelato',
      tags: [],
      category: '餐饮服务;甜品店',
      distanceMeters: 300,
      averageCostYuan: 31,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    },
    {
      id: 'observed-dim-sum-gift',
      name: '点都德有礼',
      tags: [],
      category: '餐饮服务;糕饼店',
      distanceMeters: 80,
      averageCostYuan: 89,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert(observedDessertBrandResult.candidates[0]?.restaurantId === 'observed-dessert', 'observed dessert brands should beat gift or sales-like POIs for dessert intent');

const observedCoffeeBrandResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_coffee'],
    preferredTagIds: ['coffee', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'milk_tea', 'dessert'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'observed-dessert-station',
      name: '麦当劳甜品站',
      tags: [],
      category: '餐饮服务;冷饮店',
      distanceMeters: 20,
      averageCostYuan: 23,
      openStatus: 'open',
      rating: 4.7,
      status: 'active'
    },
    {
      id: 'observed-coffee',
      name: '星巴克',
      tags: [],
      category: '餐饮服务;咖啡厅',
      distanceMeters: 500,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    }
  ]
);
assert(observedCoffeeBrandResult.candidates[0]?.restaurantId === 'observed-coffee', 'observed coffee chains should beat dessert stations for coffee intent');

const observedDrinkKeywordResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'snack', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'observed-hot-luwei',
      name: '盛香亭转转热卤',
      tags: [],
      category: '餐饮服务;小吃快餐',
      distanceMeters: 30,
      averageCostYuan: 50,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    },
    {
      id: 'observed-guming',
      name: '古茗',
      tags: [],
      category: '餐饮服务;冷饮店',
      distanceMeters: 300,
      averageCostYuan: 15,
      openStatus: 'open',
      rating: 4.1,
      status: 'active'
    }
  ]
);
assert(observedDrinkKeywordResult.candidates[0]?.restaurantId === 'observed-guming', 'observed tea brands should beat hot luwei or meal snacks for drink intent');

const strictNonMealMealCategoryResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'spring-pancake',
      name: '老郑家东北春饼',
      tags: [],
      category: '餐饮服务;中餐厅',
      distanceMeters: 200,
      averageCostYuan: 71,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    },
    {
      id: 'real-tea',
      name: '爷爷不泡茶',
      tags: [],
      category: '餐饮服务;冷饮店',
      distanceMeters: 500,
      averageCostYuan: 18,
      openStatus: 'open',
      rating: 4.2,
      status: 'active'
    }
  ]
);
assert(strictNonMealMealCategoryResult.candidates[0]?.restaurantId === 'real-tea', 'explicit drink intent should hard-filter generic Chinese meal candidates');

const premiumNonMealBudgetCalibration = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_milk_tea', 'budget_over_200'],
    preferredTagIds: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
    avoidedTagIds: ['meal', 'rice', 'set_meal'],
    budgetLevel: 6,
    maxDistanceMeters: 1000
  }),
  [
    {
      id: 'low-cost-tea',
      name: '茉莉奶白',
      tags: [],
      category: '餐饮服务;冷饮店',
      distanceMeters: 180,
      averageCostYuan: 19,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert((premiumNonMealBudgetCalibration.candidates[0]?.confidenceScore ?? 100) <= 58, '200+ drink intent with low-cost tea should not show a strong match');
assert(
  Boolean(premiumNonMealBudgetCalibration.candidates[0]?.penaltyReasons?.some((reason) => reason.includes('价格低于所选预算档'))),
  'high-budget non-meal low-cost fallback should expose budget mismatch reason'
);

const mixedTaggedCafeResult = recommend(
  profile({
    selectedOptionIds: ['intent_drink', 'prefer_coffee'],
    preferredTagIds: ['coffee', 'drink', 'non_meal'],
    avoidedTagIds: ['meal'],
    budgetLevel: 4,
    maxDistanceMeters: 1500
  }),
  [
    {
      id: 'mixed-cafe',
      name: '无名堂-Chef no one',
      tags: [],
      tagIds: ['meal', 'coffee', 'drink', 'non_meal'],
      category: '餐饮服务;咖啡厅;咖啡厅',
      distanceMeters: 180,
      averageCostYuan: 61,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    },
    {
      id: 'nearby-meal',
      name: '春饼小馆',
      tags: [],
      tagIds: ['meal', 'rice', 'staple'],
      category: '餐饮服务;中餐厅;中餐厅',
      distanceMeters: 80,
      averageCostYuan: 45,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert(mixedTaggedCafeResult.candidates[0]?.restaurantId === 'mixed-cafe', 'mixed meal+coffee tag cafe should remain eligible for explicit drink intent');
assert(
  !(mixedTaggedCafeResult.candidates[0]?.penaltyReasons ?? []).some((reason) => reason.includes('explicit non-meal intent conflicts with meal candidate')),
  'mixed meal+coffee tag cafe should not be treated as a hard meal conflict'
);

const midHighBudgetBrandFallbackResult = recommend(
  profile({
    selectedOptionIds: ['brand_chain', 'distance_any'],
    preferredTagIds: ['relaxed', 'slow', 'premium_brand', 'mall_store'],
    avoidedTagIds: [],
    budgetLevel: 5,
    maxDistanceMeters: 10000
  }),
  [
    {
      id: 'budget-brandish',
      name: '点都德(永旺梦乐城店)',
      tags: [],
      tagIds: ['meal'],
      category: '餐饮服务;中餐厅;广东菜(粤菜)',
      address: '永旺梦乐城',
      distanceMeters: 400,
      averageCostYuan: 86,
      openStatus: 'open',
      rating: 4.6,
      status: 'active'
    },
    {
      id: 'too-cheap-chain',
      name: '麦当劳(商场店)',
      tags: [],
      tagIds: ['meal', 'chain_brand', 'low_chain'],
      category: '餐饮服务;快餐厅;麦当劳',
      address: '购物中心',
      distanceMeters: 200,
      averageCostYuan: 24,
      openStatus: 'open',
      rating: 4.8,
      status: 'active'
    }
  ]
);
assert(midHighBudgetBrandFallbackResult.candidates[0]?.restaurantId === 'budget-brandish', '100-200 brand preference should allow near-budget 80+ mall/high-rating restaurant fallback');
assert(
  midHighBudgetBrandFallbackResult.candidates.every((candidate) => candidate.restaurantId !== 'too-cheap-chain'),
  '100-200 brand preference should still hard-filter clearly low-budget chain restaurants'
);

void runPoiCacheAndStressTests().catch((error) => {
  throw error;
});

async function runPoiCacheAndStressTests() {
  const cloudRecommendRestaurant = require('../../../cloudfunctions/recommendRestaurant/index.js') as unknown as {
    main: (event: Record<string, unknown>, cloudContext: Record<string, unknown>) => Promise<{
      ok: boolean;
      data: { recommendation: ReturnType<typeof recommendRestaurants> };
    }>;
  };
  const cloudNoSpicyResponse = await cloudRecommendRestaurant.main(
    {
      restaurants: [
        {
          id: 'cloud-xiaomian',
          name: 'Chongqing Noodle',
          tags: ['noodle'],
          tagIds: ['spicy', 'strong_flavor', 'chongqing_noodle', 'noodle', 'hot'],
          category: 'noodle',
          distanceMeters: 300,
          averageCostYuan: 28,
          openStatus: 'open',
          rating: 4.4,
          status: 'active'
        },
        {
          id: 'cloud-malatang',
          name: 'Malatang',
          tags: ['hotpot'],
          tagIds: ['spicy', 'strong_flavor', 'malatang', 'hotpot', 'hot'],
          category: 'hotpot',
          distanceMeters: 400,
          averageCostYuan: 35,
          openStatus: 'open',
          rating: 4.3,
          status: 'active'
        }
      ],
      context: { preferenceSnapshot: noSpicy },
      limit: 3
    },
    {}
  );
  const cloudNoSpicyRecommendation = cloudNoSpicyResponse.data.recommendation;
  assert(cloudNoSpicyResponse.ok === true, 'cloud recommendation should return ok for no-spicy conflict regression');
  assert(cloudNoSpicyRecommendation.candidates.length === 0, 'cloud no-spicy hard-negative pool should not fallback to spicy top1');
  assert(cloudNoSpicyRecommendation.candidatePoolStats !== undefined, 'cloud no-spicy regression should expose candidatePoolStats');
  assert(cloudNoSpicyRecommendation.candidatePoolStats.afterHardFilter === 2, 'cloud afterHardFilter should match front-end non-negative hard-filter count');
  assert(cloudNoSpicyRecommendation.candidatePoolStats.afterNegativeFilter === 0, 'cloud afterNegativeFilter should match front-end negative-filter count');

  const storage: Record<string, unknown> = {};
  const baseLocation = { latitude: 39.909, longitude: 116.455 };
  let amapCallCount = 0;
  const cachedRestaurants: Restaurant[] = [
    {
      id: 'cache-light-rice',
      name: 'Light Rice',
      tags: ['light', 'rice'],
      tagIds: ['light', 'healthy', 'rice', 'meal', 'quick'],
      category: 'light rice',
      distanceMeters: 350,
      averageCostYuan: 38,
      openStatus: 'open',
      rating: 4.6,
      source: 'amap',
      status: 'active'
    },
    {
      id: 'cache-spicy-noodle',
      name: 'Spicy Noodle',
      tags: ['spicy', 'noodle'],
      tagIds: ['spicy', 'strong_flavor', 'noodle', 'meal'],
      category: 'spicy noodle',
      distanceMeters: 420,
      averageCostYuan: 32,
      openStatus: 'open',
      rating: 4.7,
      source: 'amap',
      status: 'active'
    },
    {
      id: 'cache-coffee',
      name: 'Coffee Bar',
      tags: ['coffee'],
      tagIds: ['coffee', 'drink', 'non_meal', 'afternoon_tea'],
      category: 'coffee',
      distanceMeters: 260,
      averageCostYuan: 28,
      openStatus: 'open',
      rating: 4.5,
      source: 'amap',
      status: 'active'
    }
  ];

  __resetNearbyRestaurantCacheForTest();
  const requestedModes: string[] = [];
  __setAmapPoiStorageAdapterForTest({
    get: (key) => storage[key],
    set: (key, value) => {
      storage[key] = value;
    }
  });
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    amapCallCount += 1;
    const mode = options.mode ?? 'polygon';
    requestedModes.push(mode);

    return {
      restaurants: cachedRestaurants,
      meta: {
        amapApiCallCount: 1,
        poiFetchReason: `test-${mode}-live-fetch`,
        poiFetchMode: mode,
        aroundCallCount: mode === 'around' ? 1 : 0,
        polygonCallCount: mode === 'polygon' ? 1 : 0,
        keywordCallCount: mode === 'keyword' ? 1 : 0,
        idCallCount: mode === 'id' ? 1 : 0,
        totalAmapApiCallCount: 1
      }
    };
  });

  const firstFetch = await getNearbyRestaurantsWithMeta({
    location: baseLocation,
    radiusMeters: 3000,
    pageSize: 25,
    pageCount: 2,
    keyword: '',
    types: '050000',
    maxAmapApiCalls: 3
  });
  assert(firstFetch.meta.poiCacheHit === false, 'first same-query fetch should miss cache');
  assert(firstFetch.meta.amapApiCallCount === 1, 'first same-query fetch should call AMap once');
  assert(firstFetch.meta.poiFetchMode === 'polygon', 'default POI fetch should use polygon mode');
  assert(firstFetch.meta.polygonCallCount === 1 && firstFetch.meta.aroundCallCount === 0, 'polygon fetch should not consume around quota');
  assert(requestedModes[0] === 'polygon', 'front-end POI service should pass polygon mode to the cloud function');

  const secondFetch = await getNearbyRestaurantsWithMeta({
    location: baseLocation,
    radiusMeters: 3000,
    pageSize: 25,
    pageCount: 2,
    keyword: '',
    types: '050000',
    maxAmapApiCalls: 3
  });
  assert(secondFetch.meta.poiCacheHit === true, 'same location and query should hit POI cache');
  assert(Number(amapCallCount) === 1, 'same location and query should not call AMap twice');

  const keywordFromPolygonCacheFetch = await getNearbyRestaurantsWithMeta({
    mode: 'keyword',
    location: baseLocation,
    radiusMeters: 1500,
    pageSize: 25,
    pageCount: 1,
    keyword: 'coffee',
    city: 'Beijing',
    types: '050000',
    maxAmapApiCalls: 1
  });
  assert(keywordFromPolygonCacheFetch.meta.poiCacheHit === true, 'keyword request should reuse broad polygon cache when possible');
  assert(keywordFromPolygonCacheFetch.restaurants[0]?.id === 'cache-coffee', 'keyword cache hit should locally filter matching category restaurants');
  assert(Number(amapCallCount) === 1, 'keyword local-filter cache hit should not call AMap');

  const nearbyFetch = await getNearbyRestaurantsWithMeta({
    location: { latitude: 39.918, longitude: 116.455 },
    radiusMeters: 1500,
    pageSize: 25,
    pageCount: 2,
    keyword: '',
    types: '050000',
    maxAmapApiCalls: 3
  });
  assert(nearbyFetch.meta.poiCacheHit === true, 'location moved less than 2km should hit POI cache');
  assert(Number(amapCallCount) === 1, 'location moved less than 2km should not call AMap again');

  const farFetch = await getNearbyRestaurantsWithMeta({
    location: { latitude: 39.94, longitude: 116.455 },
    radiusMeters: 1500,
    pageSize: 25,
    pageCount: 2,
    keyword: '',
    types: '050000',
    maxAmapApiCalls: 3
  });
  assert(farFetch.meta.poiCacheHit === false, 'location moved more than 2km should refresh POI cache');
  assert(Number(amapCallCount) === 2, 'location moved more than 2km should call AMap again');

  const cacheStore = storage.nearby_restaurants_amap_cache as {
    entries: Array<{ createdAt: number }>;
  };
  cacheStore.entries[0].createdAt = Date.now() - POI_CACHE_TTL_MS - 1;
  __setAmapPoiStorageAdapterForTest({
    get: (key) => storage[key],
    set: (key, value) => {
      storage[key] = value;
    }
  });
  const expiredFetch = await getNearbyRestaurantsWithMeta({
    location: { latitude: 39.94, longitude: 116.455 },
    radiusMeters: 1500,
    pageSize: 25,
    pageCount: 2,
    keyword: '',
    types: '050000',
    maxAmapApiCalls: 3
  });
  assert(expiredFetch.meta.poiCacheHit === false, 'expired POI cache should refresh');
  assert(Number(amapCallCount) === 3, 'expired POI cache should call AMap again');

  const drinkResult = recommend(
    profile({
      selectedOptionIds: ['intent_drink'],
      preferredTagIds: ['coffee', 'drink', 'non_meal'],
      avoidedTagIds: ['meal'],
      maxDistanceMeters: 3000
    }),
    cachedRestaurants
  );
  const lightResult = recommend(
    profile({
      preferredTagIds: ['light', 'healthy', 'rice'],
      avoidedTagIds: ['spicy', 'strong_flavor'],
      maxDistanceMeters: 3000
    }),
    cachedRestaurants
  );
  assert(drinkResult.candidates[0]?.restaurantId === 'cache-coffee', 'cached candidates should rank drink preferences correctly');
  assert(lightResult.candidates[0]?.restaurantId === 'cache-light-rice', 'cached candidates should rank light meal preferences correctly');

  storage.nearby_restaurants_amap_cache = undefined;
  __setAmapPoiStorageAdapterForTest({
    get: (key) => storage[key],
    set: (key, value) => {
      storage[key] = value;
    }
  });
  const failedCacheOnlyFetch = await getNearbyRestaurantsWithMeta({
    location: baseLocation,
    radiusMeters: 3000,
    cacheOnly: true,
    maxAmapApiCalls: 0
  });
  assert(failedCacheOnlyFetch.restaurants.length === 0, 'AMap failure fallback path should return an empty POI pool without live calls');
  assert(failedCacheOnlyFetch.meta.amapApiCallCount === 0, 'fallback path should not count live AMap calls');

  __resetNearbyRestaurantCacheForTest();
  const serviceStorage: Record<string, unknown> = {};
  const serviceRequestedModes: string[] = [];
  const largePolygonPool: Restaurant[] = Array.from({ length: 36 }, (_, index) => ({
    id: `polygon-pool-${index}`,
    name: `Polygon Cafe ${index}`,
    tags: ['coffee'],
    tagIds: ['coffee', 'drink', 'non_meal', 'afternoon_tea'],
    category: 'coffee',
    distanceMeters: 200 + index * 10,
    averageCostYuan: 35,
    openStatus: 'open',
    rating: 4.5,
    source: 'amap',
    status: 'active'
  }));

  __setAmapPoiStorageAdapterForTest({
    get: (key) => serviceStorage[key],
    set: (key, value) => {
      serviceStorage[key] = value;
    }
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    const mode = options.mode ?? 'polygon';
    serviceRequestedModes.push(mode);

    return {
      restaurants: mode === 'around' ? [] : largePolygonPool,
      meta: {
        amapApiCallCount: 1,
        poiFetchReason: `service-${mode}-fetch`,
        poiFetchMode: mode,
        aroundCallCount: mode === 'around' ? 1 : 0,
        polygonCallCount: mode === 'polygon' ? 1 : 0,
        keywordCallCount: mode === 'keyword' ? 1 : 0,
        totalAmapApiCallCount: 1
      }
    };
  });

  const serviceRecommendations = await getLocalRecommendations(undefined);
  assert(serviceRecommendations.length > 0, 'mealService should recommend from polygon candidate pool');
  assert(serviceRequestedModes.includes('polygon'), 'mealService should use polygon mode for the primary pool');
  assert(!serviceRequestedModes.includes('around'), 'mealService should not call around when polygon pool is sufficient');
  assert(serviceRequestedModes.length === 1, 'mealService should spend one live POI call when the primary pool is sufficient');

  __resetNearbyRestaurantCacheForTest();
  const fallbackRequestedModes: string[] = [];
  const smallPrimaryPool: Restaurant[] = cachedRestaurants.slice(0, 2);
  const generatedFallbackRestaurants: Restaurant[] = Array.from({ length: 14 }).map((_, index) => ({
    id: `fallback-pool-${index}`,
    name: `Fallback Rice ${index}`,
    tags: ['rice'],
    tagIds: ['quick', 'rice', 'meal', 'staple'],
    category: 'rice',
    distanceMeters: 500 + index * 20,
    averageCostYuan: 42,
    openStatus: 'open',
    rating: 4.3,
    source: 'amap',
    status: 'active'
  }));
  const fallbackPool: Restaurant[] = [
    ...smallPrimaryPool,
    ...generatedFallbackRestaurants
  ];

  __setAmapPoiStorageAdapterForTest({
    get: () => undefined,
    set: () => undefined
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    const mode = options.mode ?? 'polygon';
    fallbackRequestedModes.push(mode);

    return {
      restaurants: fallbackRequestedModes.length === 1 ? smallPrimaryPool : fallbackPool,
      meta: {
        amapApiCallCount: 1,
        poiFetchReason: `fallback-${mode}-fetch`,
        poiFetchMode: mode,
        aroundCallCount: mode === 'around' ? 1 : 0,
        polygonCallCount: mode === 'polygon' ? 1 : 0,
        keywordCallCount: mode === 'keyword' ? 1 : 0,
        totalAmapApiCallCount: 1
      }
    };
  });

  const fallbackRecommendations = await getLocalRecommendations(undefined);
  assert(fallbackRecommendations.length > 0, 'mealService should still recommend after one fallback fetch');
  assert(fallbackRequestedModes.length === 2, 'mealService should spend at most two live POI calls when the primary pool is small');
  assert(fallbackRequestedModes[0] === 'polygon', 'mealService should use polygon as the primary fetch');
  assert(
    fallbackRequestedModes[1] === 'polygon' || fallbackRequestedModes[1] === 'around' || fallbackRequestedModes[1] === 'keyword',
    'mealService fallback should try another polygon, around, or scoped keyword'
  );

  __resetNearbyRestaurantCacheForTest();
  const premiumFallbackKeywords: string[] = [];
  const cheapButLargePool: Restaurant[] = Array.from({ length: 14 }).map((_, index) => ({
    id: `cheap-large-pool-${index}`,
    name: `Cheap Regular Meal ${index}`,
    tags: ['rice'],
    tagIds: ['quick', 'rice', 'meal', 'staple'],
    category: 'rice',
    distanceMeters: 600 + index * 30,
    averageCostYuan: 45,
    openStatus: 'open',
    rating: 4.4,
    source: 'amap',
    status: 'active'
  }));
  const premiumSupplementPool: Restaurant[] = [
    ...cheapButLargePool,
    {
      id: 'premium-teppanyaki',
      name: 'Premium Teppanyaki',
      tags: ['teppanyaki'],
      tagIds: ['meal', 'premium_brand', 'relaxed', 'slow'],
      category: 'teppanyaki',
      distanceMeters: 4200,
      averageCostYuan: 260,
      openStatus: 'open',
      rating: 4.7,
      source: 'amap',
      status: 'active'
    },
    {
      id: 'premium-chef-grill',
      name: 'Chef Grill',
      tags: ['grill'],
      tagIds: ['meal', 'premium_brand', 'relaxed', 'slow'],
      category: 'western restaurant',
      distanceMeters: 3900,
      averageCostYuan: 288,
      openStatus: 'open',
      rating: 4.6,
      source: 'amap',
      status: 'active'
    }
  ];

  __setAmapPoiStorageAdapterForTest({
    get: () => undefined,
    set: () => undefined
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    premiumFallbackKeywords.push(options.keyword ?? '');

    return {
      restaurants: premiumFallbackKeywords.length === 1 ? cheapButLargePool : premiumSupplementPool,
      meta: {
        amapApiCallCount: 1,
        poiFetchReason: `premium-${options.mode ?? 'polygon'}-fetch`,
        poiFetchMode: options.mode ?? 'polygon',
        aroundCallCount: (options.mode ?? 'polygon') === 'around' ? 1 : 0,
        polygonCallCount: (options.mode ?? 'polygon') === 'polygon' ? 1 : 0,
        keywordCallCount: (options.mode ?? 'polygon') === 'keyword' ? 1 : 0,
        totalAmapApiCallCount: 1
      }
    };
  });

  const premiumFallbackRecommendations = await getLocalRecommendations({
    version: 'test',
    source: 'recommendation_filter',
    submittedAt: '2026-06-02T04:00:00.000Z',
    answers: [
      {
        questionId: 'budget',
        type: 'single',
        value: 'over_200',
        optionIds: ['budget_over_200'],
        answeredAt: '2026-06-02T04:00:01.000Z'
      },
      {
        questionId: 'distance',
        type: 'single',
        value: 'any',
        optionIds: ['distance_any'],
        answeredAt: '2026-06-02T04:00:02.000Z'
      }
    ]
  });
  assert(premiumFallbackKeywords.length >= 2, '200+ recommendation should still supplement when the raw pool is large but premium-effective candidates are scarce');
  assert(new Set(premiumFallbackKeywords).size >= 2, 'premium supplement fetch should switch to a different high-end keyword cluster');
  assert(
    /黑珍珠|米其林|omakase|高端日料|法餐|Fine Dining/.test(premiumFallbackKeywords[0] ?? ''),
    '200+ primary fetch should start with expensive intent keywords, not broad steak or teppanyaki keywords'
  );
  assert(
    premiumFallbackKeywords.some((keyword) => /酒店餐厅|私房菜|主厨餐厅|牛排馆|融合料理|海鲜放题/.test(keyword)),
    'premium supplement fetch should include high-ticket occasion keywords as the second layer'
  );
  assert(
    premiumFallbackRecommendations.some((candidate) => candidate.restaurantId === 'premium-teppanyaki' || candidate.restaurantId === 'premium-chef-grill'),
    '200+ recommendations should include premium candidates recovered by the supplement fetch'
  );

  __resetNearbyRestaurantCacheForTest();
  const quotaRecoveryRequestedModes: string[] = [];
  const quotaRecoveryMaxAmapCalls: number[] = [];
  __setAmapPoiStorageAdapterForTest({
    get: () => undefined,
    set: () => undefined
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    const mode = options.mode ?? 'polygon';
    quotaRecoveryRequestedModes.push(mode);
    quotaRecoveryMaxAmapCalls.push(options.maxAmapApiCalls ?? 0);

    if (quotaRecoveryRequestedModes.length === 1) {
      throw new Error('USER_DAILY_QUERY_OVER_LIMIT');
    }

    return {
      restaurants: premiumSupplementPool,
      meta: {
        amapApiCallCount: 1,
        poiFetchReason: `quota-recovered-${mode}-fetch`,
        poiFetchMode: mode,
        aroundCallCount: mode === 'around' ? 1 : 0,
        polygonCallCount: mode === 'polygon' ? 1 : 0,
        keywordCallCount: mode === 'keyword' ? 1 : 0,
        totalAmapApiCallCount: 1
      }
    };
  });

  const quotaRecoveredRecommendations = await getLocalRecommendations({
    version: 'test',
    source: 'recommendation_filter',
    submittedAt: '2026-06-02T04:00:00.000Z',
    answers: [
      {
        questionId: 'budget',
        type: 'single',
        value: 'over_200',
        optionIds: ['budget_over_200'],
        answeredAt: '2026-06-02T04:00:01.000Z'
      }
    ]
  });
  assert(
    quotaRecoveryRequestedModes.length >= 2 && quotaRecoveryRequestedModes.length <= 3,
    'quota error on the primary search should try bounded fallback searches before failing'
  );
  assert(quotaRecoveryRequestedModes[0] === 'polygon', 'quota recovery should fail from the primary polygon fetch first');
  assert(
    quotaRecoveryMaxAmapCalls[0] >= 2,
    'primary recommendation POI request should reserve enough budget for AMap key switching'
  );
  assert(
    quotaRecoveryRequestedModes[1] === 'polygon' || quotaRecoveryRequestedModes[1] === 'around' || quotaRecoveryRequestedModes[1] === 'keyword',
    'quota recovery should switch to another polygon, around, or scoped keyword fallback'
  );
  assert(quotaRecoveredRecommendations.length > 0, 'quota recovery fallback should still return restaurant recommendations');

  __resetNearbyRestaurantCacheForTest();
  const midHighBudgetQuotaAttempts: Array<{ mode: string; keyword: string; maxAmapApiCalls: number }> = [];
  __setAmapPoiStorageAdapterForTest({
    get: () => undefined,
    set: () => undefined
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    midHighBudgetQuotaAttempts.push({
      mode: options.mode ?? 'polygon',
      keyword: options.keyword ?? '',
      maxAmapApiCalls: options.maxAmapApiCalls ?? 0
    });
    throw new Error('USER_DAILY_QUERY_OVER_LIMIT');
  });

  try {
    await getLocalRecommendations({
      version: 'test',
      source: 'recommendation_filter',
      submittedAt: '2026-06-02T04:00:00.000Z',
      answers: [
        {
          questionId: 'budget',
          type: 'single',
          value: '100_200',
          optionIds: ['budget_100_200'],
          answeredAt: '2026-06-02T04:00:01.000Z'
        },
        {
          questionId: 'brand_preference',
          type: 'single',
          value: 'chain',
          optionIds: ['brand_chain'],
          answeredAt: '2026-06-02T04:00:02.000Z'
        }
      ]
    });
  } catch {
    // Expected: this scenario intentionally makes every live fetch fail.
  }
  assert(midHighBudgetQuotaAttempts.length >= 2, '100-200 brand path should try multiple live fetches before surfacing failure');
  assert(midHighBudgetQuotaAttempts[0]?.mode === 'polygon', '100-200 brand path should start with polygon, not around');
  assert(
    /粤菜|江浙菜|日料|西餐|烤肉|火锅|融合料理|费大厨|海底捞|点都德|陶陶居/.test(midHighBudgetQuotaAttempts[0]?.keyword ?? ''),
    '100-200 brand path should use concrete mid-high meal keywords before generic mall keywords'
  );
  assert(
    midHighBudgetQuotaAttempts.reduce((sum, attempt) => sum + attempt.maxAmapApiCalls, 0) === 3,
    '100-200 brand path should spend the bounded AMap key retry budget before surfacing quota failure'
  );
  assert(
    midHighBudgetQuotaAttempts.every((attempt) => attempt.mode !== 'around'),
    '100-200 brand path should not jump to around while polygon key-retry budget is being exhausted'
  );

  __resetNearbyRestaurantCacheForTest();
  let quotaFailureCallCount = 0;
  let quotaFailurePlannedAmapBudget = 0;
  __setAmapPoiStorageAdapterForTest({
    get: () => undefined,
    set: () => undefined
  });
  __setAmapPoiLocationProviderForTest(async () => baseLocation);
  __setAmapPoiCloudFetcherForTest(async (_location, options) => {
    quotaFailureCallCount += 1;
    quotaFailurePlannedAmapBudget += options.maxAmapApiCalls ?? 0;
    throw new Error('USER_DAILY_QUERY_OVER_LIMIT');
  });

  let quotaErrorMessage = '';
  try {
    await getLocalRecommendations({
      version: 'test',
      source: 'recommendation_filter',
      submittedAt: '2026-06-02T04:00:00.000Z',
      answers: [
        {
          questionId: 'budget',
          type: 'single',
          value: 'over_200',
          optionIds: ['budget_over_200'],
          answeredAt: '2026-06-02T04:00:01.000Z'
        }
      ]
    });
  } catch (error) {
    quotaErrorMessage = error instanceof Error ? error.message : String(error);
  }
  assert(quotaErrorMessage === 'AMAP_DAILY_QUOTA_EXHAUSTED', 'quota exhaustion should surface only after fallback searches are also unavailable');
  assert(quotaFailureCallCount === 2, 'quota exhaustion should use bounded logical POI attempts while leaving room for key retry inside each attempt');
  assert(quotaFailurePlannedAmapBudget === 3, 'quota exhaustion should spend the bounded recommendation AMap budget, not stop after the first key or loop indefinitely');

  const stress = require('../../../scripts/stressRecommendation.js');
  const missingCachePolicy = stress.validateStressCachePolicy({
    cacheFileExists: false,
    allowLive: false,
    liveRequested: false
  });
  assert(!missingCachePolicy.ok && !missingCachePolicy.mayCallAmap, 'stress without cache should fail and not allow live AMap');

  const existingCachePolicy = stress.validateStressCachePolicy({
    cacheFileExists: true,
    allowLive: false,
    liveRequested: false
  });
  assert(existingCachePolicy.ok && !existingCachePolicy.mayCallAmap, 'stress with cache should run with zero AMap calls');

  for (let index = 0; index < 500; index += 1) {
    const result = recommend(
      profile({
        preferredTagIds: index % 2 === 0 ? ['light', 'rice'] : ['coffee', 'drink', 'non_meal'],
        avoidedTagIds: index % 2 === 0 ? ['spicy'] : ['meal'],
        maxDistanceMeters: 3000
      }),
      cachedRestaurants
    );

    assert(result.candidates.length > 0, 'stress-style cached recommendation should produce candidates');
  }
  assert(Number(amapCallCount) === 3, '500 cached recommendation runs should make zero additional AMap calls');
}
