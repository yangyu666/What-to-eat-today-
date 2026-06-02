import { cloudConfig } from '../config/cloud';
import type {
  ApiResponse,
  MealCandidate,
  RecommendationAction,
  RecommendationHistoryRecord,
  RecommendationSource,
  SaveRecommendationHistoryResponse
} from '../types/recommendation';
import { RECOMMENDATION_HISTORY_COLLECTION } from '../types/recommendation';
import type { UserQuestionnaireResult } from '../types/userPreference';

const HISTORY_STORAGE_KEY = 'meal_recommendation_history';
const MAX_LOCAL_HISTORY = 50;
const SAVE_HISTORY_FUNCTION_NAME = 'saveRecommendationHistory';
const DEFAULT_RESTAURANT_IMAGES = {
  spicy: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=360&q=80',
  rice: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=360&q=80',
  light: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=360&q=80',
  noodle: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=360&q=80',
  snack: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=360&q=80',
  general: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=360&q=80'
} as const;

interface TrackRecommendationOptions {
  action: RecommendationAction;
  candidate: MealCandidate;
  questionnaire?: UserQuestionnaireResult;
  switchCount: number;
}

type CloudHistoryRecord = RecommendationHistoryRecord & {
  _id?: string;
};

let cloudInitialized = false;

export async function trackRecommendationAction(
  options: TrackRecommendationOptions
): Promise<RecommendationHistoryRecord> {
  const record = buildHistoryRecord(options);

  saveHistoryRecordLocal(record);
  void saveHistoryRecordCloud(record).catch((error: unknown) => {
    console.warn('Fallback to local history after cloud history save failed.', error);
  });

  return record;
}

export async function getHistory(): Promise<RecommendationHistoryRecord[]> {
  try {
    const cloudHistory = await getCloudHistory();

    if (cloudHistory.length > 0) {
      syncLocalHistory(cloudHistory);
      return cloudHistory;
    }
  } catch (error) {
    console.warn('Fallback to local history after cloud history query failed.', error);
  }

  return getLocalHistory();
}

export function getLocalHistory(): RecommendationHistoryRecord[] {
  try {
    const history = wx.getStorageSync(HISTORY_STORAGE_KEY) as
      | RecommendationHistoryRecord[]
      | undefined;

    return Array.isArray(history) ? history.slice(0, MAX_LOCAL_HISTORY) : [];
  } catch (error) {
    console.warn('Failed to read local recommendation history.', error);
    return [];
  }
}

function buildHistoryRecord(options: TrackRecommendationOptions): RecommendationHistoryRecord {
  const now = new Date();
  const candidate = options.candidate;
  const restaurant = candidate.restaurant;
  const selectedAt = now.toISOString();
  const restaurantId = candidate.restaurantId ?? restaurant?.id;
  const restaurantName = restaurant?.name || candidate.name;
  const matchPercent =
    typeof candidate.confidenceScore === 'number'
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
    candidatePoolStats: candidate.candidatePoolStats,
    questionnaire: buildQuestionnaireSnapshot(options.questionnaire)
  };
}

function getFallbackImageUrl(tags: string[] | undefined, name: string): string {
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

function saveHistoryRecordLocal(record: RecommendationHistoryRecord) {
  const history = getLocalHistory();
  const deduped = history.filter((item) => item.id !== record.id);

  wx.setStorageSync(HISTORY_STORAGE_KEY, [record, ...deduped].slice(0, MAX_LOCAL_HISTORY));
}

function syncLocalHistory(records: RecommendationHistoryRecord[]) {
  const localHistory = getLocalHistory();
  const recordMap = new Map<string, RecommendationHistoryRecord>();

  [...records, ...localHistory].forEach((record) => {
    recordMap.set(record.id, record);
  });

  wx.setStorageSync(
    HISTORY_STORAGE_KEY,
    [...recordMap.values()]
      .sort((left, right) => getRecordTime(right) - getRecordTime(left))
      .slice(0, MAX_LOCAL_HISTORY)
  );
}

async function saveHistoryRecordCloud(record: RecommendationHistoryRecord) {
  ensureCloudInitialized();

  const response = await wx.cloud.callFunction({
    name: SAVE_HISTORY_FUNCTION_NAME,
    data: {
      record
    }
  });
  const payload = response.result as ApiResponse<SaveRecommendationHistoryResponse> | undefined;

  if (!payload?.ok) {
    throw new Error(payload?.ok === false ? payload.error.message : 'Cloud history save failed.');
  }
}

async function getCloudHistory(): Promise<RecommendationHistoryRecord[]> {
  ensureCloudInitialized();

  const database = wx.cloud.database();
  const response = await database
    .collection(RECOMMENDATION_HISTORY_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(MAX_LOCAL_HISTORY)
    .get();
  const data = response.data as CloudHistoryRecord[];

  return Array.isArray(data) ? data.map(normalizeHistoryRecord) : [];
}

function normalizeHistoryRecord(record: CloudHistoryRecord): RecommendationHistoryRecord {
  const createdAt = normalizeIsoDate(record.createdAt) ?? new Date().toISOString();

  return {
    ...record,
    id: record.id || record._id || `history-${createdAt}`,
    dateText: record.dateText || formatDateText(new Date(createdAt)),
    createdAt,
    updatedAt: normalizeIsoDate(record.updatedAt) ?? createdAt
  };
}

function buildQuestionnaireSnapshot(questionnaire?: UserQuestionnaireResult) {
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
    env: cloudConfig.envId || undefined,
    traceUser: true
  });
  cloudInitialized = true;
}

function buildHistoryNote(candidate: MealCandidate, switchCount: number): string {
  const parts: string[] = [];

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

function buildReasonSummary(candidate: MealCandidate): string | undefined {
  if (!candidate.reason) {
    return undefined;
  }

  return candidate.reason.split(/[；;，,]/).filter(Boolean)[0]?.trim();
}

function inferRecommendationSource(candidate: MealCandidate): RecommendationSource {
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

function formatDateText(date: Date): string {
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

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getRecordTime(record: RecommendationHistoryRecord): number {
  const timestamp = new Date(record.createdAt || record.selectedAt || '').getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}
