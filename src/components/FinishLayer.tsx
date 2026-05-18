'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';

export interface FinishLayerProps {
  vignette: number;    // 0~1
  temperature: number; // -1(cool)~1(warm)
  grain: number;       // 0~1
}

const LAYER_BASE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

// 64×64 monochrome feTurbulence tile, used as background-image (not a CSS filter)
const GRAIN_SVG_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E" +
  "%3Cfilter id='n'%3E" +
  "%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E" +
  "%3CfeColorMatrix type='saturate' values='0'/%3E" +
  "%3C/filter%3E" +
  "%3Crect width='64' height='64' filter='url(%23n)' opacity='1'/%3E" +
  "%3C/svg%3E\")";

const GRAIN_STYLE_BASE: CSSProperties = {
  ...LAYER_BASE,
  backgroundImage: GRAIN_SVG_URL,
  backgroundSize: '64px 64px',
  backgroundRepeat: 'repeat',
  mixBlendMode: 'overlay',
};

export function FinishLayer({ vignette, temperature, grain }: FinishLayerProps) {
  const vignetteStyle = useMemo((): CSSProperties => {
    const v = Math.min(1, Math.max(0, vignette));
    const t = Math.min(1, Math.max(-1, temperature));

    let centerColor: string;
    if (t > 0) {
      centerColor = `rgba(255,165,50,${(t * 0.25).toFixed(3)})`;
    } else if (t < 0) {
      centerColor = `rgba(70,120,225,${(-t * 0.22).toFixed(3)})`;
    } else {
      centerColor = 'transparent';
    }

    return {
      ...LAYER_BASE,
      background: `radial-gradient(ellipse at 50% 50%, ${centerColor} 0%, transparent 55%, rgba(0,0,0,${(v * 0.55).toFixed(3)}) 100%)`,
      mixBlendMode: 'multiply',
    };
  }, [vignette, temperature]);

  const grainStyle = useMemo((): CSSProperties => ({
    ...GRAIN_STYLE_BASE,
    opacity: Math.min(1, Math.max(0, grain)) * 0.4,
  }), [grain]);

  const showVignette = vignette > 0 || temperature !== 0;
  const showGrain = grain > 0;

  if (!showVignette && !showGrain) return null;

  return (
    <>
      {showVignette && <div aria-hidden="true" style={vignetteStyle} />}
      {showGrain && <div aria-hidden="true" style={grainStyle} />}
    </>
  );
}
