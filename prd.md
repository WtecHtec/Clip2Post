# 视频转文章系统 PRD（V1.1）

## 一、项目名称

Clip2Post

---

# 二、项目目标

将视频内容自动转换为 **完整图文文章**，实现：

1. 自动识别视频字幕
2. AI理解字幕并生成完整文章
3. AI输出需要截图的关键画面时间点
4. 根据时间点自动截图
5. 生成完整图文排版文章

所有生成数据 **按任务隔离存储**。

每一次处理视频都生成 **唯一任务 ID（task_id）**，并以该 ID 作为文件夹名称。

---

# 三、核心流程

上传视频
↓
生成 task_id
↓
创建任务目录
↓
音频提取
↓
字幕识别
↓
AI生成文章 + 图片JSON
↓
根据JSON截图
↓
生成图文排版
↓
导出文章

---

# 四、任务ID机制

## 4.1 task_id 生成规则

每个任务生成唯一 ID。

推荐格式：

时间戳 + 随机字符串

示例：

20260306_203015_a8f3

Python示例：

```python
import uuid
import datetime

def generate_task_id():
    now = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = str(uuid.uuid4())[:4]
    return f"{now}_{uid}"


⸻

五、任务目录结构

系统所有处理文件 必须存放在 task_id 文件夹中。

示例：

tasks/
└── 20260306_203015_a8f3/
    │
    ├── video/
    │   └── source.mp4
    │
    ├── audio/
    │   └── audio.wav
    │
    ├── subtitle/
    │   └── subtitle.txt
    │
    ├── ai/
    │   ├── article.md
    │   └── image.json
    │
    ├── images/
    │   ├── img_01.jpg
    │   ├── img_02.jpg
    │   ├── img_03.jpg
    │   └── img_04.jpg
    │
    └── article/
        ├── article.html
        ├── article.md
        └── article.txt


⸻

六、模块说明

⸻

6.1 视频上传模块

功能：
	•	上传视频
	•	自动生成 task_id
	•	创建任务目录
	•	保存原始视频

保存路径：

tasks/{task_id}/video/source.mp4

支持格式：
	•	mp4
	•	mov
	•	mkv
	•	avi

⸻

6.2 音频提取模块

使用 FFmpeg 从视频提取音频。

输入：

tasks/{task_id}/video/source.mp4

输出：

tasks/{task_id}/audio/audio.wav

命令：

ffmpeg -i source.mp4 -ar 16000 -ac 1 audio.wav


⸻

6.3 字幕识别模块（ASR）

输入：

tasks/{task_id}/audio/audio.wav

输出：

tasks/{task_id}/subtitle/subtitle.txt

示例：

00:00:01
大家好今天给大家讲一个娱乐圈故事

00:00:05
这件事情发生在十年前

00:00:12
当时很多人都没有想到事情会发展成这样

推荐模型：

模型	推荐
FunASR Paraformer	⭐⭐⭐⭐⭐


⸻

6.4 AI文章生成模块

输入：

subtitle/subtitle.txt

AI输出两个文件。

⸻

1 文章内容

保存路径：

tasks/{task_id}/ai/article.md

示例：

标题：
十年前的一段往事，直到今天才被重新提起

正文：
很多人不知道，这件事情其实发生在十年前。

当时的他还只是一个刚进入行业的新人，
没人会想到，一个看似普通的选择，
会让他的命运发生巨大的变化。


⸻

2 图片截图 JSON

保存路径：

tasks/{task_id}/ai/image.json

格式：

[
  {
    "time": "00:00:05",
    "desc": "人物第一次出现"
  },
  {
    "time": "00:00:18",
    "desc": "现场环境镜头"
  },
  {
    "time": "00:00:36",
    "desc": "人物情绪变化"
  },
  {
    "time": "00:01:05",
    "desc": "事件关键瞬间"
  }
]


⸻

6.5 视频截图模块

输入：

tasks/{task_id}/ai/image.json

截图保存：

tasks/{task_id}/images/

生成：

img_01.jpg
img_02.jpg
img_03.jpg

截图命令：

ffmpeg -ss 00:01:05 -i source.mp4 -vframes 1 img_01.jpg


⸻

6.6 图文排版模块

输入：

article.md
+
images/

输出：

tasks/{task_id}/article/article.html

HTML结构：

标题

图片

段落

图片

段落

示例：

<h1>标题</h1>

<img src="../images/img_01.jpg">

<p>文章段落</p>

<img src="../images/img_02.jpg">

<p>文章段落</p>


⸻

6.7 导出模块

支持导出：

文件	路径
HTML	article/article.html
Markdown	article/article.md
TXT	article/article.txt


⸻

七、WebUI流程

页面流程：

上传视频
 ↓
创建 task_id
 ↓
开始处理
 ↓
字幕识别
 ↓
AI生成文章
 ↓
AI生成截图JSON
 ↓
自动截图
 ↓
生成文章
 ↓
预览文章
 ↓
下载文章

页面展示：

1 当前任务ID
2 处理进度
3 字幕结果
4 AI生成文章
5 截图图片
6 最终文章

⸻

八、技术架构

Frontend
  Gradio

Backend
  FastAPI

ASR
  FunASR

LLM
  GPT / DeepSeek

Video
  FFmpeg

数据流：

video
 ↓
audio
 ↓
subtitle
 ↓
article + image_json
 ↓
screenshots
 ↓
html article


⸻

九、项目目录结构

video2article
│
├── tasks
│   └── {task_id}
│
├── asr
│
├── llm
│
├── video
│
├── screenshot
│
├── webui
│
├── utils
│
└── config


⸻

十、V1 MVP功能

必须实现：

1 上传视频
2 自动生成 task_id
3 字幕识别
4 AI生成文章
5 AI生成截图JSON
6 自动截图
7 生成HTML文章
8 按任务目录存储

⸻

十一、未来版本

V2：
	•	自动标题优化
	•	娱乐八卦写作模式
	•	自动封面生成
	•	公众号排版模板

V3：
	•	批量视频转文章
	•	热点视频自动处理
	•	自动发布公众号

