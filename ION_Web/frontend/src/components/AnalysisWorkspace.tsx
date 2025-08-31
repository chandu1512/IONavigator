import React, { useEffect, useMemo, useState } from "react";
import { checkAnalysisStatus, fetchOriginalTrace, startAnalysis } from "../API/requests";
import { Trace as ApiTrace } from "../interface/interfaces";
import ChatAgent from "./ChatAgent";

type Props = {
    userId: string;
    trace: ApiTrace;
    onBack: () => void;
};

type Status = "idle" | "pending" | "running" | "completed" | "failed";

const AnalysisWorkspace: React.FC<Props> = ({ userId, trace, onBack }) => {
    const [originalTrace, setOriginalTrace] = useState<string>("");
    const [status, setStatus] = useState<Status>("idle");
    const [progress, setProgress] = useState<number>(0);

    // load raw trace preview
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const txt = await fetchOriginalTrace(trace.trace_name, userId);
                if (alive) setOriginalTrace(txt || "(no preview available)");
            } catch {
                if (alive) setOriginalTrace("(failed to load preview)");
            }
        })();
        return () => { alive = false; };
    }, [trace.trace_name, userId]);

    const run = async () => {
        try {
            setStatus("pending");
            setProgress(0);
            const model = trace.model || "gpt-4o";
            const taskId = await startAnalysis(trace.trace_name, userId, model);

            const poll = async () => {
                try {
                    const s = await checkAnalysisStatus(taskId);
                    setStatus((s.status as Status) || "running");
                    setProgress(s.progress ?? 0);
                    if (s.status === "running" || s.status === "pending") {
                        setTimeout(poll, 1100);
                    }
                } catch {
                    setStatus("failed");
                }
            };
            poll();
        } catch {
            setStatus("failed");
        }
    };

    const pill = useMemo(() => {
        const map: Record<Status, { bg: string; fg: string; label: string }> = {
            idle: { bg: "#F1F5F9", fg: "#334155", label: "IDLE" },
            pending: { bg: "#FEF9C3", fg: "#854D0E", label: "PENDING" },
            running: { bg: "#DBEAFE", fg: "#1D4ED8", label: "RUNNING" },
            completed: { bg: "#DCFCE7", fg: "#166534", label: "COMPLETED" },
            failed: { bg: "#FEE2E2", fg: "#991B1B", label: "FAILED" },
        };
        return map[status];
    }, [status]);

    const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 };
    const sectionHead: React.CSSProperties = { background: "#0b4ea2", color: "#fff", padding: "10px 12px", borderRadius: 8, fontWeight: 700, marginBottom: 10 };

    return (
        <div>
            {/* ONLY this back button */}
            <button className="pager-btn" onClick={onBack} style={{ marginBottom: 12 }}>
                ← Back to Traces
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {/* Left: trace + analysis */}
                <div>
                    <div style={sectionHead}>HPC I/O Navigator</div>

                    <div style={{ ...card, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Original Trace</div>
                        <div
                            style={{
                                whiteSpace: "pre-wrap",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                fontSize: 12.5,
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 8,
                                padding: 10,
                                maxHeight: "48vh",
                                overflow: "auto",
                            }}
                        >
                            {originalTrace || "Loading…"}
                        </div>
                    </div>

                    <div style={card}>
                        <div style={{ fontWeight: 700, marginBottom: 10 }}>Analysis</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span
                                style={{
                                    background: pill.bg,
                                    color: pill.fg,
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    fontWeight: 700,
                                    fontSize: 12,
                                }}
                            >
                                {pill.label}
                            </span>
                            <span style={{ fontSize: 12, color: "#475569" }}>PROGRESS</span>
                            <div style={{ flex: 1, height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ width: `${progress}%`, height: "100%", background: "#1d4ed8" }} />
                            </div>
                            <span style={{ width: 40, textAlign: "right", fontSize: 12 }}>{progress}%</span>
                        </div>
                        <button className="pager-btn" onClick={run}>Run Analysis</button>
                    </div>
                </div>

                {/* Right: chat */}
                <div>
                    <div style={sectionHead}>Chat</div>
                    <div style={card}>
                        <ChatAgent userId={userId} traceName={trace.trace_name} originalTrace={originalTrace} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisWorkspace;
