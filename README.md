# 今天吃什么

微信小程序 MVP。产品目标是帮助用户在 30-60 秒内结束“今天吃什么”的选择困难。

当前定位不是美食内容平台，也不是完整外卖/点评搜索工具，而是一个基于位置、问答偏好、规则推荐和历史反馈的饮食决策工具。

最后整理时间：2026-06-11。

## 当前阶段

项目处于上线前收口阶段。

已经具备：

- 首页、问答页、推荐结果页、历史页、我的页的基础页面。
- 问答式偏好收集，不再以首页一句话输入作为主链路。
- 题库/选项映射到结构化偏好标签。
- 基于高德 POI 的真实附近餐厅候选池。
- 前端规则推荐引擎。
- 推荐解释、匹配度、候选池统计、fallback 记录。
- 历史推荐保存与读取。
- 用户头像昵称轻账号同步。
- 高德 POI 云函数缓存。
- 本地 seed + cache-first 压测流程。
- 高德多 key 配置与切换的初步实现。

暂未作为 MVP 主线：

- AI 一句话输入。
- 自有餐厅库。
- 后台管理系统。
- 长期用户画像。
- 商家入驻、广告、CPS。
- 多人/情侣/家庭共同决策。

## 技术栈

- 产品形态：微信小程序
- 前端：微信小程序原生 + TypeScript + WXML + WXSS
- 后端：微信云开发 / CloudBase 云函数
- 数据库：微信云开发文档数据库
- 位置与餐厅数据：高德 WebService POI
- 推荐：前端规则引擎为主，云端 `recommendRestaurant` 保留
- AI：暂不接入主链路

## 项目结构

```text
.
├── cloudfunctions/              # 微信云开发云函数
│   ├── amapPoi/                 # 高德 POI 获取、缓存、多 key 切换
│   ├── listHistory/             # 读取当前用户推荐历史
│   ├── recommendRestaurant/     # 云端规则推荐能力，当前保留
│   ├── saveRecommendationHistory/ # 保存 shown/skipped/accepted 等行为
│   ├── setupDatabase/           # 创建 MVP 必需集合
│   └── syncUserProfile/         # 同步头像昵称
├── design/                      # PRD、原型图、交接文档、研究记录
├── miniprogram/                 # 小程序源码
│   ├── pages/
│   │   ├── home/                # 首页
│   │   ├── question/            # 问答流程
│   │   ├── result/              # 推荐结果
│   │   ├── history/             # 历史记录
│   │   ├── mine/                # 我的
│   │   └── preferences/         # 偏好页，早期保留页
│   ├── services/
│   │   ├── amapPoiService.ts    # 小程序端 POI 获取与缓存编排
│   │   ├── amapQueryBuilder.ts  # 高德查询构造
│   │   ├── historyService.ts    # 历史记录本地/云端读写
│   │   ├── mealService.ts       # 推荐主流程编排
│   │   ├── preferenceMapper.ts  # 问答选项到偏好标签
│   │   ├── questionSelector.ts  # 题库与选题
│   │   └── recommendationEngine.ts # 推荐评分、过滤、解释
│   └── ...
├── scripts/                     # 本地测试、seed、压测脚本
├── package.json
├── project.config.json
└── tsconfig.json
```

## 设计资料

关键设计资料在 `design/`：

- `design/DESIGN_HANDOFF.md`：设计交接说明。
- `design/prototype-v1.3.png`：v1.3 原型图。
- `design/claude-handoff.md`：Claude 接手后的工作交接。
- `design/search-mode-study.md`：高德搜索模式与召回研究。
- `design/question-flow-component-spec.md`：问答页组件视觉参考。
- `design/result-page-component-reference.png`：结果页组件参考图。

后续新窗口可先读：

```text
请先阅读 README.md、design/DESIGN_HANDOFF.md 和 design/claude-handoff.md。
当前目标是基于现有 MVP 状态完成指定模块，保持原型视觉风格，优先使用 mock/cache 数据，避免无意义消耗高德额度。
```

## 核心用户流程

```text
首页
↓
点击“帮我决定”
↓
进入问答流程
↓
根据题目选项生成偏好标签
↓
优先读取小程序会话缓存/本地缓存中的附近餐厅
↓
必要时调用 amapPoi 云函数拉取高德 POI
↓
推荐引擎过滤、评分、排序
↓
结果页展示 Top1、匹配度、推荐理由
↓
用户选择“就吃这家”或“换一家”
↓
写入 recommendation_history
```

## 推荐算法现状

推荐算法主入口：

- `miniprogram/services/recommendationEngine.ts`
- 同步编译版本：`miniprogram/services/recommendationEngine.js`

当前能力：

- 正向偏好标签评分。
- 负向偏好硬过滤，例如不吃辣、避开油腻、避开非正餐。
- 预算、距离、耗时、冷热、轻重口、正餐/饮品/甜品等场景处理。
- 历史推荐过滤。
- fallback 降级推荐。
- 匹配度百分比与推荐理由。
- 候选池统计，方便后续 A/B 测试和调权。

近期重点改动：

- 高预算 fallback 不应推荐明显低价候选。
- 高预算候选不足时，可以允许“价格未知”的候选进入低信心 fallback。
- fallback 结果需要降低 confidence/matchPercent，不能看起来像高置信推荐。

仍需注意：

- `recommendationEngine.ts` 体积较大，后续适合拆分标签、过滤、评分、解释模块。
- 餐厅标签、品牌、品类字典在多个位置有重复，后续应统一。
- 真实高德 POI 的人均、营业状态、菜品信息不稳定，算法只能在已有字段上判断。

## 高德 POI 与额度策略

云函数主入口：

- `cloudfunctions/amapPoi/index.js`

关键策略：

- `wx.getLocation` 只获取设备经纬度，不消耗高德搜索额度。
- 消耗高德额度的是 WebService 请求，例如 place search、reverse geocode。
- 用户进入后可以预取附近 POI，后续问答和换一家优先复用缓存，减少等待和额度消耗。
- 云函数会把规范化后的候选池写入 `amap_poi_cache`，TTL 约 1 小时。
- 小程序端也有会话/本地缓存，缓存 key 为 `nearby_restaurants_amap_cache`。
- 压测默认只读 `.cache/amap-poi/*.json`，不打真实高德。

高德 key 配置：

- 单 key：`AMAP_WEB_SERVICE_KEY` 或 `AMAP_KEY`
- 多 key：`AMAP_WEB_SERVICE_KEYS` 或 `AMAP_KEYS`
- 多 key 使用英文逗号分隔，例如 `key1,key2,key3`
- 优先级：`AMAP_WEB_SERVICE_KEYS` > `AMAP_KEYS` > `AMAP_WEB_SERVICE_KEY` > `AMAP_KEY`

多 key 切换当前设计：

- QPS/并发错误：短冷却后切换 key。
- 日额度耗尽：本次请求内跳过该 key。
- 响应 meta 返回 `amapKeyIndex`、`amapKeyCount`、`amapKeySwitchCount`、`quotaErrorCount`。
- 绝不能把真实 key 写入代码、README、提交记录、截图或日志。

近期压测结果：

```text
npm.cmd run stress:recommendation -- --label guangzhou-yuexiu --runs 2000

runs: 2000
amapApiCallCount: 0
totalAmapApiCallCount: 0
cacheHitRate: 1
recommendationSuccessCount: 2000
noResultCount: 0
averageElapsedMs: 20.45
```

## 数据库集合

MVP 必建集合：

- `users`
- `recommendation_history`
- `amap_poi_cache`

`amap_poi_cache` 是额度优化缓存，不是业务餐厅库。可以清理，清理后在允许调用高德时重新拉取。

### users

用途：保存“我的”页头像昵称。

建议结构：

```js
{
  _id: openid,
  openid,
  nickname,
  avatarUrl,
  createdAt,
  updatedAt
}
```

### recommendation_history

用途：保存推荐展示、换一家、采纳等行为，用于历史页、历史过滤和后续 A/B 分析。

核心字段：

```js
{
  _openid,
  id,
  candidateId,
  restaurantId,
  restaurantName,
  mealName,
  action, // shown | skipped | accepted | dismissed
  source, // amap | cloud | mock | rule | manual
  matchPercent,
  questionnaire,
  algorithmVersion,
  weightProfileId,
  experimentId,
  fallbackReason,
  candidatePoolStats,
  historyFilterEnabled,
  excludedHistoryRestaurantIds,
  historyPenaltyReasons,
  createdAt,
  updatedAt
}
```

### amap_poi_cache

用途：缓存高德 POI 候选池，降低额度消耗。

建议：

- 只存规范化后的餐厅候选，不存高德原始响应。
- TTL 约 1 小时。
- 单条缓存最多约 250 个餐厅。
- 由云函数读写，前端不直接管理。

暂不建：

- `restaurants`：当前餐厅来自高德 POI，不维护自有餐厅库。
- `tags`：当前标签规则在代码中维护。
- `user_preferences`：当前偏好存在本地状态和历史快照里。

## 云函数

详细说明见 `cloudfunctions/README.md`。

当前云函数：

- `setupDatabase`：创建 `users`、`recommendation_history`、`amap_poi_cache`。
- `amapPoi`：获取高德 POI、云端缓存、多 key 切换、reverse geocode。
- `saveRecommendationHistory`：保存推荐行为。
- `listHistory`：按当前 OPENID 读取用户自己的历史。
- `syncUserProfile`：同步头像昵称。
- `recommendRestaurant`：云端规则推荐能力，当前保留。

上线前需要部署：

```text
setupDatabase
amapPoi
saveRecommendationHistory
listHistory
syncUserProfile
recommendRestaurant
```

## 本地开发

安装依赖：

```bash
npm install
```

微信开发者工具导入当前目录。

配置位置：

- `project.private.config.json`：本地 AppID 等个人配置。
- `miniprogram/config/cloud.ts`：云开发环境 ID。
- 云函数环境变量：高德 key 只放云函数环境变量。

## 常用命令

类型检查：

```bash
npm.cmd run typecheck
```

Lint：

```bash
npm.cmd run lint
```

推荐算法测试：

```bash
npm.cmd run test:recommendation
```

偏好流程测试：

```bash
npm.cmd run test:preference
```

缓存压测：

```bash
npm.cmd run stress:recommendation -- --label guangzhou-yuexiu --runs 2000
```

云函数语法检查：

```bash
node --check cloudfunctions/amapPoi/index.js
node --check cloudfunctions/recommendRestaurant/index.js
```

seed 本地 POI 缓存：

```bash
npm.cmd run seed:amap-cache -- --label test-point --lat 39.909 --lng 116.455 --radius 15000
npm.cmd run seed:amap-rich -- --label test-point --lat 39.909 --lng 116.455 --radius 15000
```

注意：seed 会调用真实高德 API，压测默认不会。


