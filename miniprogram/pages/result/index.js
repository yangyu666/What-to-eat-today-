"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const historyService_1 = require("../../services/historyService");
const mealService_1 = require("../../services/mealService");
const privacyConsent_1 = require("../../services/privacyConsent");
const MAX_SWITCH_COUNT = 3;
const TAG_LABEL_MAP = {
    coffee: '咖啡',
    relaxed: '放松',
    slow: '慢节奏',
    quick: '出餐快',
    light: '清淡',
    healthy: '健康',
    hot: '热乎',
    comfort: '暖胃',
    rice: '米饭',
    noodle: '面食',
    staple: '主食',
    spicy: '辣味',
    strong_flavor: '重口味',
    not_spicy: '不辣',
    salad: '沙拉',
    low_burden: '低负担',
    vegetarian: '素食友好',
    solo: '一人食',
    group: '多人',
    snack: '小吃',
    dessert: '甜品',
    milk_tea: '奶茶',
    drink: '饮品',
    afternoon_tea: '下午茶'
};
const FALLBACK_COVER_IMAGES = {
    premium: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
    milkTea: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=900&q=80',
    coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
    dessert: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80',
    spicy: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
    light: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
    noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    snack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=80',
    general: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80'
};
Page({
    data: {
        candidates: [],
        currentIndex: 0,
        recommendation: null,
        answerCount: 0,
        loading: false,
        switchCount: 0,
        maxSwitchCount: MAX_SWITCH_COUNT,
        locked: false,
        accepted: false,
        matchPercent: 0,
        distanceText: '',
        averageCostText: '',
        walkText: '',
        ratingText: '',
        mealNameText: '',
        coverImageUrl: '',
        errorText: '',
        reasonItems: [],
        historyFilterEnabled: true,
        excludedHistoryRestaurantIds: [],
        historyPenaltyReasons: [],
        switchButtonText: '换一家',
        poiCacheHit: false,
        poiCacheKey: '',
        poiCacheAgeMs: undefined,
        poiFetchReason: '',
        amapApiCallCount: 0,
        poiFetchMode: '',
        aroundCallCount: 0,
        polygonCallCount: 0,
        keywordCallCount: 0,
        idCallCount: 0,
        cacheHitCount: 0,
        totalAmapApiCallCount: 0,
        quotaBucket: ''
    },
    onLoad() {
        if (!(0, privacyConsent_1.hasLocationConsent)()) {
            this.setData({
                loading: false,
                errorText: '请先同意位置使用说明'
            });
            wx.showToast({
                title: '请先同意位置使用说明',
                icon: 'none'
            });
            wx.switchTab({
                url: '/pages/home/index'
            });
            return;
        }
        const result = wx.getStorageSync('meal_questionnaire_result');
        this.setData({
            answerCount: result?.answers?.length || 0
        });
        this.loadRecommendation(result);
    },
    async loadRecommendation(result) {
        if (!(0, privacyConsent_1.hasLocationConsent)()) {
            this.setData({
                loading: false,
                errorText: '请先同意位置使用说明'
            });
            return;
        }
        this.setData({ loading: true, errorText: '' });
        try {
            const historyFilterContext = (0, historyService_1.getRecentHistoryFilterContext)();
            const candidates = await (0, mealService_1.getLocalRecommendations)(result, historyFilterContext);
            if (candidates.length === 0) {
                this.setCurrentRecommendation([], 0, {
                    loading: false,
                    switchCount: 0,
                    locked: false,
                    accepted: false,
                    historyFilterEnabled: historyFilterContext.historyFilterEnabled,
                    excludedHistoryRestaurantIds: historyFilterContext.excludedHistoryRestaurantIds,
                    historyPenaltyReasons: historyFilterContext.historyPenaltyReasons,
                    errorText: '推荐加载失败，请稍后重试'
                });
                return;
            }
            this.setCurrentRecommendation(candidates, 0, {
                loading: false,
                switchCount: 0,
                locked: false,
                accepted: false,
                historyFilterEnabled: historyFilterContext.historyFilterEnabled,
                excludedHistoryRestaurantIds: historyFilterContext.excludedHistoryRestaurantIds,
                historyPenaltyReasons: historyFilterContext.historyPenaltyReasons,
                switchButtonText: '换一家'
            });
            this.trackCurrentRecommendation('shown', candidates[0], 0, result);
        }
        catch (error) {
            console.error('Failed to load recommendation.', error);
            this.setData({
                loading: false,
                candidates: [],
                recommendation: null,
                errorText: '推荐加载失败，请稍后重试'
            });
            wx.showToast({
                title: '推荐加载失败',
                icon: 'none'
            });
        }
    },
    switchRestaurant() {
        if (this.data.locked || this.data.accepted || this.data.candidates.length === 0) {
            return;
        }
        const nextSwitchCount = this.data.switchCount + 1;
        if (nextSwitchCount > MAX_SWITCH_COUNT) {
            this.setData({
                locked: true,
                switchButtonText: '已锁定'
            });
            wx.showToast({
                title: '结果已锁定',
                icon: 'none'
            });
            return;
        }
        const nextIndex = this.data.currentIndex + 1;
        if (nextIndex >= this.data.candidates.length) {
            this.trackCurrentRecommendation('skipped', this.data.recommendation, nextSwitchCount, this.getQuestionnaireResult());
            this.setData({
                switchCount: nextSwitchCount,
                locked: true,
                switchButtonText: '已锁定'
            });
            wx.showToast({
                title: '没有更多新店',
                icon: 'none'
            });
            return;
        }
        const questionnaire = this.getQuestionnaireResult();
        const nextCandidate = this.data.candidates[nextIndex];
        this.trackCurrentRecommendation('skipped', this.data.recommendation, nextSwitchCount, questionnaire);
        this.setCurrentRecommendation(this.data.candidates, nextIndex, {
            switchCount: nextSwitchCount,
            locked: nextSwitchCount >= MAX_SWITCH_COUNT,
            switchButtonText: nextSwitchCount >= MAX_SWITCH_COUNT ? '已锁定' : '换一家'
        });
        this.trackCurrentRecommendation('shown', nextCandidate, nextSwitchCount, questionnaire);
        if (nextSwitchCount >= MAX_SWITCH_COUNT) {
            wx.showToast({
                title: '已自动锁定',
                icon: 'none'
            });
        }
    },
    acceptRestaurant() {
        if (!this.data.recommendation) {
            return;
        }
        this.setData({
            accepted: true,
            locked: true
        });
        this.trackCurrentRecommendation('accepted', this.data.recommendation, this.data.switchCount, this.getQuestionnaireResult());
        wx.showToast({
            title: '就吃这家',
            icon: 'success'
        });
    },
    reloadRecommendation() {
        this.loadRecommendation(this.getQuestionnaireResult());
    },
    handleCoverImageError() {
        const fallbackUrl = getFallbackCoverImageUrl(this.data.recommendation);
        this.setData({
            coverImageUrl: fallbackUrl && fallbackUrl !== this.data.coverImageUrl ? fallbackUrl : ''
        });
    },
    navigateToRestaurant() {
        const restaurant = this.data.recommendation?.restaurant;
        const location = restaurant?.location;
        if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
            wx.showToast({
                title: '暂无门店位置',
                icon: 'none'
            });
            return;
        }
        wx.openLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            name: restaurant?.name || this.data.recommendation?.name || '推荐门店',
            address: restaurant?.address || '',
            scale: 16
        });
    },
    goBack() {
        wx.navigateBack({
            delta: 1,
            fail: () => {
                wx.switchTab({
                    url: '/pages/home/index'
                });
            }
        });
    },
    goHome() {
        wx.switchTab({
            url: '/pages/home/index'
        });
    },
    setCurrentRecommendation(candidates, currentIndex, extraData = {}) {
        const recommendation = candidates[currentIndex] ?? null;
        const distanceMeters = recommendation?.restaurant?.distanceMeters;
        const averageCostYuan = recommendation?.restaurant?.averageCostYuan;
        const walkingMinutes = typeof distanceMeters === 'number' ? Math.max(1, Math.ceil(distanceMeters / 120)) : null;
        const rating = recommendation?.restaurant?.rating;
        if (recommendation) {
            console.warn('Recommendation POI fetch meta.', {
                poiCacheHit: recommendation.poiCacheHit,
                poiCacheKey: recommendation.poiCacheKey,
                poiCacheAgeMs: recommendation.poiCacheAgeMs,
                poiFetchReason: recommendation.poiFetchReason,
                amapApiCallCount: recommendation.amapApiCallCount,
                poiFetchMode: recommendation.poiFetchMode,
                aroundCallCount: recommendation.aroundCallCount,
                polygonCallCount: recommendation.polygonCallCount,
                keywordCallCount: recommendation.keywordCallCount,
                idCallCount: recommendation.idCallCount,
                cacheHitCount: recommendation.cacheHitCount,
                totalAmapApiCallCount: recommendation.totalAmapApiCallCount,
                quotaBucket: recommendation.quotaBucket
            });
        }
        this.setData({
            candidates,
            currentIndex,
            recommendation,
            matchPercent: recommendation ? Math.round(recommendation.confidenceScore ?? 0) : 0,
            distanceText: typeof distanceMeters === 'number' ? `${(distanceMeters / 1000).toFixed(1)} km` : '距离未知',
            averageCostText: typeof averageCostYuan === 'number' ? `¥ ${averageCostYuan}/人` : '人均未知',
            walkText: walkingMinutes ? `步行${walkingMinutes}分钟` : '步行时间未知',
            ratingText: typeof rating === 'number' ? `${rating.toFixed(1)}评分` : '评分未知',
            mealNameText: recommendation?.mealName || recommendation?.name || '',
            coverImageUrl: getStableCoverImageUrl(recommendation),
            reasonItems: recommendation
                ? this.buildReasonItems(recommendation, walkingMinutes, averageCostYuan)
                : [],
            poiCacheHit: recommendation?.poiCacheHit === true,
            poiCacheKey: recommendation?.poiCacheKey ?? '',
            poiCacheAgeMs: recommendation?.poiCacheAgeMs,
            poiFetchReason: recommendation?.poiFetchReason ?? '',
            amapApiCallCount: recommendation?.amapApiCallCount ?? 0,
            poiFetchMode: recommendation?.poiFetchMode ?? '',
            aroundCallCount: recommendation?.aroundCallCount ?? 0,
            polygonCallCount: recommendation?.polygonCallCount ?? 0,
            keywordCallCount: recommendation?.keywordCallCount ?? 0,
            idCallCount: recommendation?.idCallCount ?? 0,
            cacheHitCount: recommendation?.cacheHitCount ?? 0,
            totalAmapApiCallCount: recommendation?.totalAmapApiCallCount ?? 0,
            quotaBucket: recommendation?.quotaBucket ?? '',
            ...extraData
        });
    },
    buildReasonItems(recommendation, walkingMinutes, averageCostYuan) {
        const preferenceLabels = this.getPreferenceLabels(recommendation);
        const distanceMeters = recommendation.restaurant?.distanceMeters;
        const penaltyReasons = recommendation.penaltyReasons ?? [];
        const hasDistanceFallback = Boolean(recommendation.fallbackReason) ||
            penaltyReasons.some((reason) => reason.includes('距离') || reason.includes('搜索范围'));
        const hasBudgetMismatch = penaltyReasons.some((reason) => reason.includes('预算') || reason.includes('价格低于'));
        const items = [
            {
                title: preferenceLabels.length > 0
                    ? `匹配${preferenceLabels.join('、')}偏好`
                    : '匹配今天的口味偏好',
                desc: '符合你今天的口味倾向'
            },
            {
                title: typeof distanceMeters === 'number'
                    ? hasDistanceFallback
                        ? `距离约 ${distanceMeters} 米，已放宽距离`
                        : `距离约 ${distanceMeters} 米，在你的范围内`
                    : walkingMinutes
                        ? `步行${walkingMinutes}分钟`
                        : '距离较近',
                desc: hasDistanceFallback ? '严格距离内候选较少，匹配度已下调' : '距离你的位置很近'
            },
            {
                title: typeof averageCostYuan === 'number'
                    ? hasBudgetMismatch
                        ? `人均约 ${averageCostYuan} 元，预算档不完全匹配`
                        : `人均约 ${averageCostYuan} 元，符合预算`
                    : '价格信息有限',
                desc: hasBudgetMismatch ? '已按普通匹配展示，不会伪装成强匹配' : '符合你的预算范围'
            },
            {
                title: recommendation.fallbackReason ?? '出餐速度快',
                desc: recommendation.fallbackReason ? '这是放宽条件后的推荐理由' : '预计等待时间较短'
            }
        ];
        return items.slice(0, 4);
    },
    getPreferenceLabels(recommendation) {
        const preferredTags = recommendation.matchedPreferredTagIds ?? recommendation.matchedTagIds ?? [];
        const labels = preferredTags
            .map((tagId) => TAG_LABEL_MAP[tagId] ?? tagId)
            .filter((label) => !/^[a-z_]+$/i.test(label));
        if (labels.length > 0) {
            return [...new Set(labels)].slice(0, 3);
        }
        return [...new Set(recommendation.tags)].slice(0, 3);
    },
    trackCurrentRecommendation(action, candidate, switchCount, questionnaire) {
        if (!candidate) {
            return;
        }
        void (0, historyService_1.trackRecommendationAction)({
            action,
            candidate,
            questionnaire,
            switchCount
        }).catch((error) => {
            console.warn('Recommendation tracking failed.', error);
        });
    },
    getQuestionnaireResult() {
        return wx.getStorageSync('meal_questionnaire_result');
    },
});
function getStableCoverImageUrl(recommendation) {
    if (!recommendation) {
        return '';
    }
    const restaurantImageUrl = recommendation.restaurant
        ?.coverImageUrl;
    const imageUrl = normalizeImageUrl(recommendation.imageUrl || restaurantImageUrl);
    const isAmapRestaurant = recommendation.source === 'amap' ||
        recommendation.restaurantId?.startsWith('amap-') ||
        recommendation.restaurant?.id?.startsWith('amap-');
    if (isAmapRestaurant && imageUrl) {
        return imageUrl;
    }
    return imageUrl || getFallbackCoverImageUrl(recommendation);
}
function normalizeImageUrl(url) {
    return typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : '';
}
function getFallbackCoverImageUrl(recommendation) {
    if (!recommendation) {
        return '';
    }
    const text = [
        recommendation.name,
        recommendation.mealName,
        recommendation.restaurant?.name,
        recommendation.restaurant?.category,
        ...(recommendation.tags ?? []),
        ...(recommendation.matchedPreferredTagIds ?? [])
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    if (/premium|高端|黑珍珠|米其林|omakase|fine dining|法餐|日料|炳胜|利苑|premium_brand/.test(text)) {
        return FALLBACK_COVER_IMAGES.premium;
    }
    if (/奶茶|茶饮|milk_tea|霸王茶姬|喜茶|奈雪/.test(text)) {
        return FALLBACK_COVER_IMAGES.milkTea;
    }
    if (/咖啡|coffee|cafe/.test(text)) {
        return FALLBACK_COVER_IMAGES.coffee;
    }
    if (/甜品|蛋糕|面包|dessert|bakery/.test(text)) {
        return FALLBACK_COVER_IMAGES.dessert;
    }
    if (/辣|川|湘|火锅|麻辣|spicy|strong_flavor/.test(text)) {
        return FALLBACK_COVER_IMAGES.spicy;
    }
    if (/轻食|沙拉|健康|清淡|light|healthy|salad/.test(text)) {
        return FALLBACK_COVER_IMAGES.light;
    }
    if (/面|粉|粥|noodle|congee/.test(text)) {
        return FALLBACK_COVER_IMAGES.noodle;
    }
    if (/饭|米|盖饭|rice/.test(text)) {
        return FALLBACK_COVER_IMAGES.rice;
    }
    if (/小吃|包子|饺|snack|dim_sum/.test(text)) {
        return FALLBACK_COVER_IMAGES.snack;
    }
    return FALLBACK_COVER_IMAGES.general;
}
