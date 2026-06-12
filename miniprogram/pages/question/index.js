"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const questionBank_1 = require("../../data/questionBank");
const privacyConsent_1 = require("../../services/privacyConsent");
const questionSelector_1 = require("../../services/questionSelector");
const INITIAL_QUESTIONS = (0, questionSelector_1.selectQuestionSet)();
function buildProgressSegments(questions, currentIndex) {
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
        answers: []
    },
    onLoad() {
        if (!(0, privacyConsent_1.hasLocationConsent)()) {
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
        const questions = (0, questionSelector_1.selectQuestionSet)();
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
        const questions = (0, questionSelector_1.selectQuestionSet)({
            answers,
            previousQuestions: this.data.questions
        });
        const nextIndex = this.data.currentIndex + 1;
        this.setData({ answers, questions });
        if (nextIndex >= questions.length) {
            this.finishQuestionnaire(answers);
            return;
        }
        this.showQuestion(nextIndex, questions);
    },
    skipQuestion() {
        const answers = this.upsertAnswer(this.data.currentQuestion, null);
        const questions = (0, questionSelector_1.selectQuestionSet)({
            answers,
            previousQuestions: this.data.questions
        });
        const nextIndex = this.data.currentIndex + 1;
        this.setData({ answers, questions });
        if (nextIndex >= questions.length) {
            this.finishQuestionnaire(answers);
            return;
        }
        this.showQuestion(nextIndex, questions);
    },
    goBack() {
        if (this.data.currentIndex === 0) {
            wx.navigateBack();
            return;
        }
        this.showQuestion(this.data.currentIndex - 1);
    },
    showQuestion(index, nextQuestions) {
        const questions = nextQuestions ?? this.data.questions;
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
            value: option?.value ?? null,
            optionIds: option ? [option.id] : [],
            answeredAt: new Date().toISOString()
        };
        return [...this.data.answers.filter((item) => item.questionId !== question.id), answer];
    },
    finishQuestionnaire(answers) {
        if (!(0, privacyConsent_1.hasLocationConsent)()) {
            wx.showToast({
                title: '请先同意位置使用说明',
                icon: 'none'
            });
            wx.switchTab({
                url: '/pages/home/index'
            });
            return;
        }
        const result = {
            version: questionBank_1.QUESTION_BANK_VERSION,
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
