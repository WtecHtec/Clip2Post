import React from 'react';
import { Series, useVideoConfig, AbsoluteFill, Audio, staticFile } from 'remotion';
import { TitleScene } from './components/TitleScene';
import { OutroScene } from './components/OutroScene';
import { TemplateProps } from './types';

export const AITemplate: React.FC<TemplateProps> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();

  // We assign 2 seconds for OutroScene, and the remaining time for TitleScene
  const outroDuration = fps * 2;
  const titleDuration = Math.max(1, durationInFrames - outroDuration);

  const audioUrl = props.audioPath || (props as any).audioUrl;
  const bgmUrl = props.bgmPath || props.bgm;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0E' }}>
      {/* Play Narrator/TTS Audio */}
      {audioUrl && (
        <Audio 
          src={audioUrl.startsWith('http') || audioUrl.startsWith('/') ? audioUrl : staticFile(audioUrl)} 
        />
      )}

      {/* Play Background Music */}
      {bgmUrl && (
        <Audio 
          src={bgmUrl.startsWith('http') || bgmUrl.startsWith('/') ? bgmUrl : staticFile(`bgm/${bgmUrl}`)} 
          volume={0.15} 
        />
      )}

      <Series>
        <Series.Sequence durationInFrames={titleDuration}>
          <TitleScene {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outroDuration}>
          <OutroScene author={props.author} outroTagline={props.outroTagline} fontMode={props.fontMode} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
