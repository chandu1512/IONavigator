# backend/src/api.py
import os
import uuid
import time
import threading
import traceback
import shutil
from datetime import datetime
from collections import defaultdict
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO, emit

# --- LLM / .env ---
from dotenv import load_dotenv
from openai import OpenAI

# Load .env from backend/ or backend/src/, override any stale shell vars
_BASE_DIR = Path(__file__).resolve().parent
_ENV_CANDIDATES = [_BASE_DIR.parent / ".env", _BASE_DIR / ".env"]
_loaded = False
for _p in _ENV_CANDIDATES:
    if _p.exists():
        load_dotenv(_p, override=True)
        _loaded = True
        print(f"[env] loaded {_p}")
        break
if not _loaded:
    print("[env] WARNING: .env not found next to api.py or its parent")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4o-mini")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
print("[LLM]", "enabled" if client else "disabled (no/invalid key)",
      "model:", CHAT_MODEL)

# -------------------------------------------------
# App / Socket setup
# -------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"},
     r"/socket.io/*": {"origins": "*"}})

# Avoid eventlet/gevent issues on macOS/Python 3.13
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Limits & storage
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1GB
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory demo stores (replace with DB when ready)
TRACES = defaultdict(dict)   # {user_id: {trace_name: {...}}}
ANALYSIS = {}                # {task_id: {'status','progress','user_id','trace_name'}}
FINAL_DIAG_BY_TRACE = {}     # {trace_name: "final diagnosis text"}

# -------------------------------------------------
# Helpers
# -------------------------------------------------


def now_date() -> str:
    dt = datetime.now()
    return f"{dt.month}/{dt.day}/{dt.year}"


def ensure_user_dir(user_id: str):
    d = os.path.join(UPLOAD_DIR, secure_filename(user_id))
    os.makedirs(d, exist_ok=True)
    return d


def get_trace_preview(user_id: str, trace_name: str, limit: int = 6000) -> str:
    """Return a small text preview of the first saved file for the trace."""
    meta = TRACES.get(user_id, {}).get(trace_name)
    if not meta or not meta.get("files"):
        return ""
    path = meta["files"][0]
    try:
        with open(path, "r", errors="ignore") as f:
            return f.read(limit)
    except Exception:
        # binary/unreadable → return the filename so model knows context exists
        return os.path.basename(path)


def analysis_worker(task_id: str):
    try:
        for p in (10, 30, 60, 85, 100):
            st = ANALYSIS.get(task_id)
            if not st or st.get("status") == "stopped":
                return
            st["progress"] = p
            st["status"] = "running"
            time.sleep(0.8)
        ANALYSIS[task_id]["status"] = "completed"
        ANALYSIS[task_id]["progress"] = 100

        # Simple final diagnosis we can show in chat & API
        tname = ANALYSIS[task_id]["trace_name"]
        FINAL_DIAG_BY_TRACE[tname] = (
            f"Diagnosis summary for {tname}: I/O imbalance detected; consider collective I/O."
        )
    except Exception:
        ANALYSIS[task_id] = {"status": "failed", "progress": 0}


def llm_answer(user_id: str, trace_name: str, question: str, model: str = None) -> str:
    """Ask the model using a snippet of the trace as context; buffered server-side."""
    if not client:
        return "⚠️ OPENAI_API_KEY missing on server."
    model = model or TRACES.get(user_id, {}).get(
        trace_name, {}).get("model", CHAT_MODEL)
    snippet = get_trace_preview(user_id, trace_name)

    system = (
        "You are HPC I/O Navigator. Analyze Darshan I/O traces. "
        "Be concise. Use concrete metrics (bytes, IOPS, POSIX_* counters, open/close/stat counts) when available. "
        "Explain outliers, metadata vs data time, and recommend next steps (collective I/O, striping, aggregating small files, etc.). "
        "If context is insufficient, say what additional data is needed."
    )
    user_msg = (
        f"Trace name: {trace_name}\n"
        f"User question: {question}\n\n"
        f"Trace snippet (may be partial):\n{snippet}\n"
        "---\n"
        "Answer as a helpful HPC engineer."
    )

    try:
        stream = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user_msg}],
            stream=True,
            temperature=0.2,
        )
        acc = []
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                acc.append(delta)
        reply = "".join(acc).strip()
        return reply or "I couldn't generate a response."
    except Exception as e:
        return f"⚠️ LLM error: {e}"

# -------------------------------------------------
# AUTH
# -------------------------------------------------


@app.post("/api/user")
def api_user():
    email = (request.json or {}).get("email", "")
    if not email:
        return jsonify(error="missing email"), 400
    return jsonify(user_id=str(uuid.uuid5(uuid.NAMESPACE_DNS, email)))

# -------------------------------------------------
# TRACES
# -------------------------------------------------


@app.post("/api/user_traces")
def user_traces():
    data = request.json or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify(error="missing user_id"), 400
    items = []
    for name, meta in TRACES[user_id].items():
        items.append({
            "id": meta.get("id", name),
            "trace_name": name,
            "upload_date": meta.get("upload_date", now_date()),
            "trace_description": meta.get("trace_description", ""),
            "model": meta.get("model", "gpt-4o"),
        })
    return jsonify(items)


@app.post("/api/upload_trace")
def upload_trace():
    try:
        user_id = request.form.get("user_id")
        if not user_id:
            return jsonify(error="missing user_id"), 400

        trace_name = request.form.get("trace_name")

        f = request.files.get("file") or request.files.get(
            "trace_file") or request.files.get("trace")
        files = request.files.getlist(
            "files") if "files" in request.files else ([] if f else [])
        if not f and not files:
            return jsonify(error="missing file payload (file | trace_file | trace | files[])"), 400

        udir = ensure_user_dir(user_id)
        bucket = [f] if f else files

        if not trace_name:
            trace_name = os.path.splitext(
                bucket[0].filename or "trace.darshan")[0]
        trace_name = secure_filename(trace_name)
        tdir = os.path.join(udir, trace_name)
        os.makedirs(tdir, exist_ok=True)

        saved = []
        for one in bucket:
            fname = secure_filename(one.filename or "trace.darshan")
            dst = os.path.join(tdir, fname)
            one.save(dst)
            saved.append(dst)

        TRACES[user_id][trace_name] = {
            "id": trace_name,
            "upload_date": now_date(),
            "model": TRACES[user_id].get(trace_name, {}).get("model", "gpt-4o"),
            "files": saved,
        }
        return jsonify(ok=True, trace_name=trace_name, count=len(saved)), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify(error=str(e), type=e.__class__.__name__), 500


@app.post("/api/delete_trace")
def delete_trace():
    data = request.json or {}
    user_id = data.get("user_id")
    trace_name = data.get("trace_name")
    if not user_id or not trace_name:
        return jsonify(error="missing user_id/trace_name"), 400
    TRACES[user_id].pop(trace_name, None)
    tdir = os.path.join(ensure_user_dir(user_id), secure_filename(trace_name))
    if os.path.isdir(tdir):
        shutil.rmtree(tdir, ignore_errors=True)
    FINAL_DIAG_BY_TRACE.pop(trace_name, None)
    return jsonify(ok=True)


@app.post("/api/rename_trace")
def rename_trace():
    data = request.json or {}
    user_id = data.get("user_id")
    old = data.get("old_name")
    new = data.get("new_name")
    if not all([user_id, old, new]):
        return jsonify(error="missing fields"), 400
    if old not in TRACES[user_id]:
        return jsonify(error="not found"), 404
    TRACES[user_id][new] = TRACES[user_id].pop(old)
    udir = ensure_user_dir(user_id)
    os.rename(os.path.join(udir, secure_filename(old)),
              os.path.join(udir, secure_filename(new)))
    if old in FINAL_DIAG_BY_TRACE:
        FINAL_DIAG_BY_TRACE[new] = FINAL_DIAG_BY_TRACE.pop(old)
    return jsonify(ok=True)


@app.post("/api/update_trace_model")
def update_trace_model():
    data = request.json or {}
    user_id = data.get("user_id")
    trace_name = data.get("trace_name")
    model = data.get("model")
    if not all([user_id, trace_name, model]):
        return jsonify(error="missing fields"), 400
    if trace_name not in TRACES[user_id]:
        return jsonify(error="not found"), 404
    TRACES[user_id][trace_name]["model"] = model
    return jsonify(ok=True)

# -------------------------------------------------
# ANALYSIS
# -------------------------------------------------


@app.post("/api/run_analysis")
def run_analysis():
    data = request.json or {}
    user_id = data.get("user_id")
    trace_name = data.get("trace_name")
    if not user_id or not trace_name:
        return jsonify(error="missing user_id/trace_name"), 400
    task_id = str(uuid.uuid4())
    ANALYSIS[task_id] = {"status": "pending", "progress": 0,
                         "user_id": user_id, "trace_name": trace_name}
    threading.Thread(target=analysis_worker, args=(
        task_id,), daemon=True).start()
    return jsonify(task_id=task_id)


@app.post("/api/stop_analysis")
def stop_analysis():
    data = request.json or {}
    user_id = data.get("user_id")
    trace_name = data.get("trace_name")
    for tid, st in list(ANALYSIS.items()):
        if st.get("user_id") == user_id and st.get("trace_name") == trace_name and st.get("status") in ("pending", "running"):
            ANALYSIS[tid]["status"] = "stopped"
    return jsonify(ok=True)


@app.get("/api/analysis_status/<task_id>")
def analysis_status(task_id):
    st = ANALYSIS.get(task_id)
    if not st:
        return jsonify(status="failed", progress=0, error="unknown task"), 404
    return jsonify(status=st["status"], progress=st["progress"])

# -------------------------------------------------
# DIAGNOSIS / CONTENT
# -------------------------------------------------


@app.post("/api/trace_examples/<trace_name>/final_diagnosis")
def final_diagnosis(trace_name):
    text = FINAL_DIAG_BY_TRACE.get(trace_name)
    if not text:
        return jsonify(error="not ready"), 404
    return jsonify(trace_diagnosis={"content": text, "sources": ["darshan: rank stats", "filesystem ops"]}, id=trace_name)


@app.post("/api/trace_examples/<trace_name>/original_trace")
def original_trace(trace_name):
    user_id = (request.json or {}).get("user_id")
    meta = TRACES[user_id].get(trace_name) if user_id in TRACES else None
    if not meta or not meta.get("files"):
        return jsonify(error="not found"), 404
    path = meta["files"][0]
    try:
        with open(path, "r", errors="ignore") as f:
            return jsonify(original_trace=f.read(4000))
    except Exception:
        return jsonify(original_trace="\n".join(os.path.basename(p) for p in meta["files"]))


@app.post("/api/trace_examples/<trace_name>/diagnosis_tree")
def diagnosis_tree(trace_name):
    return jsonify({"name": trace_name, "children": [
        {"name": "Check I/O balance",
            "children": [{"name": "Ranks 0..N stats"}]},
        {"name": "Identify hotspots", "children": [
            {"name": "MPI-IO calls"}, {"name": "Metadata"}]},
    ]})


@app.post("/api/trace_examples/<trace_name>/sample_questions")
def sample_questions(trace_name):
    return jsonify(["Which ranks are outliers?", "Is metadata time dominating?", "Show top 5 files by time."])


@app.post("/api/render_content")
def render_content():
    data = request.json or {}
    content = data.get("content", "")
    return content if isinstance(content, str) else jsonify(content)

# -------------------------------------------------
# Rule-based fallback (kept for no-key mode)
# -------------------------------------------------


def answer_question(user_id: str, trace_name: str, question: str) -> str:
    q = (question or "").strip().lower()
    diag = FINAL_DIAG_BY_TRACE.get(trace_name)

    if "top" in q and "file" in q:
        files = TRACES[user_id].get(trace_name, {}).get("files", [])
        names = [os.path.basename(p) for p in files]
        if names:
            top = names[:5]
            bullets = "\n".join(f"• {i+1}. {n}" for i, n in enumerate(top))
            return f"Top files seen for this trace (not ranked by time in this demo):\n{bullets}"
        return "I don’t see any files saved for this trace upload yet."

    if "metadata" in q:
        if diag and "metadata" in diag.lower():
            return f"From diagnosis: {diag}"
        return "Metadata can dominate when there are many small files or frequent open/close/stat calls. Consider aggregating small I/O and reducing file count."

    if "outlier" in q or "rank" in q:
        if diag:
            return f"From diagnosis: {diag}\nLikely a few ranks dominate I/O time. Consider collective I/O or balancing file access."
        return "Likely some ranks are outliers in I/O time. Compare per-rank bytes/ops; if a few dominate, try collective I/O and balanced access."

    if diag:
        return f"Current final diagnosis:\n{diag}"
    return "I don’t have a specific finding yet. Try running the analysis, then ask about outliers, metadata, or top files."

# -------------------------------------------------
# WebSocket: prefer LLM; fallback to rules
# -------------------------------------------------


@socketio.on("send_message")
def on_send_message(data):
    try:
        user_id = (data or {}).get("user_id", "")
        trace_name = (data or {}).get("trace_name", "")
        question = (data or {}).get("message", "")

        if not question:
            # Back-compat if chat_history is sent
            hist = (data or {}).get("chat_history", []) or []
            last_user = next((m for m in reversed(hist) if (
                m or {}).get("role") == "user"), None)
            question = (last_user or {}).get("content", "")

        question = (question or "").strip()
        if not question:
            emit("receive_message", {"reply": "Please type a question."})
            return

        if client:
            reply = llm_answer(user_id, trace_name, question)
        else:
            reply = answer_question(user_id, trace_name, question)

        emit("receive_message", {"reply": reply})
    except Exception:
        traceback.print_exc()
        emit("receive_message", {
             "reply": "An error occurred answering your question."})

# -------------------------------------------------
# Health
# -------------------------------------------------


@app.get("/api/health")
def health():
    return jsonify(ok=True)


if __name__ == "__main__":
    socketio.run(app, host="127.0.0.1", port=5001, debug=True)
