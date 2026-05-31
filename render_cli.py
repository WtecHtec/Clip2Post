import argparse
import os
import json
import sys
import re
from pathlib import Path

# Add current directory to path so we can import video modules
sys.path.append(os.getcwd())

from video.remotion_renderer import RemotionRenderer
from utils.task import TaskManager

def strip_punctuation(text):
    """Removes common Chinese and English punctuation from text."""
    if not text:
        return ""
    # Regex to match most common punctuation marks
    pattern = r'[，。！？；：、（）“”‘’【】《》,.!?;:()\"\'\[\]\-\—]'
    return re.sub(pattern, '', text).strip()

def process_scenes_and_generate_tts(task_id, scenes, meta, clean_punctuation=True):
    """Generates new TTS and updates remotion_props.json based on provided scenes."""
    task_manager = TaskManager(task_id=task_id)
    
    # 1. Join all scene texts for TTS
    voiceover_text = " ".join([s.get("text", "").strip() for s in scenes])
    print(f"Generating new TTS for text: {voiceover_text[:50]}...")
    
    tts_engine = meta.get("tts_engine", "edge")
    voice = meta.get("voice", "")
    
    audio_dir = task_manager.get_dir("audio")
    output_base = audio_dir / "tts_output"
    
    # 2. Generate TTS (replicating main.py logic)
    if tts_engine == "kokoro":
        voice = voice or "af_heart"
        from tts.kokoro_processor import run_kokoro_tts_sync
        audio_path, json_path = run_kokoro_tts_sync(voiceover_text, str(output_base), voice=voice)
    elif tts_engine == "chattts":
        from tts.chattts_processor import run_chattts_sync
        audio_path, json_path = run_chattts_sync(
            voiceover_text, str(output_base), voice=voice,
            temperature=meta.get("temperature", 0.3), 
            top_p=meta.get("top_p", 0.7), 
            top_k=meta.get("top_k", 20), 
            speed=meta.get("speed", 1.0), 
            refine_text_flag=meta.get("refine_text", True)
        )
    elif tts_engine == "omnivoice":
        from tts.omnivoice_processor import run_omnivoice_tts_sync
        audio_path, json_path = run_omnivoice_tts_sync(voiceover_text, str(output_base), voice_instruct=voice)
    elif tts_engine == "voxcpm":
        from tts.voxcpm_processor import run_voxcpm_tts_sync
        audio_path, json_path = run_voxcpm_tts_sync(voiceover_text, str(output_base), voice=voice)
    else:
        voice = voice or "zh-CN-XiaoxiaoNeural"
        from tts.processor import run_tts_sync
        audio_path, json_path = run_tts_sync(voiceover_text, str(output_base), voice=voice)

    with open(json_path, 'r', encoding='utf-8') as f:
        captions = json.load(f)
        
    # 3. Clean captions and map images (replicating main.py logic)
    current_scene_idx = 0
    current_scene_text_accum = ""
    
    # Get user images from meta if available
    user_images = meta.get("user_images", [])
    valid_image_urls = {img['url'] for img in user_images}
    
    for c in captions:
        if "text" in c:
            # Strip punctuation if requested
            display_text = c["text"]
            if clean_punctuation:
                display_text = strip_punctuation(display_text)
            
            # Still use re.sub for any internal tags [bracketed]
            c["text"] = re.sub(r'\[.*?\]\s*', '', display_text).strip()
            
            scene = scenes[current_scene_idx] if current_scene_idx < len(scenes) else scenes[-1]
            
            img_url = scene.get("image_url", "")
            if img_url and valid_image_urls and img_url not in valid_image_urls:
                print(f"      [Warning] Filtering hallucinated image_url: {img_url}")
                img_url = ""
            
            c["image_url"] = img_url
            c["visual_suggestion"] = scene.get("visual", "")
            
            # Map back to original text for scene advancement logic
            current_scene_text_accum += re.sub(r'\[.*?\]\s*', '', display_text).strip()
            if current_scene_idx < len(scenes) - 1:
                target_text = scenes[current_scene_idx].get("text", "").strip()
                # Use length ratio to advance scenes
                if len(current_scene_text_accum) >= len(target_text) * 0.9:
                    current_scene_idx += 1
                    current_scene_text_accum = ""
    
    # 4. Prepare props
    audio_abs_url = f"http://localhost:8000/tasks/{task_id}/audio/{Path(audio_path).name}"
    props = {
        "captions": captions,
        "audioUrl": audio_abs_url,
        "aspectRatio": meta.get("aspect_ratio", "9:16")
    }
    if meta.get("bgm"):
        props["bgm"] = meta.get("bgm")
        
    # Save remotion_props.json
    props_path = task_manager.get_dir("") / "remotion_props.json"
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    
    print(f"Updated remotion_props.json and generated new audio: {audio_path}")
    return props, props_path

def main():
    parser = argparse.ArgumentParser(description="Manual Remotion Video Renderer CLI")
    parser.add_argument("--task_id", required=True, help="Task ID (e.g. 20260504_144656_db2b)")
    parser.add_argument("--tsx_path", required=True, help="Path to the dynamic .tsx file")
    parser.add_argument("--scenes", help="JSON string or path to .json file containing scenes array")
    parser.add_argument("--audio_path", help="Path to a custom TTS audio file (optional)")
    parser.add_argument("--props_path", help="Path to custom remotion_props.json (optional)")
    parser.add_argument("--only_tts", action="store_true", help="Only generate TTS and props, do not render video")
    parser.add_argument("--keep_punctuation", action="store_true", help="Keep punctuation in subtitles")
    
    args = parser.parse_args()
    
    task_dir = Path("tasks") / args.task_id
    if not task_dir.exists():
        print(f"Error: Task directory {task_dir} not found.")
        return

    # Load meta.json
    meta_path = task_dir / "user_prompt" / "meta.json"
    meta = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

    # 1. Handle Scenes / TTS Generation
    if args.scenes is not None:
        try:
            scenes = None
            # Case 1: JSON string
            if args.scenes.strip().startswith("["):
                scenes = json.loads(args.scenes)
            else:
                # Case 2: Explicit file path
                scenes_file = Path(args.scenes)
                if not scenes_file.exists():
                    # Case 3: Auto-search in task directory
                    scenes_file = task_dir / "new_scenes.json"
                
                if scenes_file.exists():
                    print(f"Loading scenes from: {scenes_file}")
                    with open(scenes_file, "r", encoding="utf-8") as f:
                        scenes = json.load(f)
                else:
                    raise ValueError(f"Scenes data not found (tried argument as string/path, and {task_dir}/new_scenes.json)")
            
            if scenes:
                props, props_path = process_scenes_and_generate_tts(
                    args.task_id, scenes, meta, 
                    clean_punctuation=not args.keep_punctuation
                )
        except Exception as e:
            print(f"Error processing scenes: {e}")
            return
    else:
        # Load existing props
        props_path = Path(args.props_path) if args.props_path else task_dir / "remotion_props.json"
        if not props_path.exists():
            print(f"Error: Props file {props_path} not found.")
            return
        with open(props_path, "r", encoding="utf-8") as f:
            props = json.load(f)
            
        # If we are loading existing props but want to clean punctuation
        if not args.keep_punctuation:
            changed = False
            for c in props.get("captions", []):
                old_text = c.get("text", "")
                new_text = strip_punctuation(old_text)
                if old_text != new_text:
                    c["text"] = new_text
                    changed = True
            if changed:
                with open(props_path, "w", encoding="utf-8") as f:
                    json.dump(props, f, ensure_ascii=False, indent=2)
                print(f"Punctuation cleaned in {props_path}")

    # If only_tts flag is set, stop here
    if args.only_tts:
        print("\n[Mode] Only TTS/Props generation completed. Rendering skipped as requested.")
        return

    # 2. Update audio URL if a custom audio path is provided
    if args.audio_path:
        audio_file = Path(args.audio_path)
        if not audio_file.exists():
             print(f"Warning: Audio file {args.audio_path} not found.")
        else:
            audio_name = audio_file.name
            props["audioUrl"] = f"http://localhost:8000/tasks/{args.task_id}/audio/{audio_name}"
            print(f"Updated audioUrl to: {props['audioUrl']}")
            with open(props_path, "w", encoding="utf-8") as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

    # 3. Prepare Renderer
    remotion_dir = Path("skills/remotion")
    renderer = RemotionRenderer(remotion_dir)
    
    # 4. Handle TSX and generate Index
    tsx_path = Path(args.tsx_path).resolve()
    if not tsx_path.exists():
        print(f"Error: TSX file {tsx_path} not found.")
        return
        
    scene_id = tsx_path.stem 
    if scene_id.startswith("index_"):
        scene_id = scene_id.replace("index_", "")
    
    aspect_ratio = props.get("aspectRatio", meta.get("aspect_ratio", "9:16"))
    width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
    
    captions = props.get("captions", [])
    total_duration_ms = captions[-1]["endMs"] if captions else 5000
    duration_frames = int((total_duration_ms / 1000) * 30) + 60

    index_path = tsx_path.parent / f"index_{scene_id}.tsx"
    
    if index_path.exists():
        print(f"Notice: Entry file {index_path} already exists. Updating durationInFrames...")
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Update durationInFrames using regex
            new_content = re.sub(
                r'durationInFrames=\{[0-9]+\}', 
                f'durationInFrames={{{duration_frames}}}', 
                content
            )
            
            if new_content != content:
                with open(index_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"      [Success] Updated durationInFrames to {duration_frames}")
        except Exception as e:
            print(f"      [Error] Failed to update durationInFrames: {e}")
    else:
        print(f"Generating entry file: {index_path}")
        index_content = f"""import {{ registerRoot, Composition }} from 'remotion';
import Scene from './{scene_id}';

const RemotionRoot = () => {{
  return (
    <>
      <Composition
        id="{scene_id}"
        component={{Scene}}
        durationInFrames={{{duration_frames}}}
        fps={{30}}
        width={{{width}}}
        height={{{height}}}
      />
    </>
  );
}};

registerRoot(RemotionRoot);
"""
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(index_content)
    
    # 5. Execute Render
    output_path = task_dir / "videos" / f"render_{scene_id}.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"\n--- Render Start ---")
    print(f"Task ID: {args.task_id}")
    print(f"Component: {scene_id}")
    print(f"Duration: {duration_frames} frames")
    print(f"Output: {output_path}")
    print(f"--------------------\n")
    
    success = renderer.render(
        props_path=str(props_path),
        output_path=str(output_path),
        duration_frames=duration_frames,
        composition_id=scene_id,
        entry_file=str(index_path.relative_to(remotion_dir.resolve()))
    )
    
    if success:
        print(f"\n[Success] Video rendered to: {output_path}")
    else:
        print(f"\n[Error] Render failed.")

if __name__ == "__main__":
    main()
