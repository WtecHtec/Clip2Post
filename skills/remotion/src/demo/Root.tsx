import React from 'react';
import { Composition } from 'remotion';
import { AITemplate } from './AITemplate';
import { CANVAS } from './styles';
import { TemplateProps } from './types';

// 示例数据：纯文字
const exampleTextOnly: TemplateProps = {
  author: '@your_handle',
  topic: 'AI工具速递',
  title: '用AI比雇人还贵？',
  titleHighlight: '还贵',
  bodyText: '微软报告揭示企业落地AI的真实成本',
  progressPercent: 30,
  outroTagline: 'AI · 工具 · 变现',
};

// 示例数据：带图片
const exampleWithImage: TemplateProps = {
  author: '@your_handle',
  topic: 'AI工具速递',
  title: '语音AI终于听懂你情绪了',
  titleHighlight: '听懂',
  bodyText: '副语言识别 · 百万人格组合 · 中英双语',
  images: ['https://picsum.photos/seed/ai1/800/600'],
  progressPercent: 45,
  outroTagline: 'AI · 工具 · 变现',
};

// 示例数据：带视频
const exampleWithVideo: TemplateProps = {
  author: '@your_handle',
  topic: '开源项目',
  title: '飞书直接指挥Claude写代码',
  titleHighlight: '指挥',
  bodyText: '飞书消息 → Prompt → Claude CLI → 实时回写',
  videos: ['https://www.w3schools.com/html/mov_bbb.mp4'],
  progressPercent: 60,
  outroTagline: 'AI · 工具 · 变现',
};

export const RemotionRoot: React.FC = () => {
  const fps = 30;

  return (
    <>
      {/* 纯文字版 */}
      <Composition
        id="AITemplate_TextOnly"
        component={AITemplate}
        durationInFrames={fps * 5.5}
        fps={fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={exampleTextOnly}
      />

      {/* 带图片版 */}
      <Composition
        id="AITemplate_WithImage"
        component={AITemplate}
        durationInFrames={fps * 7.5}
        fps={fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={exampleWithImage}
      />

      {/* 带视频版 */}
      <Composition
        id="AITemplate_WithVideo"
        component={AITemplate}
        durationInFrames={fps * 7.5}
        fps={fps}
        width={CANVAS.width}
        height={CANVAS.height}
        defaultProps={exampleWithVideo}
      />
    </>
  );
};
