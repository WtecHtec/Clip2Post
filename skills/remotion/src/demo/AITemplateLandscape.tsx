import React from 'react';
import { AbsoluteFill } from 'remotion';
import { AITemplate } from './AITemplate';
import { TemplateProps } from './types';

export const AITemplateLandscape: React.FC<TemplateProps> = (props) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {/* 
        The original portrait video height is 1920, and width is 1080.
        To fit it into a 1920x1080 (16:9) landscape canvas, we scale it down by:
        scale = 1080 / 1920 = 0.5625.
        This centers it horizontally and vertically perfectly.
      */}
      <div style={{
        width: 1080,
        height: 1920,
        transform: 'scale(0.5625)',
        transformOrigin: 'center center',
        position: 'relative',
        flexShrink: 0,
      }}>
        <AITemplate {...props} />
      </div>
    </AbsoluteFill>
  );
};
