from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS

from ion.Completions import get_router, generate_completion
from src.LLM import SYSTEM_PROMPT_REVISED
from ion.Utils import get_metrics
from src.chat_agent import TOOLS, TOOL_FUNCTIONS

import json
import traceback
from concurrent.futures import ThreadPoolExecutor

# ---- Model bootstrap (keep lightweight) ----
models_list = [
    {
        "model_name": "gpt-4.1-mini",
        "litellm_params": {"model": "gpt-4.1-mini", "tpm": 3_000_000, "rpm": 3000}
    }
]
get_router(models_list)
CHAT_MODEL = "gpt-4.1-mini"

# ---- App + Socket.IO ----
app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://3.138.157.186",
        "http://ec2-3-138-157-186.us-east-2.compute.amazonaws.com",
    ],
    async_mode="threading",
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1024 * 1024,
)

tool_executor = ThreadPoolExecutor(max_workers=4)


def format_chat_prompt(messages, trace_diagnosis):
    # drop the first assistant “placeholder” if present
    msgs = list(messages or [])
    if len(msgs) and msgs[0].get("role") == "assistant":
        msgs = msgs[1:]
    system_message = {
        "role": "system",
        "content": SYSTEM_PROMPT_REVISED.format(
            trace_diagnosis=(trace_diagnosis or {}).get("content", "")
        ),
    }
    return [system_message] + msgs


def run_tool_call(function_name, function_args):
    fn = TOOL_FUNCTIONS[function_name]
    return fn(**function_args)


@socketio.on("connect")
def handle_connect():
    print("WS client connected")


@socketio.on("disconnect")
def handle_disconnect():
    print("WS client disconnected")


@socketio.on("send_message")
def handle_message(data):
    # Expected payload from FE:
    # { chat_history: [...], trace_diagnosis: {...}, trace_name: str, user_id: str }
    try:
        messages = data.get("chat_history") or []
        user_id = data.get("user_id")
        trace_diagnosis = data.get("trace_diagnosis") or {}
        trace_name = data.get("trace_name")

        prompt = format_chat_prompt(messages, trace_diagnosis)
        completion_message = generate_completion(
            CHAT_MODEL, prompt, tools=TOOLS, full_message=True
        )

        # Primary assistant content
        if getattr(completion_message, "content", None):
            emit("receive_message", {"role": "assistant",
                 "content": completion_message.content})

        # Tool calls
        if getattr(completion_message, "tool_calls", None):
            tool_calls = [tc.to_dict() for tc in completion_message.tool_calls]
            emit("receive_message", {
                "role": completion_message.role,
                "content": completion_message.content,
                "tool_calls": tool_calls,
            })

            for tc in completion_message.tool_calls:
                function_name = tc.function.name
                call_id = tc.id
                args = json.loads(tc.function.arguments or "{}")
                args["trace_name"] = trace_name
                args["user_id"] = user_id

                result, _last_msg = tool_executor.submit(
                    run_tool_call, function_name, args
                ).result()

                # Send tool result
                emit("receive_message", {
                     "role": "tool", "content": result, "tool_call_id": call_id})
                messages.append(
                    {"role": "tool", "content": result, "tool_call_id": call_id})

                # Follow-up assistant turn
                follow_prompt = format_chat_prompt(messages, trace_diagnosis)
                follow = generate_completion(CHAT_MODEL, follow_prompt)
                emit("receive_message", {
                     "role": "assistant", "content": follow})
                messages.append({"role": "assistant", "content": follow})

        # Optional: metrics
        try:
            metrics = get_metrics()
            print("[metrics]", metrics)
        except Exception:
            pass

    except Exception:
        print("WS error:\n", traceback.format_exc())
        emit(
            "error", {"message": "An error occurred while processing your message"})
    finally:
        emit("response_complete")


if __name__ == "__main__":
    # IMPORTANT: run on 5002 so it doesn't clash with your HTTP API (5001)
    socketio.run(app, host="0.0.0.0", port=5002)


# ---- Model bootstrap (keep lightweight) ----
models_list = [
    {
        "model_name": "gpt-4.1-mini",
        "litellm_params": {"model": "gpt-4.1-mini", "tpm": 3_000_000, "rpm": 3000}
    }
]
get_router(models_list)
CHAT_MODEL = "gpt-4.1-mini"

# ---- App + Socket.IO ----
app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://3.138.157.186",
        "http://ec2-3-138-157-186.us-east-2.compute.amazonaws.com",
    ],
    async_mode="threading",
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1024 * 1024,
)

tool_executor = ThreadPoolExecutor(max_workers=4)


def format_chat_prompt(messages, trace_diagnosis):
    # drop the first assistant “placeholder” if present
    msgs = list(messages or [])
    if len(msgs) and msgs[0].get("role") == "assistant":
        msgs = msgs[1:]
    system_message = {
        "role": "system",
        "content": SYSTEM_PROMPT_REVISED.format(
            trace_diagnosis=(trace_diagnosis or {}).get("content", "")
        ),
    }
    return [system_message] + msgs


def run_tool_call(function_name, function_args):
    fn = TOOL_FUNCTIONS[function_name]
    return fn(**function_args)


@socketio.on("connect")
def handle_connect():
    print("WS client connected")


@socketio.on("disconnect")
def handle_disconnect():
    print("WS client disconnected")


@socketio.on("send_message")
def handle_message(data):
    # Expected payload from FE:
    # { chat_history: [...], trace_diagnosis: {...}, trace_name: str, user_id: str }
    try:
        messages = data.get("chat_history") or []
        user_id = data.get("user_id")
        trace_diagnosis = data.get("trace_diagnosis") or {}
        trace_name = data.get("trace_name")

        prompt = format_chat_prompt(messages, trace_diagnosis)
        completion_message = generate_completion(
            CHAT_MODEL, prompt, tools=TOOLS, full_message=True
        )

        # Primary assistant content
        if getattr(completion_message, "content", None):
            emit("receive_message", {"role": "assistant",
                 "content": completion_message.content})

        # Tool calls
        if getattr(completion_message, "tool_calls", None):
            tool_calls = [tc.to_dict() for tc in completion_message.tool_calls]
            emit("receive_message", {
                "role": completion_message.role,
                "content": completion_message.content,
                "tool_calls": tool_calls,
            })

            for tc in completion_message.tool_calls:
                function_name = tc.function.name
                call_id = tc.id
                args = json.loads(tc.function.arguments or "{}")
                args["trace_name"] = trace_name
                args["user_id"] = user_id

                result, _last_msg = tool_executor.submit(
                    run_tool_call, function_name, args
                ).result()

                # Send tool result
                emit("receive_message", {
                     "role": "tool", "content": result, "tool_call_id": call_id})
                messages.append(
                    {"role": "tool", "content": result, "tool_call_id": call_id})

                # Follow-up assistant turn
                follow_prompt = format_chat_prompt(messages, trace_diagnosis)
                follow = generate_completion(CHAT_MODEL, follow_prompt)
                emit("receive_message", {
                     "role": "assistant", "content": follow})
                messages.append({"role": "assistant", "content": follow})

        # Optional: metrics
        try:
            metrics = get_metrics()
            print("[metrics]", metrics)
        except Exception:
            pass

    except Exception:
        print("WS error:\n", traceback.format_exc())
        emit(
            "error", {"message": "An error occurred while processing your message"})
    finally:
        emit("response_complete")


if __name__ == "__main__":
    # IMPORTANT: run on 5002 so it doesn't clash with your HTTP API (5001)
    socketio.run(app, host="0.0.0.0", port=5002)
