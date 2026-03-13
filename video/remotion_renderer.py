import subprocess
import json
import os
from pathlib import Path
from config.settings import TASKS_DIR

class RemotionRenderer:
    def __init__(self, remotion_dir):
        self.remotion_dir = Path(remotion_dir).resolve()
        if not self.remotion_dir.exists():
            raise FileNotFoundError(f"Remotion directory not found at {self.remotion_dir}")
        self.ensure_symlink()

    def ensure_symlink(self):
        """Ensure a symlink exists from public/tasks to the root tasks directory."""
        public_dir = self.remotion_dir / "public"
        public_dir.mkdir(parents=True, exist_ok=True)
        tasks_symlink = public_dir / "tasks"
        # Check if it exists or is a broken symlink
        if not tasks_symlink.exists() and not tasks_symlink.is_symlink():
            try:
                os.symlink(TASKS_DIR.absolute(), tasks_symlink)
                print(f"      Created symlink: {tasks_symlink} -> {TASKS_DIR.absolute()}")
            except Exception as e:
                print(f"      Warning: Failed to create symlink: {e}")

    def render(self, props_path, output_path, duration_frames=300):
        """
        Render video using Remotion CLI.
        """
        props_path = Path(props_path).resolve()
        output_path = Path(output_path).resolve()
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            "npx", "remotion", "render",
            "src/index.ts", "MyScene",
            str(output_path),
            f"--props={str(props_path)}",
            f"--duration={duration_frames}"
        ]

        print(f"      Running Remotion render command...")
        print(f"      Cmd: {' '.join(cmd)}")
        
        try:
            # Run in the remotion directory
            process = subprocess.run(
                cmd,
                cwd=str(self.remotion_dir),
                check=True,
                capture_output=True,
                text=True
            )
            print(f"      Render successful: {output_path}")
            return str(output_path)
        except subprocess.CalledProcessError as e:
            print(f"      Error during Remotion render: {e.stderr}")
            raise e

def run_remotion_render(props_path, output_path, duration_frames=300):
    # Default path relative to project root
    remotion_dir = Path(__file__).parent.parent / "skills" / "remotion"
    renderer = RemotionRenderer(remotion_dir)
    return renderer.render(props_path, output_path, duration_frames)
