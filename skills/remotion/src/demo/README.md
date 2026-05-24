# AI赛道短视频 Remotion 模板

抖音9:16竖屏，深黑科技风，两个场景：**标题卡 → 结尾卡**

---

## 目录结构

```
src/
├── types.ts          # 数据类型定义
├── styles.ts         # 颜色/尺寸常量
├── AITemplate.tsx    # 主合成（Series串联两个场景）
├── Root.tsx          # Remotion入口，注册Composition
└── components/
    ├── TopBar.tsx        # 顶部：头像 + 作者名 + badge
    ├── TitleBlock.tsx    # Topic行 + 标题（支持关键词高亮）
    ├── MediaReveal.tsx   # 媒体展开动画（图片/视频）
    ├── TitleScene.tsx    # 场景一：标题卡
    └── OutroScene.tsx    # 场景四：结尾卡
```

---

## 动画时序

### 场景一：标题卡

| 时间 | 事件 |
|------|------|
| 0s | 作者栏淡入滑下 |
| 0.2s | Topic行出现 |
| 0.35s | 标题文字滑入 |
| 0.7s | 底部文案淡入 |
| 0.9s | **媒体区域向下展开**（有图/视频时） |
| 1.5s | 媒体内容完全显示 |

### 场景四：结尾卡

| 时间 | 事件 |
|------|------|
| 0s | 整体淡入 + 圆环旋转 |
| 0.1s | Logo弹入（back easing） |
| 0.3s | 作者名 + 标语滑入 |

---

## 数据结构（TemplateProps）

```typescript
{
  author: string          // 账号名，如 "@your_handle"
  topic: string           // 栏目标签，如 "AI工具速递"
  title: string           // 标题文字
  titleHighlight?: string // 标题中高亮的关键词（紫色）
  bodyText: string        // 资讯的核心重点，一句完整的描述，不是关键词标签，而是对内容的精炼概括 20-40字以内，直接说清楚这件事是什么
  images?: string[]       // 图片URL，传1张（展开显示）
  videos?: string[]       // 视频URL，传1个（展开显示）
  progressPercent?: number // 进度条百分比 0-100，默认25
  outroTagline?: string   // 结尾标语，默认 "AI · 工具 · 变现"
  captions?: string // 口播文案，TTS 
}
```

**媒体优先级**：videos > images，同时有时显示视频。

---

## 快速开始

```bash
# 安装依赖
npm install

# 打开预览工作台
npm start

# 渲染纯文字版
npm run render:text

# 渲染带图片版
npm run render:image

# 渲染带视频版
npm run render:video
```

---

## 使用示例

```tsx
import { TemplateProps } from './src/types';

// 纯文字（无媒体）
const props: TemplateProps = {
  author: '@your_handle',
  topic: 'AI工具速递',
  title: '用AI比雇人还贵？',
  titleHighlight: '还贵',
  bodyText: '微软报告揭示企业落地AI的真实成本',
  progressPercent: 30,
};

// 带图片（标题显示后展开图片）
const propsWithImage: TemplateProps = {
  author: '@your_handle',
  topic: 'AI工具速递',
  title: '语音AI终于听懂你情绪了',
  titleHighlight: '听懂',
  bodyText: '副语言识别 · 百万人格组合 · 中英双语',
  images: ['./assets/stepaudio.jpg'],
  progressPercent: 45,
};

// 带视频（标题显示后展开视频）
const propsWithVideo: TemplateProps = {
  author: '@your_handle',
  topic: '开源项目',
  title: '飞书直接指挥Claude写代码',
  titleHighlight: '指挥',
  bodyText: '飞书消息 → Prompt → Claude CLI → 实时回写',
  videos: ['./assets/demo.mp4'],
  progressPercent: 60,
};
```

---

## 自定义

**换颜色**：修改 `src/styles.ts` 中的 `COLORS` 常量

**调整动画速度**：`MediaReveal.tsx` 中的 `revealDuration = fps * 0.7`，数字越大展开越慢

**调整媒体展开时机**：`TitleScene.tsx` 中的 `mediaStartFrame = fps * 0.9`

**画布尺寸**：`src/styles.ts` 中的 `CANVAS`，默认 1080×1920（9:16）
