# Clip2Post - 视频转文章工具

Clip2Post 是一个强大的命令行工具，旨在将视频内容自动转化为排版精美的 HTML 文章。它整合了先进的 ASR（语音识别）、LLM（大语言模型）和自动化截图技术。

## 主要功能

- **多模式 ASR 支持**：
  - `funasr`：阿里巴巴开源的高精度语音识别。
  - `faster-whisper`：基于 CTranslate2 的高效 Whisper 实现。
  - `whisperx`：提供极其精确的单词级时间戳对齐。
- **智能文案生成**：利用 LLM（如 GPT-4）根据转录内容自动生成结构化文章。
- **自动视频截图**：根据 AI 识别的关键时间点，自动从视频中提取相关画面，并插入到文章中。
- **模块化运行**：支持仅转录、仅解析或全流程自动化。

## 环境准备

### 依赖安装

1. 确保已安装 FFmpeg。
2. 安装 Python 依赖：

```bash
pip install -r requirements.txt
```

### 配置环境

在根目录创建 `.env` 文件，并填写必要的信息：

```env
OPENAI_API_KEY=你的API密钥
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4-turbo
ASR_TYPE=faster-whisper
```

## 使用说明

### 全流程运行
输入视频，直接生成最终的 HTML 文章：
```bash
python cli.py --video ./test/test01.mp4 --asr faster-whisper
```

### 仅转录模式
仅提取音频并生成字幕和原始文本，不执行 AI 文章生成：
```bash
python cli.py --video ./test/test01.mp4 --transcribe-only
```

### 仅截图与构建模式
跳过转录和 AI 阶段，根据已有的 `image.json` 文件重新提取截图并生成 HTML（通常用于手动微调后）：
```bash
python cli.py --video ./test/test01.mp4 --screenshots-only ./tasks/TASK_ID/ai/image.json
```

## 输出结构

所有处理结果将保存在 `tasks/` 目录下，每个任务拥有独立的文件夹：
- `audio/`：提取的音频文件。
- `subtitle/`：带时间戳的字幕文件。
- `raw_text/`：纯文本转录。
- `ai/`：AI 生成的文章 (`article.md`) 和截图规划 (`image.json`)。
- `images/`：从视频中提取的关键帧。
- `article/`：最终生成的 HTML 文章。

## 技术栈

- 语言: Python 3.12
- ASR: FunASR, Faster-Whisper, WhisperX
- 视频处理: FFmpeg (ffmpeg-python)
- AI: OpenAI API
- 模板: HTML5 + CSS