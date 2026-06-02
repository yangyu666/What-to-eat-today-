import type { UserPreferenceProfile } from '../types/userPreference';

export interface AmapRestaurantQuery {
  radiusMeters: number;
  keywords?: string;
  types: string;
  removedKeywords?: string[];
  fallbackKeywordsUsed?: boolean;
}

const DEFAULT_RADIUS_METERS = 1500;
const AMAP_FOOD_TYPE = '050000';
const SAFE_FALLBACK_KEYWORDS = ['简餐', '盖饭', '粥', '轻食', '日式'];
const TAG_KEYWORDS: Record<string, string[]> = {
  quick: ['快餐', '简餐'],
  staple: ['盖饭', '面', '套餐'],
  meal: ['盖饭', '套餐'],
  set_meal: ['套餐', '简餐'],
  noodle: ['面', '粉面'],
  rice: ['盖饭', '米饭'],
  spicy: ['川菜', '湘菜', '麻辣烫', '重庆小面'],
  strong_flavor: ['川菜', '湘菜', '麻辣香锅', '冒菜'],
  hotpot: ['火锅', '串串'],
  malatang: ['麻辣烫'],
  sichuan: ['川菜', '冒菜'],
  hunan: ['湘菜', '小炒'],
  chongqing_noodle: ['重庆小面', '小面'],
  stir_fry: ['小炒'],
  hot: ['粥', '汤', '面'],
  cold: ['轻食', '沙拉'],
  comfort: ['粥', '汤'],
  light: ['轻食', '粥', '粤菜'],
  healthy: ['轻食', '沙拉'],
  salad: ['沙拉'],
  low_burden: ['轻食', '粥'],
  fresh: ['轻食', '日式'],
  not_spicy: ['粥', '粤菜', '日式', '简餐'],
  snack: ['小吃', '包子', '煎饼'],
  solo: ['快餐', '简餐'],
  relaxed: ['茶餐厅', '西餐'],
  group: ['火锅', '烤肉'],
  bbq: ['烧烤', '烤肉'],
  fried: ['炸鸡', '汉堡']
  , dessert: ['甜品', '蛋糕', '面包'],
  milk_tea: ['奶茶', '茶饮', '饮品'],
  coffee: ['咖啡', '下午茶'],
  drink: ['饮品', '奶茶', '咖啡'],
  afternoon_tea: ['下午茶', '甜品', '咖啡'],
  breakfast: ['早餐', '粥', '包子'],
  lunch: ['简餐', '盖饭', '套餐'],
  dinner: ['简餐', '小炒', '面'],
  late_night: ['夜宵', '小吃', '粥'],
  vegetarian: ['素食', '轻食', '沙拉'],
  halal: ['清真', '兰州拉面', '牛肉面'],
  low_sugar: ['轻食', '无糖', '健康餐'],
  low_carb: ['轻食', '健身餐', '鸡胸肉'],
  high_protein: ['健身餐', '鸡胸肉', '牛肉饭'],
  non_meal: ['咖啡', '奶茶', '甜品'],
  congee: ['粥', '早餐'],
  pork: ['猪肉', '卤肉'],
  meat_heavy: ['烤肉', '烧烤', '牛排'],
  allergy_sensitive: ['轻食', '简餐', '粥'],
  preferred_category: ['简餐', '轻食'],
  avoid_category: ['轻食', '简餐']
};
const CONFLICT_KEYWORDS_BY_NEGATIVE_TAG: Record<string, string[]> = {
  spicy: ['川菜', '湘菜', '麻辣烫', '重庆小面', '小面', '冒菜', '麻辣香锅', '火锅', '串串'],
  strong_flavor: ['川菜', '湘菜', '麻辣烫', '重庆小面', '小面', '冒菜', '麻辣香锅', '烧烤'],
  hotpot: ['火锅', '串串'],
  malatang: ['麻辣烫'],
  sichuan: ['川菜', '冒菜'],
  hunan: ['湘菜'],
  chongqing_noodle: ['重庆小面', '小面'],
  maocai: ['冒菜'],
  dry_pot: ['麻辣香锅', '香锅'],
  bbq: ['烧烤', '烤肉'],
  fried: ['炸鸡', '油炸'],
  heavy: ['烧烤', '烤肉', '炸鸡', '汉堡'],
  burger: ['汉堡']
  , dessert: ['甜品', '蛋糕', '面包', '下午茶'],
  milk_tea: ['奶茶', '茶饮'],
  coffee: ['咖啡'],
  drink: ['饮品', '奶茶', '咖啡', '茶饮'],
  afternoon_tea: ['下午茶', '甜品', '咖啡', '奶茶'],
  non_meal: ['咖啡', '奶茶', '甜品', '蛋糕', '面包', '下午茶', '饮品'],
  meal: ['盖饭', '简餐', '套餐', '小炒', '快餐', '面'],
  staple: ['盖饭', '简餐', '套餐', '快餐', '面', '粥'],
  noodle: ['面', '粉面', '拉面'],
  rice: ['盖饭', '米饭'],
  set_meal: ['套餐', '简餐'],
  stir_fry: ['小炒'],
  pork: ['猪肉', '卤肉', '叉烧', '五花肉'],
  meat_heavy: ['烤肉', '烧烤', '牛排', '炸鸡', '猪肉'],
  seafood: ['海鲜', '虾', '蟹'],
  peanut: ['花生', '坚果'],
  unclear_ingredients: ['海鲜', '虾', '蟹', '花生', '坚果'],
  sweet: ['甜品', '蛋糕', '奶茶', '茶饮'],
  sugary_drink: ['奶茶', '茶饮', '饮品']
};

export function buildAmapRestaurantQuery(
  preference: UserPreferenceProfile = {
    selectedOptionIds: [],
    preferredTagIds: [],
    avoidedTagIds: []
  }
): AmapRestaurantQuery {
  const keywordResult = buildKeywords(preference);

  return {
    radiusMeters: normalizeRadius(preference.maxDistanceMeters),
    keywords: keywordResult.keywords,
    types: AMAP_FOOD_TYPE,
    removedKeywords: keywordResult.removedKeywords,
    fallbackKeywordsUsed: keywordResult.fallbackKeywordsUsed
  };
}

function normalizeRadius(maxDistanceMeters: number | undefined): number {
  const radius = maxDistanceMeters ?? DEFAULT_RADIUS_METERS;
  return Math.max(300, Math.min(5000, Math.round(radius)));
}

function buildKeywords(preference: UserPreferenceProfile) {
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

  const beforeRemovalCount = keywords.size;
  const removedKeywords = removeNegativeConflictKeywords(keywords, preference.avoidedTagIds);
  let fallbackKeywordsUsed = false;

  if (keywords.size === 0 || removedKeywords.length >= Math.max(2, beforeRemovalCount / 2)) {
    SAFE_FALLBACK_KEYWORDS.forEach((keyword) => keywords.add(keyword));
    removeNegativeConflictKeywords(keywords, preference.avoidedTagIds);
    fallbackKeywordsUsed = true;
  }

  const rankedKeywords = [...keywords].slice(0, 5);

  return {
    keywords: rankedKeywords.length > 0 ? rankedKeywords.join('|') : undefined,
    removedKeywords,
    fallbackKeywordsUsed
  };
}

function removeNegativeConflictKeywords(keywords: Set<string>, avoidedTagIds: string[]): string[] {
  const removed: string[] = [];
  const expandedAvoidedTagIds = new Set(avoidedTagIds);

  if (expandedAvoidedTagIds.has('meal')) {
    ['staple', 'noodle', 'rice', 'set_meal'].forEach((tagId) => expandedAvoidedTagIds.add(tagId));
  }

  if (expandedAvoidedTagIds.has('non_meal')) {
    ['drink', 'milk_tea', 'coffee', 'dessert', 'afternoon_tea'].forEach((tagId) =>
      expandedAvoidedTagIds.add(tagId)
    );
  }

  expandedAvoidedTagIds.forEach((tagId) => {
    CONFLICT_KEYWORDS_BY_NEGATIVE_TAG[tagId]?.forEach((keyword) => {
      if (keywords.delete(keyword)) {
        removed.push(keyword);
      }
    });
  });

  return removed;
}
