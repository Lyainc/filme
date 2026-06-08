import { CSSProperties, memo, useMemo } from 'react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { formatDate } from '@/utils/dateFormat';

export interface MoodProps {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
  fieldVisibility?: Record<TicketField, boolean>;
}

/**
 * Returns `value` when the field is visible (or visibility is undefined), otherwise ''.
 * Falsy values (empty string, null, undefined, false) always return ''.
 */
export function gate(
  visible: boolean | undefined,
  value: string | false | undefined | null
): string {
  return visible !== false && value ? value : '';
}

export const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
export const FONT_SANS = '"Pretendard Variable", "Pretendard", "Noto Sans KR", sans-serif';
export const FONT_KR = '"Pretendard Variable", "Noto Sans KR", "Inter", sans-serif';

export type Surface = 'paper' | 'dark';

interface ChainStampProps {
  chain: string;
  size?: number;
  surface?: Surface;
  height?: number;
  visible: boolean;
}

const LOGO_SHADOW = 'drop-shadow(0 2px 8px rgba(0,0,0,0.85))';

export function ChainStamp({
  chain,
  size = 1,
  surface = 'paper',
  height = 48,
  visible,
}: ChainStampProps) {
  if (!visible) return null;
  const h = height * size;

  if (!chain) {
    return (
      <div
        data-hide-on-export="true"
        style={{
          height: h,
          width: 120 * size,
          border: '1px dashed currentColor',
          opacity: 0.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10 * size,
          fontWeight: 600,
          fontFamily: FONT_MONO,
          letterSpacing: 1,
          color: 'currentColor',
          ...(surface === 'dark' ? { borderColor: 'rgba(255,255,255,0.5)', color: 'rgba(255,255,255,0.7)' } : {}),
        }}
      >
        LOGO
      </div>
    );
  }

  return (
    <img
      src={chain}
      alt="Theater Chain"
      style={{
        height: h,
        width: 'auto',
        display: 'block',
        ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
      }}
      draggable={false}
    />
  );
}

interface FormatStampProps {
  format: string;
  size?: number;
  surface?: Surface;
  visible: boolean;
}

export function FormatStamp({
  format,
  size = 1,
  surface = 'paper',
  visible,
}: FormatStampProps) {
  if (!visible) return null;
  const h = 64 * size;

  if (!format) {
    return (
      <div
        data-hide-on-export="true"
        style={{
          height: h,
          width: 140 * size,
          border: '1px dashed currentColor',
          opacity: 0.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10 * size,
          fontWeight: 600,
          fontFamily: FONT_MONO,
          letterSpacing: 1,
          color: 'currentColor',
          ...(surface === 'dark' ? { borderColor: 'rgba(255,255,255,0.5)', color: 'rgba(255,255,255,0.7)' } : {}),
        }}
      >
        FORMAT
      </div>
    );
  }

  return (
    <img
      src={format}
      alt="Screening Format"
      style={{
        height: h,
        width: 'auto',
        display: 'block',
        ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
      }}
      draggable={false}
    />
  );
}

interface PosterProps {
  src: string;
  fit?: 'cover' | 'contain';
  background?: string;
  texture?: string;
  posterOpacity?: number;
}

const PRINT_SIM = 'saturate(0.92) contrast(1.05)';

// vintage/newspaper have intentional contrast curves — no PRINT_SIM stacking
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
  const filter = TEXTURE_FILTERS[texture] ?? PRINT_SIM;

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
            fontWeight: 600,
            fontSize: textSize,
            fontFamily: FONT_MONO,
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

interface EditionMarkProps {
  serialNo: string;
  collectionNo?: string;
  /** Picks default ink when `ink` is omitted. */
  surface: Surface;
  ink?: string;
  font?: string;
  size?: number;
  letterSpacing?: number;
}

/**
 * Compact edition token — "SERIAL No.0042 · COLL 03 / 12".
 * Pass `font` to match the host mood's tone (mono / serif / sans).
 */
export function EditionMark({
  serialNo,
  collectionNo,
  surface,
  ink,
  font = FONT_MONO,
  size = 13,
  letterSpacing = 2.4,
}: EditionMarkProps) {
  const color = ink ?? (surface === 'dark' ? '#f4ede0' : '#0d0c0a');
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 12,
        fontWeight: 700,
        fontSize: size,
        fontFamily: font,
        letterSpacing,
        textTransform: 'uppercase',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span>
        <span style={{ opacity: 0.5 }}>Serial </span>
        <span>No.{serialNo}</span>
      </span>
      {collectionNo && (
        <>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>
            <span style={{ opacity: 0.5 }}>Coll </span>
            <span>{collectionNo}</span>
          </span>
        </>
      )}
    </div>
  );
}

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
        borderRadius: 2,
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

export function resolveSerialNo(d: MovieInfo): string {
  if (d.serialNo) return d.serialNo;
  const seed = 'serial::' + (d.title || 'phototicket') + (d.bookingNumber || '');
  return String(seedFromString(seed) % 10000).padStart(4, '0');
}

/**
 * 4종 무드가 공통으로 파생하던 티켓 데이터를 한 곳으로 모은 것.
 * 신규 무드는 `const { ... } = resolveTicketData(d)` 한 줄로 동일 파생값을 얻는다.
 *
 * watchYear는 watchDate가 정규화된 YYYY-MM-DD 형식이므로 `slice(0,4)`로 통일
 * (이전 MoodCriterion의 `match(/\d{4}/)`와 ISO 입력에서 결과 동일).
 */
export function resolveTicketData(d: MovieInfo) {
  const watchToken = d.watchDateFormat || 'kr-compact';
  const releaseToken = d.releaseDateFormat || 'kr-compact';
  const releaseGran = d.releaseDateGranularity || 'date';
  return {
    bookingNo: resolveBookingNo(d),
    serialNo: resolveSerialNo(d),
    watchDateClean: formatDate(d.watchDate, watchToken, 'date'),
    releaseClean: formatDate(d.releaseDate, releaseToken, releaseGran),
    reissueClean: d.isReissue ? formatDate(d.reissueDate, releaseToken, releaseGran) : '',
    watchYear: d.watchDate ? d.watchDate.slice(0, 4) : '',
  };
}

export function pickTitleSize(len: number, sizes: [number, number, number, number]): number {
  if (len <= 6) return sizes[0];
  if (len <= 10) return sizes[1];
  if (len <= 14) return sizes[2];
  return sizes[3];
}

export function luminance(hex: string): number {
  const c = hex.replace('#', '').padEnd(6, '0');
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = toLinear(parseInt(c.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(c.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(c.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isInkLight(themeColor: string): boolean {
  return luminance(themeColor) < 0.18;
}

export function truncateActors(actors: string, max = 3): string {
  if (!actors) return '';
  const parts = actors.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= max) return parts.join(', ');
  return `${parts.slice(0, max).join(', ')} 외 ${parts.length - max}명`;
}
