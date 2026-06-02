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
assert((spicyOnlyFallback.candidates[0]?.confidenceScore ?? 100) <= 42, '负向冲突匹配度不能虚高');

const noSpicyQuery = buildAmapRestaurantQuery(noSpicy);
assert(!/川菜|湘菜|麻辣烫|小面|冒菜|香锅/.test(noSpicyQuery.keywords ?? ''), '避辣时高德关键词不能包含辣味冲突词');

const selectedQuestions = selectQuestionSet({ random: () => 0.1 });
assert(selectedQuestions.length === 6, '题目选择应返回 6 题');
assert(!selectedQuestions.some((question) => question.id === 'dining_mode'), '当前 6 题不应出现堂食/外卖');
assert(selectedQuestions.some((question) => ['avoidance', 'spice_tolerance'].includes(question.id)), '6 题应覆盖负向偏好或辣度');
assert(selectedQuestions.some((question) => question.id === 'distance'), '6 题应覆盖距离');
assert(selectedQuestions.some((question) => question.id === 'budget'), '6 题应覆盖预算');
assert(
  selectedQuestions.filter((question) => ['flavor', 'health', 'satiety', 'meal_type'].includes(question.id)).length >= 2,
  '6 题应覆盖至少两个口味/健康/饱腹相关维度'
);

const optionWithoutEffect = questionBank.flatMap((question) => question.options).find((option) => !option.effect);
assert(optionWithoutEffect === undefined, '每个选项都必须有 effect');

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
