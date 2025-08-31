import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    fetchTraceDiagnosis,
    fetchSampleQuestions,
    initializeSocket,
    sendChatMessage,
    updateFeedback,
} from "../API/requests";
import { ChatWindowProps, traceDiagnosis, chatHistory } from "../interface/interfaces";
import { useUser } from "../contexts/UserContext";

type MsgRole = "user" | "assistant" | "tool";

const ChatWindow: React.FC<ChatWindowProps> = ({ selectedTrace }) => {
    const { userId } = useUser();

    const [diag, setDiag] = useState<traceDiagnosis | null>(null);
    const [samples, setSamples] = useState<string[]>([]);
    const [history, setHistory] = useState<chatHistory | null>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Load diagnosis + samples
    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            try {
                const d = await fetchTraceDiagnosis(selectedTrace.trace_name, userId || "");
                const s = await fetchSampleQuestions(selectedTrace.trace_name, userId || "");
                if (!alive) return;

                setDiag(d.trace_diagnosis);
                setSamples(Array.isArray(s) ? s : []);
                setHistory({
                    id: d.id,
                    messages: [
                        {
                            role: "assistant",
                            content: d.trace_diagnosis?.content || "No diagnosis yet.",
                            sources: d.trace_diagnosis?.sources || [],
                        } as any,
                    ],
                });
            } catch {
                if (!alive) return;
                setHistory({
                    id: selectedTrace.trace_name,
                    messages: [{ role: "assistant", content: "Failed to load diagnosis.", sources: [] } as any],
                });
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [selectedTrace, userId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [history, loading]);

    // Socket listeners (compatible with your stub)
    useEffect(() => {
        const socket = initializeSocket();

        // Your backend emits "message" in api.py demo; support both names.
        // @ts-ignore
        socket.on?.("message", (payload: any) => {
            const txt =
                typeof payload === "string"
                    ? payload
                    : payload?.content || (payload?.ok ? "Message received." : JSON.stringify(payload));
            setHistory((prev) =>
                prev ? { ...prev, messages: [...prev.messages, { role: "assistant", content: txt } as any] } : prev
            );
            setLoading(false);
        });

        // Also support a more typical "receive_message" if backend changes later.
        // @ts-ignore
        socket.on?.("receive_message", (message: any) => {
            setHistory((prev) =>
                prev ? { ...prev, messages: [...prev.messages, { role: "assistant", content: message?.content || "" } as any] } : prev
            );
            setLoading(false);
        });

        return () => {
            // @ts-ignore
            socket.off?.("message");
            // @ts-ignore
            socket.off?.("receive_message");
            // @ts-ignore
            socket.disconnect?.();
        };
    }, []);

    const fallbackAnswer = (question: string) => {
        const base = diag?.content || "I/O analysis not yet available.";
        // Super-light heuristic: mention imbalance/metadata if asked
        const q = question.toLowerCase();
        const hints: string[] = [];
        if (q.includes("outlier") || q.includes("rank")) hints.push("identify rank outliers");
        if (q.includes("metadata")) hints.push("whether metadata time dominates");
        if (q.includes("file")) hints.push("top files by I/O time");
        if (q.includes("write") || q.includes("small")) hints.push("small, unaligned writes");
        const ask = hints.length ? ` I can ${hints.join(", ")}.` : "";

        return `Based on the current diagnosis, ${base}${ask}`;
    };

    const pushUser = (text: string) => {
        setHistory((prev) =>
            prev ? { ...prev, messages: [...prev.messages, { role: "user", content: text } as any] } : prev
        );
    };

    const pushAssistant = (text: string) => {
        setHistory((prev) =>
            prev ? { ...prev, messages: [...prev.messages, { role: "assistant", content: text } as any] } : prev
        );
    };

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || !history) return;

        pushUser(trimmed);
        setInput("");
        setLoading(true);

        // Try socket first
        try {
            const next = [...history.messages, { role: "user", content: trimmed } as any];
            sendChatMessage(next as any, (diag as any) || {}, selectedTrace as any, userId || "");
        } catch {
            // ignore; we'll fallback
        }

        // Fallback if no server reply arrives quickly
        setTimeout(() => {
            if (loading) {
                pushAssistant(fallbackAnswer(trimmed));
                setLoading(false);
            }
        }, 1200);
    };

    const toggleSources = (idx: number) => {
        setExpandedIdx((prev) => {
            const n = new Set(prev);
            if (n.has(idx)) n.delete(idx);
            else n.add(idx);
            return n;
        });
    };

    const like = async (idx: number) => {
        if (!history) return;
        const msgs = history.messages.map((m, i) =>
            i === idx ? { ...m, liked: !m.liked, disliked: m.liked ? m.disliked : false } : m
        );
        const updated = { ...history, messages: msgs };
        setHistory(updated);
        try {
            if (userId) await updateFeedback(updated, userId);
        } catch { }
    };

    const dislike = async (idx: number) => {
        if (!history) return;
        const msgs = history.messages.map((m, i) =>
            i === idx ? { ...m, disliked: !m.disliked, liked: m.disliked ? m.liked : false } : m
        );
        const updated = { ...history, messages: msgs };
        setHistory(updated);
        try {
            if (userId) await updateFeedback(updated, userId);
        } catch { }
    };

    const msgs = useMemo(() => history?.messages ?? [], [history]);

    return (
        <div className="chat-window">
            <style>{`
        .chat-history { height: 56vh; overflow: auto; padding: 8px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
        .msg { margin: 10px 0; display: flex; gap: 8px; align-items: flex-start; }
        .badge { width: 22px; height: 22px; display:flex; align-items:center; justify-content:center; border-radius:999px; font-size:12px; line-height:1; }
        .badge.user { background:#e0f2fe; }
        .badge.assistant { background:#e5e7eb; }
        .badge.tool { background:#fee2e2; }
        .bubble { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; }
        .actions { display:flex; align-items:center; gap:10px; margin-top:6px; font-size:12px; color:#334155; }
        .sources { margin-top:8px; padding:8px; background:#fff; border:1px dashed #e2e8f0; border-radius:6px; }
        .samples { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 4px; }
        .samples button { padding:6px 8px; border-radius:999px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; }
        .chat-input { display:flex; gap:8px; margin-top:10px; }
        .chat-input textarea { flex:1; min-height:44px; max-height:120px; resize:vertical; padding:8px; border:1px solid #e2e8f0; border-radius:8px; }
        .chat-input button { padding:8px 12px; border-radius:8px; border:1px solid #1d4ed8; background:#1d4ed8; color:#fff; font-weight:600; }
      `}</style>

            <div className="chat-history" ref={scrollRef}>
                {msgs.map((m, i) => {
                    const role = (m.role as MsgRole) || "assistant";
                    const hasSources = role === "assistant" && Array.isArray((m as any).sources) && (m as any).sources.length > 0;

                    return (
                        <div key={i} className="msg">
                            <div className={`badge ${role}`} title={role}>
                                {role === "user" ? "🧑" : role === "assistant" ? "🤖" : "🛠️"}
                            </div>
                            <div className="bubble">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || ""}</ReactMarkdown>

                                {role === "assistant" && (
                                    <div className="actions">
                                        {hasSources && (
                                            <button type="button" onClick={() => toggleSources(i)}>
                                                {expandedIdx.has(i) ? "Hide Sources" : "Show Sources"}
                                            </button>
                                        )}
                                        <span>Feedback:</span>
                                        <button type="button" onClick={() => like(i)}>{(m as any).liked ? "👍" : "👍🏻"}</button>
                                        <button type="button" onClick={() => dislike(i)}>{(m as any).disliked ? "👎" : "👎🏻"}</button>
                                    </div>
                                )}

                                {hasSources && expandedIdx.has(i) && (
                                    <div className="sources">
                                        {(m as any).sources.map((s: any, idx: number) => (
                                            <div key={idx}>{typeof s === "string" ? s : s?.file || JSON.stringify(s)}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {samples.length > 0 && (
                    <div className="samples">
                        {samples.map((q, idx) => (
                            <button key={idx} onClick={() => send(q)}>{q}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="chat-input">
                <textarea
                    placeholder="Ask about errors, bottlenecks, outliers…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send(input);
                        }
                    }}
                />
                <button onClick={() => send(input)} disabled={!input.trim()}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;
