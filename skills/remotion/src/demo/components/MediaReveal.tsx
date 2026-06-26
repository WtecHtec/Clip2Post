import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  staticFile,
} from 'remotion';
import { Video } from '@remotion/media';
import { COLORS } from '../styles';

interface MediaRevealProps {
  images?: string[];
  videos?: string[];
  // 展开动画从第几帧开始（标题显示完之后）
  startFrame?: number;
  mediaVolume?: number;
}

export const MediaReveal: React.FC<MediaRevealProps> = ({
  images = [],
  videos = [],
  startFrame = 60,
  mediaVolume = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hasMedia = images.length > 0 || videos.length > 0;
  if (!hasMedia) return null;

  const revealDuration = fps * 0.7; // 展开动画时长

  // Height animates from 0 to 600px
  const targetHeight = 600;
  const currentHeight = interpolate(
    frame,
    [startFrame, startFrame + revealDuration],
    [0, targetHeight],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Spacing gap animates from 0 to 32px
  const currentGap = interpolate(
    frame,
    [startFrame, startFrame + revealDuration],
    [0, 32],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 内容在展开过程中淡入（稍微延迟，避免和容器动画抢镜）
  const contentOpacity = interpolate(
    frame,
    [startFrame + revealDuration * 0.3, startFrame + revealDuration],
    [0, 1],
    {
      easing: Easing.out(Easing.ease),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // 决定显示什么：优先视频，其次图片
  const showVideo = videos.length > 0;
  const showImage = !showVideo && images.length > 0;

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        height: currentHeight,
        marginTop: currentGap,
        marginBottom: currentGap,
        borderRadius: 24,
        background: COLORS.white04,
        border: currentHeight > 10 ? `1px solid ${COLORS.white07}` : 'none',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity: contentOpacity,
          borderRadius: 24,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showVideo && (
          <Video
            src={videos[0].startsWith('http') || videos[0].startsWith('/') ? videos[0] : staticFile(videos[0])}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain', // 完整显示，不压缩
            }}
            loop
            muted={mediaVolume === 0}
            volume={mediaVolume}
          />
        )}

        {showImage && (
          <Img
            src={images[0].startsWith('http') || images[0].startsWith('/') ? images[0] : staticFile(images[0])}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain', // 完整显示，不压缩
            }}
          />
        )}
      </div>
    </div>
  );
};
