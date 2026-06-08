// 网格化高德 POI 抓取：用尽量少的额度抓尽量多的去重餐厅，塞进 .cache 供压测复用。
//
// 核心思想：把目标圆形区域切成 grid×grid 个互不重叠的子矩形，每个子矩形单独做
// place/polygon 搜索（types=050000 覆盖全部餐饮子类）。地理不重叠 → 返回的店重叠少
// → 每次 API 调用净增最大化（比在单点反复翻页高效得多，后者越翻越多重复）。
// 配合串行节流（避免 QPS 限流 infocode 10021）和额度硬熔断（--maxApiCalls），
// 保护宝贵的月额度。抓到的池子写入 .cache/amap-poi/<label>.json，stress 脚本可直接复用。
//
// 用法：
//   预演(不联网、不花额度，先看方案)：
//     node scripts/seedAmapRichPool.js --label guangzhou-yuexiu-rich --lat 23.1291 --lng 113.2644 --radius 3000 --grid 4 --plan
//   正式抓取(需要 key，消耗额度)：
//     AMAP_KEY=*** node scripts/seedAmapRichPool.js --label guangzhou-yuexiu-rich --lat 23.1291 --lng 113.2644 --radius 3000 --grid 4 --maxApiCalls 50

const fs = require('fs');
const https = require('https');
const path = require('path');
const { parseArgs, getPointInput, buildCacheFilePath, requirePointForSeed } = require('./amapStressUtils');
const { convertPoiToRestaurant } = require('./seedAmapCache');

const AMAP_PLACE_POLYGON_URL = 'https://restapi.amap.com/v3/place/polygon';
const DEFAULT_TYPES = '050000'; // 餐饮服务大类：含中餐/外国/快餐/咖啡/茶/冷饮/糕饼/甜品等全部子类
const PAGE_SIZE = 25; // 高德单页上限就是 25，这是无法突破的硬限制
const RETRYABLE_INFOCODES = new Set(['10021', '10019', '10029']); // QPS 限流 / 引擎繁忙，可退避重试

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const point = getPointInput(args);
  requirePointForSeed(point); // 需要 --lat --lng（预演也要坐标来画网格）

  const radius = clampInt(args.radius, 300, 20000, 3000);
  const grid = clampInt(args.grid, 1, 8, 3);
  const pagesPerCell = clampInt(args.pagesPerCell, 1, 4, 2);
  const maxApiCalls = clampInt(args.maxApiCalls, 1, 1000, 60);
  const minIntervalMs = clampInt(args.minIntervalMs, 0, 5000, 350);
  const types = typeof args.types === 'string' && args.types.trim() ? args.types.trim() : DEFAULT_TYPES;
  const planOnly = args.plan === true;

  const cells = buildGrid(point, radius, grid); // grid×grid 个子矩形
  const plannedMaxCalls = Math.min(maxApiCalls, cells.length * pagesPerCell);

  // ---- 预演：只打印规划，不联网、不花额度 ----
  if (planOnly) {
    printPlan({ point, radius, grid, cells, pagesPerCell, maxApiCalls, plannedMaxCalls, types });
    return;
  }

  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY;
  if (!key) {
    throw new Error('AMAP_WEB_SERVICE_KEY or AMAP_KEY is required. 只看方案请加 --plan。');
  }

  const pool = new Map();
  let apiCalls = 0;
  let stopped = null;
  const startedAt = Date.now();
  const throttle = makeThrottle(minIntervalMs);

  outer: for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    for (let page = 1; page <= pagesPerCell; page += 1) {
      if (apiCalls >= maxApiCalls) {
        stopped = 'maxApiCalls';
        break outer;
      }

      await throttle();
      let res;
      try {
        res = await requestPolygon({ key, polygon: cell.polygon, types, page });
      } catch (error) {
        console.warn(`  网络错误 cell#${index} page${page}: ${error.message}`);
        continue;
      }
      apiCalls += 1;

      if (res.status !== '1' || res.infocode !== '10000') {
        if (RETRYABLE_INFOCODES.has(res.infocode)) {
          console.warn(`  限流/繁忙(${res.infocode})，退避 1.2s 重试一次…`);
          await sleep(1200);
          await throttle();
          try {
            res = await requestPolygon({ key, polygon: cell.polygon, types, page });
            apiCalls += 1;
          } catch (error) {
            continue;
          }
        }
        if (res.status !== '1' || res.infocode !== '10000') {
          // 仍失败：可能是 key 无效 / 配额耗尽，立即停止以保护剩余额度
          console.error(`  高德返回错误 infocode=${res.infocode} info=${res.info}`);
          stopped = `amap-error-${res.infocode}`;
          break outer;
        }
      }

      const pois = Array.isArray(res.pois) ? res.pois : [];
      let added = 0;
      for (const poi of pois) {
        const id = poi && (poi.id || `${poi.name || ''}|${poi.location || ''}`);
        if (!id || pool.has(id)) continue;
        const restaurant = convertPoiToRestaurant(poi, { latitude: point.latitude, longitude: point.longitude });
        if (restaurant) {
          pool.set(id, restaurant);
          added += 1;
        }
      }
      console.log(`  cell#${index} page${page}: +${added} 家 (累计 ${pool.size} / API ${apiCalls})`);

      if (pois.length < PAGE_SIZE) break; // 该格已无更多结果，停止翻页省额度
    }
  }

  const restaurants = [...pool.values()].slice(0, 2000);
  const cacheFile = buildCacheFilePath(point);
  const payload = {
    version: 1,
    label: point.label,
    cityName: point.cityName,
    latitude: point.latitude,
    longitude: point.longitude,
    radiusMeters: radius,
    pageSize: PAGE_SIZE,
    pageCount: pagesPerCell,
    keyword: '',
    searchModes: ['polygon-grid'],
    gridSize: grid,
    types,
    createdAt: new Date().toISOString(),
    amapApiCallCount: apiCalls,
    quotaStats: {
      aroundCallCount: 0,
      polygonCallCount: apiCalls,
      keywordCallCount: 0,
      idCallCount: 0,
      totalAmapApiCallCount: apiCalls
    },
    restaurants
  };
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        label: point.label,
        cacheFile,
        restaurants: restaurants.length,
        amapApiCallCount: apiCalls,
        efficiencyPerCall: apiCalls ? Number((restaurants.length / apiCalls).toFixed(1)) : 0,
        stoppedBy: stopped || 'completed',
        elapsedMs: Date.now() - startedAt
      },
      null,
      2
    )
  );
}

// 把以 center 为中心、边长 = 2*radius 的方形区域切成 grid×grid 个子矩形 polygon
function buildGrid(center, radius, grid) {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos(toRad(center.latitude)) || 1);
  const south = center.latitude - latDelta;
  const north = center.latitude + latDelta;
  const west = center.longitude - lngDelta;
  const east = center.longitude + lngDelta;
  const cells = [];
  for (let r = 0; r < grid; r += 1) {
    for (let c = 0; c < grid; c += 1) {
      const s = south + ((north - south) * r) / grid;
      const n = south + ((north - south) * (r + 1)) / grid;
      const w = west + ((east - west) * c) / grid;
      const e = west + ((east - west) * (c + 1)) / grid;
      cells.push({ polygon: `${fmt(w)},${fmt(s)}|${fmt(e)},${fmt(n)}` });
    }
  }
  return cells;
}

function printPlan(p) {
  const km = ((p.radius * 2) / 1000).toFixed(1);
  const lines = [
    '=== 抓取方案预演 (不联网 / 0 额度) ===',
    `中心点      : ${p.point.latitude}, ${p.point.longitude}  (label=${p.point.label || '未命名'})`,
    `覆盖范围    : 半径 ${p.radius}m，约 ${km}km × ${km}km 方形`,
    `网格        : ${p.grid} × ${p.grid} = ${p.cells.length} 格，每格约 ${Math.round((p.radius * 2) / p.grid)}m 边长`,
    `每格翻页    : ${p.pagesPerCell} 页 × 25 条/页`,
    `类型        : ${p.types} (餐饮全品类)`,
    `理论最大调用: ${p.cells.length} 格 × ${p.pagesPerCell} 页 = ${p.cells.length * p.pagesPerCell} 次`,
    `额度熔断    : --maxApiCalls=${p.maxApiCalls}  →  本次最多花 ${p.plannedMaxCalls} 次`,
    `理论店上限  : ${p.plannedMaxCalls} × 25 = ${p.plannedMaxCalls * 25} 家(去重前；实际去重后少一些)`,
    '',
    '确认无误后，去掉 --plan 并提供 key 即可正式抓取：',
    `  AMAP_KEY=*** node scripts/seedAmapRichPool.js --label ${p.point.label || '<label>'} --lat ${p.point.latitude} --lng ${p.point.longitude} --radius ${p.radius} --grid ${p.grid} --maxApiCalls ${p.maxApiCalls}`
  ];
  console.log(lines.join('\n'));
}

function requestPolygon({ key, polygon, types, page }) {
  const params = new URLSearchParams({
    key,
    types,
    polygon,
    offset: String(PAGE_SIZE),
    page: String(page),
    extensions: 'all',
    output: 'json'
  });
  return requestJson(`${AMAP_PLACE_POLYGON_URL}?${params.toString()}`);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function makeThrottle(intervalMs) {
  let lastAt = 0;
  return async function throttle() {
    const wait = intervalMs - (Date.now() - lastAt);
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function fmt(value) {
  return Number(value.toFixed(6)).toString();
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { buildGrid, main };
