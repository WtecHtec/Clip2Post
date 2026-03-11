import os
import shutil
import asyncio
from pathlib import Path
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

# Initialize NLP models (global ones that don't need dynamic config)
asr_model_global = ASRRecognizer() # Just for reference, not always used directly now
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
        task_asr_model.recognize(audio_path, subtitle_path)
        
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
    task_manager.update_status(0.05, status_msg, "processing")
    
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
                        tasks_list.append(status)
                except Exception:
                    pass
    return {"tasks": tasks_list}

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
    
    # Get video clips
    videos_dir = task_manager.get_dir("videos")
    video_clips_urls = [f"/tasks/{task_id}/videos/{vid.name}" for vid in sorted(videos_dir.glob("*.mp4"))] if videos_dir.exists() else []
    
    # Get audio
    audio_path = task_manager.get_dir("audio") / "audio.wav"
    audio_url = f"/tasks/{task_id}/audio/audio.wav" if audio_path.exists() else None
    
    # Get source video
    source_video_path = task_manager.get_dir("video") / "source.mp4"
    source_video_url = f"/tasks/{task_id}/video/source.mp4" if source_video_path.exists() else None
    
    return {
        "subtitles": subtitle_content,
        "markdown": article_content,
        "images": images_urls,
        "html_url": html_url,
        "video_clips": video_clips_urls,
        "audio_url": audio_url,
        "source_video": source_video_url
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
