import io
import json
import os
import queue
import shutil
import threading
import time
import traceback
import uuid
from enum import Enum
from typing import Dict, Optional

from service_config.s3_config import s3_client

ANALYSIS_DIR = "./tmp_analysis"
os.makedirs(ANALYSIS_DIR, exist_ok=True)


class TaskStatus(Enum):
    NOT_STARTED = "not_started"
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Task:
    def __init__(self, task_id: str, user_id: str, trace_name: str, model_info: Dict[str, str]):
        self.task_id = task_id
        self.user_id = user_id
        self.trace_name = trace_name
        self.model_engine = (model_info or {}).get(
            "model") or (model_info or {}).get("key") or ""
        self.status = TaskStatus.PENDING
        self.progress = 0
        self.result = None
        self.error = None
        self.start_time = None
        self.end_time = None


class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.task_queue = queue.Queue()
        self.worker_thread = threading.Thread(
            target=self._process_tasks, daemon=True)
        self.worker_thread.start()
        self.stop_flags: Dict[str, bool] = {}

    def submit_task(self, user_id: str, trace_name: str, model_info: Dict[str, str]) -> str:
        task_id = str(uuid.uuid4())
        task = Task(task_id, user_id, trace_name, model_info)
        self.tasks[task_id] = task
        self.task_queue.put(task)
        return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict]:
        t = self.tasks.get(task_id)
        if not t:
            return None
        return {
            "task_id": t.task_id,
            "status": t.status.value,
            "progress": t.progress,
            "result": t.result,
            "error": t.error,
        }

    def stop_task(self, user_id: str, trace_name: str) -> bool:
        for t in self.tasks.values():
            if t.user_id == user_id and t.trace_name == trace_name and t.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
                self.stop_flags[t.task_id] = True
                t.status = TaskStatus.FAILED
                t.error = "Task stopped by user"
                self._update_metadata(t, "stopped")
                return True
        return False

    def _process_tasks(self):
        while True:
            task: Task = self.task_queue.get()
            try:
                self._run_task(task)
            except Exception:
                print("Task error:\n", traceback.format_exc())
            finally:
                self.task_queue.task_done()

    # ---- helpers -------------------------------------------------------------
    def _update_metadata(self, task: Task, status: str):
        try:
            key = f"{task.user_id}/{task.trace_name}/metadata.json"
            blob = s3_client.download_file(key)
            meta = json.loads(blob.decode("utf-8")) if blob else {}
            meta["status"] = status
            s3_client.upload_file(io.BytesIO(json.dumps(meta).encode()), key)
        except Exception as e:
            print("metadata update failed:", e)

    def _safe_upload(self, data: bytes, key: str):
        try:
            s3_client.upload_file(io.BytesIO(data), key)
            print(f"[upload OK] {key}")
        except Exception as e:
            print(f"[upload FAIL] {key} -> {e}")

    # ---- core ---------------------------------------------------------------
    def _run_task(self, task: Task):
        analysis_dir = os.path.join(
            ANALYSIS_DIR, task.user_id, task.trace_name)
        os.makedirs(analysis_dir, exist_ok=True)
        base_prefix = f"{task.user_id}/{task.trace_name}/Output"
        try:
            print(f"[{task.task_id}] Start analysis model={task.model_engine}")
            task.status = TaskStatus.RUNNING
            task.start_time = time.time()
            task.progress = 10
            self._update_metadata(task, "running")

            # Try finding processed_data. If missing or error, write placeholders.
            processed_prefix = f"{task.user_id}/{task.trace_name}/processed_data"
            try:
                objects = s3_client.list_objects(processed_prefix) or []
            except Exception as e:
                print(f"[{task.task_id}] list_objects error: {e}")
                objects = []

            if not objects:
                print(
                    f"[{task.task_id}] No processed_data -> writing placeholder outputs.")
                final_payload = {
                    "diagnosis": "Dev placeholder: analysis completed. Provide processed_data to run full pipeline.",
                    "sources": {}
                }

            tree_payload = {"name": "Root", "children": [
                {"name": "Ingest", "status": "done"}]}

            base_prefix = f"{task.user_id}/{task.trace_name}/Output"
            self._safe_upload(json.dumps(final_payload).encode(),
                              f"{base_prefix}/final_diagnosis/final_diagnosis.json")
            self._safe_upload(json.dumps(tree_payload).encode(),
                              f"{base_prefix}/tree.json")

            task.progress = 100
            task.status = TaskStatus.COMPLETED
            self._update_metadata(task, "completed")
            return

            # If you have a real pipeline, plug it in here (download files to analysis_dir and run).
            # For now we still write placeholders to keep UI happy.
            final_payload = {
                "diagnosis": "Analysis ran with sample pipeline.",
                "sources": {}
            }
            tree_payload = {"name": "Root", "children": [
                {"name": "Processing", "status": "done"}]}
            self._safe_upload(json.dumps(final_payload).encode(
            ), f"{base_prefix}/final_diagnosis/final_diagnosis.json")
            self._safe_upload(json.dumps(tree_payload).encode(),
                              f"{base_prefix}/tree.json")

            task.progress = 100
            task.status = TaskStatus.COMPLETED
            self._update_metadata(task, "completed")

        except Exception:
            print(f"[{task.task_id}] ERROR:\n", traceback.format_exc())
            task.status = TaskStatus.FAILED
            task.error = "Analysis failed"
            self._update_metadata(task, "failed")
        finally:
            task.end_time = time.time()
            try:
                if os.path.isdir(analysis_dir):
                    shutil.rmtree(analysis_dir)
            except Exception:
                print("cleanup failed:\n", traceback.format_exc())


# Global instance
task_manager = TaskManager()
