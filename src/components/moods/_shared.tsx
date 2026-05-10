import { CSSProperties, memo, useMemo } from 'react';
import { THEATER_CHAINS, SCREENING_FORMATS } from '@/utils/constants';
import type { MovieInfo, TicketComponents } from '@/types';

export interface MoodProps {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
}

export const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
export const FONT_SANS = '"Inter", "Pretendard Variable", "Pretendard", "Noto Sans KR", sans-serif';
export const FONT_SERIF = '"Cormorant Garamond", "Times New Roman", serif';
export const FONT_KR = '"Pretendard Variable", "Noto Sans KR", "Inter", sans-serif';

export type Surface = 'paper' | 'dark';

interface ChainStampProps {
  chain: string;
  size?: number;
  surface?: Surface;
  height?: number;
}

function chainAssetSrc(chain: string): string | null {
  const found = THEATER_CHAINS.find((c) => c.value === chain);
  return found?.file ? `/assets/chains_transparent/${found.file}` : null;
}

function formatAssetSrc(format: string): string | null {
  const found = SCREENING_FORMATS.find((f) => f.value === format);
  return found?.file ? `/assets/formats_transparent/${found.file}` : null;
}

const wrapperPaper = (size: number): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  background: '#fff',
  padding: `${5 * size}px ${10 * size}px`,
  boxSizing: 'border-box',
});

export function ChainStamp({
  chain,
  size = 1,
  surface = 'paper',
  height = 38,
}: ChainStampProps) {
  if (!chain) return null;
  const src = chainAssetSrc(chain);
  const h = height * size;

  if (src) {
    if (surface === 'dark') {
      return (
        <span style={{ ...wrapperPaper(size), height: h + 10 * size }}>
          <img
            src={src}
            alt={chain}
            style={{ height: '100%', width: 'auto', display: 'block' }}
            draggable={false}
            crossOrigin="anonymous"
          />
        </span>
      );
    }
    return (
      <img
        src={src}
        alt={chain}
        style={{ height: h, width: 'auto', display: 'block' }}
        draggable={false}
        crossOrigin="anonymous"
      />
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        font: `900 ${22 * size}px ${FONT_SANS}`,
        letterSpacing: 1.5 * size,
      }}
    >
      {chain}
    </span>
  );
}

interface FormatStampProps {
  format: string;
  color?: string;
  size?: number;
  framed?: boolean;
  surface?: Surface;
}

export function FormatStamp({
  format,
  color = 'currentColor',
  size = 1,
  framed = false,
  surface = 'paper',
}: FormatStampProps) {
  if (!format) return null;
  const label = format.toUpperCase();
  const src = formatAssetSrc(format);

  if (src) {
    const h = 32 * size;
    if (surface === 'dark') {
      return (
        <span style={{ ...wrapperPaper(size), height: h + 10 * size }}>
          <img
            src={src}
            alt={label}
            style={{ height: '100%', width: 'auto', display: 'block' }}
            draggable={false}
            crossOrigin="anonymous"
          />
        </span>
      );
    }
    return (
      <img
        src={src}
        alt={label}
        style={{ height: h, width: 'auto', display: 'block' }}
        draggable={false}
        crossOrigin="anonymous"
      />
    );
  }

  if (framed) {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: `${8 * size}px ${14 * size}px`,
          border: `${2 * size}px solid ${color}`,
          color,
          font: `800 ${22 * size}px ${FONT_SANS}`,
          letterSpacing: 2 * size,
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      style={{
        color,
        font: `900 ${28 * size}px ${FONT_SANS}`,
        letterSpacing: 3 * size,
      }}
    >
      {label}
    </span>
  );
}

interface PosterProps {
  src: string;
  fit?: 'cover' | 'contain';
  background?: string;
  texture?: string;
  posterOpacity?: number;
}

const TEXTURE_FILTERS: Record<string, string> = {
  vintage: 'sepia(0.6) contrast(1.1) brightness(0.9)',
  newspaper: 'grayscale(1) contrast(1.5) brightness(1.2)',
};

export function Poster({
  src,
  fit = 'cover',
  background = '#0a0a0a',
  texture = 'original',
  posterOpacity = 0.5,
}: PosterProps) {
  const filter = TEXTURE_FILTERS[texture];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: '50% 50%',
          filter,
        }}
        draggable={false}
        crossOrigin="anonymous"
      />
      {texture && texture !== 'original' && (
        <TextureOverlay texture={texture} posterOpacity={posterOpacity} />
      )}
    </div>
  );
}

function TextureOverlay({
  texture,
  posterOpacity,
}: {
  texture: string;
  posterOpacity: number;
}) {
  if (texture === 'original' || texture === 'vintage' || texture === 'newspaper') {
    return null;
  }

  const overlays: Record<string, CSSProperties> = {
    none: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0) 100%)',
      mixBlendMode: 'screen',
    },
    hologram: {
      background:
        'linear-gradient(135deg, rgba(255,182,193,0.32) 0%, rgba(255,223,186,0.32) 20%, rgba(255,255,186,0.32) 40%, rgba(186,255,201,0.32) 60%, rgba(186,225,255,0.32) 80%, rgba(216,191,216,0.32) 100%)',
      mixBlendMode: 'color-dodge',
    },
    metal: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(180,190,200,0.1) 30%, rgba(255,255,255,0.55) 50%, rgba(100,110,120,0.1) 70%, rgba(30,40,50,0.35) 100%)',
      mixBlendMode: 'hard-light',
    },
    artpaper: {
      background:
        'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 2px, rgba(255,255,255,0.04) 2px 4px)',
      mixBlendMode: 'multiply',
    },
    scodix: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.12) 45%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 55%)',
      mixBlendMode: 'overlay',
    },
  };

  const style = overlays[texture];
  if (!style) return null;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...style,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: '#000',
          opacity: 1 - posterOpacity,
          mixBlendMode: 'multiply',
        }}
      />
    </>
  );
}

interface BarcodeProps {
  value?: string;
  color?: string;
  height?: number;
  width?: number;
  orientation?: 'horizontal' | 'vertical';
  showText?: boolean;
  textSize?: number;
}

type Bar = { ink: boolean; w: number };

function buildBarcodeWidths(value: string): Bar[] {
  let s = seedFromString(value);
  const widths: Bar[] = [
    { ink: true, w: 3 },
    { ink: false, w: 1 },
    { ink: true, w: 1 },
  ];
  let toggle = false;
  for (let i = 0; i < 80; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    widths.push({ ink: toggle, w: 1 + (s % 3) });
    toggle = !toggle;
  }
  widths.push(
    { ink: true, w: 1 },
    { ink: false, w: 1 },
    { ink: true, w: 3 },
    { ink: false, w: 1 },
    { ink: true, w: 2 }
  );
  return widths;
}

export const Barcode = memo(function Barcode({
  value = 'PT-000000-0000',
  color = 'currentColor',
  height = 80,
  width = 360,
  orientation = 'horizontal',
  showText = true,
  textSize = 11,
}: BarcodeProps) {
  const widths = useMemo(() => buildBarcodeWidths(value), [value]);

  const bars = useMemo(() => {
    const totalUnits = widths.reduce((a, b) => a + b.w, 0);
    const QUIET = 6;
    const longSide = orientation === 'horizontal' ? width : height;
    const shortSide = orientation === 'horizontal' ? height : width;
    const unit = longSide / (totalUnits + QUIET * 2);
    let cursor = QUIET * unit;

    return widths.map((b, i) => {
      const x = cursor;
      cursor += b.w * unit;
      if (!b.ink) return null;
      const dims =
        orientation === 'horizontal'
          ? { x, y: 0, width: Math.max(b.w * unit, 0.5), height: shortSide }
          : { x: 0, y: x, width: shortSide, height: Math.max(b.w * unit, 0.5) };
      return <rect key={i} {...dims} fill={color} />;
    });
  }, [widths, orientation, width, height, color]);

  const shortSide = orientation === 'horizontal' ? height : width;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'horizontal' ? 'column' : 'row',
        alignItems: orientation === 'horizontal' ? 'flex-start' : 'flex-end',
        gap: 6,
      }}
    >
      <svg
        width={orientation === 'horizontal' ? width : shortSide}
        height={orientation === 'horizontal' ? shortSide : height}
        viewBox={
          orientation === 'horizontal'
            ? `0 0 ${width} ${shortSide}`
            : `0 0 ${shortSide} ${height}`
        }
        style={{ display: 'block' }}
        shapeRendering="crispEdges"
      >
        {bars}
      </svg>
      {showText && (
        <span
          style={{
            font: `600 ${textSize}px ${FONT_MONO}`,
            color,
            letterSpacing: 2,
            writingMode: orientation === 'horizontal' ? 'horizontal-tb' : 'vertical-rl',
            ...(orientation === 'vertical' ? { transform: 'rotate(180deg)' } : {}),
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
});

export function HorizontalSprockets({
  count = 14,
  height = 64,
  base = '#0a0a0a',
  hole = '#f6f1e4',
}: {
  count?: number;
  height?: number;
  base?: string;
  hole?: string;
}) {
  const holes = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      style={{
        width: 50,
        height: 38,
        borderRadius: 5,
        background: hole,
        flexShrink: 0,
      }}
    />
  ));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 18px',
        height,
        background: base,
      }}
    >
      {holes}
    </div>
  );
}

export function PerforationStrip({
  vertical = true,
  count = 30,
  color = '#1a1612',
  background = 'transparent',
}: {
  vertical?: boolean;
  count?: number;
  color?: string;
  background?: string;
}) {
  const dots = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      style={{
        width: 5,
        height: 5,
        borderRadius: 999,
        background: color,
        opacity: 0.55,
      }}
    />
  ));
  return (
    <div
      style={{
        position: 'absolute',
        background,
        ...(vertical
          ? {
              left: 0,
              top: 0,
              bottom: 0,
              width: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
            }
          : {
              left: 0,
              right: 0,
              top: 0,
              height: 14,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
            }),
      }}
    >
      {dots}
    </div>
  );
}

export function seedFromString(s: string): number {
  let h = 0x9e3779b9 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x85ebca6b) >>> 0;
  }
  return h;
}

const CURRENT_YEAR = new Date().getFullYear();

export function fallbackBookingNumber(seed: string): string {
  const tail = String(seedFromString(seed) % 10000).padStart(4, '0');
  return `PT-${CURRENT_YEAR}-${tail}`;
}

export function resolveBookingNo(d: MovieInfo): string {
  return d.bookingNumber || fallbackBookingNumber(d.title || 'phototicket');
}

export function compactDate(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, '');
}

export function pickTitleSize(len: number, sizes: [number, number, number, number]): number {
  if (len <= 6) return sizes[0];
  if (len <= 10) return sizes[1];
  if (len <= 14) return sizes[2];
  return sizes[3];
}

export function isInkLight(themeColor: string): boolean {
  return themeColor.toLowerCase() === '#000000';
}
