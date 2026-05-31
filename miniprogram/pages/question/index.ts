import type {
  PreferenceOption,
  PreferenceQuestion,
  UserPreferenceAnswer,
  UserQuestionnaireResult
} from '../../types/userPreference';

interface QuestionViewModel extends PreferenceQuestion {
  options: PreferenceOption[];
}

const questions: QuestionViewModel[] = [
  {
    id: 'dining_mode',
    title: '堂食还是外卖？',
    type: 'single',
    required: true,
    options: [
      { id: 'dining_mode_dine_in', label: '堂食', selected: false, value: 'dine_in' },
      { id: 'dining_mode_delivery', label: '外卖', selected: false, value: 'delivery' }
    ]
  },
  {
    id: 'budget',
    title: '预算区间？',
    type: 'single',
    required: true,
    options: [
      { id: 'budget_under_30', label: '30以下', selected: false, value: 'under_30' },
      { id: 'budget_30_60', label: '30~60', selected: false, value: '30_60' },
      { id: 'budget_over_60', label: '60以上', selected: false, value: 'over_60' }
    ]
  },
  {
    id: 'distance',
    title: '能接受多远？',
    type: 'single',
    required: true,
    options: [
      { id: 'distance_500m', label: '500米', selected: false, value: 500 },
      { id: 'distance_1km', label: '1公里', selected: false, value: 1000 },
      { id: 'distance_any', label: '无所谓', selected: false, value: 'any' }
    ]
  },
  {
    id: 'flavor',
    title: '重口还是清淡？',
    type: 'single',
    required: true,
    options: [
      { id: 'flavor_strong', label: '重口', selected: false, value: 'strong' },
      { id: 'flavor_light', label: '清淡', selected: false, value: 'light' }
    ]
  },
  {
    id: 'temperature',
    title: '热食还是凉食？',
    type: 'single',
    required: true,
    options: [
      { id: 'temperature_hot', label: '热食', selected: false, value: 'hot' },
      { id: 'temperature_cold', label: '凉食', selected: false, value: 'cold' }
    ]
  },
  {
    id: 'meal_type',
    title: '正餐还是小吃？',
    type: 'single',
    required: true,
    options: [
      { id: 'meal_type_meal', label: '正餐', selected: false, value: 'meal' },
      { id: 'meal_type_snack', label: '小吃', selected: false, value: 'snack' }
    ]
  }
];

Page({
  data: {
    questions,
    currentIndex: 0,
    currentQuestion: questions[0],
    progressText: `1 / ${questions.length}`,
    progressPercent: 100 / questions.length,
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

    return [...this.data.answers.filter((item) => item.questionId !== question.id), answer];
  },

  finishQuestionnaire(answers: UserPreferenceAnswer[]) {
    const result: UserQuestionnaireResult = {
      version: 'v1.0-local',
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
