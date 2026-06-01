import React from 'react';
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
import { Video } from '@remotion/media';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

export const VoiceoverSceneSchema = z.object({
    title: z.string(),
    captions: z.array(
        z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
        }),
    ),
    images: z.array(z.string()).optional(),
    videos: z.array(z.string()).optional(),
    assets: z.array(
        z.object({
            url: z.string(),
            type: z.enum(['image', 'video']),
        })
    ).optional(),
    theme: z.string().optional().default('dark'),
    audioPath: z.string().optional(),
    bgmPath: z.string().optional(),
});

const PRESET_THEMES: Record<string, { bg: string; text: string }> = {
    'dark': { bg: 'rgba(0, 0, 0, 0.65)', text: '#ffffff' },
    'red': { bg: 'rgba(239, 68, 68, 0.65)', text: '#ffffff' },
    'bright': { bg: 'rgba(255, 255, 255, 0.65)', text: '#000000' },
    'purple': { bg: 'rgba(99, 85, 255, 0.65)', text: '#ffffff' },
    'green': { bg: 'rgba(16, 185, 129, 0.65)', text: '#ffffff' },
};

export const VoiceoverScene: React.FC<z.infer<typeof VoiceoverSceneSchema>> = ({
    title,
    captions,
    images = [],
    videos = [],
    assets = [],
    theme = 'dark',
    audioPath,
    bgmPath,
}) => {
    const frame = useCurrentFrame();
    const { fps, durationInFrames } = useVideoConfig();

    const currentMs = (frame / fps) * 1000;

    // Get current active caption
    const activeCaption = captions.find(
        (c) => currentMs >= c.startMs && currentMs <= c.endMs
    );

    // Subtitle entrance animation
    const activeStartFrame = activeCaption ? (activeCaption.startMs / 1000) * fps : 0;
    const subtitleEntrance = spring({
        frame: frame - activeStartFrame,
        fps,
        config: { damping: 200 },
    });

    // Theme style mapping
    const themeStyle = PRESET_THEMES[theme] || PRESET_THEMES['dark'];

    // Combine assets if passed dynamically, otherwise fallback to props.videos / props.images
    const allAssets = React.useMemo(() => {
        if (assets && assets.length > 0) {
            return assets;
        }
        const list: { url: string; type: 'image' | 'video' }[] = [];
        videos.forEach(v => list.push({ url: v, type: 'video' }));
        images.forEach(img => list.push({ url: img, type: 'image' }));
        return list;
    }, [assets, videos, images]);

    // Active background asset based on current frame division
    const activeAsset = React.useMemo(() => {
        if (allAssets.length === 0) return null;
        const durationPerAsset = durationInFrames / allAssets.length;
        const index = Math.min(
            allAssets.length - 1,
            Math.floor(frame / durationPerAsset)
        );
        return allAssets[index];
    }, [allAssets, durationInFrames, frame]);

    // Zoom effect on background to make it dynamic
    const bgScale = interpolate(
        frame,
        [0, durationInFrames],
        [1.0, 1.08],
        { extrapolateRight: 'clamp' }
    );

    return (
        <AbsoluteFill style={{ backgroundColor: '#050505', fontFamily }}>
            {/* Audio: Narrator Voiceover */}
            {audioPath && (
                <Audio src={audioPath.startsWith('http') || audioPath.startsWith('/') ? audioPath : staticFile(audioPath)} />
            )}

            {/* Audio: Background Music */}
            {bgmPath && (
                <Audio 
                    src={bgmPath.startsWith('http') || bgmPath.startsWith('/') ? bgmPath : staticFile(`bgm/${bgmPath}`)} 
                    volume={0.15} 
                />
            )}

            {/* Background Media */}
            <AbsoluteFill style={{ overflow: 'hidden' }}>
                {activeAsset && activeAsset.type === 'video' && (
                    <Video
                        key={activeAsset.url}
                        src={activeAsset.url.startsWith('http') || activeAsset.url.startsWith('/') ? activeAsset.url : staticFile(activeAsset.url)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${bgScale})`,
                        }}
                        loop
                        muted
                        volume={0}
                    />
                )}

                {activeAsset && activeAsset.type === 'image' && (
                    <Img
                        key={activeAsset.url}
                        src={activeAsset.url.startsWith('http') || activeAsset.url.startsWith('/') ? activeAsset.url : staticFile(activeAsset.url)}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${bgScale})`,
                        }}
                    />
                )}

                {/* If no assets uploaded, show a default elegant dark background */}
                {!activeAsset && (
                    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #1f1f2e 0%, #0d0d13 100%)' }} />
                )}
            </AbsoluteFill>

            {/* Subtle overlay gradient to improve text readability */}
            <AbsoluteFill 
                style={{
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.6) 100%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Top Area: Title with background color (Centered, wrapped, fully shown) */}
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
                        backgroundColor: themeStyle.bg,
                        color: themeStyle.text,
                        padding: '32px 64px',
                        borderRadius: '20px',
                        fontSize: '60px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        maxWidth: '90%',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                >
                    {title}
                </div>
            </div>

            {/* Bottom Area: Voiceover subtitle with background color (Centered, wrapped, fully shown) */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 180,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 10,
                }}
            >
                {activeCaption && (
                    <div
                        key={activeCaption.text}
                        style={{
                            backgroundColor: themeStyle.bg,
                            color: themeStyle.text,
                            padding: '24px 48px',
                            borderRadius: '16px',
                            fontSize: '42px',
                            fontWeight: '600',
                            textAlign: 'center',
                            maxWidth: '85%',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.4,
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            transform: `scale(${interpolate(subtitleEntrance, [0, 1], [0.95, 1])})`,
                            opacity: subtitleEntrance,
                        }}
                    >
                        {activeCaption.text}
                    </div>
                )}
            </div>

            {/* Premium border framing */}
            <AbsoluteFill style={{ border: '24px solid rgba(255,255,255,0.03)', pointerEvents: 'none', zIndex: 100 }} />
        </AbsoluteFill>
    );
};
