import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import "./InvestingHistoryDashboard.css";

const SYSTEM_MAX_EDGES = 50;
const STOCK_OPTIONS_LIMIT = 500;
const GRAPH_API_BASE_URL = (
  process.env.REACT_APP_GRAPH_API_BASE_URL || "https://api2.slayerzeroa.click"
).trim();

const HISTORY_KEYS = [
  "investing_history",
  "investingHistory",
  "history",
  "table",
  "rows",
];

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildApiUrl(path) {
  if (!GRAPH_API_BASE_URL) {
    return path;
  }
  const base = GRAPH_API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
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

function formatCellValue(value) {
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
  return String(value);
}

async function postGraphQuery(payload) {
  const res = await fetch(buildApiUrl("/api/graph/query"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchStockOptions(params) {
  const usp = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}` !== "") {
      usp.append(key, `${value}`);
    }
  });

  const res = await fetch(buildApiUrl(`/api/stocks?${usp.toString()}`));

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }

  return res.json();
}

function InvestingHistoryDashboard() {
  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState(todayIso());
  const [searchStock, setSearchStock] = useState("");
  const [highlightHops, setHighlightHops] = useState(1);
  const [maxEdges, setMaxEdges] = useState(SYSTEM_MAX_EDGES);
  const [dbLimit, setDbLimit] = useState("");

  const [snapshotDates, setSnapshotDates] = useState([]);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [figure, setFigure] = useState({ data: [], layout: {} });

  const [historyRows, setHistoryRows] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stocks, setStocks] = useState([]);

  const snapshotDate = useMemo(() => {
    if (!snapshotDates.length) {
      return null;
    }
    const idx = Math.max(0, Math.min(snapshotIndex, snapshotDates.length - 1));
    return snapshotDates[idx];
  }, [snapshotDates, snapshotIndex]);

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

  const loadGraph = async (options = {}) => {
    setLoading(true);
    setError("");

    try {
      const payload = {
        start_date: startDate,
        end_date: endDate,
        snapshot_date: options.snapshotDate ?? snapshotDate,
        search_stock: searchStock || null,
        highlight_hops: highlightHops,
        max_edges: Math.max(
          1,
          Math.min(Number(maxEdges || SYSTEM_MAX_EDGES), SYSTEM_MAX_EDGES),
        ),
        db_limit: dbLimit ? Number(dbLimit) : null,
      };

      const data = await postGraphQuery(payload);
      setFigure(data.figure || { data: [], layout: {} });
      setHistoryRows(extractHistoryRows(data));
      setStatusText(data.status_text || "");

      const dates = Array.isArray(data.snapshot_dates) ? data.snapshot_dates : [];
      setSnapshotDates(dates);

      if (dates.length) {
        const idx = dates.indexOf(data.snapshot_date);
        setSnapshotIndex(idx >= 0 ? idx : dates.length - 1);
      } else {
        setSnapshotIndex(0);
      }
    } catch (loadError) {
      setError(loadError.message || "Graph query failed.");
      setHistoryRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStocks = async (query) => {
    try {
      const data = await fetchStockOptions({
        start_date: startDate,
        end_date: endDate,
        q: query || undefined,
        limit: STOCK_OPTIONS_LIMIT,
      });
      setStocks(data.stocks || []);
    } catch (_loadError) {
      setStocks([]);
    }
  };

  useEffect(() => {
    loadGraph({ snapshotDate: null });
    loadStocks("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadStocks(searchStock);
    }, 250);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStock, startDate, endDate]);

  const onRefresh = async () => {
    await loadGraph();
  };

  const onRangeReload = async () => {
    await loadGraph({ snapshotDate: null });
    await loadStocks(searchStock);
  };

  const onSnapshotChange = (nextIndex) => {
    setSnapshotIndex(Number(nextIndex));
  };

  const onSnapshotCommit = async () => {
    if (!snapshotDates.length) {
      return;
    }
    const idx = Math.max(0, Math.min(snapshotIndex, snapshotDates.length - 1));
    await loadGraph({ snapshotDate: snapshotDates[idx] });
  };

  return (
    <div className="investing-history-dashboard-section">
      <div className="investing-history-dashboard-card">
        <h2 className="investing-history-dashboard-title">
          INVESTING HISTORY DASHBOARD
        </h2>

        <div className="investing-history-controls">
          <div className="investing-history-control-row">
            <label className="investing-history-control-label">
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="investing-history-control-label">
              End Date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label className="investing-history-control-label">
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
            <label className="investing-history-control-label">
              DB Limit
              <input
                type="number"
                min={1}
                placeholder="optional"
                value={dbLimit}
                onChange={(event) => setDbLimit(event.target.value)}
              />
            </label>
            <button onClick={onRangeReload} disabled={loading} type="button">
              Reload Range
            </button>
          </div>

          <div className="investing-history-control-row">
            <label className="investing-history-control-label grow">
              Search Stock
              <input
                list="investing-history-stock-options"
                value={searchStock}
                onChange={(event) => setSearchStock(event.target.value)}
                placeholder="회사명을 입력하세요"
              />
              <datalist id="investing-history-stock-options">
                {stocks.map((stock) => (
                  <option key={stock} value={stock} />
                ))}
              </datalist>
            </label>
            <label className="investing-history-control-label">
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
            <button onClick={onRefresh} disabled={loading} type="button">
              Apply Search
            </button>
          </div>

          <div className="investing-history-control-row">
            <label className="investing-history-control-label grow">
              Snapshot Navigator
              <input
                type="range"
                min={0}
                max={Math.max(snapshotDates.length - 1, 0)}
                step={1}
                value={Math.min(snapshotIndex, Math.max(snapshotDates.length - 1, 0))}
                onChange={(event) => onSnapshotChange(event.target.value)}
                onMouseUp={onSnapshotCommit}
                onTouchEnd={onSnapshotCommit}
                onKeyUp={onSnapshotCommit}
                disabled={!snapshotDates.length || loading}
              />
              <div className="investing-history-snapshot-label">
                {snapshotDate ? `As-Of Snapshot Date: ${snapshotDate}` : "No snapshot"}
              </div>
            </label>
          </div>
        </div>

        <div className="investing-history-status">
          {loading ? "Loading..." : statusText}
          {error ? <div className="investing-history-error">{error}</div> : null}
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
                        {formatCellValue(row[column])}
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

        {Array.isArray(figure.data) && figure.data.length > 0 ? (
          <div className="investing-history-plot-wrap">
            <Plot
              data={figure.data || []}
              layout={{
                ...(figure.layout || {}),
                autosize: true,
              }}
              config={{ responsive: true, displaylogo: false }}
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
