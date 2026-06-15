const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STRESS_DIR = path.join(ROOT, '.tmp', 'amap-stress');
const CACHE_DIR = path.join(ROOT, '.cache', 'amap-poi');
const OUT_DIR = path.join(ROOT, 'analysis');
const DB_PATH = path.join(OUT_DIR, 'recommendation_quality.sqlite');
const SQL_PATH = path.join(OUT_DIR, 'recommendation_quality_import.sql');
const MYSQL_SQL_PATH = path.join(OUT_DIR, 'recommendation_quality_mysql.sql');
const REPORT_PATH = path.join(OUT_DIR, 'recommendation_quality_report.md');

function main() {
  ensureDir(OUT_DIR);
  const stressFiles = listJsonFiles(STRESS_DIR);
  const cacheFiles = listJsonFiles(CACHE_DIR);

  if (stressFiles.length === 0) {
    throw new Error(`No stress result json found under ${STRESS_DIR}`);
  }

  if (cacheFiles.length === 0) {
    throw new Error(`No POI cache json found under ${CACHE_DIR}`);
  }

  const rows = buildAnalysisRows(stressFiles, cacheFiles);
  const sql = buildSqliteImportSql(rows);
  const mysqlSql = buildMysqlImportSql(rows);
  fs.writeFileSync(SQL_PATH, sql, 'utf8');
  fs.writeFileSync(MYSQL_SQL_PATH, mysqlSql, 'utf8');

  if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH);
  }

  execFileSync('sqlite3', [DB_PATH], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const report = buildReport();
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        stressFiles: stressFiles.length,
        cacheFiles: cacheFiles.length,
        dbPath: path.relative(ROOT, DB_PATH),
        sqlPath: path.relative(ROOT, SQL_PATH),
        mysqlSqlPath: path.relative(ROOT, MYSQL_SQL_PATH),
        reportPath: path.relative(ROOT, REPORT_PATH)
      },
      null,
      2
    )
  );
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file))
    .sort();
}

function buildAnalysisRows(stressFiles, cacheFiles) {
  const rows = {
    stressRuns: [],
    issueCounts: [],
    issueExamples: [],
    poiCacheSummary: []
  };

  for (const file of stressFiles) {
    const json = readJson(file);

    if (!json.meta || !json.summary) {
      continue;
    }

    const runId = path.basename(file, '.json');
    const meta = json.meta;
    const summary = json.summary;

    rows.stressRuns.push({
      runId,
      fileName: path.basename(file),
      totalRuns: meta.totalRuns,
      locationLabel: meta.location && meta.location.label,
      apiCalls: meta.apiCalls,
      cacheHits: meta.cacheHits,
      cacheMisses: meta.cacheMisses,
      cacheHitRate: meta.cacheHitRate,
      failures: summary.failures,
      failureRate: summary.failureRate,
      issueRuns: summary.issueRuns,
      issueRate: summary.issueRate,
      weakRuns: summary.weakRuns,
      weakRate: summary.weakRate,
      avgTopMatch: summary.avgTopMatch,
      p10TopMatch: summary.p10TopMatch,
      p50TopMatch: summary.p50TopMatch,
      p90TopMatch: summary.p90TopMatch
    });

    Object.entries(summary.issueCounts || {}).forEach(([issueType, count]) => {
      rows.issueCounts.push({ runId, issueType, issueCount: count });
    });

    (json.issueExamples || []).forEach((example) => {
      const issues = Array.isArray(example.issues) ? example.issues : ['unknown'];
      issues.forEach((issueType) => {
        rows.issueExamples.push({
          runId,
          exampleIndex: example.index,
          issueType,
          optionIds: (example.optionIds || []).join('|'),
          poolSize: example.poolSize,
          candidateCount: example.candidateCount,
          topName: example.top && example.top.name,
          topCost: example.top && example.top.cost,
          topDistance: example.top && example.top.distance,
          topMatchPercent: example.top && example.top.matchPercent,
          query: example.query
        });
      });
    });
  }

  for (const file of cacheFiles) {
    const json = readJson(file);
    const restaurants = Array.isArray(json.restaurants) ? json.restaurants : [];

    if (restaurants.length === 0) {
      continue;
    }

    const costs = restaurants
      .map((item) => Number(item.averageCostYuan))
      .filter((value) => Number.isFinite(value) && value > 0);
    const distances = restaurants
      .map((item) => Number(item.distanceMeters))
      .filter((value) => Number.isFinite(value));
    const ratings = restaurants
      .map((item) => Number(item.rating))
      .filter((value) => Number.isFinite(value) && value > 0);
    const tagCovered = restaurants.filter((item) => {
      return Array.isArray(item.tagIds) && item.tagIds.length > 0;
    }).length;

    rows.poiCacheSummary.push({
      label: json.label || path.basename(file, '.json'),
      fileName: path.basename(file),
      restaurantCount: restaurants.length,
      avgCost: avg(costs),
      costMissingRate: 1 - costs.length / restaurants.length,
      avgDistance: avg(distances),
      avgRating: avg(ratings),
      tagCoverageRate: tagCovered / restaurants.length,
      amapApiCallCount: json.amapApiCallCount,
      createdAt: json.createdAt
    });
  }

  return rows;
}

function buildSqliteImportSql(rows) {
  const statements = [
    'PRAGMA journal_mode = OFF;',
    'PRAGMA synchronous = OFF;',
    'DROP TABLE IF EXISTS stress_runs;',
    'DROP TABLE IF EXISTS issue_counts;',
    'DROP TABLE IF EXISTS issue_examples;',
    'DROP TABLE IF EXISTS poi_cache_summary;',
    `CREATE TABLE stress_runs (
      run_id TEXT PRIMARY KEY,
      file_name TEXT,
      total_runs INTEGER,
      location_label TEXT,
      api_calls INTEGER,
      cache_hits INTEGER,
      cache_misses INTEGER,
      cache_hit_rate REAL,
      failures INTEGER,
      failure_rate REAL,
      issue_runs INTEGER,
      issue_rate REAL,
      weak_runs INTEGER,
      weak_rate REAL,
      avg_top_match REAL,
      p10_top_match REAL,
      p50_top_match REAL,
      p90_top_match REAL
    );`,
    `CREATE TABLE issue_counts (
      run_id TEXT,
      issue_type TEXT,
      issue_count INTEGER
    );`,
    `CREATE TABLE issue_examples (
      run_id TEXT,
      example_index INTEGER,
      issue_type TEXT,
      option_ids TEXT,
      pool_size INTEGER,
      candidate_count INTEGER,
      top_name TEXT,
      top_cost REAL,
      top_distance REAL,
      top_match_percent REAL,
      query TEXT
    );`,
    `CREATE TABLE poi_cache_summary (
      label TEXT,
      file_name TEXT,
      restaurant_count INTEGER,
      avg_cost REAL,
      cost_missing_rate REAL,
      avg_distance REAL,
      avg_rating REAL,
      tag_coverage_rate REAL,
      amap_api_call_count INTEGER,
      created_at TEXT
    );`,
    'BEGIN TRANSACTION;'
  ];

  for (const row of rows.stressRuns) {
    statements.push(
      `INSERT INTO stress_runs VALUES (${[
        q(row.runId),
        q(row.fileName),
        n(row.totalRuns),
        q(row.locationLabel),
        n(row.apiCalls),
        n(row.cacheHits),
        n(row.cacheMisses),
        r(row.cacheHitRate),
        n(row.failures),
        r(row.failureRate),
        n(row.issueRuns),
        r(row.issueRate),
        n(row.weakRuns),
        r(row.weakRate),
        r(row.avgTopMatch),
        r(row.p10TopMatch),
        r(row.p50TopMatch),
        r(row.p90TopMatch)
      ].join(', ')});`
    );
  }

  for (const row of rows.issueCounts) {
    statements.push(
      `INSERT INTO issue_counts VALUES (${q(row.runId)}, ${q(row.issueType)}, ${n(row.issueCount)});`
    );
  }

  for (const row of rows.issueExamples) {
    statements.push(
      `INSERT INTO issue_examples VALUES (${[
        q(row.runId),
        n(row.exampleIndex),
        q(row.issueType),
        q(row.optionIds),
        n(row.poolSize),
        n(row.candidateCount),
        q(row.topName),
        r(row.topCost),
        r(row.topDistance),
        r(row.topMatchPercent),
        q(row.query)
      ].join(', ')});`
    );
  }

  for (const row of rows.poiCacheSummary) {
    statements.push(
      `INSERT INTO poi_cache_summary VALUES (${[
        q(row.label),
        q(row.fileName),
        n(row.restaurantCount),
        r(row.avgCost),
        r(row.costMissingRate),
        r(row.avgDistance),
        r(row.avgRating),
        r(row.tagCoverageRate),
        n(row.amapApiCallCount),
        q(row.createdAt)
      ].join(', ')});`
    );
  }

  statements.push('COMMIT;');
  return `${statements.join('\n')}\n`;
}

function buildMysqlImportSql(rows) {
  const statements = [
    'CREATE DATABASE IF NOT EXISTS what_to_eat_analysis DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
    'USE what_to_eat_analysis;',
    'DROP TABLE IF EXISTS issue_examples;',
    'DROP TABLE IF EXISTS issue_counts;',
    'DROP TABLE IF EXISTS poi_cache_summary;',
    'DROP TABLE IF EXISTS stress_runs;',
    `CREATE TABLE stress_runs (
      run_id VARCHAR(128) PRIMARY KEY,
      file_name VARCHAR(255),
      total_runs INT,
      location_label VARCHAR(255),
      api_calls INT,
      cache_hits INT,
      cache_misses INT,
      cache_hit_rate DECIMAL(8, 4),
      failures INT,
      failure_rate DECIMAL(8, 4),
      issue_runs INT,
      issue_rate DECIMAL(8, 4),
      weak_runs INT,
      weak_rate DECIMAL(8, 4),
      avg_top_match DECIMAL(8, 4),
      p10_top_match DECIMAL(8, 4),
      p50_top_match DECIMAL(8, 4),
      p90_top_match DECIMAL(8, 4)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE issue_counts (
      run_id VARCHAR(128),
      issue_type VARCHAR(128),
      issue_count INT,
      INDEX idx_issue_type (issue_type),
      INDEX idx_run_id (run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE issue_examples (
      run_id VARCHAR(128),
      example_index INT,
      issue_type VARCHAR(128),
      option_ids TEXT,
      pool_size INT,
      candidate_count INT,
      top_name VARCHAR(255),
      top_cost DECIMAL(10, 2),
      top_distance DECIMAL(10, 2),
      top_match_percent DECIMAL(8, 4),
      query TEXT,
      INDEX idx_issue_examples_type (issue_type),
      INDEX idx_issue_examples_run_id (run_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    `CREATE TABLE poi_cache_summary (
      label VARCHAR(255),
      file_name VARCHAR(255),
      restaurant_count INT,
      avg_cost DECIMAL(10, 4),
      cost_missing_rate DECIMAL(8, 4),
      avg_distance DECIMAL(10, 4),
      avg_rating DECIMAL(8, 4),
      tag_coverage_rate DECIMAL(8, 4),
      amap_api_call_count INT,
      created_at VARCHAR(64),
      INDEX idx_poi_label (label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    'START TRANSACTION;'
  ];

  rows.stressRuns.forEach((row) => {
    statements.push(
      `INSERT INTO stress_runs VALUES (${[
        q(row.runId),
        q(row.fileName),
        n(row.totalRuns),
        q(row.locationLabel),
        n(row.apiCalls),
        n(row.cacheHits),
        n(row.cacheMisses),
        r(row.cacheHitRate),
        n(row.failures),
        r(row.failureRate),
        n(row.issueRuns),
        r(row.issueRate),
        n(row.weakRuns),
        r(row.weakRate),
        r(row.avgTopMatch),
        r(row.p10TopMatch),
        r(row.p50TopMatch),
        r(row.p90TopMatch)
      ].join(', ')});`
    );
  });

  rows.issueCounts.forEach((row) => {
    statements.push(
      `INSERT INTO issue_counts VALUES (${q(row.runId)}, ${q(row.issueType)}, ${n(row.issueCount)});`
    );
  });

  rows.issueExamples.forEach((row) => {
    statements.push(
      `INSERT INTO issue_examples VALUES (${[
        q(row.runId),
        n(row.exampleIndex),
        q(row.issueType),
        q(row.optionIds),
        n(row.poolSize),
        n(row.candidateCount),
        q(row.topName),
        r(row.topCost),
        r(row.topDistance),
        r(row.topMatchPercent),
        q(row.query)
      ].join(', ')});`
    );
  });

  rows.poiCacheSummary.forEach((row) => {
    statements.push(
      `INSERT INTO poi_cache_summary VALUES (${[
        q(row.label),
        q(row.fileName),
        n(row.restaurantCount),
        r(row.avgCost),
        r(row.costMissingRate),
        r(row.avgDistance),
        r(row.avgRating),
        r(row.tagCoverageRate),
        n(row.amapApiCallCount),
        q(row.createdAt)
      ].join(', ')});`
    );
  });

  statements.push('COMMIT;');
  return `${statements.join('\n')}\n`;
}

function buildReport() {
  const sections = [];
  sections.push('# Recommendation Quality SQL Analysis');
  sections.push('');
  sections.push(`Generated at: ${new Date().toISOString()}`);
  sections.push('');

  sections.push('## 1. Stress Run Overview');
  sections.push('');
  sections.push(queryMarkdown(`SELECT
  run_id,
  total_runs,
  api_calls,
  cache_hit_rate,
  issue_rate,
  weak_rate,
  avg_top_match
FROM stress_runs
ORDER BY run_id;`));

  sections.push('');
  sections.push('## 2. Top Issue Types');
  sections.push('');
  sections.push(queryMarkdown(`SELECT
  issue_type,
  SUM(issue_count) AS total_count
FROM issue_counts
GROUP BY issue_type
ORDER BY total_count DESC;`));

  sections.push('');
  sections.push('## 3. Issue Examples by Candidate Pool');
  sections.push('');
  sections.push(queryMarkdown(`SELECT
  issue_type,
  COUNT(*) AS examples,
  ROUND(AVG(pool_size), 1) AS avg_pool_size,
  ROUND(AVG(top_match_percent), 1) AS avg_top_match
FROM issue_examples
GROUP BY issue_type
ORDER BY examples DESC;`));

  sections.push('');
  sections.push('## 4. POI Cache Data Quality');
  sections.push('');
  sections.push(queryMarkdown(`SELECT
  label,
  restaurant_count,
  ROUND(avg_cost, 1) AS avg_cost,
  ROUND(cost_missing_rate * 100, 1) AS cost_missing_pct,
  ROUND(tag_coverage_rate * 100, 1) AS tag_coverage_pct,
  amap_api_call_count
FROM poi_cache_summary
ORDER BY restaurant_count DESC
LIMIT 12;`));

  sections.push('');
  sections.push('## 5. SQL Findings');
  sections.push('');
  const topIssue = queryRows(`SELECT issue_type, SUM(issue_count) AS total_count
FROM issue_counts
GROUP BY issue_type
ORDER BY total_count DESC
LIMIT 1;`)[0];
  const bestCache = queryRows(`SELECT label, restaurant_count, ROUND(cost_missing_rate * 100, 1) AS cost_missing_pct
FROM poi_cache_summary
ORDER BY restaurant_count DESC
LIMIT 1;`)[0];
  const latest500 = queryRows(`SELECT run_id, total_runs, cache_hit_rate, issue_rate, weak_rate, avg_top_match
FROM stress_runs
WHERE total_runs = 500
ORDER BY cache_hit_rate DESC
LIMIT 1;`)[0];

  sections.push(
    `- Highest-frequency issue type in available stress logs: \`${topIssue ? topIssue.issue_type : 'n/a'}\`${topIssue ? ` (${topIssue.total_count} records)` : ''}.`
  );
  sections.push(
    `- Largest local POI cache pool: \`${bestCache ? bestCache.label : 'n/a'}\`${bestCache ? ` with ${bestCache.restaurant_count} restaurants and ${bestCache.cost_missing_pct}% missing cost data` : ''}.`
  );
  sections.push(
    `- Representative 500-run stress sample: \`${latest500 ? latest500.run_id : 'n/a'}\`${latest500 ? `, cache hit rate ${latest500.cache_hit_rate}%, issue rate ${latest500.issue_rate}%, weak rate ${latest500.weak_rate}%, avg top match ${latest500.avg_top_match}` : ''}.`
  );
  sections.push('');

  sections.push('## Resume Bullet');
  sections.push('');
  sections.push(
    '- 将推荐压测日志与高德 POI 缓存结构化入库，使用 SQL 分析 issueRate、weakRate、缓存命中率、候选池规模和价格缺失率，定位饮品/甜品意图偏离、候选召回不足等问题，并推动非正餐标签、关键词召回和兜底策略迭代。'
  );
  sections.push('');

  return `${sections.join('\n')}\n`;
}

function queryMarkdown(sql) {
  const csv = execFileSync('sqlite3', ['-header', '-csv', DB_PATH, sql], {
    encoding: 'utf8'
  }).trim();

  if (!csv) {
    return '_No rows._';
  }

  const rows = parseCsv(csv);
  const headers = rows[0];
  const body = rows.slice(1);
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`
  ];
  body.forEach((row) => lines.push(`| ${row.join(' | ')} |`));
  return lines.join('\n');
}

function queryRows(sql) {
  const json = execFileSync('sqlite3', ['-json', DB_PATH, sql], {
    encoding: 'utf8'
  }).trim();

  return json ? JSON.parse(json) : [];
}

function parseCsv(value) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function readJson(file) {
  const buffer = fs.readFileSync(file);
  let text;

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.slice(2).toString('utf16le');
  } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    text = swapUtf16Be(buffer.slice(2)).toString('utf16le');
  } else {
    text = buffer.toString('utf8');
  }

  return JSON.parse(text.replace(/^\uFEFF/, ''));
}

function swapUtf16Be(buffer) {
  const copy = Buffer.from(buffer);

  for (let index = 0; index + 1 < copy.length; index += 2) {
    const left = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = left;
  }

  return copy;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function q(value) {
  if (value === undefined || value === null) {
    return 'NULL';
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : 'NULL';
}

function r(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(4))) : 'NULL';
}

function avg(values) {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

if (require.main === module) {
  main();
}
