# Clip2Post 视频渲染 CLI 使用手册 (render_cli.py)

`render_cli.py` 是一个强大的命令行工具，允许你在不使用 Web 界面的情况下，对视频任务进行手动微调、重新合成语音以及执行视频渲染。它特别适用于调试 TSX 模板逻辑和手动优化文案脚本。

---

## 1. 环境准备

确保你在项目根目录下，并且已经安装了所有必要的依赖：

```bash
# 进入项目根目录
cd Clip2Post

# 确保 Remotion 依赖已安装
cd skills/remotion
npm install
```

---

## 2. 核心功能

*   **手动渲染**：根据已生成的 `remotion_props.json` 直接渲染视频。
*   **脚本微调 (--scenes)**：传入新的 JSON 脚本，自动重新生成 TTS 语音并同步字幕时间轴。
*   **独立 TTS 模式 (--only_tts)**：仅更新语音和数据，不执行视频渲染（速度极快）。
*   **自动去标点**：渲染时自动剔除字幕中的中英文标点，使视频画面更整洁。
*   **保护手动修改**：检测到 `index_*.tsx` 已被手动修改时，不会自动覆盖它。

---

## 3. 参数说明

| 参数 | 说明 | 必填 |
| :--- | :--- | :--- |
| `--task_id` | 任务 ID (例如 `20260504_144656_db2b`) | 是 |
| `--tsx_path` | 动态 TSX 模板文件的绝对或相对路径 | 是 |
| `--scenes` | 场景脚本。可以是 JSON 字符串，或 `.json` 文件路径。输入 `auto` 则自动在任务目录下查找 `new_scenes.json` | 否 |
| `--only_tts` | 开启后仅执行语音合成和数据更新，跳过渲染步骤 | 否 |
| `--keep_punctuation` | 保留字幕中的标点符号（默认会自动剔除） | 否 |
| `--audio_path` | 指定一个外部的音频文件作为旁白 | 否 |
| `--props_path` | 指定一个非默认的 `remotion_props.json` 文件路径 | 否 |

---

## 4. 常用示例

### A. 基础渲染
如果你已经手动修改了 TSX 代码，只想重新看一遍效果：
```bash
python render_cli.py --task_id 20260504_162619_f7e5 --tsx_path skills/remotion/src/dynamic/DynamicScene-c4921fc6.tsx
```

### B. 修改文案并重合音频 (自动查找 new_scenes.json)
1. 在任务文件夹 `tasks/20260504_162619_f7e5/` 下创建一个 `new_scenes.json`。
2. 运行：
```bash
python render_cli.py --task_id 20260504_162619_f7e5 --tsx_path skills/remotion/src/dynamic/DynamicScene-c4921fc6.tsx --scenes auto
```

### C. 仅生成语音和字幕数据 (不渲染视频)
当你修改了脚本，想先确认语音合成效果和字幕时间轴是否正确：
```bash
python render_cli.py --task_id 20260504_162619_f7e5 --tsx_path ... --scenes auto --only_tts
```

### D. 直接传入脚本 JSON 字符串
```bash
python render_cli.py --task_id 20260504_162619_f7e5 --tsx_path ... --scenes '[{"text":"Hello World","visual":"coding scene"}]'
```

---

## 5. 高级技巧

### 5.1 手动调整入口配置
如果你需要手动修改分辨率、时长或添加全局 Wrapper，可以直接编辑 `skills/remotion/src/dynamic/index_DynamicScene-*.tsx`。
`render_cli.py` 会检测到该文件已存在并提示：
> `Notice: Entry file ... already exists. Skipping generation to preserve manual edits.`

### 5.2 查看 LLM 生成上下文
在每个任务的 `user_prompt/` 文件夹下，你可以找到：
*   `meta.json`: 记录了任务的所有原始参数（TTS 引擎、声音、BGM 等）。
*   `director_context.txt`: 发送给 LLM 的脚本规划指令。
*   `developer_context.txt`: 发送给 LLM 的 TSX 代码生成指令。

利用这些信息，你可以更好地理解 LLM 为什么会生成当前的代码。

---

## 6. 常见问题 (FAQ)

**Q: 渲染报错 `Command failed with exit code 1`?**
A: 请检查终端输出的 Remotion 日志。通常是因为 TSX 代码中存在语法错误或引用了不存在的变量。你可以手动编辑对应的 `.tsx` 文件修复后再次运行。

**Q: 生成的视频没有声音？**
A: 检查 `remotion_props.json` 中的 `audioUrl` 是否正确，并确保本地后端服务器 (`main.py`) 正在运行，因为 Remotion 渲染进程需要通过 HTTP 访问本地资源。
