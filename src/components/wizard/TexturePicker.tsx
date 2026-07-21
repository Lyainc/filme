import { memo, useEffect, useRef } from 'react';
import { Poster } from '@/components/moods/_shared';
import { defaultIntensityForTexture } from '@/utils/textureRecipes';

interface TextureOption {
  value: string;
  label: string;
}

interface TexturePickerProps {
  /** 어느 축의 피커인지(#475) — 미니 스와치가 그 축만 격리해 미리보기하게 한다(반대 축은 기본값). */
  axis: 'material' | 'coating';
  options: readonly TextureOption[];
  value: string;
  onChange: (value: string) => void;
  /** Current poster — drives the per-chip texture preview. */
  croppedImageUrl?: string | null;
  ariaLabel: string;
}

// rail 상세패널 공통 칩 크기(#367, v8 §3) — LayoutStrip 무드 칩·ColorPicker 스와치와 동일 46px.
const THUMB_W = 46;
const THUMB_H = 46;
// Representative opacity for previews — fixed so chips don't recompute on slider drag.
const PREVIEW_OPACITY = 0.5;
// Bundled placeholder shown when no poster is uploaded yet, so texture concepts stay visible (#276).
const SAMPLE_POSTER_SRC = '/assets/texture-sample.svg';

/**
 * Mini poster-with-texture preview. Memoized on `src`/`texture` only, so
 * selecting a different chip (which changes the parent's `value`) never
 * re-renders or re-decodes these 8 thumbnails.
 */
const TexturePreview = memo(function TexturePreview({
  src,
  axis,
  texture,
}: {
  src: string;
  axis: 'material' | 'coating';
  texture: string;
}) {
  // 그 축만 격리해 미리보기 — 반대 축은 Poster 기본값(material='original'/coating='none', 즉
  // 무가공)이라 이 칩이 보여주는 결·광택이 오직 이 옵션 하나뿐임이 보장된다(#475 축 독립).
  const axisProps = axis === 'material'
    ? { material: texture, materialIntensity: defaultIntensityForTexture(texture) }
    : { coating: texture, coatingIntensity: defaultIntensityForTexture(texture) };
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'block',
        width: THUMB_W,
        height: THUMB_H,
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* 칩은 그 옵션의 기본 강도로 미리보기 — 강도 100% 고정이면 실제 기본(hologram/metal 0.7)보다
          화려하게 보인다(#434 PR #472 리뷰 P2). posterOpacity처럼 대표 고정값(슬라이더엔 안 반응). */}
      <Poster src={src} {...axisProps} posterOpacity={PREVIEW_OPACITY} />
    </span>
  );
});

function TexturePicker({ axis, options, value, onChange, croppedImageUrl, ariaLabel }: TexturePickerProps) {
  const previewSrc = croppedImageUrl || SAMPLE_POSTER_SRC;
  // 기본값이 바뀌어 선택 칩이 뷰포트 밖에서 시작해도 항상 보이게(#190 nit, PR #189 리뷰).
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);

  return (
    <div className="space-y-field">
      {/* ponytail: 가로 스크롤 스트립 = 캐러셀(#180 (6)). 작은 스와치는 한 장씩 넘기는
          LayoutPicker식 캐러셀보다 한 줄 스크롤이 비교·선택에 낫고 세로도 절약된다(2줄 wrap→1줄). */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:thin]"
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {options.map((tex) => {
          const active = value === tex.value;
          // Show only short label (first parenthesis-free portion) on chip
          const short = tex.label.split('(')[0].trim();

          // rail 공통 선택 문법(#367) — 카드 프레임·채움 반전 대신 칩 이중 링 + 라벨 색 전환.
          return (
            <button
              key={tex.value}
              ref={active ? activeRef : undefined}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(tex.value)}
              data-touch="44"
              title={tex.label}
              className="flex shrink-0 snap-start flex-col items-center gap-1.5"
            >
              <span
                aria-hidden="true"
                className="block rounded-[12px] border transition-transform"
                style={{
                  borderColor: active ? 'transparent' : 'var(--glass-border)',
                  boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
                  transform: active ? 'scale(1.05)' : undefined,
                }}
              >
                <TexturePreview src={previewSrc} axis={axis} texture={tex.value} />
              </span>
              <span
                className={`text-[11px] font-medium transition-colors ${active ? 'text-accent' : 'text-fg-muted'}`}
              >
                {short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TexturePicker);
