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
  icon: string;
  imageUrl: string;
  effect: PreferenceOptionEffect;
}

export interface QuestionBankItem extends PreferenceQuestion {
  subtitle: string;
  dimension: PreferenceDimension;
  options: QuestionBankOption[];
}

export const QUESTION_BANK_VERSION = 'v2.2-breadth';

export const QUESTION_OPTION_IMAGES = {
  diningDineIn: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=360&q=80',
  diningDelivery: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=360&q=80',
  budgetLow: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=360&q=80',
  budgetMid: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=360&q=80',
  budgetHigh: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=360&q=80',
  distanceNear: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=360&q=80',
  distanceWalk: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=360&q=80',
  distanceAny: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=360&q=80',
  flavorStrong: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
  flavorLight: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  temperatureHot: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=360&q=80',
  temperatureCold: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=360&q=80',
  mealMain: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  mealSnack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80',
  speedFast: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=360&q=80',
  speedSlow: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=360&q=80',
  healthLight: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=360&q=80',
  healthFree: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=360&q=80',
  satietyFilling: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  satietyLight: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=360&q=80',
  avoidanceSpicy: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=360&q=80',
  avoidanceGreasy: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  avoidanceNone: 'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=360&q=80',
  spiceNo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  spiceMild: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=360&q=80',
  spiceYes: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
  avoidHeavy: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=360&q=80',
  avoidCold: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=360&q=80',
  moodComfort: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=360&q=80',
  moodFresh: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=360&q=80',
  sceneSolo: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=360&q=80',
  sceneGroup: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=360&q=80',
  intentDrink: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=360&q=80',
  intentDessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=360&q=80',
  intentMeal: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  dietaryVegetarian: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=360&q=80',
  dietaryHalal: 'https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=360&q=80',
  dietaryLowSugar: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=360&q=80',
  dietaryProtein: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=360&q=80',
  timeBreakfast: 'https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?auto=format&fit=crop&w=360&q=80',
  timeAfternoonTea: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=360&q=80',
  timeLateNight: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=360&q=80',
  avoidDrinks: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=360&q=80',
  avoidMeal: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=360&q=80',
  preferCoffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=360&q=80',
  preferMilkTea: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=360&q=80',
  preferBakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=360&q=80',
  preferHalal: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=360&q=80'
} as const;

export const questionBank: QuestionBankItem[] = [
  {
    id: 'avoidance',
    dimension: 'avoidance',
    title: '今天有什么不想吃？',
    subtitle: '明确避开的内容会优先过滤，避免推荐踩雷',
    type: 'single',
    required: true,
    options: [
      {
        id: 'avoidance_spicy',
        label: '不想吃辣',
        desc: '避开小面、麻辣烫、川湘、冒菜、香锅',
        selected: false,
        value: 'avoid_spicy',
        themeClass: 'theme-green',
        visual: '避',
        icon: '避',
        imageUrl: QUESTION_OPTION_IMAGES.avoidanceSpicy,
        effect: {
          positiveTags: ['not_spicy', 'light'],
          negativeTags: [
            'spicy',
            'strong_flavor',
            'hotpot',
            'malatang',
            'sichuan',
            'hunan',
            'chongqing_noodle',
            'maocai',
            'dry_pot'
          ],
          softPreferences: { amapKeywords: ['粥', '轻食', '日式', '盖饭'] }
        }
      },
      {
        id: 'avoidance_greasy',
        label: '不想油腻',
        desc: '炸鸡、烧烤、汉堡和重油菜先放一边',
        selected: false,
        value: 'avoid_greasy',
        themeClass: 'theme-green',
        visual: '清',
        icon: '清',
        imageUrl: QUESTION_OPTION_IMAGES.avoidanceGreasy,
        effect: {
          positiveTags: ['healthy', 'light', 'low_burden', 'fresh'],
          negativeTags: ['bbq', 'fried', 'heavy', 'strong_flavor', 'burger'],
          softPreferences: { amapKeywords: ['轻食', '粥', '沙拉'] }
        }
      },
      {
        id: 'avoidance_none',
        label: '没有特别避开',
        desc: '选择面可以打开一点',
        selected: false,
        value: 'none',
        themeClass: 'theme-red',
        visual: '开',
        icon: '开',
        imageUrl: QUESTION_OPTION_IMAGES.avoidanceNone,
        effect: {}
      }
    ]
  },
  {
    id: 'spice_tolerance',
    dimension: 'flavor',
    title: '今天能接受辣吗？',
    subtitle: '避辣会强影响高德关键词和最终排序',
    type: 'single',
    required: true,
    options: [
      {
        id: 'spice_no',
        label: '完全不想辣',
        desc: '不推荐小面、麻辣烫、川湘、冒菜、香锅',
        selected: false,
        value: 'no_spicy',
        themeClass: 'theme-green',
        visual: '淡',
        icon: '淡',
        imageUrl: QUESTION_OPTION_IMAGES.spiceNo,
        effect: {
          positiveTags: ['not_spicy', 'light', 'congee'],
          negativeTags: [
            'spicy',
            'strong_flavor',
            'hotpot',
            'malatang',
            'sichuan',
            'hunan',
            'chongqing_noodle',
            'maocai',
            'dry_pot'
          ],
          softPreferences: { amapKeywords: ['粥', '轻食', '日式', '简餐'] }
        }
      },
      {
        id: 'spice_mild',
        label: '微辣可以',
        desc: '可以有一点味道，但不想太重',
        selected: false,
        value: 'mild',
        themeClass: 'theme-red',
        visual: '微',
        icon: '微',
        imageUrl: QUESTION_OPTION_IMAGES.spiceMild,
        effect: {
          positiveTags: ['fresh', 'comfort'],
          negativeTags: ['strong_flavor', 'hotpot', 'malatang']
        }
      },
      {
        id: 'spice_yes',
        label: '辣一点也行',
        desc: '川湘、小炒、麻辣都可以参与推荐',
        selected: false,
        value: 'spicy_ok',
        themeClass: 'theme-red',
        visual: '辣',
        icon: '辣',
        imageUrl: QUESTION_OPTION_IMAGES.spiceYes,
        effect: {
          positiveTags: ['spicy', 'strong_flavor', 'hunan', 'sichuan'],
          removeNegativeTags: ['spicy', 'strong_flavor'],
          softPreferences: { amapKeywords: ['川菜', '湘菜', '小炒'] }
        }
      }
    ]
  },
  {
    id: 'distance',
    dimension: 'distance',
    title: '能接受多远？',
    subtitle: '默认过滤超出距离的真实结果，候选不足才放宽',
    type: 'single',
    required: true,
    options: [
      {
        id: 'distance_500m',
        label: '500 米内',
        desc: '越近越好，少走几步',
        selected: false,
        value: 500,
        themeClass: 'theme-green',
        visual: '近',
        icon: '近',
        imageUrl: QUESTION_OPTION_IMAGES.distanceNear,
        effect: {
          constraints: { maxDistanceMeters: 500, maxEstimatedMinutes: 30 }
        }
      },
      {
        id: 'distance_1km',
        label: '1 公里内',
        desc: '可以稍微走一走',
        selected: false,
        value: 1000,
        themeClass: 'theme-red',
        visual: '行',
        icon: '行',
        imageUrl: QUESTION_OPTION_IMAGES.distanceWalk,
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
        icon: '远',
        imageUrl: QUESTION_OPTION_IMAGES.distanceAny,
        effect: {
          constraints: { maxDistanceMeters: 3000, maxEstimatedMinutes: 60 }
        }
      }
    ]
  },
  {
    id: 'budget',
    dimension: 'budget',
    title: '预算大概多少？',
    subtitle: '明显超预算会被过滤，未知人均只给中性分',
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
        icon: '¥',
        imageUrl: QUESTION_OPTION_IMAGES.budgetLow,
        effect: {
          constraints: { budgetLevel: 2 },
          positiveTags: ['quick', 'snack']
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
        icon: '¥',
        imageUrl: QUESTION_OPTION_IMAGES.budgetMid,
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
        icon: '¥',
        imageUrl: QUESTION_OPTION_IMAGES.budgetHigh,
        effect: {
          constraints: { budgetLevel: 4 },
          positiveTags: ['relaxed', 'slow']
        }
      }
    ]
  },
  {
    id: 'flavor',
    dimension: 'flavor',
    title: '今天想清爽一点还是过瘾一点？',
    subtitle: '口味会影响关键词、负向惩罚和最终排序',
    type: 'single',
    options: [
      {
        id: 'flavor_light',
        label: '清淡舒服',
        desc: '少油少辣，吃完没负担',
        selected: false,
        value: 'light',
        themeClass: 'theme-green',
        visual: '清',
        icon: '清',
        imageUrl: QUESTION_OPTION_IMAGES.flavorLight,
        effect: {
          positiveTags: ['light', 'healthy', 'not_spicy', 'low_burden'],
          negativeTags: ['strong_flavor', 'spicy', 'bbq', 'fried'],
          softPreferences: { amapKeywords: ['轻食', '粥', '粤菜', '日式'] }
        }
      },
      {
        id: 'flavor_strong',
        label: '重口过瘾',
        desc: '锅气、香辣、浓一点都可以',
        selected: false,
        value: 'strong',
        themeClass: 'theme-red',
        visual: '辣',
        icon: '辣',
        imageUrl: QUESTION_OPTION_IMAGES.flavorStrong,
        effect: {
          positiveTags: ['spicy', 'strong_flavor', 'stir_fry'],
          removeNegativeTags: ['spicy', 'strong_flavor'],
          softPreferences: { amapKeywords: ['川菜', '湘菜', '小炒'] }
        }
      }
    ]
  },
  {
    id: 'health',
    dimension: 'health',
    title: '今天想轻负担吗？',
    subtitle: '健康偏好会显著提高轻食、粥、沙拉权重',
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
        icon: '轻',
        imageUrl: QUESTION_OPTION_IMAGES.healthLight,
        effect: {
          positiveTags: ['healthy', 'low_burden', 'light', 'fresh', 'salad'],
          negativeTags: ['strong_flavor', 'spicy', 'bbq', 'fried', 'heavy'],
          softPreferences: { amapKeywords: ['轻食', '沙拉', '粥'] }
        }
      },
      {
        id: 'health_free',
        label: '先别管',
        desc: '今天开心更重要',
        selected: false,
        value: 'free',
        themeClass: 'theme-red',
        visual: '放',
        icon: '放',
        imageUrl: QUESTION_OPTION_IMAGES.healthFree,
        effect: {
          softPreferences: { mood: 'treat' }
        }
      }
    ]
  },
  {
    id: 'satiety',
    dimension: 'satiety',
    title: '需要多顶饱？',
    subtitle: '饱腹感会辅助正餐、小吃和主食排序',
    type: 'single',
    options: [
      {
        id: 'satiety_filling',
        label: '要管饱',
        desc: '主食、米饭、面、套餐都可以',
        selected: false,
        value: 'filling',
        themeClass: 'theme-red',
        visual: '饱',
        icon: '饱',
        imageUrl: QUESTION_OPTION_IMAGES.satietyFilling,
        effect: {
          positiveTags: ['staple', 'rice', 'noodle', 'meal', 'set_meal'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '面', '套餐'] }
        }
      },
      {
        id: 'satiety_light',
        label: '垫一垫',
        desc: '吃点小的，别太撑',
        selected: false,
        value: 'light',
        themeClass: 'theme-green',
        visual: '垫',
        icon: '垫',
        imageUrl: QUESTION_OPTION_IMAGES.satietyLight,
        effect: {
          positiveTags: ['snack', 'light', 'solo'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['小吃', '轻食'] }
        }
      }
    ]
  },
  {
    id: 'meal_type',
    dimension: 'meal_type',
    title: '正餐还是小吃？',
    subtitle: '决定这一餐的饱腹方向',
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
        icon: '饭',
        imageUrl: QUESTION_OPTION_IMAGES.mealMain,
        effect: {
          positiveTags: ['staple', 'rice', 'noodle', 'meal', 'set_meal'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '面', '套餐'] }
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
        icon: '点',
        imageUrl: QUESTION_OPTION_IMAGES.mealSnack,
        effect: {
          positiveTags: ['snack', 'quick', 'solo'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['小吃', '包子', '煎饼'] }
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
        desc: '汤、面、粥，暖胃更满足',
        selected: false,
        value: 'hot',
        themeClass: 'theme-red',
        visual: '热',
        icon: '热',
        imageUrl: QUESTION_OPTION_IMAGES.temperatureHot,
        effect: {
          positiveTags: ['hot', 'comfort', 'congee'],
          softPreferences: { amapKeywords: ['粥', '汤', '面'] }
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
        icon: '凉',
        imageUrl: QUESTION_OPTION_IMAGES.temperatureCold,
        effect: {
          positiveTags: ['cold', 'light', 'salad', 'fresh', 'low_burden'],
          softPreferences: { amapKeywords: ['轻食', '沙拉'] }
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
        icon: '快',
        imageUrl: QUESTION_OPTION_IMAGES.speedFast,
        effect: {
          positiveTags: ['quick', 'solo', 'snack'],
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
        icon: '慢',
        imageUrl: QUESTION_OPTION_IMAGES.speedSlow,
        effect: {
          positiveTags: ['relaxed', 'slow'],
          softPreferences: { speed: 'slow' }
        }
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
        icon: '暖',
        imageUrl: QUESTION_OPTION_IMAGES.moodComfort,
        effect: {
          positiveTags: ['comfort', 'hot', 'stable', 'congee'],
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
        icon: '新',
        imageUrl: QUESTION_OPTION_IMAGES.moodFresh,
        effect: {
          positiveTags: ['fresh', 'western', 'curry', 'customizable'],
          softPreferences: { mood: 'fresh' }
        }
      }
    ]
  },
  {
    id: 'scene',
    dimension: 'scene',
    title: '这一餐和谁吃？',
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
        icon: '一',
        imageUrl: QUESTION_OPTION_IMAGES.sceneSolo,
        effect: {
          positiveTags: ['solo', 'quick', 'stable', 'snack'],
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
        icon: '聚',
        imageUrl: QUESTION_OPTION_IMAGES.sceneGroup,
        effect: {
          positiveTags: ['group', 'relaxed'],
          softPreferences: { scene: 'group' }
        }
      }
    ]
  },
  {
    id: 'meal_intent',
    dimension: 'meal_intent',
    title: '这顿想吃正餐还是喝点/甜点？',
    subtitle: '先区分正餐和非正餐，避免奶茶咖啡甜品与盖饭炒菜互相抢位',
    type: 'single',
    options: [
      {
        id: 'intent_meal',
        label: '认真吃顿饭',
        desc: '盖饭、套餐、面、粥这类能顶饱的方向',
        selected: false,
        value: 'meal',
        themeClass: 'theme-red',
        visual: 'meal',
        icon: 'meal',
        imageUrl: QUESTION_OPTION_IMAGES.intentMeal,
        effect: {
          positiveTags: ['meal', 'staple', 'rice', 'noodle', 'set_meal'],
          negativeTags: ['non_meal', 'drink', 'coffee', 'milk_tea', 'dessert'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '简餐', '套餐', '面'] }
        }
      },
      {
        id: 'intent_drink',
        label: '喝点东西',
        desc: '咖啡、奶茶、饮品优先，不被正餐压过去',
        selected: false,
        value: 'drink',
        themeClass: 'theme-green',
        visual: 'drink',
        icon: 'cup',
        imageUrl: QUESTION_OPTION_IMAGES.intentDrink,
        effect: {
          positiveTags: ['drink', 'coffee', 'milk_tea', 'non_meal', 'afternoon_tea'],
          negativeTags: ['meal', 'set_meal', 'rice', 'hotpot', 'stir_fry'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['咖啡', '奶茶', '饮品'] }
        }
      },
      {
        id: 'intent_dessert',
        label: '甜点下午茶',
        desc: '甜品、面包、蛋糕、下午茶优先',
        selected: false,
        value: 'dessert',
        themeClass: 'theme-green',
        visual: 'sweet',
        icon: 'cake',
        imageUrl: QUESTION_OPTION_IMAGES.intentDessert,
        effect: {
          positiveTags: ['dessert', 'afternoon_tea', 'non_meal', 'drink'],
          negativeTags: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['甜品', '面包', '下午茶'] }
        }
      }
    ]
  },
  {
    id: 'dietary_restriction',
    dimension: 'dietary_restriction',
    title: '有没有饮食限制？',
    subtitle: '素食、清真、控糖和高蛋白会进入强约束或高权重惩罚',
    type: 'single',
    options: [
      {
        id: 'dietary_none',
        label: '没有限制',
        desc: '正常按口味、距离、预算来推荐',
        selected: false,
        value: 'none',
        themeClass: 'theme-red',
        visual: 'open',
        icon: 'ok',
        imageUrl: QUESTION_OPTION_IMAGES.avoidanceNone,
        effect: {}
      },
      {
        id: 'dietary_vegetarian',
        label: '素食优先',
        desc: '避开烧烤、重肉、猪肉和明显荤菜',
        selected: false,
        value: 'vegetarian',
        themeClass: 'theme-green',
        visual: 'veg',
        icon: 'leaf',
        imageUrl: QUESTION_OPTION_IMAGES.dietaryVegetarian,
        effect: {
          positiveTags: ['vegetarian', 'healthy', 'light'],
          negativeTags: ['bbq', 'meat_heavy', 'pork', 'fried', 'heavy'],
          softPreferences: { amapKeywords: ['素食', '轻食', '沙拉'] }
        }
      },
      {
        id: 'dietary_halal',
        label: '清真',
        desc: '清真、兰州拉面、牛肉面优先，猪肉相关强避开',
        selected: false,
        value: 'halal',
        themeClass: 'theme-green',
        visual: 'halal',
        icon: 'halal',
        imageUrl: QUESTION_OPTION_IMAGES.dietaryHalal,
        effect: {
          positiveTags: ['halal', 'high_protein'],
          negativeTags: ['pork', 'meat_heavy'],
          softPreferences: { amapKeywords: ['清真', '兰州拉面', '牛肉面'] }
        }
      },
      {
        id: 'dietary_low_sugar',
        label: '无糖/控糖',
        desc: '轻食健康餐优先，奶茶甜品高糖方向强降权',
        selected: false,
        value: 'low_sugar',
        themeClass: 'theme-green',
        visual: 'lowSugar',
        icon: '0sugar',
        imageUrl: QUESTION_OPTION_IMAGES.dietaryLowSugar,
        effect: {
          positiveTags: ['low_sugar', 'healthy', 'low_burden'],
          negativeTags: ['dessert', 'milk_tea', 'sweet', 'sugary_drink'],
          softPreferences: { amapKeywords: ['轻食', '无糖', '健康餐'] }
        }
      },
      {
        id: 'dietary_allergy_sensitive',
        label: '过敏/忌口',
        desc: '优先配料清楚、可定制，避开海鲜花生等常见高风险',
        selected: false,
        value: 'allergy_sensitive',
        themeClass: 'theme-green',
        visual: 'safe',
        icon: 'safe',
        imageUrl: QUESTION_OPTION_IMAGES.dietaryLowSugar,
        effect: {
          positiveTags: ['allergy_sensitive', 'light', 'customizable'],
          negativeTags: ['seafood', 'peanut', 'unclear_ingredients', 'spicy', 'strong_flavor'],
          softPreferences: { amapKeywords: ['轻食', '简餐', '粥'] }
        }
      },
      {
        id: 'dietary_high_protein',
        label: '高蛋白',
        desc: '健身餐、鸡胸肉、牛肉饭、轻食优先',
        selected: false,
        value: 'high_protein',
        themeClass: 'theme-green',
        visual: 'protein',
        icon: 'protein',
        imageUrl: QUESTION_OPTION_IMAGES.dietaryProtein,
        effect: {
          positiveTags: ['high_protein', 'healthy', 'low_carb'],
          negativeTags: ['dessert', 'milk_tea', 'sweet'],
          softPreferences: { amapKeywords: ['健身餐', '鸡胸肉', '牛肉饭', '轻食'] }
        }
      }
    ]
  },
  {
    id: 'time_slot',
    dimension: 'time_slot',
    title: '现在更像哪种时段？',
    subtitle: '早餐、午晚餐、夜宵和下午茶会影响关键词与排序',
    type: 'single',
    options: [
      {
        id: 'time_breakfast',
        label: '早餐',
        desc: '粥、包子、面、早餐店这类热乎快速的方向',
        selected: false,
        value: 'breakfast',
        themeClass: 'theme-green',
        visual: 'am',
        icon: 'sun',
        imageUrl: QUESTION_OPTION_IMAGES.timeBreakfast,
        effect: {
          positiveTags: ['breakfast', 'congee', 'noodle', 'staple', 'hot', 'quick'],
          constraints: { maxEstimatedMinutes: 35 },
          softPreferences: { speed: 'fast', amapKeywords: ['早餐', '粥', '包子', '面'] }
        }
      },
      {
        id: 'time_lunch',
        label: '午餐',
        desc: '简餐、盖饭、套餐，稳定解决一顿',
        selected: false,
        value: 'lunch',
        themeClass: 'theme-red',
        visual: 'noon',
        icon: 'lunch',
        imageUrl: QUESTION_OPTION_IMAGES.intentMeal,
        effect: {
          positiveTags: ['lunch', 'meal', 'rice', 'set_meal', 'quick'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['简餐', '盖饭', '套餐'] }
        }
      },
      {
        id: 'time_dinner',
        label: '晚餐',
        desc: '正餐优先，可以稍微放松一点',
        selected: false,
        value: 'dinner',
        themeClass: 'theme-red',
        visual: 'pm',
        icon: 'dinner',
        imageUrl: QUESTION_OPTION_IMAGES.intentMeal,
        effect: {
          positiveTags: ['dinner', 'meal', 'rice', 'noodle', 'relaxed'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['简餐', '小炒', '面'] }
        }
      },
      {
        id: 'time_late_night',
        label: '夜宵',
        desc: '快、热、小吃优先，别太折腾',
        selected: false,
        value: 'late_night',
        themeClass: 'theme-red',
        visual: 'night',
        icon: 'moon',
        imageUrl: QUESTION_OPTION_IMAGES.timeLateNight,
        effect: {
          positiveTags: ['late_night', 'quick', 'hot', 'snack'],
          constraints: { maxEstimatedMinutes: 35 },
          softPreferences: { speed: 'fast', mealWeight: 'light', amapKeywords: ['夜宵', '小吃', '粥', '面'] }
        }
      },
      {
        id: 'time_afternoon_tea',
        label: '下午茶',
        desc: '咖啡、甜品、奶茶、面包优先',
        selected: false,
        value: 'afternoon_tea',
        themeClass: 'theme-green',
        visual: 'tea',
        icon: 'tea',
        imageUrl: QUESTION_OPTION_IMAGES.timeAfternoonTea,
        effect: {
          positiveTags: ['afternoon_tea', 'dessert', 'coffee', 'drink', 'non_meal'],
          negativeTags: ['meal', 'rice', 'hotpot'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['下午茶', '咖啡', '甜品', '奶茶'] }
        }
      }
    ]
  },
  {
    id: 'category_avoidance',
    dimension: 'category_avoidance',
    title: '有没有特别想避开的品类？',
    subtitle: '明确避开的品类不会主动进入高德关键词，也会影响最终排序',
    type: 'single',
    options: [
      {
        id: 'avoid_category_none',
        label: '没有',
        desc: '不额外限制品类',
        selected: false,
        value: 'none',
        themeClass: 'theme-red',
        visual: 'open',
        icon: 'ok',
        imageUrl: QUESTION_OPTION_IMAGES.avoidanceNone,
        effect: {}
      },
      {
        id: 'avoid_category_drinks',
        label: '不要喝的甜的',
        desc: '避开奶茶、咖啡、饮品、甜品等非正餐',
        selected: false,
        value: 'avoid_drinks',
        themeClass: 'theme-green',
        visual: 'noDrink',
        icon: 'noCup',
        imageUrl: QUESTION_OPTION_IMAGES.avoidDrinks,
        effect: {
          positiveTags: ['meal', 'staple'],
          negativeTags: ['drink', 'milk_tea', 'coffee', 'dessert', 'non_meal', 'sweet', 'sugary_drink'],
          softPreferences: { mealWeight: 'filling', amapKeywords: ['盖饭', '简餐', '套餐'] }
        }
      },
      {
        id: 'avoid_category_heavy_meal',
        label: '不要大正餐',
        desc: '避开火锅、小炒、盖饭套餐，轻一点就好',
        selected: false,
        value: 'avoid_heavy_meal',
        themeClass: 'theme-green',
        visual: 'lightOnly',
        icon: 'light',
        imageUrl: QUESTION_OPTION_IMAGES.avoidMeal,
        effect: {
          positiveTags: ['snack', 'light', 'non_meal'],
          negativeTags: ['meal', 'rice', 'set_meal', 'hotpot', 'stir_fry'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['小吃', '轻食', '咖啡'] }
        }
      },
      {
        id: 'avoid_category_pork',
        label: '不要猪肉',
        desc: '猪肉、卤肉、叉烧、五花肉方向强避开',
        selected: false,
        value: 'avoid_pork',
        themeClass: 'theme-green',
        visual: 'noPork',
        icon: 'noPork',
        imageUrl: QUESTION_OPTION_IMAGES.preferHalal,
        effect: {
          positiveTags: ['halal'],
          negativeTags: ['pork', 'meat_heavy'],
          softPreferences: { amapKeywords: ['清真', '牛肉面'] }
        }
      }
    ]
  },
  {
    id: 'category_preference',
    dimension: 'category_preference',
    title: '有没有特别想要的品类？',
    subtitle: '偏好品类会进入高德关键词和推荐排序，但仍受预算/距离/忌口限制',
    type: 'single',
    options: [
      {
        id: 'prefer_milk_tea',
        label: '奶茶饮品',
        desc: '奶茶、茶饮、饮品优先',
        selected: false,
        value: 'milk_tea',
        themeClass: 'theme-green',
        visual: 'milkTea',
        icon: 'cup',
        imageUrl: QUESTION_OPTION_IMAGES.preferMilkTea,
        effect: {
          positiveTags: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea'],
          negativeTags: ['meal', 'rice', 'set_meal'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['奶茶', '饮品'] }
        }
      },
      {
        id: 'prefer_coffee',
        label: '咖啡',
        desc: '咖啡店、下午茶方向优先',
        selected: false,
        value: 'coffee',
        themeClass: 'theme-green',
        visual: 'coffee',
        icon: 'coffee',
        imageUrl: QUESTION_OPTION_IMAGES.preferCoffee,
        effect: {
          positiveTags: ['coffee', 'drink', 'non_meal', 'afternoon_tea'],
          negativeTags: ['meal', 'rice', 'set_meal'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['咖啡', '下午茶'] }
        }
      },
      {
        id: 'prefer_bakery_dessert',
        label: '甜品面包',
        desc: '甜品、面包、蛋糕、烘焙优先',
        selected: false,
        value: 'bakery_dessert',
        themeClass: 'theme-green',
        visual: 'bakery',
        icon: 'cake',
        imageUrl: QUESTION_OPTION_IMAGES.preferBakery,
        effect: {
          positiveTags: ['dessert', 'afternoon_tea', 'non_meal'],
          negativeTags: ['meal', 'rice', 'hotpot'],
          softPreferences: { mealWeight: 'light', amapKeywords: ['甜品', '面包', '蛋糕'] }
        }
      },
      {
        id: 'prefer_halal_noodle',
        label: '清真/牛肉面',
        desc: '清真、兰州拉面、牛肉面优先',
        selected: false,
        value: 'halal_noodle',
        themeClass: 'theme-green',
        visual: 'halal',
        icon: 'halal',
        imageUrl: QUESTION_OPTION_IMAGES.preferHalal,
        effect: {
          positiveTags: ['halal', 'noodle', 'hot', 'high_protein'],
          negativeTags: ['pork'],
          softPreferences: { amapKeywords: ['清真', '兰州拉面', '牛肉面'] }
        }
      }
    ]
  },
  {
    id: 'dining_mode',
    dimension: 'dining_mode',
    title: '堂食还是外卖？',
    subtitle: '暂时保留数据，不进入当前 6 题选择',
    type: 'single',
    required: true,
    options: [
      {
        id: 'dining_mode_dine_in',
        label: '堂食',
        desc: '愿意到店坐下吃',
        selected: false,
        value: 'dine_in',
        themeClass: 'theme-red',
        visual: '店',
        icon: '店',
        imageUrl: QUESTION_OPTION_IMAGES.diningDineIn,
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
        icon: '送',
        imageUrl: QUESTION_OPTION_IMAGES.diningDelivery,
        effect: {
          constraints: { diningMode: 'delivery', maxEstimatedMinutes: 60 },
          positiveTags: ['quick', 'solo'],
          softPreferences: { speed: 'fast', amapKeywords: ['快餐', '简餐'] }
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
