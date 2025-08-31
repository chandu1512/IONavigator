import os
import json
import uuid
import threading
from typing import Dict, Any, Tuple, List

_DB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "local_db")
_DB_PATH = os.path.join(_DB_DIR, "users.json")
_lock = threading.Lock()


def _load() -> Dict[str, Any]:
    os.makedirs(_DB_DIR, exist_ok=True)
    if not os.path.exists(_DB_PATH):
        return {}
    try:
        with open(_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save(db: Dict[str, Any]) -> None:
    os.makedirs(_DB_DIR, exist_ok=True)
    with open(_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)


def _find_user(db: Dict[str, Any], *, user_id: str | None = None, email: str | None = None):
    for uid, rec in db.items():
        if user_id and uid == user_id:
            return uid, rec
        if email and rec.get("Email") == email:
            return uid, rec
    return None, None


def add_user(email: str) -> Tuple[str, str, int]:
    """Return (user_id, message, status_code). Stable UUID derived from email."""
    with _lock:
        db = _load()
        uid, rec = _find_user(db, email=email)
        if rec:
            return uid, "User already exists", 200
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, "ion://" + email))
        db[uid] = {"Email": email, "user_id": uid,
                   "traces": {}, "messages": {}}
        _save(db)
        return uid, "User created", 200


def upsert_trace(user_id: str, trace_name: str, metadata: Dict[str, Any]) -> bool:
    with _lock:
        db = _load()
        uid, rec = _find_user(db, user_id=user_id)
        if not rec:
            db[user_id] = {"Email": "unknown",
                           "user_id": user_id, "traces": {}, "messages": {}}
            rec = db[user_id]
        rec.setdefault("traces", {})[trace_name] = metadata or {}
        _save(db)
        return True


def get_user_traces(user_id: str, search: str = "", page: int = 1, page_size: int = 10) -> List[Dict[str, Any]]:
    db = _load()
    _, rec = _find_user(db, user_id=user_id)
    items: List[Dict[str, Any]] = []
    if rec and isinstance(rec.get("traces"), dict):
        for name, meta in rec["traces"].items():
            if search.lower() not in name.lower():
                continue
            m = meta if isinstance(meta, dict) else {}
            items.append({
                "trace_name": name,
                "upload_date": m.get("upload_date", ""),
                "status": m.get("status", "not_started"),
                "model": m.get("model", "gpt-4o"),
                "trace_description": m.get("trace_description", "")
            })
    # newest first
    items.sort(key=lambda r: r.get("upload_date", ""), reverse=True)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    return items[start:end]
