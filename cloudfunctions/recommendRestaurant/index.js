const cloud = initCloudSdk();

const DEFAULT_LIMIT = 3;
const MIN_PRIMARY_POOL_SIZE = 3;
const ALGORITHM_VERSION = 'recommendation-v3.0';
const WEIGHT_PROFILE_ID = 'poi-strategy-v3.0';
const DEFAULT_EXPERIMENT_ID = 'default';
const BUDGET_LEVEL_TO_YUAN = { 1: 20, 2: 30, 3: 60, 4: 100, 5: 200, 6: 320 };
const BUDGET_LEVEL_TO_RANGE = {
  1: { max: 20 },
  2: { max: 30 },
  3: { min: 30, max: 60 },
  4: { min: 60, max: 100 },
  5: { min: 100, max: 200 },
  6: { min: 200, max: 9999 }
};
const TAG_WEIGHTS = {
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
const DRINK_ONLY_OPTION_IDS = ['intent_drink', 'prefer_milk_tea', 'prefer_coffee'];
const DESSERT_ONLY_OPTION_IDS = ['intent_dessert', 'prefer_bakery_dessert'];
const BRAND_CHAIN_OPTION_IDS = ['brand_chain'];
const BRAND_INDEPENDENT_OPTION_IDS = ['brand_independent'];
const CHAIN_BRAND_TAGS = ['chain_brand', 'low_chain', 'mid_chain', 'premium_brand'];
const KNOWN_LOW_CHAIN_KEYWORDS = ['肯德基', '麦当劳', 'kfc', 'mcdonald', '必胜客', '赛百味', '星巴克', '瑞幸', '库迪', '喜茶', '奈雪', '霸王茶姬', '一点点', '1点点', '蜜雪冰城', '古茗', '茶百道', '沪上阿姨'];
const KNOWN_MID_CHAIN_KEYWORDS = ['绿茶餐厅', '外婆家', '九毛九', '太二', '探鱼', '西贝', '海底捞', '巴奴', '木屋烧烤', '农耕记', '点都德', '陶陶居', '费大厨', '湘辣辣', '蛙来哒', '江渔儿', '杨国福', '遇见小面', '大家乐', '大快活'];
const KNOWN_PREMIUM_CHAIN_KEYWORDS = ['广州酒家', '炳胜', '利苑', '白天鹅', '黑珍珠', '米其林', '大董', '新荣记', '甬府', '莆田', '松鹤楼'];
const MALL_STORE_KEYWORDS = ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', '综合体', '购物公园'];
const NON_RESTAURANT_SALES_KEYWORDS = ['销售中心', '批发', '团购', '月饼', '礼盒', '礼品', '年货', '食品销售', '商贸', '展销', '经销', '有礼'];
const VEGETARIAN_CONFLICT_TAGS = ['bbq', 'meat_heavy', 'pork'];
const HALAL_CONFLICT_TAGS = ['pork'];
const LOW_SUGAR_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const HIGH_PROTEIN_CONFLICT_TAGS = ['dessert', 'milk_tea', 'sweet', 'sugary_drink'];
const ALLERGY_CONFLICT_TAGS = ['seafood', 'peanut', 'unclear_ingredients'];
const HOT_FOOD_TAGS = ['hot', 'comfort', 'congee', 'noodle', 'hotpot', 'malatang'];
const COLD_FOOD_TAGS = ['cold', 'salad', 'fresh', 'light', 'healthy', 'low_burden'];
const COLD_OR_ROOM_TEMPERATURE_KEYWORDS = ['赛百味', 'subway', '三明治', '三文治', '沙拉', '轻食', '冷餐', '冷食', '冷饮', '冰饮', '咖啡', '奶茶', '茶饮', '饮品', '甜品', '蛋糕', '面包', '烘焙'];
const COFFEE_KEYWORDS = ['coffee', 'cafe', 'starbucks', 'luckin', 'manner', 'peet', 'costa', 'tims', 'tim hortons', 'cotti'];
const DESSERT_BAKERY_KEYWORDS = ['dessert', 'bakery', 'gelato', 'bagel', 'cream', 'cake', 'bread'];
const DEFAULT_SPICY_HEAVY_TAGS = ['spicy', 'strong_flavor', 'heavy'];
const NOT_SPICY_KEYWORDS = ['不辣', '微辣可选', '清淡', '白汤', '原味', '广式', '粥', '沙拉', '轻食'];
const SPICY_HEAVY_KEYWORDS = ['辣', '麻辣', '小面', '重庆小面', '酸辣粉', '川', '川味', '川菜', '湘', '湘菜', '麻辣烫', '冒菜', '香锅', '麻辣香锅', '火锅', '串串', '水煮', '剁椒', '干锅', '螺蛳粉'];
const INFERRED_TAG_RULES = [
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
  { keywords: ['烧烤', '烤肉', '烤串'], tags: ['bbq', 'heavy', 'strong_flavor', 'group'] },
  { keywords: ['粥', '粉面', '云吞', '馄饨', '广式', '茶餐厅'], tags: ['light', 'congee', 'comfort', 'not_spicy', 'quick', 'hot'] },
  { keywords: ['轻食', '沙拉', '健康', '低卡', '减脂'], tags: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'cold', 'not_spicy'] },
  { keywords: ['盖饭', '便当', '简餐', '套餐'], tags: ['quick', 'staple', 'rice', 'meal', 'set_meal', 'solo'] },
  { keywords: ['包子', '饺子', '煎饼', '烧麦', '小吃'], tags: ['quick', 'snack', 'solo', 'hot'] },
  { keywords: ['日式', '日本', '寿司', '咖喱'], tags: ['rice', 'not_spicy', 'stable', 'solo'] }
];
const SPICY_KEYWORDS = ['辣', '麻辣', '小面', '重庆小面', '川', '川味', '川菜', '湘', '湘菜', '麻辣烫', '冒菜', '香锅', '火锅', '串串'];
const GREASY_KEYWORDS = ['炸', '炸鸡', '鸡柳', '鸡排', '肯德基', 'kfc', '麦当劳', '汉堡王', '烧烤', '烤肉', '汉堡', '薯条', '油炸'];

INFERRED_TAG_RULES.push(
  { keywords: ['茶楼', '早茶'], tags: ['dim_sum', 'meal', 'snack', 'light', 'not_spicy'] },
  { keywords: ['热卤', '卤味', '盛香亭'], tags: ['snack', 'meal', 'hot', 'heavy', 'strong_flavor'] },
  { keywords: ['料理', '南洋料理'], tags: ['meal', 'rice', 'relaxed', 'stable'] },
  { keywords: ['春饼', '东北菜', '东北', '脆肚', '私房菜', '啫啫煲', '煲仔饭', '蛙来哒', '鲜笋', '外婆小聚'], tags: ['meal', 'rice', 'staple', 'relaxed'] },
  { keywords: ['咖啡', 'cafe', 'coffee', '星巴克', '瑞幸', 'luckin', 'manner', 'peet', 'costa', 'tims', 'tim hortons', 'm stand', 'seesaw', 'arabica'], tags: ['coffee', 'drink', 'non_meal', 'afternoon_tea'] },
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
);

const NON_MEAL_KEYWORDS = ['咖啡', '奶茶', '茶饮', '冷饮店', '冷饮', '饮品', '饮品店', '甜品', '甜品店', '糕饼', '糕饼店', '蛋糕', '蛋糕店', '面包', '面包店', '烘焙', '烘焙店', '下午茶', '糖水', '柠檬茶', '蜜雪冰城', '麒麟大口茶', '大口茶', 'coco', '都可', 'koi', 'thé', '阿嬷手作', '去茶山', '古茗', '茉莉奶白', '爷爷不泡茶', '茶理宜世', '茶记大咖', 't9tea', 'tamkoko', '混果汁', '酸奶', '牛奶', 'blueglass', 'gelato', 'butterful', 'creamorous', 'bakery', '冰淇淋', '哈根达斯', 'bagel', '贝果', 'zakuzaku', '双皮奶'];
const MEAL_KEYWORDS = ['盖饭', '套餐', '简餐', '小炒', '炒菜', '火锅', '米饭', '徽菜', '新徽菜', '小菜园', '茶楼', '早茶', '热卤', '卤味', '料理', '春饼', '东北菜', '脆肚', '私房菜', '啫啫煲', '煲仔饭', '蛙来哒', '外婆小聚', '香锅'];
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
const LOW_CHAIN_KEYWORDS = ['肯德基', 'kfc', '麦当劳', 'mcdonald', '赛百味', 'subway', '汉堡王', '华莱士', '塔斯汀', '必胜客', '达美乐', '真功夫', '老乡鸡', '乡村基', '吉野家', '永和大王', '霸王茶姬', '喜茶', '奈雪', '一点点', '1点点', '蜜雪冰城', 'linlee', '麒麟大口茶', '大口茶', 'koi', '阿嬷手作', '去茶山', '古茗', '茉莉奶白', '爷爷不泡茶', '茶理宜世', '茶记大咖', 't9tea', 'tamkoko', '星巴克', 'starbucks', '瑞幸', 'luckin', 'manner', 'peet', 'costa', 'tims', 'tim hortons'];
const MID_CHAIN_KEYWORDS = ['费大厨', '太二', '探鱼', '西贝', '海底捞', '巴奴', '木屋烧烤', '绿茶餐厅', '外婆家', '九毛九', '蛙来哒', '农耕记', '陈鹏鹏', '怂火锅', '大龙燚', '点都德', '陶陶居', '小菜园', '小菜园新徽菜'];
const PREMIUM_CHAIN_KEYWORDS = ['高端餐厅', '高端日料', '米其林', 'omakase', 'fine dining', '法餐', '私房菜', '炳胜', '利苑', '大董', '新荣记', '甬府', '莆田', '松鹤楼', '广州酒家', '白天鹅', '黑珍珠'];
const NATIONAL_LOW_CHAIN_EXTENSION_KEYWORDS = [
  '德克士', '派乐汉堡', '享哆味', '萨莉亚', '南城香', '大米先生', '米村拌饭', '超意兴', '杨铭宇黄焖鸡', '猪角',
  '正新鸡排', '绝味鸭脖', '紫燕百味鸡', '周黑鸭', '煌上煌', '久久丫', '巴比', '小杨生煎',
  '书亦烧仙草', 'CoCo', '都可', '益禾堂', '甜啦啦', '柠季', '林里', '茶颜悦色', '茶话弄', '悸动', '快乐番薯', '阿水大杯茶', '700CC',
  '库迪', 'cotti', '幸运咖', 'NOWWA', '挪瓦', 'M Stand', 'Seesaw'
];
const NATIONAL_MID_CHAIN_EXTENSION_KEYWORDS = [
  '呷哺呷哺', '凑凑', '小龙坎', '朱光玉', '熊喵来了', '半天妖', '烤匠', '很久以前', '西塔老太太', '九田家', '刘炭长',
  '大家乐', '大快活', '捞王', '左庭右院', '八合里', '润园四季', '四季椰林',
  '王品牛排', '豪客来', '大渔铁板烧',
  '和府捞面', '味千拉面', '李先生', '马记永', '陈香贵', '蒙自源', '阿香米线', '五谷渔粉', '喜家德', '袁记云饺', '吉祥馄饨'
];
const NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS = [
  '高端粤菜', '潮菜', '铁板烧', '创意菜', '鮨', '花园酒店', '康莱德', '大渔铁板烧', '1218 GRILL', '中侨会', '雍颐庭',
  '菁禧荟', '遇外滩', '成隆行', '眉州东坡1996', '蓝麒麟', '新长福', '南景饭店', '晴溪莊园',
  '至正潮菜', 'AVANT', 'La Tablée', 'Stone Sal', '言盐', '粤海荟', '齐武', '晴空', '水岸十里', '云璟', '鹏瑞莱佛士',
  '雲鹤', '雲鹤手握', '鮨海老'
];
const pushUniqueKeyword = (target, keywords) => {
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
  '潮菜', '江浙菜', '本帮菜', '高端粤菜', '高端日料', '铁板烧', '创意菜', 'GRILL', '鮨',
  ...NATIONAL_PREMIUM_CHAIN_EXTENSION_KEYWORDS
]);
const INDEPENDENT_STORE_KEYWORDS = ['街边', '小店', '老店', '大排档', '排档', '小馆', '家常', '本地', '路边摊', '苍蝇馆', '苍蝇小馆', '简陋', '破旧', '破店', '档口', '摊档'];

const DEFAULT_PREFERENCE = {
  selectedOptionIds: ['quick', 'light'],
  preferredTagIds: ['quick', 'staple'],
  avoidedTagIds: [],
  budgetLevel: 3,
  maxDistanceMeters: 1500,
  maxEstimatedMinutes: 45
};

const mockRestaurants = [
  {
    id: 'r-cantonese-congee',
    name: '广式粥粉面',
    tags: ['清淡', '热乎', '粥粉面', '暖胃', '快餐'],
    tagIds: ['light', 'hot', 'congee', 'comfort', 'quick', 'not_spicy'],
    category: '粤式简餐',
    distanceMeters: 300,
    priceLevel: 2,
    averageCostYuan: 29,
    openStatus: 'open',
    signatureDishes: ['皮蛋瘦肉粥', '云吞面'],
    rating: 4.4,
    status: 'active'
  },
  {
    id: 'r-light-salad',
    name: '轻食研究所',
    tags: ['清淡', '健康', '沙拉', '低负担', '清爽'],
    tagIds: ['light', 'healthy', 'salad', 'low_burden', 'fresh', 'not_spicy', 'cold'],
    category: '轻食',
    distanceMeters: 650,
    priceLevel: 3,
    averageCostYuan: 42,
    openStatus: 'open',
    signatureDishes: ['鸡胸藜麦碗', '牛油果沙拉'],
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'r-rice-set',
    name: '家常盖饭小站',
    tags: ['正餐', '米饭', '套餐', '快餐', '饱腹'],
    tagIds: ['staple', 'rice', 'meal', 'set_meal', 'quick', 'not_spicy'],
    category: '简餐',
    distanceMeters: 480,
    priceLevel: 2,
    averageCostYuan: 26,
    openStatus: 'open',
    signatureDishes: ['番茄鸡蛋盖饭', '卤肉饭'],
    rating: 4.1,
    status: 'active'
  },
  {
    id: 'r-snack-buns',
    name: '巷口小吃铺',
    tags: ['小吃', '快餐', '一人食', '热乎', '便宜'],
    tagIds: ['snack', 'quick', 'solo', 'hot', 'not_spicy'],
    category: '小吃',
    distanceMeters: 380,
    priceLevel: 1,
    averageCostYuan: 18,
    openStatus: 'open',
    signatureDishes: ['鲜肉小笼', '鸡蛋煎饼'],
    rating: 4.0,
    status: 'active'
  },
  {
    id: 'r-chongqing-noodle',
    name: '重庆小面',
    tags: ['小面', '麻辣', '热乎', '面食', '重口味'],
    tagIds: ['spicy', 'strong_flavor', 'chongqing_noodle', 'noodle', 'hot', 'quick'],
    category: '重庆小面',
    distanceMeters: 420,
    priceLevel: 2,
    averageCostYuan: 24,
    openStatus: 'open',
    signatureDishes: ['招牌重庆小面', '酸辣粉'],
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'r-hunan-rice',
    name: '湘味小炒饭堂',
    tags: ['下饭', '辣', '米饭', '多人', '重口味'],
    tagIds: ['rice', 'spicy', 'hunan', 'stir_fry', 'group', 'strong_flavor'],
    category: '湘菜',
    distanceMeters: 900,
    priceLevel: 3,
    averageCostYuan: 54,
    openStatus: 'busy',
    signatureDishes: ['小炒黄牛肉', '辣椒炒肉'],
    rating: 4.6,
    status: 'active'
  },
  {
    id: 'r-malatang',
    name: '小锅麻辣烫',
    tags: ['麻辣烫', '辣', '热乎', '自选', '重口味'],
    tagIds: ['spicy', 'malatang', 'hot', 'customizable', 'strong_flavor'],
    category: '麻辣烫',
    distanceMeters: 760,
    priceLevel: 2,
    averageCostYuan: 35,
    openStatus: 'open',
    signatureDishes: ['骨汤麻辣烫', '番茄麻辣烫'],
    rating: 4.1,
    status: 'active'
  },
  {
    id: 'r-maocai',
    name: '川味冒菜香锅',
    tags: ['冒菜', '麻辣香锅', '川味', '重口味'],
    tagIds: ['spicy', 'sichuan', 'maocai', 'dry_pot', 'strong_flavor'],
    category: '冒菜',
    distanceMeters: 820,
    priceLevel: 3,
    averageCostYuan: 46,
    openStatus: 'open',
    signatureDishes: ['招牌冒菜', '麻辣香锅'],
    rating: 4.2,
    status: 'active'
  },
  {
    id: 'r-fried-chicken',
    name: '脆皮炸鸡汉堡',
    tags: ['炸鸡', '汉堡', '油炸', '小吃', '高热量'],
    tagIds: ['fried', 'burger', 'heavy', 'snack', 'quick'],
    category: '炸鸡汉堡',
    distanceMeters: 520,
    priceLevel: 2,
    averageCostYuan: 32,
    openStatus: 'open',
    signatureDishes: ['脆皮炸鸡', '牛肉汉堡'],
    rating: 4.0,
    status: 'active'
  }
];

exports.main = async (event = {}, cloudContext = {}) => {
  const requestId = createRequestId();

  try {
    const context = event.context || {};
    const answers = getAnswers(event, context);
    const preferenceSnapshot = getPreferenceSnapshot(event, context, answers);
    const inputRestaurants = Array.isArray(event.restaurants) ? event.restaurants : [];
    const allowMock = event.allowMock === true || context.allowMock === true;
    const restaurants = inputRestaurants.length > 0 ? inputRestaurants : allowMock ? mockRestaurants : [];
    const result = recommendRestaurants({
      restaurants,
      context: {
        preferenceSnapshot,
        excludeRestaurantIds: context.excludeRestaurantIds || context.excludedHistoryRestaurantIds || [],
        historyFilterEnabled: context.historyFilterEnabled === true,
        excludedHistoryRestaurantIds: context.excludedHistoryRestaurantIds || context.excludeRestaurantIds || [],
        historyPenaltyRestaurantIds: context.historyPenaltyRestaurantIds || [],
        historyPenaltyReasons: context.historyPenaltyReasons || [],
        experimentId: context.experimentId || DEFAULT_EXPERIMENT_ID
      },
      limit: normalizeLimit(event.limit),
      source: allowMock && inputRestaurants.length === 0 ? 'mock' : 'cloud',
      now: new Date()
    });

    if (!Array.isArray(result.candidates) || result.candidates.length === 0) {
      return {
        ok: false,
        error: {
          code: 'NO_RECOMMENDATION',
          message: 'No recommendation candidates available after hard safety filters.',
          details: {
            candidatePoolStats: result.candidatePoolStats,
            fallbackReason: result.fallbackReason,
            inputRestaurantCount: restaurants.length
          }
        },
        data: {
          recommendation: result
        },
        requestId,
        openid: getOpenId(cloudContext)
      };
    }

    return {
      ok: true,
      data: {
        recommendation: result
      },
      requestId,
      openid: getOpenId(cloudContext)
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'RECOMMEND_RESTAURANT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to recommend restaurants.'
      },
      requestId
    };
  }
};

function initCloudSdk() {
  try {
    const sdk = require('wx-server-sdk');
    sdk.init({ env: sdk.DYNAMIC_CURRENT_ENV });
    return sdk;
  } catch (error) {
    return null;
  }
}

function getOpenId(cloudContext) {
  if (!cloud || typeof cloud.getWXContext !== 'function') {
    return cloudContext.OPENID;
  }

  return cloud.getWXContext().OPENID;
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAnswers(event, context) {
  if (Array.isArray(event.questionnaire && event.questionnaire.answers)) {
    return event.questionnaire.answers;
  }

  if (Array.isArray(context.answerSnapshot)) {
    return context.answerSnapshot;
  }

  return [];
}

function getPreferenceSnapshot(event, context, answers) {
  return (
    context.preferenceSnapshot ||
    event.preferenceSnapshot ||
    event.preference ||
    event.preferences ||
    (event.context && event.context.preference) ||
    (event.context && event.context.preferences) ||
    buildPreferenceProfile(answers)
  );
}

function normalizeLimit(limit) {
  if (typeof limit !== 'number' || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(10, Math.floor(limit)));
}

function buildPreferenceProfile(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { ...DEFAULT_PREFERENCE };
  }

  const selectedOptionIds = answers.flatMap((answer) => answer.optionIds || []);
  const preferredTagIds = new Set(DEFAULT_PREFERENCE.preferredTagIds);
  const avoidedTagIds = new Set(DEFAULT_PREFERENCE.avoidedTagIds);
  let budgetLevel = DEFAULT_PREFERENCE.budgetLevel;
  let maxDistanceMeters = DEFAULT_PREFERENCE.maxDistanceMeters;
  let maxEstimatedMinutes = DEFAULT_PREFERENCE.maxEstimatedMinutes;

  answers.forEach((answer) => {
    applyAnswerEffect(answer, preferredTagIds, avoidedTagIds);

    if (answer.questionId === 'budget') {
      budgetLevel =
        answer.value === 'under_30'
          ? 2
          : answer.value === '60_100' || answer.value === 'over_60'
            ? 4
            : answer.value === '100_200'
              ? 5
              : answer.value === 'over_200'
                ? 6
                : 3;
    }

    if (answer.questionId === 'distance') {
      maxDistanceMeters = answer.value === 500 || answer.value === 1000 ? answer.value : 5000;
      maxEstimatedMinutes = answer.value === 500 ? 30 : answer.value === 1000 ? 40 : 90;
    }
  });

  return {
    selectedOptionIds,
    preferredTagIds: [...preferredTagIds],
    avoidedTagIds: [...avoidedTagIds],
    positiveTags: [...preferredTagIds],
    negativeTags: [...avoidedTagIds],
    budgetLevel,
    maxDistanceMeters,
    maxEstimatedMinutes,
    constraints: { budgetLevel, maxDistanceMeters, maxEstimatedMinutes },
    softPreferences: {}
  };
}

function applyAnswerEffect(answer, preferredTagIds, avoidedTagIds) {
  const value = answer.value;

  if (value === 'avoid_spicy' || value === 'no_spicy') {
    ['not_spicy', 'light', 'congee'].forEach((tag) => preferredTagIds.add(tag));
    SPICY_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'avoid_greasy' || value === 'light_burden') {
    ['healthy', 'light', 'low_burden', 'fresh'].forEach((tag) => preferredTagIds.add(tag));
    GREASY_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
    ['spicy', 'strong_flavor'].forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'light') {
    ['light', 'healthy', 'not_spicy', 'low_burden'].forEach((tag) => preferredTagIds.add(tag));
    LIGHT_CONFLICT_TAGS.forEach((tag) => avoidedTagIds.add(tag));
  }

  if (value === 'strong' || value === 'spicy_ok') {
    ['spicy', 'strong_flavor'].forEach((tag) => preferredTagIds.add(tag));
    ['spicy', 'strong_flavor'].forEach((tag) => avoidedTagIds.delete(tag));
  }

  if (value === 'filling' || value === 'meal') {
    ['staple', 'rice', 'noodle', 'meal', 'set_meal'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'snack') {
    ['snack', 'quick', 'solo'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'fast') {
    ['quick', 'solo', 'snack'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'hot') {
    ['hot', 'comfort', 'congee'].forEach((tag) => preferredTagIds.add(tag));
  }

  if (value === 'cold') {
    ['cold', 'light', 'salad', 'fresh'].forEach((tag) => preferredTagIds.add(tag));
  }
}

function recommendRestaurants(options) {
  const now = options.now || new Date();
  const limit = options.limit || DEFAULT_LIMIT;
  const preference = options.context && options.context.preferenceSnapshot;
  const excludedHistoryRestaurantIds =
    (options.context && (options.context.excludedHistoryRestaurantIds || options.context.excludeRestaurantIds)) || [];
  const excludeRestaurantIds = new Set(excludedHistoryRestaurantIds);
  const historyFilterEnabled =
    options.context && options.context.historyFilterEnabled === true && excludedHistoryRestaurantIds.length > 0;
  const historyPenaltyRestaurantIds = (options.context && options.context.historyPenaltyRestaurantIds) || [];
  const historyPenaltyReasons = (options.context && options.context.historyPenaltyReasons) || [];
  const scoreOptionsBase = {
    historyFilterEnabled: options.context && options.context.historyFilterEnabled === true,
    excludedHistoryRestaurantIds,
    historyPenaltyRestaurantIds,
    historyPenaltyReasons
  };
  const experimentId = (options.context && options.context.experimentId) || DEFAULT_EXPERIMENT_ID;
  const candidateRestaurants = deduplicateRestaurants(options.restaurants || []);
  const afterHistoryFilter = candidateRestaurants.filter((restaurant) => !excludeRestaurantIds.has(restaurant.id)).length;
  const baseHardFiltered = candidateRestaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, false, true, false).passed;
  });
  const primaryHardFiltered = candidateRestaurants.filter((restaurant) => {
    return applyHardFilters(restaurant, preference, excludeRestaurantIds, false, false, false).passed;
  });
  const afterNegativeFilter = primaryHardFiltered.length;
  let fallbackReason;
  let fallbackConfidenceCap;
  let fallbackFinalScoreCap;
  let scored = primaryHardFiltered.map((restaurant) => scoreRestaurant(restaurant, preference, scoreOptionsBase));

  if (scored.length < Math.min(limit, MIN_PRIMARY_POOL_SIZE)) {
    fallbackReason = buildDistanceFallbackReason(preference);
    fallbackConfidenceCap = undefined;
    fallbackFinalScoreCap = undefined;
    const strictScored = scored;
    const strictIds = new Set(primaryHardFiltered.map((restaurant) => restaurant.id));
    const supplementalScored = candidateRestaurants
      .filter((restaurant) =>
        !strictIds.has(restaurant.id) &&
        applyHardFilters(restaurant, preference, excludeRestaurantIds, true, false, true, true).passed
      )
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
        if (getNegativeConflict(restaurant, preference).severity === 'hard') return false;
        return applyHardFilters(restaurant, preference, excludeRestaurantIds, true, true, true, true).passed;
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
      .filter((restaurant) => isLastResortFallbackCandidate(restaurant, preference, excludeRestaurantIds))
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
  const poolStats = {
    totalFetched: options.restaurants.length,
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
  const ranked = selectDiverseRanked(rankWithLightRandom(scored), limit);
  poolStats.topCandidateFallbackUsed = Boolean(ranked[0] && ranked[0].fallbackReason);
  const candidates = ranked.slice(0, limit).map((item, index) => {
    const rescored = scoreRestaurant(item.restaurant, preference, {
      fallbackReason: item.fallbackReason,
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
      ...toRecommendationCandidate(rescored, options.source || 'cloud', experimentId),
      candidatePoolStats: poolStats
    };
  });
  const visibleFallbackReason = candidates[0] && candidates[0].fallbackReason;

  return {
    id: `rec-${now.getTime()}`,
    generatedAt: now.toISOString(),
    source: options.source || 'cloud',
    algorithmVersion: ALGORITHM_VERSION,
    weightProfileId: WEIGHT_PROFILE_ID,
    experimentId,
    candidates,
    selectedCandidateId: candidates[0] && candidates[0].id,
    reasonSummary: candidates[0] && `${candidates[0].name} 匹配度 ${candidates[0].confidenceScore || 0}%，${candidates[0].reason}`,
    fallbackReason: visibleFallbackReason,
    historyFilterEnabled: scoreOptionsBase.historyFilterEnabled,
    excludedHistoryRestaurantIds,
    historyPenaltyReasons,
    candidatePoolStats: poolStats
  };
}

function scoreRestaurant(restaurant, preference, options = {}) {
  const tagIds = getRestaurantTagIds(restaurant);
  const preferredTagIds = getPreferredTagIds(preference);
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const temperatureConflict = getTemperatureConflict(restaurant, preference);
  const matchedPreferredTagIds = intersect(tagIds, preferredTagIds);
  const matchedAvoidedTagIds = [...new Set([...intersect(tagIds, getAvoidedTagIds(preference)), ...negativeConflict.tags])]
    .filter((tagId) => !shouldSuppressPremiumChainAvoidanceTag(tagId, tagIds, preference));
  const baseScore = 32;
  const preferenceScore = Math.min(34, matchedPreferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0));
  const negativePreferencePenalty = (negativeConflict.severity === 'hard' ? 88 : negativeConflict.severity === 'soft' ? Math.min(45, 22 + negativeConflict.tags.length * 7) : 0) + temperatureConflict.penalty;
  const historyPenaltyApplies =
    Array.isArray(options.historyPenaltyRestaurantIds) && options.historyPenaltyRestaurantIds.includes(restaurant.id);
  const historyPenalty = historyPenaltyApplies ? 8 : 0;
  const distanceScore = getDistanceScore(restaurant, preference, options.fallbackReason !== undefined);
  const priceScore = getPriceScore(restaurant, preference);
  const timeScore = getTimeScore(restaurant, preference);
  const ratingScore = getRatingScore(restaurant);
  const openStatusScore = restaurant.openStatus === 'open' ? 6 : restaurant.openStatus === 'busy' ? 1 : 0;
  const dataCompletenessScore = getDataCompletenessScore(restaurant);
  const rawFinalScore = clamp(baseScore + preferenceScore - negativePreferencePenalty - historyPenalty + distanceScore + priceScore + timeScore + ratingScore + openStatusScore + dataCompletenessScore, 0, 100);
  const distanceAdjustedFinalScore =
    options.fallbackReason !== undefined &&
    preference &&
    preference.maxDistanceMeters !== undefined &&
    restaurant.distanceMeters !== undefined &&
    restaurant.distanceMeters > preference.maxDistanceMeters
      ? Math.min(rawFinalScore, 54)
      : rawFinalScore;
  const underBudgetMismatch = isUnderRequestedBudgetRange(restaurant, preference);
  const underBudgetAdjustedFinalScore = underBudgetMismatch
    ? Math.min(distanceAdjustedFinalScore, getUnderBudgetFinalScoreCap(restaurant, preference))
    : distanceAdjustedFinalScore;
  const finalScore =
    options.finalScoreCap !== undefined ? Math.min(underBudgetAdjustedFinalScore, options.finalScoreCap) : underBudgetAdjustedFinalScore;
  const hardConstraintScore = getHardConstraintConfidence(restaurant, preference, options.fallbackReason);
  const positivePreferenceScore = getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds);
  const negativeAvoidanceScore = negativeConflict.severity === 'hard' ? 0 : negativeConflict.severity === 'soft' ? 8 : 25;
  const relativeLeadScore = options.relativeLeadScore || 0;
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
    candidatePoolWeak: options.candidatePoolWeak || false
  });
  const nonMealBudgetMismatch = isHighBudgetNonMealUnderBudget(restaurant, preference);
  const budgetCalibratedConfidenceScore = nonMealBudgetMismatch
    ? Math.min(rawConfidenceScore, getHighBudgetNonMealConfidenceCap(restaurant, preference))
    : rawConfidenceScore;
  const priceCalibratedConfidenceScore = underBudgetMismatch
    ? Math.min(budgetCalibratedConfidenceScore, getUnderBudgetConfidenceCap(restaurant, preference))
    : budgetCalibratedConfidenceScore;
  const historyCalibratedConfidenceScore = historyPenaltyApplies ? Math.min(priceCalibratedConfidenceScore, 72) : priceCalibratedConfidenceScore;
  const confidenceScore =
    options.confidenceCap !== undefined ? Math.min(historyCalibratedConfidenceScore, options.confidenceCap) : historyCalibratedConfidenceScore;

  return {
    restaurant,
    score: finalScore,
    confidenceScore,
    confidenceLabel: confidenceScore >= 76 ? 'high' : confidenceScore >= 55 ? 'medium' : 'low',
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
      finalScoreSource: 'base + preferred tag weights - negative/temperature penalties + distance + price + time + rating + open status + data completeness',
      matchPercentSource: 'hard constraints + positive preference coverage + negative avoidance + data completeness + relative lead, capped by conflict/fallback calibration',
      matchedPreferredTagIds,
      matchedAvoidedTagIds
    },
    reasons: buildReasons(restaurant, matchedPreferredTagIds, negativeConflict, preference, options.fallbackReason, temperatureConflict, nonMealBudgetMismatch),
    hardFilterReasons: applyHardFilters(
      restaurant,
      preference,
      new Set(),
      true,
      true,
      true,
      options.fallbackReason !== undefined
    ).reasons,
    penaltyReasons: [
      ...buildPenaltyReasons(restaurant, negativeConflict, preference, options.fallbackReason, temperatureConflict, nonMealBudgetMismatch),
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

function applyHardFilters(
  restaurant,
  preference,
  excludeRestaurantIds,
  allowDistanceFallback,
  allowNegativeFallback,
  allowUnknownPriceFallback,
  allowUnderBudgetFallback = false
) {
  const reasons = [];
  const negativeConflict = getNegativeConflict(restaurant, preference);
  const temperatureConflict = getTemperatureConflict(restaurant, preference);
  const restaurantText = getRestaurantSignalText(restaurant);

  if (restaurant.status !== 'active') reasons.push('餐厅不可用');
  if (isNonRestaurantSalesCandidate(restaurantText)) reasons.push('非到店餐饮门店');
  const restaurantTagIds = getRestaurantTagIds(restaurant);
  if (isExplicitNonMealPreference(preference) && isLikelyMealCandidate(restaurant, restaurantTagIds)) reasons.push('明确非正餐意图与正餐候选冲突');
  if (isExplicitMealPreference(preference) && hasNonMealEvidence(restaurantTagIds, restaurantText)) reasons.push('明确正餐意图与饮品/甜点候选冲突');
  if (isHighBudgetNonMealNoise(restaurant, preference, restaurantTagIds, restaurantText)) reasons.push('高预算正餐场景下的低价饮品/甜点噪声');
  if (requiresBrandCandidate(preference) && !isAcceptableBrandCandidate(restaurant, preference)) reasons.push('品牌偏好下缺少连锁/品牌特征');
  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') reasons.push('当前不在营业');
  if (excludeRestaurantIds.has(restaurant.id)) reasons.push('近期已推荐过');
  if (!allowDistanceFallback && preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters > preference.maxDistanceMeters) {
    reasons.push(`距离 ${restaurant.distanceMeters} 米，超出 ${preference.maxDistanceMeters} 米偏好`);
  }
  if (isClearlyOverBudget(restaurant, preference)) reasons.push('价格明显超出预算');
  if (isClearlyUnderBudget(restaurant, preference, allowUnderBudgetFallback)) reasons.push('price clearly below requested budget');
  if (!allowUnknownPriceFallback && isPriceUnknownForStrictBudget(restaurant, preference)) reasons.push('price unknown for strict high budget');
  if (allowUnknownPriceFallback && isWeakUnknownPriceForPremiumFallback(restaurant, preference)) reasons.push('price unknown without premium evidence for 200+ budget');
  if (preference && preference.maxEstimatedMinutes !== undefined && estimateMinutes(restaurant) > preference.maxEstimatedMinutes + 20) reasons.push('预计耗时明显超出偏好');
  if (!allowNegativeFallback && negativeConflict.severity !== 'none') reasons.push(`命中明确负向偏好：${negativeConflict.labels.join('、')}`);

  if (!allowNegativeFallback && temperatureConflict.severity === 'soft') reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);

  return { passed: reasons.length === 0, reasons };
}

function isNonRestaurantSalesCandidate(text) {
  return NON_RESTAURANT_SALES_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function requiresBrandCandidate(preference) {
  const selected = new Set((preference && preference.selectedOptionIds) || []);
  return BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId));
}

function isAcceptableBrandCandidate(restaurant, preference) {
  const tagIds = getRestaurantTagIds(restaurant);
  const hasBrandTag = CHAIN_BRAND_TAGS.some((tag) => tagIds.includes(tag));
  const text = getRestaurantSignalText(restaurant);
  const estimatedCost = getEstimatedCost(restaurant);
  if (hasBrandTag) return true;
  if (hasKnownChainBrandEvidence(text)) return true;
  if (((preference && preference.budgetLevel) || 3) >= 6) {
    return (estimatedCost !== undefined && estimatedCost >= 200) || hasPremiumCandidateEvidence(restaurant, text);
  }
  return (
    ((preference && preference.budgetLevel) || 3) >= 5 &&
    (estimatedCost || 0) >= 80 &&
    (hasMallStoreEvidence(text) || (restaurant.rating || 0) >= 4.3)
  );
}

function hasPremiumCandidateEvidence(restaurant, text = getRestaurantSignalText(restaurant)) {
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
    ((restaurant.rating || 0) >= 4.6 && (hasMallStoreEvidence(text) || /餐厅|料理|酒家|饭店|restaurant|dining/.test(text)))
  );
}

function isLastResortFallbackCandidate(restaurant, preference, excludeRestaurantIds) {
  const text = getRestaurantSignalText(restaurant);
  if (restaurant.status !== 'active') return false;
  if (restaurant.openStatus === 'closed' || restaurant.openStatus === 'resting') return false;
  if (excludeRestaurantIds.has(restaurant.id)) return false;
  if (isNonRestaurantSalesCandidate(text)) return false;
  if (isClearlyOverBudget(restaurant, preference)) return false;
  return !hasSafetyHardConflict(restaurant, preference);
}

function hasSafetyHardConflict(restaurant, preference) {
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
    (tagIds.some((tag) => SPICY_CONFLICT_TAGS.includes(tag)) ||
      [...SPICY_KEYWORDS, ...SPICY_HEAVY_KEYWORDS].some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitHalal &&
    (tagIds.some((tag) => HALAL_CONFLICT_TAGS.includes(tag)) ||
      PORK_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitVegetarian &&
    (tagIds.some((tag) => VEGETARIAN_CONFLICT_TAGS.includes(tag)) ||
      MEAT_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  if (
    explicitAllergy &&
    (tagIds.some((tag) => ALLERGY_CONFLICT_TAGS.includes(tag)) ||
      ALLERGY_KEYWORDS.some((keyword) => text.includes(keyword)))
  ) {
    return true;
  }

  return false;
}

function rankWithLightRandom(scored) {
  const nonConflict = scored.filter((item) => item.matchedAvoidedTagIds.length === 0).sort(compareScoredRestaurants);
  const conflict = scored.filter((item) => item.matchedAvoidedTagIds.length > 0).sort(compareScoredRestaurants);
  return [...nonConflict, ...conflict];
}

function compareScoredRestaurants(left, right) {
  return (
    right.score - left.score ||
    right.confidenceScore - left.confidenceScore ||
    right.breakdown.preferenceScore - left.breakdown.preferenceScore ||
    right.breakdown.distanceScore - left.breakdown.distanceScore
  );
}

function deduplicateRestaurants(restaurants) {
  const seenIds = new Set();
  const seenNames = new Set();
  return restaurants.filter((restaurant) => {
    const idKey = String(restaurant.id || '').trim().toLowerCase();
    const nameKey = normalizeRestaurantName(restaurant.name || '');
    if (!idKey || seenIds.has(idKey) || seenNames.has(nameKey)) return false;
    seenIds.add(idKey);
    seenNames.add(nameKey);
    return true;
  });
}

function selectDiverseRanked(ranked, limit) {
  const selected = [];
  const deferred = [];
  const seenNames = new Set();
  const seenBrands = new Set();
  ranked.forEach((item) => {
    const nameKey = normalizeRestaurantName(item.restaurant.name || '');
    const brandKey = getRestaurantBrandKey(item.restaurant);
    if (selected.length < limit && !seenNames.has(nameKey) && (!brandKey || !seenBrands.has(brandKey))) {
      selected.push(item);
      seenNames.add(nameKey);
      if (brandKey) seenBrands.add(brandKey);
      return;
    }
    deferred.push(item);
  });
  return [...selected, ...deferred];
}

function normalizeRestaurantName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s·•\-_.]/g, '')
    .trim();
}

function getRestaurantBrandKey(restaurant) {
  const text = getRestaurantSignalText(restaurant);
  const brand = [...LOW_CHAIN_KEYWORDS, ...MID_CHAIN_KEYWORDS, ...PREMIUM_CHAIN_KEYWORDS, ...KNOWN_LOW_CHAIN_KEYWORDS, ...KNOWN_MID_CHAIN_KEYWORDS, ...KNOWN_PREMIUM_CHAIN_KEYWORDS].find((keyword) => {
    return text.includes(keyword.toLowerCase());
  });
  return brand && brand.toLowerCase();
}

function hasKnownChainBrandEvidence(text) {
  return [...KNOWN_LOW_CHAIN_KEYWORDS, ...KNOWN_MID_CHAIN_KEYWORDS, ...KNOWN_PREMIUM_CHAIN_KEYWORDS].some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function hasMallStoreEvidence(text) {
  return ['商场', '购物中心', '广场', 'mall', '百货', '商业中心', ...MALL_STORE_KEYWORDS].some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function toRecommendationCandidate(scored, source, experimentId) {
  const restaurant = scored.restaurant;
  return {
    id: `candidate-${restaurant.id}`,
    restaurantId: restaurant.id,
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      tags: restaurant.tags || [],
      address: restaurant.address,
      location: restaurant.location,
      distanceMeters: restaurant.distanceMeters,
      averageCostYuan: restaurant.averageCostYuan,
      openStatus: restaurant.openStatus,
      rating: restaurant.rating
    },
    name: restaurant.name,
    mealName: (restaurant.signatureDishes && restaurant.signatureDishes[0]) || restaurant.name,
    tags: restaurant.tags || [],
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

function buildReasons(restaurant, matchedPreferredTagIds, negativeConflict, preference, fallbackReason, temperatureConflict = { severity: 'none', label: '', penalty: 0 }, nonMealBudgetMismatch = false) {
  const reasons = [];
  if (matchedPreferredTagIds.length > 0) reasons.push(`匹配 ${matchedPreferredTagIds.slice(0, 3).join('、')} 等偏好`);
  if (temperatureConflict.severity !== 'none') reasons.push(`temperature preference conflict: ${temperatureConflict.label}`);
  if (preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters <= preference.maxDistanceMeters) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米，在你的范围内`);
  } else if (restaurant.distanceMeters !== undefined) {
    reasons.push(`距离约 ${restaurant.distanceMeters} 米`);
  }
  if (preference && preference.budgetLevel !== undefined && restaurant.averageCostYuan !== undefined) {
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
      reasons.push(restaurant.averageCostYuan <= budgetMax ? `人均约 ${restaurant.averageCostYuan} 元，符合预算` : `人均约 ${restaurant.averageCostYuan} 元，略高于预算`);
    }
  }
  if (restaurant.openStatus === 'open') reasons.push('当前营业中');
  if (negativeConflict.severity !== 'none') reasons.push(`含负向偏好 ${negativeConflict.labels.join('、')}，已明显降权`);
  if (fallbackReason) reasons.push(fallbackReason);
  return reasons.length > 0 ? reasons.slice(0, 5) : ['综合距离、价格和口味后较适合今天'];
}

function buildPenaltyReasons(restaurant, negativeConflict, preference, fallbackReason, temperatureConflict = { severity: 'none', label: '', penalty: 0 }, nonMealBudgetMismatch = false) {
  const reasons = [];
  if (negativeConflict.severity !== 'none') reasons.push(`负向偏好冲突：${negativeConflict.labels.join('、')}`);
  if (temperatureConflict.severity !== 'none') reasons.push(`温度偏好冲突：${temperatureConflict.label}`);
  if (preference && preference.maxDistanceMeters !== undefined && restaurant.distanceMeters !== undefined && restaurant.distanceMeters > preference.maxDistanceMeters) reasons.push(`超出距离偏好 ${restaurant.distanceMeters - preference.maxDistanceMeters} 米`);
  if (isOverBudget(restaurant, preference)) reasons.push('超出预算偏好');
  if (nonMealBudgetMismatch) reasons.push('高预算饮品/甜品候选不足，该店价格低于所选预算档，匹配度已下调');
  if (fallbackReason) reasons.push(fallbackReason);
  return reasons;
}

function getPreferredTagIds(preference) {
  const preferred = new Set([...(preference && preference.preferredTagIds ? preference.preferredTagIds : []), ...(preference && preference.positiveTags ? preference.positiveTags : [])]);
  const selected = new Set((preference && preference.selectedOptionIds) || []);
  if (BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId))) {
    preferred.add('chain_brand');
    if (((preference && preference.budgetLevel) || 3) >= 6) preferred.add('premium_brand');
    else if (((preference && preference.budgetLevel) || 3) >= 4) preferred.add('mid_chain');
    else preferred.add('low_chain');
  }
  if (BRAND_INDEPENDENT_OPTION_IDS.some((optionId) => selected.has(optionId))) {
    preferred.add('independent_store');
    preferred.add('street_shop');
  }
  return [...preferred];
}

function getAvoidedTagIds(preference) {
  const avoided = new Set([...(preference && preference.avoidedTagIds ? preference.avoidedTagIds : []), ...(preference && preference.negativeTags ? preference.negativeTags : [])]);
  const preferred = new Set(getPreferredTagIds(preference));
  const selected = new Set((preference && preference.selectedOptionIds) || []);
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
  if (LIGHT_HEALTHY_PREFERENCE_TAGS.some((tag) => preferred.has(tag))) {
    [...GREASY_CONFLICT_TAGS, ...LIGHT_CONFLICT_TAGS].forEach((tag) => avoided.add(tag));
  }
  if (wantsNonMeal || (NON_MEAL_TAGS.some((tag) => preferred.has(tag)) && !wantsMeal)) MEAL_TAGS.forEach((tag) => avoided.add(tag));
  if (wantsDrinkOnly) [...MEAL_TAGS, 'snack', 'dim_sum'].forEach((tag) => avoided.add(tag));
  if (selected.has('prefer_milk_tea')) ['coffee', 'dessert', 'afternoon_tea'].forEach((tag) => avoided.add(tag));
  if (selected.has('prefer_coffee')) ['milk_tea', 'dessert'].forEach((tag) => avoided.add(tag));
  if (selected.has('prefer_bakery_dessert') || selected.has('intent_dessert')) ['milk_tea', 'coffee', 'drink'].forEach((tag) => avoided.add(tag));
  if (wantsDessertOnly) ['meal', 'rice', 'noodle', 'staple', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum'].forEach((tag) => avoided.add(tag));
  if (wantsMeal) NON_MEAL_TAGS.forEach((tag) => avoided.add(tag));
  if (preferred.has('vegetarian') || avoided.has('meat_heavy') || avoided.has('pork')) VEGETARIAN_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (preferred.has('halal') || avoided.has('pork')) HALAL_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet')) LOW_SUGAR_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (preferred.has('high_protein')) HIGH_PROTEIN_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (preferred.has('allergy_sensitive')) ALLERGY_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (avoided.has('spicy')) SPICY_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (avoided.has('strong_flavor')) LIGHT_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) GREASY_CONFLICT_TAGS.forEach((tag) => avoided.add(tag));
  if (wantsChainBrand) {
    ['independent_store', 'street_shop'].forEach((tag) => avoided.add(tag));
    if (((preference && preference.budgetLevel) || 3) >= 6) ['low_chain', 'mid_chain'].forEach((tag) => avoided.add(tag));
    else if (((preference && preference.budgetLevel) || 3) >= 5) avoided.add('low_chain');
    else if (((preference && preference.budgetLevel) || 3) <= 3) avoided.add('premium_brand');
  }
  if (wantsIndependentStore) CHAIN_BRAND_TAGS.forEach((tag) => avoided.add(tag));
  return [...avoided];
}

function getNegativeConflict(restaurant, preference) {
  const avoided = new Set(getAvoidedTagIds(preference));
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantText(restaurant);
  const tags = new Set();
  const labels = new Set();
  let severity = 'none';
  const explicitNoSpicy = avoided.has('spicy');
  const explicitVegetarian = preferred.has('vegetarian');
  const explicitHalal = preferred.has('halal') || avoided.has('pork');
  const explicitLowSugar = preferred.has('low_sugar') || avoided.has('sugary_drink') || avoided.has('sweet');
  const explicitHighProtein = preferred.has('high_protein');
  const explicitAllergy = preferred.has('allergy_sensitive');
  const selected = new Set((preference && preference.selectedOptionIds) || []);
  const explicitDrinkOnly = DRINK_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitDessertOnly = DESSERT_ONLY_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitNonMeal = explicitDrinkOnly || explicitDessertOnly || preferred.has('non_meal');
  const explicitChainBrand = BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId));
  const explicitIndependentStore = BRAND_INDEPENDENT_OPTION_IDS.some((optionId) => selected.has(optionId));
  const setSeverity = (next) => {
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
    tags.add('spicy');
    labels.add('辣/麻辣/川湘相关');
    severity = 'hard';
  }

  if ((avoided.has('fried') || avoided.has('heavy') || avoided.has('bbq')) && GREASY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    GREASY_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('油腻/油炸/烧烤相关');
    severity = severity === 'hard' ? 'hard' : 'soft';
  }

  if (explicitHalal && PORK_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HALAL_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('pork related');
    setSeverity('hard');
  }

  if (explicitVegetarian && MEAT_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    VEGETARIAN_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('meat-heavy related');
    setSeverity('hard');
  }

  if (explicitLowSugar && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    LOW_SUGAR_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('sweet or sugary related');
    setSeverity('soft');
  }

  if (explicitHighProtein && SWEET_KEYWORDS.some((keyword) => text.includes(keyword))) {
    HIGH_PROTEIN_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('low protein sweet related');
    setSeverity('soft');
  }

  if (explicitAllergy && ALLERGY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    ALLERGY_CONFLICT_TAGS.forEach((tag) => tags.add(tag));
    labels.add('allergy risk related');
    setSeverity('hard');
  }

  if (avoided.has('meal') && MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    MEAL_TAGS.forEach((tag) => tags.add(tag));
    labels.add('meal category conflict');
    setSeverity(explicitNonMeal ? 'hard' : 'soft');
  }

  if (avoided.has('non_meal') && NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword))) {
    NON_MEAL_TAGS.forEach((tag) => tags.add(tag));
    labels.add('non-meal category conflict');
    setSeverity('soft');
  }

  if (explicitNonMeal && MEAL_TAGS.some((tag) => tagIds.includes(tag)) && !hasNonMealEvidence(tagIds, text)) {
    MEAL_TAGS.forEach((tag) => {
      if (tagIds.includes(tag)) tags.add(tag);
    });
    labels.add('explicit non-meal intent conflicts with meal candidate');
    setSeverity('hard');
  }

  if (explicitNonMeal && isLikelyMealCandidate(restaurant, tagIds)) {
    tags.add('meal');
    labels.add('explicit non-meal intent conflicts with restaurant candidate');
    setSeverity('hard');
  }

  if (explicitDrinkOnly && tagIds.includes('snack') && !tagIds.some((tag) => NON_MEAL_TAGS.includes(tag))) {
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
    ['independent_store', 'street_shop'].forEach((tag) => {
      if (tagIds.includes(tag)) tags.add(tag);
    });
    labels.add('brand preference conflicts with independent store');
    setSeverity('hard');
  }

  if (explicitIndependentStore && CHAIN_BRAND_TAGS.some((tag) => tagIds.includes(tag))) {
    CHAIN_BRAND_TAGS.forEach((tag) => {
      if (tagIds.includes(tag)) tags.add(tag);
    });
    labels.add('independent store preference conflicts with chain brand');
    setSeverity('soft');
  }

  return { severity, tags: [...tags], labels: [...labels] };
}

function shouldSuppressPremiumChainAvoidanceTag(tagId, candidateTagIds, preference) {
  const selected = new Set(preference?.selectedOptionIds ?? []);

  return (
    BRAND_CHAIN_OPTION_IDS.some((optionId) => selected.has(optionId)) &&
    (preference?.budgetLevel ?? 3) >= 6 &&
    candidateTagIds.includes('premium_brand') &&
    (tagId === 'mid_chain' || tagId === 'low_chain')
  );
}

function getRestaurantTagIds(restaurant) {
  const explicitTagIds = restaurant.tagIds || (restaurant.tagRefs || []).map((tag) => tag.id) || restaurant.tags || [];
  const inferredTagIds = inferTagIdsFromRestaurantText(restaurant, explicitTagIds);
  const tagIds = new Set([...explicitTagIds, ...inferredTagIds]);
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

function inferTagIdsFromRestaurantText(restaurant, explicitTagIds) {
  const text = getRestaurantSignalText(restaurant);
  const inferred = new Set();
  const explicitlyNotSpicy = explicitTagIds.includes('not_spicy') || NOT_SPICY_KEYWORDS.some((keyword) => text.includes(keyword));

  INFERRED_TAG_RULES.forEach((rule) => {
    if (rule.skipWhenNotSpicy && explicitlyNotSpicy) return;
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      rule.tags.forEach((tag) => inferred.add(tag));
    }
  });

  if (!explicitlyNotSpicy && SPICY_HEAVY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    DEFAULT_SPICY_HEAVY_TAGS.forEach((tag) => inferred.add(tag));
  }

  if (isLikelyMealText(text) && !hasNonMealEvidence([...explicitTagIds, ...inferred], text)) {
    inferred.add('meal');
  }

  if (['虾饺', '烧卖', '烧麦', '茶点', '早茶', '点心'].some((keyword) => text.includes(keyword))) {
    ['dim_sum', 'meal', 'snack'].forEach((tag) => inferred.add(tag));
  }

  if (LOW_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'low_chain', 'quick'].forEach((tag) => inferred.add(tag));
  }

  if (KNOWN_LOW_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'low_chain', 'quick'].forEach((tag) => inferred.add(tag));
  }

  if (MID_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((tag) => inferred.add(tag));
  }

  if (KNOWN_MID_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'mid_chain', 'relaxed'].forEach((tag) => inferred.add(tag));
  }

  if (PREMIUM_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((tag) => inferred.add(tag));
  }

  if (KNOWN_PREMIUM_CHAIN_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['chain_brand', 'premium_brand', 'relaxed', 'slow'].forEach((tag) => inferred.add(tag));
  }

  if (MALL_STORE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    inferred.add('mall_store');
  }

  if (hasMallStoreEvidence(text)) {
    inferred.add('mall_store');
  }

  if (INDEPENDENT_STORE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) {
    ['independent_store', 'street_shop'].forEach((tag) => inferred.add(tag));
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

function getTemperatureConflict(restaurant, preference) {
  const preferred = new Set(getPreferredTagIds(preference));
  const tagIds = getRestaurantTagIds(restaurant);
  const text = getRestaurantSignalText(restaurant);
  const wantsHot = preferred.has('hot') || preferred.has('comfort') || preferred.has('congee');
  const wantsCold = preferred.has('cold') || preferred.has('salad') || preferred.has('fresh');
  const hasHot = tagIds.some((tag) => HOT_FOOD_TAGS.includes(tag));
  const hasCold = tagIds.some((tag) => COLD_FOOD_TAGS.includes(tag));
  const hasColdOrRoomTemperatureText = COLD_OR_ROOM_TEMPERATURE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));

  if (wantsHot && !hasHot && (hasCold || hasColdOrRoomTemperatureText)) return { severity: 'soft', label: 'wanted hot food, candidate is cold or room-temperature', penalty: 34 };
  if (wantsCold && hasHot && !hasCold) return { severity: 'soft', label: 'wanted cold or light food, candidate is hot-heavy', penalty: 16 };

  return { severity: 'none', label: '', penalty: 0 };
}

function getRestaurantText(restaurant) {
  return [restaurant.name, restaurant.category, restaurant.description, restaurant.address, ...(restaurant.tags || []), ...(restaurant.signatureDishes || [])].filter(Boolean).join(' ').toLowerCase();
}

function getRestaurantSignalText(restaurant) {
  return [restaurant.name, restaurant.category, restaurant.description, ...(restaurant.tags || []), ...(restaurant.signatureDishes || [])].filter(Boolean).join(' ').toLowerCase();
}

function isLikelyMealCandidate(restaurant, tagIds) {
  const text = getRestaurantSignalText(restaurant);

  if (hasNonMealEvidence(tagIds, text)) {
    return false;
  }

  return (
    MEAL_TAGS.some((tag) => tagIds.includes(tag)) ||
    isLikelyMealText(text) ||
    (getEstimatedCost(restaurant) || 0) >= 100
  );
}

function isLikelyMealText(text) {
  return [...MEAL_KEYWORDS, ...BROAD_MEAL_KEYWORDS].some((keyword) => text.includes(keyword));
}

function hasNonMealEvidence(tagIds, text) {
  return (
    NON_MEAL_TAGS.some((tag) => tagIds.includes(tag)) ||
    NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}

function hasStrongNonMealEvidence(tagIds, text) {
  return (
    NON_MEAL_TAGS.some((tag) => tagIds.includes(tag)) ||
    PURE_NON_MEAL_BUSINESS_KEYWORDS.some((keyword) => text.includes(keyword)) ||
    ['冷饮店', '饮品店', '奶茶店', '咖啡店', '甜品店', '糕饼店', '蛋糕店', '面包店', '烘焙店'].some((keyword) => text.includes(keyword))
  );
}

function hasStrongNonMealTextEvidence(text) {
  return NON_MEAL_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasColdOrRoomTemperatureTextEvidence(text) {
  return COLD_OR_ROOM_TEMPERATURE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasCoffeeTextEvidence(text) {
  return COFFEE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasDessertBakeryTextEvidence(text) {
  return DESSERT_BAKERY_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()));
}

function hasPremiumMealOverrideEvidence(restaurant, tagIds, text = getRestaurantSignalText(restaurant)) {
  const estimatedCost = getEstimatedCost(restaurant);
  const hasPremiumTag = tagIds.includes('premium_brand');
  const hasMealSignal = hasPremiumMealSignal(text);
  const hasNonMeal = hasNonMealEvidence(tagIds, text);
  const hasPureNonMealBusiness =
    PURE_NON_MEAL_BUSINESS_KEYWORDS.some((keyword) => text.includes(keyword)) && !hasMealSignal;

  if (hasPureNonMealBusiness || (hasNonMeal && !hasMealSignal)) {
    return false;
  }

  return hasPremiumTag || hasMealSignal || ((estimatedCost || 0) >= 200 && !hasNonMeal);
}

function hasPremiumMealSignal(text) {
  return (
    PREMIUM_MEAL_SIGNAL_KEYWORDS.some((keyword) => text.includes(keyword)) ||
    /高端|黑珍珠|米其林|omakase|fine dining|hotel restaurant|private kitchen|chef restaurant|chef|主厨|私厨|私房|牛排馆|海鲜放题|法餐|高端日料|酒店餐厅|星级酒店|白天鹅|炳胜|利苑|大董|新荣记|甬府|GRILL|grill|烧肉|融合料理|创意菜|grill|chef|omakase|fine dining/i.test(text)
  );
}

function cleanNonMealTagsFromPremiumMealCandidate(tagIds) {
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
  ].forEach((tag) => {
    tagIds.delete(tag);
  });
  tagIds.add('meal');
  tagIds.add('premium_brand');
  tagIds.add('relaxed');
  tagIds.add('slow');
}

function cleanMealTagsFromNonMealCandidate(tagIds) {
  ['meal', 'staple', 'rice', 'noodle', 'set_meal', 'hotpot', 'stir_fry', 'dim_sum', 'quick'].forEach((tag) => {
    tagIds.delete(tag);
  });
  tagIds.add('non_meal');
}

function cleanHotTagsFromColdCandidate(tagIds) {
  ['hot', 'comfort', 'congee', 'noodle', 'hotpot', 'malatang'].forEach((tag) => {
    tagIds.delete(tag);
  });
  tagIds.add('cold');
}

function getCandidateImageUrl(restaurant, matchedPreferredTagIds) {
  return normalizeImageUrl(restaurant.coverImageUrl) || getFallbackImageUrl(restaurant, matchedPreferredTagIds);
}

function normalizeImageUrl(url) {
  return typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : undefined;
}

function getFallbackImageUrl(restaurant, matchedPreferredTagIds) {
  const text = getRestaurantText({
    ...restaurant,
    tags: [...(restaurant.tags || []), ...(matchedPreferredTagIds || [])]
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

function intersect(left, right) {
  const rightSet = new Set(right);
  return [...new Set((left || []).filter((item) => rightSet.has(item)))];
}

function getDistanceScore(restaurant, preference, fallbackUsed) {
  if (restaurant.distanceMeters === undefined) return 0;
  const maxDistance = (preference && preference.maxDistanceMeters) || 1500;
  const distanceFlexible =
    (preference && Array.isArray(preference.selectedOptionIds) && preference.selectedOptionIds.includes('distance_any')) ||
    maxDistance >= 5000;

  if (distanceFlexible) {
    if (restaurant.distanceMeters <= 1000) return 6;
    if (restaurant.distanceMeters <= maxDistance) return 0;
    return fallbackUsed ? -12 : -8;
  }

  const ratio = restaurant.distanceMeters / maxDistance;
  if (ratio <= 0.5) return fallbackUsed ? 10 : 18;
  if (ratio <= 1) return fallbackUsed ? 5 : 12;
  if (ratio <= 1.5) return fallbackUsed ? -22 : -16;
  return fallbackUsed ? -42 : -30;
}

function getPriceScore(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return 0;
  const estimatedCost = getEstimatedCost(restaurant);
  const flexibleNonMealBudget = isFlexibleNonMealBudget(preference);
  if (estimatedCost === undefined) {
    if (flexibleNonMealBudget) return -10;
    if (preference.budgetLevel >= 6) return -80;
    if (preference.budgetLevel >= 5) return -30;
    if (preference.budgetLevel >= 4) return -14;
    return -6;
  }
  const range = getBudgetRange(preference);
  if (estimatedCost <= range.max && (range.min === undefined || estimatedCost >= range.min)) return 14;
  if (range.min !== undefined && estimatedCost < range.min) {
    if (flexibleNonMealBudget) {
      if (estimatedCost >= range.min * 0.65) return 2;
      return preference.budgetLevel >= 6 ? -14 : -8;
    }

    if ((preference.budgetLevel || 3) >= 4) {
      if (estimatedCost >= range.min * 0.85) return 4;
      if (estimatedCost >= range.min * 0.65) return -8;
      return preference.budgetLevel >= 6 ? -70 : -45;
    }

    return estimatedCost >= range.min * 0.75 ? 4 : -6;
  }
  if (estimatedCost <= range.max * 1.1) return -10;
  if (estimatedCost <= range.max * 1.2) return -22;
  return -34;
}

function getTimeScore(restaurant, preference) {
  const minutes = estimateMinutes(restaurant);
  const maxMinutes = (preference && preference.maxEstimatedMinutes) || 45;
  if (minutes <= Math.min(25, maxMinutes)) return 8;
  if (minutes <= maxMinutes) return 4;
  return -8;
}

function getRatingScore(restaurant) {
  if (restaurant.rating === undefined) return 0;
  return clamp((restaurant.rating - 3.6) * 6, 0, 8);
}

function getDataCompletenessScore(restaurant) {
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

function getHardConstraintConfidence(restaurant, preference, fallbackReason) {
  let score = 0;
  if (restaurant.openStatus === 'open' || restaurant.openStatus === 'busy' || restaurant.openStatus === 'unknown') score += 10;
  if (!preference || preference.maxDistanceMeters === undefined || restaurant.distanceMeters === undefined || restaurant.distanceMeters <= preference.maxDistanceMeters) score += 10;
  else score += fallbackReason ? 3 : 0;
  if (!isOverBudget(restaurant, preference)) score += 10;
  else if (!isClearlyOverBudget(restaurant, preference)) score += 3;
  return score;
}

function getPositivePreferenceConfidence(preferredTagIds, matchedPreferredTagIds) {
  if (preferredTagIds.length === 0) return 12;
  const preferredWeight = preferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0);
  const matchedWeight = matchedPreferredTagIds.reduce((sum, tag) => sum + (TAG_WEIGHTS[tag] || 6), 0);
  return Math.round(clamp((matchedWeight / Math.max(1, preferredWeight)) * 25, 0, 25));
}

function getRelativeLeadScore(ranked, index) {
  if (index !== 0 || ranked.length < 2) return 3;
  return Math.round(clamp((ranked[0].score - ranked[1].score) / 3, 2, 10));
}

function calculateConfidenceScore(input) {
  let score = input.hardConstraintScore + input.positivePreferenceScore + input.negativeAvoidanceScore + input.dataCompletenessScore + input.relativeLeadScore;
  if (input.negativeConflict.severity === 'hard') score = Math.min(score, 42);
  else if (input.negativeConflict.severity === 'soft') score = Math.min(score, 70);
  if (input.temperatureConflict && input.temperatureConflict.severity === 'soft') score = Math.min(score, 64);
  if (input.priceOverBudget) score = Math.min(score, 70);
  if (input.priceUnknown) score = Math.min(score, 68);
  if (input.timeOverPreference) score = Math.min(score, 70);
  if (input.fallbackUsed) score = Math.min(Math.max(score - 10, 45), 64);
  if (input.candidatePoolWeak) score = Math.min(score, 72);
  return Math.round(clamp(score, 0, 95));
}

function isOverBudget(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return false;
  const estimatedCost = getEstimatedCost(restaurant);
  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max;
}

function isClearlyOverBudget(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined) return false;
  const estimatedCost = getEstimatedCost(restaurant);
  return estimatedCost !== undefined && estimatedCost > getBudgetRange(preference).max * 1.2;
}

function isClearlyUnderBudget(restaurant, preference, allowNearBudgetFallback = false) {
  if (!preference || preference.budgetLevel === undefined || preference.budgetLevel < 5) return false;
  if (isFlexibleNonMealBudget(preference)) return false;
  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);
  if (range.min === undefined || estimatedCost === undefined) return false;
  if (preference.budgetLevel >= 6) return estimatedCost < range.min;
  return allowNearBudgetFallback ? estimatedCost < 80 : estimatedCost < range.min;
}

function isPriceUnknownForStrictBudget(restaurant, preference) {
  return preference && preference.budgetLevel !== undefined && preference.budgetLevel >= 5 && !isFlexibleNonMealBudget(preference) && isPriceUnknown(restaurant);
}

function isWeakUnknownPriceForPremiumFallback(restaurant, preference) {
  return (
    preference &&
    preference.budgetLevel !== undefined &&
    preference.budgetLevel >= 6 &&
    !isFlexibleNonMealBudget(preference) &&
    isPriceUnknown(restaurant) &&
    !hasPremiumCandidateEvidence(restaurant)
  );
}

function isHighBudgetNonMealNoise(restaurant, preference, tagIds = getRestaurantTagIds(restaurant), text = getRestaurantSignalText(restaurant)) {
  if (!preference || (preference.budgetLevel || 3) < 5 || isFlexibleNonMealBudget(preference)) return false;
  if (!hasNonMealEvidence(tagIds, text)) return false;
  if (hasPremiumCandidateEvidence(restaurant, text)) return false;
  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);
  return estimatedCost === undefined || (range.min !== undefined && estimatedCost < range.min);
}

function isFlexibleNonMealBudget(preference) {
  if (!preference || (preference.budgetLevel || 3) < 5) return false;
  const selected = new Set(preference.selectedOptionIds || []);
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

function isHighBudgetNonMealUnderBudget(restaurant, preference) {
  if (!isFlexibleNonMealBudget(preference)) return false;
  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);
  return range.min !== undefined && estimatedCost !== undefined && estimatedCost < range.min;
}

function isUnderRequestedBudgetRange(restaurant, preference) {
  if (!preference || preference.budgetLevel === undefined || preference.budgetLevel < 5 || isFlexibleNonMealBudget(preference)) return false;
  const range = getBudgetRange(preference);
  const estimatedCost = getEstimatedCost(restaurant);
  return range.min !== undefined && estimatedCost !== undefined && estimatedCost < range.min;
}

function getHighBudgetNonMealConfidenceCap(restaurant, preference) {
  const estimatedCost = getEstimatedCost(restaurant);
  if (((preference && preference.budgetLevel) || 3) >= 6 && (estimatedCost || 0) < 100) return 58;
  return 64;
}

function getUnderBudgetConfidenceCap(restaurant, preference) {
  const estimatedCost = getEstimatedCost(restaurant) || 0;
  if (((preference && preference.budgetLevel) || 3) >= 6) {
    if (estimatedCost >= 150) return 70;
    if (estimatedCost >= 100) return 60;
    return 48;
  }
  if (estimatedCost >= 80) return 70;
  return 58;
}

function getUnderBudgetFinalScoreCap(restaurant, preference) {
  const estimatedCost = getEstimatedCost(restaurant) || 0;
  if (((preference && preference.budgetLevel) || 3) >= 6) {
    if (estimatedCost >= 150) return 70;
    if (estimatedCost >= 100) return 60;
    return 42;
  }
  if (estimatedCost >= 80) return 82;
  return 62;
}

function buildDistanceFallbackReason(preference) {
  const selected = new Set((preference && preference.selectedOptionIds) || []);
  if (((preference && preference.budgetLevel) || 3) === 5) return '附近 100-200 严格匹配较少，已用近预算候选补位并下调匹配度';
  if (((preference && preference.budgetLevel) || 3) >= 6) return '附近 200 元以上严格匹配较少，仅保留有高端信号的候选并下调匹配度';
  if (selected.has('distance_500m') || selected.has('distance_1km')) return '严格距离内符合条件较少，已放宽距离并下调匹配度';
  return '附近严格匹配候选较少，已扩大搜索范围并下调匹配度';
}

function buildNegativeFallbackReason(preference) {
  if (isExplicitNonMealPreference(preference)) return '同类饮品/甜品候选较少，仅放宽次要偏好，正餐冲突仍会过滤';
  return '附近符合条件较少，已放宽部分次要偏好并下调匹配度';
}

function buildLastResortFallbackReason(preference) {
  if (((preference && preference.budgetLevel) || 3) >= 6) {
    return '附近 200 元以上严格匹配太少，先给你一个低置信备选，可考虑放宽距离或预算';
  }
  if (((preference && preference.budgetLevel) || 3) === 5) {
    return '附近 100-200 严格匹配太少，先给你一个低置信备选，可考虑放宽距离或预算';
  }
  if (isExplicitNonMealPreference(preference)) {
    return '同类饮品/甜品严格匹配太少，先给你一个低置信备选';
  }
  return '附近严格匹配太少，先给你一个低置信备选';
}

function isExplicitNonMealPreference(preference) {
  if (!preference) return false;
  const selected = new Set(preference.selectedOptionIds || []);

  return (
    selected.has('intent_drink') ||
    selected.has('intent_dessert') ||
    selected.has('prefer_milk_tea') ||
    selected.has('prefer_coffee') ||
    selected.has('prefer_bakery_dessert')
  );
}

function isExplicitMealPreference(preference) {
  if (!preference) return false;
  const selected = new Set(preference.selectedOptionIds || []);
  const preferred = new Set(preference.preferredTagIds || []);

  return (
    selected.has('intent_meal') ||
    selected.has('intent_staple') ||
    (preferred.has('meal') && !isFlexibleNonMealBudget(preference))
  );
}

function isPriceUnknown(restaurant) {
  return getEstimatedCost(restaurant) === undefined;
}

function isOverTimePreference(restaurant, preference) {
  return preference && preference.maxEstimatedMinutes !== undefined && estimateMinutes(restaurant) > preference.maxEstimatedMinutes;
}

function getBudgetMaxYuan(preference) {
  return getBudgetRange(preference).max;
}

function getBudgetRange(preference) {
  return BUDGET_LEVEL_TO_RANGE[preference.budgetLevel || 3] || BUDGET_LEVEL_TO_RANGE[3];
}

function getEstimatedCost(restaurant) {
  if (restaurant.averageCostYuan !== undefined && restaurant.averageCostYuan > 0) return restaurant.averageCostYuan;
  if (restaurant.priceLevel !== undefined) return getPriceLevelCost(restaurant.priceLevel);
  return undefined;
}

function getPriceLevelCost(priceLevel) {
  return BUDGET_LEVEL_TO_YUAN[priceLevel] || 60;
}

function estimateMinutes(restaurant) {
  const distanceMinutes = restaurant.distanceMeters === undefined ? 8 : Math.ceil(restaurant.distanceMeters / 120);
  const diningMinutes = restaurant.category === 'Brunch' ? 35 : 20;
  const busyMinutes = restaurant.openStatus === 'busy' ? 10 : 0;
  return distanceMinutes + diningMinutes + busyMinutes;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
