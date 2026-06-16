import os
import re
import json
import threading
from datetime import datetime
import lark_oapi as lark
from lark_oapi.api.im.v1 import P2ImMessageReceiveV1
from lark_oapi.api.im.v1.model.p2_im_chat_access_event_bot_p2p_chat_entered_v1 import (
    P2ImChatAccessEventBotP2pChatEnteredV1
)
from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger,
    P2CardActionTriggerResponse,
)

from utils.task import TaskManager
from bots.feishu.config import (
    LARK_ENCRYPT_KEY,
    LARK_VERIFICATION_TOKEN,
    TOPIC_CONFIRM_CARD_ID
)
from bots.feishu.session import get_session, set_session, delete_session
from bots.feishu.client import (
    send_message,
    send_welcome_message,
    send_topic_confirm_card,
    update_message_card,
    download_image_from_lark,
    download_file_from_lark
)
from bots.feishu.tasks import (
    generate_script_from_topic,
    run_video_pipeline_async,
    distribute_video_async
)

from pathlib import Path

WELCOME_USERS_FILE = Path(__file__).resolve().parent.parent.parent / "tasks" / "feishu_welcome_users.json"

def has_received_welcome(open_id: str) -> bool:
    if not WELCOME_USERS_FILE.exists():
        return False
    try:
        with open(WELCOME_USERS_FILE, "r", encoding="utf-8") as f:
            users = json.load(f)
            return open_id in users
    except Exception:
        return False

def mark_received_welcome(open_id: str) -> None:
    users = []
    if WELCOME_USERS_FILE.exists():
        try:
            with open(WELCOME_USERS_FILE, "r", encoding="utf-8") as f:
                users = json.load(f)
        except Exception:
            pass
    if open_id not in users:
        users.append(open_id)
        try:
            WELCOME_USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(WELCOME_USERS_FILE, "w", encoding="utf-8") as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

# Handle user enter bot single chat event
def do_p2_im_chat_access_event_bot_p2p_chat_entered_v1(
    data: P2ImChatAccessEventBotP2pChatEnteredV1,
) -> None:
    print(f"[ onP2ChatAccessEventBotP2pChatEnteredV1 access ], data: {data}")
    open_id = data.event.operator_id.open_id
    if not has_received_welcome(open_id):
        send_welcome_message(open_id)
        mark_received_welcome(open_id)

# Handle message received (text, image, file)
def do_p2_im_message_receive_v1(data: P2ImMessageReceiveV1) -> None:
    print(f"[ onP2MessageReceiveV1 access ], data: {data}")
    chat_type = data.event.message.chat_type
    chat_id = data.event.message.chat_id
    open_id = data.event.sender.sender_id.open_id
    msg_type = data.event.message.message_type
    if msg_type == "text":
        content_raw = json.loads(data.event.message.content).get("text", "").strip()
        
        # Clean leading mention placeholders like @_user_1
        content_raw = re.sub(r'^(?:@_user_\d+\s*)+', '', content_raw).strip()
        
        # Regex check for topic mode: ^(话题|Topic)[:：]\s*(.*)$ (supporting multiline content via re.DOTALL)
        match = re.match(r'^(话题|Topic)[:：]\s*(.*)$', content_raw, re.IGNORECASE | re.DOTALL)
        if match:
            topic = match.group(2).strip()
            send_message("open_id", open_id, "text", json.dumps({"text": f"⏳ 正在为话题「{topic}」策划短视频剧本文案，请稍候..."}))
            
            try:
                # Call LLM script generation helper
                script_data = generate_script_from_topic(topic)
                
                # Create Task folder
                task_manager = TaskManager()
                task_id = task_manager.task_id
                
                # Save initial script
                script_file_path = task_manager.get_dir("ai") / "script.json"
                with open(script_file_path, "w", encoding="utf-8") as sf:
                    json.dump(script_data, sf, ensure_ascii=False, indent=2)
                
                # Cache session state
                existing_session = get_session(open_id)
                latest_media_path = existing_session.get("latest_media_path", "") if existing_session else ""
                latest_media_name = existing_session.get("latest_media_name", "") if existing_session else ""
                
                session_data = {
                    "task_id": task_id,
                    "json_data": script_data,
                    "latest_media_path": latest_media_path,
                    "latest_media_name": latest_media_name,
                    "card_message_id": "",
                    "created_at": datetime.now()
                }
                set_session(open_id, session_data)
                
                # Push Confirmation Card A
                media_status = f"已绑定最新媒体: {latest_media_name}" if latest_media_name else "暂无绑定媒体"
                response = send_topic_confirm_card(open_id, script_data, media_status)
                resp_json = json.loads(response.raw.content)
                message_id = resp_json.get("data", {}).get("message_id")
                if message_id:
                    session_data["card_message_id"] = message_id
                    set_session(open_id, session_data)
            except Exception as e:
                import traceback
                traceback.print_exc()
                send_message("open_id", open_id, "text", json.dumps({"text": f"❌ 剧本生成失败:\n{str(e)}"}))
                
        else:
            # Try parsing direct JSON mode
            try:
                script_data = json.loads(content_raw)
                if "title" in script_data and ("captions" in script_data or "bodyText" in script_data):
                    task_manager = TaskManager()
                    task_id = task_manager.task_id
                    
                    # Save initial script
                    script_file_path = task_manager.get_dir("ai") / "script.json"
                    with open(script_file_path, "w", encoding="utf-8") as sf:
                        json.dump(script_data, sf, ensure_ascii=False, indent=2)
                        
                    existing_session = get_session(open_id)
                    latest_media_path = existing_session.get("latest_media_path", "") if existing_session else ""
                    latest_media_name = existing_session.get("latest_media_name", "") if existing_session else ""
                    
                    session_data = {
                        "task_id": task_id,
                        "json_data": script_data,
                        "latest_media_path": latest_media_path,
                        "latest_media_name": latest_media_name,
                        "card_message_id": "",
                        "created_at": datetime.now()
                    }
                    set_session(open_id, session_data)
                    
                    media_status = f"已绑定最新媒体: {latest_media_name}" if latest_media_name else "暂无绑定媒体"
                    response = send_topic_confirm_card(open_id, script_data, media_status)
                    resp_json = json.loads(response.raw.content)
                    message_id = resp_json.get("data", {}).get("message_id")
                    if message_id:
                        session_data["card_message_id"] = message_id
                        set_session(open_id, session_data)
                else:
                    send_message("open_id", open_id, "text", json.dumps({"text": "💡 请发送 `话题: xxx` 来生成文案，或者发送标准 JSON 剧本文本。"}))
            except json.JSONDecodeError:
                send_message("open_id", open_id, "text", json.dumps({"text": "💡 请发送 `话题: xxx` 来生成文案，或者发送标准 JSON 剧本文本。"}))

    elif msg_type in ("image", "file", "media"):
        session = get_session(open_id)
        
        # Resolve target assets directory
        if not session or not session.get("task_id"):
            from config.settings import TASKS_DIR
            temp_dir = Path(TASKS_DIR) / "temp_feishu_uploads" / open_id
            temp_dir.mkdir(parents=True, exist_ok=True)
            assets_dir = temp_dir
        else:
            task_manager = TaskManager(task_id=session["task_id"])
            assets_dir = task_manager.task_dir / "assets"
            assets_dir.mkdir(parents=True, exist_ok=True)
            
        content_data = json.loads(data.event.message.content)
        
        try:
            if msg_type == "image":
                image_key = content_data.get("image_key")
                filename = f"feishu_upload_{image_key[:10]}.jpg"
                save_path = assets_dir / filename
                
                send_message("open_id", open_id, "text", json.dumps({"text": "⏳ 正在下载图片素材..."}))
                download_image_from_lark(data.event.message.message_id, image_key, str(save_path))
            else:
                file_key = content_data.get("file_key")
                original_filename = content_data.get("file_name", f"feishu_upload_{file_key[:10]}.mp4")
                filename = os.path.basename(original_filename)
                save_path = assets_dir / filename
                
                send_message("open_id", open_id, "text", json.dumps({"text": f"⏳ 正在下载媒体文件「{filename}」..."}))
                download_file_from_lark(data.event.message.message_id, file_key, str(save_path))
                
            # Update or create session
            if not session:
                session = {
                    "task_id": "",
                    "json_data": {},
                    "latest_media_path": str(save_path),
                    "latest_media_name": filename,
                    "card_message_id": "",
                    "created_at": datetime.now()
                }
            else:
                session["latest_media_path"] = str(save_path)
                session["latest_media_name"] = filename
            set_session(open_id, session)
            
            # Send status update
            if session.get("task_id"):
                send_message("open_id", open_id, "text", json.dumps({"text": f"✅ 素材已绑定成功: {filename}"}))
                # Patch Card A
                if session.get("card_message_id"):
                    update_message_card(session["card_message_id"], session["json_data"], f"已绑定最新媒体: {filename}")
            else:
                send_message("open_id", open_id, "text", json.dumps({"text": f"✅ 素材已保存！\n💡 请发送「话题: xxx」或剧本 JSON 来创建视频生成任务。"}))
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            send_message("open_id", open_id, "text", json.dumps({"text": f"❌ 素材保存/绑定失败:\n{str(e)}"}))

# Handle card interactive action triggers
def do_p2_card_action_trigger(data: P2CardActionTrigger) -> P2CardActionTriggerResponse:
    print(f"[ P2CardActionTrigger access ], data: {data}")
    open_id = data.event.operator.open_id
    action = data.event.action

    if action.value["action"] == "regenerate_topic":
        topic = action.value.get("topic")
        try:
            new_script = generate_script_from_topic(topic)
            session = get_session(open_id)
            if session:
                session["json_data"] = new_script
                set_session(open_id, session)
            
            template_variables = {
                "topic": new_script.get("topic", ""),
                "title": new_script.get("title", ""),
                "titleHighlight": new_script.get("titleHighlight", ""),
                "bodyText": new_script.get("bodyText", ""),
                "captions": new_script.get("captions", ""),
                "author": new_script.get("author", ""),
                "fontMode": new_script.get("fontMode", ""),
                "outroTagline": new_script.get("outroTagline", ""),
                "snsTitle": new_script.get("snsTitle", ""),
                "media_status": (session.get("latest_media_name") if session else None) or "暂无绑定媒体",
                "raw_json": json.dumps(new_script, ensure_ascii=False)
            }
            content = {
                "toast": {
                    "type": "success",
                    "content": "已重新生成剧本文案！",
                    "i18n": {"zh_cn": "已重新生成剧本文案！", "en_us": "Script regenerated!"}
                },
                "card": {
                    "type": "template",
                    "data": {
                        "template_id": TOPIC_CONFIRM_CARD_ID,
                        "template_variable": template_variables
                    }
                }
            }
            return P2CardActionTriggerResponse(content)
        except Exception as e:
            return P2CardActionTriggerResponse({
                "toast": {"type": "error", "content": f"重新生成失败: {str(e)}"}
            })

    elif action.value["action"] == "confirm_topic":
        session = get_session(open_id)
        if not session:
            raw_json_str = action.value.get("json_data")
            script_data = json.loads(raw_json_str) if raw_json_str else {}
            task_id = TaskManager().task_id
        else:
            task_id = session["task_id"]
            script_data = session["json_data"]
            
        # Send text message to chat window
        send_message("open_id", open_id, "text", json.dumps({"text": "⏳ 已收到确认！正在后台进行语音合成与视频渲染，完成后会直接发送视频给您，请稍候..."}))
        
        t = threading.Thread(
            target=run_video_pipeline_async, 
            args=(open_id, task_id, script_data, session)
        )
        t.start()
        
        # Clean session
        delete_session(open_id)
        
        return P2CardActionTriggerResponse({
            "toast": {
                "type": "info",
                "content": "已确认，后台开始生成...",
                "i18n": {"zh_cn": "已确认，后台开始生成...", "en_us": "Rendering started..."}
            }
        })

    elif action.value["action"] == "distribute_video":
        platform = action.value.get("platform")
        video_path = action.value.get("video_path")
        title = action.value.get("title")
        
        t = threading.Thread(
            target=distribute_video_async, 
            args=(open_id, "feishu_distribute_task", platform, video_path, title)
        )
        t.start()
        
        return P2CardActionTriggerResponse({
            "toast": {
                "type": "info",
                "content": f"正在分发至 [{platform.upper()}]，发布完成后会有消息提示，请耐心等待...",
                "i18n": {"zh_cn": f"正在分发至 [{platform.upper()}]...", "en_us": f"Distributing to {platform}..."}
            }
        })

    return P2CardActionTriggerResponse({})

# Build callback dispatcher event handler
event_handler = (
    lark.EventDispatcherHandler.builder(LARK_ENCRYPT_KEY, LARK_VERIFICATION_TOKEN)
    .register_p2_im_chat_access_event_bot_p2p_chat_entered_v1(
        do_p2_im_chat_access_event_bot_p2p_chat_entered_v1
    )
    .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1)
    .register_p2_card_action_trigger(do_p2_card_action_trigger)
    .build()
)
