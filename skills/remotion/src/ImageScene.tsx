import React, { useMemo } from 'react';
import {
    AbsoluteFill,
    Img,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    staticFile,
    Audio,
} from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

export const ImageSceneSchema = z.object({
    captions: z.array(
        z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
        }),
    ),
    imageUrl: z.string(),
    audioUrl: z.string().optional(),
    fontSize: z.number().optional().default(80),
});

export const ImageScene: React.FC<z.infer<typeof ImageSceneSchema>> = ({
    captions,
    imageUrl,
    audioUrl,
    fontSize = 80,
}) => {
    const frame = useCurrentFrame();
    const { fps, width: videoWidth, height: videoHeight } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    // Find current active caption
    const activeCaption = captions.find(
        (c) => currentMs >= c.startMs && currentMs <= c.endMs
    );

    // Zoom effect on image
    const imageScale = interpolate(
        frame,
        [0, fps * 10], // over 10 seconds
        [1, 1.05],
        { extrapolateRight: 'clamp' }
    );

    // Subtitle entrance animation
    const activeStartFrame = activeCaption ? (activeCaption.startMs / 1000) * fps : 0;
    const entrance = spring({
        frame: frame - activeStartFrame,
        fps,
        config: { damping: 200 },
    });

    return (
        <AbsoluteFill style={{ backgroundColor: '#050505', flexDirection: 'column' }}>
            {audioUrl && <Audio src={staticFile(audioUrl)} />}

            {/* Full-screen Image container */}
            <AbsoluteFill style={{ backgroundColor: '#111', overflow: 'hidden' }}>
                <Img
                    src={imageUrl.startsWith('http') ? imageUrl : staticFile(imageUrl)}
                    style={{
                        width: '110%',
                        height: '110%',
                        objectFit: 'cover',
                        filter: 'blur(30px) brightness(0.3)',
                        transform: 'translate(-5%, -5%)',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                />

                <Img
                    src={imageUrl.startsWith('http') ? imageUrl : staticFile(imageUrl)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        transform: `scale(${imageScale})`,
                        zIndex: 2,
                    }}
                />
            </AbsoluteFill>

            {/* Subtitle Overlay */}
            <AbsoluteFill
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: '20%', // Lift text up a bit from the absolute bottom
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 40%)',
                    zIndex: 3,
                }}
            >
                {activeCaption && (
                    <div
                        style={{
                            fontSize,
                            fontWeight: '900',
                            fontFamily,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            textAlign: 'center',
                            color: '#FFFFFF',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(10px)',
                            padding: '20px 40px',
                            borderRadius: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                            transform: `scale(${interpolate(entrance, [0, 1], [0.95, 1])}) translateY(${interpolate(entrance, [0, 1], [10, 0])}px)`,
                            opacity: entrance,
                            maxWidth: '90%',
                            lineHeight: 1.3,
                        }}
                    >
                        {activeCaption.text}
                    </div>
                )}
            </AbsoluteFill>

            {/* Overlay border */}
            <AbsoluteFill style={{ border: '24px solid rgba(255,255,255,0.03)', pointerEvents: 'none', zIndex: 10 }} />
        </AbsoluteFill>
    );
};
