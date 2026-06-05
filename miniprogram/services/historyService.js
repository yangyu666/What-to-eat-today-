"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HISTORY_FILTER_STORAGE_KEY = void 0;
exports.trackRecommendationAction = trackRecommendationAction;
exports.getHistory = getHistory;
exports.getLocalHistory = getLocalHistory;
exports.getHistoryFilterEnabled = getHistoryFilterEnabled;
exports.setHistoryFilterEnabled = setHistoryFilterEnabled;
exports.clearLocalRecommendationHistory = clearLocalRecommendationHistory;
exports.getRecentHistoryFilterContext = getRecentHistoryFilterContext;
const cloud_1 = require("../config/cloud");
const HISTORY_STORAGE_KEY = 'meal_recommendation_history';
exports.HISTORY_FILTER_STORAGE_KEY = 'meal_filter_recent_history';
const HISTORY_CLEARED_STORAGE_KEY = 'meal_recommendation_history_cleared_at';
const MAX_LOCAL_HISTORY = 50;
const DEFAULT_HISTORY_FILTER_LIMIT = 10;
const SAVE_HISTORY_FUNCTION_NAME = 'saveRecommendationHistory';
const LIST_HISTORY_FUNCTION_NAME = 'listHistory';
const DEFAULT_RESTAURANT_IMAGES = {
    spicy: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
    rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
    light: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
    noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=360&q=80',
    snack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80',
    general: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=360&q=80'
};
let cloudInitialized = false;
async function trackRecommendationAction(options) {
    const record = buildHistoryRecord(options);
    saveHistoryRecordLocal(record);
    void saveHistoryRecordCloud(record).catch((error) => {
        console.warn('Fallback to local history after cloud history save failed.', error);
    });
    return record;
}
async function getHistory() {
    const clearedAt = getLocalHistoryClearedAt();
    try {
        const cloudHistory = await getCloudHistory();
        const visibleCloudHistory = clearedAt
            ? cloudHistory.filter((record) => getRecordTime(record) > clearedAt)
            : cloudHistory;
        if (visibleCloudHistory.length > 0) {
            syncLocalHistory(visibleCloudHistory);
            return clearedAt ? getLocalHistory() : visibleCloudHistory;
        }
    }
    catch (error) {
        console.warn('Fallback to local history after cloud history query failed.', error);
    }
    return getLocalHistory();
}
function getLocalHistory() {
    try {
        const history = wx.getStorageSync(HISTORY_STORAGE_KEY);
        return Array.isArray(history) ? history.slice(0, MAX_LOCAL_HISTORY) : [];
    }
    catch (error) {
        console.warn('Failed to read local recommendation history.', error);
        return [];
    }
}
function getHistoryFilterEnabled() {
    const stored = wx.getStorageSync(exports.HISTORY_FILTER_STORAGE_KEY);
    return typeof stored === 'boolean' ? stored : true;
}
function setHistoryFilterEnabled(enabled) {
    wx.setStorageSync(exports.HISTORY_FILTER_STORAGE_KEY, enabled);
}
function clearLocalRecommendationHistory() {
    wx.removeStorageSync(HISTORY_STORAGE_KEY);
    wx.removeStorageSync(exports.HISTORY_FILTER_STORAGE_KEY);
    wx.setStorageSync(HISTORY_CLEARED_STORAGE_KEY, new Date().toISOString());
}
function getRecentHistoryFilterContext(limit = DEFAULT_HISTORY_FILTER_LIMIT) {
    const historyFilterEnabled = getHistoryFilterEnabled();
    if (!historyFilterEnabled) {
        return {
            historyFilterEnabled,
            excludedHistoryRestaurantIds: [],
            historyPenaltyRestaurantIds: [],
            historyPenaltyReasons: []
        };
    }
    const recentHistory = getLocalHistory().slice(0, limit);
    const excludedHistoryRestaurantIds = uniqueRestaurantIds(recentHistory.filter((item) => item.action === 'accepted' || item.action === 'shown'));
    const historyPenaltyRestaurantIds = uniqueRestaurantIds(recentHistory.filter((item) => item.action === 'skipped')).filter((restaurantId) => !excludedHistoryRestaurantIds.includes(restaurantId));
    const historyPenaltyReasons = [
        ...excludedHistoryRestaurantIds.map((restaurantId) => `recent-history-excluded:${restaurantId}`),
        ...historyPenaltyRestaurantIds.map((restaurantId) => `recent-history-penalty:${restaurantId}`)
    ];
    return {
        historyFilterEnabled,
        excludedHistoryRestaurantIds,
        historyPenaltyRestaurantIds,
        historyPenaltyReasons
    };
}
function uniqueRestaurantIds(records) {
    return [
        ...new Set(records
            .map((item) => item.restaurantId)
            .filter((restaurantId) => Boolean(restaurantId)))
    ];
}
function getLocalHistoryClearedAt() {
    const value = wx.getStorageSync(HISTORY_CLEARED_STORAGE_KEY);
    const timestamp = new Date(value || '').getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
}
function buildHistoryRecord(options) {
    const now = new Date();
    const candidate = options.candidate;
    const restaurant = candidate.restaurant;
    const selectedAt = now.toISOString();
    const restaurantId = candidate.restaurantId ?? restaurant?.id;
    const restaurantName = restaurant?.name || candidate.name;
    const matchPercent = typeof candidate.confidenceScore === 'number'
        ? Math.round(candidate.confidenceScore)
        : undefined;
    const reasonSummary = buildReasonSummary(candidate);
    return {
        id: `history-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        candidateId: candidate.id,
        restaurantId,
        mealName: candidate.mealName || candidate.name,
        restaurantName,
        tags: candidate.tags,
        dateText: formatDateText(now),
        note: buildHistoryNote(candidate, options.switchCount),
        reasonSummary,
        imageUrl: candidate.imageUrl || getFallbackImageUrl(candidate.tags, restaurantName),
        action: options.action,
        selectedAt,
        createdAt: selectedAt,
        updatedAt: selectedAt,
        source: inferRecommendationSource(candidate),
        algorithmVersion: candidate.algorithmVersion,
        weightProfileId: candidate.weightProfileId,
        experimentId: candidate.experimentId,
        matchPercent,
        switchCount: options.switchCount,
        scoreBreakdown: candidate.scoreBreakdown,
        matchedPreferredTagIds: candidate.matchedPreferredTagIds ?? candidate.matchedTagIds,
        matchedAvoidedTagIds: candidate.matchedAvoidedTagIds,
        hardFilterReasons: candidate.hardFilterReasons,
        penaltyReasons: candidate.penaltyReasons,
        fallbackReason: candidate.fallbackReason,
        historyFilterEnabled: candidate.historyFilterEnabled,
        excludedHistoryRestaurantIds: candidate.excludedHistoryRestaurantIds,
        historyPenaltyReasons: candidate.historyPenaltyReasons,
        candidatePoolStats: candidate.candidatePoolStats,
        questionnaire: buildQuestionnaireSnapshot(options.questionnaire)
    };
}
function getFallbackImageUrl(tags, name) {
    const text = `${name} ${(tags ?? []).join(' ')}`;
    if (/辣|麻辣|火锅|川|湘|烧烤|重口/.test(text)) {
        return DEFAULT_RESTAURANT_IMAGES.spicy;
    }
    if (/饭|米|炒|盖饭|咖喱/.test(text)) {
        return DEFAULT_RESTAURANT_IMAGES.rice;
    }
    if (/轻食|沙拉|健康|清淡/.test(text)) {
        return DEFAULT_RESTAURANT_IMAGES.light;
    }
    if (/面|粉|粥|拉面|牛肉面/.test(text)) {
        return DEFAULT_RESTAURANT_IMAGES.noodle;
    }
    if (/小吃|炸|包子|饺子|馄饨/.test(text)) {
        return DEFAULT_RESTAURANT_IMAGES.snack;
    }
    return DEFAULT_RESTAURANT_IMAGES.general;
}
function saveHistoryRecordLocal(record) {
    const history = getLocalHistory();
    const deduped = history.filter((item) => item.id !== record.id);
    wx.setStorageSync(HISTORY_STORAGE_KEY, [record, ...deduped].slice(0, MAX_LOCAL_HISTORY));
}
function syncLocalHistory(records) {
    const localHistory = getLocalHistory();
    const recordMap = new Map();
    [...records, ...localHistory].forEach((record) => {
        recordMap.set(record.id, record);
    });
    wx.setStorageSync(HISTORY_STORAGE_KEY, [...recordMap.values()]
        .sort((left, right) => getRecordTime(right) - getRecordTime(left))
        .slice(0, MAX_LOCAL_HISTORY));
}
async function saveHistoryRecordCloud(record) {
    ensureCloudInitialized();
    const response = await wx.cloud.callFunction({
        name: SAVE_HISTORY_FUNCTION_NAME,
        data: {
            record
        }
    });
    const payload = response.result;
    if (!payload?.ok) {
        throw new Error(payload?.ok === false ? payload.error.message : 'Cloud history save failed.');
    }
}
async function getCloudHistory() {
    ensureCloudInitialized();
    const response = await wx.cloud.callFunction({
        name: LIST_HISTORY_FUNCTION_NAME,
        data: {
            pageSize: MAX_LOCAL_HISTORY
        }
    });
    const payload = response.result;
    if (!payload?.ok) {
        throw new Error(payload?.ok === false ? payload.error.message : 'Cloud history query failed.');
    }
    return payload.data.items.map((record) => normalizeHistoryRecord(record));
}
function normalizeHistoryRecord(record) {
    const createdAt = normalizeIsoDate(record.createdAt) ?? new Date().toISOString();
    return {
        ...record,
        id: record.id || record._id || `history-${createdAt}`,
        dateText: record.dateText || formatDateText(new Date(createdAt)),
        createdAt,
        updatedAt: normalizeIsoDate(record.updatedAt) ?? createdAt
    };
}
function buildQuestionnaireSnapshot(questionnaire) {
    if (!questionnaire) {
        return undefined;
    }
    return {
        version: questionnaire.version,
        answerCount: questionnaire.answers?.length ?? 0,
        submittedAt: questionnaire.submittedAt,
        answers: questionnaire.answers
    };
}
function ensureCloudInitialized() {
    if (!wx.cloud) {
        throw new Error('Current base library does not support cloud development.');
    }
    if (cloudInitialized) {
        return;
    }
    wx.cloud.init({
        env: cloud_1.cloudConfig.envId || undefined,
        traceUser: true
    });
    cloudInitialized = true;
}
function buildHistoryNote(candidate, switchCount) {
    const parts = [];
    if (typeof candidate.confidenceScore === 'number') {
        parts.push(`${Math.round(candidate.confidenceScore)}% 匹配`);
    }
    if (switchCount > 0) {
        parts.push(`换了 ${switchCount} 次`);
    }
    const reasonSummary = buildReasonSummary(candidate);
    if (reasonSummary) {
        parts.push(reasonSummary);
    }
    return parts.join(' · ');
}
function buildReasonSummary(candidate) {
    if (!candidate.reason) {
        return undefined;
    }
    return candidate.reason.split(/[；;，,]/).filter(Boolean)[0]?.trim();
}
function inferRecommendationSource(candidate) {
    if (candidate.source) {
        return candidate.source;
    }
    if (candidate.restaurantId?.startsWith('amap-') || candidate.restaurant?.id?.startsWith('amap-')) {
        return 'amap';
    }
    if (candidate.restaurantId?.startsWith('mock-') || candidate.restaurant?.id?.startsWith('mock-')) {
        return 'mock';
    }
    return 'rule';
}
function formatDateText(date) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.round((startOfTarget - startOfToday) / 86400000);
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (dayDiff === 0) {
        return `今天 ${time}`;
    }
    if (dayDiff === -1) {
        return `昨天 ${time}`;
    }
    return `${date.getMonth() + 1}-${date.getDate()} ${time}`;
}
function normalizeIsoDate(value) {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function getRecordTime(record) {
    const timestamp = new Date(record.createdAt || record.selectedAt || '').getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
