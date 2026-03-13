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
    '#323232', // Charocal/Black
    '#E91E63', // Pink/Crimson
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#009688', // Teal
    '#4CAF50', // Green
    '#FF5722', // Deep Orange
    '#673AB7', // Deep Purple
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

    // 1. Grid Occupancy Layout Engine (Tetris Style)
    const items = useMemo(() => {
        const CELL_SIZE = 10; // Finer grid (10px) for better accuracy
        const margin = 60;
        const gridWidth = Math.floor(videoWidth / CELL_SIZE);
        const marginCells = Math.floor(margin / CELL_SIZE);

        // Occupancy map: Map<y_cell, Set<x_cell>>
        const occupancy = new Map<number, Set<number>>();
        const isOccupied = (tx: number, ty: number, tw: number, th: number) => {
            for (let y = ty; y < ty + th; y++) {
                const row = occupancy.get(y);
                if (!row) continue;
                for (let x = tx; x < tx + tw; x++) {
                    if (row.has(x)) return true;
                }
            }
            return false;
        };
        const markOccupied = (tx: number, ty: number, tw: number, th: number) => {
            for (let y = ty; y < ty + th; y++) {
                if (!occupancy.has(y)) occupancy.set(y, new Set());
                const row = occupancy.get(y)!;
                for (let x = tx; x < tx + tw; x++) {
                    row.add(x);
                }
            }
        };

        const result: LayoutItem[] = [];
        // Initial offset: start at ~20% of height to avoid being too high
        let lowestYSearch = Math.floor((videoHeight * 0.2) / CELL_SIZE);

        // Pre-process flowItems: split long captions into smaller pieces
        const processedFlowItems: any[] = [];

        captions.forEach((c, idx) => {
            // Randomize orientation for the entire sentence (50/50 mix)
            const sentenceVertical = random(`orient-${idx}-${c.text}`) > 0.5;

            if (c.text.length > 8) {
                const mid = Math.floor(c.text.length / 2);

                processedFlowItems.push({
                    ...c,
                    text: c.text.substring(0, mid), // First half
                    originalId: c.startMs,
                    forceVertical: sentenceVertical,
                    groupIndex: idx,
                    type: 'text' as const
                });
                processedFlowItems.push({
                    ...c,
                    text: c.text.substring(mid), // Second half
                    originalId: c.startMs,
                    forceVertical: sentenceVertical,
                    groupIndex: idx,
                    type: 'text' as const
                });
            } else {
                processedFlowItems.push({
                    ...c,
                    forceVertical: sentenceVertical,
                    groupIndex: idx,
                    type: 'text' as const
                });
            }
        });

        const flowItems = [
            ...processedFlowItems,
            ...images.filter(img => img.inFlow).map(img => ({ ...img, type: 'image' as const }))
        ].sort((a, b) => {
            if (a.startMs !== b.startMs) return a.startMs - b.startMs;
            return 0;
        });

        flowItems.forEach((item, i) => {
            const isFirst = i === 0;
            let itemWidthPx = 0;
            let itemHeightPx = 0;
            let vertical = false;

            if (item.type === 'text') {
                const dims = measureText({
                    text: item.text!,
                    fontFamily,
                    fontSize,
                    fontWeight: '900',
                });

                // Standard sizing
                itemWidthPx = dims.width;
                itemHeightPx = dims.height;

                // Orientation logic: inherited from group preprocessing
                if (item.forceVertical !== undefined) {
                    vertical = item.forceVertical;
                } else {
                    // Fallback should not happen with new logic but safe
                    vertical = false;
                }

                if (vertical) {
                    itemWidthPx = fontSize * 1.3 + 40; // Increase width for better character wrapping
                    itemHeightPx = (fontSize * 1.15) * item.text!.length + 40; // More height buffer
                }

                // If text is too wide for the whole grid, we have a problem, but usually we split by segment or enforce wrapping
                // For this grid engine, we'll clamp item width to maxContentWidth
                if (itemWidthPx > (videoWidth - margin * 2)) {
                    itemWidthPx = videoWidth - margin * 2;
                }
            } else {
                // IMAGE: Full-width block style suggested by user previously, 
                // but let's allow it to be slightly flexible if it fits.
                // Actually, user wants "compact", so let's make it 80-90% width.
                itemWidthPx = videoWidth - margin * 2;
                itemHeightPx = itemWidthPx * 0.8;
                if (itemHeightPx > videoHeight * 0.5) itemHeightPx = videoHeight * 0.5;
            }

            // Convert pixels to grid cells
            // Ensure w/h are multiples of CELL_SIZE or slightly larger to prevent sub-pixel overlap
            let wCells = Math.ceil((itemWidthPx + 30) / CELL_SIZE);
            let hCells = Math.ceil((itemHeightPx + 30) / CELL_SIZE);

            // CRITICAL: Ensure item fits in searchable area
            const maxW = gridWidth - marginCells * 2;
            if (wCells > maxW) wCells = maxW;

            // For images, force full-width occupancy to ensure exclusivity
            if (item.type === 'image') {
                wCells = maxW;
            }

            // Search for placement
            let found = false;
            let targetX = marginCells;
            let targetY = lowestYSearch;
            let searchTimeout = 0;

            const maxSearchX = gridWidth - marginCells - wCells;

            // Simple scanning search
            while (!found && searchTimeout < 5000) {
                searchTimeout++;
                for (let x = marginCells; x <= maxSearchX; x++) {
                    if (!isOccupied(x, targetY, wCells, hCells)) {
                        targetX = x;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    targetY++;
                }
            }

            // Mark and store
            markOccupied(targetX, targetY, wCells, hCells);

            const finalX = targetX * CELL_SIZE;
            const finalY = targetY * CELL_SIZE;

            result.push({
                ...item,
                x: finalX,
                y: finalY,
                width: itemWidthPx,
                height: itemHeightPx,
                color: VIBRANT_COLORS[item.groupIndex % VIBRANT_COLORS.length],
                vertical,
            });

            // Keep chronological order dominant
            if (item.type === 'image') {
                // Images advanced the waterline completely to prevent any tucking
                lowestYSearch = Math.max(lowestYSearch, targetY + hCells);
            } else if (targetY > lowestYSearch) {
                // Text allows very slight tucking for compact feel
                lowestYSearch = Math.max(lowestYSearch, targetY - 2);
            }
        });

        return result;
    }, [captions, images, fontSize, videoWidth, videoHeight, verticalFirstWord, randomOrientation]);

    // 2. Camera Panning: Prioritize focusing on images if multiple items are active
    const activeImageIndex = items.findIndex(
        (c) => c.type === 'image' && currentMs >= c.startMs && currentMs <= c.endMs,
    );
    const activeTextIndex = items.findIndex(
        (c) => c.type === 'text' && currentMs >= c.startMs && currentMs <= c.endMs,
    );
    const activeIndex = activeImageIndex !== -1 ? activeImageIndex : activeTextIndex;

    const lastRevealedIndex = [...items].reverse().findIndex(c => currentMs >= c.startMs);
    const effectiveIndex = activeIndex !== -1
        ? activeIndex
        : (lastRevealedIndex !== -1 ? (items.length - 1 - lastRevealedIndex) : 0);

    const activeItem = items[effectiveIndex];
    // Plan B: Center the active item in the viewport for better focus
    const rawTargetY = Math.max(0, (activeItem.y + activeItem.height / 2) - videoHeight / 2);

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
                                    fontSize,
                                    fontWeight: '900',
                                    fontFamily: 'Inter, sans-serif',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    width: item.vertical ? fontSize * 1.3 : 'auto',
                                    maxWidth: item.vertical ? fontSize * 1.8 : videoWidth - 120,
                                    transformOrigin: 'top left',
                                    transform: `
                                        scale(${interpolate(entrance, [0, 1], [0.9, 1])})
                                    `,
                                    opacity: entrance,
                                    backgroundColor: '#FFFFFF',
                                    color: item.color, // Vibrant color on white sticker
                                    padding: '10px 25px', // More horizontal padding for symmetry
                                    borderRadius: 16,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                    display: item.vertical ? 'flex' : 'inline-block',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    lineHeight: 1.15,
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
                                    opacity: entrance,
                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                    borderRadius: 30,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                    transform: `translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
                                }}
                            >
                                {/* Background Blurred layer for depth */}
                                <AbsoluteFill style={{ overflow: 'hidden' }}>
                                    <Img
                                        src={item.src?.startsWith('http') ? item.src : staticFile(item.src!)}
                                        style={{
                                            width: '120%',
                                            height: '120%',
                                            objectFit: 'cover',
                                            filter: 'blur(40px) brightness(0.4)',
                                            transform: 'translate(-10%, -10%)'
                                        }}
                                    />
                                </AbsoluteFill>

                                <Img
                                    src={item.src?.startsWith('http') ? item.src : staticFile(item.src!)}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        zIndex: 2,
                                        transform: `scale(${interpolate(currentMs, [item.startMs, item.endMs], [1.0, 1.05], { extrapolateRight: 'clamp' })})`
                                    }}
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
