import threading

# In-memory session manager for Option B (post-upload media binding)
# open_id -> { "task_id": str, "json_data": dict, "latest_media_path": str, "latest_media_name": str, "card_message_id": str, "created_at": datetime }
active_sessions = {}
active_sessions_lock = threading.Lock()

def get_session(open_id: str) -> dict:
    with active_sessions_lock:
        return active_sessions.get(open_id)

def set_session(open_id: str, session_data: dict) -> None:
    with active_sessions_lock:
        active_sessions[open_id] = session_data

def delete_session(open_id: str) -> None:
    with active_sessions_lock:
        active_sessions.pop(open_id, None)
