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
const STOCK_NODE_MIN_DISTANCE = 1.05;
const GRAPH_NODE_TEXT_SIZE_DESKTOP = 14;
const GRAPH_NODE_TEXT_SIZE_MOBILE = 10;
const GRAPH_NODE_TEXT_FAMILY =
  "'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Segoe UI', sans-serif";
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

const HISTORY_FAMILY_KEY_CANDIDATES = [
  "family",
  "family_id",
  "familyid",
  "family_group_key",
  "family_group",
  "familygroupkey",
  "familygroup",
  "disclosure_family",
  "disclosure_family_id",
  "family_key",
];

const HISTORY_FAMILY_ROOT_KEY_CANDIDATES = [
  "family_root",
  "familyroot",
  "family_root_id",
  "familyrootid",
  "family_group_key",
  "family_group_id",
  "familygroupkey",
  "familygroupid",
  "disclosure_family_root",
  "disclosure_family_root_id",
  "disclosure_family_group",
  "disclosure_family_group_id",
  "root_family",
  "root_family_id",
  "family_root_rcept_no",
  "family_root_receipt_no",
  "root_rcept_no",
  "root_receipt_no",
];

const HISTORY_FAMILY_GROUP_KEY_CANDIDATES = [
  "family_group_key",
  "family_group",
  "family_group_id",
  "familygroupkey",
  "familygroup",
  "familygroupid",
  "disclosure_family_group",
  "disclosure_family_group_id",
  "group_family_key",
  "group_family_id",
];

const HISTORY_FAMILY_LATEST_FLAG_KEY_CANDIDATES = [
  "is_latest_in_family",
  "latest_in_family",
  "is_family_latest",
  "family_is_latest",
  "family_latest",
];

const HISTORY_FAMILY_VERSION_KEY_CANDIDATES = [
  "family_disclosure_rank",
  "family_version_no",
  "family_version",
  "family_rank",
  "disclosure_rank",
  "version_no",
];

const HISTORY_MEMBER_KEY_CANDIDATES = [
  "rcept_no",
  "rceptno",
  "receipt_no",
  "receiptno",
  "member_rcept_no",
  "memberrceptno",
  "disclosure_no",
  "disclosureno",
  "doc_no",
  "docno",
  "document_no",
  "documentno",
  "family_member_rcept_no",
  "familymemberrceptno",
  "rcept_dt",
  "rceptdt",
  "receipt_dt",
  "receiptdt",
];

const HISTORY_RECEIPT_KEY_CANDIDATES = [
  "rcept_no",
  "rceptno",
  "receipt_no",
  "receiptno",
  "member_rcept_no",
  "memberrceptno",
  "disclosure_no",
  "disclosureno",
  "doc_no",
  "docno",
  "document_no",
  "documentno",
];

const HISTORY_DATE_KEY_CANDIDATES = [
  "rcept_dt",
  "receipt_dt",
  "as_of_date",
  "effective_dt",
];

const HISTORY_REPORT_NAME_KEY_CANDIDATES = ["report_nm", "report_name"];

const HISTORY_CORP_KEY_CANDIDATES = ["corp_name", "corp", "src", "source"];

const HISTORY_INVESTEE_KEY_CANDIDATES = [
  "iscmp_cmpnm",
  "investee",
  "dst",
  "target",
];

const HISTORY_DIRECTION_KEY_CANDIDATES = ["event_direction", "direction"];
const ENABLE_CLIENT_FAMILY_FALLBACK = false;

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

const HANGUL_TO_LATIN_TOKENS = [
  ["삼성", "samsung"],
  ["현대", "hyundai"],
  ["기아", "kia"],
  ["엘지", "lg"],
  ["에스케이", "sk"],
  ["씨제이", "cj"],
  ["롯데", "lotte"],
  ["한화", "hanwha"],
  ["포스코", "posco"],
  ["카카오", "kakao"],
  ["네이버", "naver"],
  ["전자", "electronics"],
  ["생명", "life"],
  ["화재", "fire"],
  ["해상", "marine"],
  ["보험", "insurance"],
  ["증권", "securities"],
  ["카드", "card"],
  ["지주", "holdings"],
  ["홀딩스", "holdings"],
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
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
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
  return Math.min(
    SNAPSHOT_SLIDER_MAX_DAY,
    Math.max(SNAPSHOT_SLIDER_MIN_DAY, day),
  );
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
      (data &&
        typeof data === "object" &&
        (data.detail || data.message || data.error)) ||
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

function pickRowValueByKeyCandidates(row, candidates) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  for (const key of candidates) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  const candidateSet = new Set(candidates.map((key) => String(key).toLowerCase()));
  for (const [rawKey, value] of Object.entries(row)) {
    if (!candidateSet.has(String(rawKey).toLowerCase())) {
      continue;
    }
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function normalizeFamilyKeyValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value).trim();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const digits = compact.replace(/\D+/g, "");
  if (digits.length >= 8 && digits.length >= compact.length - 2) {
    return digits;
  }

  return compact;
}

function pickFamilyKeyFromRow(row) {
  const explicit = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_FAMILY_KEY_CANDIDATES),
  );
  if (explicit) {
    return explicit;
  }

  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return "";
  }

  let best = "";
  let bestScore = -Infinity;

  Object.entries(row).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || "").trim().toLowerCase();
    if (!key || !key.includes("family")) {
      return;
    }

    const value = normalizeFamilyKeyValue(rawValue);
    if (!value) {
      return;
    }

    let score = 0;
    if (key === "family") {
      score += 120;
    }
    if (key.includes("family_id") || key.includes("familyid")) {
      score += 110;
    }
    if (key.includes("family_group")) {
      score += 140;
    }
    if (key.includes("group_family")) {
      score += 135;
    }
    if (key.includes("disclosure_family")) {
      score += 90;
    }
    if (key.includes("family_key")) {
      score += 80;
    }
    if (key.includes("member")) {
      score -= 120;
    }
    if (/(rcept|receipt|doc|date|dt)/.test(key)) {
      score -= 70;
    }

    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  });

  return bestScore > 0 ? best : "";
}

function pickFamilyGroupKeyFromRow(row) {
  const explicitGroup = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_FAMILY_GROUP_KEY_CANDIDATES),
  );
  if (explicitGroup) {
    return `group:${explicitGroup}`;
  }
  return "";
}

function pickFamilyRootKeyFromRow(row) {
  const explicitRoot = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_FAMILY_ROOT_KEY_CANDIDATES),
  );
  if (explicitRoot) {
    return `root:${explicitRoot}`;
  }

  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return "";
  }

  let best = "";
  let bestScore = -Infinity;

  Object.entries(row).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey || "").trim().toLowerCase();
    if (!key || !key.includes("family")) {
      return;
    }
    if (!key.includes("root") && !key.includes("group")) {
      return;
    }

    const value = normalizeFamilyKeyValue(rawValue);
    if (!value) {
      return;
    }

    let score = 0;
    if (key === "family_root" || key === "disclosure_family_root") {
      score += 140;
    }
    if (key.includes("family_group") || key.includes("group_family")) {
      score += 145;
    }
    if (key.includes("_id") || key.endsWith("id")) {
      score += 40;
    }
    if (/(rcept|receipt|doc|date|dt)/.test(key)) {
      score -= 30;
    }

    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  });

  if (bestScore <= 0 || !best) {
    return "";
  }
  return `root:${best}`;
}

function parseFamilyBooleanValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["1", "y", "yes", "true", "t"].includes(normalized)) {
    return true;
  }
  if (["0", "n", "no", "false", "f"].includes(normalized)) {
    return false;
  }
  return null;
}

function pickFamilyLatestFlagFromRow(row) {
  const raw = pickRowValueByKeyCandidates(
    row,
    HISTORY_FAMILY_LATEST_FLAG_KEY_CANDIDATES,
  );
  return parseFamilyBooleanValue(raw);
}

function parseFamilyNumericVersion(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = String(value).trim().replace(/,/g, "");
  if (!normalized) {
    return null;
  }
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  const digits = normalized.replace(/\D+/g, "");
  if (!digits) {
    return null;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFamilyVersionFromRow(row) {
  const raw = pickRowValueByKeyCandidates(
    row,
    HISTORY_FAMILY_VERSION_KEY_CANDIDATES,
  );
  return parseFamilyNumericVersion(raw);
}

function extractReceiptDigitsFromHistoryRow(row) {
  const directReceiptValue = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_RECEIPT_KEY_CANDIDATES),
  );
  const directDigits = directReceiptValue.replace(/\D+/g, "");
  const scannedDigits = [];

  if (row && typeof row === "object" && !Array.isArray(row)) {
    Object.entries(row).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey || "").trim().toLowerCase();
      if (!/(rcept|receipt|disclosure|doc)/.test(key)) {
        return;
      }
      if (key.includes("family")) {
        return;
      }

      const digits = normalizeFamilyKeyValue(rawValue).replace(/\D+/g, "");
      if (digits.length >= 8) {
        scannedDigits.push(digits);
      }
    });
  }

  const receiptCandidates = [directDigits, ...scannedDigits].filter(Boolean);
  if (!receiptCandidates.length) {
    return "";
  }

  return receiptCandidates.sort(
    (a, b) => b.length - a.length || b.localeCompare(a),
  )[0];
}

function normalizeReportNameForFamily(rawValue) {
  const source = String(rawValue || "").trim();
  if (!source) {
    return "";
  }

  // Strip correction markers so a correction and its original share one family key.
  return source
    .replace(/\[[^\]]*정정[^\]]*]\s*/g, " ")
    .replace(/\((?:기재\s*)?정정\)\s*/g, " ")
    .replace(/(?:^|\s)(?:기재\s*)?정정[:\s-]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectionReportName(rawValue) {
  const source = String(rawValue || "").trim();
  if (!source) {
    return false;
  }

  return (
    /\[[^\]]*정정[^\]]*]/.test(source) ||
    /\((?:기재\s*)?정정\)/.test(source) ||
    /(?:^|\s)(?:기재\s*)?정정(?:[:\s-]|$)/.test(source)
  );
}

function buildFallbackFamilyBaseKeyFromRow(row) {
  const rawReportName = String(
    pickRowValueByKeyCandidates(row, HISTORY_REPORT_NAME_KEY_CANDIDATES) || "",
  ).trim();
  if (!rawReportName) {
    return "";
  }

  const normalizedReportName = normalizeReportNameForFamily(rawReportName);
  if (!normalizedReportName) {
    return "";
  }

  const corpLabel = normalizeCompanyName(
    pickRowValueByKeyCandidates(row, HISTORY_CORP_KEY_CANDIDATES),
  );
  const investeeLabel = normalizeCompanyName(
    pickRowValueByKeyCandidates(row, HISTORY_INVESTEE_KEY_CANDIDATES),
  );
  const direction = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_DIRECTION_KEY_CANDIDATES),
  ).toUpperCase();

  return [
    corpLabel || "-",
    investeeLabel || "-",
    normalizedReportName,
    direction || "-",
  ].join("|");
}

function deriveFallbackFamilyKeyFromRow(row, correctionFamilyBases = null) {
  const baseKey = buildFallbackFamilyBaseKeyFromRow(row);
  if (!baseKey) {
    return "";
  }

  const rawReportName = pickRowValueByKeyCandidates(
    row,
    HISTORY_REPORT_NAME_KEY_CANDIDATES,
  );
  const hasCorrectionCompanion =
    correctionFamilyBases instanceof Set && correctionFamilyBases.has(baseKey);
  if (!isCorrectionReportName(rawReportName) && !hasCorrectionCompanion) {
    return "";
  }

  return `fallback:${baseKey}`;
}

function buildHistoryFamilyRowMeta(row, index, correctionFamilyBases = null) {
  const familyRootKey = pickFamilyRootKeyFromRow(row);
  const familyGroupKey = pickFamilyGroupKeyFromRow(row);
  const explicitFamilyKey = pickFamilyKeyFromRow(row);
  const familyKey =
    familyRootKey ||
    familyGroupKey ||
    explicitFamilyKey ||
    (ENABLE_CLIENT_FAMILY_FALLBACK
      ? deriveFallbackFamilyKeyFromRow(row, correctionFamilyBases)
      : "");
  if (!familyKey) {
    return null;
  }

  const rawMemberValue = pickRowValueByKeyCandidates(
    row,
    HISTORY_MEMBER_KEY_CANDIDATES,
  );
  const normalizedMemberKey = normalizeFamilyKeyValue(rawMemberValue);
  const receiptDigits = extractReceiptDigitsFromHistoryRow(row);
  const comparableFamilyKey = String(familyKey)
    .replace(/^(?:root|group|fallback):/i, "")
    .trim();
  const memberKey =
    (receiptDigits && `rcept:${receiptDigits}`) ||
    (normalizedMemberKey && normalizedMemberKey !== comparableFamilyKey
      ? normalizedMemberKey
      : `__row_${index}`);
  const dateValue = normalizeFamilyKeyValue(
    pickRowValueByKeyCandidates(row, HISTORY_DATE_KEY_CANDIDATES),
  ).slice(0, 10);
  const latestFlag = pickFamilyLatestFlagFromRow(row);
  const familyVersion = pickFamilyVersionFromRow(row);

  return {
    familyKey,
    memberKey,
    receiptDigits,
    dateValue,
    latestFlag,
    familyVersion,
    rowIndex: index,
  };
}

function isLaterHistoryFamilyMember(candidate, current) {
  if (
    candidate.latestFlag !== null &&
    current.latestFlag !== null &&
    candidate.latestFlag !== current.latestFlag
  ) {
    return candidate.latestFlag;
  }

  if (
    Number.isFinite(candidate.familyVersion) &&
    Number.isFinite(current.familyVersion) &&
    candidate.familyVersion !== current.familyVersion
  ) {
    return candidate.familyVersion > current.familyVersion;
  }

  const candidateReceipt = candidate.receiptDigits || "";
  const currentReceipt = current.receiptDigits || "";
  if (candidateReceipt && currentReceipt && candidateReceipt !== currentReceipt) {
    return candidateReceipt > currentReceipt;
  }

  const candidateDate = candidate.dateValue || "";
  const currentDate = current.dateValue || "";
  if (candidateDate && currentDate && candidateDate !== currentDate) {
    return candidateDate > currentDate;
  }

  return candidate.rowIndex > current.rowIndex;
}

function keepLatestHistoryRowsByFamily(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return rows;
  }

  const correctionFamilyBases = ENABLE_CLIENT_FAMILY_FALLBACK ? new Set() : null;
  if (correctionFamilyBases) {
    rows.forEach((row) => {
      const rawReportName = pickRowValueByKeyCandidates(
        row,
        HISTORY_REPORT_NAME_KEY_CANDIDATES,
      );
      if (!isCorrectionReportName(rawReportName)) {
        return;
      }

      const baseKey = buildFallbackFamilyBaseKeyFromRow(row);
      if (baseKey) {
        correctionFamilyBases.add(baseKey);
      }
    });
  }

  const latestMemberByFamily = new Map();
  rows.forEach((row, index) => {
    const meta = buildHistoryFamilyRowMeta(row, index, correctionFamilyBases);
    if (!meta) {
      return;
    }

    const current = latestMemberByFamily.get(meta.familyKey);
    if (!current || isLaterHistoryFamilyMember(meta, current)) {
      latestMemberByFamily.set(meta.familyKey, meta);
    }
  });

  if (!latestMemberByFamily.size) {
    return rows;
  }

  return rows.filter((row, index) => {
    const meta = buildHistoryFamilyRowMeta(row, index, correctionFamilyBases);
    if (!meta) {
      return true;
    }
    const latest = latestMemberByFamily.get(meta.familyKey);
    if (!latest) {
      return true;
    }

    if (latest.memberKey.startsWith("__row_")) {
      return latest.rowIndex === meta.rowIndex;
    }

    return latest.memberKey === meta.memberKey;
  });
}

function extractHistoryRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  for (const key of HISTORY_KEYS) {
    const rows = keepLatestHistoryRowsByFamily(normalizeRows(payload[key]));
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
        const src = normalizeCompanyName(
          row?.src || row?.source || row?.investor,
        );
        const dst = normalizeCompanyName(
          row?.dst || row?.target || row?.investee,
        );
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

function isHistoryDirectionColumn(columnName) {
  const key = String(columnName || "").trim().toLowerCase();
  return key === "event_direction" || key === "direction";
}

function formatCellValue(value, columnName = "", row = null) {
  if (isHistoryDirectionColumn(columnName)) {
    const resolvedDirection = normalizeHistoryDirectionValue(row);
    if (resolvedDirection === "IN" || resolvedDirection === "OUT") {
      return resolvedDirection;
    }
  }

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

function isFamilyRelatedHistoryColumn(columnName) {
  const key = String(columnName || "").trim().toLowerCase();
  if (!key) {
    return false;
  }
  if (key.includes("family")) {
    return true;
  }
  return key === "source" || key === "src";
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

  const collator = new Intl.Collator("ko", {
    numeric: true,
    sensitivity: "base",
  });
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

    if (
      Array.isArray(normalizedTrace.hovertext) &&
      normalizedTrace.hovertext.length
    ) {
      normalizedTrace.hovertext = normalizedTrace.hovertext.map(
        (item, index) => {
          const detail = toRawString(item);
          const fullName = toRawString(fullNames[index]);
          if (!detail) {
            return `Full Name: ${fullName}`;
          }
          if (detail.toLowerCase().includes("full name:")) {
            return detail;
          }
          return `Full Name: ${fullName}<br>${detail}`;
        },
      );
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
  return String(value)
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]+/g, "");
}

function compactAsciiKey(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, "");
}

function extractLeadingAsciiToken(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  const match = source.match(/^([A-Za-z0-9]{1,12})/);
  return compactAsciiKey(match ? match[1] : "");
}

function hasAsciiCharacters(value) {
  return /[A-Za-z]/.test(String(value || ""));
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

function buildNearestSnapshotCandidates(
  snapshotDates,
  selectedDate,
  maxCandidates = 10,
) {
  if (!Array.isArray(snapshotDates) || !snapshotDates.length) {
    return [];
  }

  const normalized = normalizeSnapshotDateList(snapshotDates);
  if (!normalized.length) {
    return [];
  }

  const centerDate = clampToSliderDateRange(
    selectedDate || normalized[normalized.length - 1],
  );
  const centerIndex = findSnapshotIndexByDate(normalized, centerDate);
  const maxCount = Math.max(1, Number(maxCandidates) || 10);
  const out = [];
  const seen = new Set();

  const pushIndex = (index) => {
    if (index < 0 || index >= normalized.length) {
      return;
    }
    const date = normalized[index];
    if (!date || seen.has(date)) {
      return;
    }
    seen.add(date);
    out.push(date);
  };

  pushIndex(centerIndex);
  for (let step = 1; out.length < maxCount; step += 1) {
    const left = centerIndex - step;
    const right = centerIndex + step;
    if (left < 0 && right >= normalized.length) {
      break;
    }
    pushIndex(left);
    if (out.length >= maxCount) {
      break;
    }
    pushIndex(right);
  }

  return out;
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
      // Prevent short acronym collisions like "SK" from "SK하이닉스" or "S&K폴리텍".
      // Keep short aliases only when the whole raw name is also that short alias.
      const segmentKey = compactCompanyKey(normalized);
      const rawKey = compactCompanyKey(value);
      if (segmentKey.length <= 2 && rawKey.length > segmentKey.length) {
        return;
      }
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

function buildRomanizedAliases(value) {
  const normalized = normalizeCompanyName(value);
  if (!normalized || !/[가-힣]/.test(normalized)) {
    return [];
  }

  let translated = normalized;
  HANGUL_TO_LATIN_TOKENS.forEach(([from, to]) => {
    translated = translated.split(from).join(` ${to} `);
  });

  translated = translated
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!translated) {
    return [];
  }

  const aliases = new Set([translated, translated.replace(/\s+/g, "")]);
  const firstToken = translated.split(" ")[0];
  if (firstToken && firstToken.length >= 2) {
    aliases.add(firstToken);
  }

  return Array.from(aliases).filter(Boolean);
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
  buildRomanizedAliases(raw).forEach(addCandidate);
  extractAliasSegments(raw).forEach(addCandidate);
  return Array.from(keys);
}

function toComparableCompanyKey(name) {
  // Prefer a stable key derived from the normalized company name itself.
  // This avoids alias collisions such as "삼성전자" and "삼성모바일디스플레이"
  // both collapsing to a short romanized token like "samsung".
  const normalizedKey = compactCompanyKey(normalizeCompanyName(name));
  if (normalizedKey) {
    return normalizedKey;
  }

  const keys = getCompanyMatchKeys(name);
  if (!keys.length) {
    return "";
  }

  const alnumKeys = keys.filter((key) => /^[a-z0-9]+$/.test(key));
  if (alnumKeys.length) {
    return alnumKeys.sort(
      (a, b) => a.length - b.length || a.localeCompare(b),
    )[0];
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
    extractAliasSegments(normalizedRaw).forEach((alias) =>
      candidates.add(alias),
    );
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

  maybeValues.forEach((value) =>
    collectPossibleCompanyNames(value, candidates),
  );
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
      if (
        !key ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z)
      ) {
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

function parseSignedHistoryNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const text = String(value ?? "").trim();
  if (!text) {
    return NaN;
  }

  const parenNegative = text.match(/^\((.+)\)$/);
  if (parenNegative && parenNegative[1]) {
    const numericParen = Number(String(parenNegative[1]).replace(/,/g, ""));
    return Number.isFinite(numericParen) ? -numericParen : NaN;
  }

  const numeric = Number(text.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function resolveHistoryRowWeight(row) {
  const amount = Math.abs(parseSignedHistoryNumber(row?.trfdtl_trfprc));
  if (Number.isFinite(amount) && amount > 0) {
    return amount;
  }

  const shares = Math.abs(parseSignedHistoryNumber(row?.trfdtl_stkcnt));
  if (Number.isFinite(shares) && shares > 0) {
    return shares;
  }

  return 1;
}

function normalizeHistoryDirectionValue(row) {
  // Prefer numeric sign when available because some rows have inconsistent event_direction text.
  const signedAmount = parseSignedHistoryNumber(row?.trfdtl_trfprc);
  const signedShares = parseSignedHistoryNumber(row?.trfdtl_stkcnt);
  const hasAmount = Number.isFinite(signedAmount) && signedAmount !== 0;
  const hasShares = Number.isFinite(signedShares) && signedShares !== 0;
  if (hasAmount || hasShares) {
    if (hasAmount && hasShares) {
      if (Math.sign(signedAmount) === Math.sign(signedShares)) {
        return signedAmount < 0 ? "OUT" : "IN";
      }
      // If amount and share signs conflict, trust transaction amount first.
      return signedAmount < 0 ? "OUT" : "IN";
    }
    if (hasAmount) {
      return signedAmount < 0 ? "OUT" : "IN";
    }
    return signedShares < 0 ? "OUT" : "IN";
  }

  const rawDirection = pickRowValueByKeyCandidates(
    row,
    HISTORY_DIRECTION_KEY_CANDIDATES,
  );
  const normalized = String(rawDirection || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (
    normalized === "out" ||
    normalized === "o" ||
    normalized === "sell" ||
    normalized === "dispose" ||
    normalized === "disposal" ||
    normalized === "decrease" ||
    normalized === "exit"
  ) {
    return "OUT";
  }
  if (
    normalized === "in" ||
    normalized === "i" ||
    normalized === "buy" ||
    normalized === "acquire" ||
    normalized === "increase" ||
    normalized === "entry"
  ) {
    return "IN";
  }

  if (/(^|[^a-z])out([^a-z]|$)/.test(normalized)) {
    return "OUT";
  }
  if (/(^|[^a-z])in([^a-z]|$)/.test(normalized)) {
    return "IN";
  }
  if (/(처분|매도|감소|유출)/.test(normalized)) {
    return "OUT";
  }
  if (/(취득|매수|증가|유입)/.test(normalized)) {
    return "IN";
  }

  return normalized.toUpperCase();
}

function isOutboundHistoryRow(row) {
  return normalizeHistoryDirectionValue(row) === "OUT";
}

function collectOutboundCenterEdgeKeysFromHistoryRows(historyRows, selectedLabel) {
  if (!Array.isArray(historyRows) || !historyRows.length) {
    return new Set();
  }

  const selectedKeys = new Set(getCompanyMatchKeys(selectedLabel));
  if (!selectedKeys.size) {
    return new Set();
  }

  const directionalScoreByEdge = new Map();
  historyRows.forEach((row) => {
    const srcLabel = normalizeCompanyName(
      row?.corp_name || row?.src || row?.source || row?.investor,
    );
    const dstLabel = normalizeCompanyName(
      row?.iscmp_cmpnm || row?.dst || row?.target || row?.investee,
    );
    if (!srcLabel || !dstLabel) {
      return;
    }

    const srcKey = toComparableCompanyKey(srcLabel);
    const dstKey = toComparableCompanyKey(dstLabel);
    if (!srcKey || !dstKey || srcKey === dstKey) {
      return;
    }

    const srcMatch = getCompanyMatchKeys(srcLabel).some((key) =>
      selectedKeys.has(key),
    );
    if (!srcMatch) {
      return;
    }

    const direction = normalizeHistoryDirectionValue(row);
    if (direction !== "IN" && direction !== "OUT") {
      return;
    }

    const edgeKey = `${srcKey}->${dstKey}`;
    const signedWeight = resolveHistoryRowWeight(row);
    const delta = direction === "OUT" ? -signedWeight : signedWeight;
    directionalScoreByEdge.set(
      edgeKey,
      (directionalScoreByEdge.get(edgeKey) || 0) + delta,
    );
  });

  const outboundEdgeKeys = new Set();
  directionalScoreByEdge.forEach((score, edgeKey) => {
    if (score < 0) {
      outboundEdgeKeys.add(edgeKey);
    }
  });
  return outboundEdgeKeys;
}

function buildFallbackGraphFromHistory({
  historyRows,
  searchLabel,
  baseFigure,
  maxEdges,
  historyLimit,
}) {
  if (!Array.isArray(historyRows) || !historyRows.length) {
    return null;
  }

  const selectedLabel = normalizeCompanyName(searchLabel);
  const selectedKeys = new Set(getCompanyMatchKeys(selectedLabel));
  if (!selectedKeys.size) {
    return null;
  }

  const edgeAgg = new Map();
  const nodeLabelByKey = new Map();
  const rootCandidateCount = new Map();
  const filteredRows = [];

  historyRows.forEach((row) => {
    if (isOutboundHistoryRow(row)) {
      return;
    }

    const srcLabel = normalizeCompanyName(
      row?.corp_name || row?.src || row?.source || row?.investor,
    );
    const dstLabel = normalizeCompanyName(
      row?.iscmp_cmpnm || row?.dst || row?.target || row?.investee,
    );
    if (!srcLabel || !dstLabel) {
      return;
    }

    const srcKeys = getCompanyMatchKeys(srcLabel);
    const dstKeys = getCompanyMatchKeys(dstLabel);
    const srcMatch = srcKeys.some((key) => selectedKeys.has(key));
    const dstMatch = dstKeys.some((key) => selectedKeys.has(key));
    if (!srcMatch && !dstMatch) {
      return;
    }

    const srcKey = toComparableCompanyKey(srcLabel);
    const dstKey = toComparableCompanyKey(dstLabel);
    if (!srcKey || !dstKey || srcKey === dstKey) {
      return;
    }

    filteredRows.push(row);
    nodeLabelByKey.set(srcKey, srcLabel);
    nodeLabelByKey.set(dstKey, dstLabel);
    if (srcMatch) {
      rootCandidateCount.set(srcKey, (rootCandidateCount.get(srcKey) || 0) + 1);
    }
    if (dstMatch) {
      rootCandidateCount.set(dstKey, (rootCandidateCount.get(dstKey) || 0) + 1);
    }

    const edgeKey = `${srcKey}->${dstKey}`;
    const weight = resolveHistoryRowWeight(row);
    const prev = edgeAgg.get(edgeKey);
    if (!prev) {
      edgeAgg.set(edgeKey, {
        srcKey,
        dstKey,
        srcLabel,
        dstLabel,
        weight,
      });
      return;
    }

    edgeAgg.set(edgeKey, {
      ...prev,
      weight: prev.weight + weight,
    });
  });

  if (!edgeAgg.size) {
    return null;
  }

  const sortedRootCandidates = Array.from(rootCandidateCount.entries()).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  );
  const rootKey =
    sortedRootCandidates[0]?.[0] || Array.from(edgeAgg.values())[0]?.srcKey;
  if (!rootKey) {
    return null;
  }

  const rootDisplayLabel =
    nodeLabelByKey.get(rootKey) || selectedLabel || String(searchLabel || "");
  const limitedEdges = Array.from(edgeAgg.values())
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
    .slice(0, Math.max(1, maxEdges || SYSTEM_MAX_EDGES));
  if (!limitedEdges.length) {
    return null;
  }

  const limitedEdgeMap = new Map();
  const nodeKeys = new Set([rootKey]);
  limitedEdges.forEach((edge) => {
    limitedEdgeMap.set(`${edge.srcKey}->${edge.dstKey}`, edge);
    nodeKeys.add(edge.srcKey);
    nodeKeys.add(edge.dstKey);
  });

  const nodeMap = new Map();
  nodeMap.set(rootKey, {
    key: rootKey,
    label: selectedLabel || rootDisplayLabel,
    fullLabel: rootDisplayLabel,
    x: 0,
    y: 0,
    z: 0,
  });

  const otherKeys = Array.from(nodeKeys).filter((key) => key !== rootKey);
  otherKeys.forEach((key, index) => {
    const layer = Math.floor(index / 12);
    const angle = ((index % 12) / 12) * Math.PI * 2;
    const radius = 1.75 + layer * 0.9;
    const zOffset = ((index % 6) - 2.5) * 0.28;
    const label = nodeLabelByKey.get(key) || key;
    nodeMap.set(key, {
      key,
      label,
      fullLabel: label,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: zOffset,
    });
  });

  const figureOverride = buildExpandedFigureFromEdgeMap(
    {
      data: [],
      layout: baseFigure?.layout || {},
    },
    nodeMap,
    limitedEdgeMap,
    rootKey,
  );

  const topEdgesRows = limitedEdges
    .slice()
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
    .slice(0, 20)
    .map((edge) => ({
      src: edge.srcLabel,
      dst: edge.dstLabel,
      weight: Number(edge.weight || 0),
    }));

  return {
    figureOverride,
    topEdgesRows,
    rootDisplayLabel: selectedLabel || rootDisplayLabel,
    filteredHistoryRows: filteredRows.slice(
      0,
      Math.max(1, Number(historyLimit || DEFAULT_HISTORY_LIMIT)),
    ),
  };
}

function extractRelatedCounterpartyKeysFromHistoryRows(historyRows, selectedLabel) {
  if (!Array.isArray(historyRows) || !historyRows.length) {
    return new Set();
  }

  const selectedKeys = new Set(getCompanyMatchKeys(selectedLabel));
  const selectedCanonicalKey = toComparableCompanyKey(selectedLabel);
  if (!selectedKeys.size && !selectedCanonicalKey) {
    return new Set();
  }

  const relatedKeys = new Set();
  historyRows.forEach((row) => {
    if (isOutboundHistoryRow(row)) {
      return;
    }

    const srcLabel = normalizeCompanyName(
      row?.corp_name || row?.src || row?.source || row?.investor,
    );
    const dstLabel = normalizeCompanyName(
      row?.iscmp_cmpnm || row?.dst || row?.target || row?.investee,
    );
    if (!srcLabel || !dstLabel) {
      return;
    }

    const srcKey = toComparableCompanyKey(srcLabel);
    const dstKey = toComparableCompanyKey(dstLabel);
    if (!srcKey || !dstKey || srcKey === dstKey) {
      return;
    }

    const srcMatch = getCompanyMatchKeys(srcLabel).some((key) =>
      selectedKeys.has(key),
    );
    const dstMatch = getCompanyMatchKeys(dstLabel).some((key) =>
      selectedKeys.has(key),
    );
    if (!srcMatch && !dstMatch) {
      return;
    }

    if (srcMatch && !dstMatch) {
      if (dstKey !== selectedCanonicalKey) {
        relatedKeys.add(dstKey);
      }
      return;
    }

    if (dstMatch && !srcMatch) {
      if (srcKey !== selectedCanonicalKey) {
        relatedKeys.add(srcKey);
      }
      return;
    }

    if (srcKey !== selectedCanonicalKey) {
      relatedKeys.add(srcKey);
    }
    if (dstKey !== selectedCanonicalKey) {
      relatedKeys.add(dstKey);
    }
  });

  return relatedKeys;
}

function extractRelatedCounterpartyKeysFromTopEdges(topEdges, selectedLabel) {
  if (!Array.isArray(topEdges) || !topEdges.length) {
    return new Set();
  }

  const selectedKeys = new Set(getCompanyMatchKeys(selectedLabel));
  const selectedCanonicalKey = toComparableCompanyKey(selectedLabel);
  if (!selectedKeys.size && !selectedCanonicalKey) {
    return new Set();
  }

  const relatedKeys = new Set();
  topEdges.forEach((edge) => {
    const srcLabel = normalizeCompanyName(
      edge?.src || edge?.source || edge?.investor,
    );
    const dstLabel = normalizeCompanyName(
      edge?.dst || edge?.target || edge?.investee,
    );
    if (!srcLabel || !dstLabel) {
      return;
    }

    const srcKey = toComparableCompanyKey(srcLabel);
    const dstKey = toComparableCompanyKey(dstLabel);
    if (!srcKey || !dstKey || srcKey === dstKey) {
      return;
    }

    const srcMatch = getCompanyMatchKeys(srcLabel).some((key) =>
      selectedKeys.has(key),
    );
    const dstMatch = getCompanyMatchKeys(dstLabel).some((key) =>
      selectedKeys.has(key),
    );
    if (!srcMatch && !dstMatch) {
      return;
    }

    if (srcMatch && !dstMatch) {
      if (dstKey !== selectedCanonicalKey) {
        relatedKeys.add(dstKey);
      }
      return;
    }

    if (dstMatch && !srcMatch) {
      if (srcKey !== selectedCanonicalKey) {
        relatedKeys.add(srcKey);
      }
      return;
    }

    if (srcKey !== selectedCanonicalKey) {
      relatedKeys.add(srcKey);
    }
    if (dstKey !== selectedCanonicalKey) {
      relatedKeys.add(dstKey);
    }
  });

  return relatedKeys;
}

function buildExpandedFigureFromEdgeMap(
  baseFigure,
  nodeMap,
  edgeMap,
  rootKey = "",
) {
  const resolveStableDirection = (key) => {
    const source = String(key || "");
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }

    const angle = ((hash % 360) / 180) * Math.PI;
    const z = (((hash >>> 9) % 200) / 100 - 1) * 0.35;
    const planar = Math.sqrt(Math.max(1 - z * z, 0.05));
    return {
      x: Math.cos(angle) * planar,
      y: Math.sin(angle) * planar,
      z,
    };
  };

  const enforceRootNodeDistance = (
    inputNodeMap,
    selectedRootKey,
    minDistance = STOCK_NODE_MIN_DISTANCE,
  ) => {
    if (!(inputNodeMap instanceof Map) || !selectedRootKey) {
      return inputNodeMap;
    }

    const root = inputNodeMap.get(selectedRootKey);
    if (!root) {
      return inputNodeMap;
    }

    const rootX = Number(root.x);
    const rootY = Number(root.y);
    const rootZ = Number(root.z);
    if (
      !Number.isFinite(rootX) ||
      !Number.isFinite(rootY) ||
      !Number.isFinite(rootZ)
    ) {
      return inputNodeMap;
    }

    const requiredDistance = Math.max(
      0.6,
      Number(minDistance) || STOCK_NODE_MIN_DISTANCE,
    );
    const adjusted = new Map();
    inputNodeMap.forEach((node, key) => adjusted.set(key, { ...node }));

    adjusted.forEach((node, key) => {
      if (key === selectedRootKey) {
        return;
      }

      const x = Number(node.x);
      const y = Number(node.y);
      const z = Number(node.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return;
      }

      let dx = x - rootX;
      let dy = y - rootY;
      let dz = z - rootZ;
      let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance >= requiredDistance) {
        return;
      }

      if (distance < 1e-6) {
        const stable = resolveStableDirection(key);
        dx = stable.x;
        dy = stable.y;
        dz = stable.z;
        distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      if (distance < 1e-6) {
        return;
      }

      const scale = requiredDistance / distance;
      node.x = rootX + dx * scale;
      node.y = rootY + dy * scale;
      node.z = rootZ + dz * scale;
    });

    return adjusted;
  };

  const traces = Array.isArray(baseFigure?.data) ? baseFigure.data : [];
  const lineTemplate = traces.find((trace) =>
    String(trace?.mode || "").includes("lines"),
  );
  const nodeTemplate = traces.find((trace) =>
    String(trace?.mode || "").includes("markers"),
  );
  const positionedNodeMap = enforceRootNodeDistance(nodeMap, rootKey);

  const edgeX = [];
  const edgeY = [];
  const edgeZ = [];
  const edgeText = [];
  edgeMap.forEach((edge) => {
    const srcNode = positionedNodeMap.get(edge.srcKey);
    const dstNode = positionedNodeMap.get(edge.dstKey);
    if (!srcNode || !dstNode) {
      return;
    }

    const weightText = Number(edge.weight || 0).toLocaleString("en-US");
    const hoverLabel = `${edge.srcLabel} -> ${edge.dstLabel}<br>Relationship Strength: ${weightText}`;

    edgeX.push(srcNode.x, dstNode.x, null);
    edgeY.push(srcNode.y, dstNode.y, null);
    edgeZ.push(srcNode.z, dstNode.z, null);
    edgeText.push(hoverLabel, hoverLabel, null);
  });

  const sortedNodes = Array.from(positionedNodeMap.values()).sort((a, b) => {
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
  const nodeSizes = [];

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

  const baseMarkerSize = (() => {
    const templateSize = nodeTemplate?.marker?.size;
    if (Array.isArray(templateSize) && templateSize.length) {
      const first = Number(templateSize[0]);
      if (Number.isFinite(first)) {
        return first;
      }
    }
    const numeric = Number(templateSize);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    return 6;
  })();

  sortedNodes.forEach((node) => {
    const role = resolveRoleAgainstRoot(node.key);
    const displayLabel =
      role === "Selected" ? node.fullLabel || node.label : node.label;
    nodeX.push(node.x);
    nodeY.push(node.y);
    nodeZ.push(node.z);
    nodeText.push(displayLabel);
    nodeCustomData.push(role);
    nodeHoverText.push(node.fullLabel || node.label);
    nodeColors.push(roleColor(role));
    nodeSizes.push(
      role === "Selected"
        ? Math.max(baseMarkerSize + 2, baseMarkerSize * 1.35)
        : baseMarkerSize,
    );
  });

  const nodeMode = (() => {
    const raw = String(nodeTemplate?.mode || "").trim();
    if (!raw) {
      return "markers+text";
    }
    if (raw.includes("text")) {
      return raw;
    }
    return `${raw}+text`;
  })();

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
    text: edgeText,
    customdata: undefined,
    hovertext: undefined,
    hoverinfo: "text",
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
    name: "",
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
      textfont: {
        size: GRAPH_NODE_TEXT_SIZE_DESKTOP,
        family: GRAPH_NODE_TEXT_FAMILY,
        color: "#1f2937",
      },
      hovertemplate: "%{text}<br>Role: %{customdata}<extra></extra>",
      name: "Stock Nodes",
      showlegend: false,
    }),
    mode: nodeMode,
    marker: {
      ...(nodeTemplate?.marker || {}),
      color: nodeColors,
      size: nodeSizes,
    },
    textposition: nodeTemplate?.textposition || "top center",
    x: nodeX,
    y: nodeY,
    z: nodeZ,
    text: nodeText,
    textfont: {
      ...(nodeTemplate?.textfont || {}),
      family: nodeTemplate?.textfont?.family || GRAPH_NODE_TEXT_FAMILY,
      color: nodeTemplate?.textfont?.color || "#1f2937",
      size: GRAPH_NODE_TEXT_SIZE_DESKTOP,
    },
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

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function scaleMarkerSize(size, factor, min, max) {
  if (Array.isArray(size)) {
    return size.map((value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return value;
      }
      return clampNumber(numeric * factor, min, max, numeric);
    });
  }

  const numeric = Number(size);
  if (!Number.isFinite(numeric)) {
    return size;
  }
  return clampNumber(numeric * factor, min, max, numeric);
}

function style3DTrace(trace, isMobileViewport) {
  if (!trace || trace.type !== "scatter3d") {
    return trace;
  }

  const mode = String(trace.mode || "");
  const baseHoverLabel = {
    ...(trace.hoverlabel || {}),
    bgcolor: trace.hoverlabel?.bgcolor || "rgba(15, 23, 42, 0.9)",
    bordercolor: trace.hoverlabel?.bordercolor || "#0f172a",
    font: {
      ...(trace.hoverlabel?.font || {}),
      color: trace.hoverlabel?.font?.color || "#f8fafc",
      size: clampNumber(
        trace.hoverlabel?.font?.size,
        10,
        13,
        isMobileViewport ? 11 : 12,
      ),
    },
  };

  if (mode.includes("markers")) {
    const marker = trace.marker || {};
    const markerLine = marker.line || {};
    const styledSize = scaleMarkerSize(
      marker.size,
      isMobileViewport ? 1.02 : 1.08,
      isMobileViewport ? 5 : 6,
      isMobileViewport ? 17 : 24,
    );

    return {
      ...trace,
      marker: {
        ...marker,
        size: styledSize,
        opacity: clampNumber(marker.opacity, 0.88, 1, 0.96),
        line: {
          ...markerLine,
          color: markerLine.color || "#e5edf6",
          width: clampNumber(markerLine.width, 0.8, 2.2, 1.1),
        },
      },
      textfont: {
        ...(trace.textfont || {}),
        family: trace.textfont?.family || GRAPH_NODE_TEXT_FAMILY,
        color: trace.textfont?.color || "#0f172a",
        size: isMobileViewport
          ? GRAPH_NODE_TEXT_SIZE_MOBILE
          : GRAPH_NODE_TEXT_SIZE_DESKTOP,
      },
      textposition: trace.textposition || "top center",
      hoverlabel: baseHoverLabel,
    };
  }

  if (mode.includes("lines")) {
    const line = trace.line || {};
    const baseWidth = clampNumber(line.width, 0.8, 8, 1.4);
    return {
      ...trace,
      line: {
        ...line,
        width: clampNumber(baseWidth * 1.1, 1, 8.5, 1.6),
      },
      opacity: clampNumber(trace.opacity, 0.2, 0.98, 0.76),
      hoverlabel: baseHoverLabel,
    };
  }

  return {
    ...trace,
    hoverlabel: baseHoverLabel,
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
    const { signal, cleanup } = createTimedRequestSignal(
      GRAPH_QUERY_TIMEOUT_MS,
    );

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
  const [searchStockQuery, setSearchStockQuery] = useState(
    DEFAULT_INITIAL_STOCK,
  );
  const [highlightHops, setHighlightHops] = useState(0);
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
      Object.keys(row).forEach((key) => {
        if (isFamilyRelatedHistoryColumn(key)) {
          return;
        }
        seen.add(key);
      });
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
    const pushStock = (key, stock) => {
      if (!key || !stock) {
        return;
      }

      const list = mapped.get(key);
      if (!list) {
        mapped.set(key, [stock]);
        return;
      }

      const duplicate = list.some(
        (item) =>
          String(item?.label || "") === String(stock?.label || "") &&
          String(item?.query || item?.label || "") ===
            String(stock?.query || stock?.label || ""),
      );
      if (!duplicate) {
        list.push(stock);
      }
    };

    stockSuggestions.forEach((stock) => {
      if (!stock) {
        return;
      }
      const keys = new Set([
        ...getCompanyMatchKeys(stock.label),
        ...getCompanyMatchKeys(stock.query || stock.label),
      ]);
      keys.forEach((key) => {
        pushStock(key, stock);
      });
    });
    return mapped;
  }, [stockSuggestions]);

  const scoreStockMatchForQuery = (stock, queryValue, matchedKey = "") => {
    if (!stock) {
      return -Infinity;
    }

    const queryRaw = String(queryValue || "").trim();
    const queryNormalized = normalizeCompanyName(queryRaw);
    const queryCompact = compactCompanyKey(queryNormalized || queryRaw);
    const queryAscii = compactAsciiKey(queryRaw);

    const sourceLabel = String(stock.label || "").trim();
    const sourceQuery = String(stock.query || sourceLabel).trim();
    const normalizedLabel = normalizeCompanyName(sourceLabel);
    const normalizedQuery = normalizeCompanyName(sourceQuery);
    const compactLabel = compactCompanyKey(normalizedLabel || sourceLabel);
    const compactQuery = compactCompanyKey(normalizedQuery || sourceQuery);
    const leadingLabelAscii = extractLeadingAsciiToken(sourceLabel);
    const leadingQueryAscii = extractLeadingAsciiToken(sourceQuery);

    let score = 0;

    if (queryNormalized && normalizedLabel === queryNormalized) {
      score += 260;
    }
    if (queryNormalized && normalizedQuery === queryNormalized) {
      score += 240;
    }
    if (queryCompact && compactLabel === queryCompact) {
      score += 220;
    }
    if (queryCompact && compactQuery === queryCompact) {
      score += 210;
    }

    const normalizedMatchedKey = compactCompanyKey(matchedKey);
    if (normalizedMatchedKey) {
      if (compactLabel === normalizedMatchedKey) {
        score += 45;
      }
      if (compactQuery === normalizedMatchedKey) {
        score += 40;
      }
    }

    if (queryAscii) {
      if (leadingLabelAscii && leadingLabelAscii === queryAscii) {
        score += 190;
      }
      if (leadingQueryAscii && leadingQueryAscii === queryAscii) {
        score += 180;
      }
      if (compactAsciiKey(sourceLabel).startsWith(queryAscii)) {
        score += 140;
      }
      if (compactAsciiKey(sourceQuery).startsWith(queryAscii)) {
        score += 130;
      }
      if (compactAsciiKey(sourceLabel).includes(queryAscii)) {
        score += 95;
      }
      if (compactAsciiKey(sourceQuery).includes(queryAscii)) {
        score += 90;
      }

      // Avoid mapping short latin queries (e.g. "SK") to Hangul-only phonetic names.
      if (
        queryAscii.length <= 3 &&
        !hasAsciiCharacters(sourceLabel) &&
        !hasAsciiCharacters(sourceQuery)
      ) {
        score -= 140;
      }
    }

    const similarity = Math.max(
      blendedCompanyNameSimilarity(queryCompact, compactLabel),
      blendedCompanyNameSimilarity(queryCompact, compactQuery),
    );
    score += similarity * 90;

    if (queryCompact && queryCompact.length <= 3) {
      const gap = Math.min(
        Math.abs(compactLabel.length - queryCompact.length),
        Math.abs(compactQuery.length - queryCompact.length),
      );
      score -= gap * 3;
    }

    return score;
  };

  const pickBestStockCandidate = (candidates, queryValue, matchedKey = "") => {
    if (!Array.isArray(candidates) || !candidates.length) {
      return null;
    }

    const ranked = candidates
      .map((stock) => ({
        stock,
        score: scoreStockMatchForQuery(stock, queryValue, matchedKey),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return String(a.stock?.label || "").localeCompare(
          String(b.stock?.label || ""),
          "ko",
        );
      });

    const best = ranked[0];
    if (!best || best.score <= 0) {
      return null;
    }

    const second = ranked[1];
    const asciiQuery = compactAsciiKey(queryValue);
    const isShortAscii = asciiQuery.length > 0 && asciiQuery.length <= 3;
    const minDelta = isShortAscii ? 18 : 8;
    const minBestScore = isShortAscii ? 150 : 90;
    if (
      second &&
      best.score - second.score < minDelta &&
      best.score < minBestScore
    ) {
      return null;
    }

    return best.stock;
  };

  const fuzzyStockCorpus = useMemo(() => {
    return stockSuggestions
      .map((stock) => {
        if (!stock) {
          return null;
        }

        const primaryLabelKey = compactCompanyKey(stock.label);
        const primaryQueryKey = compactCompanyKey(stock.query || stock.label);
        const primaryKeySet = new Set(
          [primaryLabelKey, primaryQueryKey].filter(Boolean),
        );
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
          .filter(
            (value) =>
              value && (value.length >= 3 || primaryKeySet.has(value)),
          );
        const uniqueVariants = Array.from(new Set(normalizedVariants));

        if (!uniqueVariants.length) {
          return null;
        }

        return {
          stock,
          variants: uniqueVariants,
        };
      })
      .filter(Boolean);
  }, [stockSuggestions]);

  const findMatchedStock = (value) => {
    const rawValue = String(value || "").trim();
    if (!rawValue) {
      return null;
    }

    const normalizedValue = normalizeCompanyName(rawValue);
    const normalizedValueKey = compactCompanyKey(normalizedValue || rawValue);
    const asciiValueKey = compactAsciiKey(rawValue);

    const keys = getCompanyMatchKeys(rawValue);
    for (const key of keys) {
      const matchedCandidates = stockSuggestionByKey.get(key);
      if (!matchedCandidates || !matchedCandidates.length) {
        continue;
      }

      const picked = pickBestStockCandidate(matchedCandidates, rawValue, key);
      if (picked) {
        return picked;
      }
    }

    // Short latin queries are high-collision. Resolve only from visible ASCII forms.
    if (asciiValueKey && asciiValueKey.length <= 3) {
      const shortAsciiCandidates = stockSuggestions.filter((stock) => {
        if (!stock) {
          return false;
        }
        const label = String(stock.label || "");
        const query = String(stock.query || stock.label || "");
        const leadingLabel = extractLeadingAsciiToken(label);
        const leadingQuery = extractLeadingAsciiToken(query);
        const compactLabel = compactAsciiKey(label);
        const compactQuery = compactAsciiKey(query);
        return (
          leadingLabel.startsWith(asciiValueKey) ||
          leadingQuery.startsWith(asciiValueKey) ||
          compactLabel.startsWith(asciiValueKey) ||
          compactQuery.startsWith(asciiValueKey)
        );
      });

      const pickedShortAscii = pickBestStockCandidate(
        shortAsciiCandidates,
        rawValue,
        asciiValueKey,
      );
      if (pickedShortAscii) {
        return pickedShortAscii;
      }

      return null;
    }

    const queryVariants = new Set([...keys, normalizedValue, rawValue]);
    const normalizedQueryVariants = Array.from(queryVariants)
      .map((item) => compactCompanyKey(item))
      .filter(
        (item) =>
          item && (item.length >= 3 || item === normalizedValueKey),
      );

    if (!normalizedQueryVariants.length || !fuzzyStockCorpus.length) {
      return null;
    }

    let bestStock = null;
    let bestScore = 0;

    fuzzyStockCorpus.forEach((entry) => {
      let localBest = 0;
      for (const queryVariant of normalizedQueryVariants) {
        for (const stockVariant of entry.variants) {
          const score = blendedCompanyNameSimilarity(
            queryVariant,
            stockVariant,
          );
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

    const normalizedQuery =
      String(query || normalizedLabel).trim() || normalizedLabel;
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
    if (
      resolvedSnapshotDate &&
      activeSnapshotDates.includes(resolvedSnapshotDate)
    ) {
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
        ? ((clampSliderUtcDay(day) - SNAPSHOT_SLIDER_MIN_DAY) /
            SNAPSHOT_SLIDER_DAY_SPAN) *
          100
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
    const convertedData =
      viewMode === "3d"
        ? normalizedData
        : normalizedData.map(convert3DTraceTo2D);
    const styledData =
      viewMode === "3d"
        ? convertedData.map((trace) => style3DTrace(trace, isMobileViewport))
        : convertedData;
    const desiredTextSize = isMobileViewport
      ? GRAPH_NODE_TEXT_SIZE_MOBILE
      : GRAPH_NODE_TEXT_SIZE_DESKTOP;
    return styledData.map((trace) => {
      const mode = String(trace?.mode || "");
      if (!mode.includes("text")) {
        return trace;
      }
      return {
        ...trace,
        textfont: {
          ...(trace?.textfont || {}),
          family: GRAPH_NODE_TEXT_FAMILY,
          size: desiredTextSize,
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
      ? typeof rawLayout.title === "string"
        ? {
            text: rawLayout.title,
            font: { size: 12 },
          }
        : rawLayout.title && typeof rawLayout.title === "object"
          ? {
              ...rawLayout.title,
              font: {
                ...(rawLayout.title.font || {}),
                size: Math.min(Number(rawLayout.title.font?.size) || 14, 12),
              },
            }
          : rawLayout.title
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
      font: {
        ...(rawLayout.font || {}),
        family: rawLayout.font?.family || GRAPH_NODE_TEXT_FAMILY,
        color: rawLayout.font?.color || "#1e293b",
      },
      hoverlabel: {
        ...(rawLayout.hoverlabel || {}),
        bgcolor: rawLayout.hoverlabel?.bgcolor || "rgba(15, 23, 42, 0.9)",
        bordercolor: rawLayout.hoverlabel?.bordercolor || "#0f172a",
        font: {
          ...(rawLayout.hoverlabel?.font || {}),
          color: rawLayout.hoverlabel?.font?.color || "#f8fafc",
          size: clampNumber(
            rawLayout.hoverlabel?.font?.size,
            10,
            13,
            isMobileViewport ? 11 : 12,
          ),
        },
      },
    };

    if (viewMode === "3d") {
      const scene = baseLayout.scene || {};
      const subtleGridAxisStyle = {
        visible: true,
        showbackground: true,
        backgroundcolor: "#ffffff",
        showgrid: true,
        gridcolor: "#d8e2ee",
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
        centerX = focusedPoint
          ? focusedPoint.x
          : (bounds.minX + bounds.maxX) / 2;
        centerY = focusedPoint
          ? focusedPoint.y
          : (bounds.minY + bounds.maxY) / 2;
        centerZ = focusedPoint
          ? focusedPoint.z
          : (bounds.minZ + bounds.maxZ) / 2;

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
            backgroundcolor: "#ffffff",
            range: [centerX - span, centerX + span],
          },
          yaxis: {
            ...(scene.yaxis || {}),
            ...subtleGridAxisStyle,
            backgroundcolor: "#ffffff",
            range: [centerY - span, centerY + span],
          },
          zaxis: {
            ...(scene.zaxis || {}),
            ...subtleGridAxisStyle,
            backgroundcolor: "#ffffff",
            range: [centerZ - span, centerZ + span],
          },
          aspectmode: "cube",
          aspectratio: {
            x: 1,
            y: 1,
            z: 0.9,
          },
          camera: {
            ...(scene.camera || {}),
            center: { x: 0, y: 0, z: 0 },
            eye: {
              x: Number(scene.camera?.eye?.x) * 1.05 || 1.28,
              y: Number(scene.camera?.eye?.y) * 1.05 || 1.28,
              z: Number(scene.camera?.eye?.z) * 1.05 || 1.06,
            },
            up: {
              x: 0,
              y: 0,
              z: 1,
            },
            projection: {
              ...(scene.camera?.projection || {}),
              type: "orthographic",
            },
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
  }, [
    figure.layout,
    isMobileViewport,
    plotData,
    searchStock,
    searchStockQuery,
    viewMode,
  ]);

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
      const effectiveStartDate =
        startDate && endDate && startDate > endDate ? endDate : startDate;
      const effectiveEndDate =
        startDate && endDate && endDate < startDate ? startDate : endDate;
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
        : resolveSnapshotDateForSelectedDate(
            snapshotDatesForQuery,
            requestedSliderDate,
          );

      const deriveReverseSearchCandidates = (selectedLabel) => {
        const selectedNormalized = normalizeCompanyName(selectedLabel);
        const selectedKey = toComparableCompanyKey(selectedNormalized);
        if (!selectedKey) {
          return [];
        }

        const candidates = new Map();
        const registerCandidate = (candidateLabel, candidateQuery = "") => {
          const normalized = normalizeCompanyName(
            candidateLabel || candidateQuery,
          );
          const key = toComparableCompanyKey(normalized);
          if (!key || key === selectedKey || candidates.has(key)) {
            return;
          }

          const mappedList = stockSuggestionByKey.get(key);
          const mapped = Array.isArray(mappedList) ? mappedList[0] : null;
          candidates.set(key, {
            label: mapped?.label || normalized,
            query: mapped?.query || candidateQuery || normalized,
          });
        };

        stockSuggestions.forEach((stock) => {
          const stockKey = toComparableCompanyKey(stock?.label);
          if (
            stockKey &&
            selectedKey.startsWith(stockKey) &&
            stockKey !== selectedKey
          ) {
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

      const requestedHopDepthRaw = Number(highlightHops ?? 0);
      const requestedHopDepth = Number.isFinite(requestedHopDepthRaw)
        ? Math.max(0, requestedHopDepthRaw)
        : 0;
      const reverseSearchCandidates =
        requestedHopDepth > 0 ? deriveReverseSearchCandidates(typedSearch) : [];
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
        Math.min(
          Number(historyLimit || DEFAULT_HISTORY_LIMIT),
          SYSTEM_MAX_HISTORY_LIMIT,
        ),
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
        setTopEdges(
          Array.isArray(topEdgesOverride)
            ? topEdgesOverride
            : extractTopEdges(data),
        );
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

      const buildCenterOnlyGraphOverride = (data, centerLabel) => {
        const centerNormalized = normalizeCompanyName(centerLabel);
        const centerKey = toComparableCompanyKey(centerNormalized);
        if (!centerKey) {
          return null;
        }

        const nodeMap = extractNodePointsFromFigureData(data?.figure?.data);
        const historyRows = extractHistoryRows(data);
        const normalizedTopEdges = extractNormalizedTopEdges(data?.top_edges);
        if (!nodeMap.size || !normalizedTopEdges.length) {
          return null;
        }

        const allCenterEdges = normalizedTopEdges.filter(
          (edge) => edge.srcKey === centerKey || edge.dstKey === centerKey,
        );
        if (!allCenterEdges.length) {
          return null;
        }

        const outboundCenterEdgeKeys = collectOutboundCenterEdgeKeysFromHistoryRows(
          historyRows,
          centerNormalized,
        );
        const centerEdges = allCenterEdges.filter(
          (edge) => !outboundCenterEdgeKeys.has(`${edge.srcKey}->${edge.dstKey}`),
        );
        const filteredOutboundCount = allCenterEdges.length - centerEdges.length;

        if (!centerEdges.length) {
          const centerDisplayLabel =
            centerNormalized || String(centerLabel || "").trim() || centerKey;
          const centerNode = nodeMap.get(centerKey) || {
            key: centerKey,
            label: centerDisplayLabel,
            fullLabel: centerDisplayLabel,
            x: 0,
            y: 0,
            z: 0,
          };
          const centerOnlyNodeMap = new Map([[centerKey, centerNode]]);
          const figureOverride = buildExpandedFigureFromEdgeMap(
            data.figure,
            centerOnlyNodeMap,
            new Map(),
            centerKey,
          );
          const statusSuffix =
            filteredOutboundCount > 0
              ? ` | Center focus: ${centerDisplayLabel} | Filtered outbound: ${filteredOutboundCount}`
              : ` | Center focus: ${centerDisplayLabel}`;

          return {
            figureOverride,
            topEdgesRows: [],
            statusOverride: `${data?.status_text || ""}${statusSuffix}`,
          };
        }

        const edgeMap = new Map();
        const connectedNodeKeys = new Set([centerKey]);
        centerEdges.forEach((edge) => {
          edgeMap.set(`${edge.srcKey}->${edge.dstKey}`, edge);
          connectedNodeKeys.add(edge.srcKey);
          connectedNodeKeys.add(edge.dstKey);
        });

        const focusedNodeMap = new Map();
        connectedNodeKeys.forEach((key) => {
          const node = nodeMap.get(key);
          if (node) {
            focusedNodeMap.set(key, node);
          }
        });

        const figureOverride = buildExpandedFigureFromEdgeMap(
          data.figure,
          focusedNodeMap.size ? focusedNodeMap : nodeMap,
          edgeMap,
          centerKey,
        );
        const topEdgesRows = centerEdges
          .slice()
          .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
          .slice(0, 20)
          .map((edge) => ({
            src: edge.srcLabel,
            dst: edge.dstLabel,
            weight: Number(edge.weight || 0),
          }));
        const statusSuffix =
          filteredOutboundCount > 0
            ? ` | Center focus: ${centerNormalized} | Filtered outbound: ${filteredOutboundCount}`
            : ` | Center focus: ${centerNormalized}`;

        return {
          figureOverride,
          topEdgesRows,
          statusOverride: `${data?.status_text || ""}${statusSuffix}`,
        };
      };

      const shouldUseClientHopExpansion =
        Boolean(searchStockForQuery) && effectiveHopDepth > 1;

      if (!shouldUseClientHopExpansion) {
        const data = await postGraphQuery(payload);
        const noEdges = Number(data?.edges_shown) <= 0;
        if (searchStockForQuery && noEdges) {
          const fallbackPayload = {
            ...payload,
            search_stock: null,
            history_limit: SYSTEM_MAX_HISTORY_LIMIT,
          };
          const buildFallbackResult = (candidateData, fallbackDate = "") => {
            const candidateGraph = buildFallbackGraphFromHistory({
              historyRows: extractHistoryRows(candidateData),
              searchLabel: resolvedSearchLabel || searchStockForQuery,
              baseFigure: candidateData.figure || data.figure,
              maxEdges: effectiveMaxEdges,
              historyLimit: effectiveHistoryLimit,
            });
            if (!candidateGraph) {
              return null;
            }

            const statusDate =
              String(fallbackDate || candidateData?.snapshot_date || "").trim();
            const statusSuffix = statusDate
              ? ` | Nearest snapshot: ${statusDate}`
              : "";

            return {
              data: candidateData,
              graph: candidateGraph,
              status: `${
                candidateData?.status_text || data?.status_text || ""
              } | Fallback links: ${candidateGraph.rootDisplayLabel}${statusSuffix}`,
            };
          };

          const fallbackData = await postGraphQuery(fallbackPayload);
          let fallbackResult = buildFallbackResult(
            fallbackData,
            fallbackData?.snapshot_date || effectiveSnapshotDate,
          );

          if (!fallbackResult) {
            const snapshotUniverse = normalizeSnapshotDateList(
              fallbackData?.snapshot_dates?.length
                ? fallbackData.snapshot_dates
                : snapshotDatesForQuery,
            );
            const anchorSnapshotDate =
              String(
                fallbackData?.snapshot_date ||
                  effectiveSnapshotDate ||
                  requestedSliderDate,
              ).trim() || requestedSliderDate;
            const nearbyCandidates = buildNearestSnapshotCandidates(
              snapshotUniverse,
              anchorSnapshotDate,
              24,
            ).filter((candidateDate) => candidateDate !== anchorSnapshotDate);

            for (const candidateDate of nearbyCandidates) {
              const candidateData = await postGraphQuery({
                ...fallbackPayload,
                snapshot_date: candidateDate,
              });
              fallbackResult = buildFallbackResult(candidateData, candidateDate);
              if (fallbackResult) {
                break;
              }
            }
          }

          if (fallbackResult) {
            const fallbackStockDates = stockSnapshotDates.length
              ? normalizeSnapshotDateList([
                  ...stockSnapshotDates,
                  fallbackResult.data?.snapshot_date,
                ])
              : normalizeSnapshotDateList(fallbackResult.data?.snapshot_dates);

            applyGraphStateAndTrack(
              {
                ...fallbackResult.data,
                investing_history: fallbackResult.graph.filteredHistoryRows,
              },
              fallbackResult.graph.figureOverride,
              fallbackResult.status,
              fallbackStockDates,
              fallbackResult.graph.topEdgesRows,
            );
            return;
          }
        }

        if (requestedHopDepth === 0 && searchStockForQuery) {
          const selectedForCoverage = resolvedSearchLabel || searchStockForQuery;
          const filteredHistoryRows = extractHistoryRows(data);
          const historyCounterpartyKeys =
            extractRelatedCounterpartyKeysFromHistoryRows(
              filteredHistoryRows,
              selectedForCoverage,
            );
          const topEdgeCounterpartyKeys = extractRelatedCounterpartyKeysFromTopEdges(
            extractTopEdges(data),
            selectedForCoverage,
          );

          let missingCounterpartyCount = 0;
          historyCounterpartyKeys.forEach((key) => {
            if (!topEdgeCounterpartyKeys.has(key)) {
              missingCounterpartyCount += 1;
            }
          });

          if (missingCounterpartyCount > 0) {
            const historyGraph = buildFallbackGraphFromHistory({
              historyRows: filteredHistoryRows,
              searchLabel: selectedForCoverage,
              baseFigure: data.figure,
              maxEdges: effectiveMaxEdges,
              historyLimit: effectiveHistoryLimit,
            });
            if (historyGraph) {
              const statusSuffix = ` | History graph supplement: +${missingCounterpartyCount} related nodes`;
              applyGraphStateAndTrack(
                data,
                historyGraph.figureOverride,
                `${data?.status_text || ""}${statusSuffix}`,
                stockSnapshotDates,
                historyGraph.topEdgesRows,
              );
              return;
            }
          }

          const centered = buildCenterOnlyGraphOverride(
            data,
            selectedForCoverage,
          );
          if (centered) {
            applyGraphStateAndTrack(
              data,
              centered.figureOverride,
              centered.statusOverride,
              stockSnapshotDates,
              centered.topEdgesRows,
            );
          } else {
            applyGraphStateAndTrack(data, null, "", stockSnapshotDates);
          }
        } else {
          applyGraphStateAndTrack(data, null, "", stockSnapshotDates);
        }
      } else {
        const resolveStockForHop = (label, queryHint = "") => {
          const normalizedLabel = normalizeCompanyName(label || queryHint);
          const matched =
            findMatchedStock(normalizedLabel) || findMatchedStock(queryHint);
          return {
            label:
              matched?.label ||
              normalizedLabel ||
              String(queryHint || "").trim(),
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

            const hopNodes = extractNodePointsFromFigureData(
              hopData.figure?.data,
            );
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
                  const endpoint = resolveStockForHop(
                    endpointLabel,
                    endpointLabel,
                  );
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

    const effectiveStartDate =
      startDate && endDate && startDate > endDate ? endDate : startDate;
    const effectiveEndDate =
      startDate && endDate && endDate < startDate ? startDate : endDate;

    try {
      const data = await fetchStockOptions(
        {
          start_date: effectiveStartDate || SNAPSHOT_RANGE_START,
          end_date: effectiveEndDate || SNAPSHOT_RANGE_END,
          include_periodic_status: Boolean(includePeriodicStatus),
          include_majorstock_status: Boolean(includeMajorstockStatus),
          q: undefined,
          limit: STOCK_OPTIONS_LIMIT,
        },
        controller.signal,
      );

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
    const clampedOffset = Math.max(
      0,
      Math.min(Math.round(offset), SNAPSHOT_SLIDER_DAY_SPAN),
    );
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
      if (
        toComparableCompanyKey(nextLabel) ===
        toComparableCompanyKey(searchStock)
      ) {
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
                    stockBlurTimerRef.current = setTimeout(
                      closeStockDropdown,
                      120,
                    );
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
                <div
                  className="investing-history-snapshot-markers"
                  aria-hidden="true"
                >
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
                As-Of Snapshot Date:{" "}
                {resolvedSnapshotDate || mappedSnapshotDate || "No snapshot"}
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
                onChange={(event) =>
                  setHighlightHops(Number(event.target.value))
                }
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
              <div
                className="investing-history-view-toggle"
                role="group"
                aria-label="Graph View Mode"
              >
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
                      const nextDate = clampToSliderDateRange(
                        event.target.value,
                      );
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
                      const nextDate = clampToSliderDateRange(
                        event.target.value,
                      );
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
                        onChange={(event) =>
                          setIncludePeriodicStatus(event.target.checked)
                        }
                      />
                      <span>Periodic</span>
                    </label>
                    <label className="investing-history-check-option advanced-check-option">
                      <input
                        type="checkbox"
                        checked={includeMajorstockStatus}
                        onChange={(event) =>
                          setIncludeMajorstockStatus(event.target.checked)
                        }
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
          {error ? (
            <div className="investing-history-error">{error}</div>
          ) : null}
          <div className="investing-history-snapshot-label">
            As-Of Snapshot Date:{" "}
            {resolvedSnapshotDate || mappedSnapshotDate || "None"}
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
                        {formatCellValue(row[column], column, row)}
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
            <div className="investing-history-empty">
              No top edges available.
            </div>
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
