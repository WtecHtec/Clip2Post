import os
import json
import lark_oapi as lark
from lark_oapi.api.im.v1 import (
    CreateMessageRequest,
    CreateMessageRequestBody,
    PatchMessageRequest,
    PatchMessageRequestBody,
    GetImageRequest,
    GetFileRequest,
    CreateFileRequest,
    CreateFileRequestBody,
    GetMessageResourceRequest
)
from bots.feishu.config import (
    LARK_APP_ID,
    LARK_APP_SECRET,
    TOPIC_CONFIRM_CARD_ID,
    DISTRIBUTE_CARD_ID
)

# Initialize Lark Client
client = lark.Client.builder().app_id(LARK_APP_ID).app_secret(LARK_APP_SECRET).build()

# Send Message
def send_message(receive_id_type: str, receive_id: str, msg_type: str, content: str):
    request = (
        CreateMessageRequest.builder()
        .receive_id_type(receive_id_type)
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(receive_id)
            .msg_type(msg_type)
            .content(content)
            .build()
        )
        .build()
    )
    response = client.im.v1.message.create(request)
    if not response.success():
        raise Exception(
            f"client.im.v1.message.create failed, code: {response.code}, msg: {response.msg}, log_id: {response.get_log_id()}"
        )
    return response

# Send Welcome text message
def send_welcome_message(open_id: str):
    welcome_text = (
        "您好！我是 Clip2Post 视频生成与分发助理。🤖\n\n"
        "- 发送 `话题: xxx` 可由 AI 帮您生成视频文案与大纲\n"
        "- 发送符合格式的剧本 JSON，可直接创建渲染任务\n"
        "- 您可以随时向我发送图片或视频作为背景素材！"
    )
    content = json.dumps({"text": welcome_text})
    return send_message("open_id", open_id, "text", content)

# Send Confirmation Card A
def send_topic_confirm_card(open_id: str, script_data: dict, media_status="暂无绑定媒体"):
    template_variables = {
        "topic": script_data.get("topic", ""),
        "title": script_data.get("title", ""),
        "titleHighlight": script_data.get("titleHighlight", ""),
        "bodyText": script_data.get("bodyText", ""),
        "captions": script_data.get("captions", ""),
        "author": script_data.get("author", ""),
        "fontMode": script_data.get("fontMode", ""),
        "outroTagline": script_data.get("outroTagline", ""),
        "snsTitle": script_data.get("snsTitle", ""),
        "media_status": media_status,
        "raw_json": json.dumps(script_data, ensure_ascii=False)
    }
    content = json.dumps(
        {
            "type": "template",
            "data": {
                "template_id": TOPIC_CONFIRM_CARD_ID,
                "template_variable": template_variables,
            },
        }
    )
    return send_message("open_id", open_id, "interactive", content)

# Partial Update Confirmation Card A
def update_message_card(message_id: str, script_data: dict, media_status: str):
    template_variables = {
        "topic": script_data.get("topic", ""),
        "title": script_data.get("title", ""),
        "titleHighlight": script_data.get("titleHighlight", ""),
        "bodyText": script_data.get("bodyText", ""),
        "captions": script_data.get("captions", ""),
        "author": script_data.get("author", ""),
        "fontMode": script_data.get("fontMode", ""),
        "outroTagline": script_data.get("outroTagline", ""),
        "snsTitle": script_data.get("snsTitle", ""),
        "media_status": media_status,
        "raw_json": json.dumps(script_data, ensure_ascii=False)
    }
    content = json.dumps(
        {
            "type": "template",
            "data": {
                "template_id": TOPIC_CONFIRM_CARD_ID,
                "template_variable": template_variables,
            },
        }
    )
    request = (
        PatchMessageRequest.builder()
        .message_id(message_id)
        .request_body(
            PatchMessageRequestBody.builder()
            .content(content)
            .build()
        )
        .build()
    )
    response = client.im.v1.message.patch(request)
    if not response.success():
        print(f"Failed to patch message {message_id}: {response.code} {response.msg}")
    return response

# Download image from Lark
def download_image_from_lark(message_id: str, image_key: str, save_path: str):
    request = (
        GetMessageResourceRequest.builder()
        .message_id(message_id)
        .file_key(image_key)
        .type("image")
        .build()
    )
    response = client.im.v1.message_resource.get(request)
    if not response.success():
        raise Exception(f"Failed to download image {image_key}: {response.code} {response.msg}")
    with open(save_path, "wb") as f:
        f.write(response.file.read())

# Download normal file or video from Lark
def download_file_from_lark(message_id: str, file_key: str, save_path: str):
    request = (
        GetMessageResourceRequest.builder()
        .message_id(message_id)
        .file_key(file_key)
        .type("file")
        .build()
    )
    response = client.im.v1.message_resource.get(request)
    if not response.success():
        raise Exception(f"Failed to download file {file_key}: {response.code} {response.msg}")
    with open(save_path, "wb") as f:
        f.write(response.file.read())

# Upload generated video file to Lark
def upload_file_to_lark(file_path: str, file_type="mp4") -> str:
    with open(file_path, "rb") as f:
        request = (
            CreateFileRequest.builder()
            .request_body(
                CreateFileRequestBody.builder()
                .file_type(file_type)
                .file_name(os.path.basename(file_path))
                .file(f)
                .build()
            )
            .build()
        )
        response = client.im.v1.file.create(request)
        if not response.success():
            raise Exception(f"Failed to upload file to lark: {response.code} {response.msg}")
        resp_data = json.loads(response.raw.content)
        return resp_data.get("data", {}).get("file_key")

# Send video or generic file message
def send_file_message(receive_id_type: str, receive_id: str, file_key: str):
    content = json.dumps({"file_key": file_key})
    return send_message(receive_id_type, receive_id, "file", content)

# Send distribution Card B
def send_distribute_card(open_id: str, video_path: str, video_title: str):
    template_variables = {
        "video_title": video_title,
        "video_path": video_path
    }
    content = json.dumps(
        {
            "type": "template",
            "data": {
                "template_id": DISTRIBUTE_CARD_ID,
                "template_variable": template_variables,
            },
        }
    )
    return send_message("open_id", open_id, "interactive", content)
