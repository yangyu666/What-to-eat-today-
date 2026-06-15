# Recommendation Quality SQL Analysis

Generated at: 2026-06-14T10:56:39.158Z

## 1. Stress Run Overview

| run_id | total_runs | api_calls | cache_hit_rate | issue_rate | weak_rate | avg_top_match |
| --- | --- | --- | --- | --- | --- | --- |
| latest-500-after-optimization-result | 500 | 269 | 94.79 | 3.2 | 13.2 | 71.14 |
| latest-500-beijing-result | 500 | 254 | 95.06 | 3.4 | 18.8 | 70.53 |
| latest-500-final-result | 500 | 267 | 94.83 | 3.4 | 16.0 | 70.96 |
| latest-500-result | 500 | 263 | 94.6 | 7.6 | 15.6 | 70.66 |
| latest-500-shanghai-result | 500 | 262 | 94.92 | 3.8 | 15.2 | 71.15 |
| latest-500-shenzhen-result | 500 | 270 | 94.56 | 8.6 | 13.2 | 72.39 |
| strict-latest | 100 | 78 | 82.97 | 8.0 | 32.0 | 66.94 |
| strict-latest-2 | 100 | 78 | 82.97 | 6.0 | 32.0 | 67.16 |

## 2. Top Issue Types

| issue_type | total_count |
| --- | --- |
| drink_intent_top_not_drink | 124 |
| milk_tea_top_not_milk_tea | 93 |
| dessert_intent_top_not_dessert | 78 |
| coffee_top_not_coffee | 12 |
| near_distance_too_far | 4 |
| non_meal_intent_top_meal | 2 |
| no_candidate | 2 |

## 3. Issue Examples by Candidate Pool

| issue_type | examples | avg_pool_size | avg_top_match |
| --- | --- | --- | --- |
| drink_intent_top_not_drink | 93 | 201.2 | 65.8 |
| milk_tea_top_not_milk_tea | 72 | 187.1 | 65.0 |
| dessert_intent_top_not_dessert | 59 | 180.9 | 66.3 |
| coffee_top_not_coffee | 10 | 161.8 | 57.2 |
| non_meal_intent_top_meal | 2 | 61.0 | 45.0 |
| no_candidate | 2 | 34.5 |  |
| near_distance_too_far | 2 | 173.0 | 57.0 |

## 4. POI Cache Data Quality

| label | restaurant_count | avg_cost | cost_missing_pct | tag_coverage_pct | amap_api_call_count |
| --- | --- | --- | --- | --- | --- |
| guangzhou-yuexiu-rich | 1173 | 42.8 | 8.7 | 100.0 | 49 |
| guangzhou-tianhe-v3-rich-slow | 746 | 56.3 | 12.7 | 100.0 | 30 |
| guangzhou-tianhe-v3-rich | 175 | 40.0 | 13.1 | 100.0 | 8 |
| v3-guangzhou-yuexiu | 92 | 35.3 | 4.3 | 100.0 | 4 |
| guangzhou-conghua | 75 | 23.9 | 26.7 | 100.0 | 3 |
| guangzhou-haizhu | 75 | 42.7 | 0.0 | 100.0 | 3 |
| guangzhou-huadu | 75 | 30.5 | 12.0 | 100.0 | 3 |
| guangzhou-huangpu | 75 | 30.6 | 22.7 | 100.0 | 3 |
| guangzhou-liwan | 75 | 45.6 | 2.7 | 100.0 | 3 |
| guangzhou-nansha | 75 | 34.2 | 12.0 | 100.0 | 3 |
| guangzhou-panyu | 75 | 36.3 | 8.0 | 100.0 | 3 |
| guangzhou-tianhe | 75 | 44.0 | 1.3 | 100.0 | 3 |

## 5. SQL Findings

- Highest-frequency issue type in available stress logs: `drink_intent_top_not_drink` (124 records).
- Largest local POI cache pool: `guangzhou-yuexiu-rich` with 1173 restaurants and 8.7% missing cost data.
- Representative 500-run stress sample: `latest-500-beijing-result`, cache hit rate 95.06%, issue rate 3.4%, weak rate 18.8%, avg top match 70.53.

## Resume Bullet

- 将推荐压测日志与高德 POI 缓存结构化入库，使用 SQL 分析 issueRate、weakRate、缓存命中率、候选池规模和价格缺失率，定位饮品/甜品意图偏离、候选召回不足等问题，并推动非正餐标签、关键词召回和兜底策略迭代。

