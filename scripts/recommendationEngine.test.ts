import { mockRestaurants } from '../miniprogram/data/mockRestaurants';
import { questionBank } from '../miniprogram/data/questionBank';
import { buildAmapRestaurantQuery } from '../miniprogram/services/amapQueryBuilder';
import { mapAnswersToPreferenceProfile } from '../miniprogram/services/preferenceMapper';
import { recommendRestaurants, scoreRestaurant } from '../miniprogram/services/recommendationEngine';
import { selectQuestionSet } from '../miniprogram/services/questionSelector';
import type { Restaurant } from '../miniprogram/types/restaurant';
import type { UserPreferenceAnswer, UserPreferenceProfile } from '../miniprogram/types/userPreference';

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
assert(luxuryUnknownOnlyResult.candidates.length === 0, '200+ budget should not recommend price unknown candidates');

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
  mockRestaurants.find((restaurant) => restaurant.id === 'r-chongqing-noodle') as Restaurant
]);
assert((spicyOnlyFallback.candidates[0]?.confidenceScore ?? 100) <= 45, '负向冲突 fallback 匹配度不能虚高');

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
assert(strongMatchResult.algorithmVersion === 'recommendation-v2.5', '结果应暴露 algorithmVersion');
assert(strongMatchResult.weightProfileId !== undefined, '结果应暴露 weightProfileId');
assert(strongMatchResult.experimentId !== undefined, '结果应暴露 experimentId');
assert(strongMatchResult.candidatePoolStats !== undefined, '结果应暴露 candidatePoolStats');
assert(observableCandidate?.algorithmVersion === 'recommendation-v2.5', '候选应暴露 algorithmVersion');
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
