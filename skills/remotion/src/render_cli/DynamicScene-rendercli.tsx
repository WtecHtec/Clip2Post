import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
} from 'remotion';

export default function DynamicScene(props: any) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const msToFrame = (ms: number) => Math.round(((ms ?? 0) / 1000) * fps);

  // Data Drift 粒子
  const particles = useMemo(() => {
    return new Array(90).fill(0).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.2,
    }));
  }, []);

  const zoom = interpolate(frame, [0, 800], [1, 1.06], {
    extrapolateRight: 'extend',
  });

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background:
          'linear-gradient(135deg,#030712,#0a0f2c,#030712)',
        transform: `scale(${zoom})`,
      }}
    >
      {/* 光晕 */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 30% 40%, rgba(0,200,255,0.2), transparent 40%), radial-gradient(circle at 70% 60%, rgba(180,0,255,0.2), transparent 40%)',
        }}
      />

      {/* 粒子 */}
      {particles.map((p) => {
        const move = (frame * p.speed) % 120;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${(p.y + move) % 100}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: '#0ff',
              opacity: 0.5,
            }}
          />
        );
      })}

      {/* 字幕驱动 */}
      {props.captions.map((c: any, i: number) => {
        const from = msToFrame(c.startMs);
        const dur = Math.max(1, msToFrame(c.endMs) - from);

        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <InnerScene caption={c} index={i} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function InnerScene({ caption, index }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.85, 1]);

  const phase =
    index < 1
      ? 0
      : index < 4
        ? 1
        : index < 7
          ? 2
          : index < 11
            ? 3
            : 4;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Scene 1：宠物 등장 */}
      {phase === 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: 200,
              left: 200,
              fontSize: 60,
              transform: `translateY(${Math.sin(frame / 6) * 20}px) scale(${scale})`,
              opacity,
            }}
          >
            ✨
          </div>

          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: '#0ff',
              opacity,
            }}
          >
            CODEX PET
          </div>
        </>
      )}

      {/* Scene 2：自定义 */}
      {phase === 1 && (
        <>
          {[0, 1, 2].map((i) => {
            const delay = i * 8;
            const local = spring({
              frame: frame - delay,
              fps,
              config: { damping: 12, stiffness: 120 },
            });

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 150 + i * 90,
                  width: 420,
                  height: 70,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,255,255,0.4)',
                  color: '#0ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: local,
                }}
              >
                动画选项 {i + 1}
              </div>
            );
          })}

          {/* 图片 */}
          {caption.image_url && (
            <div
              style={{
                position: 'absolute',
                bottom: 120,
                width: '60%',
                height: '40%',
                borderRadius: 20,
                overflow: 'hidden',
                opacity,
              }}
            >
              <Img
                src={caption.image_url}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Scene 3：数据迁移 */}
      {phase === 2 && (
        <>
          <svg width="600" height="200">
            <line
              x1="50"
              y1="100"
              x2="550"
              y2="100"
              stroke="#0ff"
              strokeWidth="2"
              strokeDasharray="10 6"
              style={{
                strokeDashoffset: frame * 4,
              }}
            />
          </svg>

          <div
            style={{
              position: 'absolute',
              right: 200,
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '2px solid #0ff',
              transform: `scale(${1 + Math.sin(frame / 6) * 0.1})`,
              opacity,
            }}
          />
        </>
      )}

      {/* Scene 4：社交 */}
      {phase === 3 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 200,
              fontSize: 80,
              transform: `translateX(${Math.sin(frame / 5) * 20}px)`,
              opacity,
            }}
          >
            🦸
          </div>

          <div
            style={{
              position: 'absolute',
              right: 200,
              fontSize: 80,
              transform: `translateX(${Math.cos(frame / 5) * 20}px)`,
              opacity,
            }}
          >
            👔
          </div>

          {['太有意思了', '笑死我了', '离谱但爱'].map((t, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 120 + i * 60,
                left: `${(frame * 2 + i * 200) % 1200}px`,
                color: '#fff',
                fontSize: 24,
                opacity,
              }}
            >
              {t}
            </div>
          ))}
        </>
      )}

      {/* Scene 5：收尾 */}
      {phase === 4 && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: 140,
              left: 140,
              fontSize: 50,
              opacity,
              transform: `translateY(${Math.sin(frame / 10) * 10}px)`,
            }}
          >
            🐾
          </div>

          <div
            style={{
              fontSize: 50,
              fontWeight: 600,
              color: '#fff',
              textAlign: 'center',
              maxWidth: 800,
              opacity,
            }}
          >
            AI Companion
          </div>
        </>
      )}

      {/* 字幕 */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 80,
          right: 80,
          color: '#fff',
          fontSize: 34,
          textAlign: 'center',
          lineHeight: 1.5,
          background: 'rgba(0,0,0,0.45)',
          padding: '14px 24px',
          borderRadius: 16,
          backdropFilter: 'blur(8px)',
          opacity,
        }}
      >
        {caption.text}
      </div>
    </AbsoluteFill>
  );
}