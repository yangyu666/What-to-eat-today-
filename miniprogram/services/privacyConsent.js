"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCATION_CONSENT_STORAGE_KEY = void 0;
exports.hasLocationConsent = hasLocationConsent;
exports.grantLocationConsent = grantLocationConsent;
exports.requireLocationConsent = requireLocationConsent;
exports.LOCATION_CONSENT_STORAGE_KEY = 'privacy_location_consent_v1';
function hasLocationConsent() {
    if (typeof wx === 'undefined') {
        return true;
    }
    try {
        const value = wx.getStorageSync(exports.LOCATION_CONSENT_STORAGE_KEY);
        return (value === true ||
            (Boolean(value) && typeof value === 'object' && value.accepted === true));
    }
    catch (error) {
        console.warn('Failed to read location privacy consent.', error);
        return false;
    }
}
function grantLocationConsent() {
    if (typeof wx === 'undefined') {
        return;
    }
    const record = {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        scope: 'location-recommendation'
    };
    wx.setStorageSync(exports.LOCATION_CONSENT_STORAGE_KEY, record);
}
function requireLocationConsent() {
    if (!hasLocationConsent()) {
        throw new Error('Location privacy consent is required before requesting location or AMap POI.');
    }
}
