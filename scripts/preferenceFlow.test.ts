import { buildAmapRestaurantQuery } from '../miniprogram/services/amapQueryBuilder';
import { mapAnswersToPreferenceProfile } from '../miniprogram/services/preferenceMapper';
import { selectQuestionSet } from '../miniprogram/services/questionSelector';
import type { PreferenceDimension, UserPreferenceAnswer } from '../miniprogram/types/userPreference';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const baseDimensions: PreferenceDimension[] = ['distance', 'budget', 'dining_mode'];
const questions = selectQuestionSet({
  random: () => 0.42
});
const selectedBaseCount = questions.filter((question) => {
  return baseDimensions.includes(question.dimension);
}).length;

assert(questions.length === 6, 'dynamic selector should return exactly six questions');
assert(selectedBaseCount >= 2, 'dynamic selector should include at least two base dimensions');

const answers: UserPreferenceAnswer[] = [
  {
    questionId: 'distance',
    type: 'single',
    value: 1000,
    optionIds: ['distance_1km'],
    answeredAt: '2026-06-02T04:00:00.000Z'
  },
  {
    questionId: 'flavor',
    type: 'single',
    value: 'light',
    optionIds: ['flavor_light'],
    answeredAt: '2026-06-02T04:00:01.000Z'
  }
];

const profile = mapAnswersToPreferenceProfile(answers);

assert(profile.maxDistanceMeters === 1000, 'mapper should normalize distance answers');
assert(profile.budgetLevel === 3, 'mapper should use the default budget when budget is missing');
assert(
  profile.constraints?.diningMode === 'either',
  'mapper should use the default dining mode when dining mode is missing'
);
assert(profile.preferredTagIds.includes('light'), 'mapper should keep positive preference tags');
assert(profile.avoidedTagIds.includes('strong_flavor'), 'mapper should keep negative preference tags');

const amapQuery = buildAmapRestaurantQuery(profile);

assert(amapQuery.radiusMeters === 1000, 'AMap query should use normalized radius');
assert(amapQuery.types === '050000', 'AMap query should constrain candidates to food POIs');
assert(
  Boolean(amapQuery.keywords?.includes('轻食') || amapQuery.keywords?.includes('粥')),
  'AMap query should derive keywords from suitable positive preferences'
);

const deliveryProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'dining_mode',
    type: 'single',
    value: 'delivery',
    optionIds: ['dining_mode_delivery'],
    answeredAt: '2026-06-02T04:00:03.000Z'
  }
]);

assert(
  deliveryProfile.maxEstimatedMinutes === 60,
  'delivery should be able to relax estimated time beyond the default'
);

const fastDeliveryProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'dining_mode',
    type: 'single',
    value: 'delivery',
    optionIds: ['dining_mode_delivery'],
    answeredAt: '2026-06-02T04:00:04.000Z'
  },
  {
    questionId: 'speed',
    type: 'single',
    value: 'fast',
    optionIds: ['speed_fast'],
    answeredAt: '2026-06-02T04:00:05.000Z'
  }
]);

assert(
  fastDeliveryProfile.maxEstimatedMinutes === 30,
  'strict speed preference should tighten delivery estimated time'
);

const premiumBudgetProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'budget',
    type: 'single',
    value: '100_200',
    optionIds: ['budget_100_200'],
    answeredAt: '2026-06-02T04:00:06.000Z'
  }
]);

assert(premiumBudgetProfile.budgetLevel === 5, '100-200 budget should map to premium budget level');

const premiumBrandBudgetProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'budget',
    type: 'single',
    value: '100_200',
    optionIds: ['budget_100_200'],
    answeredAt: '2026-06-02T04:00:06.000Z'
  },
  {
    questionId: 'brand_preference',
    type: 'single',
    value: 'chain',
    optionIds: ['brand_chain'],
    answeredAt: '2026-06-02T04:00:06.500Z'
  }
]);
const premiumBrandBudgetQuery = buildAmapRestaurantQuery(premiumBrandBudgetProfile);
assert(
  !/高端餐厅|黑珍珠|米其林|omakase|Fine Dining|炳胜|利苑|白天鹅/.test(premiumBrandBudgetQuery.keywords ?? ''),
  '100-200 brand preference should not use 200+ premium-only keywords'
);
assert(
  !/肯德基|麦当劳|快餐|简餐|盖饭|套餐/.test(premiumBrandBudgetQuery.keywords ?? ''),
  '100-200 brand preference should not actively search low-budget fast-food keywords'
);

const luxuryBudgetProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'budget',
    type: 'single',
    value: 'over_200',
    optionIds: ['budget_over_200'],
    answeredAt: '2026-06-02T04:00:07.000Z'
  }
]);

assert(luxuryBudgetProfile.budgetLevel === 6, '200+ budget should map to luxury budget level');
const luxuryAmapQuery = buildAmapRestaurantQuery(luxuryBudgetProfile);
assert(
  /高端餐厅|私房菜|黑珍珠|米其林|omakase|法餐|高端日料|Fine Dining/.test(luxuryAmapQuery.keywords ?? ''),
  '200+ budget should search broad premium restaurant keywords'
);
assert(
  /铁板烧|GRILL|主厨|私厨|牛排|西餐|融合料理|酒店餐厅/.test(luxuryAmapQuery.keywords ?? ''),
  '200+ budget should include nationwide high-ticket category and occasion keywords'
);
assert(/炳胜|利苑/.test(luxuryAmapQuery.keywords ?? ''), '200+ budget should keep known premium brand keywords as supplements');
assert(
  !/肯德基|麦当劳|费大厨|霸王茶姬/.test(luxuryAmapQuery.keywords ?? ''),
  '200+ budget should not search low or mid chain keywords'
);

const wideDistanceProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'distance',
    type: 'single',
    value: 'any',
    optionIds: ['distance_any'],
    answeredAt: '2026-06-02T04:00:07.500Z'
  }
]);
assert(wideDistanceProfile.maxDistanceMeters === 10000, 'distance_any should expand max distance to 10km');
assert(buildAmapRestaurantQuery(wideDistanceProfile).radiusMeters === 10000, 'AMap query should allow 10km for wide distance');

const brandLuxuryProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'budget',
    type: 'single',
    value: 'over_200',
    optionIds: ['budget_over_200'],
    answeredAt: '2026-06-02T04:00:07.000Z'
  },
  {
    questionId: 'brand_preference',
    type: 'single',
    value: 'chain',
    optionIds: ['brand_chain'],
    answeredAt: '2026-06-02T04:00:08.000Z'
  }
]);
const brandLuxuryQuery = buildAmapRestaurantQuery(brandLuxuryProfile);
assert(
  !/肯德基|麦当劳|费大厨|霸王茶姬/.test(brandLuxuryQuery.keywords ?? ''),
  '200+ chain preference should still avoid low and mid chain keywords'
);

const milkTeaProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'category_preference',
    type: 'single',
    value: 'milk_tea',
    optionIds: ['prefer_milk_tea'],
    answeredAt: '2026-06-02T04:10:00.000Z'
  }
]);

assert(milkTeaProfile.preferredTagIds.includes('milk_tea'), 'milk tea preference should map to milk_tea tag');
assert(milkTeaProfile.preferredTagIds.includes('non_meal'), 'milk tea preference should map to non_meal tag');
assert(milkTeaProfile.avoidedTagIds.includes('meal'), 'milk tea preference should avoid meal candidates');
const milkTeaKeywords = milkTeaProfile.softPreferences?.amapKeywords;
assert(
  Array.isArray(milkTeaKeywords) &&
    milkTeaKeywords.some((keyword) => keyword === '奶茶'),
  'milk tea preference should add AMap milk tea keyword'
);
const milkTeaQuery = buildAmapRestaurantQuery(milkTeaProfile);
assert(/奶茶|茶饮|霸王茶姬/.test(milkTeaQuery.keywords ?? ''), 'milk tea query should keep milk tea recall keywords');
assert(!/咖啡|甜品|蛋糕|面包|盖饭|虾饺/.test(milkTeaQuery.keywords ?? ''), 'milk tea query should not drift into coffee, dessert, or meal keywords');

const luxuryDrinkProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'meal_intent',
    type: 'single',
    value: 'drink',
    optionIds: ['intent_drink'],
    answeredAt: '2026-06-02T04:10:00.100Z'
  },
  {
    questionId: 'budget',
    type: 'single',
    value: 'over_200',
    optionIds: ['budget_over_200'],
    answeredAt: '2026-06-02T04:10:00.200Z'
  }
]);
const luxuryDrinkQuery = buildAmapRestaurantQuery(luxuryDrinkProfile);
assert(/饮品|奶茶|茶饮|咖啡/.test(luxuryDrinkQuery.keywords ?? ''), '200+ drink intent should still search drink keywords');
assert(!/omakase|Fine Dining|高端餐厅|私房菜/.test(luxuryDrinkQuery.keywords ?? ''), '200+ drink intent should not drift into premium meal keywords');

const dessertProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'meal_intent',
    type: 'single',
    value: 'dessert',
    optionIds: ['intent_dessert'],
    answeredAt: '2026-06-02T04:10:00.500Z'
  }
]);
const dessertQuery = buildAmapRestaurantQuery(dessertProfile);
assert(/甜品|蛋糕|面包|烘焙|西点/.test(dessertQuery.keywords ?? ''), 'dessert query should keep dessert recall keywords');
assert(!/盖饭|套餐|简餐/.test(dessertQuery.keywords ?? ''), 'dessert query should not drift into meal keywords');

const halalProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'dietary_restriction',
    type: 'single',
    value: 'halal',
    optionIds: ['dietary_halal'],
    answeredAt: '2026-06-02T04:10:01.000Z'
  }
]);

assert(halalProfile.preferredTagIds.includes('halal'), 'halal restriction should map to halal tag');
assert(halalProfile.avoidedTagIds.includes('pork'), 'halal restriction should avoid pork');
const halalKeywords = halalProfile.softPreferences?.amapKeywords;
assert(
  Array.isArray(halalKeywords) &&
    halalKeywords.some((keyword) => keyword === '清真'),
  'halal restriction should add halal AMap keyword'
);

const breakfastProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'time_slot',
    type: 'single',
    value: 'breakfast',
    optionIds: ['time_breakfast'],
    answeredAt: '2026-06-02T04:10:02.000Z'
  }
]);

assert(breakfastProfile.preferredTagIds.includes('breakfast'), 'breakfast should map to breakfast tag');
assert(breakfastProfile.maxEstimatedMinutes === 35, 'breakfast should tighten estimated time');

const allergyProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'dietary_restriction',
    type: 'single',
    value: 'allergy_sensitive',
    optionIds: ['dietary_allergy_sensitive'],
    answeredAt: '2026-06-02T04:10:02.500Z'
  }
]);

assert(allergyProfile.preferredTagIds.includes('allergy_sensitive'), 'allergy option should map to allergy_sensitive tag');
assert(allergyProfile.avoidedTagIds.includes('seafood'), 'allergy option should avoid seafood risk tags');
assert(allergyProfile.avoidedTagIds.includes('peanut'), 'allergy option should avoid peanut risk tags');

const nutritionProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'nutrition_goal',
    type: 'single',
    value: 'low_sugar',
    optionIds: ['nutrition_low_sugar'],
    answeredAt: '2026-06-02T04:10:02.800Z'
  }
]);

assert(nutritionProfile.preferredTagIds.includes('low_sugar'), 'nutrition goal should map low sugar tags');
assert(nutritionProfile.avoidedTagIds.includes('milk_tea'), 'low sugar nutrition goal should avoid sugary drinks');

const avoidDrinksProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'category_avoidance',
    type: 'single',
    value: 'avoid_drinks',
    optionIds: ['avoid_category_drinks'],
    answeredAt: '2026-06-02T04:10:03.000Z'
  }
]);
const avoidDrinksQuery = buildAmapRestaurantQuery(avoidDrinksProfile);

assert(avoidDrinksProfile.avoidedTagIds.includes('milk_tea'), 'avoid drinks should map milk_tea to avoided tags');
assert(!/奶茶|咖啡|甜品|饮品/.test(avoidDrinksQuery.keywords ?? ''), 'avoid drinks should remove conflicting AMap keywords');

const premiumBrandMealProfile = mapAnswersToPreferenceProfile([
  {
    questionId: 'meal_intent',
    type: 'single',
    value: 'meal',
    optionIds: ['intent_meal'],
    answeredAt: '2026-06-02T04:10:03.100Z'
  },
  {
    questionId: 'budget',
    type: 'single',
    value: 6,
    optionIds: ['budget_over_200'],
    answeredAt: '2026-06-02T04:10:03.200Z'
  },
  {
    questionId: 'brand_preference',
    type: 'single',
    value: 'chain',
    optionIds: ['brand_chain'],
    answeredAt: '2026-06-02T04:10:03.300Z'
  }
]);
const premiumBrandMealQuery = buildAmapRestaurantQuery(premiumBrandMealProfile);

assert(/高端餐厅|私房菜|黑珍珠|米其林|炳胜|利苑/.test(premiumBrandMealQuery.keywords ?? ''), 'premium brand meal query should include high-end brand recall keywords');
assert(!/奶茶|咖啡|甜品/.test(premiumBrandMealQuery.keywords ?? ''), 'premium brand meal query should not drift into non-meal keywords');

const allOptions = questions.flatMap((question) => question.options ?? []);
assert(allOptions.every((option) => Boolean(option.imageUrl || option.icon)), 'selected questions should expose imageUrl or icon on every option');
