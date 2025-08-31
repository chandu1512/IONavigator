import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    fetchUserTraces,
    deleteTrace,
    startAnalysis,
    checkAnalysisStatus,
    fetchDiagnosisTree,
    uploadTrace,
    uploadTraceBatch,
    renameTrace as apiRename,
    updateTraceModel as apiUpdateModel,
} from "../API/requests";

import DiagnosisTree from "../components/DiagnosisTree";
import TopBanner from "../components/TopBanner";
import TraceTable, { Trace as TableTrace, AnalysisStatus as TableStatus } from "../components/TraceTable";
import { Trace as ApiTrace } from "../interface/interfaces";
import { useUser } from "../contexts/UserContext";
import AnalysisWorkspace from "../components/AnalysisWorkspace";
import "../styles/HomePage.css";

const PAGE_SIZE = 10;

const HomePage: React.FC = () => {
    const { userId, email, logout } = useUser();

    // Single “detail” page with tabs to avoid confusion
    const [view, setView] = useState<"list" | "detail">("list");
    const [detailTab, setDetailTab] = useState<"analyze" | "inspect">("analyze");

    const [userTraces, setUserTraces] = useState<ApiTrace[]>([]);
    const [selectedTrace, setSelectedTrace] = useState<ApiTrace | null>(null);
    const [treeData, setTreeData] = useState<any>(null);
    const [uploading, setUploading] = useState(false);

    const [analysisStatuses, setAnalysisStatuses] = useState<
        Record<string, { taskId: string; status: string; progress: number }>
    >({});

    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const availableModels = useMemo(
        () => [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
            "anthropic/claude-3-5-sonnet-20240620",
            "anthropic/claude-3-7-sonnet-20250219",
        ],
        []
    );

    const loadUserTraces = useCallback(async (uid: string) => {
        try {
            const data = await fetchUserTraces(uid);
            setUserTraces(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to load user traces:", err);
            setUserTraces([]);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;
        (async () => { await loadUserTraces(userId); })();
    }, [userId, loadUserTraces]);

    const tableTraces: TableTrace[] = useMemo(
        () =>
            (userTraces || []).map((t, i) => ({
                id: (t as any).id ?? t.trace_name ?? String(i),
                trace_name: t.trace_name,
                upload_date: t.upload_date ?? new Date().toLocaleDateString(),
                trace_description: t.trace_description ?? "",
                model: (t as any).model,
                status: "Not Started" as TableStatus,
            })),
        [userTraces]
    );

    const formattedStatuses: Record<string, TableStatus> = useMemo(() => {
        const conv = (s: string): TableStatus => {
            if (s === "pending" || s === "running") return "Running";
            if (s === "completed") return "Completed";
            if (s === "failed" || s === "stopped") return "Failed";
            return "Not Started";
        };
        return Object.fromEntries(Object.entries(analysisStatuses).map(([k, v]) => [k, conv(v.status)])) as Record<
            string,
            TableStatus
        >;
    }, [analysisStatuses]);

    const onFileSelected = async (file: File) => {
        if (!userId) return;
        try {
            setUploading(true);
            await uploadTrace(file, userId);
            await loadUserTraces(userId);
        } catch {
            alert("Failed to upload file.");
        } finally {
            setUploading(false);
        }
    };

    const onBatchSelected = async (files: FileList) => {
        if (!userId) return;
        try {
            setUploading(true);
            await uploadTraceBatch(files, userId);
            await loadUserTraces(userId);
        } catch {
            alert("Batch upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const pollAnalysisStatus = async (traceName: string, taskId: string) => {
        try {
            const status = await checkAnalysisStatus(taskId);
            setAnalysisStatuses((prev) => ({
                ...prev,
                [traceName]: { taskId, status: status.status, progress: status.progress },
            }));
            if (status.status === "running" || status.status === "pending") {
                setTimeout(() => pollAnalysisStatus(traceName, taskId), 2000);
            } else if (userId) {
                await loadUserTraces(userId);
            }
        } catch {
            setAnalysisStatuses((prev) => ({ ...prev, [traceName]: { taskId, status: "failed", progress: 0 } }));
        }
    };

    const toApiTrace = (t: TableTrace): ApiTrace => {
        const found = userTraces.find((u) => u.trace_name === t.trace_name);
        if (found) return found;
        return {
            id: t.id,
            trace_name: t.trace_name,
            upload_date: t.upload_date,
            trace_description: t.trace_description,
            model: t.model,
        } as ApiTrace;
    };

    // Action 1: Start (run only, no redirect)
    const onRunAnalysis = async (t: TableTrace) => {
        if (!userId) return;
        try {
            const taskId = await startAnalysis(t.trace_name, userId, t.model || "gpt-4.1-mini");
            setAnalysisStatuses((prev) => ({
                ...prev,
                [t.trace_name]: { taskId, status: "pending", progress: 0 },
            }));
            // 👇 do NOT redirect, just keep polling in background
            pollAnalysisStatus(t.trace_name, taskId);
        } catch {
            alert("Failed to start analysis.");
        }
    };


    const onOpenChat = (t: TableTrace) => {
        setSelectedTrace(toApiTrace(t));
        setDetailTab("analyze");
        setView("detail");
    };

    const onInspectTrace = async (t: TableTrace) => {
        if (!userId) return;
        try {
            const data = await fetchDiagnosisTree(t.trace_name, userId);
            setTreeData(Array.isArray(data) ? data : [data]);
            setSelectedTrace(toApiTrace(t));
            setDetailTab("inspect");
            setView("detail");
        } catch {
            alert("Failed to load analysis process. Try running analysis first.");
        }
    };

    const onDeleteTrace = async (t: TableTrace) => {
        if (!userId) return;
        if (!window.confirm(`Delete "${t.trace_name}"?`)) return;
        try {
            await deleteTrace(t.trace_name, userId);
            await loadUserTraces(userId);
        } catch {
            alert("Failed to delete trace.");
        }
    };

    const onRenameTrace = async (t: TableTrace, newName: string) => {
        if (!userId || !newName || newName === t.trace_name) return;
        try {
            await apiRename(t.trace_name, newName, userId);
            await loadUserTraces(userId);
            if (analysisStatuses[t.trace_name]) {
                setAnalysisStatuses((prev) => {
                    const { [t.trace_name]: old, ...rest } = prev;
                    return { ...rest, [newName]: old };
                });
            }
        } catch {
            alert("Failed to rename trace.");
        }
    };

    const onModelChange = async (t: TableTrace, newModel: string) => {
        if (!userId) return;
        try {
            await apiUpdateModel(t.trace_name, newModel, userId);
            await loadUserTraces(userId);
        } catch {
            alert("Failed to update model.");
        }
    };

    const displayUser = email ?? userId ?? "Guest";

    // Filter + paginate
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tableTraces;
        return tableTraces.filter((t) => (t.trace_name || "").toLowerCase().includes(q));
    }, [tableTraces, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const page = Math.min(currentPage, totalPages);
    const rows = filtered.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

    return (
        <div className="homepage-root">
            {view === "list" && (
                <>
                    <TopBanner
                        currentUser={displayUser}
                        isTestUser={!userId}
                        uploading={uploading}
                        onFileSelected={onFileSelected}
                        onBatchSelected={onBatchSelected}
                        onLogout={logout}
                    />

                    <main className="page">
                        <div className="container">
                            <div className="section__head">
                                <input
                                    className="search"
                                    placeholder="Search traces…"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>

                            <div className="table-card">
                                <TraceTable
                                    traces={rows}
                                    onAnalyze={onRunAnalysis}     // ▶︎ Start → run only, stay on list
                                    onChat={onInspectTrace}       // 💬 now opens PROCESS GRAPH (Inspect)
                                    onInspect={onOpenChat}        // 🔍 now opens ANALYZE (Trace + Chat)
                                    onDelete={onDeleteTrace}
                                    onRename={onRenameTrace}
                                    onModelChange={onModelChange}
                                    availableModels={availableModels}
                                    analysisStatuses={formattedStatuses}
                                />

                                <div className="pager-bottom">
                                    <button className="pager-btn" disabled={page === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                                        Prev
                                    </button>
                                    <span className="muted">{page}/{totalPages}</span>
                                    <button className="pager-btn" disabled={page === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                                        Next
                                    </button>
                                    <span className="muted" style={{ marginLeft: 10 }}>{filtered.length} total</span>
                                </div>
                            </div>
                        </div>
                    </main>
                </>
            )}

            {view === "detail" && selectedTrace && (
                <>
                    <TopBanner
                        currentUser={displayUser}
                        isTestUser={!userId}
                        uploading={uploading}
                        onFileSelected={onFileSelected}
                        onBatchSelected={onBatchSelected}
                        onLogout={logout}
                    />
                    <main className="page">
                        <div className="container">
                            {/* Tab switcher */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                <button
                                    className="pager-btn"
                                    style={{ background: detailTab === "analyze" ? "#0b4ea2" : undefined, color: detailTab === "analyze" ? "#fff" : undefined }}
                                    onClick={() => setDetailTab("analyze")}
                                >
                                    Analyze (trace + chat)
                                </button>
                                <button
                                    className="pager-btn"
                                    style={{ background: detailTab === "inspect" ? "#0b4ea2" : undefined, color: detailTab === "inspect" ? "#fff" : undefined }}
                                    onClick={async () => {
                                        if (!treeData) {
                                            try {
                                                const data = await fetchDiagnosisTree(selectedTrace.trace_name, userId || "");
                                                setTreeData(Array.isArray(data) ? data : [data]);
                                            } catch {
                                                alert("Failed to load analysis process.");
                                                return;
                                            }
                                        }
                                        setDetailTab("inspect");
                                    }}
                                >
                                    Inspect (process graph)
                                </button>
                                <button className="pager-btn" onClick={() => setView("list")}>← Back to list</button>
                            </div>

                            {/* Tab content */}
                            {detailTab === "analyze" ? (
                                <AnalysisWorkspace userId={userId || ""} trace={selectedTrace} onBack={() => setView("list")} />
                            ) : (
                                <div className="inspect-container">
                                    <h2>Analysis Process for {selectedTrace.trace_name}</h2>
                                    <div className="tree-container">
                                        <DiagnosisTree treeData={treeData} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </>
            )}
        </div>
    );
};

export default HomePage;
