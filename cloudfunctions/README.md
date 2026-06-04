# 云函数与数据库说明

小程序启动时会在 `miniprogram/app.ts` 初始化云开发；环境 ID 在 `miniprogram/config/cloud.ts` 中配置。

## MVP 必需云函数

### `amapPoi`

- 入口：`cloudfunctions/amapPoi/index.js`
- 入参：`{ latitude, longitude, radiusMeters?, keyword?, types?, pageSize? }`
- 出参：`ApiResponse<{ restaurants, location }>`
- 职责：调用高德 WebService POI，返回附近餐厅候选。
- 数据库：不写库。
- 上线配置：必须在云函数环境变量里配置 `AMAP_WEB_SERVICE_KEY` 或 `AMAP_KEY`。

### `saveRecommendationHistory`

- 入口：`cloudfunctions/saveRecommendationHistory/index.js`
- 入参：`{ record }`
- 出参：`ApiResponse<SaveRecommendationHistoryResponse>`
- 职责：保存推荐展示、换一家、采纳等用户行为。
- 数据库：写入 `recommendation_history` 集合。
- 兜底：前端会先写本地 storage，再异步调用云函数；云同步失败不阻塞用户流程。

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

上线前只创建 `users` 和 `recommendation_history` 两个集合。当前推荐主链路依赖高德 POI，不需要先把餐厅全量入库。

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

1. 在微信云开发控制台创建集合：`users`、`recommendation_history`。
2. 部署云函数：`amapPoi`、`saveRecommendationHistory`、`syncUserProfile`。
3. 保留部署：`recommendRestaurant`。
4. 给 `amapPoi` 配置环境变量：`AMAP_WEB_SERVICE_KEY` 或 `AMAP_KEY`。
5. 配置集合权限，禁止全量公开读写。
6. 真机验证头像昵称同步、推荐历史保存、历史页读取。

## 统一返回格式

云函数统一返回 `ApiResponse<T>`：

```js
// 成功
{ ok: true, data, requestId }

// 失败
{ ok: false, error: { code, message, details }, requestId }
```
