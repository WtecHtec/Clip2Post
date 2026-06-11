export interface TemplateProps {
  author: string;          // 账号名，如 "@your_handle"
  topic: string;           // 栏目标签，如 "AI工具速递"
  title: string;           // 标题文字
  titleHighlight?: string; // 标题中高亮的关键词（紫色）
  bodyText: string;        // 底部说明文字
  images?: string[];       // 图片URL，传1张（展开显示）
  videos?: string[];       // 视频URL，传1个（展开显示）
  progressPercent?: number; // 进度条百分比 0-100，默认25
  outroTagline?: string;   // 结尾标语，默认 "AI · 工具 · 变现"
  captions?: string;       // 口播文案，TTS
  audioPath?: string;      // 生成的语音路径
  bgmPath?: string;        // 背景音乐路径
  fontMode?: string;       // 字体模式，支持 'default' | 'pixel' | 'techy' | 'cute'
  bgImage?: string;        // 背景图像文件名或URL
  bgImageOpacity?: number; // 背景图像不透明度，默认 0.15
}
