import React, { useEffect, useMemo, useRef, useState } from "react";
import Plot from "react-plotly.js";
import "./InvestingHistoryDashboard.css";

const SYSTEM_MAX_EDGES = 50;
const SYSTEM_MAX_DB_LIMIT = 20000;
const SYSTEM_MAX_HISTORY_LIMIT = 5000;
const STOCK_OPTIONS_LIMIT = 5000;
const STOCK_SEARCH_DEBOUNCE_MS = 180;
const STOCK_FUZZY_MATCH_THRESHOLD = 0.8;
const GRAPH_QUERY_TIMEOUT_MS = 20000;
const STOCK_QUERY_TIMEOUT_MS = 12000;
const GRAPH_QUERY_CACHE_TTL_MS = 20000;
const GRAPH_QUERY_CACHE_MAX_ITEMS = 256;
const STOCK_QUERY_CACHE_TTL_MS = 60000;
const STOCK_QUERY_CACHE_MAX_ITEMS = 256;
const SNAPSHOT_QUERY_CACHE_TTL_MS = 60000;
const SNAPSHOT_QUERY_CACHE_MAX_ITEMS = 256;
const SNAPSHOT_SLIDER_MIN_DATE = "2000-01-01";
const SNAPSHOT_SLIDER_MAX_DATE = "2026-02-18";
const SNAPSHOT_RANGE_START = SNAPSHOT_SLIDER_MIN_DATE;
const SNAPSHOT_RANGE_END = SNAPSHOT_SLIDER_MAX_DATE;
const DEFAULT_QUERY_START_DATE = "2015-01-01";
const DEFAULT_INITIAL_STOCK = "삼성전자";
const DEFAULT_HISTORY_LIMIT = 500;
const CLIENT_HOP_QUERY_BUDGET = 30;
const CLIENT_HOP_LEVEL_LIMIT = 20;
const GRAPH_API_BASE_URL = (
  process.env.REACT_APP_GRAPH_API_BASE_URL || "https://api2.slayerzeroa.click"
).trim();

class TTLCache {
  constructor(maxItems, ttlMs) {
    this.maxItems = Math.max(Number(maxItems) || 1, 1);
    this.ttlMs = Math.max(Number(ttlMs) || 1, 1);
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() >= item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    this.store.delete(key);
    this.store.set(key, item);
    return item.value;
  }

  set(key, value) {
    this.store.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });

    while (this.store.size > this.maxItems) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }
}

const graphQueryCache = new TTLCache(
  GRAPH_QUERY_CACHE_MAX_ITEMS,
  GRAPH_QUERY_CACHE_TTL_MS,
);
const stockQueryCache = new TTLCache(
  STOCK_QUERY_CACHE_MAX_ITEMS,
  STOCK_QUERY_CACHE_TTL_MS,
);
const snapshotDateCache = new TTLCache(
  SNAPSHOT_QUERY_CACHE_MAX_ITEMS,
  SNAPSHOT_QUERY_CACHE_TTL_MS,
);
const graphQueryInFlight = new Map();

const HISTORY_KEYS = [
  "investing_history",
  "investingHistory",
  "history",
  "table",
  "rows",
];

const HANGUL_ACRONYM_TOKENS = [
  ["더블유", "w"],
  ["에이치", "h"],
  ["제트", "z"],
  ["제이", "j"],
  ["케이", "k"],
  ["엑스", "x"],
  ["브이", "v"],
  ["큐", "q"],
  ["아이", "i"],
  ["와이", "y"],
  ["에프", "f"],
  ["에스", "s"],
  ["에이", "a"],
  ["엠", "m"],
  ["엔", "n"],
  ["엘", "l"],
  ["피", "p"],
  ["티", "t"],
  ["유", "u"],
  ["오", "o"],
  ["비", "b"],
  ["씨", "c"],
  ["디", "d"],
  ["이", "e"],
  ["지", "g"],
  ["알", "r"],
];

function isoDateToUtcDay(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const utcMs = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(utcMs)) {
    return null;
  }
  return Math.floor(utcMs / 86400000);
}

function utcDayToIsoDate(utcDay) {
  const day = Number(utcDay);
  if (!Number.isFinite(day)) {
    return "";
  }

  const date = new Date(day * 86400000);
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const SNAPSHOT_SLIDER_MIN_DAY = isoDateToUtcDay(SNAPSHOT_SLIDER_MIN_DATE) || 0;
const SNAPSHOT_SLIDER_MAX_DAY = isoDateToUtcDay(SNAPSHOT_SLIDER_MAX_DATE) || 0;
const SNAPSHOT_SLIDER_DAY_SPAN = Math.max(
  0,
  SNAPSHOT_SLIDER_MAX_DAY - SNAPSHOT_SLIDER_MIN_DAY,
);

function clampSliderUtcDay(utcDay) {
  const day = Number(utcDay);
  if (!Number.isFinite(day)) {
    return SNAPSHOT_SLIDER_MAX_DAY;
  }
  return Math.min(SNAPSHOT_SLIDER_MAX_DAY, Math.max(SNAPSHOT_SLIDER_MIN_DAY, day));
}

function clampToSliderDateRange(value) {
  const utcDay = isoDateToUtcDay(value);
  return utcDayToIsoDate(clampSliderUtcDay(utcDay));
}

function isoDateToSliderOffset(value) {
  const utcDay = isoDateToUtcDay(value);
  return clampSliderUtcDay(utcDay) - SNAPSHOT_SLIDER_MIN_DAY;
}

function sliderOffsetToIsoDate(value) {
  const offset = Number(value);
  if (!Number.isFinite(offset)) {
    return SNAPSHOT_SLIDER_MAX_DATE;
  }
  const utcDay = SNAPSHOT_SLIDER_MIN_DAY + Math.round(offset);
  return utcDayToIsoDate(clampSliderUtcDay(utcDay));
}

function buildApiUrl(path) {
  if (!GRAPH_API_BASE_URL) {
    return path;
  }
  const base = GRAPH_API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function compactParams(input) {
  const out = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === "string" && value.trim() === "") {
      return;
    }
    out[key] = value;
  });
  return out;
}

function toQueryString(params) {
  const usp = new URLSearchParams();
  Object.entries(compactParams(params)).forEach(([key, value]) => {
    usp.append(key, `${value}`);
  });
  return usp.toString();
}

async function requestJson(path, options = {}) {
  const res = await fetch(buildApiUrl(path), options);
  const raw = await res.text();

  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (_error) {
      data = null;
    }
  }

  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && (data.detail || data.message || data.error)) ||
      raw ||
      `HTTP ${res.status}`;
    throw new Error(String(detail));
  }

  return data ?? {};
}

function createTimedRequestSignal(timeoutMs, externalSignal = null) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timerId);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}

function normalizeRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    return [];
  }
  return rawRows
    .map((row, index) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        return row;
      }
      return {
        index: index + 1,
        value: row,
      };
    })
    .filter(Boolean);
}

function extractHistoryRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  for (const key of HISTORY_KEYS) {
    const rows = normalizeRows(payload[key]);
    if (rows.length) {
      return rows;
    }
  }

  return [];
}

function extractTopEdges(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.top_edges,
    payload.topEdges,
    payload.edges_top,
    payload.top_edges_rows,
  ];

  for (const rawRows of candidates) {
    if (!Array.isArray(rawRows)) {
      continue;
    }

    const rows = rawRows
      .map((row) => {
        const src = normalizeCompanyName(row?.src || row?.source || row?.investor);
        const dst = normalizeCompanyName(row?.dst || row?.target || row?.investee);
        const weight = Number(row?.weight ?? row?.value ?? row?.holding_amount);
        if (!src || !dst) {
          return null;
        }
        return {
          src,
          dst,
          weight: Number.isFinite(weight) ? weight : 0,
        };
      })
      .filter(Boolean);

    if (rows.length) {
      return rows;
    }
  }

  return [];
}

function normalizeCompanyName(rawName) {
  if (rawName === null || rawName === undefined) {
    return "";
  }

  const raw = String(rawName).replace(/\r/g, " ").replace(/\n/g, " ").trim();
  if (!raw) {
    return "";
  }

  let normalized = raw.replace(/\s+/g, " ").trim();
  normalized = normalized
    .replace(/^\(?가칭\)?\s*/i, "")
    .replace(/\s*\(?가칭\)?$/i, "");

  normalized = normalized
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let prevLegal = "";
  while (prevLegal !== normalized) {
    prevLegal = normalized;
    normalized = normalized
      .replace(/^\(주\)\s*/i, "")
      .replace(/^㈜\s*/i, "")
      .replace(/^주식회사\s*/i, "")
      .replace(/\s+\(주\)$/i, "")
      .replace(/\s+주식회사$/i, "")
      .trim();
  }

  normalized = normalized
    .replace(/㈜/g, "")
    .replace(/\(주\)/gi, "")
    .replace(/주식회사/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const suffixPatterns = [
    /\s*(?:co\.?\s*,?\s*ltd\.?|co\.?\s*ltd\.?|corp(?:oration)?\.?|inc(?:orporated)?\.?|ltd\.?|limited)$/i,
    /\s*(?:l\.?l\.?c\.?|llc|plc|gmbh|ag|sa|nv|bv)$/i,
    /\s*(?:holdings?|hldgs?)$/i,
    /\s*(?:홀딩스|지주)$/i,
    /\s*(?:보통주|우선주|common stock|preferred stock|ordinary shares?)$/i,
  ];

  let prev = "";
  while (prev !== normalized) {
    prev = normalized;
    for (const pattern of suffixPatterns) {
      normalized = normalized.replace(pattern, "").trim();
    }
  }

  normalized = normalized.replace(/[\s,;:|/-]+$/g, "").trim();
  return normalized || raw;
}

function formatCellValue(value, columnName = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  if (typeof value === "string") {
    const companyColumnPattern = /(stock|company|corp|name|기업|종목|회사)/i;
    if (companyColumnPattern.test(String(columnName || ""))) {
      return normalizeCompanyName(value);
    }
  }
  return String(value);
}

function formatNumberValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function buildStockList(stocks) {
  if (!Array.isArray(stocks)) {
    return [];
  }

  const unique = new Map();
  stocks.forEach((stock) => {
    if (stock === null || stock === undefined) {
      return;
    }
    const original = String(stock).trim();
    if (!original) {
      return;
    }
    const normalizedLabel = normalizeCompanyName(original);
    if (!normalizedLabel) {
      return;
    }
    const dedupeKey = normalizedLabel.replace(/\s+/g, "").toLowerCase();
    const existing = unique.get(dedupeKey);
    if (!existing) {
      unique.set(dedupeKey, {
        label: normalizedLabel,
        query: original,
      });
      return;
    }

    if (existing.query !== existing.label && original === normalizedLabel) {
      existing.query = original;
    }
  });

  const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
  return Array.from(unique.values()).sort((a, b) =>
    collator.compare(a.label, b.label),
  );
}

function normalizeTraceLabel(trace) {
  if (!trace || typeof trace !== "object") {
    return trace;
  }

  const normalizedTrace = { ...trace };
  const isMarkerTrace = String(normalizedTrace.mode || "").includes("markers");

  const toRawString = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "";
  };

  if (typeof normalizedTrace.name === "string") {
    normalizedTrace.name = normalizeCompanyName(normalizedTrace.name);
  }

  let originalTextList = [];
  if (Array.isArray(normalizedTrace.text)) {
    originalTextList = normalizedTrace.text.map((item) => toRawString(item));
    normalizedTrace.text = originalTextList.map((item, index) => {
      if (!item && typeof normalizedTrace.text[index] !== "string") {
        return normalizedTrace.text[index];
      }
      return normalizeCompanyName(item);
    });
  } else if (typeof normalizedTrace.text === "string") {
    originalTextList = [normalizedTrace.text];
    normalizedTrace.text = normalizeCompanyName(normalizedTrace.text);
  }

  if (isMarkerTrace && originalTextList.length) {
    const fullNames = originalTextList.map((item, index) => {
      const fallback = Array.isArray(normalizedTrace.text)
        ? toRawString(normalizedTrace.text[index])
        : toRawString(normalizedTrace.text);
      return item || fallback;
    });

    if (Array.isArray(normalizedTrace.hovertext) && normalizedTrace.hovertext.length) {
      normalizedTrace.hovertext = normalizedTrace.hovertext.map((item, index) => {
        const detail = toRawString(item);
        const fullName = toRawString(fullNames[index]);
        if (!detail) {
          return `Full Name: ${fullName}`;
        }
        if (detail.toLowerCase().includes("full name:")) {
          return detail;
        }
        return `Full Name: ${fullName}<br>${detail}`;
      });
      normalizedTrace.hovertemplate = "%{hovertext}<extra></extra>";
    } else {
      normalizedTrace.hovertext = Array.isArray(normalizedTrace.text)
        ? fullNames
        : fullNames[0] || "";
      if (normalizedTrace.customdata !== undefined) {
        normalizedTrace.hovertemplate =
          "Full Name: %{hovertext}<br>Name: %{text}<br>Role: %{customdata}<extra></extra>";
      } else {
        normalizedTrace.hovertemplate =
          "Full Name: %{hovertext}<br>Name: %{text}<extra></extra>";
      }
    }
  }

  return normalizedTrace;
}

function toNumericArray(values) {
  if (Array.isArray(values)) {
    return values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }
  if (ArrayBuffer.isView(values)) {
    return Array.from(values)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }
  const single = Number(values);
  if (Number.isFinite(single)) {
    return [single];
  }
  return [];
}

function compactCompanyKey(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).toLowerCase().replace(/[^0-9a-zA-Z가-힣]+/g, "");
}

function normalizeSnapshotDateList(rawDates) {
  if (!Array.isArray(rawDates)) {
    return [];
  }

  const unique = new Set();
  rawDates.forEach((value) => {
    const text = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      unique.add(text);
    }
  });

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function findSnapshotIndexByDate(snapshotDates, targetDate) {
  if (!Array.isArray(snapshotDates) || !snapshotDates.length) {
    return 0;
  }

  const target = String(targetDate || "").trim();
  if (!target) {
    return snapshotDates.length - 1;
  }

  const exact = snapshotDates.indexOf(target);
  if (exact >= 0) {
    return exact;
  }

  let insertAt = 0;
  while (insertAt < snapshotDates.length && snapshotDates[insertAt] < target) {
    insertAt += 1;
  }

  if (insertAt <= 0) {
    return 0;
  }
  return insertAt - 1;
}

function resolveSnapshotDateForSelectedDate(snapshotDates, selectedDate) {
  if (!Array.isArray(snapshotDates) || !snapshotDates.length) {
    return clampToSliderDateRange(selectedDate);
  }
  const idx = findSnapshotIndexByDate(snapshotDates, selectedDate);
  const safeIdx = Math.max(0, Math.min(idx, snapshotDates.length - 1));
  return snapshotDates[safeIdx] || clampToSliderDateRange(selectedDate);
}

function extractAliasSegments(rawName) {
  if (!rawName) {
    return [];
  }

  const value = String(rawName);
  const segments = [];
  const bracketPattern = /(?:\(|\[|（|【)([^)\]）】]+)(?:\)|\]|）|】)/g;
  let match = bracketPattern.exec(value);
  while (match) {
    const segment = String(match[1] || "").trim();
    if (segment) {
      segments.push(segment);
    }
    match = bracketPattern.exec(value);
  }

  const englishPattern = /[A-Za-z][A-Za-z0-9&.,-]*(?:\s+[A-Za-z0-9&.,-]+)*/g;
  const englishSegments = value.match(englishPattern) || [];
  englishSegments.forEach((segment) => {
    const normalized = String(segment || "").trim();
    if (normalized) {
      segments.push(normalized);
    }
  });

  return segments;
}

function convertHangulAcronymPrefix(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }

  let index = 0;
  let acronym = "";
  while (index < source.length) {
    let matched = false;
    for (const [token, letter] of HANGUL_ACRONYM_TOKENS) {
      if (source.startsWith(token, index)) {
        acronym += letter;
        index += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      break;
    }
  }

  if (acronym.length < 2) {
    return "";
  }
  return `${acronym}${source.slice(index)}`;
}

function buildSuffixReducedVariants(value) {
  const normalized = normalizeCompanyName(value);
  if (!normalized) {
    return [];
  }

  const variants = new Set();
  const register = (candidate) => {
    const text = String(candidate || "").trim();
    if (!text || text === normalized) {
      return;
    }
    variants.add(text);
  };

  // Keep semantic tokens like "생명" and "화재", and only drop the pure 보험 suffix.
  if (/\s*보험$/i.test(normalized)) {
    register(normalized.replace(/\s*보험$/i, "").trim());
  }

  // Insurance naming variants: "삼성화재해상보험" -> "삼성화재", "삼성화재해상"
  if (/\s*해상보험$/i.test(normalized)) {
    register(normalized.replace(/\s*해상보험$/i, "").trim());
  }
  if (/\s*해상$/i.test(normalized)) {
    register(normalized.replace(/\s*해상$/i, "").trim());
  }

  if (/\s*(?:insurance|ins\.?)$/i.test(normalized)) {
    register(normalized.replace(/\s*(?:insurance|ins\.?)$/i, "").trim());
  }

  return Array.from(variants);
}

function getCompanyMatchKeys(name) {
  const raw = String(name || "").trim();
  if (!raw) {
    return [];
  }

  const keys = new Set();
  const addCandidate = (candidate) => {
    const text = String(candidate || "").trim();
    if (!text) {
      return;
    }

    const normalized = normalizeCompanyName(text);
    const rawKey = compactCompanyKey(text);
    const normalizedKey = compactCompanyKey(normalized);
    if (rawKey) {
      keys.add(rawKey);
    }
    if (normalizedKey) {
      keys.add(normalizedKey);
    }

    buildSuffixReducedVariants(normalized).forEach((variant) => {
      const variantKey = compactCompanyKey(variant);
      if (variantKey) {
        keys.add(variantKey);
      }
    });

    const acronymAlias = convertHangulAcronymPrefix(normalized);
    if (acronymAlias) {
      const aliasKey = compactCompanyKey(acronymAlias);
      if (aliasKey) {
        keys.add(aliasKey);
      }
    }
  };

  addCandidate(raw);
  extractAliasSegments(raw).forEach(addCandidate);
  return Array.from(keys);
}

function toComparableCompanyKey(name) {
  const keys = getCompanyMatchKeys(name);
  if (!keys.length) {
    return "";
  }

  const alnumKeys = keys.filter((key) => /^[a-z0-9]+$/.test(key));
  if (alnumKeys.length) {
    return alnumKeys.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  return keys.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

function buildBigrams(value) {
  const text = compactCompanyKey(value);
  if (!text) {
    return [];
  }
  if (text.length < 2) {
    return [text];
  }

  const grams = [];
  for (let i = 0; i < text.length - 1; i += 1) {
    grams.push(text.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficientSimilarity(a, b) {
  const source = compactCompanyKey(a);
  const target = compactCompanyKey(b);
  if (!source || !target) {
    return 0;
  }
  if (source === target) {
    return 1;
  }

  const sourceBigrams = buildBigrams(source);
  const targetBigrams = buildBigrams(target);
  if (!sourceBigrams.length || !targetBigrams.length) {
    return source === target ? 1 : 0;
  }

  const sourceCounts = new Map();
  sourceBigrams.forEach((gram) => {
    sourceCounts.set(gram, (sourceCounts.get(gram) || 0) + 1);
  });

  let overlap = 0;
  targetBigrams.forEach((gram) => {
    const count = sourceCounts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      sourceCounts.set(gram, count - 1);
    }
  });

  return (2 * overlap) / (sourceBigrams.length + targetBigrams.length);
}

function levenshteinDistance(a, b) {
  const source = compactCompanyKey(a);
  const target = compactCompanyKey(b);
  if (!source || !target) {
    return Math.max(source.length, target.length);
  }
  if (source === target) {
    return 0;
  }

  const sourceLen = source.length;
  const targetLen = target.length;
  const previous = new Array(targetLen + 1).fill(0);
  const current = new Array(targetLen + 1).fill(0);

  for (let j = 0; j <= targetLen; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= sourceLen; i += 1) {
    current[0] = i;
    const sourceChar = source[i - 1];

    for (let j = 1; j <= targetLen; j += 1) {
      const targetChar = target[j - 1];
      const substitutionCost = sourceChar === targetChar ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }

    for (let j = 0; j <= targetLen; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[targetLen];
}

function normalizedLevenshteinSimilarity(a, b) {
  const source = compactCompanyKey(a);
  const target = compactCompanyKey(b);
  if (!source || !target) {
    return 0;
  }
  if (source === target) {
    return 1;
  }

  const maxLength = Math.max(source.length, target.length);
  if (!maxLength) {
    return 1;
  }
  const distance = levenshteinDistance(source, target);
  return Math.max(0, 1 - distance / maxLength);
}

function companyNameSimilarity(a, b) {
  return Math.max(
    diceCoefficientSimilarity(a, b),
    normalizedLevenshteinSimilarity(a, b),
  );
}

function blendedCompanyNameSimilarity(a, b) {
  const source = compactCompanyKey(a);
  const target = compactCompanyKey(b);
  if (!source || !target) {
    return 0;
  }
  if (source === target) {
    return 1;
  }

  const baseScore = companyNameSimilarity(source, target);
  const short = source.length <= target.length ? source : target;
  const long = source.length > target.length ? source : target;
  const contains = long.includes(short);
  const prefixMatch = long.startsWith(short);

  let boost = 0;
  if (contains) {
    const ratio = short.length / long.length;
    boost += 0.08 + ratio * 0.1;
  }
  if (prefixMatch) {
    boost += 0.06;
  }

  return Math.min(1, baseScore + boost);
}

function compute3DBounds(traces) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const includeValue = (x, y, z = 0) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return;
    }
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };

  (traces || []).forEach((trace) => {
    const xs = toNumericArray(trace?.x);
    const ys = toNumericArray(trace?.y);
    const zs = toNumericArray(trace?.z);
    const len = Math.max(xs.length, ys.length, zs.length);

    for (let i = 0; i < len; i += 1) {
      includeValue(xs[i], ys[i], zs[i] ?? 0);
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return null;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function find3DPointByLabel(traces, label) {
  const targetKeys = new Set(getCompanyMatchKeys(label));
  if (!targetKeys.size) {
    return null;
  }

  for (const trace of traces || []) {
    const texts = Array.isArray(trace?.text) ? trace.text : [];
    if (!texts.length) {
      continue;
    }

    const xs = toNumericArray(trace?.x);
    const ys = toNumericArray(trace?.y);
    const zs = toNumericArray(trace?.z);
    const len = Math.min(texts.length, xs.length, ys.length);

    for (let i = 0; i < len; i += 1) {
      const textKeys = getCompanyMatchKeys(texts[i]);
      const isMatch = textKeys.some((key) => targetKeys.has(key));
      if (!isMatch) {
        continue;
      }
      const x = xs[i];
      const y = ys[i];
      const z = zs[i] ?? 0;
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        return { x, y, z };
      }
    }
  }

  return null;
}

function valueAtPointIndex(value, index) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    if (Number.isInteger(index) && index >= 0 && index < value.length) {
      return value[index];
    }
    return null;
  }
  return value;
}

function collectPossibleCompanyNames(value, candidates) {
  if (typeof value === "string") {
    const normalizedRaw = String(value).trim();
    if (normalizedRaw) {
      candidates.add(normalizedRaw);
    }
    const normalized = normalizeCompanyName(normalizedRaw);
    if (normalized) {
      candidates.add(normalized);
      const acronymAlias = convertHangulAcronymPrefix(normalized);
      if (acronymAlias) {
        candidates.add(acronymAlias);
      }
    }
    extractAliasSegments(normalizedRaw).forEach((alias) => candidates.add(alias));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPossibleCompanyNames(item, candidates));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) =>
      collectPossibleCompanyNames(item, candidates),
    );
  }
}

function extractCompanyCandidatesFromPlotPoint(point) {
  if (!point || typeof point !== "object") {
    return [];
  }

  const pointIndex = Number.isInteger(point.pointIndex) ? point.pointIndex : -1;
  const candidates = new Set();
  const maybeValues = [
    valueAtPointIndex(point.text, pointIndex),
    valueAtPointIndex(point.hovertext, pointIndex),
    valueAtPointIndex(point.customdata, pointIndex),
    valueAtPointIndex(point.label, pointIndex),
    valueAtPointIndex(point.data?.text, pointIndex),
    valueAtPointIndex(point.data?.hovertext, pointIndex),
    valueAtPointIndex(point.data?.customdata, pointIndex),
    point.data?.name,
  ];

  maybeValues.forEach((value) => collectPossibleCompanyNames(value, candidates));
  return Array.from(candidates);
}

function toArrayPreserve(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(value);
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

function extractNodePointsFromFigureData(traces) {
  const nodes = new Map();
  if (!Array.isArray(traces)) {
    return nodes;
  }

  traces.forEach((trace) => {
    const mode = String(trace?.mode || "");
    if (!mode.includes("markers")) {
      return;
    }

    const xs = toArrayPreserve(trace?.x);
    const ys = toArrayPreserve(trace?.y);
    const zs = toArrayPreserve(trace?.z);
    const texts = toArrayPreserve(trace?.text);
    const len = Math.min(xs.length, ys.length, texts.length);

    for (let i = 0; i < len; i += 1) {
      const fullLabel = String(texts[i] ?? "").trim();
      const label = normalizeCompanyName(fullLabel);
      const key = toComparableCompanyKey(label);
      const x = Number(xs[i]);
      const y = Number(ys[i]);
      const z = Number(zs[i] ?? 0);
      if (!key || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      nodes.set(key, {
        key,
        label,
        fullLabel: fullLabel || label,
        x,
        y,
        z,
      });
    }
  });

  return nodes;
}

function extractNormalizedTopEdges(topEdges) {
  if (!Array.isArray(topEdges)) {
    return [];
  }

  return topEdges
    .map((edge) => {
      const srcLabel = normalizeCompanyName(edge?.src);
      const dstLabel = normalizeCompanyName(edge?.dst);
      const srcKey = toComparableCompanyKey(srcLabel);
      const dstKey = toComparableCompanyKey(dstLabel);
      const weight = Number(edge?.weight);
      if (!srcKey || !dstKey || srcKey === dstKey) {
        return null;
      }
      return {
        srcKey,
        dstKey,
        srcLabel,
        dstLabel,
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter(Boolean);
}

function buildExpandedFigureFromEdgeMap(baseFigure, nodeMap, edgeMap, rootKey = "") {
  const traces = Array.isArray(baseFigure?.data) ? baseFigure.data : [];
  const lineTemplate = traces.find((trace) => String(trace?.mode || "").includes("lines"));
  const nodeTemplate = traces.find((trace) =>
    String(trace?.mode || "").includes("markers"),
  );

  const edgeX = [];
  const edgeY = [];
  const edgeZ = [];
  edgeMap.forEach((edge) => {
    const srcNode = nodeMap.get(edge.srcKey);
    const dstNode = nodeMap.get(edge.dstKey);
    if (!srcNode || !dstNode) {
      return;
    }

    edgeX.push(srcNode.x, dstNode.x, null);
    edgeY.push(srcNode.y, dstNode.y, null);
    edgeZ.push(srcNode.z, dstNode.z, null);
  });

  const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => {
    if (a.key === rootKey) {
      return -1;
    }
    if (b.key === rootKey) {
      return 1;
    }
    return a.label.localeCompare(b.label, "ko");
  });

  const nodeX = [];
  const nodeY = [];
  const nodeZ = [];
  const nodeText = [];
  const nodeCustomData = [];
  const nodeHoverText = [];
  const nodeColors = [];

  const resolveRoleAgainstRoot = (nodeKey) => {
    if (!rootKey || nodeKey === rootKey) {
      return "Selected";
    }

    let isInvestor = false;
    let isInvestee = false;
    edgeMap.forEach((edge) => {
      if (edge.srcKey === nodeKey && edge.dstKey === rootKey) {
        isInvestor = true;
      }
      if (edge.srcKey === rootKey && edge.dstKey === nodeKey) {
        isInvestee = true;
      }
    });

    if (isInvestor && isInvestee) {
      return "Investor / Investee";
    }
    if (isInvestor) {
      return "Investor";
    }
    if (isInvestee) {
      return "Investee";
    }
    return "Related";
  };

  const roleColor = (role) => {
    if (role === "Selected") {
      return "#0f172a";
    }
    if (role === "Investor") {
      return "#0ea5e9";
    }
    if (role === "Investee") {
      return "#f59e0b";
    }
    if (role === "Investor / Investee") {
      return "#8b5cf6";
    }
    return "#334155";
  };

  sortedNodes.forEach((node) => {
    const role = resolveRoleAgainstRoot(node.key);
    nodeX.push(node.x);
    nodeY.push(node.y);
    nodeZ.push(node.z);
    nodeText.push(node.label);
    nodeCustomData.push(role);
    nodeHoverText.push(node.fullLabel || node.label);
    nodeColors.push(roleColor(role));
  });

  const edgeTrace = {
    ...(lineTemplate || {
      type: "scatter3d",
      mode: "lines",
      line: { width: 1, color: "#94a3b8" },
      hoverinfo: "none",
      showlegend: false,
    }),
    x: edgeX,
    y: edgeY,
    z: edgeZ,
    text: undefined,
    customdata: undefined,
    hovertext: undefined,
    name: lineTemplate?.name || "",
  };

  const nodeTrace = {
    ...(nodeTemplate || {
      type: "scatter3d",
      mode: "markers+text",
      marker: {
        size: 6,
        color: nodeColors,
      },
      textposition: "top center",
      textfont: { size: 10, color: "#1f2937" },
      hovertemplate: "%{text}<br>Role: %{customdata}<extra></extra>",
      name: "Stock Nodes",
      showlegend: false,
    }),
    x: nodeX,
    y: nodeY,
    z: nodeZ,
    text: nodeText,
    customdata: nodeCustomData,
    hovertext: nodeHoverText,
    hovertemplate:
      "Full Name: %{hovertext}<br>Name: %{text}<br>Role: %{customdata}<extra></extra>",
  };

  return {
    data: [edgeTrace, nodeTrace],
    layout: baseFigure?.layout || {},
  };
}

function convert3DTraceTo2D(trace) {
  if (!trace || trace.type !== "scatter3d") {
    return trace;
  }

  const { z, scene, ...rest } = trace;
  return {
    ...rest,
    type: "scatter",
  };
}

async function postGraphQuery(payload) {
  const safePayload = compactParams(payload || {});
  const cacheKey = JSON.stringify(safePayload);
  const cached = graphQueryCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const inFlight = graphQueryInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const requestPromise = (async () => {
    const { signal, cleanup } = createTimedRequestSignal(GRAPH_QUERY_TIMEOUT_MS);

    try {
      const data = await requestJson("/api/graph/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload),
        signal,
      });
      graphQueryCache.set(cacheKey, data);
      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Graph query timed out.");
      }
      throw error;
    } finally {
      cleanup();
    }
  })();

  graphQueryInFlight.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    graphQueryInFlight.delete(cacheKey);
  }
}

async function fetchStockOptions(params, signal) {
  const queryString = toQueryString(params);
  const cacheKey = queryString;
  const cached = stockQueryCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const timed = createTimedRequestSignal(STOCK_QUERY_TIMEOUT_MS, signal);

  try {
    const path = queryString ? `/api/stocks?${queryString}` : "/api/stocks";
    const data = await requestJson(path, {
      signal: timed.signal,
    });
    stockQueryCache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (error?.name === "AbortError" && !signal?.aborted) {
      throw new Error("Stock list query timed out.");
    }
    throw error;
  } finally {
    timed.cleanup();
  }
}

async function fetchSnapshotDatesForStock({
  searchStock,
  startDate,
  endDate,
  includePeriodicStatus,
  includeMajorstockStatus,
}) {
  const normalizedSearchStock = String(searchStock || "").trim();
  const normalizedStartDate = String(startDate || SNAPSHOT_RANGE_START).trim();
  const normalizedEndDate = String(endDate || SNAPSHOT_RANGE_END).trim();
  const cacheKey = JSON.stringify({
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
    search_stock: normalizedSearchStock,
    include_periodic_status: Boolean(includePeriodicStatus),
    include_majorstock_status: Boolean(includeMajorstockStatus),
  });
  const cached = snapshotDateCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const payload = {
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
    snapshot_date: null,
    search_stock: normalizedSearchStock || null,
    include_periodic_status: Boolean(includePeriodicStatus),
    include_majorstock_status: Boolean(includeMajorstockStatus),
    highlight_hops: 0,
    max_edges: 1,
    db_limit: 1,
  };
  const data = await postGraphQuery(payload);
  const dates = normalizeSnapshotDateList(data.snapshot_dates);
  snapshotDateCache.set(cacheKey, dates);
  return dates;
}

function InvestingHistoryDashboard() {
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [snapshotDate, setSnapshotDate] = useState(SNAPSHOT_SLIDER_MAX_DATE);
  const [startDate, setStartDate] = useState(DEFAULT_QUERY_START_DATE);
  const [endDate, setEndDate] = useState(SNAPSHOT_SLIDER_MAX_DATE);
  const [snapshotDates, setSnapshotDates] = useState([]);
  const [stockSnapshotDates, setStockSnapshotDates] = useState([]);
  const [snapshotSliderOffset, setSnapshotSliderOffset] = useState(
    isoDateToSliderOffset(SNAPSHOT_SLIDER_MAX_DATE),
  );
  const [viewMode, setViewMode] = useState("3d");
  const [searchStock, setSearchStock] = useState(DEFAULT_INITIAL_STOCK);
  const [searchStockQuery, setSearchStockQuery] = useState(DEFAULT_INITIAL_STOCK);
  const [highlightHops, setHighlightHops] = useState(1);
  const [maxEdges, setMaxEdges] = useState(SYSTEM_MAX_EDGES);
  const [dbLimit, setDbLimit] = useState("");
  const [historyLimit, setHistoryLimit] = useState(DEFAULT_HISTORY_LIMIT);
  const [includePeriodicStatus, setIncludePeriodicStatus] = useState(false);
  const [includeMajorstockStatus, setIncludeMajorstockStatus] = useState(false);

  const [figure, setFigure] = useState({ data: [], layout: {} });
  const [resolvedSnapshotDate, setResolvedSnapshotDate] = useState("");

  const [historyRows, setHistoryRows] = useState([]);
  const [topEdges, setTopEdges] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [allStocks, setAllStocks] = useState([]);
  const [stockSearchOpen, setStockSearchOpen] = useState(false);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [stockHighlightIndex, setStockHighlightIndex] = useState(-1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stockNavigation, setStockNavigation] = useState({
    entries: [],
    index: -1,
  });
  const stockAbortRef = useRef(null);
  const stockFetchSeqRef = useRef(0);
  const stockBlurTimerRef = useRef(null);
  const isMobileViewport = viewportWidth <= 767;

  const historyColumns = useMemo(() => {
    if (!historyRows.length) {
      return [];
    }
    const seen = new Set();
    historyRows.forEach((row) => {
      Object.keys(row).forEach((key) => seen.add(key));
    });
    return Array.from(seen);
  }, [historyRows]);

  const summaryRows = useMemo(() => {
    const match = String(statusText || "").match(/Rows:\s*([0-9,]+)/i);
    if (match && match[1]) {
      const parsed = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return historyRows.length;
  }, [historyRows.length, statusText]);

  const summaryEdges = useMemo(() => {
    const match = String(statusText || "").match(/Edges shown:\s*([0-9,]+)/i);
    if (match && match[1]) {
      const parsed = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return topEdges.length;
  }, [statusText, topEdges.length]);

  const stockSuggestions = useMemo(() => allStocks, [allStocks]);
  const stockSuggestionByKey = useMemo(() => {
    const mapped = new Map();
    stockSuggestions.forEach((stock) => {
      if (!stock) {
        return;
      }
      const keys = new Set([
        ...getCompanyMatchKeys(stock.label),
        ...getCompanyMatchKeys(stock.query || stock.label),
      ]);
      keys.forEach((key) => {
        if (key && !mapped.has(key)) {
          mapped.set(key, stock);
        }
      });
    });
    return mapped;
  }, [stockSuggestions]);

  const fuzzyStockCorpus = useMemo(() => {
    return stockSuggestions
      .map((stock) => {
        if (!stock) {
          return null;
        }

        const variants = new Set([
          ...getCompanyMatchKeys(stock.label),
          ...getCompanyMatchKeys(stock.query || stock.label),
          normalizeCompanyName(stock.label),
          normalizeCompanyName(stock.query || stock.label),
          stock.label,
          stock.query || stock.label,
        ]);

        const normalizedVariants = Array.from(variants)
          .map((value) => compactCompanyKey(value))
          .filter((value) => value && value.length >= 2);

        if (!normalizedVariants.length) {
          return null;
        }

        return {
          stock,
          variants: normalizedVariants,
        };
      })
      .filter(Boolean);
  }, [stockSuggestions]);

  const findMatchedStock = (value) => {
    const keys = getCompanyMatchKeys(value);
    for (const key of keys) {
      const matched = stockSuggestionByKey.get(key);
      if (matched) {
        return matched;
      }
    }

    const queryVariants = new Set([
      ...keys,
      normalizeCompanyName(value),
      value,
    ]);
    const normalizedQueryVariants = Array.from(queryVariants)
      .map((item) => compactCompanyKey(item))
      .filter((item) => item && item.length >= 2);

    if (!normalizedQueryVariants.length || !fuzzyStockCorpus.length) {
      return null;
    }

    let bestStock = null;
    let bestScore = 0;

    fuzzyStockCorpus.forEach((entry) => {
      let localBest = 0;
      for (const queryVariant of normalizedQueryVariants) {
        for (const stockVariant of entry.variants) {
          const score = blendedCompanyNameSimilarity(queryVariant, stockVariant);
          if (score > localBest) {
            localBest = score;
          }
          if (localBest >= 1) {
            break;
          }
        }
        if (localBest >= 1) {
          break;
        }
      }

      if (localBest > bestScore) {
        bestScore = localBest;
        bestStock = entry.stock;
      }
    });

    if (bestScore >= STOCK_FUZZY_MATCH_THRESHOLD) {
      return bestStock;
    }

    return null;
  };

  const recordStockNavigation = (label, query = "", snapshot = "") => {
    const normalizedLabel = normalizeCompanyName(label);
    const key = toComparableCompanyKey(normalizedLabel);
    if (!key) {
      return;
    }

    const normalizedQuery = String(query || normalizedLabel).trim() || normalizedLabel;
    const normalizedSnapshot = clampToSliderDateRange(
      snapshot || resolvedSnapshotDate || snapshotDate,
    );
    setStockNavigation((previous) => {
      const currentEntry = previous.entries[previous.index];
      const currentKey = currentEntry
        ? toComparableCompanyKey(currentEntry.label)
        : "";
      const currentSnapshot = currentEntry
        ? clampToSliderDateRange(currentEntry.snapshotDate || "")
        : "";

      if (
        currentKey &&
        currentKey === key &&
        currentSnapshot === normalizedSnapshot
      ) {
        const nextEntries = previous.entries.slice();
        nextEntries[previous.index] = {
          label: normalizedLabel,
          query: normalizedQuery,
          snapshotDate: normalizedSnapshot,
        };
        return {
          entries: nextEntries,
          index: previous.index,
        };
      }

      const truncated = previous.entries.slice(0, previous.index + 1);
      truncated.push({
        label: normalizedLabel,
        query: normalizedQuery,
        snapshotDate: normalizedSnapshot,
      });
      return {
        entries: truncated,
        index: truncated.length - 1,
      };
    });
  };

  const activeSnapshotDates = useMemo(
    () => (stockSnapshotDates.length ? stockSnapshotDates : snapshotDates),
    [stockSnapshotDates, snapshotDates],
  );

  const clampedSnapshotSliderOffset = Math.max(
    0,
    Math.min(snapshotSliderOffset, SNAPSHOT_SLIDER_DAY_SPAN),
  );
  const activeSnapshotMarkerDate = useMemo(() => {
    if (!activeSnapshotDates.length) {
      return "";
    }
    if (resolvedSnapshotDate && activeSnapshotDates.includes(resolvedSnapshotDate)) {
      return resolvedSnapshotDate;
    }
    return "";
  }, [activeSnapshotDates, resolvedSnapshotDate]);
  const mappedSnapshotDate = useMemo(
    () => resolveSnapshotDateForSelectedDate(activeSnapshotDates, snapshotDate),
    [activeSnapshotDates, snapshotDate],
  );
  const snapshotMarkers = useMemo(() => {
    if (!activeSnapshotDates.length) {
      return [];
    }

    return activeSnapshotDates.map((date, index) => {
      const day = isoDateToUtcDay(date);
      const leftPct = SNAPSHOT_SLIDER_DAY_SPAN
        ? ((clampSliderUtcDay(day) - SNAPSHOT_SLIDER_MIN_DAY) / SNAPSHOT_SLIDER_DAY_SPAN) * 100
        : 0;
      return {
        key: `${date}-${index}`,
        leftPct,
        active: date === activeSnapshotMarkerDate,
      };
    });
  }, [activeSnapshotDates, activeSnapshotMarkerDate]);

  const plotData = useMemo(() => {
    const rawData = Array.isArray(figure.data) ? figure.data : [];
    const normalizedData = rawData.map(normalizeTraceLabel);
    const convertedData = viewMode === "3d"
      ? normalizedData
      : normalizedData.map(convert3DTraceTo2D);

    if (!isMobileViewport) {
      return convertedData;
    }

    const mobileTextSize = viewMode === "3d" ? 9 : 8;
    return convertedData.map((trace) => {
      const mode = String(trace?.mode || "");
      if (!mode.includes("text")) {
        return trace;
      }
      const currentSize = Number(trace?.textfont?.size);
      const nextSize = Number.isFinite(currentSize)
        ? Math.min(currentSize, mobileTextSize)
        : mobileTextSize;
      return {
        ...trace,
        textfont: {
          ...(trace?.textfont || {}),
          size: nextSize,
        },
      };
    });
  }, [figure.data, isMobileViewport, viewMode]);

  const plotLayout = useMemo(() => {
    const rawLayout = {
      ...(figure.layout || {}),
    };
    const rawLegend = {
      ...(rawLayout.legend || {}),
    };
    const rawMargin = {
      ...(rawLayout.margin || {}),
    };
    const mobileLegend = isMobileViewport
      ? {
          ...rawLegend,
          orientation: "h",
          x: 0,
          xanchor: "left",
          y: -0.18,
          yanchor: "top",
          bgcolor: "rgba(255, 255, 255, 0.88)",
          bordercolor: "#dbe4ee",
          borderwidth: 1,
          font: {
            ...(rawLegend.font || {}),
            size: 11,
          },
        }
      : rawLegend;
    const mobileTitle = isMobileViewport
      ? (typeof rawLayout.title === "string"
          ? {
              text: rawLayout.title,
              x: 0.5,
              xanchor: "center",
              y: 0.99,
              yanchor: "top",
              font: { size: 12 },
            }
          : rawLayout.title && typeof rawLayout.title === "object"
            ? {
                ...rawLayout.title,
                x: rawLayout.title.x ?? 0.5,
                xanchor: rawLayout.title.xanchor || "center",
                y: rawLayout.title.y ?? 0.99,
                yanchor: rawLayout.title.yanchor || "top",
                font: {
                  ...(rawLayout.title.font || {}),
                  size: Math.min(Number(rawLayout.title.font?.size) || 14, 12),
                },
              }
            : rawLayout.title)
      : rawLayout.title;
    const mobileMargin = isMobileViewport
      ? {
          ...rawMargin,
          t: Math.max(Number(rawMargin.t) || 0, 100),
          r: Math.max(Number(rawMargin.r) || 0, 8),
          b: Math.max(Number(rawMargin.b) || 0, 96),
        }
      : rawMargin;

    const baseLayout = {
      ...rawLayout,
      autosize: true,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      title: mobileTitle,
      legend: mobileLegend,
      margin: mobileMargin,
    };

    if (viewMode === "3d") {
      const scene = baseLayout.scene || {};
      const subtleGridAxisStyle = {
        visible: true,
        showbackground: true,
        backgroundcolor: "#f8fafc",
        showgrid: true,
        gridcolor: "#e2e8f0",
        gridwidth: 1,
        zeroline: false,
        showline: false,
        ticks: "",
        showticklabels: false,
        showspikes: false,
        title: { text: "" },
      };
      const bounds = compute3DBounds(plotData);
      const focusedPoint =
        find3DPointByLabel(plotData, searchStock) ||
        find3DPointByLabel(plotData, searchStockQuery);

      let centerX = 0;
      let centerY = 0;
      let centerZ = 0;
      let span = 1;

      if (bounds) {
        centerX = focusedPoint ? focusedPoint.x : (bounds.minX + bounds.maxX) / 2;
        centerY = focusedPoint ? focusedPoint.y : (bounds.minY + bounds.maxY) / 2;
        centerZ = focusedPoint ? focusedPoint.z : (bounds.minZ + bounds.maxZ) / 2;

        const xHalfSpan = Math.max(
          Math.abs(bounds.maxX - centerX),
          Math.abs(centerX - bounds.minX),
        );
        const yHalfSpan = Math.max(
          Math.abs(bounds.maxY - centerY),
          Math.abs(centerY - bounds.minY),
        );
        const zHalfSpan = Math.max(
          Math.abs(bounds.maxZ - centerZ),
          Math.abs(centerZ - bounds.minZ),
        );
        span = Math.max(xHalfSpan, yHalfSpan, zHalfSpan, 1) * 1.12;
      }

      return {
        ...baseLayout,
        scene: {
          ...scene,
          dragmode: scene.dragmode || "orbit",
          bgcolor: "#ffffff",
          xaxis: {
            ...(scene.xaxis || {}),
            ...subtleGridAxisStyle,
            range: [centerX - span, centerX + span],
          },
          yaxis: {
            ...(scene.yaxis || {}),
            ...subtleGridAxisStyle,
            range: [centerY - span, centerY + span],
          },
          zaxis: {
            ...(scene.zaxis || {}),
            ...subtleGridAxisStyle,
            range: [centerZ - span, centerZ + span],
          },
          aspectmode: "cube",
          camera: {
            ...(scene.camera || {}),
            center: { x: 0, y: 0, z: 0 },
          },
        },
      };
    }

    const { scene, ...restLayout } = baseLayout;
    return {
      ...restLayout,
      dragmode: "pan",
      xaxis: {
        ...(restLayout.xaxis || {}),
        visible: false,
        showgrid: false,
        zeroline: false,
        showline: false,
        showticklabels: false,
        title: { text: "" },
      },
      yaxis: {
        ...(restLayout.yaxis || {}),
        visible: false,
        showgrid: false,
        zeroline: false,
        showline: false,
        showticklabels: false,
        scaleanchor: "x",
        scaleratio: 1,
        title: { text: "" },
      },
      hovermode: restLayout.hovermode || "closest",
    };
  }, [figure.layout, isMobileViewport, plotData, searchStock, searchStockQuery, viewMode]);

  const plotConfig = useMemo(
    () => ({
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
    }),
    [],
  );

  const loadGraph = async (options = {}) => {
    setLoading(true);
    setError("");

    try {
      const hasSnapshotDateOverride = Object.prototype.hasOwnProperty.call(
        options,
        "snapshotDate",
      );
      const shouldUseLatestSnapshot =
        hasSnapshotDateOverride && options.snapshotDate === null;
      const rawRequestedDate = hasSnapshotDateOverride
        ? options.snapshotDate
        : snapshotDate;
      const requestedSliderDate = clampToSliderDateRange(
        rawRequestedDate ?? snapshotDate,
      );
      const requestedSearchLabel = options.searchStockLabel ?? searchStock;
      const requestedSearchQuery = options.searchStockQuery ?? searchStockQuery;
      const effectiveStartDate = startDate && endDate && startDate > endDate
        ? endDate
        : startDate;
      const effectiveEndDate = startDate && endDate && endDate < startDate
        ? startDate
        : endDate;
      const typedSearch = requestedSearchLabel.trim();
      const matchedStock = findMatchedStock(typedSearch);
      const searchStockForQuery =
        requestedSearchQuery ||
        (matchedStock ? matchedStock.query : "") ||
        typedSearch;
      const shouldRecordNavigation = options.recordNavigation !== false;
      const resolvedSearchLabel = normalizeCompanyName(
        matchedStock?.label || typedSearch || requestedSearchLabel,
      );
      const resolvedSearchQuery = String(
        searchStockForQuery || matchedStock?.query || resolvedSearchLabel,
      ).trim();
      const stockSnapshotDates = searchStockForQuery
        ? normalizeSnapshotDateList(
            await fetchSnapshotDatesForStock({
              searchStock: searchStockForQuery,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              includePeriodicStatus,
              includeMajorstockStatus,
            }).catch(() => []),
          )
        : [];
      const snapshotDatesForQuery = stockSnapshotDates.length
        ? stockSnapshotDates
        : activeSnapshotDates;
      const effectiveSnapshotDate = shouldUseLatestSnapshot
        ? null
        : resolveSnapshotDateForSelectedDate(snapshotDatesForQuery, requestedSliderDate);

      const deriveReverseSearchCandidates = (selectedLabel) => {
        const selectedNormalized = normalizeCompanyName(selectedLabel);
        const selectedKey = toComparableCompanyKey(selectedNormalized);
        if (!selectedKey) {
          return [];
        }

        const candidates = new Map();
        const registerCandidate = (candidateLabel, candidateQuery = "") => {
          const normalized = normalizeCompanyName(candidateLabel || candidateQuery);
          const key = toComparableCompanyKey(normalized);
          if (!key || key === selectedKey || candidates.has(key)) {
            return;
          }

          const mapped = stockSuggestionByKey.get(key);
          candidates.set(key, {
            label: mapped?.label || normalized,
            query: mapped?.query || candidateQuery || normalized,
          });
        };

        stockSuggestions.forEach((stock) => {
          const stockKey = toComparableCompanyKey(stock?.label);
          if (stockKey && selectedKey.startsWith(stockKey) && stockKey !== selectedKey) {
            registerCandidate(stock.label, stock.query || stock.label);
          }
        });

        const latinPrefix = selectedNormalized.match(/^[A-Za-z]+/);
        if (latinPrefix && latinPrefix[0].length >= 2) {
          registerCandidate(latinPrefix[0], latinPrefix[0]);
        }

        const hangulOnly = selectedNormalized.replace(/[^가-힣]/g, "");
        if (hangulOnly.length >= 2) {
          registerCandidate(hangulOnly.slice(0, 2), hangulOnly.slice(0, 2));
        }
        if (hangulOnly.length >= 3) {
          registerCandidate(hangulOnly.slice(0, 3), hangulOnly.slice(0, 3));
        }

        const firstToken = selectedNormalized.split(/\s+/)[0];
        if (firstToken && firstToken.length >= 2) {
          registerCandidate(firstToken, firstToken);
        }

        return Array.from(candidates.values()).slice(0, 4);
      };

      const reverseSearchCandidates = deriveReverseSearchCandidates(typedSearch);
      const requestedHopDepth = Math.max(0, Number(highlightHops || 1));
      const shouldIncludeInboundToRoot =
        Boolean(searchStockForQuery) && requestedHopDepth >= 1;
      const effectiveHopDepth = shouldIncludeInboundToRoot
        ? Math.max(requestedHopDepth, 2)
        : requestedHopDepth;
      const effectiveMaxEdges = Math.max(
        1,
        Math.min(Number(maxEdges || SYSTEM_MAX_EDGES), SYSTEM_MAX_EDGES),
      );
      const effectiveDbLimit = dbLimit
        ? Math.max(1, Math.min(Number(dbLimit), SYSTEM_MAX_DB_LIMIT))
        : null;
      const effectiveHistoryLimit = Math.max(
        1,
        Math.min(Number(historyLimit || DEFAULT_HISTORY_LIMIT), SYSTEM_MAX_HISTORY_LIMIT),
      );
      const payload = {
        start_date: effectiveStartDate || SNAPSHOT_RANGE_START,
        end_date: effectiveEndDate || SNAPSHOT_RANGE_END,
        snapshot_date: effectiveSnapshotDate,
        search_stock: searchStockForQuery || null,
        include_periodic_status: Boolean(includePeriodicStatus),
        include_majorstock_status: Boolean(includeMajorstockStatus),
        highlight_hops: requestedHopDepth,
        max_edges: effectiveMaxEdges,
        db_limit: effectiveDbLimit,
        history_limit: effectiveHistoryLimit,
      };

      const applyGraphState = (
        data,
        figureOverride = null,
        statusOverride = "",
        stockDatesOverride = [],
        topEdgesOverride = null,
      ) => {
        const dates = normalizeSnapshotDateList(data.snapshot_dates);
        const fallbackSnapshotDate = resolveSnapshotDateForSelectedDate(
          dates.length ? dates : snapshotDatesForQuery,
          requestedSliderDate,
        );
        const serverSnapshotDate =
          data.snapshot_date ||
          effectiveSnapshotDate ||
          fallbackSnapshotDate ||
          requestedSliderDate ||
          "";

        setFigure(figureOverride || data.figure || { data: [], layout: {} });
        setHistoryRows(extractHistoryRows(data));
        setTopEdges(Array.isArray(topEdgesOverride) ? topEdgesOverride : extractTopEdges(data));
        setStatusText(statusOverride || data.status_text || "");
        setResolvedSnapshotDate(serverSnapshotDate);
        setSnapshotDates(dates);
        const stockDates = normalizeSnapshotDateList(stockDatesOverride);
        if (stockDates.length) {
          setStockSnapshotDates(stockDates);
        } else if (dates.length) {
          setStockSnapshotDates(dates);
        }
        return serverSnapshotDate;
      };

      const applyGraphStateAndTrack = (
        data,
        figureOverride = null,
        statusOverride = "",
        stockDatesOverride = [],
        topEdgesOverride = null,
      ) => {
        const trackedSnapshotDate = applyGraphState(
          data,
          figureOverride,
          statusOverride,
          stockDatesOverride,
          topEdgesOverride,
        );
        if (shouldRecordNavigation && resolvedSearchLabel) {
          recordStockNavigation(
            resolvedSearchLabel,
            resolvedSearchQuery || resolvedSearchLabel,
            trackedSnapshotDate || requestedSliderDate,
          );
        }
      };

      const shouldUseClientHopExpansion = Boolean(searchStockForQuery) && (
        effectiveHopDepth > 1 || reverseSearchCandidates.length > 0
      );

      if (!shouldUseClientHopExpansion) {
        const data = await postGraphQuery(payload);
        applyGraphStateAndTrack(data, null, "", stockSnapshotDates);
      } else {
        const resolveStockForHop = (label, queryHint = "") => {
          const normalizedLabel = normalizeCompanyName(label || queryHint);
          const matched = findMatchedStock(normalizedLabel) || findMatchedStock(queryHint);
          return {
            label: matched?.label || normalizedLabel || String(queryHint || "").trim(),
            query:
              matched?.query ||
              String(queryHint || "").trim() ||
              normalizedLabel ||
              String(label || "").trim(),
          };
        };

        const rootStock = resolveStockForHop(typedSearch, searchStockForQuery);
        const rootKey = toComparableCompanyKey(rootStock.label);
        const visitedKeys = new Set(rootKey ? [rootKey] : []);
        const aggregatedNodes = new Map();
        const aggregatedEdges = new Map();
        let frontier = [rootStock];
        let queryCount = 0;
        let truncated = false;
        let baseData = null;
        const hopDepth = Math.max(1, effectiveHopDepth);

        for (let level = 0; level < hopDepth; level += 1) {
          if (!frontier.length) {
            break;
          }
          if (queryCount >= CLIENT_HOP_QUERY_BUDGET) {
            truncated = true;
            break;
          }

          const currentLevel = frontier.slice(0, CLIENT_HOP_LEVEL_LIMIT);
          if (frontier.length > currentLevel.length) {
            truncated = true;
          }
          const nextFrontier = [];

          for (const focusStock of currentLevel) {
            if (queryCount >= CLIENT_HOP_QUERY_BUDGET) {
              truncated = true;
              break;
            }

            const hopPayload = {
              ...payload,
              search_stock: focusStock.query || focusStock.label || null,
              highlight_hops: 1,
            };

            // NOTE: backend highlight_hops expansion is inconsistent, so build multi-hop on client.
            const hopData = await postGraphQuery(hopPayload);
            queryCount += 1;
            if (!baseData) {
              baseData = hopData;
            }

            const hopNodes = extractNodePointsFromFigureData(hopData.figure?.data);
            hopNodes.forEach((node, nodeKey) => {
              if (!aggregatedNodes.has(nodeKey)) {
                aggregatedNodes.set(nodeKey, node);
              }
            });

            const hopEdges = extractNormalizedTopEdges(hopData.top_edges);
            hopEdges.forEach((edge) => {
              const shouldKeepEdge =
                !shouldIncludeInboundToRoot ||
                requestedHopDepth > 1 ||
                level === 0 ||
                edge.srcKey === rootKey ||
                edge.dstKey === rootKey;

              if (shouldKeepEdge) {
                const edgeKey = `${edge.srcKey}->${edge.dstKey}`;
                const existing = aggregatedEdges.get(edgeKey);
                if (!existing || edge.weight > existing.weight) {
                  aggregatedEdges.set(edgeKey, edge);
                }
              }

              if (level < hopDepth - 1) {
                [edge.srcLabel, edge.dstLabel].forEach((endpointLabel) => {
                  const endpoint = resolveStockForHop(endpointLabel, endpointLabel);
                  const endpointKey = toComparableCompanyKey(endpoint.label);
                  if (!endpointKey || visitedKeys.has(endpointKey)) {
                    return;
                  }
                  visitedKeys.add(endpointKey);
                  nextFrontier.push(endpoint);
                });
              }
            });

            if (level === 0 && level < hopDepth - 1) {
              reverseSearchCandidates.forEach((candidate) => {
                const key = toComparableCompanyKey(candidate.label);
                if (!key || visitedKeys.has(key)) {
                  return;
                }
                visitedKeys.add(key);
                nextFrontier.push(candidate);
              });
            }
          }

          frontier = nextFrontier;
        }

        if (!baseData) {
          const data = await postGraphQuery(payload);
          applyGraphStateAndTrack(data, null, "", stockSnapshotDates);
        } else if (!aggregatedEdges.size || !aggregatedNodes.size) {
          applyGraphStateAndTrack(baseData, null, "", stockSnapshotDates);
        } else {
          const expandedFigure = buildExpandedFigureFromEdgeMap(
            baseData.figure,
            aggregatedNodes,
            aggregatedEdges,
            rootKey,
          );
          const expansionSuffix = truncated
            ? " | Expanded hops (client, truncated)"
            : " | Expanded hops (client)";
          const topEdgesRows = Array.from(aggregatedEdges.values())
            .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
            .slice(0, 20)
            .map((edge) => ({
              src: edge.srcLabel,
              dst: edge.dstLabel,
              weight: Number(edge.weight || 0),
            }));
          const expandedStatus = `${baseData.status_text || ""} | Edges shown: ${
            aggregatedEdges.size
          }${expansionSuffix}`;
          applyGraphStateAndTrack(
            baseData,
            expandedFigure,
            expandedStatus,
            stockSnapshotDates,
            topEdgesRows,
          );
        }
      }
    } catch (loadError) {
      setError(loadError.message || "Graph query failed.");
      setHistoryRows([]);
      setTopEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStocks = async () => {
    if (stockAbortRef.current) {
      stockAbortRef.current.abort();
    }

    const controller = new AbortController();
    stockAbortRef.current = controller;
    const fetchId = stockFetchSeqRef.current + 1;
    stockFetchSeqRef.current = fetchId;
    setStockSearchLoading(true);

    const effectiveStartDate = startDate && endDate && startDate > endDate
      ? endDate
      : startDate;
    const effectiveEndDate = startDate && endDate && endDate < startDate
      ? startDate
      : endDate;

    try {
      const data = await fetchStockOptions({
        start_date: effectiveStartDate || SNAPSHOT_RANGE_START,
        end_date: effectiveEndDate || SNAPSHOT_RANGE_END,
        include_periodic_status: Boolean(includePeriodicStatus),
        include_majorstock_status: Boolean(includeMajorstockStatus),
        q: undefined,
        limit: STOCK_OPTIONS_LIMIT,
      }, controller.signal);

      if (fetchId !== stockFetchSeqRef.current) {
        return;
      }

      const normalizedStocks = buildStockList(data.stocks || []);
      setAllStocks(normalizedStocks);
      setStockHighlightIndex(normalizedStocks.length ? 0 : -1);
    } catch (loadError) {
      if (loadError.name !== "AbortError") {
        setAllStocks([]);
        setStockHighlightIndex(-1);
      }
    } finally {
      if (fetchId === stockFetchSeqRef.current) {
        setStockSearchLoading(false);
      }
    }
  };

  useEffect(() => {
    loadGraph({ snapshotDate: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!allStocks.length) {
      loadAllStocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stockSearchOpen || allStocks.length) {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      loadAllStocks();
    }, STOCK_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSearchOpen, allStocks.length]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (stockAbortRef.current) {
        stockAbortRef.current.abort();
      }
      if (stockBlurTimerRef.current) {
        clearTimeout(stockBlurTimerRef.current);
      }
    };
  }, []);

  const onRangeReload = async () => {
    await loadAllStocks();
    await loadGraph();
  };

  const onReset = async () => {
    setSearchStock("");
    setSearchStockQuery("");
    closeStockDropdown();
    await loadAllStocks();
    await loadGraph({
      searchStockLabel: "",
      searchStockQuery: "",
    });
  };

  const onSnapshotChange = (nextOffset) => {
    const offset = Number(nextOffset);
    if (!Number.isFinite(offset)) {
      return;
    }
    const clampedOffset = Math.max(0, Math.min(Math.round(offset), SNAPSHOT_SLIDER_DAY_SPAN));
    const nextDate = sliderOffsetToIsoDate(clampedOffset);
    setSnapshotSliderOffset(clampedOffset);
    setSnapshotDate(nextDate);
    setResolvedSnapshotDate("");
  };

  const onSnapshotDateInputChange = (event) => {
    const nextSnapshotDate = clampToSliderDateRange(event.target.value);
    setSnapshotDate(nextSnapshotDate);
    setSnapshotSliderOffset(isoDateToSliderOffset(nextSnapshotDate));
    setResolvedSnapshotDate("");
  };

  const closeStockDropdown = () => {
    if (stockBlurTimerRef.current) {
      clearTimeout(stockBlurTimerRef.current);
      stockBlurTimerRef.current = null;
    }
    setStockSearchOpen(false);
    setStockHighlightIndex(-1);
  };

  const onGoBack = async () => {
    if (loading || stockNavigation.index <= 0) {
      return;
    }

    const previousEntry = stockNavigation.entries[stockNavigation.index - 1];
    if (!previousEntry) {
      return;
    }

    const previousLabel = previousEntry.label;
    const previousQuery = previousEntry.query || previousEntry.label;
    const previousSnapshotDate = clampToSliderDateRange(
      previousEntry.snapshotDate || snapshotDate,
    );
    setStockNavigation((previous) => ({
      entries: previous.entries,
      index: Math.max(0, previous.index - 1),
    }));
    setSearchStock(previousLabel);
    setSearchStockQuery(previousQuery);
    setSnapshotDate(previousSnapshotDate);
    setSnapshotSliderOffset(isoDateToSliderOffset(previousSnapshotDate));
    setResolvedSnapshotDate(previousSnapshotDate);
    closeStockDropdown();

    await loadGraph({
      snapshotDate: previousSnapshotDate,
      searchStockLabel: previousLabel,
      searchStockQuery: previousQuery,
      recordNavigation: false,
    });
  };

  const selectStock = (stock) => {
    if (!stock) {
      return;
    }
    setSearchStock(stock.label);
    setSearchStockQuery(stock.query || stock.label);
    closeStockDropdown();
  };

  const handleStockInputKeyDown = (event) => {
    if (!stockSuggestions.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setStockSearchOpen(true);
      setStockHighlightIndex((prevIndex) =>
        prevIndex >= stockSuggestions.length - 1 ? 0 : prevIndex + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setStockSearchOpen(true);
      setStockHighlightIndex((prevIndex) =>
        prevIndex <= 0 ? stockSuggestions.length - 1 : prevIndex - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      if (
        stockSearchOpen &&
        stockHighlightIndex >= 0 &&
        stockSuggestions[stockHighlightIndex]
      ) {
        event.preventDefault();
        selectStock(stockSuggestions[stockHighlightIndex]);
        return;
      }
      closeStockDropdown();
      return;
    }

    if (event.key === "Escape") {
      closeStockDropdown();
    }
  };

  const handlePlotClick = async (event) => {
    if (loading) {
      return;
    }

    const clickedPoint = event?.points?.[0];
    if (!clickedPoint) {
      return;
    }

    const candidates = extractCompanyCandidatesFromPlotPoint(clickedPoint);
    if (!candidates.length) {
      return;
    }

    for (const candidate of candidates) {
      const matchedStock = findMatchedStock(candidate);
      if (!matchedStock) {
        continue;
      }

      const nextLabel = matchedStock.label;
      const nextQuery = matchedStock.query || matchedStock.label;
      if (toComparableCompanyKey(nextLabel) === toComparableCompanyKey(searchStock)) {
        return;
      }

      setSearchStock(nextLabel);
      setSearchStockQuery(nextQuery);
      closeStockDropdown();

      await loadGraph({
        searchStockLabel: nextLabel,
        searchStockQuery: nextQuery,
      });
      return;
    }
  };

  const canGoBack = stockNavigation.index > 0;

  return (
    <div className="investing-history-dashboard-section">
      <div className="investing-history-dashboard-card">
        <h2 className="investing-history-dashboard-title">
          INVESTING HISTORY DASHBOARD
        </h2>

        <div className="investing-history-controls">
          <div className="investing-history-control-row full-row primary-search-row">
            <label className="investing-history-control-label full-width">
              Search Stock
              <div className="investing-history-stock-search">
                <input
                  type="text"
                  value={searchStock}
                  onChange={(event) => {
                    setSearchStock(event.target.value);
                    setSearchStockQuery("");
                    setStockSearchOpen(true);
                    setStockHighlightIndex(-1);
                  }}
                  onFocus={() => {
                    if (stockBlurTimerRef.current) {
                      clearTimeout(stockBlurTimerRef.current);
                      stockBlurTimerRef.current = null;
                    }
                    setStockSearchOpen(true);
                    if (!allStocks.length) {
                      loadAllStocks();
                    }
                  }}
                  onBlur={() => {
                    stockBlurTimerRef.current = setTimeout(closeStockDropdown, 120);
                  }}
                  onKeyDown={handleStockInputKeyDown}
                  placeholder="종목 검색 또는 리스트에서 선택"
                  autoComplete="off"
                />

                {stockSearchOpen && (
                  <div className="investing-history-stock-suggestions">
                    {stockSearchLoading ? (
                      <div className="investing-history-stock-suggestion muted">
                        Searching...
                      </div>
                    ) : stockSuggestions.length ? (
                      stockSuggestions.map((stock, index) => (
                        <button
                          key={stock.label}
                          type="button"
                          className={`investing-history-stock-suggestion ${
                            stockHighlightIndex === index ? "active" : ""
                          }`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectStock(stock)}
                        >
                          {stock.label}
                        </button>
                      ))
                    ) : (
                      <div className="investing-history-stock-suggestion muted">
                        No stocks available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </label>
            <button
              className="investing-history-apply-button"
              onClick={onRangeReload}
              disabled={loading}
              type="button"
            >
              Apply Search
            </button>
          </div>

          <div className="investing-history-control-row full-row primary-snapshot-row">
            <label className="investing-history-control-label grow snapshot-navigator-control">
              Snapshot Navigator
              <div className="investing-history-snapshot-slider-wrap">
                <div className="investing-history-snapshot-markers" aria-hidden="true">
                  {snapshotMarkers.map((marker) => (
                    <span
                      key={marker.key}
                      className={`investing-history-snapshot-marker ${
                        marker.active ? "active" : ""
                      }`}
                      style={{ left: `${marker.leftPct}%` }}
                    />
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={SNAPSHOT_SLIDER_DAY_SPAN}
                  step={1}
                  value={clampedSnapshotSliderOffset}
                  onChange={(event) => onSnapshotChange(event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="investing-history-snapshot-label">
                As-Of Snapshot Date: {resolvedSnapshotDate || mappedSnapshotDate || "No snapshot"}
              </div>
            </label>
            <label className="investing-history-control-label snapshot-date-picker">
              Calendar
              <input
                type="date"
                value={snapshotDate || ""}
                min={SNAPSHOT_SLIDER_MIN_DATE}
                max={SNAPSHOT_SLIDER_MAX_DATE}
                onChange={onSnapshotDateInputChange}
              />
            </label>
          </div>

          <div className="investing-history-control-row full-row quick-row">
            <label className="investing-history-control-label highlight-hops-inline quick-hops hops-control">
              Highlight Hops: {highlightHops}
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={highlightHops}
                onChange={(event) => setHighlightHops(Number(event.target.value))}
              />
            </label>
            <label className="investing-history-control-label max-edges-control quick-max-edges">
              Max Edges
              <input
                type="number"
                min={1}
                max={SYSTEM_MAX_EDGES}
                value={maxEdges}
                onChange={(event) =>
                  setMaxEdges(
                    Math.max(
                      1,
                      Math.min(
                        Number(event.target.value || SYSTEM_MAX_EDGES),
                        SYSTEM_MAX_EDGES,
                      ),
                    ),
                  )
                }
              />
            </label>
            <label
              className="investing-history-control-label view-mode-control quick-view-mode"
              aria-label="Graph View Mode"
            >
              <div className="investing-history-view-toggle" role="group" aria-label="Graph View Mode">
                <button
                  type="button"
                  className={`investing-history-view-button ${
                    viewMode === "3d" ? "active" : ""
                  }`}
                  aria-pressed={viewMode === "3d"}
                  onClick={() => setViewMode("3d")}
                >
                  3D
                </button>
                <button
                  type="button"
                  className={`investing-history-view-button ${
                    viewMode === "2d" ? "active" : ""
                  }`}
                  aria-pressed={viewMode === "2d"}
                  onClick={() => setViewMode("2d")}
                >
                  2D
                </button>
              </div>
            </label>
            <button
              type="button"
              className="investing-history-advanced-toggle"
              onClick={() => setAdvancedOpen((prev) => !prev)}
            >
              {advancedOpen ? "Hide Advanced" : "Show Advanced"}
            </button>
          </div>

          {advancedOpen ? (
            <div className="investing-history-control-row full-row advanced-row">
              <div className="investing-history-advanced-grid">
                <label className="investing-history-control-label">
                  Start Date
                  <input
                    type="date"
                    value={startDate || ""}
                    min={SNAPSHOT_SLIDER_MIN_DATE}
                    max={SNAPSHOT_SLIDER_MAX_DATE}
                    onChange={(event) => {
                      const nextDate = clampToSliderDateRange(event.target.value);
                      setStartDate(nextDate);
                      if (endDate && nextDate > endDate) {
                        setEndDate(nextDate);
                      }
                    }}
                  />
                </label>
                <label className="investing-history-control-label">
                  End Date
                  <input
                    type="date"
                    value={endDate || ""}
                    min={SNAPSHOT_SLIDER_MIN_DATE}
                    max={SNAPSHOT_SLIDER_MAX_DATE}
                    onChange={(event) => {
                      const nextDate = clampToSliderDateRange(event.target.value);
                      setEndDate(nextDate);
                      if (startDate && nextDate < startDate) {
                        setStartDate(nextDate);
                      }
                    }}
                  />
                </label>
                <label className="investing-history-control-label db-limit-control">
                  DB Limit
                  <input
                    type="number"
                    min={1}
                    max={SYSTEM_MAX_DB_LIMIT}
                    placeholder="optional"
                    value={dbLimit}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw === "") {
                        setDbLimit("");
                        return;
                      }

                      const clamped = Math.max(
                        1,
                        Math.min(Number(raw), SYSTEM_MAX_DB_LIMIT),
                      );
                      if (Number.isFinite(clamped)) {
                        setDbLimit(String(clamped));
                      }
                    }}
                  />
                </label>
                <label className="investing-history-control-label history-limit-control">
                  History Limit
                  <input
                    type="number"
                    min={1}
                    max={SYSTEM_MAX_HISTORY_LIMIT}
                    value={historyLimit}
                    onChange={(event) =>
                      setHistoryLimit(
                        Math.max(
                          1,
                          Math.min(
                            Number(event.target.value || DEFAULT_HISTORY_LIMIT),
                            SYSTEM_MAX_HISTORY_LIMIT,
                          ),
                        ),
                      )
                    }
                  />
                </label>
                <div className="investing-history-control-label advanced-filter-control">
                  Filters
                  <div className="investing-history-advanced-filter-options">
                    <label className="investing-history-check-option advanced-check-option">
                      <input
                        type="checkbox"
                        checked={includePeriodicStatus}
                        onChange={(event) => setIncludePeriodicStatus(event.target.checked)}
                      />
                      <span>Periodic</span>
                    </label>
                    <label className="investing-history-check-option advanced-check-option">
                      <input
                        type="checkbox"
                        checked={includeMajorstockStatus}
                        onChange={(event) => setIncludeMajorstockStatus(event.target.checked)}
                      />
                      <span>Majorstock</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="investing-history-inline-actions advanced-actions">
                <button
                  className="investing-history-back-arrow-button"
                  onClick={onGoBack}
                  disabled={!canGoBack || loading}
                  type="button"
                  aria-label="Go back"
                  title="Go back"
                >
                  {"\u2190"}
                </button>
                <button
                  onClick={onReset}
                  className="investing-history-reset-button"
                  disabled={loading}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="investing-history-status">
          {loading ? "Loading..." : statusText}
          {error ? <div className="investing-history-error">{error}</div> : null}
          <div className="investing-history-snapshot-label">
            As-Of Snapshot Date: {resolvedSnapshotDate || mappedSnapshotDate || "None"}
          </div>
          <div className="investing-history-summary-chips">
            <span className="investing-history-summary-chip">
              Selected: {normalizeCompanyName(searchStock) || "None"}
            </span>
            <span className="investing-history-summary-chip">
              Rows: {formatNumberValue(summaryRows)}
            </span>
            <span className="investing-history-summary-chip">
              Edges: {formatNumberValue(summaryEdges)}
            </span>
          </div>
        </div>

        <div className="investing-history-table-wrap">
          {historyRows.length > 0 ? (
            <table className="investing-history-table">
              <thead>
                <tr>
                  {historyColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row, rowIndex) => (
                  <tr key={`investing-history-row-${rowIndex}`}>
                    {historyColumns.map((column) => (
                      <td key={`${column}-${rowIndex}`}>
                        {formatCellValue(row[column], column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="investing-history-empty">
              No investing history rows were returned for this query.
            </div>
          )}
        </div>

        <div className="investing-history-table-wrap top-edges-wrap">
          <div className="investing-history-subtitle">Top Edges</div>
          {topEdges.length > 0 ? (
            <table className="investing-history-table">
              <thead>
                <tr>
                  <th>src</th>
                  <th>dst</th>
                  <th>weight</th>
                </tr>
              </thead>
              <tbody>
                {topEdges.map((edge, index) => (
                  <tr key={`top-edge-${index}`}>
                    <td>{formatCellValue(edge.src, "src")}</td>
                    <td>{formatCellValue(edge.dst, "dst")}</td>
                    <td>{formatNumberValue(edge.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="investing-history-empty">No top edges available.</div>
          )}
        </div>

        {Array.isArray(figure.data) && figure.data.length > 0 ? (
          <div className="investing-history-plot-wrap">
            <Plot
              data={plotData}
              layout={plotLayout}
              config={plotConfig}
              onClick={handlePlotClick}
              useResizeHandler
              style={{ width: "100%", height: "620px" }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default InvestingHistoryDashboard;
