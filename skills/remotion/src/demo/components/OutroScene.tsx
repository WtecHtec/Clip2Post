import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from 'remotion';
import { COLORS, CANVAS, getFontFamily } from '../styles';
import { TemplateProps } from '../types';

export const OutroScene: React.FC<Pick<TemplateProps, 'author' | 'outroTagline' | 'fontMode' | 'bgImage'>> = ({
  author,
  outroTagline = 'AI · 工具 · 变现',
  fontMode,
  bgImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fontFamily = getFontFamily(fontMode);

  // 整体淡入
  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    easing: Easing.out(Easing.ease),
    extrapolateRight: 'clamp',
  });

  // Logo放大弹入
  const logoScale = interpolate(frame, [fps * 0.1, fps * 0.5], [0.5, 1], {
    easing: Easing.out(Easing.back(1.4)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 文字从下滑入
  const textY = interpolate(frame, [fps * 0.3, fps * 0.6], [40, 0], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 圆环缓慢旋转
  const ringRotate = interpolate(frame, [0, fps * 8], [0, 360], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: CANVAS.width,
        height: CANVAS.height,
        background: bgImage ? 'transparent' : COLORS.bg,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fontFamily,
        opacity: fadeIn,
      }}
    >
      {/* 装饰圆环 */}
      {[400, 600, 800, 1000].map((size, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            border: `1px solid rgba(99,85,255,${0.12 - i * 0.02})`,
            transform: `rotate(${ringRotate * (i % 2 === 0 ? 1 : -1)}deg)`,
          }}
        />
      ))}

      {/* 右上装饰点 */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          right: 180,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: COLORS.purple,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          left: 160,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: COLORS.purpleLight,
          opacity: 0.4,
        }}
      />

      {/* 主内容 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          paddingLeft: 60,
          paddingRight: 60,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: COLORS.purple,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 52,
            fontWeight: 700,
            color: COLORS.white,
            transform: `scale(${logoScale})`,
          }}
        >
          AI
        </div>

        {/* 作者名 + 分割线 + 标语 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: '0.02em',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {author}
          </div>

          <div
            style={{
              width: 80,
              height: 2,
              background: `rgba(99,85,255,0.6)`,
              borderRadius: 1,
            }}
          />

          <div
            style={{
              fontSize: 30,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.15em',
              textAlign: 'center',
              wordBreak: 'break-word',
            }}
          >
            {outroTagline}
          </div>
        </div>
      </div>
    </div>
  );
};
