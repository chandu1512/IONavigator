import React from "react";

export type AnalysisStatus = "Not Started" | "Running" | "Completed" | "Failed";

export type Trace = {
  id: string;
  trace_name: string;
  upload_date: string;
  trace_description?: string;
  model?: string;
  status: AnalysisStatus;
};

type Props = {
  traces: Trace[];
  availableModels: string[];
  analysisStatuses: Record<string, AnalysisStatus>;
  onAnalyze: (t: Trace) => Promise<void> | void; // 1) Start ▶︎
  onChat: (t: Trace) => void;                    // 2) Chat 💬
  onInspect: (t: Trace) => Promise<void> | void; // 3) Trace Analysis 🔍
  onDelete: (t: Trace) => Promise<void> | void;  // 4) Delete ✖︎
  onRename: (t: Trace, newName: string) => Promise<void> | void;
  onModelChange: (t: Trace, newModel: string) => Promise<void> | void;
};

const pill = (s: AnalysisStatus) => {
  const map: Record<AnalysisStatus, { bg: string; fg: string; label: string }> = {
    "Not Started": { bg: "#F1F5F9", fg: "#334155", label: "Not Started" },
    "Running": { bg: "#DBEAFE", fg: "#1D4ED8", label: "Running" },
    "Completed": { bg: "#DCFCE7", fg: "#166534", label: "Completed" },
    "Failed": { bg: "#FEE2E2", fg: "#991B1B", label: "Failed" },
  };
  const v = map[s] || map["Not Started"];
  return (
    <span style={{ background: v.bg, color: v.fg, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      {v.label}
    </span>
  );
};

const TraceTable: React.FC<Props> = ({
  traces,
  availableModels,
  analysisStatuses,
  onAnalyze,
  onChat,
  onInspect,
  onDelete,
  onRename,
  onModelChange,
}) => {
  const actionBtn: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 8,
    padding: "6px 8px",
    cursor: "pointer",
  };

  const row = (t: Trace, idx: number) => {
    const status = analysisStatuses[t.trace_name] || t.status;
    return (
      <tr key={t.id || idx}>
        <td style={{ width: "36%", fontWeight: 600 }}>
          <span
            title="Double-click to rename"
            onDoubleClick={() => {
              const name = prompt("Rename trace:", t.trace_name);
              if (name && name !== t.trace_name) onRename(t, name);
            }}
          >
            {t.trace_name}
          </span>
        </td>
        <td style={{ width: 140 }}>{t.upload_date}</td>
        <td style={{ width: 220 }}>
          <select
            value={t.model || availableModels[0]}
            onChange={(e) => onModelChange(t, e.target.value)}
            style={{ padding: 6, borderRadius: 8, border: "1px solid #e5e7eb", width: "100%" }}
          >
            {availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </td>
        <td style={{ width: 160 }}>{pill(status)}</td>

        {/* 👇 EXACT ORDER: Start ▶︎, Chat 💬, Trace Analysis 🔍, Delete ✖︎ */}
        <td style={{ width: 260, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {/* 1) Start */}
          <button
            style={actionBtn}
            title="Start analysis"
            aria-label="Start analysis"
            data-testid="action-start"
            onClick={() => onAnalyze(t)}
          >
            ▶︎
          </button>

          {/* 2) Chat (Analyze page) */}
          <button
            style={actionBtn}
            title="Open Chat (Analyze)"
            aria-label="Open Chat"
            data-testid="action-chat"
            onClick={() => onChat(t)}
          >
            💬
          </button>

          {/* 3) Trace Analysis (Inspect process graph) */}
          <button
            style={actionBtn}
            title="Inspect Trace Analysis (process graph)"
            aria-label="Inspect Trace Analysis"
            data-testid="action-inspect"
            onClick={() => onInspect(t)}
          >
            🔍
          </button>

          {/* 4) Delete */}
          <button
            style={{ ...actionBtn, borderColor: "#fecaca" }}
            title="Delete trace"
            aria-label="Delete trace"
            data-testid="action-delete"
            onClick={() => onDelete(t)}
          >
            ✖︎
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="trace-table">
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: "#0b4ea2", color: "#fff" }}>
            <th style={{ textAlign: "left", padding: "10px 12px", borderTopLeftRadius: 12 }}>
              Trace Name <span style={{ fontWeight: 400, fontSize: 12 }}>(double-click to edit)</span>
            </th>
            <th style={{ textAlign: "left", padding: "10px 12px" }}>Upload Date</th>
            <th style={{ textAlign: "left", padding: "10px 12px" }}>Model</th>
            <th style={{ textAlign: "left", padding: "10px 12px" }}>Status</th>
            <th style={{ textAlign: "right", padding: "10px 12px", borderTopRightRadius: 12 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {traces.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 18, textAlign: "center", color: "#475569" }}>
                No traces yet — use <strong>Upload New Trace</strong> to add one.
              </td>
            </tr>
          ) : (
            traces.map(row)
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TraceTable;
export type { Props };
