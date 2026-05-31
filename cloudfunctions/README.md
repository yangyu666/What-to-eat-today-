# 云函数目录

## 已接入：`recommendRestaurant`

- 入口：`cloudfunctions/recommendRestaurant/index.js`
- 入参：`{ questionnaire?, context?, limit? }`
- 出参：`ApiResponse<RecommendMealResponse>`
- 数据源：暂时使用云函数内置 mock 餐厅数据，不接高德。
- 部署：在微信开发者工具中右键 `recommendRestaurant`，选择“上传并部署：云端安装依赖”。

小程序启动时会在 `miniprogram/app.ts` 初始化云开发；环境 ID 可在
`miniprogram/config/cloud.ts` 中填写。结果页调用 `recommendRestaurant` 后使用后端返回的
`recommendation.candidates` 渲染推荐结果。

这里预留微信云开发云函数代码。后续建议按业务域拆分：

- `recommendMeal`：生成今日推荐
- `savePreference`：保存用户偏好
- `listHistory`：查询历史记录

当前阶段已创建 `recommendRestaurant` 可执行云函数，其余接口仍作为后续规划。

## 云数据库集合设计

| 集合 | 说明 | 主要字段 | 索引建议 |
| --- | --- | --- | --- |
| `restaurants` | 餐厅基础数据 | `_id`, `id`, `name`, `tags`, `tagIds`, `category`, `address`, `location`, `priceLevel`, `averageCostYuan`, `businessHours`, `openStatus`, `signatureDishes`, `status`, `createdAt`, `updatedAt` | `status`, `tagIds`, `location`, `priceLevel` |
| `tags` | 标签字典 | `_id`, `id`, `label`, `group`, `aliases`, `order`, `enabled`, `createdAt`, `updatedAt` | `group`, `enabled`, `order` |
| `user_preferences` | 用户问答结果和偏好快照 | `_id`, `_openid`, `userId`, `questionnaire`, `selectedOptionIds`, `preferredTagIds`, `avoidedTagIds`, `budgetLevel`, `maxDistanceMeters`, `maxEstimatedMinutes`, `peopleCount`, `createdAt`, `updatedAt` | `_openid`, `userId`, `updatedAt` |
| `recommendation_history` | 推荐展示与选择历史 | `_id`, `_openid`, `id`, `userId`, `recommendationId`, `candidateId`, `restaurantId`, `mealName`, `restaurantName`, `tags`, `dateText`, `note`, `action`, `selectedAt`, `createdAt`, `updatedAt` | `_openid`, `userId`, `createdAt`, `action` |

字段类型以 `miniprogram/types/*.ts` 为准：

- 餐厅和标签：`miniprogram/types/restaurant.ts`
- 用户问答和偏好：`miniprogram/types/userPreference.ts`
- 推荐结果和历史记录：`miniprogram/types/recommendation.ts`

## 前后端接口约定

云函数统一返回 `ApiResponse<T>`：

- 成功：`{ ok: true, data, requestId }`
- 失败：`{ ok: false, error: { code, message, details? }, requestId }`

### `recommendRestaurant`

- 入参：`RecommendMealRequest`
- 出参：`ApiResponse<RecommendMealResponse>`
- 说明：前端传入问答快照或偏好快照；当前版本用云函数内置 mock 餐厅数据生成并返回 `RecommendationResult`。

### `savePreference`

- 入参：`SavePreferenceRequest`
- 出参：`ApiResponse<SavePreferenceResponse>`
- 说明：保存原始问答 `questionnaire`，同时保存计算后的偏好快照，写入或更新 `user_preferences`。

### `listHistory`

- 入参：`ListHistoryRequest`
- 出参：`ApiResponse<ListHistoryResponse>`
- 说明：按用户查询 `recommendation_history`，支持 `pageSize`、`cursor` 和 `action` 过滤。
