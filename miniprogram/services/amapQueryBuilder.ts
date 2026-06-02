import type { UserPreferenceProfile } from '../types/userPreference';

export interface AmapRestaurantQuery {
  radiusMeters: number;
  keywords?: string;
  types: string;
}

const DEFAULT_RADIUS_METERS = 1500;
const AMAP_FOOD_TYPE = '050000';
const TAG_KEYWORDS: Record<string, string[]> = {
  quick: ['快餐', '简餐'],
  staple: ['盖饭', '面'],
  noodle: ['面', '粉'],
  rice: ['盖饭'],
  spicy: ['川菜', '湘菜', '麻辣烫'],
  strong_flavor: ['川菜', '湘菜', '烧烤'],
  stir_fry: ['小炒'],
  hot: ['面', '粉', '粥'],
  comfort: ['粥', '汤'],
  light: ['轻食', '粥', '粤菜'],
  healthy: ['轻食', '沙拉'],
  salad: ['沙拉'],
  low_burden: ['轻食'],
  not_spicy: ['粤菜', '日式'],
  snack: ['小吃'],
  solo: ['快餐', '简餐'],
  relaxed: ['茶餐厅', '西餐'],
  group: ['火锅', '烤肉']
};

export function buildAmapRestaurantQuery(
  preference: UserPreferenceProfile = {
    selectedOptionIds: [],
    preferredTagIds: [],
    avoidedTagIds: []
  }
): AmapRestaurantQuery {
  return {
    radiusMeters: normalizeRadius(preference.maxDistanceMeters),
    keywords: buildKeywords(preference),
    types: AMAP_FOOD_TYPE
  };
}

function normalizeRadius(maxDistanceMeters: number | undefined): number {
  const radius = maxDistanceMeters ?? DEFAULT_RADIUS_METERS;
  return Math.max(300, Math.min(5000, Math.round(radius)));
}

function buildKeywords(preference: UserPreferenceProfile): string | undefined {
  const keywords = new Set<string>();
  const softKeywords = preference.softPreferences?.amapKeywords;

  if (Array.isArray(softKeywords)) {
    softKeywords.forEach((keyword) => {
      if (typeof keyword === 'string') {
        keywords.add(keyword);
      }
    });
  }

  preference.preferredTagIds.forEach((tagId) => {
    TAG_KEYWORDS[tagId]?.forEach((keyword) => keywords.add(keyword));
  });

  preference.avoidedTagIds.forEach((tagId) => {
    TAG_KEYWORDS[tagId]?.forEach((keyword) => keywords.delete(keyword));
  });

  const rankedKeywords = [...keywords].slice(0, 4);
  return rankedKeywords.length > 0 ? rankedKeywords.join('|') : undefined;
}
