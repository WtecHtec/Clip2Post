# Clip2Post 后端 API 接口设计文档

本指南汇总并详细描述了 Clip2Post 项目的所有后端 API 接口，供前端、脚本或其他集成系统开发时调用。

---

## 1. 接口概述
- **基础 URL**: `http://127.0.0.1:8000` (或实际部署地址)
- **请求格式**: 部分请求为 `JSON` 格式，涉及媒体上传、配音与渲染的接口多为 `multipart/form-data`（表单）格式。
- **返回格式**: 统一返回 `application/json`。

---

## 2. 接口详细说明

### 目录
- [一、 任务与文件上传 (Upload & Tasks)](#一-任务与文件上传-upload--tasks)
- [二、 视频生成与合成 (Video Generation & Rendering)](#二-视频生成与合成-video-generation--rendering)
- [三、 音频转录与独立渲染 (ASR & Audio-to-Video)](#三-音频转录与独立渲染-asr--audio-to-video)
- [四、 独立 TTS 接口 (Independent TTS)](#四-独立-tts-接口-independent-tts)
- [五、 素材获取与脚本生成 (Assets & LLM)](#五-素材获取与脚本生成-assets--llm)
- [六、 一键视频分发 (Distribution/Publishing)](#六-一键视频分发-distributionpublishing)

---

### 一、 任务与文件上传 (Upload & Tasks)

#### 1. 上传视频并初始化流程
- **URL**: `/api/upload`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **请求参数**:
  - `file`: `UploadFile` (可选，上传的本地视频文件)
  - `video_url`: `str` (可选，远程视频下载链接)
  - `asr_engine`: `str` (默认: `funasr`，可选 `funasr`, `qwen` 等)
  - `extract_clips`: `bool` (默认: `false`，是否智能提取视频片段)
  - `add_overlay`: `bool` (默认: `false`，是否添加文字遮罩)
  - `generate_article`: `bool` (默认: `true`，是否通过 LLM 生成文章)
  - `generate_images`: `bool` (默认: `true`，是否生成图文)
  - `generate_html`: `bool` (默认: `true`，是否生成 HTML 渲染页面)
  - `custom_prompt`: `str` (可选，给 LLM 的自定义提示词)
  - `llm_api_key` / `llm_base_url` / `llm_model`: `str` (可选，自定义 LLM 模型配置)
- **返回示例**:
  ```json
  {
    "task_id": "20260618_173000",
    "message": "Task started."
  }
  ```

#### 2. 上传克隆人声音频
- **URL**: `/api/upload_voice`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **请求参数**:
  - `file`: `UploadFile` (必填，限 `.wav` 格式音频文件)
- **返回示例**:
  ```json
  {
    "success": true,
    "filename": "uploaded_1718700000_myvoice.wav",
    "absolute_path": "/absolute/path/to/tts/voxcpmwav/uploaded_1718700000_myvoice.wav"
  }
  ```

#### 3. 获取历史任务列表
- **URL**: `/api/tasks`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "tasks": [
      {
        "task_id": "20260618_173000",
        "progress": 1.0,
        "desc": "合成成功！",
        "state": "completed",
        "task_type": "standard"
      }
    ]
  }
  ```

#### 4. 查询任务运行状态
- **URL**: `/api/status/{task_id}`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "progress": 0.6,
    "desc": "正在合成视频...",
    "state": "processing",
    "task_type": "standard"
  }
  ```

#### 5. 获取已完成任务的结果
- **URL**: `/api/results/{task_id}`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "subtitles": "字幕文本...",
    "markdown": "文章正文...",
    "images": [
      "/tasks/20260618_173000/images/01.jpg"
    ],
    "html_url": "/tasks/20260618_173000/article/article.html",
    "video_clips": [
      {
        "url": "/tasks/20260618_173000/videos/01_Clip.mp4",
        "title": "Clip 1",
        "summary": "片段摘要",
        "content": "片段文本内容",
        "local_path": "/absolute/path/to/01_Clip.mp4"
      }
    ],
    "audio_url": "/tasks/20260618_173000/audio/audio.wav",
    "source_video": "/tasks/20260618_173000/video/source.mp4",
    "tts_config": null,
    "task_type": "standard",
    "sns_title": "社交平台分享标题"
  }
  ```

---

### 二、 视频生成与合成 (Video Generation & Rendering)

#### 1. 文本配音渲染 (TTS Render)
- **URL**: `/api/tts_render`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **请求参数**:
  - `text`: `str` (必填，台词/文案内容)
  - `tts_engine`: `str` (默认: `edge`，可选 `omnivoice`, `kokoro`, `chattts` 等)
  - `voice`: `str` (音色预设或情绪特征)
  - `speed` / `temperature` / `top_p` / `top_k` / `refine_text`: 各种调音与生成参数
  - `cover_title`: `str` (片头封面标题)
  - `cover_image`: `UploadFile` (可选，片头背景图片)
  - `bgm`: `str` (背景音乐文件名)

#### 2. Agent 模式智能视频生成
- **URL**: `/api/agent_video`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 传入多张图片、图片描述及一键提示词，由大模型智能串联文案配音并匹配图片位置，自动合成 Remotion 视频。
- **请求参数**:
  - `images`: `List[UploadFile]` (上传的多张图片)
  - `image_descriptions`: `str` (必填，图片的 JSON 描述数组，如 `[{"id":"0","desc":"猫咪"}]`)
  - `prompt`: `str` (可选，引导 LLM 写文案的 Prompt)
  - `text`: `str` (可选，若直接提供配音文本，则不通过 Prompt 生成)
  - `tts_engine` / `voice` / `bgm` 等

#### 3. 图文模式视频生成 (Image to Video)
- **URL**: `/api/image_video`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 将单张图片结合配音文本合成带动态字幕的短视频。
- **请求参数**:
  - `image`: `UploadFile` (必填，展示图片)
  - `text`: `str` (必填，配音文本)
  - `tts_engine` / `voice` / `bgm` 等

#### 4. 资讯播报视频合成 (News Video)
- **URL**: `/api/news_video`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 包含片头引子（Opening Hook）、资讯正文、片尾总结（Ending Hook）等结构的播报视频渲染。
- **请求参数**:
  - `image`: `UploadFile` (背景图片)
  - `opening_hook` / `main_text` / `ending_hook`: 各模块的文本
  - `cover_title` / `ending_title` / `tts_engine` / `voice` / `bgm` 等

#### 5. 智能动态模板视频生成 (Dynamic Video)
- **URL**: `/api/dynamic_video`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 输入素材包（多图片/视频）和 Prompt，通过大模型全自动生成 Remotion 渲染代码，定制各种动效与排版。
- **请求参数**:
  - `prompt`: `str` (生成视觉意图，如“制作一个酷炫的转场vlog”)
  - `files`: `List[UploadFile]` (可选，素材文件)
  - `image_descriptions`: `str` (素材文件描述的 JSON 数组)
  - `mode`: `str` (默认: `prompt`，支持 `prompt`, `json`, `voiceover` 三种解析模式)
  - `aspect_ratio`: `str` (默认: `9:16`，可选 `16:9`)
  - `also_generate_landscape`: `bool` (是否同时渲染横屏版)
  - `tts_engine` / `voice` / `bgm` 等

#### 6. 重新合成动态模板视频 (Regenerate Dynamic Video)
- **URL**: `/api/tasks/{task_id}/regenerate_dynamic`
- **Method**: `POST`
- **说明**: 保持当前任务上下文，基于之前的提示词重新编写 Remotion 组件渲染代码或只根据修改的 remotion_props 重渲染。
- **返回示例**:
  ```json
  {
    "message": "Regeneration task started.",
    "task_id": "20260618_173000"
  }
  ```

---

### 三、 音频转录与独立渲染 (ASR & Audio-to-Video)

#### 1. 单独上传音频并识别字幕
- **URL**: `/api/audio_transcribe`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 上传一段音频（wav/mp3等），接口会自动生成 ASR 逐字时间戳，返回前端可以直接修改的 `shuo_props`。
- **请求参数**:
  - `audio`: `UploadFile` (音频文件)
  - `asr_engine`: `str` (默认: `funasr`，可选 `funasr`, `qwen`)
- **返回示例**:
  ```json
  {
    "task_id": "20260618_174500",
    "shuo_props": {
      "captions": [
        { "text": "你好", "startMs": 0, "endMs": 600 }
      ],
      "audioUrl": "tasks/20260618_174500/audio/audio.wav",
      "images": [],
      "fontSize": 90,
      "centeredStart": true,
      "randomOrientation": true,
      "verticalFirstWord": true
    }
  }
  ```

#### 2. 自定义参数渲染视频
- **URL**: `/api/audio_render`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 基于 `/api/audio_transcribe` 得到的并且由用户调整后的 `shuo_props` 开始后台视频渲染合成。
- **请求参数**:
  - `task_id`: `str` (对应的任务ID)
  - `shuo_props`: `str` (修改后的 shuo_props JSON 字符串)
- **返回示例**:
  ```json
  {
    "task_id": "20260618_174500",
    "message": "Render started."
  }
  ```

---

### 四、 独立 TTS 接口 (Independent TTS)

#### 1. 文字转语音 (含对齐字幕返回)
- **URL**: `/api/tts`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **说明**: 将输入文本转换成音频并写入指定路径，同时返回包含单词/句子时间戳的 `captions` 数组。
- **请求参数**:
  - `text`: `str` (必填，文本内容)
  - `save_path`: `str` (必填，生成的音频写入路径，例如：`test_omnivoice.wav`)
  - `caption_save_path`: `str` (可选，生成的 captions 字幕 JSON 写入路径，如果提供则会将 captions 数据写入该文件)
  - `tts_engine`: `str` (默认: `edge`，可选 `omnivoice`, `kokoro`, `chattts`, `voxcpm`, `mlx` 等)
  - `voice`: `str` (风格或克隆音色路径)
  - `temperature` / `top_p` / `top_k` / `speed` / `refine_text`: 调音与生成参数
- **返回示例**:
  ```json
  {
    "status": "success",
    "save_path": "test_omnivoice.wav",
    "caption_save_path": "test_omnivoice.json",
    "captions": [
      {
        "text": "你好",
        "startMs": 0,
        "endMs": 800
      }
    ]
  }
  ```
  *(如果对应的 JSON 时间戳文件不存在，`captions` 键值将为 `[]`)*

---

### 五、 素材获取与脚本生成 (Assets & LLM)

#### 1. 获取 BGM 音乐列表
- **URL**: `/api/bgms`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "bgms": ["music1.mp3", "music2.wav"]
  }
  ```

#### 2. 获取背景图/背景视频列表
- **URL**: `/api/bg_images`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "bg_images": ["bg1.png", "bg_video1.mp4"]
  }
  ```

#### 3. 基于上下文及 Prompt 生成 AI 脚本
- **URL**: `/api/ai_script`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **请求参数**:
  - `task_id`: `str` (若不传入上下文，可传入 `"agent_init"`)
  - `prompt`: `str` (必填，提示词如“让内容更有冲突感”)
  - `llm_api_key` / `llm_base_url` / `llm_model`: `str` (可选，模型配置)
- **返回示例**:
  ```json
  {
    "script": "这是新生成的配音台词稿..."
  }
  ```

---

### 六、 一键视频分发 (Distribution/Publishing)

#### 1. 获取分发平台配置
- **URL**: `/api/distribute/config`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "platforms": [
      {
        "platform": "dy",
        "userDataDir": "profiles/dy",
        "json": "config/dy.json",
        "params": [
          { "key": "video", "desc": "视频文件", "value": "" },
          { "key": "title", "desc": "视频文案", "value": "" }
        ]
      }
    ]
  }
  ```

#### 2. 发布视频到多平台
- **URL**: `/api/distribute/publish`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **请求参数**:
  - `task_id`: `str` (必填，所要分发视频的任务ID)
  - `platforms`: `List[str]` (必填，选择分发的平台标识列表，如 `["dy", "xhs"]`)
  - `shared_text`: `str` (必填，发布时的配图文案或标题)
  - `video_name`: `str` (可选，若一个任务内有多个视频，可指定文件名)
- **返回示例**:
  ```json
  {
    "success": true,
    "triggered_platforms": ["dy"]
  }
  ```

#### 3. 获取发布状态进度
- **URL**: `/api/distribute/status/{task_id}`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "status": {
      "dy": {
        "state": "running",
        "error": null,
        "updated_at": "2026-06-18T17:35:00"
      }
    }
  }
  ```

#### 4. 获取发布实时日志
- **URL**: `/api/distribute/log/{task_id}/{platform}`
- **Method**: `GET`
- **返回示例**:
  ```json
  {
    "log": "正在启动浏览器环境...\n正在上传视频...\n分发任务完成\n"
  }
  ```
