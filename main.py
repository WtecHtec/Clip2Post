import os
import shutil
import asyncio
import json
from pathlib import Path
from typing import List
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

# Mount bgm directory so Remotion can download BGM via http://localhost:8000/bgm/
_BGM_DIR = Path(__file__).parent / "bgm"
_BGM_DIR.mkdir(exist_ok=True)
app.mount("/bgm", StaticFiles(directory=str(_BGM_DIR)), name="bgm")

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
    temperature: float = 0.3,
    top_p: float = 0.7,
    top_k: int = 20,
    speed: float = 5,
    refine_text: bool = True,
    bgm: str = "",
    aspect_ratio: str = "9:16",
    user_images: List[dict] = None,  # [{"url": "...", "description": "..."}]
    max_retries: int = 1
):
    """Background task for LLM Dynamic Template Video generation."""
    task_manager = TaskManager(task_id=task_id)
    try:
        from video.llm_provider import get_llm_provider
        from video.remotion_generator import RemotionGenerator
        provider = get_llm_provider()

        task_manager.update_status(0.05, "正在构思视频文案与风格...", "processing", task_type="dynamic_video")
        
        # Step 1: Generate Voiceover and Visual Style
        prompt_path = Path(__file__).parent / "video" / "prompts" / "dynamic_video_director.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            system_msg = f.read()

        user_content = f"视频比例：{aspect_ratio}\n用户需求：{prompt}"
        if user_images:
            user_content += "\n\n用户提供的素材图片（请优先考虑在脚本中合理展示它们）：\n"
            for idx, img in enumerate(user_images):
                user_content += f"- 图片{idx+1}: {img['description']} (引用地址: {img['url']})\n"
            user_content += "\n请在脚本的 scene 元素中增加一个 image_url 字段（如果该场景适合展示某张用户图片）。"

        # NEW: Save Director prompt context
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
        
        # Parse JSON - robust multi-step approach
        import re, json
        
        # Step 0: Strip <think>...</think> blocks emitted by reasoning models
        llm_resp_clean = re.sub(r'<think>.*?</think>', '', llm_resp, flags=re.DOTALL).strip()
        
        # Step 1: Try extracting from ```json ... ``` code block
        json_block_match = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*\n?```', llm_resp_clean, re.DOTALL)
        if json_block_match:
            raw_json = json_block_match.group(1)
        else:
            # Step 2: Try to find outermost { ... }
            brace_match = re.search(r'\{.*\}', llm_resp_clean, re.DOTALL)
            raw_json = brace_match.group(0) if brace_match else None

        data = None
        if raw_json:
            # Try strict=False first
            try:
                data = json.loads(raw_json, strict=False)
            except json.JSONDecodeError:
                pass
            
            if data is None:
                # Try replacing literal newlines inside string values
                try:
                    # Replace literal newlines that appear inside JSON strings
                    fixed = re.sub(r'(?<!\\)\n', r'\\n', raw_json)
                    data = json.loads(fixed, strict=False)
                except json.JSONDecodeError:
                    pass

        # Step 3: Field-by-field regex fallback  
        if data is None:
            visual_match = re.search(r'"visual_style"\s*:\s*"(.*?)"(?=\s*[,}])', llm_resp_clean, re.DOTALL)
            # For scenes, we try to grab a list but fallback is harder. 
            # If everything else fails, we just use the clean text for voiceover.
            data = {
                "visual_style": visual_match.group(1).replace('\\n', '\n') if visual_match else "",
                "scenes": [] # Fallback
            }
        
        scenes = data.get("scenes", [])
        visual_style = data.get("visual_style", "").strip()
        
        if not scenes:
            # Fallback if scenes missing but voiceover exists (for backward compatibility or error)
            v_text = data.get("voiceover", "").strip()
            if v_text:
                scenes = [{"text": v_text, "visual": visual_style, "image_url": ""}]
            else:
                raise ValueError(f"LLM generated empty script. Raw response: {llm_resp_clean[:300]}")

        # Join all scene texts for TTS
        voiceover_text = " ".join([s.get("text", "").strip() for s in scenes])
        
        task_manager.update_status(0.1, f"正在生成语音 ({tts_engine})...", "processing", task_type="dynamic_video")
        
        # Save raw text as subtitle for UI display
        subtitle_dir = task_manager.get_dir("subtitle")
        with open(subtitle_dir / "subtitle.txt", 'w', encoding='utf-8') as f:
            f.write(voiceover_text)
        
        audio_dir = task_manager.get_dir("audio")
        output_base = audio_dir / "tts_output"
        
        # 2. Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            from tts.kokoro_processor import run_kokoro_tts_sync
            audio_path, json_path = run_kokoro_tts_sync(voiceover_text, str(output_base), voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                voiceover_text, str(output_base), voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(voiceover_text, str(output_base), voice_instruct=voice)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(voiceover_text, str(output_base), voice=voice)

        task_manager.update_status(0.4, "正在使用 LLM 生成动态视频模板...", "processing")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            captions = json.load(f)
            
        import re
        # Clean captions and map images
        # Simple mapping: distribute scenes over captions by text matching or sequence
        # Here we use a simple sequence-based approach since texts are joined in order
        current_scene_idx = 0
        current_scene_text_accum = ""
        
        # Whitelist of valid image URLs
        valid_image_urls = {img['url'] for img in (user_images or [])}
        
        for c in captions:
            if "text" in c:
                c["text"] = re.sub(r'\[.*?\]\s*', '', c["text"]).strip()
                # Attach image_url if this caption belongs to a scene that has one
                scene = scenes[current_scene_idx] if current_scene_idx < len(scenes) else scenes[-1]
                
                img_url = scene.get("image_url", "")
                # SAFETY CHECK: Only allow URLs that were actually provided to the LLM
                if img_url and img_url not in valid_image_urls:
                    print(f"      [Warning] Filtering hallucinated image_url: {img_url}")
                    img_url = ""
                
                c["image_url"] = img_url
                c["visual_suggestion"] = scene.get("visual", "")
                
                # If this caption's text starts to look like the NEXT scene's text, we might want to advance
                # But TTS often splits sentences. So we just advance when we've seen enough of the current scene.
                current_scene_text_accum += c["text"]
                if current_scene_idx < len(scenes) - 1:
                    target_text = scenes[current_scene_idx].get("text", "").strip()
                    # If we've reached the end of current scene's text (roughly)
                    if len(current_scene_text_accum) >= len(target_text) * 0.9:
                        current_scene_idx += 1
                        current_scene_text_accum = ""
        
        audio_abs_url = f"http://localhost:8000/tasks/{task_id}/audio/{Path(audio_path).name}"
        
        props = {
            "captions": captions,
            "audioUrl": audio_abs_url,
        }
        if bgm:
            props["bgm"] = bgm
            
        video_output = task_manager.get_dir("videos") / "remotion_video.mp4"
        total_duration_ms = captions[-1]["endMs"] if captions else 3000
        duration_frames = int((total_duration_ms / 1000) * 30) + 30
        
        remotion_dir = Path(__file__).parent / "skills" / "remotion"
        generator = RemotionGenerator(remotion_dir, provider)
        
        task_manager.update_status(0.6, "正在渲染动态模板...", "processing")
        
        # Combine user prompt, visual style and scene suggestions for the component generator
        scene_guidelines = "\n".join([f"Scene {i+1}: {s.get('visual')}" for i, s in enumerate(scenes)])
        
        # Include actual subtitles and timings for the LLM to refer to
        subtitles_json = json.dumps(captions, ensure_ascii=False, indent=2)
        
        combined_intent = f"User Request: {prompt}\n\nVisual Style Directives:\n{visual_style}\n\nScene Guidelines:\n{scene_guidelines}\n\nFinal Subtitles & Timings:\n{subtitles_json}"
        
        # If user images were provided, explicitly mention they are in the captions image_url field
        if user_images:
            combined_intent += "\n\nIMPORTANT: User images are provided in the 'image_url' field of each caption in props. Please render them when image_url is not empty."

        # NEW: Save Developer prompt context
        with open(user_prompt_dir / "developer_context.txt", "w", encoding="utf-8") as f:
            f.write(combined_intent)

        generator.generate_and_render(
            user_intent=combined_intent,
            props=props,
            output_path=str(video_output),
            duration_frames=duration_frames,
            log_dir=task_log_dir,
            max_retries=max_retries,
            aspect_ratio=aspect_ratio
        )
        
        task_manager.update_status(1.0, "合成成功！", "completed")
        
    except Exception as e:
        import traceback
        task_manager.update_status(1.0, f"合成失败: {str(e)}", "error")
        print(traceback.format_exc())


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
                "content": ""
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

    return {
        "subtitles": subtitle_content,
        "markdown": article_content,
        "images": images_urls,
        "html_url": html_url,
        "video_clips": video_clips_data,
        "audio_url": audio_url,
        "source_video": source_video_url,
        "tts_config": tts_config,
        "task_type": task_type
    }

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
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(1.0),
    refine_text: bool = Form(True),
    bgm: str = Form(""),
    aspect_ratio: str = Form("9:16"),
    files: List[UploadFile] = File(None),
    image_descriptions: str = Form("[]"),  # JSON string: ["desc1", "desc2"]
    max_retries: int = Form(1)
):
    """Endpoint for LLM Dynamic Template Video generation."""
    task_manager = TaskManager()
    task_id = task_manager.task_id
    task_manager.update_status(0.01, "初始化动态模板任务...", "processing", task_type="dynamic_video")
    
    # Process uploaded images
    user_images = []
    
    # Create task directory
    task_dir = task_manager.get_dir("")
    task_dir.mkdir(parents=True, exist_ok=True)
    
    if files:
        images_dir = task_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        
        # Parse descriptions
        try:
            descriptions = json.loads(image_descriptions)
        except:
            descriptions = []
            
        for i, file in enumerate(files):
            # Save file
            file_path = images_dir / file.filename
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            
            # Construct URL (assuming FastAPI is accessible at localhost:8000)
            img_url = f"http://localhost:8000/tasks/{task_id}/images/{file.filename}"
            desc = descriptions[i] if i < len(descriptions) else ""
            user_images.append({"url": img_url, "description": desc})

    # NEW: Create user_prompt folder and save input meta (including processed images)
    user_prompt_dir = task_dir / "user_prompt"
    user_prompt_dir.mkdir(parents=True, exist_ok=True)
    
    meta_path = user_prompt_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "prompt": prompt,
            "tts_engine": tts_engine,
            "voice": voice,
            "bgm": bgm,
            "aspect_ratio": aspect_ratio,
            "image_descriptions": image_descriptions,
            "user_images": user_images, # Save the URLs for CLI tool
            "timestamp": task_id,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "speed": speed,
            "refine_text": refine_text,
            "max_retries": max_retries
        }, f, ensure_ascii=False, indent=2)

    background_tasks.add_task(
        process_dynamic_video_pipeline,
        task_id=task_id,
        prompt=prompt,
        tts_engine=tts_engine,
        voice=voice,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        speed=speed,
        refine_text=refine_text,
        bgm=bgm,
        aspect_ratio=aspect_ratio,
        user_images=user_images,
        max_retries=max_retries
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

@app.post("/api/tts")
async def generate_tts_api(
    text: str = Form(...),
    tts_engine: str = Form("edge"),
    voice: str = Form(""),
    temperature: float = Form(0.3),
    top_p: float = Form(0.7),
    top_k: int = Form(20),
    speed: float = Form(5.0),
    refine_text: bool = Form(True),
    save_path: str = Form(...)
):
    """Independent API to generate TTS audio and save it to the specified path."""
    try:
        from pathlib import Path
        output_path = Path(save_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        output_base = str(output_path.with_suffix(''))

        # Generate TTS
        if tts_engine == "kokoro":
            voice = voice or "af_heart"
            from tts.kokoro_processor import run_kokoro_tts_sync
            audio_path, json_path = run_kokoro_tts_sync(text, output_base, voice=voice)
        elif tts_engine == "chattts":
            from tts.chattts_processor import run_chattts_sync
            audio_path, json_path = run_chattts_sync(
                text, output_base, voice=voice,
                temperature=temperature, top_p=top_p, top_k=top_k, 
                speed=speed, refine_text_flag=refine_text
            )
        elif tts_engine == "omnivoice":
            from tts.omnivoice_processor import run_omnivoice_tts_sync
            audio_path, json_path = run_omnivoice_tts_sync(text, output_base, voice_instruct=voice)
        else:
            voice = voice or "zh-CN-XiaoxiaoNeural"
            from tts.processor import run_tts_sync
            audio_path, json_path = run_tts_sync(text, output_base, voice=voice)

        final_audio_path = Path(audio_path)
        audio_path_to_return = str(final_audio_path)
        
        # If the requested save_path has a specific extension that differs from what the engine output
        if final_audio_path.absolute() != output_path.absolute() and output_path.suffix:
            import shutil
            shutil.move(str(final_audio_path), str(output_path))
            audio_path_to_return = str(output_path)

        return {"status": "success", "save_path": audio_path_to_return}

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
        from video.remotion_generator import RemotionGenerator
        import time
        from pathlib import Path
        
        provider_name = meta.get("llm_vendor") or os.environ.get("LLM_VENDOR", "mimo")
        provider = get_llm_provider(provider_name)
        remotion_dir = Path(__file__).parent / "skills" / "remotion"
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
        error_msg = f"再生成失败: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        task_manager.update_status(0.0, f"失败: {str(e)}", "failed")


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
