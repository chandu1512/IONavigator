import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TracesPage.tsx — Chris-spec (HARD-CENTERED + CLEAR TABLE + VISIBLE ACTIONS)
 * - Center-trap grid locks the card dead center (even if parent has margins/sidebars)
 * - Card uses overflow-visible so right-side buttons never get clipped
 * - Table is table-fixed with explicit column widths (no drift)
 * - Actions column has minWidth; real buttons (Analyze/Stop/Finalize/Inspect/Rename/Delete)
 * - Search on the right; EXACT 10/pg pagination
 * - Single + Folder upload supported
 */

type TraceStatus = "not-started" | "idle" | "queued" | "analyzing" | "done" | "error";
type Trace = { id: string; name: string; uploadDate: string; model: string; status: TraceStatus };

const PAGE_SIZE = 10;
const MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "anthropic/claude-3-5-sonnet"];

// ---- helpers
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();
const mock = (n = 48): Trace[] => {
    const base = Date.now();
    return Array.from({ length: n }).map((_, i) => ({
        id: `t_${i + 1}`,
        name: `${3122500 + i}-${Math.floor(Math.random() * 1e16)}`,
        uploadDate: new Date(base - i * 86_400_000).toISOString(),
        model: MODELS[i % MODELS.length],
        status: "not-started",
    }));
};

function StatusPill({ status }: { status: TraceStatus }) {
    const label = status === "not-started" ? "Not Started" : status;
    const cls =
        status === "done"
            ? "bg-green-100 text-green-700"
            : status === "analyzing"
                ? "bg-amber-100 text-amber-800"
                : status === "error"
                    ? "bg-red-100 text-red-700"
                    : status === "queued"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-700";
    return (
        <span className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-[11px] font-medium ${cls}`}>
            {label}
        </span>
    );
}

function ActionBtn({
    title,
    onClick,
    danger = false,
    children,
}: {
    title: string;
    onClick: () => void;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-100 ${danger ? "text-red-600" : ""
                }`}
        >
            {children}
            <span className="hidden xl:inline">{title}</span>
        </button>
    );
}

function Pagination({
    total,
    page,
    onPage,
}: {
    total: number;
    page: number;
    onPage: (p: number) => void;
}) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const go = (p: number) => onPage(Math.min(pages, Math.max(1, p)));
    return (
        <div className="flex items-center justify-between text-sm">
            <div>
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{pages}</span>
            </div>
            <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page === 1} onClick={() => go(1)}>
                    First
                </button>
                <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page === 1} onClick={() => go(page - 1)}>
                    Prev
                </button>
                <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page === pages} onClick={() => go(page + 1)}>
                    Next
                </button>
                <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page === pages} onClick={() => go(pages)}>
                    Last
                </button>
            </div>
        </div>
    );
}

export default function TracesPage() {
    // Top bar stubs (match screenshots)
    const onLogin = () => alert("Login");
    const onUploadNew = () => hiddenFileRef.current?.click();

    // Upload refs
    const hiddenFileRef = useRef<HTMLInputElement>(null);
    const hiddenDirRef = useRef<HTMLInputElement>(null);

    // Data
    const [rows, setRows] = useState<Trace[]>(() => mock(48));
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);

    // Filter + sort
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        const base = s ? rows.filter((r) => r.name.toLowerCase().includes(s)) : rows.slice();
        base.sort((a, b) => (a.uploadDate < b.uploadDate ? 1 : -1));
        return base;
    }, [rows, q]);

    useEffect(() => setPage(1), [q]);

    const start = (page - 1) * PAGE_SIZE;
    const current = filtered.slice(start, start + PAGE_SIZE);

    // Row actions (UI only; wire to API later)
    const analyze = (t: Trace) => setRows((old) => old.map((x) => (x.id === t.id ? { ...x, status: "analyzing" } : x)));
    const stop = (t: Trace) => setRows((old) => old.map((x) => (x.id === t.id ? { ...x, status: "idle" } : x)));
    const finalize = (t: Trace) => alert(`Finalize ${t.name}`);
    const inspect = (t: Trace) => alert(`Inspect ${t.name}`);
    const rename = (t: Trace) => {
        const nn = prompt("New name", t.name)?.trim();
        if (!nn || nn === t.name) return;
        setRows((old) => old.map((x) => (x.id === t.id ? { ...x, name: nn } : x)));
    };
    const del = (t: Trace) => {
        if (!confirm(`Delete ${t.name}?`)) return;
        setRows((old) => old.filter((x) => x.id !== t.id));
    };
    const setModel = (t: Trace, m: string) => setRows((old) => old.map((x) => (x.id === t.id ? { ...x, model: m } : x)));

    // Upload
    const onFiles = (files: FileList) => {
        const now = new Date().toISOString();
        const added: Trace[] = Array.from(files).map((f, i) => ({
            id: `new_${Date.now()}_${i}`,
            name: f.name,
            uploadDate: now,
            model: MODELS[0],
            status: "not-started",
        }));
        setRows((old) => [...added, ...old]);
    };

    return (
        <div className="min-h-screen bg-gray-25">
            {/* SLEDGEHAMMER FIXES (page-local) */}
            <style>{`
        /* Kill rogue left padding/margins from any parent shells on this page */
        .traces-root, .traces-root *:where(.page-wrap, .content, main) {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
      `}</style>

            {/* Top Bar — matches Chris’s screenshots */}
            <header className="bg-[#0B5CAB] text-white">
                <div className="mx-auto max-w-[1400px] px-4 md:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-cyan-300" aria-hidden />
                        <div className="font-semibold text-lg tracking-tight">HPC I/O Navigator</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onLogin} className="rounded-full bg-yellow-400 text-blue-900 px-4 py-1.5 text-sm font-semibold">
                            Login
                        </button>
                        <button onClick={onUploadNew} className="rounded-full bg-yellow-400 text-blue-900 px-4 py-1.5 text-sm font-semibold">
                            Upload New Trace
                        </button>
                    </div>
                </div>
            </header>

            {/* CENTER-TRAP GRID — left spacer | center column | right spacer */}
            <main className="traces-root grid w-full px-4 md:px-6 py-6 grid-cols-[1fr_min(1200px,calc(100%-32px))_1fr]">
                <section className="col-start-2">
                    {/* Tabs + Search row */}
                    <div className="mb-4">
                        <h1 className="text-2xl font-semibold tracking-tight mb-3">Traces</h1>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {[
                                    { label: "UDel Docs\nTest Account", active: true },
                                    { label: "Help Docs", active: false },
                                    { label: "Test Account", active: false },
                                ].map((t) => (
                                    <button
                                        key={t.label}
                                        className={`whitespace-pre px-3 py-1.5 rounded-full text-sm border ${t.active ? "bg-blue-800 text-white border-blue-800" : "bg-white text-gray-700 hover:bg-gray-50"
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search traces…"
                                className="w-full md:w-80 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Card */}
                    <div className="rounded-2xl shadow p-4 md:p-6 bg-white overflow-visible">
                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="table-fixed w-full border-separate border-spacing-0 rounded-xl overflow-hidden">
                                <colgroup>
                                    {/* Name 40, Date 18, Model 20, Status 10, Actions 12 */}
                                    <col style={{ width: "40%" }} />
                                    <col style={{ width: "18%" }} />
                                    <col style={{ width: "20%" }} />
                                    <col style={{ width: "10%" }} />
                                    <col style={{ width: "12%" }} />
                                </colgroup>
                                <thead>
                                    <tr className="bg-blue-800 text-white">
                                        {["Trace Name (double-click to edit)", "Upload Date", "Model", "Status", "Actions"].map((h, i) => (
                                            <th
                                                key={h}
                                                className={`text-left text-sm font-semibold tracking-wide px-3 py-3 ${i === 0 ? "rounded-tl-xl" : ""
                                                    } ${i === 4 ? "rounded-tr-xl" : ""}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {current.map((t, i) => (
                                        <tr key={t.id} className={`border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                                            <td className="px-3 py-3" onDoubleClick={() => rename(t)}>
                                                <div className="truncate" title={t.name}>
                                                    {t.name}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">{fmtDate(t.uploadDate)}</td>
                                            <td className="px-3 py-3">
                                                <select
                                                    className="w-full h-8 border rounded-lg px-2 text-sm bg-white"
                                                    value={t.model}
                                                    onChange={(e) => setModel(t, e.target.value)}
                                                >
                                                    {MODELS.map((m) => (
                                                        <option key={m} value={m}>
                                                            {m}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-3">
                                                <StatusPill status={t.status} />
                                            </td>
                                            {/* Actions — EXPLICIT BUTTONS, NEVER HIDDEN */}
                                            <td className="px-3 py-2" style={{ minWidth: 240 }}>
                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    {(t.status === "not-started" || t.status === "idle" || t.status === "error" || t.status === "queued") && (
                                                        <ActionBtn title="Analyze" onClick={() => analyze(t)}>
                                                            ▶︎
                                                        </ActionBtn>
                                                    )}
                                                    {t.status === "analyzing" && (
                                                        <ActionBtn title="Stop" onClick={() => stop(t)}>
                                                            ■
                                                        </ActionBtn>
                                                    )}
                                                    {t.status === "done" && (
                                                        <ActionBtn title="Finalize" onClick={() => finalize(t)}>
                                                            ✓
                                                        </ActionBtn>
                                                    )}
                                                    <ActionBtn title="Inspect" onClick={() => inspect(t)}>
                                                        🔎
                                                    </ActionBtn>
                                                    <ActionBtn title="Rename" onClick={() => rename(t)}>
                                                        ✎
                                                    </ActionBtn>
                                                    <ActionBtn title="Delete" onClick={() => del(t)} danger>
                                                        🗑
                                                    </ActionBtn>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="mt-4">
                            <Pagination total={filtered.length} page={page} onPage={setPage} />
                        </div>

                        {/* Hidden file inputs */}
                        <input
                            ref={hiddenFileRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => e.target.files && onFiles(e.target.files)}
                        />
                        <input
                            ref={hiddenDirRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => e.target.files && onFiles(e.target.files)}
                            {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as any)}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}
