import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/**
 * ===== Auth/API Config =====
 * CRA 기준: REACT_APP_*
 * - REACT_APP_API_BASE_URL=https://slayerzeroa.click
 * - REACT_APP_AUTH_CLIENT_KEY=서버 AUTH_CLIENT_KEY 값
 */
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "https://slayerzeroa.click";
const AUTH_CLIENT_KEY = process.env.REACT_APP_AUTH_CLIENT_KEY || "";
const RESPONSE_ENCRYPTION_KEY =
  process.env.REACT_APP_RESPONSE_ENCRYPTION_KEY || "";

console.log("API_BASE_URL:", API_BASE_URL);
// console.log("AUTH_CLIENT_KEY:", AUTH_CLIENT_KEY);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // refresh cookie 사용
  timeout: 15000,
});

let accessToken = null;
let issuePromise = null;
let refreshPromise = null;

function setAccessToken(token) {
  accessToken = token || null;
}

function base64ToBytes(base64) {
  const normalized = String(base64 || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function deriveAesGcmKey(passphrase) {
  const passBytes = new TextEncoder().encode(passphrase);
  const digest = await window.crypto.subtle.digest("SHA-256", passBytes);
  return window.crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

async function maybeDecryptPayload(payload) {
  if (!payload || payload.encrypted !== true) {
    return payload;
  }

  if (!RESPONSE_ENCRYPTION_KEY) {
    throw new Error(
      "REACT_APP_RESPONSE_ENCRYPTION_KEY is missing for encrypted API payload",
    );
  }

  if (!window?.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const iv = base64ToBytes(payload.iv);
  const tag = base64ToBytes(payload.tag);
  const ciphertext = base64ToBytes(payload.data);
  const encryptedWithTag = concatBytes(ciphertext, tag);

  const key = await deriveAesGcmKey(RESPONSE_ENCRYPTION_KEY);
  const plainBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    encryptedWithTag,
  );

  const plainText = new TextDecoder().decode(plainBuffer);
  return JSON.parse(plainText);
}

async function issueAccessToken() {
  if (!AUTH_CLIENT_KEY) {
    throw new Error(
      "REACT_APP_AUTH_CLIENT_KEY is missing. (프론트 env 설정 필요)",
    );
  }

  const res = await api.post(
    "/auth/token",
    {},
    {
      headers: {
        "X-Client-Key": AUTH_CLIENT_KEY,
      },
      skipAuth: true,
    },
  );

  const token = res?.data?.accessToken;
  if (!token) throw new Error("No access token from /auth/token");
  setAccessToken(token);
  return token;
}

async function refreshAccessToken() {
  const res = await api.post("/auth/refresh", {}, { skipAuth: true });
  const token = res?.data?.accessToken;
  if (!token) throw new Error("No access token from /auth/refresh");
  setAccessToken(token);
  return token;
}

async function getValidAccessToken() {
  if (accessToken) return accessToken;
  if (!issuePromise) {
    issuePromise = issueAccessToken().finally(() => {
      issuePromise = null;
    });
  }
  return issuePromise;
}

// 요청 인터셉터: access token 자동 부착
api.interceptors.request.use(async (config) => {
  if (config.skipAuth) return config;

  const token = await getValidAccessToken();
  config.headers = config.headers || {};
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 응답 인터셉터: 401이면 refresh 후 1회 재시도
api.interceptors.response.use(
  async (res) => {
    res.data = await maybeDecryptPayload(res.data);
    return res;
  },
  async (error) => {
    const original = error?.config || {};
    const status = error?.response?.status;

    if (!original || original.skipAuth) {
      return Promise.reject(error);
    }

    if (status === 401 && !original._retry) {
      original._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken()
            .catch(async () => {
              // refresh 실패 시 토큰 재발급 재시도
              setAccessToken(null);
              return issueAccessToken();
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        setAccessToken(null);
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  },
);

function Charts() {
  const [activeTab, setActiveTab] = useState("KOSPI"); // "KOSPI" | "KOSDAQ"

  const [kospiData, setKospiData] = useState([]);
  const [kosdaqData, setKosdaqData] = useState([]);

  const [errors, setErrors] = useState({
    kospi: null,
    kosdaq: null,
  });

  // KOSPI 라인 on/off
  const [showVKOSPI, setShowVKOSPI] = useState(true);
  const [showWVKOSPI, setShowWVKOSPI] = useState(true);
  const [showKOSPITrend, setShowKOSPITrend] = useState(true);

  // KOSDAQ 라인 on/off
  const [showVKOSDAQ, setShowVKOSDAQ] = useState(true);
  const [showWVKOSDAQ, setShowWVKOSDAQ] = useState(true);
  const [showKOSDAQTrend, setShowKOSDAQTrend] = useState(true);

  // 기간
  const [period, setPeriod] = useState("6M");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 화면/차트 반응형
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const chartWrapRef = useRef(null);
  const [chartHeight, setChartHeight] = useState(500);

  const isMobile = viewportWidth < 768;

  // ===== 공백(차트 위 여백) 조절값 =====
  const GAP_AFTER_FILTER = isMobile ? 24 : 32; // 기간 설정 아래 여백
  const GAP_BEFORE_CHART = isMobile ? 14 : 20; // 차트 래퍼 marginTop
  const CHART_INTERNAL_TOP = isMobile ? 18 : 26; // LineChart 내부 top margin

  const formatYYYYMMDD = (v) => {
    const s = String(v ?? "");
    if (s.length !== 8) return s;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  };

  const toDate = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00:00`);

  const n = (x) => {
    if (x === null || x === undefined || x === "") {
      return null;
    }
    const v = Number(x);
    return Number.isFinite(v) ? v : null;
  };

  const fillForwardValues = (rows, valueKeys) => {
    const prevByKey = {};

    return rows.map((row) => {
      const nextRow = { ...row };

      valueKeys.forEach((key) => {
        const current = nextRow[key];
        const hasCurrent = Number.isFinite(current);

        if (hasCurrent) {
          prevByKey[key] = current;
          return;
        }

        if (Object.prototype.hasOwnProperty.call(prevByKey, key)) {
          nextRow[key] = prevByKey[key];
        }
      });

      return nextRow;
    });
  };

  // 화면 크기 추적
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 차트 높이 자동 계산 (컨테이너 폭 기반)
  useEffect(() => {
    if (!chartWrapRef.current) return;

    const calcHeight = (w) => {
      let h;
      if (w < 420) h = w * 0.82;
      else if (w < 768) h = w * 0.68;
      else h = w * 0.5;

      h = Math.max(260, Math.min(560, h));
      setChartHeight(Math.round(h));
    };

    const el = chartWrapRef.current;
    calcHeight(el.clientWidth);

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) calcHeight(width);
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // 데이터 fetch (초기 1회)
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const mapKospiData = (rows) => {
      const normalized = (rows || [])
        .map((item) => ({
          DATE: formatYYYYMMDD(item.BAS_DD ?? item.DATE),
          VKOSPI: n(item.VKOSPI),
          WVKOSPI: n(item.WVKOSPI),
          KOSPI: n(item.KOSPI ?? item.kospi),
        }))
        .filter((d) => d.DATE && !Number.isNaN(toDate(d.DATE).getTime()))
        .sort((a, b) => a.DATE.localeCompare(b.DATE));
      return fillForwardValues(normalized, ["VKOSPI", "WVKOSPI", "KOSPI"]);
    };

    const mapKosdaqData = (rows) => {
      const normalized = (rows || [])
        .map((item) => ({
          DATE: formatYYYYMMDD(item.BAS_DD ?? item.DATE),
          VKOSDAQ: n(item.VKOSDAQ),
          WVKOSDAQ: n(item.WVKOSDAQ),
          KOSDAQ: n(item.KOSDAQ ?? item.kosdaq),
        }))
        .filter((d) => d.DATE && !Number.isNaN(toDate(d.DATE).getTime()))
        .sort((a, b) => a.DATE.localeCompare(b.DATE));
      return fillForwardValues(normalized, ["VKOSDAQ", "WVKOSDAQ", "KOSDAQ"]);
    };

    const hydrateDateRangeIfEmpty = (rows) => {
      if (!rows.length) {
        return;
      }
      setStartDate((prev) => prev || rows[0].DATE);
      setEndDate((prev) => prev || rows[rows.length - 1].DATE);
    };

    const fetchInitialData = async () => {
      try {
        await getValidAccessToken();
      } catch (authError) {
        if (!mounted) {
          return;
        }
        console.error("초기 토큰 발급 실패:", authError);
        setErrors({
          kospi: "인증 실패(토큰 발급 실패)",
          kosdaq: "인증 실패(토큰 발급 실패)",
        });
        return;
      }

      const [resKospi, resKosdaq] = await Promise.allSettled([
        api.get("/vkospi", {
          params: { limit: 1500 },
          signal: controller.signal,
        }),
        api.get("/vkosdaq", {
          params: { limit: 1500 },
          signal: controller.signal,
        }),
      ]);

      if (!mounted) {
        return;
      }

      let seedRows = [];

      if (resKospi.status === "fulfilled") {
        const rows = mapKospiData(resKospi.value.data);
        setKospiData(rows);
        setErrors((prev) => ({ ...prev, kospi: null }));
        if (!seedRows.length) {
          seedRows = rows;
        }
      } else if (resKospi.reason?.name !== "CanceledError") {
        console.error("KOSPI 데이터 오류:", resKospi.reason);
        setKospiData([]);
        setErrors((prev) => ({
          ...prev,
          kospi:
            resKospi.reason?.response?.status === 401
              ? "인증 오류(토큰 만료/재발급 실패)"
              : "VKOSPI API 호출 실패",
        }));
      }

      if (resKosdaq.status === "fulfilled") {
        const rows = mapKosdaqData(resKosdaq.value.data);
        setKosdaqData(rows);
        setErrors((prev) => ({ ...prev, kosdaq: null }));
        if (!seedRows.length) {
          seedRows = rows;
        }
      } else if (resKosdaq.reason?.name !== "CanceledError") {
        console.error("KOSDAQ 데이터 오류:", resKosdaq.reason);
        setKosdaqData([]);
        setErrors((prev) => ({
          ...prev,
          kosdaq:
            resKosdaq.reason?.response?.status === 401
              ? "인증 오류(토큰 만료/재발급 실패)"
              : "VKOSDAQ API 호출 실패",
        }));
      }

      if (seedRows.length) {
        hydrateDateRangeIfEmpty(seedRows);
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
      if (controller) controller.abort();
    };
  }, []);

  const activeData = activeTab === "KOSPI" ? kospiData : kosdaqData;
  const activeError = activeTab === "KOSPI" ? errors.kospi : errors.kosdaq;

  const filteredData = useMemo(() => {
    if (!activeData.length) return [];

    if (period === "CUSTOM") {
      if (!startDate || !endDate) return activeData;
      const s = toDate(startDate);
      const e = toDate(endDate);
      return activeData.filter((d) => {
        const t = toDate(d.DATE);
        return t >= s && t <= e;
      });
    }

    if (period === "ALL") return activeData;

    const lastDate = toDate(activeData[activeData.length - 1].DATE);
    const start = new Date(lastDate);

    if (period === "1M") start.setMonth(start.getMonth() - 1);
    if (period === "3M") start.setMonth(start.getMonth() - 3);
    if (period === "6M") start.setMonth(start.getMonth() - 6);
    if (period === "1Y") start.setFullYear(start.getFullYear() - 1);

    return activeData.filter((d) => {
      const t = toDate(d.DATE);
      return t >= start && t <= lastDate;
    });
  }, [activeData, period, startDate, endDate]);

  const tabBtnStyle = (active) => ({
    width: isMobile ? "100%" : "auto",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #cfd8dc",
    cursor: "pointer",
    background: active ? "#2c3e50" : "#fff",
    color: active ? "#fff" : "#2c3e50",
    fontSize: isMobile ? "12px" : "13px",
    fontWeight: 700,
    textAlign: "center",
  });

  const toggleBtnStyle = (active) => ({
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    color: "#fff",
    backgroundColor: active ? "#34495e" : "#95a5a6",
    fontSize: isMobile ? "12px" : "13px",
  });

  const periodBtnStyle = (active) => ({
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #cfd8dc",
    cursor: "pointer",
    background: active ? "#34495e" : "#fff",
    color: active ? "#fff" : "#2c3e50",
    fontSize: isMobile ? "11px" : "12px",
  });

  return (
    <div style={{ width: "100%", padding: isMobile ? "12px" : "16px" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          margin: "0 auto",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: isMobile ? "12px 10px 14px 10px" : "16px 18px 16px 18px",
          background: "#fff",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            margin: "0 0 12px 0",
            fontFamily: "'Noto Sans', sans-serif",
            fontWeight: 700,
            color: "#2c3e50",
            fontSize: isMobile ? "16px" : "18px",
            lineHeight: 1.25,
          }}
        >
          VOLATILITY DASHBOARD
        </h2>

        {/* 상단 그룹 탭 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, max-content)",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <button
            style={tabBtnStyle(activeTab === "KOSPI")}
            onClick={() => setActiveTab("KOSPI")}
          >
            KOSPI (VKOSPI / WVKOSPI)
          </button>
          <button
            style={tabBtnStyle(activeTab === "KOSDAQ")}
            onClick={() => setActiveTab("KOSDAQ")}
          >
            KOSDAQ (VKOSDAQ / WVKOSDAQ)
          </button>
        </div>

        {/* 탭별 에러 메시지 */}
        {activeError && (
          <div
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#fff4f4",
              color: "#b71c1c",
              fontSize: 13,
              border: "1px solid #ffcdd2",
            }}
          >
            {activeError}
          </div>
        )}

        {/* 라인 표시 토글 */}
        {activeTab === "KOSPI" ? (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setShowVKOSPI((v) => !v)}
              style={toggleBtnStyle(showVKOSPI)}
            >
              VKOSPI
            </button>
            <button
              onClick={() => setShowWVKOSPI((v) => !v)}
              style={toggleBtnStyle(showWVKOSPI)}
            >
              WVKOSPI
            </button>
            <button
              onClick={() => setShowKOSPITrend((v) => !v)}
              style={toggleBtnStyle(showKOSPITrend)}
            >
              KOSPI Trend
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setShowVKOSDAQ((v) => !v)}
              style={toggleBtnStyle(showVKOSDAQ)}
            >
              VKOSDAQ
            </button>
            <button
              onClick={() => setShowWVKOSDAQ((v) => !v)}
              style={toggleBtnStyle(showWVKOSDAQ)}
            >
              WVKOSDAQ
            </button>
            <button
              onClick={() => setShowKOSDAQTrend((v) => !v)}
              style={toggleBtnStyle(showKOSDAQTrend)}
            >
              KOSDAQ Trend
            </button>
          </div>
        )}

        {/* 기간 설정 */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: `${GAP_AFTER_FILTER}px`,
          }}
        >
          <span
            style={{
              fontSize: isMobile ? 12 : 13,
              color: "#2c3e50",
              minWidth: isMobile ? "100%" : 70,
            }}
          >
            기간
          </span>

          {["1M", "3M", "6M", "1Y", "ALL", "CUSTOM"].map((p) => (
            <button
              key={p}
              style={periodBtnStyle(period === p)}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}

          {period === "CUSTOM" && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: "4px 6px",
                  border: "1px solid #cfd8dc",
                  borderRadius: 6,
                  fontSize: isMobile ? 12 : 13,
                }}
              />
              <span style={{ fontSize: 12 }}>~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: "4px 6px",
                  border: "1px solid #cfd8dc",
                  borderRadius: 6,
                  fontSize: isMobile ? 12 : 13,
                }}
              />
            </>
          )}
        </div>

        {/* 차트 */}
        <div
          ref={chartWrapRef}
          style={{ width: "100%", marginTop: `${GAP_BEFORE_CHART}px` }}
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart
              data={filteredData}
              margin={{
                top: CHART_INTERNAL_TOP,
                right: isMobile ? 8 : 14,
                left: isMobile ? 0 : 6,
                bottom: 6,
              }}
            >
              <CartesianGrid stroke="#eee" />
              <XAxis
                dataKey="DATE"
                minTickGap={isMobile ? 16 : 24}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis
                yAxisId="left"
                domain={["auto", "auto"]}
                width={isMobile ? 42 : 58}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              {(activeTab === "KOSPI" || activeTab === "KOSDAQ") && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={["auto", "auto"]}
                  width={isMobile ? 44 : 60}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: "#94a3b8" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={{ stroke: "#cbd5e1" }}
                />
              )}
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: isMobile ? 11 : 12 }}
              />

              {activeTab === "KOSPI" && showVKOSPI && (
                <Line
                  type="monotone"
                  yAxisId="left"
                  dataKey="VKOSPI"
                  stroke="#2ca02c"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="VKOSPI"
                />
              )}
              {activeTab === "KOSPI" && showWVKOSPI && (
                <Line
                  type="monotone"
                  yAxisId="left"
                  dataKey="WVKOSPI"
                  stroke="#ff7f0e"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="WVKOSPI"
                />
              )}
              {activeTab === "KOSPI" && showKOSPITrend && (
                <Line
                  type="monotone"
                  yAxisId="right"
                  dataKey="KOSPI"
                  stroke="#64748b"
                  strokeOpacity={0.42}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  name="KOSPI (trend)"
                />
              )}

              {activeTab === "KOSDAQ" && showVKOSDAQ && (
                <Line
                  type="monotone"
                  yAxisId="left"
                  dataKey="VKOSDAQ"
                  stroke="#2ca02c"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="VKOSDAQ"
                />
              )}
              {activeTab === "KOSDAQ" && showWVKOSDAQ && (
                <Line
                  type="monotone"
                  yAxisId="left"
                  dataKey="WVKOSDAQ"
                  stroke="#ff7f0e"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="WVKOSDAQ"
                />
              )}
              {activeTab === "KOSDAQ" && showKOSDAQTrend && (
                <Line
                  type="monotone"
                  yAxisId="right"
                  dataKey="KOSDAQ"
                  stroke="#64748b"
                  strokeOpacity={0.42}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  name="KOSDAQ (trend)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Charts;
