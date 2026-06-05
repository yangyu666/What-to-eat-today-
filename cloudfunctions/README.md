# 云函数与数据库说明

小程序启动时会在 `miniprogram/app.ts` 初始化云开发；环境 ID 在 `miniprogram/config/cloud.ts` 中配置。

## MVP 必需云函数

### `setupDatabase`

- 入口：`cloudfunctions/setupDatabase/index.js`
- 入参：`{}`
- 出参：`ApiResponse<{ collections, indexes }>`
- 职责：创建 MVP 必需集合：`users`、`recommendation_history`。
- 使用方式：部署后在微信开发者工具里测试调用一次；返回 `created` 表示新建成功，返回 `exists` 表示集合已存在。
- 注意：索引和权限仍建议在云开发控制台确认配置。

### `amapPoi`

- 入口：`cloudfunctions/amapPoi/index.js`
- 入参：`{ latitude, longitude, radiusMeters?, keyword?, types?, pageSize? }`
- 出参：`ApiResponse<{ restaurants, location }>`
- 职责：调用高德 WebService POI，返回附近餐厅候选。
- 数据库：不写库。
- 上线配置：必须在云函数环境变量里配置 `AMAP_WEB_SERVICE_KEY` 或 `AMAP_KEY`。

#### AMap quota and POI cache

- `wx.getLocation` only obtains device latitude/longitude and does not consume AMap search quota.
- Quota is consumed by AMap WebService requests: place/around, reverse geocode (`regeo`), and IP location.
- `amapPoi` caches normalized POI candidate pools in `amap_poi_cache` for quota optimization. This is not a business collection and does not replace `users` or `recommendation_history`.
- Cache key dimensions include rounded location bucket, radius bucket, `types`, normalized `keyword`, and page profile.
- Cache TTL is 1 hour in the cloud function. A single cached candidate pool stores at most 250 normalized restaurant records and never stores the raw AMap response.
- The mini program also keeps a session/storage cache under `nearby_restaurants_amap_cache`; recommendation flows prefer that cache before calling `amapPoi`.

### `saveRecommendationHistory`

- 入口：`cloudfunctions/saveRecommendationHistory/index.js`
- 入参：`{ record }`
- 出参：`ApiResponse<SaveRecommendationHistoryResponse>`
- 职责：保存推荐展示、换一家、采纳等用户行为。
- 数据库：写入 `recommendation_history` 集合。
- 兜底：前端会先写本地 storage，再异步调用云函数；云同步失败不阻塞用户流程。

### `listHistory`

- 入口：`cloudfunctions/listHistory/index.js`
- 入参：`{ pageSize?, cursor?, action? }`
- 出参：`ApiResponse<ListHistoryResponse>`
- 职责：按当前用户 OPENID 读取自己的推荐历史。
- 数据库：读取 `recommendation_history` 集合，只返回 `_openid` 属于当前用户的数据。
- 前端读取：历史页通过该云函数读取，不直接从小程序端查集合。

### `syncUserProfile`

- 入口：`cloudfunctions/syncUserProfile/index.js`
- 入参：`{ nickname, avatarUrl }`
- 出参：`ApiResponse<{ user }>`
- 职责：保存“我的”页头像昵称。
- 数据库：写入/更新 `users` 集合。
- 用户标识：云函数通过 `cloud.getWXContext().OPENID` 获取 openid，前端不传 openid。

### `recommendRestaurant`

- 入口：`cloudfunctions/recommendRestaurant/index.js`
- 状态：保留为云端规则推荐能力。
- 当前主链路：优先使用 `amapPoi` 获取真实高德 POI，再在前端规则引擎排序。
- 数据库：当前不依赖自有餐厅库。

## MVP 必建集合

上线前创建 `users`、`recommendation_history` 和 `amap_poi_cache`。当前推荐主链路依赖高德 POI，不需要先把餐厅全量入库；`amap_poi_cache` 只用于额度优化缓存。

### `amap_poi_cache`

Purpose: quota optimization cache for AMap POI candidate pools. It is created by `setupDatabase` but is not a business data source. It can be cleared safely; the app will refetch from AMap when allowed by the request budget.

### `users`

用途：保存用户基础资料。

字段：

```js
{
  _id: openid,
  openid: openid,
  nickname: string,
  avatarUrl: string,
  createdAt: Date,
  updatedAt: Date
}
```

权限建议：

- 只允许云函数写入。
- 小程序端不直接读写全量用户资料。
- 使用 `_id = openid` 作为唯一用户文档。
- 先用微信云开发 OPENID 作为用户标识，不接手机号、不做账号密码。

索引建议：

- `_id`
- `openid` 或直接使用 `_id = openid`

### `recommendation_history`

用途：保存推荐展示和选择历史，用于历史页、历史过滤和后续 A/B 分析。

核心字段：

```js
{
  _openid: string,
  id: string,
  candidateId: string,
  restaurantId: string,
  restaurantName: string,
  mealName: string,
  action: 'shown' | 'skipped' | 'accepted' | 'dismissed',
  source: 'amap' | 'cloud' | 'mock' | 'rule' | 'manual',
  matchPercent: number,
  questionnaire: object,
  algorithmVersion: string,
  weightProfileId: string,
  experimentId: string,
  fallbackReason: string,
  candidatePoolStats: object,
  historyFilterEnabled: boolean,
  excludedHistoryRestaurantIds: string[],
  historyPenaltyReasons: string[],
  createdAt: string,
  updatedAt: string
}
```

权限建议：

- 写入走 `saveRecommendationHistory` 云函数。
- 小程序端读取时只允许读取自己的 `_openid` 数据。
- 内测阶段不要开放全量读权限。

索引建议：

- `_openid + createdAt`
- `_openid + action + createdAt`

## MVP 暂不创建集合

- `restaurants`：当前餐厅来自高德 POI，暂不维护自有餐厅库。
- `tags`：当前标签规则在代码中维护，暂不做后台标签字典。
- `user_preferences`：问答偏好当前存在本地和历史快照里，暂不单独云端保存。

这些集合可以在后续后台管理、长期用户画像、商家运营阶段再补。

## 上线前控制台操作

1. 部署云函数：`setupDatabase`、`amapPoi`、`saveRecommendationHistory`、`listHistory`、`syncUserProfile`。
2. 在微信开发者工具里测试调用 `setupDatabase`，创建 `users`、`recommendation_history`。
3. 保留部署：`recommendRestaurant`。
4. 给 `amapPoi` 配置环境变量：`AMAP_WEB_SERVICE_KEY` 或 `AMAP_KEY`。
5. 配置集合权限，禁止全量公开读写。
6. 配置索引：`recommendation_history` 的 `_openid + createdAt`、`_openid + action + createdAt`。
7. 真机验证头像昵称同步、推荐历史保存、历史页读取。

## 统一返回格式

云函数统一返回 `ApiResponse<T>`：

```js
// 成功
{ ok: true, data, requestId }

// 失败
{ ok: false, error: { code, message, details }, requestId }
```
