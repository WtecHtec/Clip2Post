# Text-to-Speech (TTS) 独立接口文档

该接口提供了一个独立的文字转语音（TTS）服务，支持多种 TTS 引擎（如 OmniVoice, Kokoro, ChatTTS, EdgeTTS, VoxCPM, MLX 等），允许指定相关生成参数（如语气、语速、温度等），并将音频及对应的对齐字幕时间戳数据返回。

## 1. 接口基本信息

- **接口地址**: `/api/tts`
- **请求方法**: `POST`
- **数据格式 (Content-Type)**: `multipart/form-data` (表单数据)

---

## 2. 请求参数

通过 Form 表单（`Form Data`）传递以下参数：

| 参数名称 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :---: | :--- | :--- |
| `text` | string | **是** | 无 | 需要转换为语音的文本内容。 |
| `save_path` | string | **是** | 无 | 语音文件的保存路径（相对或绝对路径），例如：`test_omnivoice.wav`。 |
| `caption_save_path` | string | 否 | 无 | 对齐字幕数据的保存路径，若传入此参数则将 captions JSON 数据写入该路径。 |
| `tts_engine` | string | 否 | `edge` | 使用的 TTS 引擎名称。可选值包括：<br>• `omnivoice` (推荐使用)<br>• `kokoro`<br>• `chattts`<br>• `edge`<br>• `voxcpm`<br>• `mlx` |
| `voice` | string | 否 | 无 | 声音风格、角色、语气描述等（如 `男`, `女` 或具体情绪指令）。 |
| `temperature` | float | 否 | `0.3` | 生成随机度（针对支持该参数的引擎，如 ChatTTS）。 |
| `top_p` | float | 否 | `0.7` | 核采样概率（针对支持该参数的引擎，如 ChatTTS）。 |
| `top_k` | int | 否 | `20` | Top-k 采样大小（针对支持该参数的引擎，如 ChatTTS）。 |
| `speed` | float | 否 | `5.0` | 语速控制（针对支持该参数的引擎，如 ChatTTS, MLX）。 |
| `refine_text` | boolean | 否 | `true` | 是否自动优化文本（针对支持该参数的引擎，如 ChatTTS）。 |

---

### 💡 `voice` 常用预设参考（针对 OmniVoice 引擎）

OmniVoice 支持丰富的自然语言语气/风格描述，也可使用以下预设：
- `女` (默认女声) / `男` (默认男声)
- `女，低音调` / `男，低音调`
- `女，高音调` / `男，高音调`
- `女，东北话` / `男，东北话`
- `女，四川话` / `男，四川话`
- `女，耳语` / `男，耳语`
- `儿童` (童声)
- `女，老年` / `男，老年`

*此外，若传入 `.wav` 音频文件路径，接口将自动启用 **Zero-Shot 声音克隆** 模式。*

---

## 3. 返回数据

接口成功处理后，会返回一个 JSON 对象，包含生成状态、音频保存路径以及对应的字幕对齐数据：

### 请求成功 (200 OK)

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

> **关于 `captions` 的说明：**
> - 如果对应的字幕对齐 JSON 文件不存在或解析失败，`captions` 字段将直接返回空数组 `[]`。

### 请求失败 (500 Internal Server Error)

```json
{
  "error": "TTS generation failed: <错误堆栈详情>"
}
```

---

## 4. 接口调用示例

### 使用 `curl` 命令行调用

```bash
curl -X POST "http://127.0.0.1:8000/api/tts" \
  -F "text=你好，欢迎使用文字转音频接口！" \
  -F "tts_engine=omnivoice" \
  -F "voice=男" \
  -F "save_path=test_omnivoice.wav"
```

### 使用 Python (Requests) 调用

```python
import requests

url = "http://127.0.0.1:8000/api/tts"
data = {
    "text": "你好，欢迎使用文字转音频接口！",
    "tts_engine": "omnivoice",
    "voice": "男",
    "save_path": "test_omnivoice.wav"
}

response = requests.post(url, data=data)
if response.status_code == 200:
    result = response.json()
    print("生成成功！保存路径为:", result["save_path"])
    print("字幕对齐数据:", result["captions"])
else:
    print("生成失败:", response.json().get("error"))
```
