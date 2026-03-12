# Kinetic Typography 动态口播视频引擎 (Remotion版)

这是一个基于 Remotion 开发的高张力动画视频生成引擎，专门用于制作视觉冲击力强的口播视频（口播、短视频文案、歌词秀等）。

## 🚀 核心特性

- **动感排版 (Kinetic Layout)**:
  - **首词锁定**: 默认第一个单词垂直排列，建立视觉锚点。
  - **横竖随机 (Random Orientation)**: 支持全场单词随机旋转，打造“云词”或“故障风”既视感。
  - **自动避让**: 严谨的几何碰撞测算，确保无论长短文案或图片，绝对不会互相重叠覆盖。
  - **自动换行与平滑滚动**: 支持无限长文案，根据文字大小自动换行并平滑滚动视口。

- **多媒体融合 (Rich Media)**:
  - **图文混排 (In-Flow Images)**: 支持在文字流中插入图片，文字会自动绕开图片排版，非常适合插入表情包、Logo 或配图。
  - **浮层图片**: 支持固定坐标的悬浮图片。

- **电影级转场**:
  - **快移扫屏 (Whip-pan)**: 弹簧动力的快速移动效果。
  - **动态运动模糊 (Motion Blur)**: 滚动瞬间自动触发垂直方向模糊，增强速度感。
  - **边缘渐变遮罩**: 柔化视口上下边缘，让文字进出更自然。

- **高度自适应**:
  - **居中起步 (Centered Start)**: 支持从画面中心开始排版。
  - **全色保持**: 文字色彩始终保持鲜艳，避免因置灰丧失活力。
  - **零跳动动画**: 完全基于帧的计算逻辑，消除一切抖动。

---

## 🛠 快速上手

### 1. 安装环境
```bash
npm install
```

### 2. 渲染视频 (使用 CLI)
```bash
npx remotion render src/index.ts MyScene output.mp4 --props=./shuo.json --duration=300
```
*其中 `--props` 指向你的数据配置文件。*

---

## 📄 数据配置详解 (`shuo.json`)

你可以通过 JSON 文件完全控制视频内容：

```json
{
  "captions": [
    { "text": "你好", "startMs": 0, "endMs": 1000 },
    { "text": "Remotion", "startMs": 1100, "endMs": 2000 }
  ],
  "images": [
    {
      "src": "logo.png",
      "width": 300,
      "height": 200,
      "startMs": 1000,
      "endMs": 5000,
      "inFlow": true
    }
  ],
  "fontSize": 90,
  "centeredStart": true,
  "randomOrientation": true,
  "verticalFirstWord": true
}
```

### 参数说明：
- `captions`: 必填。字幕数组，含文本及起始毫秒。
- `images`: 可选。图片数组。`inFlow: true` 表示参与文字排版避让（建议将图片放在 `public/` 目录下）。
- `fontSize`: 字体大小（默认 80）。
- `centeredStart`: 为 `true` 时，文字从屏幕中心开始显示。
- `randomOrientation`: 为 `true` 时，全场单词随机横竖排列。
- `verticalFirstWord`: 仅在 `randomOrientation` 为 `false` 时生效，控制首词是否垂直。

---

## 🤖 LLM 提示词工具
如果你想使用 AI 为你生成排版数据，请参考项目下的 [LLM_PROMPT.md](./LLM_PROMPT.md)。
