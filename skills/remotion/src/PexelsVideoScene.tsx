import React from 'react';
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
    useVideoConfig,
    staticFile,
    Audio,
} from 'remotion';
import { Video } from '@remotion/media';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

type Caption = {
    text: string;
    startMs: number;
    endMs: number;
};

export const PexelsVideoSceneSchema = z.object({
    title: z.string().optional(),
    captions: z.array(
        z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
        }),
    ),
    audioPath: z.string(),
    videoPath: z.string().optional(),
    subtitleLayout: z.literal('scroll').optional().default('scroll'),
    bgmPath: z.string().optional().nullable(),
    audioVolume: z.number().optional().default(1.0),
    bgmVolume: z.number().optional().default(0.15),
});

const ScrollingCaptions: React.FC<{
    captions: Caption[];
    scrollY: number;
    lineHeight: number;
}> = ({ captions, scrollY, lineHeight }) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: lineHeight,
                transform: 'translateY(-50%)',
                overflow: 'visible',
                zIndex: 10,
            }}
        >
            <div
                style={{
                    transform: `translateY(-${scrollY}px)`,
                }}
            >
                {captions.map((caption, index) => {
                    const distance = Math.abs((scrollY / lineHeight) - index);

                    const opacity = interpolate(distance, [0, 1, 2, 3], [1.0, 0.6, 0.25, 0.0], { extrapolateRight: 'clamp' });
                    const scale = interpolate(distance, [0, 1], [1.1, 0.9], { extrapolateRight: 'clamp' });
                    const color = distance < 0.5
                        ? `rgba(255, 204, 0, ${interpolate(distance, [0, 0.5], [1.0, 0.8])})`
                        : `rgba(255, 255, 255, ${interpolate(distance, [0.5, 1.0], [0.8, 0.6], { extrapolateRight: 'clamp' })})`;

                    return (
                        <div
                            key={index}
                            style={{
                                height: lineHeight,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color,
                                fontSize: '52px',
                                fontWeight: 'bold',
                                transform: `scale(${scale})`,
                                opacity,
                                textAlign: 'center',
                                textShadow: '0 4px 12px rgba(0,0,0,0.85)',
                                padding: '0 40px',
                            }}
                        >
                            {caption.text}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const PexelsVideoScene: React.FC<z.infer<typeof PexelsVideoSceneSchema>> = ({
    title,
    captions = [],
    audioPath,
    videoPath,
    bgmPath,
    audioVolume = 1.0,
    bgmVolume = 0.15,
}) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const currentMs = (frame / fps) * 1000;

    // Left-to-right wipe reveal interpolation (from frame 10 to 50, revealing 0% to 100%)
    const titleReveal = interpolate(
        frame,
        [10, 50],
        [0, 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Left-to-right sweep shine gradient shift
    const titleShimmer = interpolate(
        frame,
        [30, 80],
        [-100, 200],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Get current active caption index
    let activeIndex = -1;
    for (let i = 0; i < captions.length; i++) {
        const c = captions[i];
        if (currentMs >= c.startMs && currentMs <= c.endMs) {
            activeIndex = i;
            break;
        }
    }

    // Fallback if currentMs lies in the gap between subtitles
    if (activeIndex === -1 && captions.length > 0) {
        let nextIndex = -1;
        for (let i = 0; i < captions.length; i++) {
            if (captions[i].startMs > currentMs) {
                nextIndex = i;
                break;
            }
        }
        if (nextIndex !== -1) {
            activeIndex = Math.max(0, nextIndex - 1);
        } else {
            activeIndex = captions.length - 1;
        }
    }

    const activeCaption = activeIndex >= 0 ? captions[activeIndex] : null;

    // Scroll vertical height parameter per line
    const LINE_HEIGHT = 140;

    // Smooth scroll interpolation based on transition window
    let scrollY = activeIndex * LINE_HEIGHT;
    if (activeIndex !== -1 && activeIndex < captions.length - 1) {
        const nextCaption = captions[activeIndex + 1];
        const transitionWindowMs = 250; // Smooth transition over 250ms
        const transitionStartMs = nextCaption.startMs - transitionWindowMs;

        if (currentMs >= transitionStartMs && currentMs < nextCaption.startMs) {
            scrollY = interpolate(
                currentMs,
                [transitionStartMs, nextCaption.startMs],
                [activeIndex * LINE_HEIGHT, (activeIndex + 1) * LINE_HEIGHT],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
        }
    }

    // Zoom effect on background to make it dynamic
    const bgScale = interpolate(
        frame,
        [0, durationInFrames],
        [1.0, 1.05],
        { extrapolateRight: 'clamp' }
    );

    // Resolve URLs
    const resolvedAudio = audioPath.startsWith('http') || audioPath.startsWith('/')
        ? audioPath
        : staticFile(audioPath);

    const resolvedVideo = videoPath && (videoPath.startsWith('http') || videoPath.startsWith('/'))
        ? videoPath
        : (videoPath ? staticFile(videoPath) : null);

    return (
        <AbsoluteFill style={{ backgroundColor: '#050505', fontFamily }}>
            {/* Audio: Narrator Voiceover */}
            <Audio src={resolvedAudio} volume={audioVolume} />

            {/* Audio: Background Music */}
            {bgmPath && (
                <Audio 
                    src={bgmPath.startsWith('http') || bgmPath.startsWith('/') ? bgmPath : staticFile(`bgm/${bgmPath}`)} 
                    volume={bgmVolume} 
                />
            )}

            {/* Background Media */}
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {resolvedVideo ? (
                    <Video
                        src={resolvedVideo}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${bgScale})`,
                        }}
                        loop
                        muted
                    />
                ) : (
                    /* Fallback to premium purple-dark gradient if no search background is provided */
                    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #1f1235 0%, #0d0c1b 100%)' }} />
                )}
            </AbsoluteFill>

            {/* Readability gradient overlays */}
            <AbsoluteFill 
                style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.7) 100%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Top Area: Title (Optional) */}
            {title && title.trim() && (
                <div
                    style={{
                        position: 'absolute',
                        top: 150,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10,
                    }}
                >
                    <div
                        style={{
                            color: '#ffffff',
                            fontSize: '64px',
                            fontWeight: '900',
                            textAlign: 'center',
                            maxWidth: '90%',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            textShadow: '0 4px 16px rgba(0, 0, 0, 0.65)',
                            clipPath: `polygon(0 0, ${titleReveal}% 0, ${titleReveal}% 100%, 0 100%)`,
                            background: `linear-gradient(120deg, #ffffff 35%, #ffcc00 50%, #ffffff 65%)`,
                            backgroundSize: '200% 100%',
                            backgroundPosition: `${titleShimmer}% 0`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        {title}
                    </div>
                </div>
            )}

            <ScrollingCaptions captions={captions} scrollY={scrollY} lineHeight={LINE_HEIGHT} />

            {/* Premium border framing */}
            <AbsoluteFill style={{ border: '24px solid rgba(255,255,255,0.03)', pointerEvents: 'none', zIndex: 100 }} />
        </AbsoluteFill>
    );
};
