# Text-to-Speech (TTS) 独立接口 - OmniVoice

该接口提供了一个独立的文字转音频（TTS）功能，专门针对 OmniVoice 模型，允许用户指定相关参数以及音频保存路径。

## 接口详情

- **URL**: `/api/tts`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`

## 请求参数

所有参数通过表单数据（`Form Data`）进行传递：

| 参数名称 | 类型 | 必填 | 默认值 | 描述 |
| :--- | :--- | :---: | :--- | :--- |
| `text` | string | 是 | 无 | 需要转换为语音的文本内容。 |
| `save_path` | string | 是 | 无 | 音频保存的具体路径（绝对或相对路径），例如：`/absolute/path/to/output.wav` 或 `output/audio.wav`。 |
| `tts_engine` | string | 是 | `omnivoice` | 必须固定传入 `omnivoice` 以使用该引擎。 |
| `voice` | string | 否 | 无 | 传递给 OmniVoice 的指令文本（如情绪、语气描述等），用于控制声音风格。 |

> **`voice` 参数可选枚举值参考：**
> - `女` (女声默认)
> - `男` (男声默认)
> - `女，低音调` (女声 - 低音)
> - `男，低音调` (男声 - 低音)
> - `女，高音调` (女声 - 高音)
> - `男，高音调` (男声 - 高音)
> - `女，东北话` (女声 - 东北话)
> - `男，东北话` (男声 - 东北话)
> - `女，四川话` (女声 - 四川话)
> - `男，四川话` (男声 - 四川话)
> - `女，耳语` (女声 - 耳语)
> - `男，耳语` (男声 - 耳语)
> - `儿童` (儿童声)
> - `女，老年` (女声 - 老年)
> - `男，老年` (男声 - 老年)
> 
> *注：除此之外也可输入其他自定义指令文本，OmniVoice 会根据自然语言进行风格生成。*

## 返回参数

返回一个 JSON 对象，包含生成状态及实际保存路径：

```json
{
  "status": "success",
  "save_path": "/absolute/path/to/output.wav"
}
```

### 异常返回

如果生成过程中出现错误，将返回 `500` 状态码以及错误信息：

```json
{
  "error": "TTS generation failed: <具体错误详情>"
}
```

## 请求示例

使用 `curl` 命令调用接口：

```bash
curl -X POST "http://127.0.0.1:8000/api/tts" \
  -F "text=你好，欢迎使用文字转音频接口！" \
  -F "tts_engine=omnivoice" \
  -F "voice=请用极其兴奋的语气来读" \
  -F "save_path=test_omnivoice.wav"
```
