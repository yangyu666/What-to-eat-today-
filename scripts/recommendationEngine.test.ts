import { mockRestaurants } from '../miniprogram/data/mockRestaurants';
import { recommendRestaurants, scoreRestaurant } from '../miniprogram/services/recommendationEngine';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const preferenceSnapshot = {
  selectedOptionIds: ['quick', 'light'],
  preferredTagIds: ['quick', 'hot', 'light', 'comfort'],
  avoidedTagIds: ['strong_flavor'],
  budgetLevel: 3 as const,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 40
};

const result = recommendRestaurants({
  restaurants: mockRestaurants,
  context: {
    preferenceSnapshot,
    excludeRestaurantIds: ['r-cantonese-congee']
  },
  limit: 3,
  now: new Date('2026-05-30T12:00:00.000Z'),
  random: () => 0
});

assert(result.source === 'mock', 'recommendation source should be mock');
assert(result.candidates.length > 0 && result.candidates.length <= 3, 'should return up to three candidates');
assert(
  result.candidates.every((candidate) => candidate.restaurantId !== 'r-closed-bbq'),
  'closed restaurants should be hard filtered'
);
assert(
  result.candidates.every((candidate) => candidate.restaurantId !== 'r-cantonese-congee'),
  'excluded restaurants should be hard filtered'
);
assert(
  result.candidates.every((candidate) => {
    return candidate.confidenceScore !== undefined && candidate.confidenceScore >= 0 && candidate.confidenceScore <= 100;
  }),
  'confidence score should be present and normalized'
);

const spicyRestaurant = mockRestaurants.find((restaurant) => restaurant.id === 'r-hunan-rice');
assert(spicyRestaurant !== undefined, 'mock spicy restaurant should exist');

const spicyScore = scoreRestaurant(spicyRestaurant, preferenceSnapshot);
assert(
  spicyScore.breakdown.negativePreferencePenalty > 0,
  'negative preference tags should reduce the score'
);
