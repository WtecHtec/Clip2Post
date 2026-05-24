import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { COLORS } from '../styles';

interface TitleBlockProps {
  topic: string;
  title: string;
  titleHighlight?: string;
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  topic,
  title,
  titleHighlight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Topic slide up and fade in starting at frame 6 (0.2s)
  const topicY = interpolate(frame, [6, 18], [20, 0], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const topicOpacity = interpolate(frame, [6, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title slide up and fade in starting at frame 10 (0.35s)
  const titleY = interpolate(frame, [10, 24], [40, 0], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleOpacity = interpolate(frame, [10, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Helper to split and highlight keywords in the title
  const renderTitle = () => {
    if (!titleHighlight || !title.includes(titleHighlight)) {
      return <span>{title}</span>;
    }

    const parts = title.split(titleHighlight);
    return (
      <>
        {parts[0]}
        <span
          style={{
            color: COLORS.purpleLight,
            background: 'linear-gradient(135deg, #8C82FF 0%, #6355FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(99, 85, 255, 0.3)',
          }}
        >
          {titleHighlight}
        </span>
        {parts[1]}
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Topic Tag */}
      <div
        style={{
          transform: `translateY(${topicY}px)`,
          opacity: topicOpacity,
          display: 'flex',
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.purpleLight,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            borderLeft: `6px solid ${COLORS.purple}`,
            paddingLeft: 12,
            lineHeight: 1,
          }}
        >
          {topic}
        </span>
      </div>

      {/* Main Title */}
      <h1
        style={{
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          fontSize: 64,
          fontWeight: 800,
          color: COLORS.white,
          lineHeight: 1.3,
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        {renderTitle()}
      </h1>
    </div>
  );
};
