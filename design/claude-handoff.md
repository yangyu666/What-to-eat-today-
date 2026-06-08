# Claude 接管工作交接文档（给 Codex）

> 分支：`codex/mvp-history-records`
> 范围：Claude Code 在此分支接手，专注解决「推荐加载失败」与「推荐召回质量（尤其高端/特定品类）」问题。
> 边界：**用户的 UI / 历史记录改动（home/question/result 的 wxml/wxss、historyService.js）Claude 全程未碰**，目前仍是工作区里的未提交改动，请勿混提交。

---

## 一、提交清单（均在本分支，按时间顺序）

| commit | 标题 | 关键改动 | 需重新部署云函数？ |
|--------|------|---------|:--:|
| `09a9dac` | 修复高德QPS并发超限导致的推荐加载失败 | 云函数对 QPS 限流(infocode 10021 等)做指数退避重试 | ✅ 是 |
| `793cd74` | 改用串行节流根治高德QPS限流,撤销缓存半径复用 | amapPoiService 全局串行节流队列(~350ms 间隔≈2.8 QPS)；撤销 09a9dac 里不当的缓存半径复用 | ❌ 否(小程序端) |
| `136b8a5` | 扩大缓存池根治不限品牌/高预算时的推荐加载失败 | prefetch 多类目预取；缓存上限 250→1000 | ❌ 否 |
| `0085ca9` | 修正非正餐意图匹配:想喝饮品不再推正餐 | 非正餐意图改「白名单过滤」；烧烤补 `meal` 标签；饮品不按正餐预算罚分 | ✅ 是(改了烧烤标签) |
| `8ec1680` | 加深预取拉取页数+重排类目顺序,根治高端/特定品类召回不足 | 云函数 clamp 上限 pageCount/maxApiCalls 3→8；prefetch broad 8页/高端类目 4页；**类目顺序 broad 置最后**(修短路) | ✅ 是 |

> ⚠️ 最新一次(8ec1680)改了云函数 clamp，**必须在微信开发者工具里重新部署 `amapPoi` 云函数**，小程序端重新编译即可。不部署的话 pageCount 上限还是旧的 3，加深不生效。

---

## 二、根因与关键架构发现（重要，避免重复踩坑）

1. **「推荐加载失败」真正根因 = 高德个人 key 的 QPS(每秒并发)限制**（infocode 10021 `CUQPS_HAS_EXCEEDED_THE_LIMIT`）。
   首页 prefetch 与结果页推荐几乎同时并发打高德 → 瞬时并发超个人 key 上限(约3) → 请求被拒 → 池子空 → 抛错。**串行节流根治**。
   （排查中曾误判为"扼流→纯正餐池"，被真实数据证伪；务必以真实高德数据为准，不要只看代码推断。）

2. **高德 API 硬限制**（实测）：
   - 单次 `place/polygon` 最多返回约 **200 条**(8 页 × 25)，`count` 字段可能虚报(如 600)。
   - `radius` 云端 clamp 上限 **15000**（所以"扩到 20km 无增益"其实是被截断）。
   - `pageSize`(offset) 上限 **25**。→ 想要 N 家就得 ceil(N/25) 次调用，这是配额成本的根。

3. **缓存短路（隐藏坑，8ec1680 已修）**：`amapPoiService.readNearbyRestaurantsCache` 里 `getKeywordCoverage` 规定——**空关键词(broad)缓存条目可经"本地过滤"覆盖任何带词请求**。
   所以 prefetch 里若 broad 先写入缓存，后面所有带词类目组(高端/快餐/…)都会命中 broad 缓存、**不再真正按类目搜索** → 高端等专项店补不进池子。
   ✅ 解决：**prefetch 的类目顺序里 broad 必须放最后**（见 `PREFETCH_KEYWORD_GROUPS` 注释）。改顺序会破坏此修复，务必保留注释。

4. **推荐侧 supplement 被「池子≥30」跳过**：`mealService.ts` 里 reason 含 `supplement` 的 attempt，在 `restaurantPool.size >= MIN_POOL_BEFORE_AROUND_FALLBACK(=30)` 时直接 `continue`。
   broad 缓存一上来就把池子填到 ~200 → 推荐时的「高端专项 attempt」基本永远不跑。
   → 含义：**高端要靠 prefetch 提前备好**，不能指望推荐时再补。这也是为什么必须修好 prefetch 的类目短路(见上)。

5. **keyword(全市文本)搜索从不触发**：`mealService` 要求 keyword 模式必须带 `city/adcode`，但 `amapCity/amapAdcode` 全项目**只读不写**(questionBank 的 option effect、preferenceMapper、定位 reverseGeocode 都不产出 adcode)。
   → keyword attempt 永远满足"无 city/adcode"被 `continue` 跳过。详见 `design/search-mode-study.md`。
   结论：**保持不走 text 是对的**——text 按相关度排序、距离失控(海珠搜高端最远 108km，从化郊区召回全是几十公里外市区店)。

6. **`.ts` / `.js` 手工同步**：提交进 git 的 `.js` 是微信开发者工具 TS 插件生成的 CommonJS 产物(与 tsconfig 的 ESNext 不同)，**靠手工编译保持同步**。改 `.ts` 必须同步改 `.js`(本会话所有改动都已双份同步)。曾发现过 stale（historyService.js 残留已删函数）。

---

## 三、当前推荐数据流（简图）

```
首页 onLoad
  └─ prefetchNearbyRestaurantCandidates()           [amapPoiService]
       5 个类目组串行预取(经节流，不超 QPS)：
         高端(4页) → 快餐(2页) → 菜系(2页) → 饮品(2页) → broad(8页, 放最后!)
       累积去重 → 写入一个 broad 大缓存条目
       缓存：小程序端 session/storage(TTL 45min) + 云函数 amap_poi_cache 集合(TTL 1h, 跨用户共享)
       成本：冷缓存约 18 次高德调用；45min 内再进 = 0 次

结果页 → getLocalRecommendations()                  [mealService]
  └─ getAmapRecommendations()
       broad-primary attempt → 命中 prefetch 大缓存(0 实时请求)
       (supplement/高端 attempt 因 pool≥30 跳过 —— 没关系，池子已富)
       → recommendRestaurants() 打分/硬过滤/置信度    [recommendationEngine]
       → 候选返回
```

---

## 四、实测验证结论（真实高德 API）

- **海珠 100 次问答流程压测**：98/100 正常，**0 次「无推荐结果」**（加载失败彻底解决）。2 个不匹配中 1 个误报、1 个真 bug(茶百道漏标，见遗留)。
- **budget6 正餐·距离不限(海珠)**：修复后 **4 候选 @75-79%**，均为真高端品牌（炳胜公馆 279、一堂私房菜 288、彤堂序 320、汤品·雅宴 252）。修复前仅 2 候选 @64%。
- **高端召回(珠江新城 CBD)**：类目都真搜后约 **51 家高端** vs 仅 broad 约 25 家；番禺市桥仅 3 家(真供给稀缺，非搜索问题)。
- **配额成本**：首次 prefetch 约 18 次调用(冷)，45min 内 0 次。正常 App 使用可控；**开发期反复跑探针会把个人 key 当日额度打爆**(infocode 10044)。

---

## 五、待办 / 已知遗留问题（建议优先级）

1. **[部署] 重新部署 `amapPoi` 云函数**（8ec1680 改了 clamp）——否则加深不生效。
2. **[召回质量] 品牌词库覆盖不全**：茶百道/沪上阿姨/CoCo/书亦烧仙草/柠季/益禾堂等"只能靠品牌名识别"的店漏标 → 想吃正餐时误入、想喝奶茶时召回不到。需补识别库。
3. **[DRY/治本] 标签&品牌关键词库在 4 处重复维护**：`recommendationEngine` + `cloudfunctions/amapPoi` + `cloudfunctions/recommendRestaurant` + `amapQueryBuilder`（fallback 图片逻辑散在 5 处）。加一个品牌要改 4 处、极易漏(茶百道漏标就是直接后果)。**建议提取单一共享词典**——这是投入产出比最高的一刀。
4. **[匹配质量] 想吃甜品偏向咖啡馆**：咖啡和甜品都算非正餐，引擎未细分，咖啡馆密集就占前排。非加载失败，属排序调优。
5. **[配额] prefetch 18 次/冷可按需精简**：只留 broad(8) + 高端(4) = 12 次，或更省。用户对配额敏感，取舍未定。
6. **[架构] `recommendationEngine.ts` 2078 行 god module**；核心函数超长 + 魔数遍地。brooks-health 综合 84/100，架构维度最低(70)。建议按职责拆分 scoring/hard-filter/tagging/fallback/keyword-dict。
7. **[测试] services 层无单元测试**：amapPoiService(缓存/节流/重试)、mealService(attempt链路/扼流)、historyService 关键路径无回归网，本会话全靠手写脚本验证。
8. **[安全] 高德 key 轮换**：两个 key(`fbc78…8896`、`b1e0…a08a`)已在对话中明文暴露，建议去高德控制台重置。

---

## 六、可复跑的脚本 / 工具

| 脚本 | 用途 |
|------|------|
| `npm run seed:amap-rich` (`scripts/seedAmapRichPool.js`) | 网格化抓真实高德 POI 到 `.cache`，省额度抓大池供压测 |
| `npm run seed:amap-cache` (`scripts/seedAmapCache.js`) | 单点 seed 缓存(已导出转换逻辑供 rich 复用) |
| `npm run stress:recommendation` (`scripts/stressRecommendation.js`) | 喂缓存池跑推荐引擎压测 |
| `.tmp/verify-e2e.js` | 真实端到端验证(真 prefetch + 真 mealService)，配 `AMAP_WEB_SERVICE_KEY` 环境变量可跑 |
| `design/search-mode-study.md` | around/polygon/keyword 三种搜索模式实测对比报告 |

> 注：`.tmp/` 已被 `.gitignore` 忽略，里面的临时探针不入库；`.cache/`、`.agents/`、`skills-lock.json` 是本地/环境产物，未提交。

---

## 七、关键文件地图

| 文件 | 职责 |
|------|------|
| `miniprogram/services/amapPoiService.ts/.js` | 高德 POI 拉取 + 双层缓存 + 串行节流 + 首页多类目预取 |
| `miniprogram/services/mealService.ts/.js` | 推荐链路：attempt 构建 + API 预算扼流 + 调引擎 |
| `miniprogram/services/recommendationEngine.ts/.js` | 打分 / 硬过滤 / 置信度 / 标签推断 / 兜底（2078 行核心）|
| `miniprogram/services/amapQueryBuilder.ts/.js` | 由偏好构建高德关键词/预算/忌口剔除 |
| `cloudfunctions/amapPoi/index.js` | 高德云函数：polygon/around/keyword/reverseGeocode + 退避重试 + 云端缓存(clamp 上限在此) |

---

*本文件由 Claude 编写，用于向 Codex 交接。截至 commit `8ec1680`。*
