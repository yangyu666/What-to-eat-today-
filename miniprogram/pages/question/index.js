const QUESTION_BANK_VERSION = 'v2.0-dynamic';

const IMAGE = {
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
  moodComfort: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=360&q=80',
  moodFresh: 'https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=360&q=80',
  sceneSolo: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=360&q=80',
  sceneGroup: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=360&q=80'
};

const questionBank = [
  {
    id: 'dining_mode',
    dimension: 'dining_mode',
    title: '堂食还是外卖？',
    subtitle: '按这顿饭的用餐方式来定候选池',
    type: 'single',
    options: [
      { id: 'dining_mode_dine_in', label: '堂食', desc: '到店坐下吃，附近体验也重要', value: 'dine_in', themeClass: 'theme-red', imageUrl: IMAGE.diningDineIn },
      { id: 'dining_mode_delivery', label: '外卖', desc: '不想出门，出餐和配送速度更重要', value: 'delivery', themeClass: 'theme-green', imageUrl: IMAGE.diningDelivery }
    ]
  },
  {
    id: 'budget',
    dimension: 'budget',
    title: '预算大概多少？',
    subtitle: '预算用于排序和过滤，不直接限制高德候选池',
    type: 'single',
    options: [
      { id: 'budget_under_30', label: '30 以下', desc: '简单实惠，快速解决', value: 'under_30', themeClass: 'theme-green', imageUrl: IMAGE.budgetLow },
      { id: 'budget_30_60', label: '30~60', desc: '正常吃一顿，选择更多', value: '30_60', themeClass: 'theme-red', imageUrl: IMAGE.budgetMid },
      { id: 'budget_over_60', label: '60 以上', desc: '可以吃好一点，环境和菜品优先', value: 'over_60', themeClass: 'theme-green', imageUrl: IMAGE.budgetHigh }
    ]
  },
  {
    id: 'distance',
    dimension: 'distance',
    title: '能接受多远？',
    subtitle: '高德候选池会优先按这个半径取附近店',
    type: 'single',
    options: [
      { id: 'distance_500m', label: '500 米', desc: '越近越好，少走几步', value: 500, themeClass: 'theme-green', imageUrl: IMAGE.distanceNear },
      { id: 'distance_1km', label: '1 公里', desc: '可以稍微走一走', value: 1000, themeClass: 'theme-red', imageUrl: IMAGE.distanceWalk },
      { id: 'distance_any', label: '远点也行', desc: '好吃更重要，距离放宽', value: 'any', themeClass: 'theme-green', imageUrl: IMAGE.distanceAny }
    ]
  },
  {
    id: 'flavor',
    dimension: 'flavor',
    title: '今天口味想偏哪边？',
    subtitle: '口味会同时影响关键词和最终打分',
    type: 'single',
    options: [
      { id: 'flavor_strong', label: '重口过瘾', desc: '麻辣、锅气、浓一点都可以', value: 'strong', themeClass: 'theme-red', imageUrl: IMAGE.flavorStrong },
      { id: 'flavor_light', label: '清淡舒服', desc: '少油少辣，吃完没负担', value: 'light', themeClass: 'theme-green', imageUrl: IMAGE.flavorLight }
    ]
  },
  {
    id: 'temperature',
    dimension: 'temperature',
    title: '想吃热的还是凉的？',
    subtitle: '入口温度会留给推荐算法细排',
    type: 'single',
    options: [
      { id: 'temperature_hot', label: '热乎一点', desc: '汤、面、锅，暖胃更满足', value: 'hot', themeClass: 'theme-red', imageUrl: IMAGE.temperatureHot },
      { id: 'temperature_cold', label: '清爽一点', desc: '沙拉、凉面、轻食都可以', value: 'cold', themeClass: 'theme-green', imageUrl: IMAGE.temperatureCold }
    ]
  },
  {
    id: 'meal_type',
    dimension: 'meal_type',
    title: '正餐还是小吃？',
    subtitle: '决定这顿饭的饱腹方向',
    type: 'single',
    options: [
      { id: 'meal_type_meal', label: '正餐', desc: '认真吃一顿，管饱', value: 'meal', themeClass: 'theme-red', imageUrl: IMAGE.mealMain },
      { id: 'meal_type_snack', label: '小吃', desc: '轻松解馋，不用太正式', value: 'snack', themeClass: 'theme-green', imageUrl: IMAGE.mealSnack }
    ]
  },
  {
    id: 'speed',
    dimension: 'speed',
    title: '现在赶时间吗？',
    subtitle: '速度会影响候选关键词和耗时排序',
    type: 'single',
    options: [
      { id: 'speed_fast', label: '越快越好', desc: '出餐快，少排队，别纠结', value: 'fast', themeClass: 'theme-green', imageUrl: IMAGE.speedFast },
      { id: 'speed_slow', label: '可以慢点', desc: '想坐一会儿，体验优先', value: 'slow', themeClass: 'theme-red', imageUrl: IMAGE.speedSlow }
    ]
  },
  {
    id: 'health',
    dimension: 'health',
    title: '今天想轻负担吗？',
    subtitle: '健康偏好主要留给最终排序',
    type: 'single',
    options: [
      { id: 'health_light', label: '轻负担', desc: '少油、蔬菜、蛋白质多一点', value: 'light_burden', themeClass: 'theme-green', imageUrl: IMAGE.healthLight },
      { id: 'health_free', label: '先别管', desc: '今天开心更重要', value: 'free', themeClass: 'theme-red', imageUrl: IMAGE.healthFree }
    ]
  },
  {
    id: 'satiety',
    dimension: 'satiety',
    title: '需要多顶饱？',
    subtitle: '饱腹感会辅助正餐、小吃和主食排序',
    type: 'single',
    options: [
      { id: 'satiety_filling', label: '要管饱', desc: '主食、米饭、面都可以', value: 'filling', themeClass: 'theme-red', imageUrl: IMAGE.satietyFilling },
      { id: 'satiety_light', label: '垫一下', desc: '吃点小的，别太撑', value: 'light', themeClass: 'theme-green', imageUrl: IMAGE.satietyLight }
    ]
  },
  {
    id: 'avoidance',
    dimension: 'avoidance',
    title: '有什么想避开的？',
    subtitle: '排除项不进高德查询，会在最终排序扣分',
    type: 'single',
    options: [
      { id: 'avoidance_spicy', label: '不想吃辣', desc: '今天不要麻辣重口', value: 'avoid_spicy', themeClass: 'theme-green', imageUrl: IMAGE.avoidanceSpicy },
      { id: 'avoidance_greasy', label: '不想油腻', desc: '炸物、烧烤先放一放', value: 'avoid_greasy', themeClass: 'theme-green', imageUrl: IMAGE.avoidanceGreasy },
      { id: 'avoidance_none', label: '没什么', desc: '选择面打开一点', value: 'none', themeClass: 'theme-red', imageUrl: IMAGE.avoidanceNone }
    ]
  },
  {
    id: 'mood',
    dimension: 'mood',
    title: '今天什么心情？',
    subtitle: '情绪偏好只参与推荐排序',
    type: 'single',
    options: [
      { id: 'mood_comfort', label: '想被安慰', desc: '暖胃、稳定、熟悉一点', value: 'comfort', themeClass: 'theme-red', imageUrl: IMAGE.moodComfort },
      { id: 'mood_fresh', label: '想换口味', desc: '别太普通，来点新鲜感', value: 'fresh', themeClass: 'theme-green', imageUrl: IMAGE.moodFresh }
    ]
  },
  {
    id: 'scene',
    dimension: 'scene',
    title: '这顿和谁吃？',
    subtitle: '场景会影响多人、一人食和环境排序',
    type: 'single',
    options: [
      { id: 'scene_solo', label: '自己吃', desc: '一个人快速舒服地解决', value: 'solo', themeClass: 'theme-green', imageUrl: IMAGE.sceneSolo },
      { id: 'scene_group', label: '一起吃', desc: '适合聊天、分享、坐一会儿', value: 'group', themeClass: 'theme-red', imageUrl: IMAGE.sceneGroup }
    ]
  }
];

const BASE_DIMENSIONS = ['distance', 'budget', 'dining_mode'];

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function selectQuestionSet(count = 6) {
  const baseQuestions = BASE_DIMENSIONS.map((dimension) => {
    return questionBank.find((question) => question.dimension === dimension);
  }).filter(Boolean);
  const selected = shuffle(baseQuestions).slice(0, Math.min(2, baseQuestions.length, count));
  const selectedIds = new Set(selected.map((question) => question.id));
  const flexiblePool = questionBank.filter((question) => !selectedIds.has(question.id));
  selected.push(...shuffle(flexiblePool).slice(0, Math.max(0, count - selected.length)));
  return shuffle(selected).slice(0, count);
}

function buildProgressSegments(questions, currentIndex) {
  return questions.map((_, index) => ({
    id: `step-${index + 1}`,
    status: index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : 'is-todo'
  }));
}

const INITIAL_QUESTIONS = selectQuestionSet();

Page({
  data: {
    questions: INITIAL_QUESTIONS,
    currentIndex: 0,
    currentQuestion: INITIAL_QUESTIONS[0],
    progressText: `1 / ${INITIAL_QUESTIONS.length}`,
    progressSegments: buildProgressSegments(INITIAL_QUESTIONS, 0),
    answers: []
  },

  onLoad() {
    this.resetQuestionnaire();
  },

  resetQuestionnaire() {
    const questions = selectQuestionSet();

    this.setData({
      questions,
      currentIndex: 0,
      currentQuestion: questions[0],
      progressText: `1 / ${questions.length}`,
      progressSegments: buildProgressSegments(questions, 0),
      answers: []
    });
  },

  selectOption(event) {
    const { optionId } = event.currentTarget.dataset;
    const question = this.data.currentQuestion;
    const option = question.options.find((item) => item.id === optionId);

    if (!option) {
      return;
    }

    const answers = this.upsertAnswer(question, option);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers });

    if (nextIndex >= this.data.questions.length) {
      this.finishQuestionnaire(answers);
      return;
    }

    this.showQuestion(nextIndex);
  },

  skipQuestion() {
    const answers = this.upsertAnswer(this.data.currentQuestion, null);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers });

    if (nextIndex >= this.data.questions.length) {
      this.finishQuestionnaire(answers);
      return;
    }

    this.showQuestion(nextIndex);
  },

  goBack() {
    if (this.data.currentIndex === 0) {
      wx.navigateBack();
      return;
    }

    this.showQuestion(this.data.currentIndex - 1);
  },

  showQuestion(index) {
    const questions = this.data.questions;

    this.setData({
      currentIndex: index,
      currentQuestion: questions[index],
      progressText: `${index + 1} / ${questions.length}`,
      progressSegments: buildProgressSegments(questions, index)
    });
  },

  upsertAnswer(question, option) {
    const answer = {
      questionId: question.id,
      type: question.type,
      value: option ? option.value : null,
      optionIds: option ? [option.id] : [],
      answeredAt: new Date().toISOString()
    };

    return [...this.data.answers.filter((item) => item.questionId !== question.id), answer];
  },

  finishQuestionnaire(answers) {
    const result = {
      version: QUESTION_BANK_VERSION,
      source: 'onboarding',
      answers,
      submittedAt: new Date().toISOString()
    };

    wx.setStorageSync('meal_questionnaire_result', result);

    wx.redirectTo({
      url: '/pages/result/index'
    });
  }
});
