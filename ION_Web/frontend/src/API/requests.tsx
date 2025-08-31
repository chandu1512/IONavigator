import { traceDiagnosis, Trace, Message, chatHistory } from "../interface/interfaces";
import { io, Socket } from "socket.io-client";

/* ------------- Config ------------- */
const API_BASE = (process.env.REACT_APP_FLASK_API_BASE_URL || "http://127.0.0.1:5001").replace(/\/+$/, "");
const WS_URL = process.env.REACT_APP_WEBSOCKET_URL || "";
const U = (p: string) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

/* Helpers */
async function asText(res: Response) { try { return await res.text(); } catch { return ""; } }
async function asJSON<T>(res: Response): Promise<T> {
  try { return (await res.json()) as T; }
  catch { throw new Error((await asText(res)) || `HTTP ${res.status}`); }
}

/* ------------- WebSocket (threading mode => polling) ------------- */
let socket: Socket | null = null;

export const initializeSocket = () => {
  if (socket) return socket;

  if (!WS_URL) {
    // dummy no-op socket
    return { on: () => { }, emit: () => { }, off: () => { }, connected: false } as unknown as Socket;
  }

  socket = io(WS_URL, {
    path: "/socket.io",
    transports: ["polling"],  // KEY: allow polling since backend is threading mode
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 8000,
    withCredentials: false,
  });

  (window as any).__ION_WS__ = socket;

  socket.on("connect", () => console.log("[WS] connected:", socket?.id));
  socket.on("connect_error", (e) => console.warn("[WS] connect_error:", e?.message || e));
  socket.on("error", (e) => console.warn("[WS] error:", e));
  socket.on("disconnect", (r) => console.log("[WS] disconnect:", r));
  socket.on("connected", (p) => console.log("[WS] server says connected:", p));
  socket.on("receive_message", (msg) => console.log("[WS] receive_message:", msg));

  return socket;
};

export const sendChatMessage = (history: Array<Message>, td: traceDiagnosis, trace: Trace, user_id: string) => {
  const s = initializeSocket();
  // @ts-ignore
  if (!("emit" in s)) return;
  (s as Socket).emit("send_message", {
    chat_history: history,
    trace_diagnosis: td,
    trace_name: trace.trace_name,
    user_id,
  });
};

/* ------------- Auth ------------- */
export async function loginUser(email: string): Promise<string> {
  const res = await fetch(U("/api/user"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to login user");
  const data = await asJSON<{ user_id: string }>(res);
  return data.user_id;
}

export async function createUser(email: string, _password: string): Promise<string> {
  const res = await fetch(U("/api/user"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to create user");
  const data = await asJSON<{ user_id: string }>(res);
  return data.user_id;
}

/* ------------- Traces ------------- */
export async function fetchUserTraces(user_id: string): Promise<Array<Trace>> {
  const res = await fetch(U("/api/user_traces"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, page: 1, page_size: 1000, search: "" }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to fetch traces");
  return asJSON<Array<Trace>>(res);
}

export async function uploadTrace(file: File, userId: string) {
  const trace_name = (file.name.replace(/\.[^.]+$/, "") || "trace").replace(/[^\w.-]/g, "_");
  async function tryKey(k: "file" | "trace_file" | "trace") {
    const fd = new FormData();
    fd.append("user_id", userId);
    fd.append("trace_name", trace_name);
    fd.append(k, file, file.name);
    return fetch(U("/api/upload_trace"), { method: "POST", body: fd });
  }
  let last: Response | null = null;
  for (const key of ["file", "trace_file", "trace"] as const) {
    const res = await tryKey(key);
    if (res.ok) return asJSON<{ success?: boolean; message?: string }>(res);
    last = res;
    if (![400, 404, 405].includes(res.status)) break;
  }
  throw new Error((last && (await asText(last))) || "Upload failed");
}

export async function uploadTraceBatch(files: File[] | FileList, userId: string) {
  const arr = Array.from(files);
  if (!arr.length) throw new Error("No files selected");
  const first: any = arr[0];
  const rp: string = first?.webkitRelativePath || first?.name || "trace";
  const topFolder = rp.includes("/") ? rp.split("/")[0] : null;
  const baseName = (first?.name || "trace").replace(/\.[^/.]+$/, "");
  const trace_name = (topFolder || baseName).replace(/[^\w.-]/g, "_");

  const fd = new FormData();
  fd.append("user_id", userId);
  fd.append("trace_name", trace_name);
  for (const f of arr) fd.append("files", f);

  const res = await fetch(U("/api/upload_trace"), { method: "POST", body: fd });
  if (!res.ok) throw new Error(await asText(res));
  return asJSON<{ success?: boolean; message?: string }>(res);
}

export async function deleteTrace(trace_name: string, user_id: string): Promise<void> {
  const res = await fetch(U("/api/delete_trace"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace_name, user_id }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to delete trace");
}

export async function renameTrace(oldName: string, newName: string, userId: string): Promise<void> {
  const res = await fetch(U("/api/rename_trace"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, old_name: oldName, new_name: newName }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to rename trace");
}

export async function updateTraceModel(traceName: string, model: string, userId: string): Promise<void> {
  const res = await fetch(U("/api/update_trace_model"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, trace_name: traceName, model }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to update model");
}

/* ------------- Analysis ------------- */
export async function startAnalysis(trace_name: string, user_id: string, llm: string): Promise<string> {
  const res = await fetch(U("/api/run_analysis"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace_name, user_id, llm }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to start analysis");
  const data = await asJSON<{ task_id: string }>(res);
  return data.task_id;
}

export async function stopAnalysis(trace_name: string, user_id: string): Promise<void> {
  const res = await fetch(U("/api/stop_analysis"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trace_name, user_id }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to stop analysis");
}

export async function checkAnalysisStatus(task_id: string): Promise<{ status: string; progress: number; result?: string; error?: string; }> {
  const res = await fetch(U(`/api/analysis_status/${encodeURIComponent(task_id)}`));
  if (!res.ok) throw new Error((await asText(res)) || "Failed to check analysis status");
  return asJSON(res);
}

/* ------------- Diagnosis / content ------------- */
export async function fetchTraceDiagnosis(trace_name: string, userId: string): Promise<{ trace_diagnosis: traceDiagnosis; id: string; pending?: boolean }> {
  const res = await fetch(U(`/api/trace_examples/${encodeURIComponent(trace_name)}/final_diagnosis`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (res.status === 404) return { trace_diagnosis: { content: "", sources: [] } as any, id: trace_name, pending: true };
  if (!res.ok) throw new Error((await asText(res)) || "Failed to fetch trace diagnosis");
  return asJSON(res);
}

export async function fetchOriginalTrace(trace_name: string, user_id: string): Promise<string> {
  const res = await fetch(U(`/api/trace_examples/${encodeURIComponent(trace_name)}/original_trace`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (res.status === 404) return "";
  if (!res.ok) throw new Error((await asText(res)) || "Failed to fetch original trace");
  const data = await asJSON<{ original_trace: string }>(res);
  return data.original_trace;
}

export async function fetchDiagnosisTree(trace_name: string, user_id: string): Promise<any> {
  const res = await fetch(U(`/api/trace_examples/${encodeURIComponent(trace_name)}/diagnosis_tree`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to fetch diagnosis tree");
  return asJSON(res);
}

export async function renderContent(content: any, name: string): Promise<string> {
  const isMarkdown = name.endsWith(".txt") || name.endsWith(".md");
  const content_type = isMarkdown ? "md" : "json";
  const res = await fetch(U("/api/render_content"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, content_type }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to render content");
  return await res.text();
}

export async function fetchSampleQuestions(trace_name: string, user_id: string): Promise<Array<string>> {
  const res = await fetch(U(`/api/trace_examples/${encodeURIComponent(trace_name)}/sample_questions`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id }),
  });
  if (!res.ok) throw new Error((await asText(res)) || "Failed to fetch sample questions");
  return asJSON(res);
}

/* ------------- Feedback (stub) ------------- */
export async function updateFeedback(_chatHistory: chatHistory, _user_email: string) {
  return { ok: true };
}
