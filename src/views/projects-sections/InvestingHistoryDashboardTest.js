import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import "./InvestingHistoryDashboard.css";

const DEFAULT_INITIAL_STOCK = "삼성전자";
const DEFAULT_MAX_EDGES = 80;
const DEFAULT_DB_LIMIT = 2000;
const SNAPSHOT_MIN_DATE = "2000-01-01";
const SNAPSHOT_MAX_DATE = "2026-02-18";
const GRAPH_API_BASE_URL = (
  process.env.REACT_APP_GRAPH_API_BASE_URL || "https://api2.slayerzeroa.click"
).trim();
const DART_GRAPH_QUERY_ENDPOINT = (
  process.env.REACT_APP_DART_GRAPH_QUERY_ENDPOINT || "/api/dart/graph/query"
).trim();
const STOCK_LIST_ENDPOINT = (
  process.env.REACT_APP_DART_STOCK_LIST_ENDPOINT || "/api/stocks"
).trim();

function buildApiUrl(path) {
  if (!GRAPH_API_BASE_URL) {
    return path;
  }
  const base = GRAPH_API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function normalizeCompanyName(rawName) {
  if (rawName === null || rawName === undefined) {
    return "";
  }
  let normalized = String(rawName).trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  normalized = normalized.replace(/^(?:주식회사|㈜|\(주\))\s*/i, "");
  normalized = normalized.replace(
    /\s*(?:주식회사|㈜|\(주\)|co\.?\s*,?\s*ltd\.?|corp(?:oration)?\.?|inc(?:orporated)?\.?|ltd\.?|limited|l\.?l\.?c\.?|llc|plc|gmbh|ag|sa|nv|bv|holdings?|hldgs?|홀딩스|지주|보통주|우선주)\s*$/gi,
    "",
  );
  return normalized.trim();
}

function compactCompanyKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣]+/g, "");
}

function normalizeRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    return [];
  }
  return rawRows.filter((row) => row && typeof row === "object");
}

function extractTableRows(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const candidateKeys = [
    "investing_history",
    "investingHistory",
    "history",
    "rows",
    "table",
    "events",
    "edges",
    "state_daily_rows",
    "state_rows",
  ];
  for (const key of candidateKeys) {
    const rows = normalizeRows(payload[key]);
    if (rows.length) {
      return rows;
    }
  }
  return [];
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

function resolveSnapshotDate(snapshotDates, selectedDate) {
  const target = String(selectedDate || "").trim();
  if (!snapshotDates.length) {
    return target;
  }
  if (!target) {
    return snapshotDates[snapshotDates.length - 1];
  }
  let best = snapshotDates[0];
  for (const date of snapshotDates) {
    if (date <= target) {
      best = date;
      continue;
    }
    break;
  }
  return best;
}

function getRowValue(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return null;
}

function toNumber(value) {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return n;
  }
  return 0;
}

function buildGraphFromEdgeRows(edgeRows, rootLabel) {
  const normalizedRoot = normalizeCompanyName(rootLabel);
  const rootKey = compactCompanyKey(normalizedRoot);
  const edgeMap = new Map();
  const nodeMap = new Map();

  const ensureNode = (label) => {
    const normalized = normalizeCompanyName(label);
    if (!normalized) {
      return null;
    }
    const key = compactCompanyKey(normalized);
    if (!key) {
      return null;
    }
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        key,
        label: normalized,
        degree: 0,
      });
    }
    return nodeMap.get(key);
  };

  edgeRows.forEach((row) => {
    const srcRaw = getRowValue(row, [
      "src",
      "investor",
      "investor_name",
      "corp_name",
      "corp_nm",
    ]);
    const dstRaw = getRowValue(row, [
      "dst",
      "investee",
      "investee_name",
      "target_name",
      "target_name_norm",
      "name_canonical",
      "iscmp_cmpnm_norm",
      "iscmp_cmpnm_raw",
    ]);

    const srcNode = ensureNode(srcRaw);
    const dstNode = ensureNode(dstRaw);
    if (!srcNode || !dstNode || srcNode.key === dstNode.key) {
      return;
    }

    srcNode.degree += 1;
    dstNode.degree += 1;

    const edgeKey = `${srcNode.key}->${dstNode.key}`;
    const existing = edgeMap.get(edgeKey);
    const weight = Math.max(
      toNumber(getRowValue(row, ["weight", "relationship_strength", "holding_amount"])),
      Math.abs(toNumber(getRowValue(row, ["delta_amount", "planned_amount"]))),
    );

    if (!existing || weight > existing.weight) {
      edgeMap.set(edgeKey, {
        srcKey: srcNode.key,
        dstKey: dstNode.key,
        weight,
      });
    }
  });

  const nodes = Array.from(nodeMap.values());
  if (!nodes.length) {
    return { data: [], layout: {} };
  }

  const degreeSorted = nodes.slice().sort((a, b) => b.degree - a.degree);
  const selectedNode =
    nodes.find((node) => node.key === rootKey) ||
    degreeSorted[0];
  const selectedKey = selectedNode ? selectedNode.key : "";

  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.key, new Set()));
  edgeMap.forEach((edge) => {
    adjacency.get(edge.srcKey)?.add(edge.dstKey);
    adjacency.get(edge.dstKey)?.add(edge.srcKey);
  });

  const nodeByLevel = new Map();
  const visited = new Set();
  const queue = [];
  if (selectedKey) {
    queue.push([selectedKey, 0]);
    visited.add(selectedKey);
  }
  while (queue.length) {
    const [key, level] = queue.shift();
    if (!nodeByLevel.has(level)) {
      nodeByLevel.set(level, []);
    }
    nodeByLevel.get(level).push(key);
    const neighbors = Array.from(adjacency.get(key) || []);
    neighbors.forEach((nextKey) => {
      if (visited.has(nextKey)) {
        return;
      }
      visited.add(nextKey);
      queue.push([nextKey, level + 1]);
    });
  }

  const disconnected = nodes
    .map((node) => node.key)
    .filter((key) => !visited.has(key));
  if (disconnected.length) {
    const base = (Math.max(...Array.from(nodeByLevel.keys()), 0) || 0) + 1;
    nodeByLevel.set(base, disconnected);
  }

  const position = new Map();
  nodeByLevel.forEach((keys, level) => {
    if (level === 0 && keys.length === 1) {
      position.set(keys[0], { x: 0, y: 0, z: 0 });
      return;
    }
    const radius = 3 + level * 2.4;
    keys.forEach((key, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(keys.length, 1);
      const jitter = ((idx % 3) - 1) * 0.35;
      position.set(key, {
        x: Math.cos(angle) * radius + jitter,
        y: Math.sin(angle) * radius + jitter,
        z: level * 0.9,
      });
    });
  });

  const edgeX = [];
  const edgeY = [];
  const edgeZ = [];
  edgeMap.forEach((edge) => {
    const srcPos = position.get(edge.srcKey);
    const dstPos = position.get(edge.dstKey);
    if (!srcPos || !dstPos) {
      return;
    }
    edgeX.push(srcPos.x, dstPos.x, null);
    edgeY.push(srcPos.y, dstPos.y, null);
    edgeZ.push(srcPos.z, dstPos.z, null);
  });

  const nodeX = [];
  const nodeY = [];
  const nodeZ = [];
  const nodeText = [];
  const nodeColor = [];
  const nodeSize = [];

  nodes.forEach((node) => {
    const pos = position.get(node.key);
    if (!pos) {
      return;
    }
    nodeX.push(pos.x);
    nodeY.push(pos.y);
    nodeZ.push(pos.z);
    nodeText.push(node.label);
    nodeColor.push(node.key === selectedKey ? "#dc2626" : "#2563eb");
    nodeSize.push(node.key === selectedKey ? 15 : Math.max(8, 7 + Math.log10(node.degree + 1) * 4));
  });

  return {
    data: [
      {
        type: "scatter3d",
        mode: "lines",
        x: edgeX,
        y: edgeY,
        z: edgeZ,
        line: { width: 1.5, color: "#f87171" },
        hoverinfo: "none",
        showlegend: false,
      },
      {
        type: "scatter3d",
        mode: "markers+text",
        x: nodeX,
        y: nodeY,
        z: nodeZ,
        text: nodeText,
        textposition: "top center",
        textfont: { size: 12, color: "#334155" },
        marker: {
          size: nodeSize,
          color: nodeColor,
          line: { width: 1, color: "#1f2937" },
        },
        hovertemplate: "%{text}<extra></extra>",
        showlegend: false,
      },
    ],
    layout: {
      autosize: true,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      scene: {
        bgcolor: "#ffffff",
        xaxis: { showgrid: true, gridcolor: "#e2e8f0", showticklabels: false, title: "" },
        yaxis: { showgrid: true, gridcolor: "#e2e8f0", showticklabels: false, title: "" },
        zaxis: { showgrid: true, gridcolor: "#e2e8f0", showticklabels: false, title: "" },
        aspectmode: "cube",
      },
      margin: { l: 0, r: 0, t: 8, b: 0 },
    },
  };
}

function convert3DTraceTo2D(trace) {
  if (!trace || trace.type !== "scatter3d") {
    return trace;
  }
  const { z, ...rest } = trace;
  return { ...rest, type: "scatter" };
}

async function postGraphQuery(payload) {
  const primaryRes = await fetch(buildApiUrl(DART_GRAPH_QUERY_ENDPOINT), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (primaryRes.ok) {
    return primaryRes.json();
  }

  const fallbackRes = await fetch(buildApiUrl("/api/graph/query"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!fallbackRes.ok) {
    const txt = await fallbackRes.text();
    throw new Error(txt || `HTTP ${fallbackRes.status}`);
  }

  return fallbackRes.json();
}

async function fetchStockOptions(startDate, endDate, limit) {
  const query = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    limit: String(limit),
  });

  const res = await fetch(buildApiUrl(`${STOCK_LIST_ENDPOINT}?${query.toString()}`));
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const stocks = Array.isArray(data.stocks) ? data.stocks : [];
  const unique = new Map();
  stocks.forEach((stock) => {
    const label = normalizeCompanyName(stock);
    const key = compactCompanyKey(label);
    if (!key || unique.has(key)) {
      return;
    }
    unique.set(key, { label, query: String(stock || "").trim() || label });
  });
  return Array.from(unique.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "ko"),
  );
}

function InvestingHistoryDashboardTest() {
  const [searchStock, setSearchStock] = useState(DEFAULT_INITIAL_STOCK);
  const [searchStockQuery, setSearchStockQuery] = useState(DEFAULT_INITIAL_STOCK);
  const [snapshotDate, setSnapshotDate] = useState(SNAPSHOT_MAX_DATE);
  const [resolvedSnapshotDate, setResolvedSnapshotDate] = useState("");
  const [snapshotDates, setSnapshotDates] = useState([]);
  const [maxEdges, setMaxEdges] = useState(DEFAULT_MAX_EDGES);
  const [dbLimit, setDbLimit] = useState(DEFAULT_DB_LIMIT);
  const [viewMode, setViewMode] = useState("3d");

  const [allStocks, setAllStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [figure, setFigure] = useState({ data: [], layout: {} });

  const historyColumns = useMemo(() => {
    if (!historyRows.length) {
      return [];
    }
    const keys = new Set();
    historyRows.forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [historyRows]);

  const plotData = useMemo(() => {
    const base = Array.isArray(figure.data) ? figure.data : [];
    if (viewMode === "3d") {
      return base;
    }
    return base.map(convert3DTraceTo2D);
  }, [figure.data, viewMode]);

  const plotLayout = useMemo(() => {
    const baseLayout = {
      ...(figure.layout || {}),
      autosize: true,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
    };
    if (viewMode === "3d") {
      return {
        ...baseLayout,
        scene: {
          ...(baseLayout.scene || {}),
          dragmode: "orbit",
          xaxis: {
            ...(baseLayout.scene?.xaxis || {}),
            showticklabels: false,
            title: { text: "" },
          },
          yaxis: {
            ...(baseLayout.scene?.yaxis || {}),
            showticklabels: false,
            title: { text: "" },
          },
          zaxis: {
            ...(baseLayout.scene?.zaxis || {}),
            showticklabels: false,
            title: { text: "" },
          },
        },
      };
    }
    const { scene, ...rest } = baseLayout;
    return {
      ...rest,
      dragmode: "pan",
      xaxis: {
        ...(rest.xaxis || {}),
        visible: false,
        showgrid: false,
        zeroline: false,
      },
      yaxis: {
        ...(rest.yaxis || {}),
        visible: false,
        showgrid: false,
        zeroline: false,
        scaleanchor: "x",
        scaleratio: 1,
      },
    };
  }, [figure.layout, viewMode]);

  const loadGraph = async () => {
    setLoading(true);
    setError("");
    try {
      const effectiveSnapshotDate = resolveSnapshotDate(snapshotDates, snapshotDate) || snapshotDate;
      const payload = {
        graph_source: "dart_schema_v2",
        use_tables: {
          event_source: "dart_edge_events",
          daily_snapshot: "dart_edge_state_daily",
          current_snapshot: "dart_edge_state_current",
          investee_dim: "dart_investee_dim",
          disclosures: "dart_disclosures_raw",
          disclosure_lines: "dart_investment_lines_raw",
          families: "dart_disclosure_families",
          family_members: "dart_disclosure_family_members",
        },
        root_corp_name: searchStockQuery || searchStock || null,
        as_of_date: effectiveSnapshotDate || null,
        start_date: SNAPSHOT_MIN_DATE,
        end_date: SNAPSHOT_MAX_DATE,
        snapshot_date: effectiveSnapshotDate || null,
        search_stock: searchStockQuery || searchStock || null,
        highlight_hops: 1,
        max_edges: Math.max(1, Number(maxEdges) || DEFAULT_MAX_EDGES),
        db_limit: Math.max(1, Number(dbLimit) || DEFAULT_DB_LIMIT),
        include_inbound_to_root: true,
        include_outbound_from_root: true,
      };

      const data = await postGraphQuery(payload);
      const rows = extractTableRows(data);
      const datesFromServer = normalizeSnapshotDateList(data.snapshot_dates);
      const datesFromRows = normalizeSnapshotDateList(
        rows.map((row) =>
          String(
            row.as_of_date ||
              row.effective_dt ||
              row.rcept_dt ||
              "",
          ).slice(0, 10),
        ),
      );
      const mergedDates = normalizeSnapshotDateList(
        datesFromServer.concat(datesFromRows),
      );

      const finalSnapshotDate =
        data.snapshot_date ||
        resolveSnapshotDate(mergedDates, effectiveSnapshotDate) ||
        effectiveSnapshotDate;

      setSnapshotDates(mergedDates);
      setResolvedSnapshotDate(finalSnapshotDate || "");
      setStatusText(
        data.status_text ||
          `Rows: ${rows.length} | As-Of: ${finalSnapshotDate || "-"}`,
      );
      setHistoryRows(rows);

      if (data.figure && Array.isArray(data.figure.data) && data.figure.data.length) {
        setFigure({
          data: data.figure.data,
          layout: data.figure.layout || {},
        });
      } else {
        const figureFromRows = buildGraphFromEdgeRows(rows, searchStock);
        setFigure(figureFromRows);
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to load test graph.");
      setHistoryRows([]);
      setFigure({ data: [], layout: {} });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stocks = await fetchStockOptions(SNAPSHOT_MIN_DATE, SNAPSHOT_MAX_DATE, 100000);
        setAllStocks(stocks);
      } catch (_error) {
        setAllStocks([]);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="investing-history-dashboard-section">
      <div className="investing-history-dashboard-card">
        <h2 className="investing-history-dashboard-title">
          INVESTING HISTORY DASHBOARD (TABLE-BASED TEST)
        </h2>

        <div className="investing-history-controls">
          <div className="investing-history-control-row full-row">
            <label className="investing-history-control-label full-width">
              Search / Stock List
              <input
                list="investing-history-test-stock-options"
                value={searchStock}
                onChange={(event) => {
                  setSearchStock(event.target.value);
                  setSearchStockQuery(event.target.value);
                }}
                placeholder="종목 검색 또는 리스트에서 선택"
                autoComplete="off"
              />
              <datalist id="investing-history-test-stock-options">
                {allStocks.map((stock) => (
                  <option key={stock.label} value={stock.label} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="investing-history-control-row full-row options-row">
            <label className="investing-history-control-label">
              Snapshot Date
              <input
                type="date"
                value={snapshotDate}
                min={SNAPSHOT_MIN_DATE}
                max={SNAPSHOT_MAX_DATE}
                onChange={(event) => setSnapshotDate(event.target.value)}
              />
            </label>
            <label className="investing-history-control-label max-edges-control">
              Max Edges
              <input
                type="number"
                min={1}
                max={500}
                value={maxEdges}
                onChange={(event) => setMaxEdges(Number(event.target.value || DEFAULT_MAX_EDGES))}
              />
            </label>
            <label className="investing-history-control-label db-limit-control">
              DB Limit
              <input
                type="number"
                min={1}
                value={dbLimit}
                onChange={(event) => setDbLimit(Number(event.target.value || DEFAULT_DB_LIMIT))}
              />
            </label>
            <label className="investing-history-control-label view-mode-control">
              <span className="investing-history-control-hint">Graph View Mode</span>
              <div className="investing-history-view-toggle">
                <button
                  type="button"
                  className={`investing-history-view-button ${viewMode === "3d" ? "active" : ""}`}
                  aria-pressed={viewMode === "3d"}
                  onClick={() => setViewMode("3d")}
                >
                  3D
                </button>
                <button
                  type="button"
                  className={`investing-history-view-button ${viewMode === "2d" ? "active" : ""}`}
                  aria-pressed={viewMode === "2d"}
                  onClick={() => setViewMode("2d")}
                >
                  2D
                </button>
              </div>
            </label>
            <div className="investing-history-inline-actions">
              <button
                onClick={() => {
                  setSearchStock("");
                  setSearchStockQuery("");
                }}
                disabled={!searchStock || loading}
                type="button"
              >
                Clear Search
              </button>
              <button onClick={loadGraph} disabled={loading} type="button">
                Apply Search
              </button>
            </div>
          </div>
        </div>

        <div className="investing-history-status">
          {loading ? "Loading..." : statusText}
          {error ? <div className="investing-history-error">{error}</div> : null}
          <div className="investing-history-snapshot-label">
            Selected Snapshot: {snapshotDate || "None"} | Resolved Snapshot: {resolvedSnapshotDate || "None"}
          </div>
          <div className="investing-history-snapshot-label">
            Root Stock: {searchStock || "None"} | Source Tables: dart_edge_events / dart_edge_state_daily
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
                  <tr key={`ihd-test-row-${rowIndex}`}>
                    {historyColumns.map((column) => (
                      <td key={`${column}-${rowIndex}`}>{String(row[column] ?? "-")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="investing-history-empty">
              No rows were returned for this test query.
            </div>
          )}
        </div>

        {Array.isArray(plotData) && plotData.length > 0 ? (
          <div className="investing-history-plot-wrap">
            <Plot
              data={plotData}
              layout={plotLayout}
              config={{ responsive: true, displaylogo: false, scrollZoom: true }}
              useResizeHandler
              style={{ width: "100%", height: "620px" }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default InvestingHistoryDashboardTest;
