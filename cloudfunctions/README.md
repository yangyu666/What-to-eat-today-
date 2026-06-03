# 云函数目录

小程序启动时会在 `miniprogram/app.ts` 初始化云开发；环境 ID 在
`miniprogram/config/cloud.ts` 中配置。

## 已接入：`recommendRestaurant`

- 入口：`cloudfunctions/recommendRestaurant/index.js`
- 入参：`{ questionnaire?, context?, limit? }`
- 出参：`ApiResponse<RecommendMealResponse>`
- 数据源：当前使用云函数内置 mock 餐厅数据生成推荐结果，后续可接入高德 POI。
- 部署：在微信开发者工具中右键 `recommendRestaurant`，选择“上传并部署：云端安装依赖”。

## 已接入：`saveRecommendationHistory`

- 入口：`cloudfunctions/saveRecommendationHistory/index.js`
- 入参：`{ record }`
- 出参：`ApiResponse<SaveRecommendationHistoryResponse>`
- 数据表：写入云数据库 `recommendation_history` 集合。
- 行为：保存推荐展示、换一家、采纳等用户行为，同时记录推荐来源、餐厅、菜品、匹配度、问答快照等信息。
- 非阻塞：前端会先写本地 storage，再异步调用云函数；云同步失败不会阻塞推荐展示、换一家或采纳操作。

## 已接入：`syncUserProfile`

- 入口：`cloudfunctions/syncUserProfile/index.js`
- 入参：`{ nickname, avatarUrl }`
- 出参：`ApiResponse<{ user }>`
- 数据表：写入/更新云数据库 `users` 集合。
- 用户标识：云函数通过 `cloud.getWXContext().OPENID` 获取 openid，前端不传 openid。
- 行为：使用 openid 作为文档 ID，保存头像昵称资料，不保存手机号、推荐历史或复杂设置。

`users` 集合结构：

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

## 云数据库集合设计

| 集合 | 说明 | 主要字段 | 索引建议 |
| --- | --- | --- | --- |
| `users` | 用户基础资料 | `_id`, `openid`, `nickname`, `avatarUrl`, `createdAt`, `updatedAt` | `openid`, `updatedAt` |
| `restaurants` | 餐厅基础数据 | `_id`, `id`, `name`, `tags`, `tagIds`, `category`, `address`, `location`, `priceLevel`, `averageCostYuan`, `businessHours`, `openStatus`, `signatureDishes`, `status`, `createdAt`, `updatedAt` | `status`, `tagIds`, `location`, `priceLevel` |
| `tags` | 标签字典 | `_id`, `id`, `label`, `group`, `aliases`, `order`, `enabled`, `createdAt`, `updatedAt` | `group`, `enabled`, `order` |
| `user_preferences` | 用户问答结果和偏好快照 | `_id`, `_openid`, `userId`, `questionnaire`, `selectedOptionIds`, `preferredTagIds`, `avoidedTagIds`, `budgetLevel`, `maxDistanceMeters`, `maxEstimatedMinutes`, `peopleCount`, `createdAt`, `updatedAt` | `_openid`, `userId`, `updatedAt` |
| `recommendation_history` | 推荐展示与选择历史 | `_id`, `_openid`, `id`, `userId`, `recommendationId`, `candidateId`, `restaurantId`, `mealName`, `restaurantName`, `tags`, `dateText`, `note`, `reasonSummary`, `imageUrl`, `action`, `selectedAt`, `createdAt`, `updatedAt`, `source`, `matchPercent`, `switchCount`, `questionnaire` | `_openid`, `userId`, `createdAt`, `action`, `source` |

字段类型以 `miniprogram/types/*.ts` 为准：

- 餐厅和标签：`miniprogram/types/restaurant.ts`
- 用户问答和偏好：`miniprogram/types/userPreference.ts`
- 推荐结果和历史记录：`miniprogram/types/recommendation.ts`

## 前后端接口约定

云函数统一返回 `ApiResponse<T>`：

- 成功：`{ ok: true, data, requestId }`
- 失败：`{ ok: false, error: { code, message, details? }, requestId }`
