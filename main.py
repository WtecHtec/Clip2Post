import os
import shutil
import asyncio
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config.settings import TASKS_DIR
from utils.task import TaskManager
from video.processor import extract_audio
from video.downloader import VideoDownloader
from asr.recognizer import ASRRecognizer
from llm.generator import ArticleGenerator
from screenshot.extractor import ScreenshotExtractor
from utils.html_builder import build_html_article
from tts.processor import run_tts_sync
from tts.kokoro_processor import run_kokoro_tts_sync
from tts.voxcpm_processor import run_voxcpm_tts_sync
from tts.mlx_processor import run_mlx_tts_sync
from video.remotion_renderer import run_remotion_render
import json

# Initialize NLP models (global ones that don't need heavy loading at startup)
screenshot_tool = ScreenshotExtractor()

app = FastAPI(title="Clip2Post V2 API")



# Allow CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount tasks directory for static file access (images, html)
app.mount("/tasks", StaticFiles(directory=str(TASKS_DIR)), name="tasks")

# Mount bgm directory so Remotion can download BGM via 127.0.0.1:8000/bgm/
_BGM_DIR = Path(__file__).parent / "bgm"
_BGM_DIR.mkdir(exist_ok=True)
app.mount("/bgm", StaticFiles(directory=str(_BGM_DIR)), name="bgm")

# Mount bgImages directory for static file access
_BGIMAGES_DIR = Path(__file__).parent / "bgImages"
_BGIMAGES_DIR.mkdir(exist_ok=True)
app.mount("/bgImages", StaticFiles(directory=str(_BGIMAGES_DIR)), name="bgImages")

def process_video_pipeline(
    task_id: str, 
    video_path: Path, 
    video_url: str = "",
    asr_engine: str = "funasr",
    extract_clips_flag: bool = False, 
    add_overlay_flag: bool = False,
    generate_article_flag: bool = True, 
    generate_images_flag: bool = True,
    generate_html_flag: bool = True,
    custom_prompt: str = "",
    llm_api_key: str = "",
    llm_base_url: str = "",
    llm_model_name: str = ""
):
    """Background task to process the video step-by-step."""
    task_manager = TaskManager(task_id=task_id)
    
    try:
        # Step 1: Download from URL if provided and file not already present
        if video_url and not video_path.exists():
            task_manager.update_status(0.1, "正在通过链接下载视频...", "processing")
            VideoDownloader.download(video_url, video_path)

        if not video_path.exists():
            raise FileNotFoundError("没有找到可用的视频文件，请上传文件或提供有效的视频链接。")

        # Step 2: Audio Extraction
        task_manager.update_status(0.2, "正在提取音频...", "processing")
        audio_path = task_manager.get_dir("audio") / "audio.wav"
        extract_audio(video_path, audio_path)
        
        # Step 3: ASR (Subtitle Generation)
        task_manager.update_status(0.4, f"正在识别字幕 ({asr_engine})...", "processing")
        subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
        
        # Load the selected ASR model locally (replacing the global instance for this request)
        task_asr_model = ASRRecognizer(asr_type=asr_engine)
        _, _ = task_asr_model.recognize(audio_path, subtitle_path)
        
        # Optional: Extract Clips
        if extract_clips_flag:
            task_manager.update_status(0.5, "AI 正在提取视频片段...", "processing")
            from llm.clip_generator import ClipGenerator
            from video.processor import cut_video_segments
            import json
            clip_generator = ClipGenerator()
            clips_json_path = task_manager.get_dir("ai") / "clips.json"
            clip_generator.generate(subtitle_path, clips_json_path)
            
            with open(clips_json_path, 'r', encoding='utf-8') as f:
                clips_data = json.load(f)
                
            videos_output_dir = task_manager.get_dir("videos")
            cut_video_segments(video_path, clips_data, videos_output_dir, add_overlay=add_overlay_flag)

        # Step 4: LLM Generation
        article_path = task_manager.get_dir("ai") / "article.md"
        image_json_path = task_manager.get_dir("ai") / "image.json"
        
        if generate_article_flag:
            task_manager.update_status(0.6, "AI 正在生成文章与图片时间点...", "processing")
            # Initialize dynamic LLM generator
            llm_generator = ArticleGenerator(
                api_key=llm_api_key if llm_api_key else None,
                base_url=llm_base_url if llm_base_url else None,
                model=llm_model_name if llm_model_name else None
            )
            llm_generator.generate(subtitle_path, article_path, image_json_path, custom_prompt=custom_prompt)
        else:
            task_manager.update_status(0.6, "跳过生成文章...", "processing")
            
        # Step 5: Screen Capture
        images_data = []
        if generate_images_flag:
            if image_json_path.exists():
                task_manager.update_status(0.8, "正在自动截图...", "processing")
                images_dir = task_manager.get_dir("images")
                images_data = screenshot_tool.extract(video_path, image_json_path, images_dir)
            else:
                task_manager.update_status(0.8, "无法截图：找不到图片时间点数据", "processing")
        else:
            task_manager.update_status(0.8, "跳过自动截图...", "processing")
            
        # Step 6: HTML Generation
        if generate_html_flag:
            if article_path.exists():
                task_manager.update_status(0.9, "正在排版最终文章...", "processing")
                html_path = task_manager.get_dir("article") / "article.html"
                build_html_article(article_path, images_data, html_path)
            else:
                task_manager.update_status(0.9, "无法排版：找不到文章内容", "processing")
        else:
            task_manager.update_status(0.9, "跳过文章排版...", "processing")
        
        task_manager.update_status(1.0, "处理完成！", "completed")

    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"处理失败: {str(e)}", "error")
        print(traceback.format_exc())

def process_tts_render_pipeline(
    task_id: str,
    text: str,
    tts_engine: str = "edge",
    voice: str = "",
    temperature: float = 0.3,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 5,
    refine_text: bool = True,
    cover_title: str = "",
    cover_image_name: str = "",
    bgm: str = ""
):
    """Background task to generate TTS audio and render video directly."""
    task_manager = TaskManager(task_id=task_id)
    try:
        task_manager.update_status(0.1, f"正在生成语音 ({tts_engine})...", "processing", task_type="standard")
        
        # Save raw text as subtitle for UI display
        subtitle_dir = task_manager.get_dir("subtitle")
        with open(subtitle_dir / "subtitle.txt", 'w', encoding='utf-8') as f:
            f.write(text)
        
        # Save task configuration for future re-generation
        import json
        ai_dir = task_manager.get_dir("ai")
        config_path = ai_dir / "tts_config.json"
        config_data = {
            "text": text,
            "ttsEngine": tts_engine,
            "voice": voice,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "speed": speed,
            "refine_text": refine_text
        }
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

        audio_dir = task_manager.get_dir("audio")
        output_base = audio_dir / "tts_output"
        
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            audio_path, json_path = run_kokoro_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(text, str(output_base), voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(text, str(output_base), voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            audio_path, json_path = run_tts_sync(text, str(output_base), voice=voice)
            
        task_manager.update_status(0.5, "正在合成视频...", "processing")
        
        # Prepare props for Remotion
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        import re
        for c in captions:
            if "text" in c:
                c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
            
        # Use symlink to root tasks directory to avoid copying
        audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
        props = {
            "captions": captions,
            "audioUrl": audio_rel_path,
            "fontSize": 90,
            "centeredStart": True,
            "randomOrientation": True,
            "verticalFirstWord": True
        }
        if cover_title:
            props["coverTitle"] = cover_title
        if cover_image_name:
            props["coverImageUrl"] = f"tasks/{task_id}/images/{cover_image_name}"
        if bgm:
            props["bgm"] = bgm
        
        shuo_json_path = audio_dir / "shuo.json"
        with open(shuo_json_path, 'w', encoding='utf-8') as f:
            json.dump(props, f, ensure_ascii=False, indent=2)
            
        video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30
        if cover_title:
            duration_frames += 60
        
        run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames)
        
        task_manager.update_status(1.0, "合成成功！", "completed")
        
    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")
        print(traceback.format_exc())

def process_dynamic_video_pipeline(
    task_id: str,
    prompt: str,
    tts_engine: str = "edge",
    voice: str = "",
    mode: str = "prompt",
    temperature: float = 0.7,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 1.0,
    refine_text: bool = True,
    bgm: str = "",
    aspect_ratio: str = "9:16",
    user_assets: List[Dict[str, Any]] = None,
    max_retries: int = 1,
    also_generate_landscape: bool = False,
    tts_volume: float = 1.0,
    media_volume: float = 1.0,
    bgm_volume: float = 0.15,
    video_duration: float = None
):
    """Background task for LLM Dynamic Template Video generation."""
    task_manager = TaskManager(task_id=task_id)
    try:
        if mode == "voiceover":
            # 1. Parse JSON
            import json, re
            from pathlib import Path
            try:
                template_props = json.loads(prompt)
            except Exception as e:
                raise ValueError(f"Failed to parse prompt as JSON: {e}")

            # 2. TTS Generation on template_props.get("voiceoverText")
            voiceover_text = template_props.get("voiceoverText") or "No narration content"
            voiceover_text = re.sub(r'(?<=[a-zA-Z0-9])\.(?=[a-zA-Z0-9])', '点', voiceover_text)
            
            task_manager.update_status(0.3, f"正在进行语音合成 ({tts_engine})...", "processing")
            task_dir = task_manager.get_dir("")
            output_base = task_dir / "audio" / "tts_output"
            output_base.parent.mkdir(parents=True, exist_ok=True)
            
            if tts_engine == "chattts":
                from tts.chattts_processor import run_chattts_sync
                audio_path, json_path = run_chattts_sync(
                    voiceover_text, str(output_base), voice=voice,
                    temperature=temperature, top_p=top_p, top_k=top_k, 
                    speed=speed, refine_text_flag=refine_text
                )
            elif tts_engine == "omnivoice":
                from tts.omnivoice_processor import run_omnivoice_tts_sync
                audio_path, json_path = run_omnivoice_tts_sync(voiceover_text, str(output_base), voice_instruct=voice)
            elif tts_engine == "voxcpm":
                audio_path, json_path = run_voxcpm_tts_sync(voiceover_text, str(output_base), voice=voice)
            elif tts_engine == "mlx":
                audio_path, json_path = run_mlx_tts_sync(voiceover_text, str(output_base), voice=voice, speed=speed)
            elif tts_engine == "kokoro":
                from tts.kokoro_processor import run_kokoro_tts_sync
                voice_k = voice or "af_heart"
                audio_path, json_path = run_kokoro_tts_sync(voiceover_text, str(output_base), voice=voice_k)
            else:
                voice_e = voice or "zh-CN-XiaoxiaoNeural"
                from tts.processor import run_tts_sync
                audio_path, json_path = run_tts_sync(voiceover_text, str(output_base), voice=voice_e)

            # 3. Read captions JSON for duration calculation
            with open(json_path, 'r', encoding='utf-8') as f:
                captions_timing = json.load(f)
            
            # Clean Chinese and English punctuation from captions
            import re
            for c in captions_timing:
                if "text" in c:
                    c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
                    c["text"] = re.sub(r'[，。！？、；：“”‘’（）《》【】.,!?;:\'\"()\[\]<>\-~]', '', c["text"]).strip()
            
            # Map user uploaded assets to images and videos
            images_list = []
            videos_list = []
            assets_list = []
            if user_assets:
                for asset in user_assets:
                    # Construct paths relative to remotion public dir via symlink
                    asset_rel = f"tasks/{task_id}/assets/{Path(asset['url']).name}"
                    assets_list.append({
                        "url": asset_rel,
                        "type": asset['type']
                    })
                    if asset['type'] == 'video':
                        videos_list.append(asset_rel)
                    else:
                        images_list.append(asset_rel)

            audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
            
            # Combine the user template_props with calculated assets and audio
            props = {
                "title": template_props.get("title", ""),
                "theme": template_props.get("theme", "dark"),
                "captions": captions_timing,
                "audioPath": audio_rel_path,
                "images": images_list,
                "videos": videos_list,
                "assets": assets_list,
                "ttsVolume": tts_volume,
                "mediaVolume": media_volume,
                "bgmVolume": bgm_volume,
            }
            if bgm:
                import re
                clean_bgm = re.sub(r'^bgm[/\\]+', '', bgm)
                if bgm.startswith("http"):
                    props["bgmPath"] = bgm
                else:
                    props["bgmPath"] = f"http://127.0.0.1:8000/bgm/{clean_bgm}"
            
            # Save props to shuo.json (under task audio folder)
            audio_dir = task_manager.get_dir("audio")
            shuo_json_path = audio_dir / "shuo.json"
            with open(shuo_json_path, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

            # Also save to remotion_props.json for consistency
            props_path = task_dir / "remotion_props.json"
            with open(props_path, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

            task_manager.update_status(0.6, "正在合成视频...", "processing")
            
            # Calculate max video asset duration
            max_video_duration_ms = 0
            if user_assets:
                import ffmpeg
                for asset in user_assets:
                    if asset.get('type') == 'video':
                        filename = Path(asset['url']).name
                        local_path = task_dir / "assets" / filename
                        if local_path.exists():
                            try:
                                probe = ffmpeg.probe(str(local_path))
                                duration = float(probe['format']['duration'])
                                max_video_duration_ms = max(max_video_duration_ms, int(duration * 1000))
                            except Exception as e:
                                print(f"Error probing video {local_path}: {e}")

            video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
            total_duration_ms = captions_timing[-1]["endMs"] if captions_timing else 3000
            
            # If the video asset duration is longer than speech, use video duration as final duration
            if max_video_duration_ms > total_duration_ms:
                total_duration_ms = max_video_duration_ms
            
            # Add small buffer of 15 frames for safety
            duration_frames = int((total_duration_ms / 1000) * 30) + 15
            
            from video.remotion_renderer import run_remotion_render
            run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames, composition_id="VoiceoverScene")
            
            task_manager.update_status(1.0, "合成成功！", "completed")
            return

        if mode == "json":
            # 1. Parse JSON
            import json, re
            from pathlib import Path
            try:
                template_props = json.loads(prompt)
            except Exception as e:
                raise ValueError(f"Failed to parse prompt as JSON: {e}")

            task_dir = task_manager.get_dir("")

            # 2. TTS Generation on template_props.get("captions")
            voiceover_text = template_props.get("captions")
            
            # Check if captions is provided and not empty
            has_tts = voiceover_text is not None and len(str(voiceover_text).strip()) > 0
            
            if has_tts:
                voiceover_text = re.sub(r'(?<=[a-zA-Z0-9])\.(?=[a-zA-Z0-9])', '点', str(voiceover_text))
                task_manager.update_status(0.3, f"正在进行语音合成 ({tts_engine})...", "processing")
                output_base = task_dir / "audio" / "tts_output"
                output_base.parent.mkdir(parents=True, exist_ok=True)
                
                if tts_engine == "chattts":
                    from tts.chattts_processor import run_chattts_sync
                    audio_path, json_path = run_chattts_sync(
                        voiceover_text, str(output_base), voice=voice,
                        temperature=temperature, top_p=top_p, top_k=top_k, 
                        speed=speed, refine_text_flag=refine_text
                    )
                elif tts_engine == "omnivoice":
                    from tts.omnivoice_processor import run_omnivoice_tts_sync
                    audio_path, json_path = run_omnivoice_tts_sync(voiceover_text, str(output_base), voice_instruct=voice)
                elif tts_engine == "voxcpm":
                    audio_path, json_path = run_voxcpm_tts_sync(voiceover_text, str(output_base), voice=voice)
                elif tts_engine == "mlx":
                    audio_path, json_path = run_mlx_tts_sync(voiceover_text, str(output_base), voice=voice, speed=speed)
                elif tts_engine == "kokoro":
                    from tts.kokoro_processor import run_kokoro_tts_sync
                    voice_k = voice or "af_heart"
                    audio_path, json_path = run_kokoro_tts_sync(voiceover_text, str(output_base), voice=voice_k)
                else:
                    voice_e = voice or "zh-CN-XiaoxiaoNeural"
                    from tts.processor import run_tts_sync
                    audio_path, json_path = run_tts_sync(voiceover_text, str(output_base), voice=voice_e)

                # 3. Read captions JSON for duration calculation
                with open(json_path, 'r', encoding='utf-8') as f:
                    captions_timing = json.load(f)
                
                # Clean Chinese and English punctuation from captions
                import re
                for c in captions_timing:
                    if "text" in c:
                        c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
                        c["text"] = re.sub(r'[，。！？、；：“”‘’（）《》【】.,!?;:\'\"()\[\]<>\-~]', '', c["text"]).strip()
                
                audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
            else:
                task_manager.update_status(0.3, "跳过语音合成 (无 captions)...", "processing")
                audio_rel_path = None
                captions_timing = []

            # Map user uploaded assets to images and videos
            images_list = []
            videos_list = []
            if user_assets:
                for asset in user_assets:
                    # Construct paths relative to remotion public dir via symlink
                    asset_rel = f"tasks/{task_id}/assets/{Path(asset['url']).name}"
                    if asset['type'] == 'video':
                        videos_list.append(asset_rel)
                    else:
                        images_list.append(asset_rel)

            # Combine the user template_props with calculated assets and audio
            props = {
                **template_props,
                "audioPath": audio_rel_path,
                "images": images_list if images_list else template_props.get("images", []),
                "videos": videos_list if videos_list else template_props.get("videos", []),
                "ttsVolume": template_props.get("ttsVolume", tts_volume),
                "mediaVolume": template_props.get("mediaVolume", media_volume),
                "bgmVolume": template_props.get("bgmVolume", bgm_volume),
            }
            
            # Check if there are background images in the bgImages folder
            bg_images_dir = Path(__file__).parent / "bgImages"
            bg_image = None
            if bg_images_dir.exists():
                valid_extensions = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov"}
                bg_files = sorted([f.name for f in bg_images_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_extensions])
                if bg_files:
                    user_bg = template_props.get("bgImage")
                    if user_bg and user_bg in bg_files:
                        bg_image = user_bg
                    else:
                        bg_image = bg_files[0]
            if bg_image:
                props["bgImage"] = props.get("bgImage") or bg_image
            if bgm:
                import re
                clean_bgm = re.sub(r'^bgm[/\\]+', '', bgm)
                if bgm.startswith("http"):
                    props["bgmPath"] = bgm
                else:
                    props["bgmPath"] = f"http://127.0.0.1:8000/bgm/{clean_bgm}"
            
            # Save props to shuo.json (under task audio folder)
            audio_dir = task_manager.get_dir("audio")
            shuo_json_path = audio_dir / "shuo.json"
            with open(shuo_json_path, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

            # Also save to remotion_props.json for consistency
            props_path = task_dir / "remotion_props.json"
            with open(props_path, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

            task_manager.update_status(0.6, "正在合成视频...", "processing")
            
            video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
            
            if has_tts and captions_timing:
                total_duration_ms = captions_timing[-1]["endMs"]
                duration_frames = int((total_duration_ms / 1000) * 30) + 60
            else:
                custom_duration = template_props.get("videoDuration") or template_props.get("duration") or video_duration
                if custom_duration is not None:
                    duration_frames = int(float(custom_duration) * 30)
                else:
                    duration_frames = 300 # default 10 seconds
            
            comp_id = "AITemplate16-9" if aspect_ratio == "16:9" else "AITemplate"
            from video.remotion_renderer import run_remotion_render
            run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames, composition_id=comp_id)
            
            if aspect_ratio == "9:16" and also_generate_landscape:
                video_output_landscape = task_manager.get_dir("videos") / "remotion_video_16_9.mp4"
                run_remotion_render(shuo_json_path, video_output_landscape, duration_frames=duration_frames, composition_id="AITemplate16-9")
            
            task_manager.update_status(1.0, "合成成功！", "completed")
            return

        from video.llm_provider import get_llm_provider
        from video.remotion_generator import RemotionGenerator
        provider = get_llm_provider()

        task_manager.update_status(0.05, "正在构思视频文案与风格...", "processing", task_type="dynamic_video")
        
        # Step 1: Generate Voiceover and Visual Style
        prompt_path = Path(__file__).parent / "video" / "prompts" / "dynamic_video_director.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_msg = f.read()

        user_content = f"视频比例：{aspect_ratio}\n用户需求：{prompt}"
        if user_assets:
            user_content += "\n\n用户提供的素材（请优先考虑在脚本中合理展示它们）：\n"
            for idx, asset in enumerate(user_assets):
                user_content += f"- 素材{idx+1} ({asset['type']}): {asset['description']} (引用地址: {asset['url']})\n"
            user_content += "\n请在脚本的 scene 元素中增加 image_url 字段（用于图片）或 video_url 字段（用于视频）。"

        # Save Director prompt context
        user_prompt_dir = task_manager.get_dir("user_prompt")
        user_prompt_dir.mkdir(parents=True, exist_ok=True)
        with open(user_prompt_dir / "director_context.txt", "w", encoding="utf-8") as f:
            f.write(user_content)

        messages = [
            {"role": "system", "content": system_msg.strip()},
            {"role": "user", "content": user_content}
        ]
        
        task_log_dir = str(task_manager.get_dir("llm_logs"))
        llm_resp = provider.generate(messages, log_dir=task_log_dir)
        
        # Parse JSON
        import re, json
        llm_resp_clean = re.sub(r'<think>.*?</think>', '', llm_resp, flags=re.DOTALL).strip()
        json_block_match = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*\n?```', llm_resp_clean, re.DOTALL)
        if json_block_match:
            raw_json = json_block_match.group(1)
        else:
            brace_match = re.search(r'\{.*\}', llm_resp_clean, re.DOTALL)
            raw_json = brace_match.group(0) if brace_match else None

        data = None
        if raw_json:
            try:
                data = json.loads(raw_json, strict=False)
            except:
                pass
        
        if not data:
            scenes = [{"text": prompt, "visual": "Dynamic rendering", "image_url": ""}]
            visual_style = "Modern and dynamic"
        else:
            scenes = data.get("scenes", [])
            visual_style = data.get("visual_style", "").strip()
            if not scenes and data.get("voiceover"):
                scenes = [{"text": data["voiceover"], "visual": visual_style, "image_url": ""}]

        # 2. TTS Generation
        task_manager.update_status(0.3, f"正在进行语音合成 ({tts_engine})...", "processing")
        
        voiceover_text = " ".join([s.get("text", "") for s in scenes])
        # 优化语音合成：将字母、数字之间的“.”转换为“点”，确保 TTS 正确读出
        voiceover_text = re.sub(r'(?<=[a-zA-Z0-9])\.(?=[a-zA-Z0-9])', '点', voiceover_text)
        task_dir = task_manager.get_dir("")
        output_base = task_dir / "audio" / "tts_output"
        output_base.parent.mkdir(parents=True, exist_ok=True)
        
        if tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                voiceover_text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(voiceover_text, str(output_base), voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(voiceover_text, str(output_base), voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(voiceover_text, str(output_base), voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(voiceover_text, str(output_base), voice=voice)

        task_manager.update_status(0.4, "正在使用 LLM 生成动态视频模板...", "processing")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        # Clean captions and map assets
        current_scene_idx = 0
        current_scene_text_accum = ""
        valid_asset_urls = {asset['url'] for asset in (user_assets or [])}
        
        for c in captions:
            if "text" in c:
                # text = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
        
                text = c["text"]
                # 优化数字和字母格式：将“66点2”/“a点b”转换为“66.2”/“a.b”用于字幕展示
                c["text"] = re.sub(r'(?<=[a-zA-Z0-9])点(?=[a-zA-Z0-9])', '.', text)
        
                scene = scenes[current_scene_idx] if current_scene_idx < len(scenes) else scenes[-1]
                
                asset_url = scene.get("image_url") or scene.get("video_url") or ""
                if asset_url and asset_url not in valid_asset_urls:
                    asset_url = ""
                
                c["image_url"] = asset_url # Primary field
                
                asset_type = "image"
                if user_assets:
                    for a in user_assets:
                        if a["url"] == asset_url:
                            asset_type = a["type"]
                            break
                c["asset_type"] = asset_type
                c["visual_suggestion"] = scene.get("visual", "")
                
                current_scene_text_accum += c["text"]
                if current_scene_idx < len(scenes) - 1:
                    target_text = scenes[current_scene_idx].get("text", "").strip()
                    if len(current_scene_text_accum) >= len(target_text) * 0.9:
                        current_scene_idx += 1
                        current_scene_text_accum = ""

        # 3. Code Generation and Rendering
        gen_mode = os.environ.get("REMOTION_GEN_MODE", "overwrite").lower()
        if gen_mode in ("chunkdiff", "dsl"):
            from video.remotion_generator_dsl import RemotionGeneratorDSL
            generator = RemotionGeneratorDSL(Path(__file__).parent / "skills" / "remotion", provider, mode="dsl")
        else:
            from video.remotion_generator import RemotionGenerator
            generator = RemotionGenerator(Path(__file__).parent / "skills" / "remotion", provider)
        output_path = task_manager.get_dir("videos") / "remotion_video.mp4"
        
        # Calculate duration
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30

        props = {
            "captions": captions,
            "audioUrl": f"http://127.0.0.1:8000/tasks/{task_id}/audio/{Path(audio_path).name}",
            "visual_style": visual_style,
            "aspect_ratio": aspect_ratio,
            "ttsVolume": tts_volume,
            "mediaVolume": media_volume,
            "bgmVolume": bgm_volume,
        }
        if bgm:
            import re
            clean_bgm = re.sub(r'^bgm[/\\]+', '', bgm)
            # Also ensure BGM is absolute
            if bgm.startswith("http"):
                props["bgm"] = bgm
            else:
                props["bgm"] = f"http://127.0.0.1:8000/bgm/{clean_bgm}"

        # Combine user prompt, visual style and scene suggestions for the developer agent
        scene_guidelines = "\n".join([f"Scene {i+1}: {s.get('visual')}" for i, s in enumerate(scenes)])
        subtitles_json = json.dumps(captions, ensure_ascii=False, indent=2)
        
        combined_intent = f"User Request: {prompt}\n\nVisual Style Directives:\n{visual_style}\n\nScene Guidelines:\n{scene_guidelines}\n\nFinal Subtitles & Timings:\n{subtitles_json}"
        
        if user_assets:
            combined_intent += "\n\nIMPORTANT: User assets are provided in the 'image_url' and 'asset_type' fields of each caption in props. Please render them accordingly."

        # Save Developer prompt context for future regenerations
        with open(user_prompt_dir / "developer_context.txt", "w", encoding="utf-8") as f:
            f.write(combined_intent)

        generator.generate_and_render(
            user_intent=combined_intent,
            props=props,
            output_path=str(output_path),
            duration_frames=duration_frames,
            max_retries=max_retries,
            log_dir=str(task_manager.get_dir("llm_logs")),
            aspect_ratio=aspect_ratio
        )
        
        task_manager.update_status(1.0, "动态视频生成成功！", "completed")

    except Exception as e:
        import traceback
        error_msg = f"动态视频生成失败: {str(e)}"
        task_manager.update_status(1.0, error_msg, "error")
        print(traceback.format_exc())


@app.post("/api/upload_voice")
async def upload_voice(file: UploadFile = File(...)):
    """Upload custom .wav voice files for VoxCPM voice cloning."""
    try:
        import time
        import re
        from pathlib import Path
        preset_dir = Path("tts/voxcpmwav")
        preset_dir.mkdir(parents=True, exist_ok=True)
        
        # Clean file name to prevent directory traversal
        filename = os.path.basename(file.filename)
        cleaned_filename = re.sub(r'[^\w\u4e00-\u9fff\.-]', '_', filename)
        new_filename = f"uploaded_{int(time.time())}_{cleaned_filename}"
        
        save_path = preset_dir / new_filename
        with open(save_path, "wb") as f:
            f.write(await file.read())
            
        print(f"Uploaded voice saved to: {save_path.resolve()}")
        
        return {
            "success": True, 
            "filename": new_filename,
            "absolute_path": str(save_path.resolve())
        }
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JSONResponse(status_code=500, content={"error": f"上传音频失败: {str(e)}"})


@app.post("/api/upload")
async def upload_video(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(None),
    video_url: str = Form(""),
    asr_engine: str = Form("funasr"),
    extract_clips: bool = Form(False),
    add_overlay: bool = Form(False),
    generate_article: bool = Form(True),
    generate_images: bool = Form(True),
    generate_html: bool = Form(True),
    custom_prompt: str = Form(""),
    llm_api_key: str = Form(""),
    llm_base_url: str = Form(""),
    llm_model: str = Form("")
):
    """Upload video file or provide URL to start background processing."""
    
    if not file and not video_url:
        return JSONResponse(status_code=400, content={"error": "请提供视频文件或有效的视频链接"})
        
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    # Save uploaded file if provided
    video_dir = task_manager.get_dir("video")
    video_path = video_dir / "source.mp4"
    
    if file:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
    status_msg = "初始化处理..." if file else "接收到链接，初始化下载任务..."
    task_manager.update_status(0.05, status_msg, "processing", task_type="standard")
    
    # Start background task
    background_tasks.add_task(
        process_video_pipeline, 
        task_id, 
        video_path,
        video_url,
        asr_engine,
        extract_clips,
        add_overlay,
        generate_article,
        generate_images,
        generate_html,
        custom_prompt,
        llm_api_key,
        llm_base_url,
        llm_model
    )
    
    return {"task_id": task_id, "message": "Task started."}

@app.post("/api/tts_render")
async def tts_render(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(5),
    refine_text: bool = Form(True),
    cover_title: str = Form(""),
    cover_image: UploadFile = File(None),
    bgm: str = Form("")
):
    """Generate TTS audio and render video from text."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    task_manager.update_status(0.05, "任务已启动...", "processing", task_type="standard")
    
    cover_image_name = ""
    # Save cover image if uploaded
    if cover_image and cover_image.filename:
        images_dir = task_manager.get_dir("images")
        file_path = images_dir / cover_image.filename
        with open(file_path, "wb") as f:
            shutil.copyfileobj(cover_image.file, f)
        cover_image_name = cover_image.filename

    background_tasks.add_task(
        process_tts_render_pipeline,
        task_id,
        text,
        tts_engine,
        voice,
        temperature,
        top_p,
        top_k,
        speed,
        refine_text,
        cover_title,
        cover_image_name,
        bgm
    )
    
    return {"task_id": task_id, "message": "TTS Render Task started."}
@app.post("/api/ai_script")
async def generate_ai_script(
    task_id: str = Form(...),
    prompt: str = Form(...),
    llm_api_key: str = Form(""),
    llm_base_url: str = Form(""),
    llm_model: str = Form("")
):
    """Generate a new script based on previous task context and a prompt."""
    context_text = ""
    if task_id and task_id != "agent_init":
        task_manager = TaskManager(task_id=task_id)
        subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
        if subtitle_path.exists():
            with open(subtitle_path, 'r', encoding='utf-8') as f:
                context_text = f.read()

    llm_generator = ArticleGenerator(
        api_key=llm_api_key if llm_api_key else None,
        base_url=llm_base_url if llm_base_url else None,
        model=llm_model if llm_model else None
    )
    
    try:
        script = llm_generator.generate_script(context_text, prompt)
        return {"script": script}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"AI 生成失败: {str(e)}"})

@app.get("/api/tasks")
async def get_tasks():
    """List all historical tasks."""
    if not TASKS_DIR.exists():
        return {"tasks": []}
        
    tasks_list = []
    # Sort by task_id descending (newest first, since they are timestamped)
    for d in sorted(TASKS_DIR.iterdir(), key=lambda x: x.name, reverse=True):
        if d.is_dir():
            status_file = d / "status.json"
            if status_file.exists():
                import json
                try:
                    with open(status_file, "r", encoding="utf-8") as f:
                        status = json.load(f)
                        status["task_id"] = d.name
                        # Default to standard if task_type is missing in old tasks
                        if "task_type" not in status:
                            status["task_type"] = "standard"
                        tasks_list.append(status)
                except Exception:
                    pass
    return {"tasks": tasks_list}

@app.get("/api/bgms")
async def get_bgms():
    """List available background music files."""
    bgm_dir = Path("bgm")
    if not bgm_dir.exists():
        bgm_dir.mkdir(exist_ok=True)
    
    bgms = []
    for ext in ("*.mp3", "*.wav", "*.m4a"):
        bgms.extend([f.name for f in bgm_dir.glob(ext)])
    return {"bgms": sorted(bgms)}

@app.get("/api/bg_images")
async def get_bg_images():
    """List available background image files."""
    bg_images_dir = Path("bgImages")
    if not bg_images_dir.exists():
        bg_images_dir.mkdir(exist_ok=True)
    
    bg_images = []
    valid_extensions = ("*.png", "*.jpg", "*.jpeg", "*.webp", "*.mp4", "*.webm", "*.mov")
    for ext in valid_extensions:
        bg_images.extend([f.name for f in bg_images_dir.glob(ext)])
    return {"bg_images": sorted(bg_images)}

@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    """Poll task status."""
    task_manager = TaskManager(task_id=task_id)
    return task_manager.get_status()

@app.get("/api/results/{task_id}")
async def get_results(task_id: str):
    """Retrieve text/markdown and file paths generated by task."""
    task_manager = TaskManager(task_id=task_id)
    status = task_manager.get_status()
    
    if status.get("state") != "completed":
        return JSONResponse(status_code=400, content={"error": "Task not completed yet."})

    # Read subtitles
    subtitle_content = ""
    subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
    if subtitle_path.exists():
        with open(subtitle_path, 'r', encoding='utf-8') as f:
            subtitle_content = f.read()

    # Read markdown
    article_content = ""
    article_path = task_manager.get_dir("ai") / "article.md"
    if article_path.exists():
        with open(article_path, 'r', encoding='utf-8') as f:
            article_content = f.read()

    # Get images (URL structure over static file mount)
    images_dir = task_manager.get_dir("images")
    images_urls = [f"/tasks/{task_id}/images/{img.name}" for img in sorted(images_dir.glob("*.jpg"))] if images_dir.exists() else []

    html_path = task_manager.get_dir("article") / "article.html"
    html_url = f"/tasks/{task_id}/article/article.html" if html_path.exists() else None
    
    # Get video clips with metadata
    videos_dir = task_manager.get_dir("videos")
    clips_json_path = task_manager.get_dir("ai") / "clips.json"
    clips_metadata = []
    if clips_json_path.exists():
        import json
        with open(clips_json_path, 'r', encoding='utf-8') as f:
            clips_metadata = json.load(f)

    video_clips_data = []
    if videos_dir.exists():
        # video files are named like "01_Title.mp4", "02_Title.mp4"
        video_files = sorted(videos_dir.glob("*.mp4"))
        for i, vid in enumerate(video_files):
            clip_info = {
                "url": f"/tasks/{task_id}/videos/{vid.name}",
                "title": f"Clip {i+1}",
                "summary": "",
                "content": "",
                "local_path": str(vid.resolve())
            }
            # Try to match with metadata from clips.json if available
            if i < len(clips_metadata):
                m = clips_metadata[i]
                clip_info["title"] = m.get("title", clip_info["title"])
                clip_info["summary"] = m.get("summary", "")
                clip_info["content"] = m.get("content", "")
            
            video_clips_data.append(clip_info)
    
    # Get audio
    audio_path = task_manager.get_dir("audio") / "audio.wav"
    audio_url = f"/tasks/{task_id}/audio/audio.wav" if audio_path.exists() else None
    
    # Get source video
    source_video_path = task_manager.get_dir("video") / "source.mp4"
    source_video_url = f"/tasks/{task_id}/video/source.mp4" if source_video_path.exists() else None
    
    # Get TTS config for re-generation
    tts_config = None
    tts_config_path = task_manager.get_dir("ai") / "tts_config.json"
    if tts_config_path.exists():
        import json
        try:
            with open(tts_config_path, 'r', encoding='utf-8') as f:
                tts_config = json.load(f)
        except:
            pass
            
    # Get Task Type
    task_type = status.get("task_type", "standard")

    # Get snsTitle from remotion_props.json or fallback files
    sns_title = None
    
    # 1. Try remotion_props.json
    props_path = task_manager.task_dir / "remotion_props.json"
    if props_path.exists():
        try:
            with open(props_path, 'r', encoding='utf-8') as f:
                props_data = json.load(f)
                sns_title = props_data.get("snsTitle") or props_data.get("sns_title")
        except:
            pass
            
    # 2. Try shuo.json (under audio dir)
    if not sns_title:
        shuo_path = task_manager.get_dir("audio") / "shuo.json"
        if shuo_path.exists():
            try:
                with open(shuo_path, 'r', encoding='utf-8') as f:
                    props_data = json.load(f)
                    sns_title = props_data.get("snsTitle") or props_data.get("sns_title")
            except:
                pass
                
    # 3. Try parsing from user prompt in meta.json (especially useful for JSON mode)
    if not sns_title:
        meta_path = task_manager.get_dir("user_prompt") / "meta.json"
        if meta_path.exists():
            try:
                with open(meta_path, 'r', encoding='utf-8') as f:
                    meta_data = json.load(f)
                    prompt_str = meta_data.get("prompt", "")
                    try:
                        prompt_json = json.loads(prompt_str)
                        sns_title = prompt_json.get("snsTitle") or prompt_json.get("sns_title")
                    except:
                        sns_title = meta_data.get("snsTitle") or meta_data.get("sns_title")
            except:
                pass

    return {
        "subtitles": subtitle_content,
        "markdown": article_content,
        "images": images_urls,
        "html_url": html_url,
        "video_clips": video_clips_data,
        "audio_url": audio_url,
        "source_video": source_video_url,
        "tts_config": tts_config,
        "task_type": task_type,
        "sns_title": sns_title
    }


# ----------------------------------------------------
# Distribution API and State
# ----------------------------------------------------
from pydantic import BaseModel
import datetime
import subprocess

distribute_statuses = {}  # task_id -> { platform_name: { "state": "running"|"completed"|"error", "error": str, "updated_at": str } }

@app.get("/api/distribute/config")
async def get_distribute_config():
    """Get the distribution platforms config from flowauto/conofig.json."""
    flowauto_dir = Path(__file__).parent / "flowauto"
    config_path = flowauto_dir / "conofig.json"
    if not config_path.exists():
        dev_config = flowauto_dir / "conofig.dev.json"
        if dev_config.exists():
            config_path = dev_config
        else:
            return {"platforms": []}
            
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            platforms = json.load(f)
            return {"platforms": platforms}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"读取分发配置失败: {str(e)}"})


class PublishRequest(BaseModel):
    task_id: str
    platforms: List[str]
    shared_text: str
    video_name: Optional[str] = None


def escape_for_double_quotes(val: str) -> str:
    """Escape special shell characters for safe usage inside double quotes in a shell command."""
    val = val.replace("\\", "\\\\")  # Escape backslashes first
    val = val.replace('"', '\\"')    # Escape double quotes
    val = val.replace('$', '\\$')    # Escape dollar signs
    val = val.replace('`', '\\`')    # Escape backticks
    return val


import threading

distribute_lock = threading.Lock()


def run_distribution_task(task_id: str, platform_name: str, cmd: str, log_file_path: Path):
    if task_id not in distribute_statuses:
        distribute_statuses[task_id] = {}
        
    distribute_statuses[task_id][platform_name] = {
        "state": "running",
        "error": None,
        "updated_at": datetime.datetime.now().isoformat()
    }
    
    try:
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # If lock is currently locked, write a log message to inform the user
        if distribute_lock.locked():
            try:
                with open(log_file_path, "w", encoding="utf-8") as log_f:
                    log_f.write("当前有其他分发任务正在运行，等待中...\n")
                    log_f.flush()
            except Exception as e:
                print(f"Error writing queue status log: {e}")
                
        with distribute_lock:
            with open(log_file_path, "w", encoding="utf-8") as log_f:
                log_f.write(f"Executing: {cmd}\n\n")
                log_f.flush()
                
                result = subprocess.run(
                    cmd,
                    shell=True,
                    stdout=log_f,
                    stderr=subprocess.STDOUT,
                    text=True,
                    check=False
                )
            
        # Check log file for internal errors and success indicators printed by flowauto
        has_success = False
        has_error = False
        error_line = ""
        try:
            if log_file_path.exists():
                with open(log_file_path, "r", encoding="utf-8") as lf:
                    for line in lf:
                        if "分发任务完成" in line:
                            has_success = True
                        if "ERROR:" in line or "执行错误:" in line or "任务执行失败:" in line:
                            has_error = True
                            if not error_line:
                                error_line = line.strip()
        except Exception as log_err:
            print(f"Error reading log file: {log_err}")

        if has_success:
            distribute_statuses[task_id][platform_name] = {
                "state": "completed",
                "error": None,
                "updated_at": datetime.datetime.now().isoformat()
            }
        else:
            if has_error:
                err_msg = error_line
            elif result.returncode != 0:
                err_msg = f"Command exited with code {result.returncode}."
            else:
                err_msg = "分发任务未完成（日志中未找到'分发任务完成'标志）。"
                
            distribute_statuses[task_id][platform_name] = {
                "state": "error",
                "error": err_msg,
                "updated_at": datetime.datetime.now().isoformat()
            }
    except Exception as e:
        distribute_statuses[task_id][platform_name] = {
            "state": "error",
            "error": str(e),
            "updated_at": datetime.datetime.now().isoformat()
        }
        try:
            with open(log_file_path, "a", encoding="utf-8") as log_f:
                log_f.write(f"\nException: {str(e)}\n")
        except:
            pass


@app.post("/api/distribute/publish")
async def publish_video(req: PublishRequest, background_tasks: BackgroundTasks):
    """Publish generated video to selected platforms using flowauto CLI."""
    task_manager = TaskManager(task_id=req.task_id)
    
    # 1. Resolve video path
    videos_dir = task_manager.get_dir("videos")
    video_path = None
    if req.video_name:
        test_path = videos_dir / req.video_name
        if test_path.exists():
            video_path = test_path
            
    if not video_path:
        # Fallback to search all mp4 files
        video_files = list(videos_dir.glob("*.mp4"))
        if video_files:
            video_path = video_files[0]
            
    if not video_path:
        return JSONResponse(status_code=400, content={"error": "未找到生成的视频文件。"})
        
    # 2. Read platforms config
    flowauto_dir = Path(__file__).parent / "flowauto"
    config_path = flowauto_dir / "conofig.json"
    if not config_path.exists():
        dev_config = flowauto_dir / "conofig.dev.json"
        if dev_config.exists():
            config_path = dev_config
        else:
            return JSONResponse(status_code=400, content={"error": "分发配置文件不存在"})
            
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            platforms_config = json.load(f)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"读取分发配置失败: {str(e)}"})
        
    # Map from platform name to config
    platform_map = {p["platform"]: p for p in platforms_config}
    
    triggered = []
    for platform_name in req.platforms:
        if platform_name not in platform_map:
            continue
            
        p_cfg = platform_map[platform_name]
        
        # Build command dynamically
        cmd_parts = ["flowauto"]
        
        user_data_dir = p_cfg.get("userDataDir", "")
        if user_data_dir:
            user_data_dir_clean = user_data_dir.replace("\\ ", " ")
            if not os.path.isabs(user_data_dir_clean):
                user_data_dir_clean = os.path.abspath(flowauto_dir / user_data_dir_clean)
            user_data_dir_escaped = user_data_dir_clean.replace(" ", "\\ ")
            user_data_dir_val = escape_for_double_quotes(user_data_dir_escaped)
            cmd_parts.append(f'--userDataDir "{user_data_dir_val}"')
            
        json_file = p_cfg.get("json", "")
        if json_file:
            json_file_clean = json_file.replace("\\ ", " ")
            if not os.path.isabs(json_file_clean):
                json_file_clean = os.path.abspath(flowauto_dir / json_file_clean)
            json_file_val = escape_for_double_quotes(json_file_clean)
            cmd_parts.append(f'--filepath "{json_file_val}"')
            
        # Add params
        for param in p_cfg.get("params", []):
            key = param.get("key", "")
            val = param.get("value", "")
            
            if key.lower() in ("filepath", "file_path", "video"):
                val = str(video_path.resolve())
            elif key.lower() in ("title", "desc", "description", "text", "content"):
                val = req.shared_text
                
            val_escaped = escape_for_double_quotes(val)
            cmd_parts.append(f'--{key} "{val_escaped}"')
            
        cmd_str = " ".join(cmd_parts)
        log_file_path = task_manager.get_dir("llm_logs") / f"distribute_{platform_name}.log"
        
        background_tasks.add_task(
            run_distribution_task,
            req.task_id,
            platform_name,
            cmd_str,
            log_file_path
        )
        triggered.append(platform_name)
        
    return {"success": True, "triggered_platforms": triggered}


@app.get("/api/distribute/status/{task_id}")
async def get_distribution_status(task_id: str):
    """Get status of distribution tasks for a given task_id."""
    status = distribute_statuses.get(task_id, {})
    return {"status": status}


@app.get("/api/distribute/log/{task_id}/{platform}")
async def get_distribution_log(task_id: str, platform: str):
    """Retrieve log for a specific platform distribution task."""
    task_manager = TaskManager(task_id=task_id)
    log_file_path = task_manager.get_dir("llm_logs") / f"distribute_{platform}.log"
    if not log_file_path.exists():
        return {"log": "No log found for this platform distribution."}
        
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            log_content = f.read()
        return {"log": log_content}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"读取日志失败: {str(e)}"})


def process_agent_video_pipeline(
    task_id: str,
    text: str,
    image_descriptions: list,
    tts_engine: str = "edge",
    voice: str = "",
    temperature: float = 0.3,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 5,
    refine_text: bool = True,
    bgm: str = "",
    llm_settings: dict = None
):
    """Background task for Agent Mode video generation."""
    task_manager = TaskManager(task_id=task_id)
    try:
        task_manager.update_status(0.1, f"正在生成语音 ({tts_engine})...", "processing")
        
        audio_dir = task_manager.get_dir("audio")
        output_base = audio_dir / "tts_output"
        
        # 1. Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            audio_path, json_path = run_kokoro_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(text, str(output_base), voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(text, str(output_base), voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            audio_path, json_path = run_tts_sync(text, str(output_base), voice=voice)

        task_manager.update_status(0.4, "AI 正在匹配图片与台词...", "processing")
        
        # 2. Match Images
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        import re
        for c in captions:
            if "text" in c:
                c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
            
        llm_generator = ArticleGenerator(
            api_key=llm_settings.get("apiKey") if llm_settings else None,
            base_url=llm_settings.get("baseUrl") if llm_settings else None,
            model=llm_settings.get("model") if llm_settings else None
        )
        
        matched_images = llm_generator.match_images_to_script(captions, image_descriptions)
        
        # 3. Prepare Remotion Props
        # Asset symlink logic is now handled automatically by RemotionRenderer
        
        audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
        
        final_images = []
        images_dir = task_manager.get_dir("images")
        for img in matched_images:
            src = img.get("src")
            src_path = images_dir / src
            if src_path.exists():
                # Use path relative to remotion/public/ via symlink
                final_images.append({
                    **img,
                    "src": f"tasks/{task_id}/images/{src}"
                })
        
        props = {
            "captions": captions,
            "images": final_images,
            "audioUrl": audio_rel_path,
            "fontSize": 90,
            "centeredStart": True,
            "randomOrientation": True,
            "verticalFirstWord": True
        }
        if bgm:
            props["bgm"] = bgm
        
        shuo_json_path = audio_dir / "shuo.json"
        with open(shuo_json_path, 'w', encoding='utf-8') as f:
            json.dump(props, f, ensure_ascii=False, indent=2)
            
        task_manager.update_status(0.6, "正在合成视频...", "processing")
        
        video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30
        
        run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames)
        
        task_manager.update_status(1.0, "合成成功！", "completed")
        
    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")
        print(traceback.format_exc())

@app.post("/api/agent_video")
async def generate_agent_video(
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(None),
    image_descriptions: str = Form("[]"), # JSON array
    prompt: str = Form(""),
    text: str = Form(""),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(1.0),
    refine_text: bool = Form(True),
    bgm: str = Form(""),
    llm_api_key: str = Form(""),
    llm_base_url: str = Form(""),
    llm_model: str = Form("")
):
    """Endpoint for Agent Mode video generation."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    task_manager.update_status(0.01, "初始化 Agent 任务...", "processing", task_type="agent")
    
    # 1. Save images
    desc_list = []
    try:
        desc_list = json.loads(image_descriptions)
    except:
        pass

    images_dir = task_manager.get_dir("images")
    if images:
        for img_file in images:
            file_path = images_dir / img_file.filename
            with open(file_path, "wb") as f:
                f.write(await img_file.read())

    llm_settings = {
        "apiKey": llm_api_key,
        "baseUrl": llm_base_url,
        "model": llm_model
    }

    # 2. If text is empty, generate script from prompt
    final_text = text
    if not final_text and prompt:
        llm_generator = ArticleGenerator(
            api_key=llm_api_key if llm_api_key else None,
            base_url=llm_base_url if llm_base_url else None,
            model=llm_model if llm_model else None
        )
        context = f"可用图片描述: {image_descriptions}"
        final_text = llm_generator.generate_script(context, prompt)

    # 3. Start pipeline
    background_tasks.add_task(
        process_agent_video_pipeline,
        task_id=task_id,
        text=final_text,
        image_descriptions=desc_list,
        tts_engine=tts_engine,
        voice=voice,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        speed=speed,
        refine_text=refine_text,
        bgm=bgm,
        llm_settings=llm_settings
    )
    
    return {"task_id": task_id, "message": "Agent Video Task started.", "generated_text": final_text}

def process_image_video_pipeline(
    task_id: str,
    text: str,
    tts_engine: str = "edge",
    voice: str = "",
    temperature: float = 0.3,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 5,
    refine_text: bool = True,
    cover_title: str = "",
    bgm: str = ""
):
    """Background task for Image-to-Video generation using ImageScene Remotion layout."""
    task_manager = TaskManager(task_id=task_id)
    try:
        task_manager.update_status(0.1, f"正在生成语音 ({tts_engine})...", "processing", task_type="image_video")
        
        # Save raw text as subtitle for UI display
        subtitle_dir = task_manager.get_dir("subtitle")
        with open(subtitle_dir / "subtitle.txt", 'w', encoding='utf-8') as f:
            f.write(text)
        
        audio_dir = task_manager.get_dir("audio")
        output_base = audio_dir / "tts_output"
        
        # 1. Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            from tts.kokoro_processor import run_kokoro_tts_sync
            audio_path, json_path = run_kokoro_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(text, str(output_base), voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(text, str(output_base), voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(text, str(output_base), voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(text, str(output_base), voice=voice)

        task_manager.update_status(0.5, "正在配置视频布局...", "processing")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        import re
        for c in captions:
            if "text" in c:
                c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
                c["text"] = re.sub(r'[，。！？、；：“”‘’（）《》【】.,!?;:\'\"()\[\]<>\-~]', '', c["text"]).strip()
        
        # Determine image
        images_dir = task_manager.get_dir("images")
        image_files = list(images_dir.glob("*"))
        if not image_files:
            raise FileNotFoundError("未找到上传的图片！")
            
        img_name = image_files[0].name
        
        # 2. Prepare Remotion Props for ImageScene
        audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
        img_rel_path = f"tasks/{task_id}/images/{img_name}"
        
        props = {
            "captions": captions,
            "imageUrl": img_rel_path,
            "audioUrl": audio_rel_path,
            "fontSize": 90
        }
        if cover_title:
            props["coverTitle"] = cover_title
        if bgm:
            props["bgm"] = bgm
        
        shuo_json_path = audio_dir / "shuo.json"
        with open(shuo_json_path, 'w', encoding='utf-8') as f:
            json.dump(props, f, ensure_ascii=False, indent=2)
            
        task_manager.update_status(0.6, "正在合成视频...", "processing")
        
        video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30
        if cover_title:
            duration_frames += 60
        
        from video.remotion_renderer import run_remotion_render
        run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames, composition_id="ImageScene")
        
        task_manager.update_status(1.0, "合成成功！", "completed")
        
    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")
        print(traceback.format_exc())

def process_news_video_pipeline(
    task_id: str,
    opening_hook: str,
    main_text: str,
    ending_hook: str,
    tts_engine: str = "edge",
    voice: str = "",
    temperature: float = 0.3,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 5,
    refine_text: bool = True,
    cover_title: str = "",
    ending_title: str = "",
    bgm: str = ""
):
    """Background task for News Broadcast Video generation."""
    task_manager = TaskManager(task_id=task_id)
    try:
        task_manager.update_status(0.1, f"正在生成语音 ({tts_engine})...", "processing", task_type="news_video")
        
        # Combine text for TTS
        full_text = []
        if opening_hook.strip():
            full_text.append(opening_hook.strip())
        if main_text.strip():
            full_text.append(main_text.strip())
        if ending_hook.strip():
            full_text.append(ending_hook.strip())
            
        combined_text = "\n".join(full_text)
        
        # Save raw text as subtitle for UI display
        subtitle_dir = task_manager.get_dir("subtitle")
        with open(subtitle_dir / "subtitle.txt", 'w', encoding='utf-8') as f:
            f.write(combined_text)
        
        audio_dir = task_manager.get_dir("audio")
        output_base = audio_dir / "tts_output"
        
        # 1. Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            from tts.kokoro_processor import run_kokoro_tts_sync
            audio_path, json_path = run_kokoro_tts_sync(combined_text, str(output_base), voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                combined_text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(combined_text, str(output_base), voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(combined_text, str(output_base), voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(combined_text, str(output_base), voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(combined_text, str(output_base), voice=voice)

        task_manager.update_status(0.5, "正在配置视频布局...", "processing")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        import re
        def clean_for_match(t):
            if not t: return ""
            t = re.sub(r'\[.*?\]\s*', '', t).strip()
            return re.sub(r'[，。！？、；：“”‘’（）《》【】.,!?;:\'\"()\[\]<>\-~\s]', '', t).strip()
            
        clean_open = clean_for_match(opening_hook)
        clean_main = clean_for_match(main_text)
        
        matched_chars = 0
        for c in captions:
            if "text" in c:
                c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
                c["text"] = re.sub(r'[，。！？、；：“”‘’（）《》【】.,!?;:\'\"()\[\]<>\-~]', '', c["text"]).strip()
                
                c_clean = clean_for_match(c["text"])
                c_len = len(c_clean)
                
                if matched_chars < len(clean_open):
                    c["isMain"] = False
                elif matched_chars < len(clean_open) + len(clean_main):
                    c["isMain"] = True
                else:
                    c["isMain"] = False
                    
                matched_chars += c_len
        
        # Determine image
        images_dir = task_manager.get_dir("images")
        image_files = list(images_dir.glob("*"))
        if not image_files:
            raise FileNotFoundError("未找到上传的图片！")
            
        img_name = image_files[0].name
        
        # 2. Prepare Remotion Props for NewsScene
        audio_rel_path = f"tasks/{task_id}/audio/{Path(audio_path).name}"
        img_rel_path = f"tasks/{task_id}/images/{img_name}"
        
        props = {
            "captions": captions, # Passed mainly for timing info
            "mainText": main_text, # Passed for scrolling
            "imageUrl": img_rel_path,
            "audioUrl": audio_rel_path,
            "fontSize": 70
        }
        if cover_title:
            props["coverTitle"] = cover_title
        if ending_title:
            props["endingTitle"] = ending_title
        if bgm:
            props["bgm"] = bgm
        
        shuo_json_path = audio_dir / "shuo.json"
        with open(shuo_json_path, 'w', encoding='utf-8') as f:
            json.dump(props, f, ensure_ascii=False, indent=2)
            
        task_manager.update_status(0.6, "正在合成视频...", "processing")
        
        video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30
        if cover_title:
            duration_frames += 60 # 2 seconds cover
        if ending_title:
            duration_frames += 60 # 2 seconds ending animation
        
        from video.remotion_renderer import run_remotion_render
        run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames, composition_id="NewsScene")
        
        task_manager.update_status(1.0, "合成成功！", "completed")
        
    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")
        print(traceback.format_exc())


@app.post("/api/image_video")
async def generate_image_video(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    text: str = Form(...),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(1.0),
    refine_text: bool = Form(True),
    cover_title: str = Form(""),
    bgm: str = Form("")
):
    """Endpoint for Image-to-Video mode generation."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    task_manager.update_status(0.01, "初始化图文转换任务...", "processing", task_type="image_video")
    
    # Save uploaded image
    images_dir = task_manager.get_dir("images")
    file_path = images_dir / image.filename
    with open(file_path, "wb") as f:
        f.write(await image.read())

    # Start pipeline
    background_tasks.add_task(
        process_image_video_pipeline,
        task_id=task_id,
        text=text,
        tts_engine=tts_engine,
        voice=voice,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        speed=speed,
        refine_text=refine_text,
        cover_title=cover_title,
        bgm=bgm
    )
    
    return {"task_id": task_id, "message": "Image Video Task started."}

@app.post("/api/news_video")
async def generate_news_video(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    opening_hook: str = Form(""),
    main_text: str = Form(...),
    ending_hook: str = Form(""),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(1.0),
    refine_text: bool = Form(True),
    cover_title: str = Form(""),
    ending_title: str = Form(""),
    bgm: str = Form("")
):
    """Endpoint for News Broadcast Video generation."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    task_manager.update_status(0.01, "初始化资讯播报任务...", "processing", task_type="news_video")
    
    # Save uploaded image
    images_dir = task_manager.get_dir("images")
    file_path = images_dir / image.filename
    with open(file_path, "wb") as f:
        f.write(await image.read())

    # Start pipeline
    background_tasks.add_task(
        process_news_video_pipeline,
        task_id=task_id,
        opening_hook=opening_hook,
        main_text=main_text,
        ending_hook=ending_hook,
        tts_engine=tts_engine,
        voice=voice,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        speed=speed,
        refine_text=refine_text,
        cover_title=cover_title,
        ending_title=ending_title,
        bgm=bgm
    )
    
    return {"task_id": task_id, "message": "News Video Task started."}


@app.post("/api/dynamic_video")
async def generate_dynamic_video(
    background_tasks: BackgroundTasks,
    prompt: str = Form(...),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    mode: str = Form("prompt"),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(1.0),
    refine_text: bool = Form(True),
    bgm: str = Form(""),
    aspect_ratio: str = Form("9:16"),
    also_generate_landscape: bool = Form(False),
    files: List[UploadFile] = File(None),
    image_descriptions: str = Form("[]"),  # JSON string: ["desc1", "desc2"]
    max_retries: int = Form(1),
    tts_volume: float = Form(1.0),
    media_volume: float = Form(1.0),
    bgm_volume: float = Form(0.15),
    video_duration: float = Form(None)
):
    """Endpoint for LLM Dynamic Template Video generation."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    task_manager.update_status(0.01, "初始化动态模板任务...", "processing", task_type="dynamic_video")
    
    # Process uploaded assets (images and videos)
    user_assets = []
    
    # Create task directory
    task_dir = task_manager.get_dir("")
    task_dir.mkdir(parents=True, exist_ok=True)
    
    if files:
        assets_dir = task_dir / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        
        # Parse descriptions
        try:
            descriptions = json.loads(image_descriptions)
        except:
            descriptions = []
            
        for i, file in enumerate(files):
            # Save file
            file_path = assets_dir / file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            
            # Construct URL
            asset_url = f"http://127.0.0.1:8000/tasks/{task_id}/assets/{file.filename}"
            
            # Identify type
            ext = Path(file.filename).suffix.lower()
            asset_type = "video" if ext in [".mp4", ".mov", ".webm", ".mkv"] else "image"
            
            desc = descriptions[i] if i < len(descriptions) else ""
            user_assets.append({"url": asset_url, "type": asset_type, "description": desc})

    # NEW: Create user_prompt folder and save input meta (including processed images)
    user_prompt_dir = task_dir / "user_prompt"
    user_prompt_dir.mkdir(parents=True, exist_ok=True)
    
    meta_path = user_prompt_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "prompt": prompt,
            "tts_engine": tts_engine,
            "voice": voice,
            "mode": mode,
            "bgm": bgm,
            "aspect_ratio": aspect_ratio,
            "image_descriptions": image_descriptions,
            "user_assets": user_assets, # Updated from user_images
            "timestamp": task_id,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "speed": speed,
            "refine_text": refine_text,
            "max_retries": max_retries,
            "tts_volume": tts_volume,
            "media_volume": media_volume,
            "bgm_volume": bgm_volume,
            "video_duration": video_duration
        }, f, ensure_ascii=False, indent=2)

    background_tasks.add_task(
        process_dynamic_video_pipeline,
        task_id=task_id,
        prompt=prompt,
        tts_engine=tts_engine,
        voice=voice,
        mode=mode,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        speed=speed,
        refine_text=refine_text,
        bgm=bgm,
        aspect_ratio=aspect_ratio,
        user_assets=user_assets, # Updated from user_images
        max_retries=max_retries,
        also_generate_landscape=also_generate_landscape,
        tts_volume=tts_volume,
        media_volume=media_volume,
        bgm_volume=bgm_volume,
        video_duration=video_duration
    )
    
    return {"task_id": task_id, "message": "Dynamic Video Task started."}

    
@app.post("/api/audio_transcribe")
async def audio_transcribe(
    audio: UploadFile = File(...),
    asr_engine: str = Form("funasr")
):
    """Transcription only for Audio-to-Video mode."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    # Save audio
    audio_dir = task_manager.get_dir("audio")
    audio_path = audio_dir / "audio.wav"
    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
        
    task_manager.update_status(0.1, f"正在分析音频 ({asr_engine})...", "processing", task_type="standard")
    
    # Run ASR
    subtitle_path = task_manager.get_dir("subtitle") / "subtitle.txt"
    asr_model = ASRRecognizer(asr_type=asr_engine)
    _, segments = asr_model.recognize(audio_path, subtitle_path)
    
    # Generate default shuo.json
    audio_rel_path = f"tasks/{task_id}/audio/audio.wav"
    shuo_props = {
        "captions": segments,
        "audioUrl": audio_rel_path,
        "images": [],
        "fontSize": 90,
        "centeredStart": True,
        "randomOrientation": True,
        "verticalFirstWord": True
    }
    
    shuo_json_path = audio_dir / "shuo.json"
    with open(shuo_json_path, 'w', encoding='utf-8') as f:
        json.dump(shuo_props, f, ensure_ascii=False, indent=2)
        
    task_manager.update_status(1.0, "识别完成", "completed")
    
    return {"task_id": task_id, "shuo_props": shuo_props}

@app.post("/api/audio_render")
async def audio_render(
    background_tasks: BackgroundTasks,
    task_id: str = Form(...),
    shuo_props: str = Form(...) # JSON string
):
    """Trigger rendering with (potentially modified) shuo_props."""
    task_manager = TaskManager(task_id=task_id)
    props = json.loads(shuo_props)
    
    # Save modified shuo.json
    audio_dir = task_manager.get_dir("audio")
    shuo_json_path = audio_dir / "shuo.json"
    with open(shuo_json_path, 'w', encoding='utf-8') as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
        
    task_manager.update_status(0.5, "正在合成视频...", "processing")
    
    def render_job():
        try:
            video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
            captions = props.get("captions", [])
            total_duration_ms = captions[-1]["endMs"] if captions else 3000
            duration_frames = int((total_duration_ms / 1000) * 30) + 30
            
            run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames)
            task_manager.update_status(1.0, "合成成功！", "completed")
        except Exception as e:
            task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")

    background_tasks.add_task(render_job)
    return {"task_id": task_id, "message": "Render started."}


@app.post("/api/pexels_video_generate")
async def pexels_video_generate(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    title: Optional[str] = Form(""),
    search_query: Optional[str] = Form(""),
    asr_engine: str = Form("funasr"),
    subtitle_layout: str = Form("scroll"),
    bgm: Optional[str] = Form(""),
    media_volume: float = Form(1.0),
    bgm_volume: float = Form(0.15),
    bg_video: Optional[UploadFile] = File(None),
    bg_video_volume: float = Form(0.0)
):
    """Unified single-step pipeline to save video, extract audio, run ASR to get subtitles,
    download background video from Pexels, and render the final Remotion template.
    """
    task_manager = TaskManager()
    task_id = task_manager.task_id
    
    # Create directories
    video_dir = task_manager.get_dir("video")
    audio_dir = task_manager.get_dir("audio")
    subtitle_dir = task_manager.get_dir("subtitle")
    
    # Save uploaded video
    video_path = video_dir / "uploaded_video.mp4"
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
        
    # Save uploaded background video if present
    bg_video_path = None
    if bg_video and bg_video.filename:
        bg_video_path = video_dir / "custom_bg_video.mp4"
        with open(bg_video_path, "wb") as buffer:
            shutil.copyfileobj(bg_video.file, buffer)
        
    task_manager.update_status(0.05, "任务初始化成功，准备执行...", "processing", task_type="standard")
    
    def process_pipeline():
        try:
            # Step 1: Extract audio track
            task_manager.update_status(0.15, "正在提取视频音频...", "processing")
            from video.processor import extract_audio
            audio_path = audio_dir / "audio.wav"
            extract_audio(video_path, audio_path)
            
            # Step 2: Run ASR for subtitles
            task_manager.update_status(0.3, f"正在提取视频字幕 ({asr_engine})...", "processing")
            subtitle_path = subtitle_dir / "subtitle.txt"
            from asr.recognizer import ASRRecognizer
            asr_model = ASRRecognizer(asr_type=asr_engine)
            _, segments = asr_model.recognize(audio_path, subtitle_path)
            
            # Step 3: Search and download video from Pexels (or use custom)
            has_custom_bg = bg_video_path and bg_video_path.exists()
            has_search_query = bool(search_query.strip()) if search_query else False
            generate_both = has_custom_bg and has_search_query

            video_rel_path_custom = ""
            video_rel_path_pexels = ""
            
            if has_custom_bg:
                video_rel_path_custom = f"tasks/{task_id}/video/custom_bg_video.mp4"
                
            if has_search_query:
                query_to_use = search_query.strip()
                task_manager.update_status(0.5, f"正在从 Pexels 搜索视频: {query_to_use}...", "processing")
                from config.settings import PEXELS_API_KEY
                from video.downloader import VideoDownloader
                local_video_path = video_dir / "pexels_video.mp4"
                
                success = VideoDownloader.search_and_download_pexels_video(
                    query=query_to_use,
                    api_key=PEXELS_API_KEY,
                    output_path=local_video_path
                )
                if success:
                    video_rel_path_pexels = f"tasks/{task_id}/video/pexels_video.mp4"
                else:
                    task_manager.update_status(0.6, "未找到匹配视频，将使用渐变背景", "processing")

            # Set video duration based on the last caption end time
            total_duration_ms = segments[-1]["endMs"] if segments else 5000
            duration_frames = int((total_duration_ms / 1000) * 30) + 30
            audio_rel_path = f"tasks/{task_id}/audio/audio.wav"
            from video.remotion_renderer import run_remotion_render

            if generate_both:
                # Render 1: Custom background video
                task_manager.update_status(0.7, "正在合成自定义背景视频...", "processing")
                props_custom = {
                    "title": title or "",
                    "captions": segments,
                    "audioPath": audio_rel_path,
                    "videoPath": video_rel_path_custom,
                    "subtitleLayout": subtitle_layout,
                    "bgmPath": bgm if bgm and bgm != "none" else None,
                    "audioVolume": media_volume,
                    "bgmVolume": bgm_volume,
                    "bgVideoVolume": bg_video_volume
                }
                props_custom_path = task_manager.task_dir / "remotion_props_custom.json"
                with open(props_custom_path, 'w', encoding='utf-8') as f:
                    json.dump(props_custom, f, ensure_ascii=False, indent=2)

                video_output_custom = task_manager.get_dir("videos") / "01_自定义背景视频.mp4"
                run_remotion_render(
                    props_custom_path,
                    video_output_custom,
                    duration_frames=duration_frames,
                    composition_id="PexelsVideoScene"
                )

                # Render 2: Pexels background video
                task_manager.update_status(0.85, "正在合成 Pexels 搜索背景视频...", "processing")
                props_pexels = {
                    "title": title or "",
                    "captions": segments,
                    "audioPath": audio_rel_path,
                    "videoPath": video_rel_path_pexels,
                    "subtitleLayout": subtitle_layout,
                    "bgmPath": bgm if bgm and bgm != "none" else None,
                    "audioVolume": media_volume,
                    "bgmVolume": bgm_volume,
                    "bgVideoVolume": 0.0
                }
                props_pexels_path = task_manager.task_dir / "remotion_props_pexels.json"
                with open(props_pexels_path, 'w', encoding='utf-8') as f:
                    json.dump(props_pexels, f, ensure_ascii=False, indent=2)

                video_output_pexels = task_manager.get_dir("videos") / "02_Pexels搜索背景视频.mp4"
                run_remotion_render(
                    props_pexels_path,
                    video_output_pexels,
                    duration_frames=duration_frames,
                    composition_id="PexelsVideoScene"
                )

                # Write clips.json metadata so both clips display correctly in the Web UI
                clips_metadata = [
                    {"title": "自定义背景版", "summary": "使用上传的自定义视频作为背景"},
                    {"title": "Pexels背景版", "summary": f"基于 Pexels 搜索关键词 '{query_to_use}' 生成的视频"}
                ]
                clips_json_path = task_manager.get_dir("ai") / "clips.json"
                clips_json_path.parent.mkdir(parents=True, exist_ok=True)
                with open(clips_json_path, 'w', encoding='utf-8') as f:
                    json.dump(clips_metadata, f, ensure_ascii=False, indent=2)
            else:
                task_manager.update_status(0.75, "正在合成视频...", "processing")
                props = {
                    "title": title or "",
                    "captions": segments,
                    "audioPath": audio_rel_path,
                    "videoPath": video_rel_path_custom or video_rel_path_pexels,
                    "subtitleLayout": subtitle_layout,
                    "bgmPath": bgm if bgm and bgm != "none" else None,
                    "audioVolume": media_volume,
                    "bgmVolume": bgm_volume,
                    "bgVideoVolume": bg_video_volume if has_custom_bg else 0.0
                }
                
                props_path = task_manager.task_dir / "remotion_props.json"
                with open(props_path, 'w', encoding='utf-8') as f:
                    json.dump(props, f, ensure_ascii=False, indent=2)
                    
                video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
                run_remotion_render(
                    props_path,
                    video_output,
                    duration_frames=duration_frames,
                    composition_id="PexelsVideoScene"
                )
            
            task_manager.update_status(1.0, "合成成功！", "completed")
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            task_manager.update_status(1.0, f"处理失败: {str(e)}", "error")
            
    background_tasks.add_task(process_pipeline)
    return {"task_id": task_id, "message": "Pexels video generation task started."}



@app.post("/api/tts")
def generate_tts_api(
    text: str = Form(...),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(5.0),
    refine_text: bool = Form(True),
    save_path: str = Form(...),
    caption_save_path: Optional[str] = Form(None)
):
    """Independent API to generate TTS audio and save it to the specified path."""
    try:
        from pathlib import Path
        output_path = Path(save_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        output_base = str(output_path.with_suffix(''))
        json_path = None

        # Preprocess text to convert dot patterns to "点" for proper TTS reading:
        # e.g., "1.2" -> "1点2", "a.b" -> "a点b"
        import re
        processed_text = re.sub(r'(?<=[a-zA-Z0-9])\.(?=[a-zA-Z0-9])', '点', text)

        # Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            from tts.kokoro_processor import run_kokoro_tts_sync
            audio_path, json_path = run_kokoro_tts_sync(processed_text, output_base, voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                processed_text, output_base, voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(processed_text, output_base, voice_instruct=voice)
        elif tts_engine == "voxcpm":
            audio_path, json_path = run_voxcpm_tts_sync(processed_text, output_base, voice=voice)
        elif tts_engine == "mlx":
            audio_path, json_path = run_mlx_tts_sync(processed_text, output_base, voice=voice, speed=speed)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(processed_text, output_base, voice=voice)

        final_audio_path = Path(audio_path)
        audio_path_to_return = str(final_audio_path)
        
        # If the requested save_path has a specific extension that differs from what the engine output
        if final_audio_path.absolute() != output_path.absolute() and output_path.suffix:
            import shutil
            shutil.move(str(final_audio_path), str(output_path))
            audio_path_to_return = str(output_path)

        # Read the corresponding JSON file (captions/timestamps)
        captions = []
        if json_path:
            json_file_path = Path(json_path)
            if json_file_path.exists():
                try:
                    with open(json_file_path, "r", encoding="utf-8") as f:
                        captions = json.load(f)
                    
                    # Restore "点" to "." for letters and digits combinations in captions
                    for c in captions:
                        if "text" in c and c["text"]:
                            c["text"] = re.sub(r'(?<=[a-zA-Z0-9])点(?=[a-zA-Z0-9])', '.', c["text"])
                except Exception as e:
                    print(f"Error reading TTS JSON file {json_file_path}: {e}")

        # Write captions data to caption_save_path if it is provided
        caption_path_to_return = None
        if caption_save_path:
            try:
                caption_output_path = Path(caption_save_path)
                caption_output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(caption_output_path, "w", encoding="utf-8") as f:
                    json.dump(captions, f, ensure_ascii=False, indent=2)
                caption_path_to_return = str(caption_output_path)
            except Exception as e:
                print(f"Error writing captions to {caption_save_path}: {e}")

        return {
            "status": "success",
            "save_path": audio_path_to_return,
            "caption_save_path": caption_path_to_return,
            "captions": captions
        }

    except Exception as e:
        import traceback
        return JSONResponse(status_code=500, content={"error": f"TTS generation failed: {str(e)}\n{traceback.format_exc()}"})

def process_regeneration_task(task_id: str):
    """Background task to regenerate a new dynamic video using existing context."""
    task_manager = TaskManager(task_id=task_id)
    task_dir = task_manager.get_dir("")
    user_prompt_dir = task_dir / "user_prompt"
    
    try:
        # 1. Load meta.json
        meta_path = user_prompt_dir / "meta.json"
        if not meta_path.exists():
            raise FileNotFoundError("Task meta.json not found.")
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            
        if meta.get("mode") in ("json", "voiceover"):
            # Direct JSON / Voiceover re-rendering!
            task_manager.update_status(0.2, "正在重新合成视频...", "processing")
            
            # Read props
            props_path = task_dir / "remotion_props.json"
            if not props_path.exists():
                raise FileNotFoundError("Task remotion_props.json not found.")
            with open(props_path, "r", encoding="utf-8") as f:
                props = json.load(f)
            
            if "ttsVolume" not in props:
                props["ttsVolume"] = meta.get("tts_volume", 1.0)
            if "mediaVolume" not in props:
                props["mediaVolume"] = meta.get("media_volume", 1.0)
            if "bgmVolume" not in props:
                props["bgmVolume"] = meta.get("bgm_volume", 0.15)

            audio_dir = task_manager.get_dir("audio")
            shuo_json_path = audio_dir / "shuo.json"
            
            with open(shuo_json_path, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)

            output_base = task_dir / "audio" / "tts_output"
            json_path = output_base.with_suffix('.json')
            
            if json_path.exists():
                with open(json_path, 'r', encoding='utf-8') as f:
                    captions_timing = json.load(f)
                total_duration_ms = captions_timing[-1]["endMs"] if captions_timing else 3000
                
                # Calculate max video asset duration for regeneration
                max_video_duration_ms = 0
                if meta.get("mode") == "voiceover":
                    import ffmpeg
                    for v in props.get("videos", []):
                        filename = Path(v).name
                        local_path = task_dir / "assets" / filename
                        if local_path.exists():
                            try:
                                probe = ffmpeg.probe(str(local_path))
                                duration = float(probe['format']['duration'])
                                max_video_duration_ms = max(max_video_duration_ms, int(duration * 1000))
                            except Exception as e:
                                print(f"Error probing video {local_path}: {e}")

                if max_video_duration_ms > total_duration_ms:
                    total_duration_ms = max_video_duration_ms
                    
                buffer = 15 if meta.get("mode") == "voiceover" else 60
                duration_frames = int((total_duration_ms / 1000) * 30) + buffer
            else:
                custom_duration = props.get("videoDuration") or props.get("duration") or meta.get("video_duration")
                if custom_duration is not None:
                    duration_frames = int(float(custom_duration) * 30)
                else:
                    duration_frames = 300 # default 10s if no captions/audio
            
            import time
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            video_output = task_dir / "videos" / f"remotion_video_regen_{timestamp}.mp4"
            
            comp_id = "VoiceoverScene" if meta.get("mode") == "voiceover" else "AITemplate"
            
            from video.remotion_renderer import run_remotion_render
            run_remotion_render(shuo_json_path, video_output, duration_frames=duration_frames, composition_id=comp_id)
            
            default_output = task_dir / "videos" / "remotion_video.mp4"
            import shutil
            shutil.copy(str(video_output), str(default_output))
            
            task_manager.update_status(1.0, f"重新生成成功！(文件名: {video_output.name})", "completed")
            return

        # 2. Load developer_context.txt (User Intent)
        dev_context_path = user_prompt_dir / "developer_context.txt"
        if not dev_context_path.exists():
            raise FileNotFoundError("Task developer_context.txt not found.")
        with open(dev_context_path, "r", encoding="utf-8") as f:
            combined_intent = f.read()
            
        # 3. Load remotion_props.json
        props_path = task_dir / "remotion_props.json"
        if not props_path.exists():
            raise FileNotFoundError("Task remotion_props.json not found.")
        with open(props_path, "r", encoding="utf-8") as f:
            props = json.load(f)

        # 4. Calculate Duration
        captions = props.get("captions", [])
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30

        task_manager.update_status(0.2, "正在基于上次提示词重新生成代码...", "processing")
        
        # 5. Initialize Generator
        from video.llm_provider import get_llm_provider
        import time
        from pathlib import Path
        
        provider_name = meta.get("llm_vendor") or os.environ.get("LLM_VENDOR", "mimo")
        provider = get_llm_provider(provider_name)
        remotion_dir = Path(__file__).parent / "skills" / "remotion"
        
        gen_mode = os.environ.get("REMOTION_GEN_MODE", "overwrite").lower()
        if gen_mode in ("chunkdiff", "dsl"):
            from video.remotion_generator_dsl import RemotionGeneratorDSL
            generator = RemotionGeneratorDSL(remotion_dir, provider, mode="dsl")
        else:
            from video.remotion_generator import RemotionGenerator
            generator = RemotionGenerator(remotion_dir, provider)
        
        # 6. Execute Generation and Render
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        video_output = task_dir / "videos" / f"remotion_video_regen_{timestamp}.mp4"
        
        task_log_dir = task_dir / "logs"
        task_log_dir.mkdir(parents=True, exist_ok=True)

        generator.generate_and_render(
            user_intent=combined_intent,
            props=props,
            output_path=str(video_output),
            duration_frames=duration_frames,
            max_retries=meta.get("max_retries", 1),
            aspect_ratio=meta.get("aspect_ratio", "9:16"),
            log_dir=task_log_dir
        )
        
        task_manager.update_status(1.0, f"重新生成成功！(文件名: {video_output.name})", "completed")
        
    except Exception as e:
        import traceback
        error_msg = f"再生成失败 (将恢复之前状态): {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        # 优化：再生成失败时默认成功，避免影响之前已生成的视频展示
        task_manager.update_status(1.0, f"再生成已结束 (保持原状)", "completed")


@app.post("/api/tasks/{task_id}/regenerate_dynamic")
async def regenerate_dynamic_video(task_id: str, background_tasks: BackgroundTasks):
    """Endpoint to trigger a new generation based on previous context."""
    task_manager = TaskManager(task_id=task_id)
    task_manager.update_status(0.1, "正在基于上次提示词重新生成代码...", "processing")
    background_tasks.add_task(process_regeneration_task, task_id)
    return {"message": "Regeneration task started.", "task_id": task_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
