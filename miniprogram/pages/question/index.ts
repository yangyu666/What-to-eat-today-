import { QUESTION_BANK_VERSION, type QuestionBankItem, type QuestionBankOption } from '../../data/questionBank';
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
    const answers = this.upsertAnswer(this.data.currentQuestion as QuestionBankItem, null);
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

  showQuestion(index: number) {
    const questions = this.data.questions as QuestionBankItem[];

    this.setData({
      currentIndex: index,
      currentQuestion: questions[index],
      progressText: `${index + 1} / ${questions.length}`,
      progressSegments: buildProgressSegments(questions, index)
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

    return [...this.data.answers.filter((item) => item.questionId !== question.id), answer];
  },

  finishQuestionnaire(answers: UserPreferenceAnswer[]) {
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
