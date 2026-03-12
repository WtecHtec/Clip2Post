import React, { useMemo } from 'react';
import {
    AbsoluteFill,
    Img,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    staticFile,
    random,
    Audio,
} from 'remotion';
import { z } from 'zod';
import { measureText } from '@remotion/layout-utils';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

export const MySceneSchema = z.object({
    captions: z.array(
        z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
        }),
    ),
    images: z.array(
        z.object({
            src: z.string(),
            startMs: z.number(),
            endMs: z.number(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional().default(400),
            height: z.number().optional(),
            inFlow: z.boolean().optional().default(false),
        }),
    ).optional().default([]),
    fontSize: z.number().optional().default(80),
    centeredStart: z.boolean().optional().default(false),
    verticalFirstWord: z.boolean().optional().default(true),
    randomOrientation: z.boolean().optional().default(false),
    audioUrl: z.string().optional(),
});

const VIBRANT_COLORS = [
    '#FF3E00', '#00D8FF', '#FFBE00', '#FF00E4',
    '#00FF87', '#FFFFFF', '#FFFF00', '#FF4500'
];

type LayoutItem = {
    type: 'text' | 'image';
    text?: string;
    src?: string;
    startMs: number;
    endMs: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    vertical?: boolean;
};

export const MyScene: React.FC<z.infer<typeof MySceneSchema>> = ({
    captions,
    images = [],
    fontSize = 80,
    centeredStart = false,
    verticalFirstWord = true,
    randomOrientation = false,
    audioUrl,
}) => {
    const frame = useCurrentFrame();
    const { fps, width: videoWidth, height: videoHeight } = useVideoConfig();
    const currentMs = (frame / fps) * 1000;

    // 1. Unified Layout Engine
    const items = useMemo(() => {
        const result: LayoutItem[] = [];
        const margin = 60;
        const maxWidth = videoWidth - margin;
        const rowHeight = fontSize * 1.6;
        let currentX = 60;
        let currentY = centeredStart ? (videoHeight / 2 - rowHeight / 2) : 100;
        let maxItemHeightInRow = rowHeight;

        const flowItems = [
            ...captions.map(c => ({ ...c, type: 'text' as const })),
            ...images.filter(img => img.inFlow).map(img => ({ ...img, type: 'image' as const }))
        ].sort((a, b) => a.startMs - b.startMs);

        flowItems.forEach((item, i) => {
            const isFirst = i === 0;
            let itemWidth = 0;
            let itemHeight = 0;
            let vertical = false;

            if (item.type === 'text') {
                const dims = measureText({
                    text: item.text!,
                    fontFamily,
                    fontSize,
                    fontWeight: '900',
                });

                const usableWidth = maxWidth - currentX;
                const requiresWrap = dims.width > usableWidth;
                const isMultiLine = dims.width > (maxWidth - 60);

                if (isMultiLine) {
                    // Force a new line first if we're already partially into a row
                    if (currentX > 60) {
                        currentX = 60;
                        currentY += maxItemHeightInRow + 30;
                        maxItemHeightInRow = rowHeight;
                    }

                    const estimatedLines = Math.ceil(dims.width / (maxWidth - 60));
                    itemWidth = maxWidth - 60;
                    itemHeight = dims.height * estimatedLines;

                    // Force NEXT item to be on a new line
                    result.push({
                        ...item,
                        x: currentX,
                        y: currentY,
                        width: itemWidth,
                        height: itemHeight,
                        color: VIBRANT_COLORS[i % VIBRANT_COLORS.length],
                        vertical: false,
                    });

                    currentX = 60;
                    currentY += itemHeight + 30;
                    maxItemHeightInRow = rowHeight;
                    return; // Early return for block-level item
                } else {
                    itemWidth = dims.width;
                    itemHeight = dims.height;

                    if (randomOrientation) {
                        vertical = random(`${item.text}-${i}`) > 0.7;
                    } else if (isFirst && verticalFirstWord) {
                        vertical = true;
                    }

                    if (vertical) {
                        itemWidth = fontSize * 1.5;
                        itemHeight = dims.width;
                    }
                }
            } else {
                itemWidth = item.width!;
                itemHeight = item.height || (itemWidth * 0.5625);
            }

            if (!isFirst && currentX + itemWidth > maxWidth) {
                currentX = 60;
                currentY += maxItemHeightInRow + 30;
                maxItemHeightInRow = rowHeight;
            }

            result.push({
                ...item,
                x: currentX,
                y: currentY,
                width: itemWidth,
                height: itemHeight,
                color: VIBRANT_COLORS[i % VIBRANT_COLORS.length],
                vertical,
            });

            currentX += itemWidth + 40;
            maxItemHeightInRow = Math.max(maxItemHeightInRow, itemHeight);
        });

        return result;
    }, [captions, images, fontSize, videoWidth, videoHeight, centeredStart, verticalFirstWord, randomOrientation]);

    // 2. Camera Panning
    const activeIndex = items.findIndex(
        (c) => currentMs >= c.startMs && currentMs <= c.endMs,
    );
    const lastRevealedIndex = [...items].reverse().findIndex(c => currentMs >= c.startMs);
    const effectiveIndex = activeIndex !== -1
        ? activeIndex
        : (lastRevealedIndex !== -1 ? (items.length - 1 - lastRevealedIndex) : 0);

    const activeItem = items[effectiveIndex];
    // Plan A: Start from the top, but move the active item to the 2/3 screen height focus line.
    const focusLineY = videoHeight * (2 / 3);
    const rawTargetY = Math.max(0, activeItem.y - focusLineY);

    const scrollSpring = spring({
        frame,
        fps,
        from: 0,
        to: rawTargetY,
        config: { damping: 20, stiffness: 100, mass: 0.5 },
    });

    const prevFrame = Math.max(0, frame - 1);
    const prevScrollSpring = spring({
        frame: prevFrame,
        fps,
        from: 0,
        to: rawTargetY,
        config: { damping: 20, stiffness: 100, mass: 0.5 },
    });
    const velocity = Math.abs(scrollSpring - prevScrollSpring);
    const blurAmount = interpolate(velocity, [0, 20], [0, 10], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ backgroundColor: '#050505' }}>
            {audioUrl && <Audio src={staticFile(audioUrl)} />}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <filter id="scrollBlur">
                    <feGaussianBlur in="SourceGraphic" stdDeviation={`0 ${blurAmount}`} />
                </filter>
            </svg>

            <div
                style={{
                    transform: `translateY(${-scrollSpring}px)`,
                    width: '100%',
                    position: 'relative',
                    filter: blurAmount > 0.5 ? 'url(#scrollBlur)' : 'none',
                }}
            >
                {items.map((item, i) => {
                    const isRevealed = currentMs >= item.startMs;
                    if (!isRevealed) return null;

                    const startFrame = (item.startMs / 1000) * fps;
                    const entrance = spring({
                        frame: frame - startFrame,
                        fps,
                        config: { damping: 200 },
                    });

                    if (item.type === 'text') {
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: item.x,
                                    top: item.y,
                                    color: item.color,
                                    fontSize,
                                    fontWeight: '900',
                                    fontFamily: 'Inter, sans-serif',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxWidth: videoWidth - 120,
                                    transformOrigin: 'top left',
                                    transform: `
                                        ${item.vertical ? 'rotate(90deg) translate(0, -100%)' : ''}
                                        scale(${interpolate(entrance, [0, 1], [0.9, 1])})
                                    `,
                                    opacity: entrance,
                                    textShadow: '0 0 20px rgba(0,0,0,0.5)',
                                }}
                            >
                                {item.text}
                            </div>
                        );
                    } else {
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: item.x,
                                    top: item.y,
                                    width: item.width,
                                    height: item.height,
                                    transform: `scale(${entrance})`,
                                    opacity: entrance,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 15,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Img
                                    src={item.src?.startsWith('http') ? item.src : staticFile(item.src!)}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => console.error("Image load fail:", item.src)}
                                />
                            </div>
                        );
                    }
                })}
            </div>

            {images.filter(img => !img.inFlow).map((img, i) => {
                const isVisible = currentMs >= img.startMs && currentMs <= img.endMs;
                if (!isVisible) return null;
                return (
                    <div key={`st-${i}`} style={{ position: 'absolute', left: img.x, top: img.y, width: img.width, zIndex: 100 }}>
                        <Img src={img.src.startsWith('http') ? img.src : staticFile(img.src)} style={{ width: '100%', borderRadius: 20 }} />
                    </div>
                );
            })}

            <AbsoluteFill style={{ background: 'linear-gradient(to bottom, #050505 0%, transparent 15%, transparent 85%, #050505 100%)', pointerEvents: 'none' }} />
            <AbsoluteFill style={{ border: '24px solid rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        </AbsoluteFill>
    );
};
