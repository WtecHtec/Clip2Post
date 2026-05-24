import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { COLORS, CANVAS } from '../styles';
import { TopBar } from './TopBar';
import { TitleBlock } from './TitleBlock';
import { MediaReveal } from './MediaReveal';
import { TemplateProps } from '../types';

export const TitleScene: React.FC<TemplateProps> = ({
  author,
  topic,
  title,
  titleHighlight,
  bodyText,
  images = [],
  videos = [],
  progressPercent = 25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hasMedia = images.length > 0 || videos.length > 0;

  // body文字：标题出现后淡入
  const bodyOpacity = interpolate(frame, [fps * 0.7, fps * 1.0], [0, 1], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 进度条填充动画
  const progressWidth = interpolate(
    frame,
    [fps * 0.3, fps * 1.2],
    [0, progressPercent],
    {
      easing: Easing.out(Easing.ease),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 媒体展开动画的起始帧：标题动画完成后
  // TitleBlock的标题在 fps*0.65 完成，给一点缓冲
  const mediaStartFrame = Math.round(fps * 0.9);

  return (
    <div
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        background: COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
        padding: '72px 64px',
        fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* 网格背景 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(99,85,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,85,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* 右上角装饰光晕 */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'rgba(99,85,255,0.06)',
          filter: 'blur(80px)',
        }}
      />

      {/* 顶部：作者栏 (绝对定位) */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 64,
          right: 64,
          zIndex: 10,
        }}
      >
        <TopBar author={author} />
      </div>

      {/* 内容层 (垂直居中 flex) */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          gap: 0,
        }}
      >
        {/* Topic + 标题 */}
        <TitleBlock
          topic={topic}
          title={title}
          titleHighlight={titleHighlight}
        />

        {/* 资讯核心重点 (卡片式描述块) */}
        <div
          style={{
            opacity: bodyOpacity,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: '8px solid #6355ff',
            borderRadius: '16px',
            padding: '28px 36px',
            marginTop: 32,
            fontSize: 34,
            lineHeight: 1.6,
            color: '#FFFFFF',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {bodyText}
        </div>

        {/* 媒体区域：展开动画（仅有媒体时渲染） */}
        {hasMedia && (
          <MediaReveal
            images={images}
            videos={videos}
            startFrame={mediaStartFrame}
          />
        )}
      </div>

      {/* 进度条 (绝对定位在底部) */}
      <div
        style={{
          position: 'absolute',
          bottom: 72,
          left: 64,
          right: 64,
          height: 4,
          background: COLORS.progressBg,
          borderRadius: 2,
          overflow: 'hidden',
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressWidth}%`,
            background: COLORS.purple,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};
