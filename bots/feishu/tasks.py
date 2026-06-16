import os
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from config.settings import (
    DEFAULT_TTS_ENGINE,
    DEFAULT_TTS_VOICE,
    BOT_OPENAI_API_KEY,
    BOT_OPENAI_BASE_URL,
    BOT_LLM_MODEL,
    DEFAULT_BGM,
    DEFAULT_BG
)
from utils.task import TaskManager
from bots.feishu.client import (
    send_message,
    upload_file_to_lark,
    send_file_message,
    send_distribute_card
)

# LLM script generation helper using bot parameters
def generate_script_from_topic(topic: str) -> dict:
    from openai import OpenAI
    client = OpenAI(api_key=BOT_OPENAI_API_KEY, base_url=BOT_OPENAI_BASE_URL)
    
    prompt = f"""
    你是一个抖音短视频脚本创作专家，专注于AI科技资讯内容。

我会给你一段AI相关资讯，直接输出以下JSON格式，不要任何额外说明：

---

【输出格式】

{{   "author": "世界在分享.AI",   "fontMode": "pixel",   "topic": string,           // 栏目标签，如 "AI工具速递" "AI硬件" "开源项目"   "title": string,           // 视频标题，15字以内，冲击力强   "titleHighlight": string,  // 标题中需要高亮的关键词（1-3个字）   "bodyText": string,        // 资讯核心重点，一句完整描述，20-40字   "images": [],              // 图片URL，默认空数组   "videos": [],              // 视频URL，默认空数组   "progressPercent": number, // 进度条百分比，默认25   "outroTagline": "AI · 工具 · 变现",   "captions": string,        // 口播文案，用于TTS，15-20秒时长   "snsTitle": string         // 发布自媒体的标题，25字以内，适合小红书/抖音风格 }}

---

【各字段写作规则】

topic： - 根据资讯内容自动判断，常用标签：   AI工具速递 / AI硬件 / 开源项目 / 行业动态 / AI大模型

title（视频标题）： - 直接说结论，不交代背景 - 颠覆认知或反常识的冲击感 - 禁止以"某某发布/表示/报告显示"开头 - 15字以内

titleHighlight： - 从title中选1-3个最有冲击力的关键词 - 这些词会在视频中显示为紫色高亮

bodyText： - 不是关键词标签，而是一句完整的重点描述 - 直接说清楚这件事是什么，20-40字

captions（口播文案）： - 开头：直接抛结论，不交代背景 - 中间：核心信息2-3个点，每句不超过15字 - 变现方向（可选）：仅当有明确商业应用场景时加入，只说能做什么 - 结尾：一句有观点有态度的总结 - 口语化，像真人说话 - 整体15-30秒时长

snsTitle（自媒体标题）： - 适合小红书/抖音发布时用的标题 - 带话题标签风格，如 #AI #科技 - 口语化，有传播性 - 25字以内

---

【写作原则】 - 直接输出JSON，不加任何解释 - captions口语化，不像念稿 - 所有文案不做销售引导

---

现在请处理以下资讯： {topic}
    
    要求生成的 JSON 必须包含以下字段，并且只返回纯 JSON，不能包含任何 markdown 标记（如 ```json 等）：
    {{
      "author": "作者署名，例如：世界在分享.AI",
      "fontMode": "字体样式，例如：pixel，也可以为空",
      "topic": "视频的话题分类，例如：AI工具速递",
      "title": "视频主标题，一定要简短震撼、吸引眼球",
      "titleHighlight": "主标题中的高亮核心词语",
      "bodyText": "视频核心正文的简介/摘要（1-2句话）",
      "images": [],
      "videos": [],
      "progressPercent": 50,
      "outroTagline": "片尾口号，例如：AI · 工具 · 变现",
      "captions": "视频的完整口播/配音文本，字数在150-250字左右，适合短视频朗读，语句通顺流畅，具有煽动性或干货感。不要带时间戳。",
      "snsTitle": "发布社交平台（如小红书、抖音）时的推荐标题及话题标签，例如：微软出了个7B模型直接接管鼠标键盘，打工人看了沉默了 #微软 #AI工具 #自动化"
    }}
    """
    
    response = client.chat.completions.create(
        model=BOT_LLM_MODEL,
        messages=[
            {"role": "system", "content": "你是一个只输出合法 JSON 的自媒体写作系统。"},
            {"role": "user", "content": prompt}
        ],
        response_format={ "type": "json_object" }
    )
    
    content = response.choices[0].message.content.strip()
    return json.loads(content)

# Render async thread helper
def run_video_pipeline_async(open_id: str, task_id: str, script_data: dict, session: dict):
    try:
        from main import process_dynamic_video_pipeline
        task_manager = TaskManager(task_id=task_id)
        
        user_assets = None
        latest_media_path = session.get("latest_media_path") if session else None
        latest_media_name = session.get("latest_media_name") if session else None
        
        if latest_media_path and os.path.exists(latest_media_path):
            assets_dir = task_manager.task_dir / "assets"
            assets_dir.mkdir(parents=True, exist_ok=True)
            dest_path = assets_dir / latest_media_name
            if latest_media_path != str(dest_path):
                shutil.move(latest_media_path, dest_path)
            
            is_video = latest_media_name.lower().endswith(('.mp4', '.mov', '.webm', '.avi', '.m4v'))
            asset_type = "video" if is_video else "image"
            
            user_assets = [{
                "url": str(dest_path),
                "type": asset_type,
                "description": "Feishu upload background"
            }]
            
        # Directly use DEFAULT_BG for bgImage
        script_data["bgImage"] = DEFAULT_BG
            
        prompt_json_str = json.dumps(script_data, ensure_ascii=False)
        
        print(f"[Feishu Bot] Starting video render for task {task_id}...")
        process_dynamic_video_pipeline(
            task_id=task_id,
            prompt=prompt_json_str,
            tts_engine=DEFAULT_TTS_ENGINE,
            voice=DEFAULT_TTS_VOICE,
            mode="json",
            temperature=0.3,
            top_p=0.7,
            top_k=20,
            speed=1.0,
            refine_text=True,
            bgm=DEFAULT_BGM,
            aspect_ratio="9:16",
            user_assets=user_assets,
            max_retries=1
        )
        
        # Check generated file
        video_output_path = task_manager.get_dir("videos") / "remotion_video.mp4"
        if not video_output_path.exists():
            raise Exception("渲染后的视频文件不存在")
            
        # Upload video to Lark
        print(f"[Feishu Bot] Uploading video to Feishu...")
        file_key = upload_file_to_lark(str(video_output_path), file_type="stream")
        
        # Send video file message
        send_file_message("open_id", open_id, file_key)
        
        # Push Card B (Distribute card)
        send_distribute_card(open_id, str(video_output_path), script_data.get("snsTitle") or script_data.get("sns_title") or script_data.get("title", "生成的视频"))
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = f"❌ 渲染生成视频失败:\n{str(e)}"
        send_message("open_id", open_id, "text", json.dumps({"text": error_msg}))

def escape_for_double_quotes(val: str) -> str:
    """Escape special shell characters for safe usage inside double quotes in a shell command."""
    val = val.replace("\\", "\\\\")  # Escape backslashes first
    val = val.replace('"', '\\"')    # Escape double quotes
    val = val.replace('$', '\\$')    # Escape dollar signs
    val = val.replace('`', '\\`')    # Escape backticks
    return val


import threading

distribute_lock = threading.Lock()


# Distribute async thread helper
def distribute_video_async(open_id: str, task_id: str, platform: str, video_path: str, title: str):
    try:
        flowauto_dir = Path(__file__).resolve().parent.parent.parent / "flowauto"
        config_path = flowauto_dir / "conofig.json"
        if not config_path.exists():
            config_path = flowauto_dir / "conofig.dev.json"
            
        if not config_path.exists():
            raise Exception("分发配置文件 (conofig.json) 不存在")
            
        with open(config_path, "r", encoding="utf-8") as f:
            platforms_config = json.load(f)
            
        # Map incoming English/custom platform names to Chinese platform names in conofig.json
        platform_mapping = {
            "xiaohongshu": "小红书",
            "xhs": "小红书",
            "douyin": "抖音",
            "dy": "抖音",
            "shipinhao": "视频号",
            "sph": "视频号",
            "wechat": "视频号"
        }
        mapped_platform = platform_mapping.get(platform.lower(), platform)
            
        platform_map = {p["platform"]: p for p in platforms_config}
        if mapped_platform not in platform_map:
            raise Exception(f"分发配置中未找到平台: {mapped_platform}")
            
        p_cfg = platform_map[mapped_platform]
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
                val = str(Path(video_path).resolve())
            elif key.lower() in ("title", "desc", "description", "text", "content"):
                val = title
                
            val_escaped = escape_for_double_quotes(val)
            cmd_parts.append(f'--{key} "{val_escaped}"')
            
        cmd_str = " ".join(cmd_parts)
        print(f"Running flowauto: {cmd_str}")
        
        # Log path
        task_manager = TaskManager(task_id=task_id)
        log_file_path = task_manager.get_dir("llm_logs") / f"distribute_{mapped_platform}.log"
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        if distribute_lock.locked():
            send_message("open_id", open_id, "text", json.dumps({"text": f"⏳ 当前有其他平台分发任务正在运行，已将分发至 [{mapped_platform}] 的任务加入队列，请稍候..."}))
            
        with distribute_lock:
            with open(log_file_path, "w", encoding="utf-8") as log_f:
                log_f.write(f"Executing: {cmd_str}\n\n")
                log_f.flush()
                result = subprocess.run(
                    cmd_str,
                    shell=True,
                    stdout=log_f,
                    stderr=subprocess.STDOUT,
                    text=True,
                    check=False
                )
            
        # Check logs for success
        has_success = False
        if log_file_path.exists():
            with open(log_file_path, "r", encoding="utf-8") as lf:
                for line in lf:
                    if "分发任务完成" in line:
                        has_success = True
                        break
                        
        if has_success or result.returncode == 0:
            msg = f"🎉 成功分发视频至 [{mapped_platform}]！"
        else:
            msg = f"❌ 分发至 [{mapped_platform}] 失败，请检查配置或日志。"
            
        send_message("open_id", open_id, "text", json.dumps({"text": msg}))
    except Exception as e:
        msg = f"❌ 分发至 [{mapped_platform}] 时发生错误:\n{str(e)}"
        send_message("open_id", open_id, "text", json.dumps({"text": msg}))
