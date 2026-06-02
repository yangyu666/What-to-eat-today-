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
assert(strongMatchResult.algorithmVersion === 'recommendation-v2', '结果应暴露 algorithmVersion');
assert(strongMatchResult.weightProfileId !== undefined, '结果应暴露 weightProfileId');
assert(strongMatchResult.experimentId !== undefined, '结果应暴露 experimentId');
assert(strongMatchResult.candidatePoolStats !== undefined, '结果应暴露 candidatePoolStats');
assert(observableCandidate?.algorithmVersion === 'recommendation-v2', '候选应暴露 algorithmVersion');
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
assert(selectedQuestions.some((question) => ['avoidance', 'spice_tolerance'].includes(question.id)), '6 题应覆盖负向偏好或辣度');
assert(selectedQuestions.some((question) => question.id === 'distance'), '6 题应覆盖距离');
assert(selectedQuestions.some((question) => question.id === 'budget'), '6 题应覆盖预算');
assert(
  selectedQuestions.filter((question) => ['flavor', 'health', 'satiety', 'meal_type'].includes(question.id)).length >= 2,
  '6 题应覆盖至少两个口味/健康/饱腹相关维度'
);

const optionWithoutEffect = questionBank.flatMap((question) => question.options).find((option) => !option.effect);
assert(optionWithoutEffect === undefined, '每个选项都必须有 effect');

const optionWithoutImageOrIcon = questionBank
  .flatMap((question) => question.options)
  .find((option) => !option.imageUrl || !option.icon);
assert(optionWithoutImageOrIcon === undefined, '每个选项都必须有 imageUrl 和 icon');

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
