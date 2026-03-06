import argparse
import sys
import shutil
from pathlib import Path

from utils.task import TaskManager
from video.processor import extract_audio
from asr.recognizer import ASRRecognizer
from llm.generator import ArticleGenerator
from screenshot.extractor import ScreenshotExtractor
from utils.html_builder import build_html_article

def main():
    parser = argparse.ArgumentParser(description="Clip2Post - Video to Article CLI")
    parser.add_argument("--video", "-v", required=True, type=str, help="Path to the input video file (e.g., .mp4, .mov)")
    args = parser.parse_args()

    video_input_path = Path(args.video).resolve()
    
    if not video_input_path.exists():
        print(f"Error: Video file not found at {video_input_path}")
        sys.exit(1)

    print("--- Starting Clip2Post CLI processing ---")
    
    # Initialize heavy models once globally to avoid reloading on each request
    print("[1/6] Loading Models...")
    try:
        asr_model = ASRRecognizer()
        llm_model = ArticleGenerator()
        screenshot_tool = ScreenshotExtractor()
    except Exception as e:
        print(f"Error loading models. Have you configured your .env file with OPENAI_API_KEY? Details: {e}")
        sys.exit(1)

    # Step 1: Initialize Task
    print(f"[2/6] Initializing Task directory for {video_input_path.name}...")
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    target_video_path = task_manager.get_dir("video") / "source.mp4"
    shutil.copy(video_input_path, target_video_path)
    print(f"      Task ID generated: {task_id}")
    
    try:
        # Step 2: Audio Extraction
        print("[3/6] Extracting audio...")
        audio_path = task_manager.get_dir("audio") / "audio.wav"
        extract_audio(target_video_path, audio_path)
        
        # Step 3: ASR (Subtitle Generation)
        print("[4/6] Recognizing speech to subtitles...")
        subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
        
        # Also save raw text alongside
        raw_text_dir = task_manager.get_dir("raw_text")
        raw_output_path = raw_text_dir / "asr_output.txt"
        
        asr_model.recognize(audio_path, subtitle_path, raw_output_path)
            
        # Step 4: LLM Generation (Article & Image JSON)
        print("[5/6] Generating article via AI...")
        article_path = task_manager.get_dir("ai") / "article.md"
        image_json_path = task_manager.get_dir("ai") / "image.json"
        llm_model.generate(subtitle_path, article_path, image_json_path)

        # Step 5: Screen Capture
        print("[6/6] Capturing screenshots and building HTML...")
        images_dir = task_manager.get_dir("images")
        images_data = screenshot_tool.extract(target_video_path, image_json_path, images_dir)
        
        # Step 6: HTML Generation
        html_path = task_manager.get_dir("article") / "article.html"
        build_html_article(article_path, images_data, html_path)

        print("\n=== Processing Complete! ===")
        print(f"Success! The resulting article and assets can be found at:")
        print(f"  {task_manager.task_dir}")
        print(f"\nHTML File: {html_path}")

    except Exception as e:
        import traceback
        print(f"\n[ERROR] Pipeline failed during execution:")
        print(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
