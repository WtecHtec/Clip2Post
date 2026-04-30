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
    Sequence,
} from 'remotion';
import { z } from 'zod';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont();

export const NewsSceneSchema = z.object({
    captions: z.array(
        z.object({
            text: z.string(),
            startMs: z.number(),
            endMs: z.number(),
            isMain: z.boolean().optional(),
        })
    ).optional(),
    mainText: z.string(),
    imageUrl: z.string(),
    audioUrl: z.string().optional(),
    fontSize: z.number().optional().default(70),
    coverTitle: z.string().optional(),
    endingTitle: z.string().optional(),
    bgm: z.string().optional(),
});

export const NewsScene: React.FC<z.infer<typeof NewsSceneSchema>> = ({
    captions,
    mainText,
    imageUrl,
    audioUrl,
    fontSize = 70,
    coverTitle,
    endingTitle,
    bgm,
}) => {
    const frame = useCurrentFrame();
    const { fps, width: videoWidth, height: videoHeight, durationInFrames } = useVideoConfig();

    const coverFrames = coverTitle ? fps * 2 : 0;
    const endingFrames = endingTitle ? fps * 2 : 0;
    
    // Calculate scrolling window
    const scrollStartFrame = coverFrames;
    const scrollEndFrame = durationInFrames - endingFrames;
    
    // Zoom effect on image
    const imageScale = interpolate(
        frame,
        [0, fps * 10], // over 10 seconds
        [1, 1.05],
        { extrapolateRight: 'clamp' }
    );

    const currentTimeMs = (frame / fps) * 1000;
    let activeCaption = null;
    if (captions) {
        for (let i = 0; i < captions.length; i++) {
            if (currentTimeMs >= captions[i].startMs) {
                if (captions[i].isMain) {
                    activeCaption = captions[i];
                } else {
                    activeCaption = null;
                }
            } else {
                break;
            }
        }
    }

    const captionStartFrame = activeCaption ? Math.round((activeCaption.startMs / 1000) * fps) : 0;
    const captionPop = activeCaption ? spring({
        frame: frame - captionStartFrame,
        fps,
        config: { damping: 12, mass: 0.5 },
    }) : 0;

    // Fade out main content for ending animation
    const endingFade = endingFrames > 0 ? interpolate(
        frame,
        [durationInFrames - endingFrames, durationInFrames - endingFrames + 15],
        [1, 0.2],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    ) : 1;

    // Ending text animation (spring)
    const endingEntrance = endingFrames > 0 && frame >= (durationInFrames - endingFrames) ? spring({
        frame: frame - (durationInFrames - endingFrames),
        fps,
        config: { damping: 12 },
    }) : 0;

    return (
        <AbsoluteFill style={{ backgroundColor: '#050505', flexDirection: 'column' }}>
            {audioUrl && (
                <Sequence from={0}>
                    <Audio src={staticFile(audioUrl)} />
                </Sequence>
            )}

            {/* Full-screen Image container */}
            <AbsoluteFill style={{ backgroundColor: '#111', overflow: 'hidden', opacity: endingFade }}>
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

            {/* BGM Render */}
            {bgm && (
                <Audio src={bgm.startsWith('http') ? bgm : staticFile(`bgm/${bgm}`)} volume={0.15} />
            )}

            {/* Active Caption Text */}
            {activeCaption && frame >= scrollStartFrame && frame < scrollEndFrame && (
                <AbsoluteFill style={{ zIndex: 3, opacity: endingFade, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <div
                        key={activeCaption.startMs}
                        style={{
                            transform: `scale(${captionPop})`,
                            width: '80%',
                            fontSize,
                            fontWeight: '600',
                            fontFamily,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            textAlign: 'center',
                            color: '#FFFFFF',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            backdropFilter: 'blur(10px)',
                            padding: '40px',
                            borderRadius: '24px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                            lineHeight: 1.5,
                        }}
                    >
                        {activeCaption.text}
                    </div>
                </AbsoluteFill>
            )}

            {/* Overlay border */}
            <AbsoluteFill style={{ border: '24px solid rgba(255,255,255,0.03)', pointerEvents: 'none', zIndex: 10 }} />

            {/* Cover Sequence render */}
            {coverFrames > 0 && frame < coverFrames && (
                <AbsoluteFill style={{ backgroundColor: '#111', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imageUrl && (
                        <AbsoluteFill>
                            <Img src={imageUrl.startsWith('http') ? imageUrl : staticFile(imageUrl)} style={{ width: '110%', height: '110%', objectFit: 'cover', filter: 'brightness(0.2) blur(20px)', position: 'absolute', top: '-5%', left: '-5%' }} />
                            <Img src={imageUrl.startsWith('http') ? imageUrl : staticFile(imageUrl)} style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 2 }} />
                        </AbsoluteFill>
                    )}
                    <div style={{ padding: '0 80px', zIndex: 201 }}>
                        <h1 style={{ fontSize: 90, color: 'white', fontWeight: '900', textAlign: 'center', fontFamily: 'Inter', textShadow: '0 10px 40px rgba(0,0,0,0.8)', lineHeight: 1.3 }}>
                            {coverTitle}
                        </h1>
                    </div>
                </AbsoluteFill>
            )}

            {/* Ending Title Sequence render */}
            {endingFrames > 0 && frame >= (durationInFrames - endingFrames) && (
                <AbsoluteFill style={{ zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div
                        style={{
                            transform: `scale(${endingEntrance})`,
                            padding: '0 80px',
                        }}
                    >
                        <h1 style={{ 
                            fontSize: 100, 
                            color: '#ffd700', 
                            fontWeight: '900', 
                            textAlign: 'center', 
                            fontFamily: 'Inter', 
                            textShadow: '0 10px 40px rgba(0,0,0,0.8)', 
                            lineHeight: 1.3,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            padding: '40px 60px',
                            borderRadius: '30px',
                            border: '2px solid rgba(255,215,0,0.3)'
                        }}>
                            {endingTitle}
                        </h1>
                    </div>
                </AbsoluteFill>
            )}
        </AbsoluteFill>
    );
};
