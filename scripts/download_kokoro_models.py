import os
import requests
from pathlib import Path

def download_file(url, target_path):
    print(f"Downloading {url} to {target_path}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(target_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print("Done.")

def main():
    model_dir = Path("models/kokoro")
    model_dir.mkdir(parents=True, exist_ok=True)

    # URLs for Kokoro v1.0 ONNX models
    files = {
        "kokoro-v1.0.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
        "voices-v1.0.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
    }

    for filename, url in files.items():
        target = model_dir / filename
        if not target.exists():
            download_file(url, target)
        else:
            print(f"{filename} already exists at {target}")

if __name__ == "__main__":
    main()
