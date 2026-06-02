import type {
  PreferenceDimension,
  PreferenceOption,
  PreferenceQuestion
} from '../types/userPreference';
import type { PriceLevel, TagId } from '../types/restaurant';

export interface PreferenceOptionEffect {
  positiveTags?: TagId[];
  negativeTags?: TagId[];
  constraints?: {
    budgetLevel?: PriceLevel;
    maxDistanceMeters?: number;
    maxEstimatedMinutes?: number;
    diningMode?: 'dine_in' | 'delivery' | 'either';
  };
  softPreferences?: {
    speed?: 'fast' | 'normal' | 'slow';
    mealWeight?: 'light' | 'normal' | 'filling';
    mood?: string;
    scene?: string;
    amapKeywords?: string[];
  };
  removeNegativeTags?: TagId[];
}

export interface QuestionBankOption extends PreferenceOption {
  desc: string;
  themeClass: string;
  visual: string;
  effect?: PreferenceOptionEffect;
}

export interface QuestionBankItem extends PreferenceQuestion {
  subtitle: string;
  dimension: PreferenceDimension;
  options: QuestionBankOption[];
}

export const QUESTION_BANK_VERSION = 'v2.0-dynamic';

export const questionBank: QuestionBankItem[] = [
  {
    id: 'dining_mode',
    dimension: 'dining_mode',
    title: '堂食还是外卖？',
    subtitle: '按这顿饭的用餐方式来定候选池',
    type: 'single',
    required: true,
    options: [
      {
        id: 'dining_mode_dine_in',
        label: '堂食',
        desc: '愿意到店坐下吃，附近体验也重要',
        selected: false,
        value: 'dine_in',
        themeClass: 'theme-red',
        visual: '店',
        effect: {
          constraints: { diningMode: 'dine_in', maxEstimatedMinutes: 45 },
          positiveTags: ['relaxed']
        }
      },
      {
        id: 'dining_mode_delivery',
        label: '外卖',
        desc: '不想出门，出餐和配送速度更重要',
        selected: false,
        value: 'delivery',
        themeClass: 'theme-green',
        visual: '送',
        effect: {
          constraints: { diningMode: 'delivery', maxEstimatedMinutes: 60 },
          positiveTags: ['quick', 'solo'],
          softPreferences: { speed: 'fast', amapKeywords: ['快餐', '简餐'] }
        }
      }
    ]
  },
  {
    id: 'budget',
    dimension: 'budget',
    title: '预算大概多少？',
    subtitle: '预算用于排序和过滤，不直接限制高德候选池',
    type: 'single',
    required: true,
    options: [
      {
        id: 'budget_under_30',
        label: '30 以下',
        desc: '简单实惠，快速解决',
        selected: false,
        value: 'under_30',
        themeClass: 'theme-green',
        visual: '¥',
        effect: {
          constraints: { budgetLevel: 2 },
          positiveTags: ['quick']
        }
      },
      {
        id: 'budget_30_60',
        label: '30~60',
        desc: '正常吃一顿，选择更多',
        selected: false,
        value: '30_60',
        themeClass: 'theme-red',
        visual: '¥',
        effect: {
          constraints: { budgetLevel: 3 }
        }
      },
      {
        id: 'budget_over_60',
        label: '60 以上',
        desc: '可以吃好一点，环境和菜品优先',
        selected: false,
        value: 'over_60',
        themeClass: 'theme-green',
        visual: '¥',
        effect: {
          constraints: { budgetLevel: 4 },
          positiveTags: ['relaxed']
        }
      }
    ]
  },
  {
    id: 'distance',
    dimension: 'distance',
    title: '能接受多远？',
    subtitle: '高德候选池会优先按这个半径取附近店',
    type: 'single',
    required: true,
    options: [
      {
        id: 'distance_500m',
        label: '500 米',
        desc: '越近越好，少走几步',
        selected: false,
        value: 500,
        themeClass: 'theme-green',
        visual: '近',
        effect: {
          constraints: { maxDistanceMeters: 500, maxEstimatedMinutes: 30 }
        }
      },
      {
        id: 'distance_1km',
        label: '1 公里',
        desc: '可以稍微走一走',
        selected: false,
        value: 1000,
        themeClass: 'theme-red',
        visual: '行',
        effect: {
          constraints: { maxDistanceMeters: 1000, maxEstimatedMinutes: 40 }
        }
      },
      {
        id: 'distance_any',
        label: '远点也行',
        desc: '好吃更重要，距离放宽',
        selected: false,
        value: 'any',
        themeClass: 'theme-green',
        visual: '远',
        effect: {
          constraints: { maxDistanceMeters: 3000, maxEstimatedMinutes: 60 }
        }
      }
    ]
  },
  {
    id: 'flavor',
    dimension: 'flavor',
    title: '今天口味想偏哪边？',
    subtitle: '口味会同时影响高德关键词和最终打分',
    type: 'single',
    options: [
      {
        id: 'flavor_strong',
        label: '重口过瘾',
        desc: '麻辣、锅气、浓一点都可以',
        selected: false,
        value: 'strong',
        themeClass: 'theme-red',
        visual: '辣',
        effect: {
          positiveTags: ['spicy', 'strong_flavor', 'stir_fry'],
          removeNegativeTags: ['strong_flavor'],
          softPreferences: { amapKeywords: ['川菜', '湘菜', '麻辣烫'] }
        }
      },
      {
        id: 'flavor_light',
        label: '清淡舒服',
        desc: '少油少辣，吃完没负担',
        selected: false,
        value: 'light',
        themeClass: 'theme-green',
        visual: '清',
        effect: {
          positiveTags: ['light', 'healthy', 'not_spicy'],
          negativeTags: ['strong_flavor'],
          softPreferences: { amapKeywords: ['轻食', '粥', '粤菜'] }
        }
      }
    ]
  },
  {
    id: 'temperature',
    dimension: 'temperature',
    title: '想吃热的还是凉的？',
    subtitle: '入口温度会留给推荐算法细排',
    type: 'single',
    options: [
      {
        id: 'temperature_hot',
        label: '热乎一点',
        desc: '汤、面、锅，暖胃更满足',
        selected: false,
        value: 'hot',
        themeClass: 'theme-red',
        visual: '热',
        effect: {
          positiveTags: ['hot', 'comfort'],
          softPreferences: { amapKeywords: ['面', '粉', '粥'] }
        }
      },
      {
        id: 'temperature_cold',
        label: '清爽一点',
        desc: '沙拉、凉面、轻食都可以',
        selected: false,
        value: 'cold',
        themeClass: 'theme-green',
        visual: '凉',
        effect: {
          positiveTags: ['light', 'salad', 'low_burden'],
          softPreferences: { amapKeywords: ['轻食', '沙拉'] }
        }
      }
    ]
  },
  {
    id: 'meal_type',
    dimension: 'meal_type',
    title: '正餐还是小吃？',
    subtitle: '决定这顿饭的饱腹方向',
    type: 'single',
    options: [
      {
        id: 'meal_type_meal',
        label: '正餐',
        desc: '认真吃一顿，管饱',
        selected: false,
        value: 'meal',
        themeClass: 'theme-red',
        visual: '饭',
        effect: {
          positiveTags: ['staple', 'rice', 'noodle'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '面'] }
        }
      },
      {
        id: 'meal_type_snack',
        label: '小吃',
        desc: '轻松解馋，不用太正式',
        selected: false,
        value: 'snack',
        themeClass: 'theme-green',
        visual: '点',
        effect: {
          positiveTags: ['snack', 'quick', 'solo'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['小吃'] }
        }
      }
    ]
  },
  {
    id: 'speed',
    dimension: 'speed',
    title: '现在赶时间吗？',
    subtitle: '速度会影响候选关键词和耗时排序',
    type: 'single',
    options: [
      {
        id: 'speed_fast',
        label: '越快越好',
        desc: '出餐快，少排队，别纠结',
        selected: false,
        value: 'fast',
        themeClass: 'theme-green',
        visual: '快',
        effect: {
          positiveTags: ['quick', 'solo'],
          constraints: { maxEstimatedMinutes: 30 },
          softPreferences: { speed: 'fast', amapKeywords: ['快餐', '简餐'] }
        }
      },
      {
        id: 'speed_slow',
        label: '可以慢点',
        desc: '想坐一会儿，体验优先',
        selected: false,
        value: 'slow',
        themeClass: 'theme-red',
        visual: '慢',
        effect: {
          positiveTags: ['relaxed', 'slow'],
          softPreferences: { speed: 'slow' }
        }
      }
    ]
  },
  {
    id: 'health',
    dimension: 'health',
    title: '今天想轻负担吗？',
    subtitle: '健康偏好主要留给最终排序',
    type: 'single',
    options: [
      {
        id: 'health_light',
        label: '轻负担',
        desc: '少油、蔬菜、蛋白质多一点',
        selected: false,
        value: 'light_burden',
        themeClass: 'theme-green',
        visual: '轻',
        effect: {
          positiveTags: ['healthy', 'low_burden', 'vegetarian'],
          negativeTags: ['strong_flavor'],
          softPreferences: { amapKeywords: ['轻食', '沙拉'] }
        }
      },
      {
        id: 'health_free',
        label: '先别管',
        desc: '今天开心更重要',
        selected: false,
        value: 'free',
        themeClass: 'theme-red',
        visual: '爽',
        effect: {
          softPreferences: { mood: 'treat' }
        }
      }
    ]
  },
  {
    id: 'satiety',
    dimension: 'satiety',
    title: '需要多顶饿？',
    subtitle: '饱腹感会辅助正餐、小吃和主食排序',
    type: 'single',
    options: [
      {
        id: 'satiety_filling',
        label: '要管饱',
        desc: '主食、米饭、面都可以',
        selected: false,
        value: 'filling',
        themeClass: 'theme-red',
        visual: '饱',
        effect: {
          positiveTags: ['staple', 'rice', 'noodle'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '面'] }
        }
      },
      {
        id: 'satiety_light',
        label: '垫一下',
        desc: '吃点小的，别太撑',
        selected: false,
        value: 'light',
        themeClass: 'theme-green',
        visual: '垫',
        effect: {
          positiveTags: ['snack', 'light', 'solo'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['小吃', '轻食'] }
        }
      }
    ]
  },
  {
    id: 'avoidance',
    dimension: 'avoidance',
    title: '有什么想避开的？',
    subtitle: '排除项不进高德查询，会在最终排序扣分',
    type: 'single',
    options: [
      {
        id: 'avoidance_spicy',
        label: '不想吃辣',
        desc: '今天不要麻辣重口',
        selected: false,
        value: 'avoid_spicy',
        themeClass: 'theme-green',
        visual: '避',
        effect: {
          negativeTags: ['spicy', 'strong_flavor'],
          positiveTags: ['not_spicy', 'light']
        }
      },
      {
        id: 'avoidance_greasy',
        label: '不想油腻',
        desc: '炸物、烧烤先放一放',
        selected: false,
        value: 'avoid_greasy',
        themeClass: 'theme-green',
        visual: '清',
        effect: {
          negativeTags: ['bbq', 'strong_flavor'],
          positiveTags: ['healthy', 'light', 'low_burden']
        }
      },
      {
        id: 'avoidance_none',
        label: '没什么',
        desc: '选择面打开一点',
        selected: false,
        value: 'none',
        themeClass: 'theme-red',
        visual: '开',
        effect: {}
      }
    ]
  },
  {
    id: 'mood',
    dimension: 'mood',
    title: '今天什么心情？',
    subtitle: '情绪偏好只参与推荐排序',
    type: 'single',
    options: [
      {
        id: 'mood_comfort',
        label: '想被安慰',
        desc: '暖胃、稳定、熟悉一点',
        selected: false,
        value: 'comfort',
        themeClass: 'theme-red',
        visual: '暖',
        effect: {
          positiveTags: ['comfort', 'hot', 'stable'],
          softPreferences: { mood: 'comfort' }
        }
      },
      {
        id: 'mood_fresh',
        label: '想换口味',
        desc: '别太普通，来点新鲜感',
        selected: false,
        value: 'fresh',
        themeClass: 'theme-green',
        visual: '新',
        effect: {
          positiveTags: ['western', 'curry', 'customizable'],
          softPreferences: { mood: 'fresh' }
        }
      }
    ]
  },
  {
    id: 'scene',
    dimension: 'scene',
    title: '这顿和谁吃？',
    subtitle: '场景会影响多人、一人食和环境排序',
    type: 'single',
    options: [
      {
        id: 'scene_solo',
        label: '自己吃',
        desc: '一个人快速舒服地解决',
        selected: false,
        value: 'solo',
        themeClass: 'theme-green',
        visual: '一',
        effect: {
          positiveTags: ['solo', 'quick', 'stable'],
          softPreferences: { scene: 'solo' }
        }
      },
      {
        id: 'scene_group',
        label: '一起吃',
        desc: '适合聊天、分享、坐一会儿',
        selected: false,
        value: 'group',
        themeClass: 'theme-red',
        visual: '聚',
        effect: {
          positiveTags: ['group', 'relaxed'],
          softPreferences: { scene: 'group' }
        }
      }
    ]
  }
];

export function findQuestionOption(questionId: string, optionIds: string[] = [], value?: unknown) {
  const question = questionBank.find((item) => item.id === questionId);

  if (!question) {
    return undefined;
  }

  return question.options.find((option) => {
    return optionIds.includes(option.id) || option.value === value;
  });
}
