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
