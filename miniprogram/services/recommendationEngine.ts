import type { Restaurant, RestaurantId, TagId } from '../types/restaurant';
import type {
  CandidatePoolStats,
  RecommendationAlgorithmVersion,
  RecommendationCandidate,
  RecommendationConfidenceLabel,
  RecommendationResult,
  RecommendationScoreBreakdown,
  RecommendationSource
} from '../types/recommendation';
import type { UserPreferenceProfile } from '../types/userPreference';

export interface RecommendationEngineContext {
  preferenceSnapshot?: UserPreferenceProfile;
  excludeRestaurantIds?: RestaurantId[];
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
  experimentId?: string;
}

export interface RecommendationEngineOptions {
  restaurants: Restaurant[];
  context?: RecommendationEngineContext;
  limit?: number;
  now?: Date;
  random?: () => number;
  source?: RecommendationSource;
}

export interface HardFilterResult {
  passed: boolean;
  reasons: string[];
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  confidenceScore: number;
  confidenceLabel: RecommendationConfidenceLabel;
  breakdown: RecommendationScoreBreakdown;
  reasons: string[];
  hardFilterReasons: string[];
  penaltyReasons: string[];
  matchedPreferredTagIds: TagId[];
  matchedAvoidedTagIds: TagId[];
  fallbackReason?: string;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
}

interface ScoreOptions {
  fallbackReason?: string;
  relativeLeadScore?: number;
  candidatePoolWeak?: boolean;
  confidenceCap?: number;
  finalScoreCap?: number;
  historyFilterEnabled?: boolean;
  excludedHistoryRestaurantIds?: RestaurantId[];
  historyPenaltyRestaurantIds?: RestaurantId[];
  historyPenaltyReasons?: string[];
}

const DEFAULT_LIMIT = 3;
const MIN_PRIMARY_POOL_SIZE = 3;
const MAX_SCORE = 100;
const MIN_SCORE = 0;
export const ALGORITHM_VERSION: RecommendationAlgorithmVersion = 'recommendation-v3.0';
export const WEIGHT_PROFILE_ID = 'poi-strategy-v3.0';
export const DEFAULT_EXPERIMENT_ID = 'default';

const BUDGET_LEVEL_TO_YUAN: Record<number, number> = {
  1: 20,
  2: 30,
  3: 60,
  4: 100,
  5: 200,
  6: 320
};

const BUDGET_LEVEL_TO_RANGE: Record<number, { min?: number; max: number }> = {
  1: { max: 20 },
  2: { max: 30 },
  3: { min: 30, max: 60 },
  4: { min: 60, max: 100 },
  5: { min: 100, max: 200 },
  6: { min: 200, max: 9999 }
};

const TAG_WEIGHTS: Record<string, number> = {
  light: 14,
  healthy: 12,
  low_burden: 12,
  not_spicy: 12,
  salad: 10,
  congee: 10,
  fresh: 9,
  hot: 8,
  cold: 8,
  comfort: 8,
  staple: 11,
  rice: 10,
  noodle: 10,
  meal: 10,
  set_meal: 10,
  snack: 12,
  quick: 11,
  fast_service: 11,
  low_queue: 10,
  solo: 8,
  slow: 5,
  spicy: 8,
  strong_flavor: 7,
  dessert: 12,
  milk_tea: 12,
  coffee: 12,
  drink: 11,
  afternoon_tea: 11,
  breakfast: 12,
  lunch: 9,
  dinner: 9,
  late_night: 12,
  vegetarian: 16,
  halal: 16,
  allergy_sensitive: 16,
  low_sugar: 15,
  low_carb: 13,
  high_protein: 15,
  non_meal: 12,
  pork: 6,
  meat_heavy: 7,
  seafood: 6,
  peanut: 6,
  unclear_ingredients: 6,
  sweet: 6,
  sugary_drink: 6,
  chain_brand: 12,
  low_chain: 8,
  mid_chain: 12,
  premium_brand: 15,
  independent_store: 10,
  street_shop: 9,
  dim_sum: 9,
  mall_store: 8
};

const HOT_FOOD_TAGS = ['hot', 'comfort', 'congee', 'noodle', 'hotpot', 'malatang'];
const COLD_FOOD_TAGS = ['cold', 'salad', 'fresh', 'light', 'healthy', 'low_burden'];
const COLD_OR_ROOM_TEMPERATURE_KEYWORDS = [
  '赛百味',
  'subway',
  '三明治',
  '三文治',
  '沙拉',
  '轻食',
  '冷餐',
  '冷食',
  '冷饮',
  '冰饮',
  '咖啡',
  '奶茶',
  '茶饮',
  '饮品',
  '甜品',
  '蛋糕',
  '面包',
  '烘焙'
];

const COFFEE_KEYWORDS = [
  'coffee',
  'cafe',
  'starbucks',
  'luckin',
  'manner',
  'peet',
  'costa',
  'tims',
  'tim hortons',
  'cotti'
];
const DESSERT_BAKERY_KEYWORDS = [
  'dessert',
  'bakery',
  'gelato',
  'bagel',
  'cream',
  'cake',
  'bread'
];

const SPICY_CONFLICT_TAGS = [
  'spicy',
  'strong_flavor',
  'hotpot',
  'malatang',
  'sichuan',
  'hunan',
  'chongqing',
  'chongqing_noodle',
  'maocai',
  'dry_pot'
];
const GREASY_CONFLICT_TAGS = ['bbq', 'fried', 'heavy', 'strong_flavor', 'burger'];
const LIGHT_CONFLICT_TAGS = ['spicy', 'strong_flavor', 'bbq', 'fried', 'heavy', 'hotpot', 'malatang'];
const LIGHT_HEALTHY_PREFERENCE_TAGS = ['light', 'healthy', 'low_burden', 'salad', 'fresh'];
const NON_MEAL_TAGS = ['dessert', 'milk_tea', 'coffee', 'drink', 'afternoon_tea', 'non_meal'];
const MEAL_TAGS = ['meal', 'rice', 'noodle', 'staple', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum'];
const PREMIUM_MEAL_SIGNAL_KEYWORDS = [
  '\u9152\u5e97\u9910\u5385',
  '\u661f\u7ea7\u9152\u5e97',
  '\u9152\u5bb6',
  '\u4e2d\u9910\u5385',
  '\u897f\u9910\u5385',
  '\u7ca4\u83dc',
  '\u79c1\u623f\u83dc',
  '\u79c1\u53a8',
  '\u4e3b\u53a8',
  '\u878d\u5408\u6599\u7406',
  '\u725b\u6392\u9986',
  '\u70e7\u8089',
  '\u6d77\u9c9c\u653e\u9898',
  '\u9ed1\u73cd\u73e0',
  '\u7c73\u5176\u6797',
  '\u70b3\u80dc',
  '\u5229\u82d1',
  '\u767d\u5929\u9e45',
  '\u5e7f\u5dde\u9152\u5bb6',
  '\u82b1\u56ed\u9152\u5e97',
  '\u5eb7\u83b1\u5fb7'
];
const PURE_NON_MEAL_BUSINESS_KEYWORDS = [
  '\u5976\u8336',
  '\u8336\u996e',
  '\u51b7\u996e',
  '\u996e\u54c1',
  '\u5496\u5561',
  '\u751c\u54c1\u5e97',
  '\u7cd5\u997c\u5e97',
  '\u86cb\u7cd5\u5e97',
  '\u9762\u5305\u5e97',
  '\u70d8\u7119\u5e97'
];
const DRINK_ONLY_OPTION_IDS = ['intent_drink', 'prefer_milk_tea', 'prefer_coffee'];
const DESSERT_ONLY_OPTION_IDS = ['intent_dessert', 'prefer_bakery_dessert'];
const BRAND_CHAIN_OPTION_IDS = ['brand_chain'];
const BRAND_INDEPENDENT_OPTION_IDS = ['brand_independent'];
const CHAIN_BRAND_TAGS = ['chain_brand', 'low_chain', 'mid_chain', 'premium_brand'];
const KNOWN_LOW_CHAIN_KEYWORDS = [
  '肯德基',
  '麦当劳',
  'kfc',
  'mcdonald',
  '必胜客',
  '赛百味',
  '星巴克',
  '瑞幸',
  '库迪',
  '喜茶',
  '奈雪',
  '霸王茶姬',
  '一点点',
  '1点点',
  '蜜雪冰城',
  '古茗',
  '茶百道',
  '沪上阿姨'
];
const KNOWN_MID_CHAIN_KEYWORDS = [
  '绿茶餐厅',
  '外婆家',
  '九毛九',
  '太二',
  '探鱼',
  '西贝',
  '海底捞',
  '巴奴',
  '木屋烧烤',
  '农耕记',
  '点都德',
  '陶陶居',
  '费大厨',
  '湘辣辣',
  '蛙来哒',
  '江渔儿',
  '杨国福',
  '遇见小面',
  '大家乐',
  '大快活'
];
const KNOWN_PREMIUM_CHAIN_KEYWORDS = [
  '广州酒家',
  '炳胜',
  '利苑',
  '白天鹅',
  '黑珍珠',
  '米其林',
  '大董',
  '新荣记',
  '甬府',
  '莆田',
  '松鹤楼'
];
const MALL_STORE_KEYWORDS = ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', '综合体', '购物公园'];
const NON_RESTAURANT_SALES_KEYWORDS = [
  '销售中心',
  '批发',
  '团购',
  '月饼',
  '礼盒',
  '礼品',
  '年货',
  '食品销售',
  '商贸',
  '展销',
  '经销',
  '有礼'
];
const VEGETARIAN_CONFLICT_TAGS = ['bbq', 'meat_heavy', 'pork'];
const HALAL_CONFLICT_TAGS = ['pork'];
const LOW_SUGAR_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const HIGH_PROTEIN_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const ALLERGY_CONFLICT_TAGS = ['seafood', 'peanut', 'unclear_ingredients'];
const DEFAULT_SPICY_HEAVY_TAGS = ['spicy', 'strong_flavor', 'heavy'];
const NOT_SPICY_KEYWORDS = ['不辣', '微辣可选', '清淡', '白汤', '原味', '广式', '粥', '沙拉', '轻食'];
const SPICY_HEAVY_KEYWORDS = [
  '辣',
  '麻辣',
  '小面',
  '重庆小面',
  '酸辣粉',
  '川',
  '川味',
  '川菜',
  '湘',
  '湘菜',
  '麻辣烫',
  '冒菜',
  '香锅',
  '麻辣香锅',
  '火锅',
  '串串',
  '水煮',
  '剁椒',
  '干锅',
  '螺蛳粉'
];
const INFERRED_TAG_RULES: Array<{ keywords: string[]; tags: TagId[]; skipWhenNotSpicy?: boolean }> = [
  { keywords: ['重庆小面', '小面'], tags: ['spicy', 'strong_flavor', 'heavy', 'chongqing_noodle', 'noodle', 'hot', 'quick'], skipWhenNotSpicy: true },
  { keywords: ['麻辣烫'], tags: ['spicy', 'strong_flavor', 'heavy', 'malatang', 'hot', 'quick'], skipWhenNotSpicy: true },
  { keywords: ['冒菜'], tags: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'maocai', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['麻辣香锅', '香锅', '干锅'], tags: ['spicy', 'strong_flavor', 'heavy', 'dry_pot', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['川菜', '川味', '水煮', '辣子'], tags: ['spicy', 'strong_flavor', 'heavy', 'sichuan', 'rice'], skipWhenNotSpicy: true },
  { keywords: ['湘菜', '湖南', '小炒', '剁椒'], tags: ['spicy', 'strong_flavor', 'heavy', 'hunan', 'rice'], skipWhenNotSpicy: true },
  { keywords: ['酸辣粉'], tags: ['spicy', 'strong_flavor', 'heavy', 'chongqing', 'noodle', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['火锅', '串串'], tags: ['spicy', 'strong_flavor', 'heavy', 'hotpot', 'hot'], skipWhenNotSpicy: true },
  { keywords: ['炸鸡', '鸡柳', '鸡排', '肯德基', 'kfc', '麦当劳', '汉堡王', '油炸', '汉堡', '薯条'], tags: ['fried', 'heavy', 'burger', 'quick', 'snack'] },
  { keywords: ['赛百味', 'subway', '三明治', '三文治'], tags: ['cold', 'quick', 'snack', 'low_chain'] },
  { keywords: ['烧烤', '烤肉', '烤串'], tags: ['bbq', 'heavy', 'strong_flavor', 'group', 'meal'] },
  { keywords: ['粥', '粉面', '云吞', '馄饨', '广式', '茶餐厅'], tags: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { keywords: ['茶楼', '早茶'], tags: ['dim_sum', 'meal', 'snack', 'light', 'not_spicy'] },
  { keywords: ['春饼', '东北菜', '东北', '脆肚', '私房菜', '啫啫煲', '煲仔饭', '蛙来哒', '鲜笋', '外婆小聚'], tags: ['meal', 'rice', 'staple', 'relaxed'] },
  { keywords: ['轻食', '沙拉', '健康', '低卡', '减脂'], tags: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { keywords: ['盖饭', '便当', '简餐', '套餐'], tags: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { keywords: ['包子', '饺子', '煎饼', '烧麦', '小吃'], tags: ['quick', 'snack', 'solo', 'hot'] },
  { keywords: ['热卤', '卤味', '盛香亭'], tags: ['snack', 'meal', 'hot', 'heavy', 'strong_flavor'] },
  { keywords: ['料理', '南洋料理'], tags: ['meal', 'rice', 'relaxed', 'stable'] },
  { keywords: ['日式', '日本', '寿司', '咖喱'], tags: ['rice', 'not_spicy', 'stable', 'solo'] }
  , { keywords: ['咖啡', 'cafe', 'coffee', '星巴克', '瑞幸', 'luckin', 'manner', 'peet', 'costa', 'tims', 'tim hortons', 'm stand', 'seesaw', 'arabica'], tags: ['coffee', 'drink', 'non_meal', 'afternoon_tea'] },
  { keywords: ['奶茶', '茶饮', '冷饮店', '冷饮', '喜茶', '奈雪', '一点点', '1点点', '霸王茶姬', '蜜雪冰城', '柠檬茶', 'linlee', '麒麟大口茶', '大口茶', 'coco', '都可', 'koi', 'koi thé', 'koi the', 'thé', '阿嬷手作', '去茶山', '古茗', '茉莉奶白', '爷爷不泡茶', '不泡茶', '茶理宜世', '茶记大咖', 't9tea', 'tamkoko'], tags: ['milk_tea', 'drink', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { keywords: ['饮品', '饮品店', '果茶', '糖水', '手打柠檬茶', '麒麟大口茶', '大口茶', 'coco', '都可', 'koi', 'thé', '混果汁', '酸奶', '牛奶', '麦记牛奶', 'blueglass', '茶道', '茶园'], tags: ['drink', 'dessert', 'non_meal', 'afternoon_tea', 'sweet', 'sugary_drink'] },
  { keywords: ['甜品', '甜品店', '糕饼', '糕饼店', '蛋糕', '蛋糕店', '面包', '面包店', '烘焙', '烘焙店', '点心', '西点', 'gelato', 'pinvita', 'butterful', 'creamorous', '珞珞', 'bakery', '冰淇淋', 'paper stone', '哈根达斯', 'haagen', 'baker', 'spice', 'bagel', '贝果', 'zakuzaku', '双皮奶', 'marmalade', 'bake land', '老鼎丰'], tags: ['dessert', 'non_meal', 'afternoon_tea', 'sweet'] },
  { keywords: ['早餐', '包子', '豆浆', '油条'], tags: ['breakfast', 'quick', 'hot', 'staple', 'snack'] },
  { keywords: ['夜宵', '宵夜'], tags: ['late_night', 'quick', 'hot', 'snack'] },
  { keywords: ['清真', '兰州拉面', '牛肉面'], tags: ['halal', 'noodle', 'hot', 'high_protein'] },
  { keywords: ['素食', '素菜', '素面'], tags: ['vegetarian', 'healthy', 'light', 'not_spicy'] },
  { keywords: ['健身餐', '鸡胸肉', '高蛋白', '牛肉饭'], tags: ['high_protein', 'healthy', 'low_carb'] },
  { keywords: ['猪肉', '卤肉', '叉烧', '五花肉'], tags: ['pork', 'meat_heavy'] },
  { keywords: ['海鲜', '虾', '蟹'], tags: ['seafood', 'unclear_ingredients'] },
  { keywords: ['花生', '坚果'], tags: ['peanut', 'unclear_ingredients'] }
];
const SPICY_KEYWORDS = [
  '辣',
  '麻辣',
  '小面',
  '重庆小面',
  '川',
  '川味',
  '川菜',
  '湘',
  '湘菜',
  '麻辣烫',
  '冒菜',
  '香锅',
  '火锅',
  '串串'
];
const GREASY_KEYWORDS = ['炸', '炸鸡', '鸡柳', '鸡排', '肯德基', 'kfc', '麦当劳', '汉堡王', '烧烤', '烤肉', '汉堡', '薯条', '油炸'];

const NON_MEAL_KEYWORDS = ['咖啡', '奶茶', '茶饮', '冷饮店', '冷饮', '饮品', '饮品店', '甜品', '甜品店', '糕饼', '糕饼店', '蛋糕', '蛋糕店', '面包', '面包店', '烘焙', '烘焙店', '下午茶', '糖水', '柠檬茶', '蜜雪冰城', '麒麟大口茶', '大口茶', 'coco', '都可', 'koi', 'thé', '阿嬷手作', '去茶山', '古茗', '茉莉奶白', '爷爷不泡茶', '茶理宜世', '茶记大咖', 't9tea', 'tamkoko', '混果汁', '酸奶', '牛奶', 'blueglass', 'gelato', 'butterful', 'creamorous', 'bakery', '冰淇淋', '哈根达斯', 'bagel', '贝果', 'zakuzaku', '双皮奶'];
const MEAL_KEYWORDS = ['盖饭', '套餐', '简餐', '小炒', '炒菜', '火锅', '米饭', '徽菜', '新徽菜', '小菜园', '茶楼', '早茶', '热卤', '卤味', '料理', '春饼', '东北菜', '脆肚', '私房菜', '啫啫煲', '煲仔饭', '蛙来哒', '外婆小聚', '香锅'];
const BROAD_MEAL_KEYWORDS = [
  '餐厅',
  '餐馆',
  '中餐',
  '中餐厅',
  '餐饮服务;中餐厅',
  '小吃快餐',
  '快餐',
  '饭店',
  '私厨',
  '酒家',
  '食堂',
  'restaurant',
  'omakase',
  'fine dining',
  'bistro',
  'chateau',
  'chef',
  'hotpot',
  '锅',
  '菜',
  '海鲜'
];
const PORK_KEYWORDS = ['猪肉', '卤肉', '叉烧', '五花肉'];
const MEAT_HEAVY_KEYWORDS = ['烤肉', '烧烤', '牛排', '炸鸡', '猪肉', '肉蟹煲'];
const SWEET_KEYWORDS = ['甜品', '蛋糕', '奶茶', '茶饮', '糖水'];
const ALLERGY_KEYWORDS = ['海鲜', '虾', '蟹', '花生', '坚果'];
const LOW_CHAIN_KEYWORDS = [
  '肯德基',
  'kfc',
  '麦当劳',
  'mcdonald',
  '赛百味',
  'subway',
  '汉堡王',
  '华莱士',
  '塔斯汀',
  '必胜客',
  '达美乐',
  '真功夫',
  '老乡鸡',
  '乡村基',
  '吉野家',
  '永和大王',
  '霸王茶姬',
  '喜茶',
  '奈雪',
  '一点点',
  '蜜雪冰城',
  'linlee',
  '麒麟大口茶',
  '大口茶',
  'koi',
  '阿嬷手作',
  '去茶山',
  '古茗',
  '茉莉奶白',
  '爷爷不泡茶',
  '茶理宜世',
  '茶记大咖',
  't9tea',
  'tamkoko',
  '星巴克',
  'starbucks',
  '瑞幸',
  'luckin',
  'manner',
  'peet',
  'costa',
  'tims',
  'tim hortons'
];
const MID_CHAIN_KEYWORDS = [
  '费大厨',
  '太二',
  '探鱼',
  '西贝',
  '海底捞',
  '巴奴',
  '木屋烧烤',
  '绿茶餐厅',
  '外婆家',
  '九毛九',
  '蛙来哒',
  '农耕记',
  '陈鹏鹏',
  '怂火锅',
  '大龙燚',
  '点都德',
  '陶陶居',
  '小菜园',
  '小菜园新徽菜'
];
const PREMIUM_CHAIN_KEYWORDS = [
  '高端餐厅',
  '高端日料',
  '米其林',
  'omakase',
  'fine dining',
  '法餐',
  '私房菜',
  '炳胜',
  '利苑',
  '大董',
  '新荣记',
  '甬府',
  '莆田',
  '松鹤楼',
  '广州酒家',
  '白天鹅',
  '黑珍珠'
];
const NATIONAL_LOW_CHAIN_EXTENSION_KEYWORDS = [
  '德克士',
  '派乐汉堡',
  '享哆味',
  '萨莉亚',
  '南城香',
  '大米先生',
  '米村拌饭',
  '超意兴',
  '杨铭宇黄焖鸡',
  '猪角',
  '正新鸡排',
  '绝味鸭脖',
  '紫燕百味鸡',
  '周黑鸭',
  '煌上煌',
  '久久丫',
  '巴比',
  '小杨生煎',
  '书亦烧仙草',
  'CoCo',
  '都可',
  '益禾堂',
  '甜啦啦',
  '柠季',
  '林里',
  '茶颜悦色',
  '茶话弄',
  '悸动',
  '快乐番薯',
  '阿水大杯茶',
  '700CC',
  '库迪',
  'cotti',
  '幸运咖',
  'NOWWA',
  '挪瓦',
  'M Stand',
  'Seesaw'
];
const NATIONAL_MID_CHAIN_EXTENSION_KEYWORDS = [
  '呷哺呷哺',
  '凑凑',
  '小龙坎',
  '朱光玉',
  '熊喵来了',
  '半天妖',
  '烤匠',
  '很久以前',
  '西塔老太太',
  '九田家',
  '刘炭长',
  '大家乐',
  '大快活',
  '捞王',
  '左庭右院',
  '八合里',
  '润园四季',
  '四季椰林',
  '王品牛排',
  '豪客来',
  '大渔铁板烧',
  '和府捞面',
  '味千拉面',
  '李先生',
  '马记永',
  '陈香贵',
  '蒙自源',
  '阿香米线',
  '五谷渔粉',
  '喜家德',
  '袁记云饺',
  '吉祥馄饨'
];
const NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS = [
  '高端粤菜',
  '潮菜',
  '铁板烧',
  '创意菜',
  '鮨',
  '花园酒店',
  '康莱德',
  '大渔铁板烧',
  '1218 GRILL',
  '中侨会',
  '雍颐庭',
  '菁禧荟',
  '遇外滩',
  '成隆行',
  '眉州东坡1996',
  '蓝麒麟',
  '新长福',
  '南景饭店',
  '晴溪莊园',
  '至正潮菜',
  'AVANT',
  'La Tablée',
  'Stone Sal',
  '言盐',
  '粤海荟',
  '齐武',
  '晴空',
  '水岸十里',
  '云璟',
  '鹏瑞莱佛士',
  '雲鹤',
  '雲鹤手握',
  '鮨海老'
];
const pushUniqueKeyword = (target: string[], keywords: string[]) => {
  keywords.forEach((keyword) => {
    if (!target.includes(keyword)) {
      target.push(keyword);
    }
  });
};
pushUniqueKeyword(LOW_CHAIN_KEYWORDS, NATIONAL_LOW_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(KNOWN_LOW_CHAIN_KEYWORDS, NATIONAL_LOW_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(MID_CHAIN_KEYWORDS, NATIONAL_MID_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(KNOWN_MID_CHAIN_KEYWORDS, NATIONAL_MID_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(PREMIUM_CHAIN_KEYWORDS, NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(KNOWN_PREMIUM_CHAIN_KEYWORDS, NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS);
pushUniqueKeyword(PREMIUM_MEAL_SIGNAL_KEYWORDS, [
  '潮菜',
  '江浙菜',
  '本帮菜',
  '高端粤菜',
  '高端日料',
  '铁板烧',
  '创意菜',
  'GRILL',
  '鮨',
  ...NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS
]);
const INDEPENDENT_STORE_KEYWORDS = [
  '街边',
  '小店',
  '老店',
  '大排档',
  '排档',
  '小馆',
  '家常',
  '本地',
  '路边摊',
  '苍蝇馆',
  '苍蝇小馆',
  '简陋',
  '破旧',
  '破店',
  '档口',
  '摊档'
];

export function recommendRestaurants(options: RecommendationEngineOptions): RecommendationResult {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const source = options.source ?? 'mock';
  const preference = options.context?.preferenceSnapshot;
  const excludedHistoryRestaurantIds =
    options.context?.excludedHistoryRestaurantIds ?? options.context?.excludeRestaurantIds ?? [];
  const excludeRestaurantIds = new Set(excludedHistoryRestaurantIds);
  const historyPenaltyRestaurantIds = options.context?.historyPenaltyRestaurantIds ?? [];
  const historyPenaltyReasons = options.context?.historyPenaltyReasons ?? [];
  const experimentId = options.context?.experimentId ?? DEFAULT_EXPERIMENT_ID;
  const totalFetched = options.restaurants.length;
  const candidateRestaurants = deduplicateRestaurants(options.restaurants);
  const scoreOptionsBase: ScoreOptions = {
    historyFilterEnabled: options.context?.historyFilterEnabled === true,
    excludedHistoryRestaurantIds,
    historyPenaltyRestaurantIds,
    historyPenaltyReasons
  };
  const afterHistoryFilter = candidateRestaurants.filter((restaurant) => !excludeRestaurantIds.has(restaurant.id)).length;
  const baseHardFiltered = candidateRestaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
      allowDistanceFallback: false,
      allowNegativeFallback: true,
      allowUnknownPriceFallback: false,
      allowUnderBudgetFallback: false
    }).passed;
  });
  const primaryHardFiltered = candidateRestaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
      allowDistanceFallback: false,
      allowNegativeFallback: false,
      allowUnknownPriceFallback: false,
      allowUnderBudgetFallback: false
    }).passed;
  });
  const afterNegativeFilter = primaryHardFiltered.length;

  let fallbackReason: string | undefined;
  let fallbackConfidenceCap: number | undefined;
  let fallbackFinalScoreCap: number | undefined;
  let scored = primaryHardFiltered.map((restaurant) =>
    scoreRestaurant(restaurant, preference, scoreOptionsBase)
  );

  if (scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = buildDistanceFallbackReason(preference);
    fallbackConfidenceCap = undefined;
    fallbackFinalScoreCap = undefined;
    const strictScored = scored;
    const strictIds = new Set(primaryHardFiltered.map((restaurant) => restaurant.id));
    const supplementalScored = candidateRestaurants
      .filter((restaurant) => {
        if (strictIds.has(restaurant.id)) {
          return false;
        }

        return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: false,
          // 高预算 fallback 只放开价格缺失，明确低价候选仍然硬过滤。
          allowUnknownPriceFallback: true,
          allowUnderBudgetFallback: true
        }).passed;
      })
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason
        })
      );
    scored = [...strictScored, ...supplementalScored];
  }

  if (scored.length === 0) {
    fallbackReason = buildNegativeFallbackReason(preference);
    fallbackConfidenceCap = undefined;
    fallbackFinalScoreCap = undefined;
    scored = candidateRestaurants
      .filter((restaurant) => {
        if (getNegativeConflict(restaurant, preference).severity === 'hard') {
          return false;
        }

        return applyHardFilters(restaurant, preference, excludeRestaurantIds, {
          allowDistanceFallback: true,
          allowNegativeFallback: true,
          allowUnknownPriceFallback: true,
          allowUnderBudgetFallback: true
        }).passed;
      })
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason
        })
      );
  }

  if (scored.length === 0) {
    fallbackReason = buildLastResortFallbackReason(preference);
    fallbackConfidenceCap = 45;
    fallbackFinalScoreCap = 45;
    scored = candidateRestaurants
      .filter((restaurant) =>
        isLastResortFallbackCandidate(restaurant, preference, excludeRestaurantIds)
      )
      .map((restaurant) =>
        scoreRestaurant(restaurant, preference, {
          ...scoreOptionsBase,
          fallbackReason,
          confidenceCap: fallbackConfidenceCap,
          finalScoreCap: fallbackFinalScoreCap
        })
      );
  }

  const fallbackCandidateCount = scored.filter((candidate) => Boolean(candidate.fallbackReason)).length;
  const poolStats: CandidatePoolStats = {
    totalFetched,
    afterHardFilter: baseHardFiltered.length,
    afterHistoryFilter,
    afterNegativeFilter,
    finalCandidateCount: Math.min(limit, scored.length),
    fallbackUsed: fallbackCandidateCount > 0,
    fallbackAttempted: fallbackReason !== undefined,
    fallbackCandidateCount,
    topCandidateFallbackUsed: false,
    historyFallbackUsed: false
  };
  const ranked = selectDiverseRanked(rankWithLightRandom(scored, random), limit);
  poolStats.topCandidateFallbackUsed = Boolean(ranked[0]?.fallbackReason);
  const candidates = ranked.slice(0, limit).map((scoredRestaurant, index) => {
    const next = scoreRestaurant(scoredRestaurant.restaurant, preference, {
      fallbackReason: scoredRestaurant.fallbackReason,
      relativeLeadScore: getRelativeLeadScore(ranked, index),
      candidatePoolWeak: poolStats.fallbackUsed || poolStats.afterNegativeFilter < MIN_PRIMARY_POOL_SIZE,
      historyFilterEnabled: scoreOptionsBase.historyFilterEnabled,
      excludedHistoryRestaurantIds: scoreOptionsBase.excludedHistoryRestaurantIds,
      historyPenaltyRestaurantIds: scoreOptionsBase.historyPenaltyRestaurantIds,
      historyPenaltyReasons: scoreOptionsBase.historyPenaltyReasons,
      confidenceCap: fallbackConfidenceCap,
      finalScoreCap: fallbackFinalScoreCap
    });

    return {
      ...toRecommendationCandidate(next, source, experimentId),
      candidatePoolStats: poolStats
    };
  });
  const visibleFallbackReason = candidates[0]?.fallbackReason;

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source,
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
    candidates,
    selectedCandidateId: candidates[0]?.id,
    reasonSummary: buildReasonSummary(candidates[0]),
    fallbackReason: visibleFallbackReason,
    historyFilterEnabled: scoreOptionsBase.historyFilterEnabled,
    excludedHistoryRestaurantIds,
    historyPenaltyReasons,
    candidatePoolStats: poolStats
  };
}

export function scoreRestaurant(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  options: ScoreOptions = {}
): ScoredRestaurant {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = getPreferredTagIds(preference);
  const avoidedTagIds = getAvoidedTagIds(preference);
  const matchedPreferredTagIds = intersect(tagIds, preferredTagIds);
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const temperatureConflict = getTemperatureConflict(restaurant, preference);
  const matchedAvoidedTagIds = [...new Set([...intersect(tagIds, avoidedTagIds), ...negativeConflict.tags])]
    .filter((tagId) => !shouldSuppressPremiumChainAvoidanceTag(tagId, tagIds, preference));
  const baseScore = 32;
  const preferenceScore = getPreferenceScore(matchedPreferredTagIds);
  const negativePreferencePenalty = getNegativePenalty(negativeConflict) + temperatureConflict.penalty;
  const historyPenaltyApplies =
    options.historyPenaltyRestaurantIds?.includes(restaurant.id) === true;
  const historyPenalty = historyPenaltyApplies ? 8 : 0;
  const distanceScore = getDistanceScore(restaurant, preference, options.fallbackReason !== undefined);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = getOpenStatusScore(restaurant);
  const dataCompletenessScore = getDataCompletenessScore(restaurant);
  const rawFinalScore = clamp(
    baseScore +
      preferenceScore -
      negativePreferencePenalty +
      - historyPenalty +
      distanceScore +
      priceScore +
      timeScore +
      ratingScore +
      openStatusScore +
      dataCompletenessScore,
    MIN_SCORE,
    MAX_SCORE
  );
  const distanceAdjustedFinalScore =
    options.fallbackReason !== undefined &&
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
      ? Math.min(rawFinalScore, 54)
      : rawFinalScore;
  const underBudgetMismatch = isUnderRequestedBudgetRange(restaurant, preference);
  const underBudgetAdjustedFinalScore = underBudgetMismatch
    ? Math.min(distanceAdjustedFinalScore, getUnderBudgetFinalScoreCap(restaurant, preference))
    : distanceAdjustedFinalScore;
  const finalScore =
    options.finalScoreCap !== undefined
      ? Math.min(underBudgetAdjustedFinalScore, options.finalScoreCap)
      : underBudgetAdjustedFinalScore;
  const hardConstraintScore = getHardConstraintConfidence(restaurant, preference, options.fallbackReason);
  const positivePreferenceScore = getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds);
  const negativeAvoidanceScore = getNegativeAvoidanceConfidence(negativeConflict);
  const relativeLeadScore = options.relativeLeadScore ?? 0;
  const rawConfidenceScore = calculateConfidenceScore({
    hardConstraintScore,
    positivePreferenceScore,
    negativeAvoidanceScore,
    dataCompletenessScore,
    relativeLeadScore,
    negativeConflict,
    temperatureConflict,
    priceOverBudget: isOverBudget(restaurant, preference),
    priceUnknown: isPriceUnknown(restaurant),
    timeOverPreference: isOverTimePreference(restaurant, preference),
    fallbackUsed: options.fallbackReason !== undefined,
    candidatePoolWeak: options.candidatePoolWeak ?? false
  });
  const nonMealBudgetMismatch = isHighBudgetNonMealUnderBudget(restaurant, preference);
  const budgetCalibratedConfidenceScore = nonMealBudgetMismatch
    ? Math.min(rawConfidenceScore, getHighBudgetNonMealConfidenceCap(restaurant, preference))
    : rawConfidenceScore;
  const priceCalibratedConfidenceScore = underBudgetMismatch
    ? Math.min(budgetCalibratedConfidenceScore, getUnderBudgetConfidenceCap(restaurant, preference))
    : budgetCalibratedConfidenceScore;
  const historyCalibratedConfidenceScore = historyPenaltyApplies
    ? Math.min(priceCalibratedConfidenceScore, 72)
    : priceCalibratedConfidenceScore;
  const confidenceScore =
    options.confidenceCap !== undefined
      ? Math.min(historyCalibratedConfidenceScore, options.confidenceCap)
      : historyCalibratedConfidenceScore;

  return {
    restaurant,
    score: finalScore,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    breakdown: {
      baseScore,
      preferenceScore,
      negativePreferencePenalty,
      distanceScore,
      priceScore,
      timeScore,
      ratingScore,
      openStatusScore,
      dataCompletenessScore,
      hardConstraintScore,
      positivePreferenceScore,
      negativeAvoidanceScore,
      relativeLeadScore,
      confidenceScore,
      finalScore,
      finalScoreSource:
        'base + preferred tag weights - negative/temperature penalties + distance + price + time + rating + open status + data completeness',
      matchPercentSource:
        'hard constraints + positive preference coverage + negative avoidance + data completeness + relative lead, capped by conflict/fallback calibration',
      matchedPreferredTagIds,
      matchedAvoidedTagIds
    },
    reasons: buildReasons(
      restaurant,
      matchedPreferredTagIds,
      negativeConflict,
      preference,
      options.fallbackReason,
      temperatureConflict,
      nonMealBudgetMismatch
    ),
    hardFilterReasons: applyHardFilters(restaurant, preference, new Set(), {
      allowDistanceFallback: options.fallbackReason !== undefined,
      allowNegativeFallback: true,
      allowUnknownPriceFallback: options.fallbackReason !== undefined,
      allowUnderBudgetFallback: options.fallbackReason !== undefined
    }).reasons,
    penaltyReasons: [
      ...buildPenaltyReasons(
        restaurant,
        negativeConflict,
        preference,
        options.fallbackReason,
        temperatureConflict,
        nonMealBudgetMismatch
      ),
      ...(historyPenaltyApplies ? ['近期跳过，已降低权重'] : [])
    ],
    matchedPreferredTagIds,
    matchedAvoidedTagIds,
    fallbackReason: options.fallbackReason,
    historyFilterEnabled: options.historyFilterEnabled,
    excludedHistoryRestaurantIds: options.excludedHistoryRestaurantIds,
    historyPenaltyReasons: options.historyPenaltyReasons
  };
}

export function applyHardFilters(
  restaurant: Restaurant,
  preference: UserPreferenceProfile | undefined,
  excludeRestaurantIds: Set<RestaurantId>,
  options: {
    allowDistanceFallback: boolean;
    allowNegativeFallback: boolean;
    allowUnknownPriceFallback: boolean;
    allowUnderBudgetFallback?: boolean;
  }
): HardFilterResult {
  const reasons: string[] = [];
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const temperatureConflict = getTemperatureConflict(restaurant, preference);
  const restaurantText = getRestaurantSignalText(restaurant);

  if (restaurant.status !== 'active') {
    reasons.push('餐厅不可用');
  }

  if (isNonRestaurantSalesCandidate(restaurantText)) {
    reasons.push('非到店餐饮门店');
  }

  const restaurantTagIds = getRestaurantTagIds(restaurant);

  if (isExplicitNonMealPreference(preference) && !hasNonMealEvidence(restaurantTagIds, restaurantText)) {
    reasons.push('明确想要饮品/甜品，但该店缺少相应特征');
  }

  if (isExplicitMealPreference(preference) && hasNonMealEvidence(restaurantTagIds, restaurantText)) {
    reasons.push('明确正餐意图与饮品/甜点候选冲突');
  }

  if (isHighBudgetNonMealNoise(restaurant, preference, restaurantTagIds, restaurantText)) {
    reasons.push('高预算正餐场景下的低价饮品/甜点噪声');
  }

  if (requiresBrandCandidate(preference) && !isAcceptableBrandCandidate(restaurant, preference)) {
    reasons.push('品牌偏好下缺少连锁/品牌特征');
  }

  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') {
    reasons.push('当前不在营业');
  }

  if (excludeRestaurantIds.has(restaurant.id)) {
    reasons.push('近期已推荐过');
  }

  if (
    !options.allowDistanceFallback &&
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
  ) {
    reasons.push(`距离 ${restaurant.distanceMeters} 米，超出 ${preference.maxDistanceMeters} 米偏好`);
  }

  if (isClearlyOverBudget(restaurant, preference)) {
    reasons.push('价格明显超出预算');
  }

  if (isClearlyUnderBudget(restaurant, preference, options.allowUnderBudgetFallback === true)) {
    reasons.push('price clearly below requested budget');
  }

  if (!options.allowUnknownPriceFallback && isPriceUnknownForStrictBudget(restaurant, preference)) {
    reasons.push('price unknown for strict high budget');
  }

  if (options.allowUnknownPriceFallback && isWeakUnknownPriceForPremiumFallback(restaurant, preference)) {
    reasons.push('price unknown without premium evidence for 200+ budget');
  }

  if (
    preference?.maxEstimatedMinutes !== undefined &&
    estimateMinutes(restaurant) > preference.maxEstimatedMinutes + 20
  ) {
    reasons.push('预计耗时明显超出偏好');
  }

  if (!options.allowNegativeFallback && negativeConflict.severity !== 'none') {
    reasons.push(`命中明确负向偏好：${negativeConflict.labels.join('、')}`);
  }

  if (!options.allowNegativeFallback && temperatureConflict.severity === 'soft') {
    reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function isNonRestaurantSalesCandidate(text: string): boolean {
  return NON_RESTAURANT_SALES_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function requiresBrandCandidate(preference?: UserPreferenceProfile): boolean {
  const selected = new Set(preference?.selectedOptionIds ?? []);

  return BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId));
}

function isAcceptableBrandCandidate(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  const tagIds = getRestaurantTagIds(restaurant);
  const hasBrandTag = CHAIN_BRAND_TAGS.some((tagId) => tagIds.includes(tagId));
  const text = getRestaurantSignalText(restaurant);
  const estimatedCost = getEstimatedCost(restaurant);

  if (hasBrandTag) {
    return true;
  }

  if (hasKnownChainBrandEvidence(text)) {
    return true;
  }

  if ((preference?.budgetLevel ?? 3) >= 6) {
    return (estimatedCost !== undefined && estimatedCost >= 200) || hasPremiumCandidateEvidence(restaurant, text);
  }

  return (
    (preference?.budgetLevel ?? 3) >= 5 &&
    (estimatedCost ?? 0) >= 80 &&
    (hasMallStoreEvidence(text) || (restaurant.rating ?? 0) >= 4.3)
  );
}

function hasPremiumCandidateEvidence(restaurant: Restaurant, text = getRestaurantSignalText(restaurant)): boolean {
  const estimatedCost = getEstimatedCost(restaurant);
  const tagIds = getRestaurantTagIds(restaurant);
  const hasNonMeal = hasNonMealEvidence(tagIds, text);
  const hasMealSignal = hasPremiumMealSignal(text);

  if (hasNonMeal && !hasMealSignal) {
    return tagIds.includes('premium_brand') && !hasStrongNonMealEvidence(tagIds, text);
  }

  return (
    (estimatedCost !== undefined && estimatedCost >= 200) ||
    tagIds.includes('premium_brand') ||
    hasMealSignal ||
    ((restaurant.rating ?? 0) >= 4.6 && (hasMallStoreEvidence(text) || /餐厅|料理|酒家|饭店|restaurant|dining/.test(text)))
  );
}

function isLastResortFallbackCandidate(
  restaurant: Restaurant,
  preference: UserPreferenceProfile | undefined,
  excludeRestaurantIds: Set<RestaurantId>
): boolean {
  const text = getRestaurantSignalText(restaurant);

  if (restaurant.status !== 'active') {
    return false;
  }

  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') {
    return false;
  }

  if (excludeRestaurantIds.has(restaurant.id)) {
    return false;
  }

  if (isNonRestaurantSalesCandidate(text)) {
    return false;
  }

  if (isClearlyOverBudget(restaurant, preference)) {
    return false;
  }

  return !hasSafetyHardConflict(restaurant, preference);
}

function hasSafetyHardConflict(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  const avoided = new Set(getAvoidedTagIds(preference));
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantSignalText(restaurant);
  const explicitNoSpicy = avoided.has('spicy');
  const explicitHalal = preferred.has('halal') || avoided.has('pork');
  const explicitVegetarian = preferred.has('vegetarian');
  const explicitAllergy = preferred.has('allergy_sensitive');

  if (
    explicitNoSpicy &&
    (tagIds.some((tagId) => SPICY_CONFLICT_TAGS.includes(tagId)) ||
      [...SPICY_KEYWORDS, ...SPICY_HEAVY_KEYWORDS].some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitHalal &&
    (tagIds.some((tagId) => HALAL_CONFLICT_TAGS.includes(tagId)) ||
      PORK_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitVegetarian &&
    (tagIds.some((tagId) => VEGETARIAN_CONFLICT_TAGS.includes(tagId)) ||
      MEAT_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitAllergy &&
    (tagIds.some((tagId) => ALLERGY_CONFLICT_TAGS.includes(tagId)) ||
      ALLERGY_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  return false;
}

function rankWithLightRandom(scored: ScoredRestaurant[], random: () => number): ScoredRestaurant[] {
  const nonConflict = scored.filter((item) => item.matchedAvoidedTagIds.length === 0);
  const conflict = scored.filter((item) => item.matchedAvoidedTagIds.length > 0);
  const sorted = [
    ...nonConflict.sort(compareScoredRestaurants),
    ...conflict.sort(compareScoredRestaurants)
  ];
  const topThree = sorted.slice(0, 3);

  if (topThree.length <= 1) {
    return sorted;
  }

  const totalWeight = topThree.reduce((sum, item, index) => {
    return sum + Math.max(1, item.score) * (1 - index * 0.22);
  }, 0);
  let cursor = random() * totalWeight;
  const selectedIndex = topThree.findIndex((item, index) => {
    cursor -= Math.max(1, item.score) * (1 - index * 0.22);
    return cursor <= 0;
  });
  const safeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selected = topThree[safeIndex];
  const remaining = sorted.filter((item) => item.restaurant.id !== selected.restaurant.id);

  return [selected, ...remaining];
}

function compareScoredRestaurants(left: ScoredRestaurant, right: ScoredRestaurant): number {
  return (
    right.score - left.score ||
    right.confidenceScore - left.confidenceScore ||
    right.breakdown.preferenceScore - left.breakdown.preferenceScore ||
    right.breakdown.distanceScore - left.breakdown.distanceScore
  );
}

function deduplicateRestaurants(restaurants: Restaurant[]): Restaurant[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  return restaurants.filter((restaurant) => {
    const idKey = restaurant.id.trim().toLowerCase();
    const nameKey = normalizeRestaurantName(restaurant.name);

    if (seenIds.has(idKey) || seenNames.has(nameKey)) {
      return false;
    }

    seenIds.add(idKey);
    seenNames.add(nameKey);
    return true;
  });
}

function selectDiverseRanked(ranked: ScoredRestaurant[], limit: number): ScoredRestaurant[] {
  const selected: ScoredRestaurant[] = [];
  const deferred: ScoredRestaurant[] = [];
  const seenNames = new Set<string>();
  const seenBrands = new Set<string>();

  ranked.forEach((item) => {
    const nameKey = normalizeRestaurantName(item.restaurant.name);
    const brandKey = getRestaurantBrandKey(item.restaurant);

    if (selected.length < limit && !seenNames.has(nameKey) && (!brandKey || !seenBrands.has(brandKey))) {
      selected.push(item);
      seenNames.add(nameKey);

      if (brandKey) {
        seenBrands.add(brandKey);
      }
      return;
    }

    deferred.push(item);
  });

  return [...selected, ...deferred];
}

function normalizeRestaurantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s·•\-_.]/g, '')
    .trim();
}

function getRestaurantBrandKey(restaurant: Restaurant): string | undefined {
  const text = getRestaurantText(restaurant);
  const brand = [
    ...LOW_CHAIN_KEYWORDS,
    ...MID_CHAIN_KEYWORDS,
    ...PREMIUM_CHAIN_KEYWORDS,
    ...KNOWN_LOW_CHAIN_KEYWORDS,
    ...KNOWN_MID_CHAIN_KEYWORDS,
    ...KNOWN_PREMIUM_CHAIN_KEYWORDS
  ].find((keyword) => {
    return text.includes(keyword.toLowerCase());
  });

  return brand?.toLowerCase();
}

function hasKnownChainBrandEvidence(text: string): boolean {
  return [
    ...KNOWN_LOW_CHAIN_KEYWORDS,
    ...KNOWN_MID_CHAIN_KEYWORDS,
    ...KNOWN_PREMIUM_CHAIN_KEYWORDS
  ].some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasMallStoreEvidence(text: string): boolean {
  return ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', ...MALL_STORE_KEYWORDS].some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function toRecommendationCandidate(
  scored: ScoredRestaurant,
  source: RecommendationSource,
  experimentId: string
): RecommendationCandidate {
  const restaurant = scored.restaurant;

  return {
    id: `candidate-${restaurant.id}`,
    restaurantId: restaurant.id,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      tags: restaurant.tags,
      address: restaurant.address,
      location: restaurant.location,
      distanceMeters: restaurant.distanceMeters,
      averageCostYuan: restaurant.averageCostYuan,
      openStatus: restaurant.openStatus,
      rating: restaurant.rating
    },
    name: restaurant.name,
    mealName: restaurant.signatureDishes?.[0] ?? restaurant.name,
    tags: restaurant.tags,
    reason: scored.reasons.join('；'),
    estimatedMinutes: estimateMinutes(restaurant),
    score: scored.score,
    confidenceScore: scored.confidenceScore,
    confidenceLabel: scored.confidenceLabel,
    scoreBreakdown: scored.breakdown,
    matchedTagIds: scored.matchedPreferredTagIds,
    matchedPreferredTagIds: scored.matchedPreferredTagIds,
    matchedAvoidedTagIds: scored.matchedAvoidedTagIds,
    hardFilterReasons: scored.hardFilterReasons,
    penaltyReasons: scored.penaltyReasons,
    fallbackReason: scored.fallbackReason,
    historyFilterEnabled: scored.historyFilterEnabled,
    excludedHistoryRestaurantIds: scored.excludedHistoryRestaurantIds,
    historyPenaltyReasons: scored.historyPenaltyReasons,
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
    imageUrl: getCandidateImageUrl(restaurant, scored.matchedPreferredTagIds),
    source
  };
}

function buildReasonSummary(candidate: RecommendationCandidate | undefined): string | undefined {
  if (!candidate) {
    return undefined;
  }

  return `${candidate.name} 匹配度 ${candidate.confidenceScore ?? 0}%，${candidate.reason}`;
}

function buildReasons(
  restaurant: Restaurant,
  matchedPreferredTagIds: TagId[],
  negativeConflict: ReturnType<typeof getNegativeConflict>,
  preference?: UserPreferenceProfile,
  fallbackReason?: string,
  temperatureConflict: ReturnType<typeof getTemperatureConflict> = { severity: 'none', label: '', penalty: 0 },
  nonMealBudgetMismatch = false
): string[] {
  const reasons: string[] = [];

  if (matchedPreferredTagIds.length > 0) {
    reasons.push(`匹配 ${matchedPreferredTagIds.slice(0, 3).join('、')} 等偏好`);
  }

  if (temperatureConflict.severity !== 'none') {
    reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters <= preference.maxDistanceMeters
  ) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米，在你的范围内`);
  } else if (restaurant.distanceMeters !== undefined) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }

  if (preference?.budgetLevel !== undefined && restaurant.averageCostYuan !== undefined) {
    const budgetMax = getBudgetMaxYuan(preference);
    const budgetRange = getBudgetRange(preference);
    if (nonMealBudgetMismatch) {
      reasons.push(`人均约 ${restaurant.averageCostYuan} 元，低于你选择的预算档，按普通匹配展示`);
    } else if (
      preference.budgetLevel >= 5 &&
      budgetRange.min !== undefined &&
      restaurant.averageCostYuan < budgetRange.min
    ) {
      reasons.push(`人均约 ${restaurant.averageCostYuan} 元，低于所选预算档，作为近预算补位`);
    } else {
      reasons.push(
        restaurant.averageCostYuan <= budgetMax
          ? `人均约 ${restaurant.averageCostYuan} 元，符合预算`
          : `人均约 ${restaurant.averageCostYuan} 元，略高于预算`
      );
    }
  }

  if (restaurant.openStatus === 'open') {
    reasons.push('当前营业中');
  }

  if (negativeConflict.severity !== 'none') {
    reasons.push(`含负向偏好 ${negativeConflict.labels.join('、')}，已明显降权`);
  }

  if (fallbackReason) {
    reasons.push(fallbackReason);
  }

  if (reasons.length === 0) {
    reasons.push(restaurant.description ?? '综合距离、价格和口味后较适合今天');
  }

  return reasons.slice(0, 5);
}

function buildPenaltyReasons(
  restaurant: Restaurant,
  negativeConflict: ReturnType<typeof getNegativeConflict>,
  preference?: UserPreferenceProfile,
  fallbackReason?: string,
  temperatureConflict: ReturnType<typeof getTemperatureConflict> = { severity: 'none', label: '', penalty: 0 },
  nonMealBudgetMismatch = false
): string[] {
  const reasons: string[] = [];

  if (negativeConflict.severity !== 'none') {
    reasons.push(`负向偏好冲突：${negativeConflict.labels.join('、')}`);
  }

  if (temperatureConflict.severity !== 'none') {
    reasons.push(`温度偏好冲突：${temperatureConflict.label}`);
  }

  if (
    preference?.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
  ) {
    reasons.push(`超出距离偏好 ${restaurant.distanceMeters - preference.maxDistanceMeters} 米`);
  }

  if (isOverBudget(restaurant, preference)) {
    reasons.push('超出预算偏好');
  }

  if (nonMealBudgetMismatch) {
    reasons.push('高预算饮品/甜品候选不足，该店价格低于所选预算档，匹配度已下调');
  }

  if (fallbackReason) {
    reasons.push(fallbackReason);
  }

  return reasons;
}

function getPreferredTagIds(preference?: UserPreferenceProfile): TagId[] {
  const preferred = new Set([...(preference?.preferredTagIds ?? []), ...(preference?.positiveTags ?? [])]);
  const selected = new Set(preference?.selectedOptionIds ?? []);

  if (BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId))) {
    preferred.add('chain_brand');

    if ((preference?.budgetLevel ?? 3) >= 6) {
      preferred.add('premium_brand');
    } else if ((preference?.budgetLevel ?? 3) >= 4) {
      preferred.add('mid_chain');
    } else {
      preferred.add('low_chain');
    }
  }

  if (BRAND_INDEPENDENT_OPTION_IDS.some((optionId) => selected.has(optionId))) {
    preferred.add('independent_store');
    preferred.add('street_shop');
  }

  return [...preferred];
}

function getAvoidedTagIds(preference?: UserPreferenceProfile): TagId[] {
  const avoided = new Set([...(preference?.avoidedTagIds ?? []), ...(preference?.negativeTags ?? [])]);
  const preferred = new Set(getPreferredTagIds(preference));
  const selected = new Set(preference?.selectedOptionIds ?? []);
  const wantsNonMeal =
    selected.has('intent_drink') ||
    selected.has('intent_dessert') ||
    selected.has('time_afternoon_tea') ||
    selected.has('prefer_milk_tea') ||
    selected.has('prefer_coffee') ||
    selected.has('prefer_bakery_dessert');
  const wantsMeal =
    selected.has('intent_meal') ||
    selected.has('meal_type_meal') ||
    selected.has('satiety_filling') ||
    selected.has('time_lunch') ||
    selected.has('time_dinner');
  const wantsDrinkOnly = DRINK_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const wantsDessertOnly = DESSERT_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const wantsChainBrand = BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId));
  const wantsIndependentStore = BRAND_INDEPENDENT_OPTION_IDS.some((optionId) => selected.has(optionId));

  if (LIGHT_HEALTHY_PREFERENCE_TAGS.some((tagId) => preferred.has(tagId))) {
    [...GREASY_CONFLICT_TAGS, ...LIGHT_CONFLICT_TAGS].forEach((tagId) => avoided.add(tagId));
  }

  if (wantsNonMeal || (NON_MEAL_TAGS.some((tagId) => preferred.has(tagId)) && !wantsMeal)) {
    MEAL_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (wantsDrinkOnly) {
    [...MEAL_TAGS, 'snack', 'dim_sum'].forEach((tagId) => avoided.add(tagId));
  }

  if (selected.has('prefer_milk_tea')) {
    ['coffee', 'dessert', 'afternoon_tea'].forEach((tagId) => avoided.add(tagId));
  }

  if (selected.has('prefer_coffee')) {
    ['milk_tea', 'dessert'].forEach((tagId) => avoided.add(tagId));
  }

  if (selected.has('prefer_bakery_dessert') || selected.has('intent_dessert')) {
    ['milk_tea', 'coffee', 'drink'].forEach((tagId) => avoided.add(tagId));
  }

  if (wantsDessertOnly) {
    ['meal', 'rice', 'noodle', 'staple', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum'].forEach((tagId) =>
      avoided.add(tagId)
    );
  }

  if (wantsMeal) {
    NON_MEAL_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('vegetarian') || avoided.has('meat_heavy') || avoided.has('pork')) {
    VEGETARIAN_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('halal') || avoided.has('pork')) {
    HALAL_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet')) {
    LOW_SUGAR_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('high_protein')) {
    HIGH_PROTEIN_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (preferred.has('allergy_sensitive')) {
    ALLERGY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (avoided.has('spicy')) {
    SPICY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (avoided.has('strong_flavor')) {
    LIGHT_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) {
    GREASY_CONFLICT_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  if (wantsChainBrand) {
    ['independent_store', 'street_shop'].forEach((tagId) => avoided.add(tagId));

    if ((preference?.budgetLevel ?? 3) >= 6) {
      ['low_chain', 'mid_chain'].forEach((tagId) => avoided.add(tagId));
    } else if ((preference?.budgetLevel ?? 3) >= 5) {
      avoided.add('low_chain');
    } else if ((preference?.budgetLevel ?? 3) <= 3) {
      avoided.add('premium_brand');
    }
  }

  if (wantsIndependentStore) {
    CHAIN_BRAND_TAGS.forEach((tagId) => avoided.add(tagId));
  }

  return [...avoided];
}

function getNegativeConflict(restaurant: Restaurant, preference?: UserPreferenceProfile) {
  const avoided = new Set(getAvoidedTagIds(preference));
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantSignalText(restaurant);
  const tags = new Set<TagId>();
  const labels = new Set<string>();
  let severity: 'none' | 'soft' | 'hard' = 'none';
  const explicitNoSpicy = avoided.has('spicy');
  const explicitVegetarian = preferred.has('vegetarian');
  const explicitHalal = preferred.has('halal') || avoided.has('pork');
  const explicitLowSugar = preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet');
  const explicitHighProtein = preferred.has('high_protein');
  const explicitAllergy = preferred.has('allergy_sensitive');
  const selected = new Set(preference?.selectedOptionIds ?? []);
  const explicitDrinkOnly = DRINK_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitDessertOnly = DESSERT_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitNonMeal = explicitDrinkOnly || explicitDessertOnly || preferred.has('non_meal');
  const explicitChainBrand = BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitIndependentStore = BRAND_INDEPENDENT_OPTION_IDS.some((optionId) => selected.has(optionId));
  const setSeverity = (next: 'soft' | 'hard') => {
    severity = severity === 'hard' || next === 'hard' ? 'hard' : 'soft';
  };

  tagIds.forEach((tagId) => {
    if (
      explicitChainBrand &&
      (preference?.budgetLevel ?? 3) >= 6 &&
      tagIds.includes('premium_brand') &&
      (tagId === 'mid_chain' || tagId === 'low_chain')
    ) {
      return;
    }

    if (avoided.has(tagId)) {
      tags.add(tagId);
      labels.add(tagId);
      if (
        (explicitNoSpicy && SPICY_CONFLICT_TAGS.includes(tagId)) ||
        (explicitHalal && HALAL_CONFLICT_TAGS.includes(tagId)) ||
        (explicitVegetarian && VEGETARIAN_CONFLICT_TAGS.includes(tagId)) ||
        (explicitAllergy && ALLERGY_CONFLICT_TAGS.includes(tagId))
      ) {
        setSeverity('hard');
      } else {
        setSeverity('soft');
      }
    }
  });

  if (explicitNoSpicy && [...SPICY_KEYWORDS, ...SPICY_HEAVY_KEYWORDS].some((keyword) => text.includes(keyword))) {
    SPICY_CONFLICT_TAGS.forEach((tagId) => {
      if (tagIds.includes(tagId) || tagId === 'spicy') {
        tags.add(tagId);
      }
    });
    labels.add('辣/麻辣/川湘相关');
    severity = 'hard';
  }

  if (
    (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) &&
    GREASY_KEYWORDS.some((keyword) => text.includes(keyword))
  ) {
    GREASY_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('油腻/油炸/烧烤相关');
    severity = severity === 'hard' ? 'hard' : 'soft';
  }

  if (explicitHalal && PORK_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HALAL_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('pork related');
    setSeverity('hard');
  }

  if (explicitVegetarian && MEAT_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    VEGETARIAN_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('meat-heavy related');
    setSeverity('hard');
  }

  if (explicitLowSugar && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    LOW_SUGAR_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('sweet or sugary related');
    setSeverity('soft');
  }

  if (explicitHighProtein && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HIGH_PROTEIN_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('low protein sweet related');
    setSeverity('soft');
  }

  if (explicitAllergy && ALLERGY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    ALLERGY_CONFLICT_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('allergy risk related');
    setSeverity('hard');
  }

  if (avoided.has('meal') && MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    MEAL_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('meal category conflict');
    setSeverity(explicitNonMeal ? 'hard' : 'soft');
  }

  if (avoided.has('non_meal') && NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    NON_MEAL_TAGS.forEach((tagId) => tags.add(tagId));
    labels.add('non-meal category conflict');
    setSeverity('soft');
  }

  if (
    explicitNonMeal &&
    MEAL_TAGS.some((tagId) => tagIds.includes(tagId)) &&
    !hasNonMealEvidence(tagIds, text)
  ) {
    MEAL_TAGS.forEach((tagId) => {
      if (tagIds.includes(tagId)) {
        tags.add(tagId);
      }
    });
    labels.add('explicit non-meal intent conflicts with meal candidate');
    setSeverity('hard');
  }

  if (explicitNonMeal && isLikelyMealCandidate(restaurant, tagIds)) {
    tags.add('meal');
    labels.add('explicit non-meal intent conflicts with restaurant candidate');
    setSeverity('hard');
  }

  if (explicitDrinkOnly && tagIds.includes('snack') && !tagIds.some((tagId) => NON_MEAL_TAGS.includes(tagId))) {
    tags.add('snack');
    labels.add('drink intent conflicts with snack or dim sum candidate');
    setSeverity('hard');
  }

  if (selected.has('prefer_milk_tea') && tagIds.includes('coffee') && !tagIds.includes('milk_tea')) {
    tags.add('coffee');
    labels.add('explicit milk tea intent conflicts with coffee candidate');
    setSeverity('hard');
  }

  if (selected.has('prefer_coffee') && tagIds.includes('milk_tea') && !tagIds.includes('coffee')) {
    tags.add('milk_tea');
    labels.add('explicit coffee intent conflicts with milk tea candidate');
    setSeverity('hard');
  }

  if (
    explicitDessertOnly &&
    hasCoffeeTextEvidence(text) &&
    !hasDessertBakeryTextEvidence(text) &&
    !tagIds.includes('dessert')
  ) {
    tags.add('coffee');
    tags.add('drink');
    labels.add('dessert intent conflicts with pure coffee candidate');
    setSeverity(selected.has('prefer_bakery_dessert') ? 'hard' : 'soft');
  }

  if (explicitChainBrand && (tagIds.includes('independent_store') || tagIds.includes('street_shop'))) {
    ['independent_store', 'street_shop'].forEach((tagId) => {
      if (tagIds.includes(tagId)) {
        tags.add(tagId);
      }
    });
    labels.add('brand preference conflicts with independent store');
    setSeverity('hard');
  }

  if (explicitIndependentStore && CHAIN_BRAND_TAGS.some((tagId) => tagIds.includes(tagId))) {
    CHAIN_BRAND_TAGS.forEach((tagId) => {
      if (tagIds.includes(tagId)) {
        tags.add(tagId);
      }
    });
    labels.add('independent store preference conflicts with chain brand');
    setSeverity('soft');
  }

  return {
    severity,
    tags: [...tags],
    labels: [...labels]
  };
}

function shouldSuppressPremiumChainAvoidanceTag(
  tagId: TagId,
  candidateTagIds: TagId[],
  preference?: UserPreferenceProfile
): boolean {
  const selected = new Set(preference?.selectedOptionIds ?? []);

  return (
    BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId)) &&
    (preference?.budgetLevel ?? 3) >= 6 &&
    candidateTagIds.includes('premium_brand') &&
    (tagId === 'mid_chain' || tagId === 'low_chain')
  );
}

function getTemperatureConflict(restaurant: Restaurant, preference?: UserPreferenceProfile) {
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantSignalText(restaurant);
  const wantsHot = preferred.has('hot') || preferred.has('comfort') || preferred.has('congee');
  const wantsCold = preferred.has('cold') || preferred.has('salad') || preferred.has('fresh');
  const hasHot = tagIds.some((tagId) => HOT_FOOD_TAGS.includes(tagId));
  const hasCold = tagIds.some((tagId) => COLD_FOOD_TAGS.includes(tagId));
  const hasColdOrRoomTemperatureText = COLD_OR_ROOM_TEMPERATURE_KEYWORDS.some((keyword) =>
    text.includes(keyword.toLowerCase())
  );

  if (wantsHot && !hasHot && (hasCold || hasColdOrRoomTemperatureText)) {
    return { severity: 'soft' as const, label: 'wanted hot food, candidate is cold or room-temperature', penalty: 34 };
  }

  if (wantsCold && hasHot && !hasCold) {
    return { severity: 'soft' as const, label: 'wanted cold or light food, candidate is hot-heavy', penalty: 16 };
  }

  return { severity: 'none' as const, label: '', penalty: 0 };
}

function getRestaurantTagIds(restaurant: Restaurant): TagId[] {
  const explicitTagIds = restaurant.tagIds ?? restaurant.tagRefs?.map((tag) => tag.id) ?? restaurant.tags ?? [];
  const inferredTagIds = inferTagIdsFromRestaurantText(restaurant, explicitTagIds);
  const tagIds = new Set<TagId>([...explicitTagIds, ...inferredTagIds]);
  const text = getRestaurantSignalText(restaurant);

  if (hasPremiumMealOverrideEvidence(restaurant, [...tagIds], text)) {
    cleanNonMealTagsFromPremiumMealCandidate(tagIds);
  } else if (hasStrongNonMealTextEvidence(text)) {
    cleanMealTagsFromNonMealCandidate(tagIds);
  }

  if (hasColdOrRoomTemperatureTextEvidence(text)) {
    cleanHotTagsFromColdCandidate(tagIds);
  }

  return [...tagIds];
}

function inferTagIdsFromRestaurantText(restaurant: Restaurant, explicitTagIds: TagId[]): TagId[] {
  const text = getRestaurantSignalText(restaurant);
  const inferred = new Set<TagId>();
  const explicitlyNotSpicy =
    explicitTagIds.includes('not_spicy') || NOT_SPICY_KEYWORDS.some((keyword) => text.includes(keyword));

  INFERRED_TAG_RULES.forEach((rule) => {
    if (rule.skipWhenNotSpicy && explicitlyNotSpicy) {
      return;
    }

    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      rule.tags.forEach((tagId) => inferred.add(tagId));
    }
  });

  if (!explicitlyNotSpicy && SPICY_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    DEFAULT_SPICY_HEAVY_TAGS.forEach((tagId) => inferred.add(tagId));
  }

  if (isLikelyMealText(text) && !hasNonMealEvidence([...explicitTagIds, ...inferred], text)) {
    inferred.add('meal');
  }

  if (['虾饺', '烧卖', '烧麦', '茶点', '早茶', '点心'].some((keyword) => text.includes(keyword))) {
    ['dim_sum', 'meal', 'snack'].forEach((tagId) => inferred.add(tagId));
  }

  if (LOW_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'low_chain', 'quick'].forEach((tagId) => inferred.add(tagId));
  }

  if (KNOWN_LOW_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'low_chain', 'quick'].forEach((tagId) => inferred.add(tagId));
  }

  if (MID_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((tagId) => inferred.add(tagId));
  }

  if (KNOWN_MID_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((tagId) => inferred.add(tagId));
  }

  if (PREMIUM_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((tagId) => inferred.add(tagId));
  }

  if (KNOWN_PREMIUM_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((tagId) => inferred.add(tagId));
  }

  if (MALL_STORE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    inferred.add('mall_store');
  }

  if (hasMallStoreEvidence(text)) {
    inferred.add('mall_store');
  }

  if (INDEPENDENT_STORE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['independent_store', 'street_shop'].forEach((tagId) => inferred.add(tagId));
  }

  if (hasPremiumMealOverrideEvidence(restaurant, [...explicitTagIds, ...inferred], text)) {
    inferred.add('meal');
    inferred.add('premium_brand');
    cleanNonMealTagsFromPremiumMealCandidate(inferred);
  } else if (hasStrongNonMealTextEvidence(text)) {
    cleanMealTagsFromNonMealCandidate(inferred);
  }

  return [...inferred];
}

function hasStrongNonMealTextEvidence(text: string): boolean {
  return NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasColdOrRoomTemperatureTextEvidence(text: string): boolean {
  return COLD_OR_ROOM_TEMPERATURE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasCoffeeTextEvidence(text: string): boolean {
  return COFFEE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasDessertBakeryTextEvidence(text: string): boolean {
  return DESSERT_BAKERY_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasPremiumMealOverrideEvidence(
  restaurant: Restaurant,
  tagIds: TagId[],
  text = getRestaurantSignalText(restaurant)
): boolean {
  const estimatedCost = getEstimatedCost(restaurant);
  const hasPremiumTag = tagIds.includes('premium_brand');
  const hasMealSignal = hasPremiumMealSignal(text);
  const hasNonMeal = hasNonMealEvidence(tagIds, text);
  const hasPureNonMealBusiness =
    PURE_NON_MEAL_BUSINESS_KEYWORDS.some((keyword) => text.includes(keyword)) && !hasMealSignal;

  if (hasPureNonMealBusiness || (hasNonMeal && !hasMealSignal)) {
    return false;
  }

  return hasPremiumTag || hasMealSignal || ((estimatedCost ?? 0) >= 200 && !hasNonMeal);
}

function hasPremiumMealSignal(text: string): boolean {
  return (
    PREMIUM_MEAL_SIGNAL_KEYWORDS.some((keyword) => text.includes(keyword)) ||
    /高端|黑珍珠|米其林|omakase|fine dining|hotel restaurant|private kitchen|chef restaurant|chef|主厨|私厨|私房|牛排馆|海鲜放题|法餐|高端日料|酒店餐厅|星级酒店|白天鹅|炳胜|利苑|大董|新荣记|甬府|GRILL|grill|烧肉|融合料理|创意菜|grill|chef|omakase|fine dining/i.test(text)
  );
}

function cleanNonMealTagsFromPremiumMealCandidate(tagIds: Set<TagId>) {
  [
    'non_meal',
    'dessert',
    'milk_tea',
    'coffee',
    'drink',
    'afternoon_tea',
    'sweet',
    'sugary_drink',
    'quick',
    'fast_service',
    'low_queue',
    'congee',
    'hot',
    'snack',
    'solo',
    'set_meal'
  ].forEach((tagId) => {
    tagIds.delete(tagId as TagId);
  });
  tagIds.add('meal');
  tagIds.add('premium_brand');
  tagIds.add('relaxed');
  tagIds.add('slow');
}

function cleanMealTagsFromNonMealCandidate(tagIds: Set<TagId>) {
  ['meal', 'staple', 'rice', 'noodle', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum', 'quick'].forEach((tagId) => {
    tagIds.delete(tagId as TagId);
  });
  tagIds.add('non_meal');
}

function cleanHotTagsFromColdCandidate(tagIds: Set<TagId>) {
  ['hot', 'comfort', 'congee', 'noodle', 'hotpot', 'malatang'].forEach((tagId) => {
    tagIds.delete(tagId as TagId);
  });
  tagIds.add('cold');
}

function getRestaurantText(restaurant: Restaurant): string {
  return [
    restaurant.name,
    restaurant.category,
    restaurant.description,
    restaurant.address,
    ...(restaurant.tags ?? []),
    ...(restaurant.signatureDishes ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getRestaurantSignalText(restaurant: Restaurant): string {
  return [
    restaurant.name,
    restaurant.category,
    restaurant.description,
    ...(restaurant.tags ?? []),
    ...(restaurant.signatureDishes ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isLikelyMealCandidate(restaurant: Restaurant, tagIds: TagId[]): boolean {
  const text = getRestaurantSignalText(restaurant);

  if (hasNonMealEvidence(tagIds, text)) {
    return false;
  }

  return (
    MEAL_TAGS.some((tagId) => tagIds.includes(tagId)) ||
    isLikelyMealText(text) ||
    (getEstimatedCost(restaurant) ?? 0) >= 100
  );
}

function isLikelyMealText(text: string): boolean {
  return [...MEAL_KEYWORDS, ...BROAD_MEAL_KEYWORDS].some((keyword) => text.includes(keyword));
}

function hasNonMealEvidence(tagIds: TagId[], text: string): boolean {
  return (
    NON_MEAL_TAGS.some((tagId) => tagIds.includes(tagId)) ||
    NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}

function hasStrongNonMealEvidence(tagIds: TagId[], text: string): boolean {
  return (
    NON_MEAL_TAGS.some((tagId) => tagIds.includes(tagId)) ||
    PURE_NON_MEAL_BUSINESS_KEYWORDS.some((keyword) => text.includes(keyword)) ||
    ['冷饮店', '饮品店', '奶茶店', '咖啡店', '甜品店', '糕饼店', '蛋糕店', '面包店', '烘焙店'].some((keyword) => text.includes(keyword))
  );
}

function getCandidateImageUrl(restaurant: Restaurant, matchedPreferredTagIds: TagId[]): string | undefined {
  return normalizeImageUrl(restaurant.coverImageUrl) || getFallbackImageUrl(restaurant, matchedPreferredTagIds);
}

function normalizeImageUrl(url: string | undefined): string | undefined {
  return typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : undefined;
}

function getFallbackImageUrl(restaurant: Restaurant, matchedPreferredTagIds: TagId[]): string {
  const text = getRestaurantText({
    ...restaurant,
    tags: [...(restaurant.tags ?? []), ...matchedPreferredTagIds]
  });

  if (/premium|高端|黑珍珠|米其林|omakase|fine dining|法餐|日料|炳胜|利苑|premium_brand/.test(text)) {
    return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80';
  }

  if (/奶茶|茶饮|milk_tea|霸王茶姬|喜茶|奈雪|一点点|1点点|蜜雪冰城|柠檬茶|linlee|麒麟大口茶|大口茶|koi|thé|阿嬷手作|去茶山|古茗|茉莉奶白|爷爷不泡茶|茶理宜世|茶记大咖|t9tea|tamkoko/.test(text)) {
    return 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=900&q=80';
  }

  if (/咖啡|coffee|cafe|星巴克|starbucks|瑞幸|luckin|manner|peet|costa|tims|tim hortons/.test(text)) {
    return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80';
  }

  if (/甜品|蛋糕|面包|dessert|bakery|gelato|pinvita|butterful|creamorous|珞珞|冰淇淋|paper stone|哈根达斯|haagen|bagel|贝果|zakuzaku|双皮奶|marmalade|bake land|老鼎丰/.test(text)) {
    return 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80';
  }

  if (/辣|川|湘|火锅|麻辣|spicy|strong_flavor/.test(text)) {
    return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80';
  }

  if (/轻食|沙拉|健康|清淡|light|healthy|salad/.test(text)) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80';
  }

  if (/面|粉|粥|noodle|congee/.test(text)) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80';
  }

  if (/饭|米|盖饭|rice/.test(text)) {
    return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80';
  }

  if (/小吃|包子|饺|snack|dim_sum/.test(text)) {
    return 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=80';
  }

  return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80';
}

function intersect(left: TagId[], right: TagId[]): TagId[] {
  const rightSet = new Set(right);
  return [...new Set(left.filter((item) => rightSet.has(item)))];
}

function getPreferenceScore(matchedPreferredTagIds: TagId[]): number {
  return Math.min(
    34,
    matchedPreferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0)
  );
}

function getNegativePenalty(conflict: ReturnType<typeof getNegativeConflict>): number {
  if (conflict.severity === 'hard') {
    return 88;
  }

  if (conflict.severity === 'soft') {
    return Math.min(45, 22 + conflict.tags.length * 7);
  }

  return 0;
}

function getDistanceScore(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  fallbackUsed = false
): number {
  if (restaurant.distanceMeters === undefined) {
    return 0;
  }

  const maxDistance = preference?.maxDistanceMeters ?? 1500;
  const distanceFlexible =
    preference?.selectedOptionIds?.includes('distance_any') === true || maxDistance >= 5000;

  if (distanceFlexible) {
    if (restaurant.distanceMeters <= 1000) {
      return 6;
    }

    if (restaurant.distanceMeters <= maxDistance) {
      return 0;
    }

    return fallbackUsed ? -12 : -8;
  }

  const ratio = restaurant.distanceMeters / maxDistance;

  if (ratio <= 0.5) {
    return fallbackUsed ? 10 : 18;
  }

  if (ratio <= 1) {
    return fallbackUsed ? 5 : 12;
  }

  if (ratio <= 1.5) {
    return fallbackUsed ? -22 : -16;
  }

  return fallbackUsed ? -42 : -30;
}

function getPriceScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  if (preference?.budgetLevel === undefined) {
    return 0;
  }

  const estimatedCost = getEstimatedCost(restaurant);
  const flexibleNonMealBudget = isFlexibleNonMealBudget(preference);

  if (estimatedCost === undefined) {
    if (flexibleNonMealBudget) {
      return -10;
    }

    if (preference.budgetLevel >= 6) {
      return -80;
    }

    if (preference.budgetLevel >= 5) {
      return -30;
    }

    if (preference.budgetLevel >= 4) {
      return -14;
    }

    return -6;
  }

  const range = getBudgetRange(preference);

  if (estimatedCost <= range.max && (range.min === undefined || estimatedCost >= range.min)) {
    return 14;
  }

  if (range.min !== undefined && estimatedCost < range.min) {
    if (flexibleNonMealBudget) {
      // 非正餐意图（想喝饮品/吃甜品）：人均低于正餐预算属正常，不因便宜而扣分
      return estimatedCost >= range.min * 0.4 ? 14 : 6;
    }

    if ((preference.budgetLevel ?? 3) >= 4) {
      if (estimatedCost >= range.min * 0.85) {
        return 4;
      }

      if (estimatedCost >= range.min * 0.65) {
        return -8;
      }

      return preference.budgetLevel >= 6 ? -70 : -45;
    }

    return estimatedCost >= range.min * 0.75 ? 4 : -6;
  }

  if (estimatedCost <= range.max * 1.1) {
    return -10;
  }

  if (estimatedCost <= range.max * 1.2) {
    return -22;
  }

  return -34;
}

function getTimeScore(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  const minutes = estimateMinutes(restaurant);
  const maxMinutes = preference?.maxEstimatedMinutes ?? 45;

  if (minutes <= Math.min(25, maxMinutes)) {
    return 8;
  }

  if (minutes <= maxMinutes) {
    return 4;
  }

  return -8;
}

function getRatingScore(restaurant: Restaurant): number {
  if (restaurant.rating === undefined) {
    return 0;
  }

  return clamp((restaurant.rating - 3.6) * 6, 0, 8);
}

function getOpenStatusScore(restaurant: Restaurant): number {
  if (restaurant.openStatus === 'open') {
    return 6;
  }

  if (restaurant.openStatus === 'busy') {
    return 1;
  }

  return 0;
}

function getDataCompletenessScore(restaurant: Restaurant): number {
  const checks = [
    restaurant.distanceMeters !== undefined,
    restaurant.averageCostYuan !== undefined || restaurant.priceLevel !== undefined,
    restaurant.rating !== undefined,
    restaurant.openStatus !== undefined && restaurant.openStatus !== 'unknown',
    Boolean(restaurant.coverImageUrl),
    getRestaurantTagIds(restaurant).length > 0
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 10);
}

function getHardConstraintConfidence(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  fallbackReason?: string
): number {
  let score = 0;

  if (restaurant.openStatus === 'open' || restaurant.openStatus === 'busy' || restaurant.openStatus === 'unknown') {
    score += 10;
  }

  if (
    preference?.maxDistanceMeters === undefined ||
    restaurant.distanceMeters === undefined ||
    restaurant.distanceMeters <= preference.maxDistanceMeters
  ) {
    score += 10;
  } else {
    score += fallbackReason ? 3 : 0;
  }

  if (!isOverBudget(restaurant, preference)) {
    score += 10;
  } else if (!isClearlyOverBudget(restaurant, preference)) {
    score += 3;
  }

  return score;
}

function getPositivePreferenceConfidence(preferredTagIds: TagId[], matchedPreferredTagIds: TagId[]): number {
  if (preferredTagIds.length === 0) {
    return 12;
  }

  const preferredWeight = preferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0);
  const matchedWeight = matchedPreferredTagIds.reduce((sum, tagId) => sum + (TAG_WEIGHTS[tagId] ?? 6), 0);

  return Math.round(clamp((matchedWeight / Math.max(1, preferredWeight)) * 25, 0, 25));
}

function getNegativeAvoidanceConfidence(conflict: ReturnType<typeof getNegativeConflict>): number {
  if (conflict.severity === 'hard') {
    return 0;
  }

  if (conflict.severity === 'soft') {
    return 8;
  }

  return 25;
}

function getRelativeLeadScore(ranked: ScoredRestaurant[], index: number): number {
  if (index !== 0 || ranked.length < 2) {
    return 3;
  }

  const lead = ranked[0].score - ranked[1].score;
  return Math.round(clamp(lead / 3, 2, 10));
}

function calculateConfidenceScore(input: {
  hardConstraintScore: number;
  positivePreferenceScore: number;
  negativeAvoidanceScore: number;
  dataCompletenessScore: number;
  relativeLeadScore: number;
  negativeConflict: ReturnType<typeof getNegativeConflict>;
  temperatureConflict: ReturnType<typeof getTemperatureConflict>;
  priceOverBudget: boolean;
  priceUnknown: boolean;
  timeOverPreference: boolean;
  fallbackUsed: boolean;
  candidatePoolWeak: boolean;
}): number {
  let score =
    input.hardConstraintScore +
    input.positivePreferenceScore +
    input.negativeAvoidanceScore +
    input.dataCompletenessScore +
    input.relativeLeadScore;

  if (input.negativeConflict.severity === 'hard') {
    score = Math.min(score, 42);
  } else if (input.negativeConflict.severity === 'soft') {
    score = Math.min(score, 70);
  }

  if (input.temperatureConflict.severity === 'soft') {
    score = Math.min(score, 64);
  }

  if (input.priceOverBudget) {
    score = Math.min(score, 70);
  }

  if (input.priceUnknown) {
    score = Math.min(score, 68);
  }

  if (input.timeOverPreference) {
    score = Math.min(score, 70);
  }

  if (input.fallbackUsed) {
    score = Math.min(Math.max(score - 10, 45), 64);
  }

  if (input.candidatePoolWeak) {
    score = Math.min(score, 72);
  }

  return Math.round(clamp(score, 0, 95));
}

function getConfidenceLabel(score: number): RecommendationConfidenceLabel {
  if (score >= 76) {
    return 'high';
  }

  if (score >= 55) {
    return 'medium';
  }

  return 'low';
}

function isOverBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (preference?.budgetLevel === undefined) {
    return false;
  }

  const estimatedCost = getEstimatedCost(restaurant);

  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max;
}

function isClearlyOverBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (preference?.budgetLevel === undefined) {
    return false;
  }

  const estimatedCost = getEstimatedCost(restaurant);

  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max * 1.2;
}

function isClearlyUnderBudget(
  restaurant: Restaurant,
  preference?: UserPreferenceProfile,
  allowNearBudgetFallback = false
): boolean {
  if (preference?.budgetLevel === undefined || preference.budgetLevel < 5) {
    return false;
  }

  if (isFlexibleNonMealBudget(preference)) {
    return false;
  }

  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);

  if (range.min === undefined || estimatedCost === undefined) {
    return false;
  }

  if (preference.budgetLevel >= 6) {
    return estimatedCost < range.min;
  }

  return allowNearBudgetFallback ? estimatedCost < 80 : estimatedCost < range.min;
}

function isPriceUnknownForStrictBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  return (
    preference?.budgetLevel !== undefined &&
    preference.budgetLevel >= 5 &&
    !isFlexibleNonMealBudget(preference) &&
    isPriceUnknown(restaurant)
  );
}

function isWeakUnknownPriceForPremiumFallback(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  return (
    preference?.budgetLevel !== undefined &&
    preference.budgetLevel >= 6 &&
    !isFlexibleNonMealBudget(preference) &&
    isPriceUnknown(restaurant) &&
    !hasPremiumCandidateEvidence(restaurant)
  );
}

function isHighBudgetNonMealNoise(
  restaurant: Restaurant,
  preference: UserPreferenceProfile | undefined,
  tagIds = getRestaurantTagIds(restaurant),
  text = getRestaurantSignalText(restaurant)
): boolean {
  if ((preference?.budgetLevel ?? 3) < 5 || isFlexibleNonMealBudget(preference)) {
    return false;
  }

  if (!hasNonMealEvidence(tagIds, text)) {
    return false;
  }

  if (hasPremiumCandidateEvidence(restaurant, text)) {
    return false;
  }

  const range = getBudgetRange(preference as UserPreferenceProfile);
  const estimatedCost = getEstimatedCost(restaurant);

  return estimatedCost === undefined || (range.min !== undefined && estimatedCost < range.min);
}

function isFlexibleNonMealBudget(preference?: UserPreferenceProfile): boolean {
  if (!preference) {
    return false;
  }

  const selected = new Set(preference.selectedOptionIds ?? []);
  const preferred = new Set(getPreferredTagIds(preference));

  return (
    DRINK_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId)) ||
    DESSERT_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId)) ||
    preferred.has('non_meal') ||
    preferred.has('drink') ||
    preferred.has('coffee') ||
    preferred.has('milk_tea') ||
    preferred.has('dessert') ||
    preferred.has('afternoon_tea')
  );
}

function isHighBudgetNonMealUnderBudget(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  // 仅在高预算档(>=5)选了便宜非正餐时才提示"低于预算档"；低预算选便宜饮品属正常，不下调匹配度
  if (!isFlexibleNonMealBudget(preference) || (preference?.budgetLevel ?? 3) < 5) {
    return false;
  }

  const range = getBudgetRange(preference as UserPreferenceProfile);
  const estimatedCost = getEstimatedCost(restaurant);

  return range.min !== undefined && estimatedCost !== undefined && estimatedCost < range.min;
}

function isUnderRequestedBudgetRange(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  if (!preference || preference.budgetLevel === undefined || preference.budgetLevel < 5 || isFlexibleNonMealBudget(preference)) {
    return false;
  }

  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);

  return range.min !== undefined && estimatedCost !== undefined && estimatedCost < range.min;
}

function getHighBudgetNonMealConfidenceCap(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  const estimatedCost = getEstimatedCost(restaurant);

  if ((preference?.budgetLevel ?? 3) >= 6 && (estimatedCost ?? 0) < 100) {
    return 58;
  }

  return 64;
}

function getUnderBudgetConfidenceCap(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  const estimatedCost = getEstimatedCost(restaurant) ?? 0;

  if ((preference?.budgetLevel ?? 3) >= 6) {
    if (estimatedCost >= 150) {
      return 70;
    }

    if (estimatedCost >= 100) {
      return 60;
    }

    return 48;
  }

  if (estimatedCost >= 80) {
    return 70;
  }

  return 58;
}

function getUnderBudgetFinalScoreCap(restaurant: Restaurant, preference?: UserPreferenceProfile): number {
  const estimatedCost = getEstimatedCost(restaurant) ?? 0;

  if ((preference?.budgetLevel ?? 3) >= 6) {
    if (estimatedCost >= 150) {
      return 70;
    }

    if (estimatedCost >= 100) {
      return 60;
    }

    return 42;
  }

  if (estimatedCost >= 80) {
    return 82;
  }

  return 62;
}

function buildDistanceFallbackReason(preference?: UserPreferenceProfile): string {
  const selected = new Set(preference?.selectedOptionIds ?? []);

  if ((preference?.budgetLevel ?? 3) === 5) {
    return '附近 100-200 严格匹配较少，已用近预算候选补位并下调匹配度';
  }

  if ((preference?.budgetLevel ?? 3) >= 6) {
    return '附近 200 元以上严格匹配较少，仅保留有高端信号的候选并下调匹配度';
  }

  if (selected.has('distance_500m') || selected.has('distance_1km')) {
    return '严格距离内符合条件较少，已放宽距离并下调匹配度';
  }

  return '附近严格匹配候选较少，已扩大搜索范围并下调匹配度';
}

function buildNegativeFallbackReason(preference?: UserPreferenceProfile): string {
  if (isExplicitNonMealPreference(preference)) {
    return '同类饮品/甜品候选较少，仅放宽次要偏好，正餐冲突仍会过滤';
  }

  return '附近符合条件较少，已放宽部分次要偏好并下调匹配度';
}

function buildLastResortFallbackReason(preference?: UserPreferenceProfile): string {
  if ((preference?.budgetLevel ?? 3) >= 6) {
    return '附近 200 元以上严格匹配太少，先给你一个低置信备选，可考虑放宽距离或预算';
  }

  if ((preference?.budgetLevel ?? 3) === 5) {
    return '附近 100-200 严格匹配太少，先给你一个低置信备选，可考虑放宽距离或预算';
  }

  if (isExplicitNonMealPreference(preference)) {
    return '同类饮品/甜品严格匹配太少，先给你一个低置信备选';
  }

  return '附近严格匹配太少，先给你一个低置信备选';
}

function isExplicitNonMealPreference(preference?: UserPreferenceProfile): boolean {
  if (!preference) {
    return false;
  }

  const selected = new Set(preference.selectedOptionIds ?? []);

  return (
    selected.has('intent_drink') ||
    selected.has('intent_dessert') ||
    selected.has('prefer_milk_tea') ||
    selected.has('prefer_coffee') ||
    selected.has('prefer_bakery_dessert')
  );
}

function isExplicitMealPreference(preference?: UserPreferenceProfile): boolean {
  if (!preference) {
    return false;
  }

  const selected = new Set(preference.selectedOptionIds ?? []);
  const preferred = new Set(preference.preferredTagIds ?? []);

  return (
    selected.has('intent_meal') ||
    selected.has('intent_staple') ||
    (preferred.has('meal') && !isFlexibleNonMealBudget(preference))
  );
}

function isPriceUnknown(restaurant: Restaurant): boolean {
  return getEstimatedCost(restaurant) === undefined;
}

function isOverTimePreference(restaurant: Restaurant, preference?: UserPreferenceProfile): boolean {
  return preference?.maxEstimatedMinutes !== undefined && estimateMinutes(restaurant) > preference.maxEstimatedMinutes;
}

function getBudgetMaxYuan(preference: UserPreferenceProfile): number {
  return getBudgetRange(preference).max;
}

function getBudgetRange(preference: UserPreferenceProfile): { min?: number; max: number } {
  return BUDGET_LEVEL_TO_RANGE[preference.budgetLevel ?? 3] ?? BUDGET_LEVEL_TO_RANGE[3];
}

function getEstimatedCost(restaurant: Restaurant): number | undefined {
  if (restaurant.averageCostYuan !== undefined && restaurant.averageCostYuan > 0) {
    return restaurant.averageCostYuan;
  }

  if (restaurant.priceLevel !== undefined) {
    return getPriceLevelCost(restaurant.priceLevel);
  }

  return undefined;
}

function getPriceLevelCost(priceLevel: Restaurant['priceLevel']): number {
  if (priceLevel === undefined) {
    return 60;
  }

  return BUDGET_LEVEL_TO_YUAN[priceLevel] ?? 60;
}

function estimateMinutes(restaurant: Restaurant): number {
  const distanceMinutes =
    restaurant.distanceMeters === undefined ? 8 : Math.ceil(restaurant.distanceMeters / 120);
  const diningMinutes = restaurant.category === 'Brunch' ? 35 : 20;
  const busyMinutes = restaurant.openStatus === 'busy' ? 10 : 0;

  return distanceMinutes + diningMinutes + busyMinutes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
