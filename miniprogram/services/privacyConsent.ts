export const LOCATION_CONSENT_STORAGE_KEY = 'privacy_location_consent_v1';

interface LocationConsentRecord {
  accepted: true;
  acceptedAt: string;
  scope: 'location-recommendation';
}

export function hasLocationConsent(): boolean {
  if (typeof wx === 'undefined') {
    return true;
  }

  try {
    const value = wx.getStorageSync(LOCATION_CONSENT_STORAGE_KEY) as
      | boolean
      | Partial<LocationConsentRecord>
      | undefined;

    return (
      value === true ||
      (Boolean(value) && typeof value === 'object' && value.accepted === true)
    );
  } catch (error) {
    console.warn('Failed to read location privacy consent.', error);
    return false;
  }
}

export function grantLocationConsent() {
  if (typeof wx === 'undefined') {
    return;
  }

  const record: LocationConsentRecord = {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    scope: 'location-recommendation'
  };

  wx.setStorageSync(LOCATION_CONSENT_STORAGE_KEY, record);
}

export function requireLocationConsent() {
  if (!hasLocationConsent()) {
    throw new Error('Location privacy consent is required before requesting location or AMap POI.');
  }
}
