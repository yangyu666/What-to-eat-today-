---
name: food-recommend-skill
description: 让微信小程序 AI 通过对话调用《今天吃什么》的附近美食推荐、换一家、采纳和历史查询能力。
version: "0.1.0"
tags: ["微信小程序", "AI开发模式", "美食推荐"]
platform: ["wechat-miniprogram"]
---

# food-recommend-skill

本 Skill 是《今天吃什么》的 AI 开发模式独立能力接入层。它只负责让小程序 AI 理解用户意图、抽取结构化偏好并调用原子接口；推荐结果仍由现有 `mealService`、`recommendationEngine`、`amapPoiService`、`historyService` 产生和保存。

此目录不替换首页、问答页、结果页、历史页主链路。当前 MVP 提审阶段不要把它强绑定到正式主包；仅在获得微信 AI 开发模式权限并需要开发版/体验版验证时，再按下面的集成方式注册。

## 用户意图

```text
用户意图
├─ 模糊吃饭意图："今天吃什么""推荐一下" → recommendFood
├─ 明确偏好："不吃辣，30以内，近一点" → recommendFood，参数从用户原话提取
├─ 换一家："换一个""不想吃这个" → changeFood
├─ 采纳："就这个""吃这家" → acceptFood
└─ 历史："上次推荐了什么" → getRecentRecommendations
```

## 原子接口

| 接口 | 作用 | 组件 | 前置条件 |
| --- | --- | --- | --- |
| `recommendFood` | 根据口味、预算、距离、餐型等偏好生成附近推荐 | `food-recommend-card` | 用户有吃饭/饮品/甜品推荐意图，且已同意位置使用说明 |
| `changeFood` | 基于上一张推荐卡片切换下一家 | `food-recommend-card` | 已有上游 `candidateId`，用户明确说换一家 |
| `acceptFood` | 保存采纳历史，action 写 `accepted` | 无 | 已有上游 `candidateId`、`restaurantId`、`name` |
| `getRecentRecommendations` | 读取当前用户最近推荐历史 | `food-history-card` | 用户询问历史推荐 |

## 业务铁律

- 未获得定位同意前，不能调用 `wx.getLocation`，也不能调用 `amapPoi`。
- 未获得定位同意时，`recommendFood` 必须返回需要用户先完成位置授权的错误状态或引导。
- 不能编造 `restaurantId`、`candidateId`。
- 推荐结果必须来自 `recommendFood` 或 `changeFood` 返回。
- `acceptFood` 必须基于上游返回的 `candidateId` 和 `restaurantId`，不得跳过历史记录保存。
- 高德失败、候选不足或放宽条件时必须返回 `fallbackReason` 或错误状态，不得假装是高置信推荐。
- 推荐卡片优先展示，不要把所有店铺信息用纯文本列表展开。
- AI 只负责理解意图和调用接口，不直接决定推荐结果。
- 推荐结果由现有规则引擎产生。
- `changeFood` 连续切换上限遵循现有产品规则：最多 3 次。
- `getRecentRecommendations` 只返回当前用户自己的历史，依赖现有 `historyService/listHistory`。

## 参数抽取

- 用户说"清淡点/少油少辣"：`taste=light`。
- 用户说"不吃辣/别辣"：`avoidTags` 必须包含用户原话中的"辣"，不要自动添加未提到的忌口。
- 用户说"30 块以内/别超过 30"：`budgetLevel=1`。
- 用户说"30 到 60"：`budgetLevel=2`。
- 用户说"别太远/近一点"：优先 `maxDistanceMeters=1000`，"楼下/很近"可用 500。
- 用户说"奶茶/咖啡/喝点东西"：`mealType=drink`。
- 用户说"甜点/蛋糕/下午茶"：`mealType=dessert`。
- 用户未提到的偏好字段使用 `any`、`normal` 或默认值，不要替用户加戏。

## 运行模式

开发测试默认使用 mock/预览模式，避免真实消耗高德额度：

```js
wx.setStorageSync('mp_skills_preview_mode', true)
```

需要验证真实推荐链路时，先确认用户已完成位置使用说明，再显式关闭预览模式：

```js
wx.setStorageSync('mp_skills_preview_mode', false)
```

正式模式会调用现有 `mealService.getLocalRecommendations`，该服务仍然优先走小程序会话/本地 POI 缓存；缓存未命中且用户已同意定位时，才可能触发 `wx.getLocation` 和 `amapPoi`。

## 集成方式

本次交付不直接修改 `app.json`。获得微信 AI 开发模式内测/提审权限后，可在开发版或体验版中临时注册：

```json
{
  "subPackages": [
    {
      "root": "skills",
      "pages": [],
      "independent": true
    }
  ],
  "lazyCodeLoading": "requiredComponents",
  "agent": {
    "skills": [
      {
        "name": "food",
        "description": "今天吃什么：根据自然语言偏好推荐附近美食、换一家、采纳并查询历史",
        "path": "skills/food-recommend-skill"
      }
    ]
  }
}
```

## 验证建议

1. 在微信开发者工具中导入项目，使用已开通 AI 开发模式权限的 AppID。
2. 临时按上方方式注册 `agent.skills` 和独立分包。
3. 默认保持 `mp_skills_preview_mode=true`，输入："我想吃清淡点，别太远，30块以内"。
4. 确认 AI 调用 `recommendFood`，并展示 `food-recommend-card`。
5. 点击卡片"换一个"，确认触发 `changeFood`，最多连续 3 次。
6. 点击卡片"就吃这个"，确认触发 `acceptFood` 并写入历史。
7. 输入："我最近推荐过什么"，确认触发 `getRecentRecommendations` 并展示 `food-history-card`。
8. 关闭预览模式验证真实链路前，先在小程序首页完成位置使用说明；不要在无缓存场景下反复触发真实高德请求。

## 当前限制

- 小程序 AI 开发模式可能仍处于内测或提审限制阶段，正式版能否使用以微信公众平台能力开放状态为准。
- 本 Skill 未强绑定主包；不影响当前 MVP 主链路提审。
- 当前工具链的 `typecheck`/`lint` 只覆盖 `miniprogram/**/*.ts`，Skill 原子接口为 AI 模式要求的 `.js` 文件，需用微信开发者工具的 AI 开发模式做运行验证。
