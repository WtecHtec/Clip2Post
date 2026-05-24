import React, { useMemo, useRef, useEffect } from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  OffthreadVideo,
  Loop,
} from 'remotion';
import { Video } from "@remotion/media";

// ============ 类型定义 ============
interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  image_url: string;
  asset_type: string;
  visual_suggestion?: string;
}

interface VideoSceneProps {
  frame: number;
  startFrame: number;
  endFrame: number;
  videoUrl: string;
  children?: React.ReactNode;
}

interface ImageSceneProps {
  frame: number;
  startFrame: number;
  endFrame: number;
  imageUrl: string;
  children?: React.ReactNode;
}

interface CaptionTextProps {
  text: string;
  frame: number;
}

interface FlowChartProps {
  frame: number;
  startFrame: number;
  endFrame: number;
}

interface ParticleFieldProps {
  frame: number;
}

// ============ 工具函数 ============
const msToFrame = (ms: number, fps: number): number => Math.round((ms ?? 0) / 1000 * fps);

// ============ 粒子效果背景 ============
const ParticleField: React.FC<ParticleFieldProps> = ({ frame }) => {
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map((p) => {
        const yOffset = (frame * p.speed) % 1200;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: (p.y + yOffset) % 1200 - 100,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #00ffaa 0%, transparent 70%)',
              opacity: p.opacity * (0.5 + Math.sin(frame * 0.02 + p.id) * 0.3),
              boxShadow: '0 0 10px #00ffaa',
            }}
          />
        );
      })}
    </div>
  );
};

// ============ 全局背景层 ============
const GlobalBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const glowIntensity = interpolate(frame, [0, 60, 300, 600], [0, 0.3, 0.5, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 20% 80%, rgba(0, 255, 170, ${glowIntensity * 0.4}) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(0, 200, 255, ${glowIntensity * 0.3}) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(0, 100, 200, 0.2) 0%, transparent 70%),
          linear-gradient(180deg, #0a0a12 0%, #0d1117 50%, #0a0f14 100%)
        `,
      }}
    >
      <ParticleField frame={frame} />
      {/* 网格线增强科技感 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0, 255, 170, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 170, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
};

// ============ 视频场景组件 ============
const VideoSceneComponent: React.FC<VideoSceneProps> = ({
  frame,
  startFrame,
  endFrame,
  videoUrl,
  children,
}) => {
  const isVisible = frame >= startFrame && frame < endFrame;
  const relativeFrame = frame - startFrame;
  const VIDEO_DURATION = 120;
  const scale = spring({
    frame: relativeFrame,
    fps: 30,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(relativeFrame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 720,
        height: 720,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(0, 255, 170, 0.3), 0 0 120px rgba(0, 200, 255, 0.2)',
        border: '1px solid rgba(0, 255, 170, 0.3)',
        display: isVisible ? 'block' : 'none'
      }}
    >

      <Video
        loop
        src={videoUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        volume={0}
      />
      {children}
    </div>
  );
};

// ============ 半透明浮窗视频场景 ============
const FloatingVideoScene: React.FC<VideoSceneProps> = ({
  frame,
  startFrame,
  endFrame,
  videoUrl,
  children,
}) => {
  const isVisible = frame >= startFrame && frame < endFrame;
  const relativeFrame = frame - startFrame;

  const floatY = spring({
    frame: relativeFrame,
    fps: 30,
    config: { damping: 12, stiffness: 80 },
  });

  const scale = interpolate(relativeFrame, [0, 30], [0.7, 0.85], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: '15%',
        top: `${20 + floatY * 5}%`,
        transform: `translateY(${floatY * 10}px)`,
        width: 640,
        height: 640,
        opacity: isVisible ? 0.75 : 0,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0, 255, 170, 0.4), 0 0 160px rgba(0, 200, 255, 0.3)',
        border: '2px solid rgba(0, 255, 170, 0.5)',
        backdropFilter: 'blur(10px)',
        transition: 'opacity 0.3s',
      }}
    >
      <Video
        loop
        src={videoUrl}

        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        volume={0}
      />
      {children}
    </div>
  );
};

// ============ 图片场景组件 ============
const ImageSceneComponent: React.FC<ImageSceneProps> = ({
  frame,
  startFrame,
  endFrame,
  imageUrl,
  children,
}) => {
  const isVisible = frame >= startFrame && frame < endFrame;
  const relativeFrame = frame - startFrame;

  const scale = interpolate(relativeFrame % 120, [0, 60, 120], [1, 1.03, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glowPulse = interpolate(relativeFrame % 90, [0, 45, 90], [0.3, 0.6, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 640,
        height: 640,
        opacity: isVisible ? 1 : 0,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: `0 0 ${40 + glowPulse * 40}px rgba(0, 255, 170, ${glowPulse}), 0 0 ${80 + glowPulse * 60}px rgba(0, 200, 255, ${glowPulse * 0.5})`,
        border: '2px solid rgba(0, 255, 170, 0.4)',
        transition: 'opacity 0.4s ease',
      }}
    >
      <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {children}
    </div>
  );
};

// ============ 数据流粒子装饰 ============
const DataStreamDecor: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => {
  const relativeFrame = frame - startFrame;

  const streams = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      baseX: 1500 + i * 50,
      speed: 1 + (i % 3) * 0.5,
      charLength: 8 + (i % 5),
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', right: 0, top: 0, width: 400, height: '100%', overflow: 'hidden' }}>
      {streams.map((s) => {
        const yOffset = (relativeFrame * s.speed * 3) % 1200;
        const chars = '01'.split('');

        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: s.baseX,
              top: yOffset - 600,
              fontFamily: 'monospace',
              fontSize: 14,
              color: `rgba(0, ${200 + (s.id * 20) % 55}, ${150 + (s.id * 15) % 105}, 0.8)`,
              textShadow: '0 0 10px currentColor',
              letterSpacing: 2,
            }}
          >
            {Array.from({ length: s.charLength }, (_, j) => (
              <div key={j} style={{ opacity: 1 - j * 0.1 }}>
                {chars[j % chars.length]}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ============ 流程图示 ============
const FlowChartComponent: React.FC<FlowChartProps> = ({ frame, startFrame, endFrame }) => {
  const relativeFrame = frame - startFrame;
  const duration = endFrame - startFrame;
  const progress = relativeFrame / duration;

  const chatGptEnter = spring({
    frame: Math.max(0, relativeFrame - 10),
    fps: 30,
    config: { damping: 12 },
  });

  const processEnter = spring({
    frame: Math.max(0, relativeFrame - 30),
    fps: 30,
    config: { damping: 12 },
  });

  const seedanceEnter = spring({
    frame: Math.max(0, relativeFrame - 50),
    fps: 30,
    config: { damping: 12 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 40,
      }}
    >
      {/* ChatGPT 节点 */}
      <div
        style={{
          transform: `scale(${chatGptEnter})`,
          opacity: Math.min(chatGptEnter, 1),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(16, 163, 127, 0.6)',
            border: '2px solid rgba(16, 163, 127, 0.5)',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1819a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .51 4.9107 6.051 6.051 0 0 0 5.5098 3.061 5.9765 5.9765 0 0 0 5.7692-4.2058 6.0551 6.0551 0 0 0 3.9977-2.9001 5.9846 5.9846 0 0 0 .5155-4.9108zM13.0007 12.4123a1.7179 1.7179 0 1 1 0-3.4358 1.7179 1.7179 0 0 1 0 3.4358zM8.9211 12.4123a1.7179 1.7179 0 1 1 0-3.4358 1.7179 1.7179 0 0 1 0 3.4358z" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: '#10a37f',
            textShadow: '0 0 20px rgba(16, 163, 127, 0.5)',
          }}
        >
          ChatGPT
        </span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>生成图片</span>
      </div>

      {/* 连接线 */}
      <svg width="100" height="40" style={{ overflow: 'visible' }}>
        <line
          x1="0"
          y1="20"
          x2={`${80 * progress}`}
          y2="20"
          stroke="url(#arrowGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10a37f" />
            <stop offset="100%" stopColor="#00ffaa" />
          </linearGradient>
        </defs>
      </svg>

      {/* 中间处理节点 */}
      <div
        style={{
          transform: `scale(${processEnter})`,
          opacity: Math.min(processEnter, 1),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(0, 200, 255, 0.4)',
            border: '2px solid rgba(0, 200, 255, 0.4)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>处理</span>
      </div>

      {/* 连接线 */}
      <svg width="100" height="40" style={{ overflow: 'visible' }}>
        <line
          x1="0"
          y1="20"
          x2={`${80 * Math.max(0, progress - 0.3) / 0.7}`}
          y2="20"
          stroke="url(#arrowGradient2)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="arrowGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00c8ff" />
            <stop offset="100%" stopColor="#00ffaa" />
          </linearGradient>
        </defs>
      </svg>

      {/* Seedance 节点 */}
      <div
        style={{
          transform: `scale(${seedanceEnter})`,
          opacity: Math.min(seedanceEnter, 1),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #00ffaa 0%, #00c8ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0, 255, 170, 0.6)',
            border: '2px solid rgba(0, 255, 170, 0.5)',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: '#00ffaa',
            textShadow: '0 0 20px rgba(0, 255, 170, 0.5)',
          }}
        >
          Seedance
        </span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>生成视频</span>
      </div>
    </div>
  );
};

// ============ 字幕文字组件 ============
const CaptionText: React.FC<CaptionTextProps> = ({ text, frame }) => {
  const scale = spring({
    frame: frame % 90,
    fps: 30,
    config: { damping: 15, stiffness: 120 },
  });

  const textShadow = interpolate(frame % 120, [0, 60, 120], [8, 16, 8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 42,
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        textShadow: `0 0 ${textShadow}px rgba(0, 255, 170, 0.8), 0 0 ${textShadow * 2}px rgba(0, 200, 255, 0.5)`,
        letterSpacing: 2,
        transform: `scale(${scale})`,
        maxWidth: 1400,
        lineHeight: 1.4,
        padding: '20px 40px',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: 16,
        border: '1px solid rgba(0, 255, 170, 0.3)',
      }}
    >
      {text}
    </div>
  );
};

// ============ 科技蓝渐变背景（流程图专用） ============
const TechBlueBackground: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 30% 50%, rgba(0, 100, 200, 0.4) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 50%, rgba(0, 150, 255, 0.3) 0%, transparent 60%),
          radial-gradient(ellipse at 50% 50%, rgba(0, 255, 170, 0.2) 0%, transparent 50%),
          linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)
        `,
      }}
    >
      <ParticleField frame={frame} />
    </div>
  );
};

// ============ 参数指标面板 ============
const MetricsPanel: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => {
  const relativeFrame = frame - startFrame;

  const metrics = [
    { label: 'FPS', value: '30', color: '#00ffaa' },
    { label: '分辨率', value: '720×720', color: '#00c8ff' },
    { label: '模型', value: 'Seedance', color: '#10a37f' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        right: 80,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        opacity: relativeFrame > 15 ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(15px)',
            borderRadius: 12,
            padding: '16px 24px',
            border: `1px solid ${m.color}40`,
            boxShadow: `0 0 20px ${m.color}30`,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color, textShadow: `0 0 10px ${m.color}` }}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============ 结尾标题 ============
const FinalTitle: React.FC<{ frame: number; startFrame: number }> = ({ frame, startFrame }) => {
  const relativeFrame = frame - startFrame;
  const fadeIn = interpolate(relativeFrame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '15%',
        transform: `translateX(-50%) translateY(${20 * (1 - fadeIn)}px)`,
        opacity: fadeIn,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 56,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: 8,
          textShadow: '0 0 30px rgba(0, 255, 170, 0.8), 0 0 60px rgba(0, 200, 255, 0.5)',
          textTransform: 'uppercase',
        }}
      >
        THE FUTURE IS NOW
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 18,
          color: 'rgba(0, 255, 170, 0.8)',
          letterSpacing: 4,
        }}
      >
        AI-POWERED CONTENT CREATION
      </div>
    </div>
  );
};

// ============ 主组件 ============
export default function DynamicScene(props: { captions: Caption[] }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  // 资产层常量
  const VIDEO_URL = 'http://localhost:8000/tasks/20260505_201611_aa5d/assets/l_c6gt1otp_939d3a6e_1777977174.mp4';
  const IMAGE_URL = 'http://localhost:8000/tasks/20260505_201611_aa5d/assets/39b4cc82-02c5-4168-b94b-61bcdbe6c045.png';

  // 场景帧范围计算
  const scene1Start = msToFrame(0, fps);
  const scene1End = msToFrame(4630, fps);
  const scene2Start = msToFrame(4930, fps);
  const scene2End = msToFrame(13870, fps);
  const scene3Start = msToFrame(14170, fps);
  const scene3End = msToFrame(20260, fps);
  const scene4Start = msToFrame(20560, fps);
  const scene4End = msToFrame(26360, fps);
  const scene5Start = msToFrame(26660, fps);
  const scene5End = msToFrame(31210, fps);

  // 场景2是否可见
  const isScene2Visible = frame >= scene2Start && frame < scene2End;
  // 场景5是否可见
  const isScene5Visible = frame >= scene5Start;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#0a0a12' }}>
      {/* ── 层1：全局背景（贯穿全程） ── */}
      <GlobalBackground frame={frame} />

      {/* ── 层2：资产内容层（常驻顶层） ── */}

      {/* Seedance 全屏视频 - Scene 1 & 3 */}
      {(frame >= scene1Start && frame < scene1End) || (frame >= scene3Start && frame < scene3End) ? (
        <VideoSceneComponent
          frame={frame}
          startFrame={frame >= scene1Start ? scene1Start : scene3Start}
          endFrame={frame >= scene1Start ? scene1End : scene3End}
          videoUrl={VIDEO_URL}
        />
      ) : null}

      {/* Seedance 半透明浮窗视频 - Scene 3 */}
      {frame >= scene3Start && frame < scene3End && (
        <FloatingVideoScene
          frame={frame}
          startFrame={scene3Start}
          endFrame={scene3End}
          videoUrl={VIDEO_URL}
        />
      )}

      {/* 参数面板 - Scene 3 */}
      {frame >= scene3Start && frame < scene3End && (
        <MetricsPanel frame={frame} startFrame={scene3Start} />
      )}

      {/* Seedance 全屏视频 - Scene 5 (结尾) */}
      {isScene5Visible && (
        <VideoSceneComponent
          frame={frame}
          startFrame={scene5Start}
          endFrame={scene5End}
          videoUrl={VIDEO_URL}
        />
      )}

      {/* 结尾标题 - Scene 5 */}
      {isScene5Visible && <FinalTitle frame={frame} startFrame={scene5Start} />}

      {/* ChatGPT 图片 - Scene 2 */}
      {isScene2Visible && (
        <>
          <ImageSceneComponent
            frame={frame}
            startFrame={scene2Start}
            endFrame={scene2End}
            imageUrl={IMAGE_URL}
          />
          <DataStreamDecor frame={frame} startFrame={scene2Start} />
        </>
      )}

      {/* 流程图示 - Scene 4 */}
      {frame >= scene4Start && frame < scene4End && <TechBlueBackground frame={frame} />}
      {frame >= scene4Start && frame < scene4End && (
        <FlowChartComponent frame={frame} startFrame={scene4Start} endFrame={scene4End} />
      )}

      {/* ── 层3：字幕层（独立 Sequence） ── */}
      {props.captions.map((caption: Caption, index: number) => {
        const from = msToFrame(caption.startMs, fps);
        const duration = msToFrame(caption.endMs - caption.startMs, fps);

        return (
          <Sequence key={index} from={from} durationInFrames={Math.max(1, duration)}>
            <div
              style={{
                position: 'absolute',
                bottom: '12%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                padding: '0 80px',
                boxSizing: 'border-box',
              }}
            >
              <CaptionText text={caption.text} frame={frame} />
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}