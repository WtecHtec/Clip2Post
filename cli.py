import argparse
import sys
import shutil
import json
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
    parser.add_argument("--asr", type=str, choices=["funasr", "faster-whisper", "whisperx"], help="ASR engine to use")
    parser.add_argument("--transcribe-only", action="store_true", help="Only extract audio and generate subtitles/raw text")
    parser.add_argument("--extract-clips", action="store_true", help="Extract high-value video clips based on dialogue content")
    parser.add_argument("--add-text-overlay", action="store_true", help="Add LLM-generated summary overlay to exported clips (requires --extract-clips)")
    parser.add_argument("--screenshots-only", type=str, help="Path to image.json to only extract screenshots and build HTML")
    args = parser.parse_args()

    video_input_path = Path(args.video).resolve()
    
    if not video_input_path.exists():
        print(f"Error: Video file not found at {video_input_path}")
        sys.exit(1)

    print("--- Starting Clip2Post CLI processing ---")
    
    # Initialize task
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    target_video_path = task_manager.get_dir("video") / "source.mp4"
    if not args.screenshots_only or not target_video_path.exists():
        print(f"      Initializing Task directory for {video_input_path.name}...")
        shutil.copy(video_input_path, target_video_path)
    print(f"      Task ID: {task_id}")

    try:
        if args.screenshots_only:
            print("[1/2] Loading Models for Screenshot Extraction...")
            screenshot_tool = ScreenshotExtractor()
            
            image_json_path = Path(args.screenshots_only).resolve()
            if not image_json_path.exists():
                print(f"Error: image.json not found at {image_json_path}")
                sys.exit(1)
            
            # Use original article.md if available, otherwise empty
            article_path = task_manager.get_dir("ai") / "article.md"
            if not article_path.exists():
                article_path.touch()

            print("[2/2] Capturing screenshots and building HTML...")
            images_dir = task_manager.get_dir("images")
            images_data = screenshot_tool.extract(target_video_path, image_json_path, images_dir)
            
            html_path = task_manager.get_dir("article") / "article.html"
            build_html_article(article_path, images_data, html_path)
            
            print(f"\nSuccess! HTML File: {html_path}")
            return

        # Standard or Transcribe-only flow
        print("[1/6] Loading ASR Model...")
        try:
            asr_model = ASRRecognizer(asr_type=args.asr)
        except Exception as e:
            print(f"Error loading ASR model. Details: {e}")
            sys.exit(1)
        
        # Step 2: Audio Extraction
        print("[2/6] Extracting audio...")
        audio_path = task_manager.get_dir("audio") / "audio.wav"
        extract_audio(target_video_path, audio_path)
        
        # Step 3: ASR (Subtitle Generation)
        print("[3/6] Recognizing speech to subtitles...")
        subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
        raw_output_path = task_manager.get_dir("raw_text") / "asr_output.txt"
        asr_model.recognize(audio_path, subtitle_path, raw_output_path)
        
        if args.transcribe_only:
            print("\nTranscription complete! files saved in:")
            print(f"  Audio: {audio_path}")
            print(f"  Subtitle: {subtitle_path}")
            print(f"  Raw Text: {raw_output_path}")
            return

        if args.extract_clips:
            from llm.clip_generator import ClipGenerator
            from video.processor import cut_video_segments
            
            print("[4/4] Extracting high-value clips via LLM...")
            try:
                clip_generator = ClipGenerator()
            except Exception as e:
                print(f"Error loading LLM for clips. Details: {e}")
                sys.exit(1)
                
            clips_json_path = task_manager.get_dir("ai") / "clips.json"
            clip_generator.generate(subtitle_path, clips_json_path)
            
            with open(clips_json_path, 'r', encoding='utf-8') as f:
                clips_data = json.load(f)
                
            print(f"      Found {len(clips_data)} clips. Cutting video...")
            videos_output_dir = task_manager.get_dir("videos")
            
            cut_video_segments(target_video_path, clips_data, videos_output_dir, add_overlay=args.add_text_overlay)
            print(f"\nClip extraction complete! Clips saved to: {videos_output_dir}")
            return

        # Continue with full pipeline
        print("[4/6] Loading LLM and Screenshot Models...")
        try:
            llm_model = ArticleGenerator()
            screenshot_tool = ScreenshotExtractor()
        except Exception as e:
            print(f"Error loading LLM/Screenshot models. Have you configured your .env file with OPENAI_API_KEY? Details: {e}")
            sys.exit(1)

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

        print(f"\n=== Processing Complete! ===")
        print(f"Task dir: {task_manager.task_dir}")
        print(f"HTML File: {html_path}")

    except Exception as e:
        import traceback
        print(f"\n[ERROR] Pipeline failed:")
        print(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
