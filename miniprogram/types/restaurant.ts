export type IsoDateString = string;
export type RestaurantId = string;
export type TagId = string;
export type PriceLevel = 1 | 2 | 3 | 4 | 5;

export type TagGroup =
  | 'taste'
  | 'dish'
  | 'scene'
  | 'diet'
  | 'time'
  | 'price'
  | 'distance'
  | 'custom';

export type RestaurantStatus = 'active' | 'inactive' | 'closed';
export type RestaurantOpenStatus = 'unknown' | 'open' | 'resting' | 'closed' | 'busy';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BusinessHour {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  openTime: string;
  closeTime: string;
  crossesMidnight?: boolean;
}

export interface Tag {
  id: TagId;
  label: string;
  group: TagGroup;
  aliases?: string[];
  order?: number;
  enabled: boolean;
}

export interface RestaurantTagRef {
  id: TagId;
  label: string;
  group?: TagGroup;
  weight?: number;
}

export interface Restaurant {
  id: RestaurantId;
  name: string;
  tags: string[];
  tagIds?: TagId[];
  tagRefs?: RestaurantTagRef[];
  description?: string;
  category?: string;
  address?: string;
  location?: GeoPoint;
  distanceMeters?: number;
  priceLevel?: PriceLevel;
  averageCostYuan?: number;
  phone?: string;
  businessHours?: BusinessHour[];
  openStatus?: RestaurantOpenStatus;
  signatureDishes?: string[];
  coverImageUrl?: string;
  rating?: number;
  source?: 'manual' | 'imported' | 'user_created' | 'amap';
  status: RestaurantStatus;
}

export interface RestaurantSummary {
  id: RestaurantId;
  name: string;
  tags: string[];
  distanceMeters?: number;
  averageCostYuan?: number;
  openStatus?: RestaurantOpenStatus;
  rating?: number;
}

export interface CloudDocumentMeta {
  _id: string;
  _openid?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt?: IsoDateString | null;
}

export interface RestaurantDocument extends Restaurant, CloudDocumentMeta {}

export interface TagDocument extends Tag, CloudDocumentMeta {}

export interface ListRestaurantsRequest {
  tagIds?: TagId[];
  keyword?: string;
  location?: GeoPoint;
  maxDistanceMeters?: number;
  priceLevels?: PriceLevel[];
  pageSize?: number;
  cursor?: string;
}

export interface ListRestaurantsResponse {
  items: RestaurantSummary[];
  nextCursor?: string;
  hasMore: boolean;
}

export const RESTAURANT_COLLECTION = 'restaurants' as const;
export const TAG_COLLECTION = 'tags' as const;
