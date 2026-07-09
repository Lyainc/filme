import { memo } from 'react';
import { TEXTURE_OPTIONS } from '@/utils/constants';
import { Poster } from '@/components/moods/_shared';
import { Eyebrow } from '@/components/v2/Eyebrow';

interface TexturePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Current poster — drives the per-chip texture preview. */
  croppedImageUrl?: string | null;
}

const THUMB_W = 40;
const THUMB_H = 56;
// Representative opacity for previews — fixed so chips don't recompute on slider drag.
const PREVIEW_OPACITY = 0.5;

/**
 * Mini poster-with-texture preview. Memoized on `src`/`texture` only, so
 * selecting a different chip (which changes the parent's `value`) never
 * re-renders or re-decodes these 8 thumbnails.
 */
const TexturePreview = memo(function TexturePreview({
  src,
  texture,
}: {
  src: string;
  texture: string;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'block',
        width: THUMB_W,
        height: THUMB_H,
        borderRadius: 4,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Poster src={src} texture={texture} posterOpacity={PREVIEW_OPACITY} />
    </span>
  );
});

function TexturePicker({ value, onChange, croppedImageUrl }: TexturePickerProps) {
  const hasPoster = !!croppedImageUrl;

  return (
    <div className="space-y-2.5">
      <Eyebrow className="block">Surface treatment</Eyebrow>
      {/* ponytail: 가로 스크롤 스트립 = 캐러셀(#180 (6)). 8개 작은 스와치는 한 장씩 넘기는
          LayoutPicker식 캐러셀보다 한 줄 스크롤이 비교·선택에 낫고 세로도 절약된다(2줄 wrap→1줄). */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:thin]"
        role="radiogroup"
        aria-label="Texture"
      >
        {TEXTURE_OPTIONS.map((tex) => {
          const active = value === tex.value;
          // Show only short label (first parenthesis-free portion) on chip
          const short = tex.label.split('(')[0].trim();

          if (hasPoster) {
            return (
              <button
                key={tex.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(tex.value)}
                data-touch="44"
                title={tex.label}
                className={`text-mono inline-flex shrink-0 snap-start min-h-touch flex-col items-center gap-1.5 rounded-chip border p-1.5 text-[10px] uppercase tracking-widest transition-colors
                  ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-paper text-fg hover:bg-accent-soft'
                  }`}
              >
                <TexturePreview src={croppedImageUrl as string} texture={tex.value} />
                <span className="px-1 pb-0.5">{short}</span>
              </button>
            );
          }

          return (
            <button
              key={tex.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(tex.value)}
              data-touch="44"
              title={tex.label}
              className={`text-mono inline-flex shrink-0 snap-start min-h-touch items-center rounded-chip border px-4 text-[11px] uppercase tracking-widest transition-colors
                ${
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-paper text-fg hover:bg-accent-soft'
                }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TexturePicker);
