import React, { useEffect, useRef, useState } from "react";
import { initializeSocket } from "../API/requests";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
    userId: string;
    traceName: string;
    sampleQuestions?: string[];
    originalTrace?: string;
};

const style = {
    row: { display: "flex", flexDirection: "column" as const, gap: 10 },
    pills: { display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 10 },
    pill: {
        fontSize: 12, padding: "6px 10px", borderRadius: 999,
        background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #DBEAFE", cursor: "pointer"
    } as React.CSSProperties,
    topRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    chip: (ok: boolean): React.CSSProperties => ({
        fontSize: 11, padding: "2px 8px", borderRadius: 999,
        border: `1px solid ${ok ? "#86efac" : "#fde68a"}`, background: ok ? "#dcfce7" : "#fef3c7",
        color: ok ? "#065f46" : "#92400e",
    }),
    scroll: { maxHeight: 420, overflow: "auto", paddingRight: 6, paddingTop: 6, paddingBottom: 6 },
    bubble: (role: "user" | "assistant"): React.CSSProperties => ({
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        background: role === "user" ? "#0B4AA2" : "#F1F5F9",
        color: role === "user" ? "#fff" : "#0f172a",
        padding: "10px 12px", borderRadius: 14, maxWidth: 520, whiteSpace: "pre-wrap" as const,
    }),
    inputRow: { display: "flex", gap: 8, alignItems: "center" },
    input: { flex: 1, border: "1px solid #CBD5E1", borderRadius: 10, padding: "10px 12px" },
    send: { borderRadius: 8, padding: "10px 14px", border: "1px solid #0B4AA2", background: "#0B4AA2", color: "#fff", cursor: "pointer" },
    toggle: { fontSize: 12, cursor: "pointer", marginTop: 6 },
};

const DEFAULT_PILLS = [
    "Which ranks are outliers?",
    "Is metadata time dominating?",
    "Show top 5 files by time.",
];

const ChatAgent: React.FC<Props> = ({ userId, traceName, sampleQuestions = DEFAULT_PILLS, originalTrace = "" }) => {
    const [messages, setMessages] = useState<Msg[]>([
        { role: "assistant", content: "Hi! Ask me about this trace. I can explain bottlenecks, outliers, and recommendations. Try a suggested question below." },
    ]);
    const [input, setInput] = useState("");
    const [showSnippet, setShowSnippet] = useState(false);
    const [connected, setConnected] = useState<boolean>(false);
    const [sending, setSending] = useState(false);

    const boxRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<any>(null);

    useEffect(() => {
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
    }, [messages]);

    useEffect(() => {
        const s = initializeSocket();
        socketRef.current = s;
        (window as any).__ION_WS__ = s;

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);
        const onReply = (payload: any) => {
            const reply =
                payload?.reply ??
                payload?.message ??
                (typeof payload === "string" ? payload : "");
            if (reply) {
                setMessages((prev) => [...prev, { role: "assistant", content: String(reply) }]);
                setSending(false);
            }
        };

        s?.on && s.on("connect", onConnect);
        s?.on && s.on("disconnect", onDisconnect);
        s?.on && s.on("receive_message", onReply);
        s?.on && s.on("message", onReply);

        s?.on && s.on("connect_error", () => {
            setConnected(false);
            setMessages((p) => [...p, { role: "assistant", content: "⚠️ Chat connection failed." }]);
        });

        return () => {
            if (!s?.off) return;
            s.off("connect", onConnect);
            s.off("disconnect", onDisconnect);
            s.off("receive_message", onReply);
            s.off("message", onReply);
            s.off("connect_error");
        };
    }, []);

    const send = (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg || sending) return;

        setMessages((prev) => [...prev, { role: "user", content: msg }]);
        setSending(true);

        try {
            const s = socketRef.current;
            if (!s || !s.emit) {
                setSending(false);
                setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Chat service not reachable." }]);
            } else {
                s.emit("send_message", { trace_name: traceName, message: msg, user_id: userId });
            }
        } catch {
            setSending(false);
            setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Chat service not reachable." }]);
        }

        if (!text) setInput("");
    };

    return (
        <div style={style.row}>
            <div style={style.topRow}>
                <div style={style.pills}>
                    {sampleQuestions.map((q, i) => (
                        <button key={i} style={style.pill} onClick={() => send(q)} disabled={sending}>
                            {q}
                        </button>
                    ))}
                </div>
                <span style={style.chip(connected)}>{connected ? "Connected" : "Connecting…"}</span>
            </div>

            <div ref={boxRef} style={style.scroll}>
                {messages.map((m, i) => (
                    <div key={i} style={style.bubble(m.role)}>{m.content}</div>
                ))}
                {originalTrace && (
                    <div style={style.toggle} onClick={() => setShowSnippet((s) => !s)}>
                        {showSnippet ? "▼ Hide raw trace snippet" : "► Show snippet of raw trace"}
                    </div>
                )}
                {showSnippet && originalTrace && (
                    <pre style={{
                        background: "#F8FAFC", border: "1px solid #E6E9F0", borderRadius: 8,
                        padding: 10, marginTop: 6, whiteSpace: "pre-wrap" as const, fontSize: 12,
                    }}>{originalTrace.slice(0, 1200)}</pre>
                )}
            </div>

            <div style={style.inputRow}>
                <input
                    style={style.input}
                    placeholder="Ask about errors, bottlenecks, outliers…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    disabled={!connected || sending}
                />
                <button style={style.send} onClick={() => send()} disabled={!connected || sending}>
                    {sending ? "Sending…" : "Send"}
                </button>
            </div>
        </div>
    );
};

export default ChatAgent;
