# 高德搜索模式研究报告：around / polygon / keyword(text)

> 研究问题：推荐算法链路为什么不经过"关键词(全市文本)搜索"？这样是好是坏？三种搜索模式哪个效果最好？
> 方法：源码链路分析 + 真实高德 API 实测（广州海珠市区 + 从化郊区两点）。

---

## 一、链路分析：为什么从不走 keyword(text) 搜索

### 结论
`mealService` 的推荐链路里，纯关键词全市搜索（`mode: 'keyword'`，对应高德 `place/text`）的 attempt **永远被跳过**，从不真正执行。

### 根因（数据链未打通）
1. `mealService.ts:78` 扼流：`if (attempt.mode === 'keyword' && !attempt.city && !attempt.adcode) continue;`
   —— keyword 模式缺 `city` 且缺 `adcode` 就跳过（高德 `place/text` 不带城市限定会变成全国搜，必须限定）。
2. city/adcode 的来源（`getScopedKeywordSearchLocation`, mealService.ts:266-267）：
   `softPreferences.amapCity` / `constraints.city` / `constraints.adcode`。
3. 但这些字段**没有任何写入来源**：
   - `questionBank` 的所有 option `effect` 只设置 `maxDistanceMeters / maxEstimatedMinutes / budgetLevel / diningMode`，**没有一个 option 设 city/adcode/amapCity**。
   - `preferenceMapper` 默认 `softPreferences: {}`、`constraints: { diningMode }`，不产出 city/adcode。
   - 定位流程只取经纬度；`reverseGeocode` 云函数虽能返回 province/city/district，但**没有接回 preference**，且**不返回 adcode**。

→ `city`/`adcode` 恒为 undefined → keyword attempt 恒满足 `!city && !adcode` → 恒被跳过。

> 这是"无意中"形成的：keyword 搜索代码写好了（`buildAmapQueryAttempts` 会生成 keyword attempt），但供给它的城市数据链从未接通。**不过，结论是：这个"意外"恰好是对的**（见下）。

---

## 二、实测对比（真实高德，广州两点）

每格：召回数 / 各距离档命中数 / 最远距离 / 饮品甜品数 / 高端数(人均≥200或黑珍珠米其林等) / 关键词相关数。

### 海珠（市区，23.084,113.317）
| 模式 | 召回 | ≤2k | ≤5k | ≤10k | >10k | 最远 | 饮品甜品 | 高端 | 相关 |
|------|----|----|----|----|----|------|------|----|----|
| around 空词 r10k | 75 | 75 | 75 | 75 | 0 | 0.6km | 7 | 0 | 75 |
| polygon 空词 r10k | 75 | 75 | 75 | 75 | 0 | 0.8km | 9 | 0 | 75 |
| **polygon+饮品词 r10k** | 50 | 50 | 50 | 50 | 0 | 1.0km | **41** | 0 | 45 |
| text+饮品词(全市) | 50 | 0 | 9 | 43 | 7 | **57.1km** | 50 | 0 | 50 |
| **polygon+高端词 r15k** | 50 | 26 | 49 | 50 | 0 | 7.9km | 0 | **17** | 18 |
| text+高端词(全市) | 50 | 0 | 5 | 16 | **34** | **108.3km** | 0 | 22 | 25 |

### 从化（郊区，23.548,113.587）
| 模式 | 召回 | ≤2k | ≤5k | ≤10k | >10k | 最远 | 饮品甜品 | 高端 | 相关 |
|------|----|----|----|----|----|------|------|----|----|
| around 空词 r10k | 75 | 75 | 75 | 75 | 0 | 0.2km | 6 | 0 | 75 |
| polygon 空词 r10k | 75 | 75 | 75 | 75 | 0 | 0.5km | 11 | 0 | 75 |
| **polygon+饮品词 r10k** | 50 | 50 | 50 | 50 | 0 | 0.9km | **39** | 0 | 38 |
| text+饮品词(全市) | 49 | 0 | 0 | **0** | **49** | 87.6km | 49 | 0 | 49 |
| **polygon+高端词 r15k** | 50 | 23 | 46 | 50 | 0 | 7.4km | 0 | **18** | 20 |
| text+高端词(全市) | 50 | 1 | 2 | 3 | **47** | 85.2km | 0 | 22 | 25 |

---

## 三、关键发现

1. **around ≈ polygon（空词）**：两者都召回 75 家、全部就在身边（最远 <1km，城区/镇区餐饮密集，前 75 家都很近）。polygon 略多品类（饮品 9 vs 7）。本质都是"地理范围搜"，差异极小；polygon 的矩形面积约为同半径圆的 1.27 倍、且可定制形状，理论覆盖略广。

2. **polygon+keyword = 最佳平衡**：既保证近（全部 ≤10km，多数 ≤1km），又能按品类/品牌精准召回——饮品词召回 39-41 家饮品店、高端词召回 17-18 家近距离高端店。相关性高。

3. **text(全市关键词) = 品类准但距离彻底失控**：
   - 市区：text 找高端，34/50 家 >10km，最远 **108km**；找饮品最远 57km。
   - 郊区：text 几乎**全部召回市区的店**——从化用 text 找饮品 **0 家 ≤10km、49 家全 >10km**。
   - 原因：`place/text` 按"相关度"排序、**不按距离**，citylimit 只限到"广州市"（面积 7434 km²），对"附近吃什么"毫无意义。

4. **高端场景的取舍**：text 比 polygon 多召回几家高端（22 vs 18），但多出来的几乎全在 10km 外。**polygon+高端词已能召回 17-18 家近的高端店**，足够；text 多出的远店反而是噪声。

---

## 四、结论

### 「不走 keyword(text)」是正确的设计
虽然是数据链未接通导致的"意外结果"，但方向正确：**`place/text` 全市搜索不适合"附近吃什么"的 LBS 场景**，距离不可控（最远 50-100km+），郊区尤其灾难（全是市区的店）。跳过它避免了把用户引导到几十公里外。

### 三种模式效果排名（针对本场景）
| 排名 | 模式 | 适用 |
|------|------|------|
| 🥇 | **polygon + keyword** | 最佳：近 + 品类/品牌精准召回。当前链路的 primary/supplement 正在用 |
| 🥈 | around / polygon（空词） | 好：近 + 全品类广撒网保底（但特定品类占比低，空词仅 7-11 家饮品） |
| 🥉 | keyword(text) 全市 | 本场景最差：品类准但距离失控，不应作为附近推荐来源 |

> around 与 polygon 实测近乎等价，polygon 略优（可定制 + 略多品类 + 覆盖略广）。当前 around 仅作 last-resort 兜底，实际价值有限（polygon 空词已覆盖），保留无害。

---

## 五、建议

1. **保持不走 text 全市搜索**（结论正确，无需修复那条"断链"）。
2. **主力继续用 polygon+keyword**：附近推荐的最优解，已在 prefetch 多类目预取与推荐 attempt 中使用。
3. **特定品类/品牌召回靠 polygon+keyword 扩词**（而非 text）：要覆盖更多品牌就扩充关键词库（如前述茶百道、沪上阿姨等），在多边形内精准召回。
4. **可选增强（产品决策）**：若未来要支持"愿意跑远去找某家特定品牌/高端店"，可接入 city（`reverseGeocode` 已能拿到 city，写入 `preference.softPreferences.amapCity` 即可激活 keyword attempt）——但**必须对 text 结果按距离重排/截断**，否则会推几十公里外。非必需。
5. around 可考虑退役或仅保留为 polygon 异常时的兜底（二者重复，polygon 已够）。

---

*实测脚本：`.tmp/probe-modes.js`（三模式对比）、`.tmp/stress-haizhu.js`（100 次问答压测）。配置环境变量 `AMAP_WEB_SERVICE_KEY` 后 `node` 运行可复现。*
