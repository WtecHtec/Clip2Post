import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { COLORS } from '../styles';

interface TopBarProps {
  author: string;
}

export const TopBar: React.FC<TopBarProps> = ({ author }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide down and fade in from frame 0 to 15
  const slideDown = interpolate(frame, [0, 15], [-50, 0], {
    easing: Easing.out(Easing.back(1.0)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const avatarInitial = author ? author.replace('@', '').substring(0, 1).toUpperCase() : 'AI';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        transform: `translateY(${slideDown}px)`,
        opacity: opacity,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Avatar */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleLight})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 'bold',
            color: '#fff',
            boxShadow: `0 4px 20px rgba(99, 85, 255, 0.4)`,
          }}
        >
          {avatarInitial}
        </div>

        {/* Author Name */}
        <span
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: COLORS.white,
            letterSpacing: '0.02em',
          }}
        >
          {author}
        </span>
      </div>

      {/* Badge */}
      <div
        style={{
          padding: '8px 20px',
          borderRadius: 30,
          background: 'rgba(99, 85, 255, 0.15)',
          border: `1px solid rgba(99, 85, 255, 0.3)`,
          color: COLORS.purpleLight,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        PRO
      </div>
    </div>
  );
};
