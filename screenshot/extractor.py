import json
import ffmpeg
from pathlib import Path

class ScreenshotExtractor:
    def extract(self, video_path: Path, image_json_path: Path, output_images_dir: Path):
        """
        Reads image.json and extracts a frame at each specified timestamp.
        """
        with open(image_json_path, 'r', encoding='utf-8') as f:
            images_data = json.load(f)

        image_files = []
        for idx, item in enumerate(images_data, 1):
            time_str = item.get("time")
            if not time_str:
                continue
                
            img_filename = f"img_{idx:02d}.jpg"
            img_path = output_images_dir / img_filename
            
            try:
                (
                    ffmpeg
                    .input(str(video_path), ss=time_str)
                    .output(str(img_path), vframes=1)
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
                image_files.append({
                    "time": time_str,
                    "desc": item.get("desc", ""),
                    "path": img_filename # Store relative path for HTML
                })
            except ffmpeg.Error as e:
                print(f"Failed to extract frame at {time_str}: {e.stderr.decode()}")
                
        return image_files
