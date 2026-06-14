import { QUESTION_BANK_VERSION, type QuestionBankItem, type QuestionBankOption } from '../../data/questionBank';
import { hasLocationConsent } from '../../services/privacyConsent';
import { selectQuestionSet } from '../../services/questionSelector';
import type { UserPreferenceAnswer, UserQuestionnaireResult } from '../../types/userPreference';

const INITIAL_QUESTIONS = selectQuestionSet();

function buildProgressSegments(questions: QuestionBankItem[], currentIndex: number) {
  return questions.map((_, index) => ({
    id: `step-${index + 1}`,
    status: index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : 'is-todo'
  }));
}

Page({
  data: {
    questions: INITIAL_QUESTIONS,
    currentIndex: 0,
    currentQuestion: INITIAL_QUESTIONS[0],
    progressText: `1 / ${INITIAL_QUESTIONS.length}`,
    progressSegments: buildProgressSegments(INITIAL_QUESTIONS, 0),
    answers: [] as UserPreferenceAnswer[]
  },

  onLoad() {
    if (!hasLocationConsent()) {
      wx.showToast({
        title: '请先同意位置使用说明',
        icon: 'none'
      });
      wx.switchTab({
        url: '/pages/home/index'
      });
      return;
    }

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

  selectOption(event: WechatMiniprogram.TouchEvent) {
    const { optionId } = event.currentTarget.dataset as { optionId: string };
    const question = this.data.currentQuestion as QuestionBankItem;
    const option = question.options.find((item) => item.id === optionId);
    const questions = this.data.questions as QuestionBankItem[];

    if (!option) {
      return;
    }

    const answers = this.upsertAnswer(question, option);
    const nextQuestions = this.refreshQuestionSet(answers, questions);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers, questions: nextQuestions });

    if (nextIndex >= nextQuestions.length) {
      this.finishQuestionnaire(answers);
      return;
    }

    this.showQuestion(nextIndex, nextQuestions);
  },

  skipQuestion() {
    const questions = this.data.questions as QuestionBankItem[];
    const answers = this.upsertAnswer(this.data.currentQuestion as QuestionBankItem, null);
    const nextQuestions = this.refreshQuestionSet(answers, questions);
    const nextIndex = this.data.currentIndex + 1;

    this.setData({ answers, questions: nextQuestions });

    if (nextIndex >= nextQuestions.length) {
      this.finishQuestionnaire(answers);
      return;
    }

    this.showQuestion(nextIndex, nextQuestions);
  },

  goBack() {
    if (this.data.currentIndex === 0) {
      wx.navigateBack();
      return;
    }

    this.showQuestion(this.data.currentIndex - 1);
  },

  showQuestion(index: number, nextQuestions?: QuestionBankItem[]) {
    const questions = nextQuestions ?? (this.data.questions as QuestionBankItem[]);
    const safeIndex = Math.max(0, Math.min(index, questions.length - 1));

    this.setData({
      currentIndex: safeIndex,
      currentQuestion: questions[safeIndex],
      progressText: `${safeIndex + 1} / ${questions.length}`,
      progressSegments: buildProgressSegments(questions, safeIndex)
    });
  },

  upsertAnswer(question: QuestionBankItem, option: QuestionBankOption | null): UserPreferenceAnswer[] {
    const answer: UserPreferenceAnswer = {
      questionId: question.id,
      type: question.type,
      value: option?.value ?? null,
      optionIds: option ? [option.id] : [],
      answeredAt: new Date().toISOString()
    };

    const questions = this.data.questions as QuestionBankItem[];
    const currentIndex = this.data.currentIndex;
    const orderedAnswers = (this.data.answers as UserPreferenceAnswer[]).slice(0, currentIndex);

    orderedAnswers[currentIndex] = answer;

    return orderedAnswers.filter((item, index) => questions[index]?.id === item.questionId);
  },

  refreshQuestionSet(answers: UserPreferenceAnswer[], previousQuestions: QuestionBankItem[]): QuestionBankItem[] {
    return selectQuestionSet({
      answers,
      previousQuestions,
      count: previousQuestions.length
    });
  },

  finishQuestionnaire(answers: UserPreferenceAnswer[]) {
    if (!hasLocationConsent()) {
      wx.showToast({
        title: '请先同意位置使用说明',
        icon: 'none'
      });
      wx.switchTab({
        url: '/pages/home/index'
      });
      return;
    }

    const result: UserQuestionnaireResult = {
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
