import type {
  PreferenceQuestion,
  PreferenceOption,
  UserPreferenceAnswer,
  UserQuestionnaireResult
} from '../../types/userPreference';

interface QuestionViewModel extends PreferenceQuestion {
  options: PreferenceOption[];
}

const questions: QuestionViewModel[] = [
  {
    id: 'flavor',
    title: '今天想吃重口还是清淡？',
    type: 'single',
    required: true,
    options: [
      { id: 'flavor_spicy', label: '重口味', selected: false, value: 'spicy' },
      { id: 'flavor_light', label: '清淡', selected: false, value: 'light' }
    ]
  },
  {
    id: 'staple',
    title: '主食更想来哪一种？',
    type: 'single',
    required: true,
    options: [
      { id: 'staple_rice', label: '米饭', selected: false, value: 'rice' },
      { id: 'staple_noodle', label: '面食', selected: false, value: 'noodle' },
      { id: 'staple_snack', label: '小吃', selected: false, value: 'snack' }
    ]
  },
  {
    id: 'speed',
    title: '你希望多久吃上？',
    type: 'single',
    required: true,
    options: [
      { id: 'speed_15', label: '15 分钟内', selected: false, value: 15 },
      { id: 'speed_30', label: '30 分钟内', selected: false, value: 30 },
      { id: 'speed_45', label: '慢慢选', selected: false, value: 45 }
    ]
  },
  {
    id: 'budget',
    title: '这顿预算大概多少？',
    type: 'single',
    required: true,
    options: [
      { id: 'budget_low', label: '25 元内', selected: false, value: 'low' },
      { id: 'budget_mid', label: '25-45 元', selected: false, value: 'mid' },
      { id: 'budget_high', label: '想吃好点', selected: false, value: 'high' }
    ]
  },
  {
    id: 'people',
    title: '这顿几个人吃？',
    type: 'single',
    required: true,
    options: [
      { id: 'people_one', label: '一个人', selected: false, value: 1 },
      { id: 'people_two', label: '两个人', selected: false, value: 2 },
      { id: 'people_group', label: '多人一起', selected: false, value: 3 }
    ]
  },
  {
    id: 'scene',
    title: '现在更想要什么感觉？',
    type: 'single',
    required: true,
    options: [
      { id: 'scene_fast', label: '省事快吃', selected: false, value: 'fast' },
      { id: 'scene_comfort', label: '舒服坐会儿', selected: false, value: 'comfort' },
      { id: 'scene_healthy', label: '健康少负担', selected: false, value: 'healthy' }
    ]
  }
];

Page({
  data: {
    questions,
    currentIndex: 0,
    currentQuestion: questions[0],
    progressText: '1 / 6',
    progressPercent: 16.67,
    answers: [] as UserPreferenceAnswer[]
  },

  selectOption(event: WechatMiniprogram.TouchEvent) {
    const { optionId } = event.currentTarget.dataset as { optionId: string };
    const question = this.data.currentQuestion as QuestionViewModel;
    const option = question.options.find((item) => item.id === optionId);

    if (!option) {
      return;
    }

    const answers = this.upsertAnswer(question, option);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers });

    if (nextIndex >= questions.length) {
      this.finishQuestionnaire(answers);
      return;
    }

    this.showQuestion(nextIndex);
  },

  skipQuestion() {
    const answers = this.upsertAnswer(this.data.currentQuestion as QuestionViewModel, null);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers });

    if (nextIndex >= questions.length) {
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

  showQuestion(index: number) {
    this.setData({
      currentIndex: index,
      currentQuestion: questions[index],
      progressText: `${index + 1} / ${questions.length}`,
      progressPercent: ((index + 1) / questions.length) * 100
    });
  },

  upsertAnswer(question: QuestionViewModel, option: PreferenceOption | null): UserPreferenceAnswer[] {
    const answer: UserPreferenceAnswer = {
      questionId: question.id,
      type: question.type,
      value: option?.value ?? null,
      optionIds: option ? [option.id] : [],
      answeredAt: new Date().toISOString()
    };

    return [
      ...this.data.answers.filter((item) => item.questionId !== question.id),
      answer
    ];
  },

  finishQuestionnaire(answers: UserPreferenceAnswer[]) {
    const draft = wx.getStorageSync('meal_questionnaire_draft') || {};
    const result: UserQuestionnaireResult & { promptText?: string } = {
      version: 'v1.0-local',
      source: 'onboarding',
      answers,
      submittedAt: new Date().toISOString(),
      promptText: draft.promptText || ''
    };

    wx.setStorageSync('meal_questionnaire_result', result);

    wx.redirectTo({
      url: '/pages/result/index'
    });
  }
});
