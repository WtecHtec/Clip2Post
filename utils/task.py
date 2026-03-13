import uuid
import datetime
from pathlib import Path
from config.settings import TASKS_DIR

class TaskManager:
    def __init__(self, task_id: str = None):
        if task_id:
            self.task_id = task_id
        else:
            self.task_id = self._generate_task_id()
            
        self.task_dir = TASKS_DIR / self.task_id
        self._ensure_directories()
        self.status_file = self.task_dir / "status.json"
        
        # Initialize status file if it doesn't exist
        if not task_id or not self.status_file.exists():
            self.update_status(0.0, "任务初始化", "pending")

    def _generate_task_id(self) -> str:
        now = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        uid = str(uuid.uuid4())[:4]
        return f"{now}_{uid}"

    def _ensure_directories(self):
        """Create necessary subdirectories for the task."""
        subdirs = ["video", "audio", "subtitle", "ai", "images", "article"]
        for subdir in subdirs:
            (self.task_dir / subdir).mkdir(parents=True, exist_ok=True)
            
    def get_dir(self, name: str) -> Path:
        """Get path to a specific subdirectory."""
        return self.task_dir / name

    def update_status(self, progress: float, desc: str, state: str = "processing", task_type: str = None):
        """Update the status of the task."""
        import json
        
        # Load existing status to preserve task_type if not provided
        status_data = {}
        if self.status_file.exists():
            try:
                with open(self.status_file, "r", encoding="utf-8") as f:
                    status_data = json.load(f)
            except:
                pass

        status_data.update({
            "progress": progress,
            "desc": desc,
            "state": state
        })
        
        if task_type:
            status_data["task_type"] = task_type
            
        with open(self.status_file, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False)

    def get_status(self) -> dict:
        """Read current task status."""
        import json
        if self.status_file.exists():
            with open(self.status_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"progress": 0, "desc": "Unknown", "state": "error"}

