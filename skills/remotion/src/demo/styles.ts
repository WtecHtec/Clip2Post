export const COLORS = {
  bg: '#0A0A0E',           // 深色科技风背景
  purple: '#6355FF',       // 品牌紫色
  purpleLight: '#8C82FF',  // 亮紫色
  white: '#FFFFFF',
  white80: 'rgba(255, 255, 255, 0.8)',
  white60: 'rgba(255, 255, 255, 0.6)',
  white30: 'rgba(255, 255, 255, 0.3)',
  white10: 'rgba(255, 255, 255, 0.1)',
  white07: 'rgba(255, 255, 255, 0.07)',
  white04: 'rgba(255, 255, 255, 0.04)',
  progressBg: 'rgba(255, 255, 255, 0.1)',
};

export const CANVAS = {
  width: 1080,
  height: 1920,
};

import { delayRender, continueRender, staticFile } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSilkscreen } from '@remotion/google-fonts/Silkscreen';
import { loadFont as loadZcoolQingKe } from '@remotion/google-fonts/ZCOOLQingKeHuangYou';
import { loadFont as loadZcoolKuaiLe } from '@remotion/google-fonts/ZCOOLKuaiLe';

// Load local pixel font
if (typeof window !== 'undefined') {
  const pixelFontFace = new FontFace(
    'ArkPixel',
    `url(${staticFile('fonts/ark-pixel.otf')})`
  );

  const waitForFont = delayRender();
  pixelFontFace.load()
    .then((loadedFace) => {
      document.fonts.add(loadedFace);
      continueRender(waitForFont);
    })
    .catch((err) => {
      console.warn('Failed to load local ArkPixel font:', err);
      continueRender(waitForFont);
    });
}

export const getFontFamily = (fontMode?: string): string => {
  if (fontMode === 'pixel') {
    const { fontFamily } = loadSilkscreen();
    return `"ArkPixel", "${fontFamily}", "VT323", "Courier New", monospace`;
  }
  if (fontMode === 'techy') {
    const { fontFamily } = loadZcoolQingKe();
    return `"${fontFamily}", "PingFang SC", sans-serif`;
  }
  if (fontMode === 'cute') {
    const { fontFamily } = loadZcoolKuaiLe();
    return `"${fontFamily}", "PingFang SC", sans-serif`;
  }
  const { fontFamily } = loadInter();
  return `"${fontFamily}", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
};
