import { ReactNode, TouchEvent, memo, useEffect, useRef } from 'react';
import { LAYOUTS, type LayoutSpec } from '@/utils/layouts';
import type { LayoutId } from '@/types';

interface LayoutPickerProps {
  value: LayoutId;
  onChange: (id: LayoutId) => void;
}

const SWIPE_THRESHOLD = 40;

function LayoutPicker({ value, onChange }: LayoutPickerProps) {
  const count = LAYOUTS.length;
  // 슬라이드 위치 = 선택값(value) 그 자체다. 탐색(스와이프·화살표·도트)이 곧 선택이라
  // slide===activeIndex===value 불변식이 서고, 카운터·도트·ColorPicker(value 기준 disabled)가
  // 항상 일치한다. 별도 slide state를 두면 "탐색했는데 선택은 안 됨" 불일치가 생긴다.
  const activeIndex = Math.max(
    0,
    LAYOUTS.findIndex((l) => l.id === value)
  );

  // onChange는 부모 소유 value를 바꾸므로 빠른 연타 시 activeIndex가 리렌더 전까지 stale이다.
  // 의도 인덱스를 ref에 동기적으로 누적해 연타가 한 칸씩 정확히 쌓이게 한다(슬라이드 스킵 방지).
  const pendingIndex = useRef(activeIndex);
  useEffect(() => {
    pendingIndex.current = activeIndex;
  }, [activeIndex]);

  const select = (i: number) => {
    const next = ((i % count) + count) % count;
    pendingIndex.current = next;
    onChange(LAYOUTS[next].id);
  };
  const go = (delta: number) => select(pendingIndex.current + delta);

  // 스와이프(터치) — 시작 X만 ref로 보관, 끝에서 임계값 넘으면 이동.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_THRESHOLD) go(-1);
    else if (dx < -SWIPE_THRESHOLD) go(1);
    touchStartX.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };

  return (
    <div className="space-y-2.5">
      <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
        Mood · {activeIndex + 1} / {count}
      </span>

      <div
        className="relative outline-none"
        role="group"
        aria-roledescription="carousel"
        aria-label="Mood designs"
        aria-keyshortcuts="ArrowLeft ArrowRight"
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyDown={onKeyDown}
      >
        {/* Viewport */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {LAYOUTS.map((layout, i) => {
              const active = value === layout.id;
              const isCurrent = i === activeIndex;
              return (
                <div
                  key={layout.id}
                  className="w-full shrink-0 px-1"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} / ${count}: ${layout.label}`}
                  aria-hidden={!isCurrent}
                  inert={!isCurrent}
                >
                  <button
                    type="button"
                    onClick={() => select(i)}
                    aria-pressed={active}
                    // 컨테이너 div(tabIndex=0)가 단일 Tab stop — 화살표로 탐색=선택하므로
                    // 카드는 Tab 대상에서 빼 이중 stop을 없앤다. 마우스·터치 클릭은 유지(#166).
                    tabIndex={-1}
                    data-touch="44"
                    className={`group relative flex min-h-touch w-full flex-col items-stretch gap-2 rounded-card border p-2.5 text-left transition-colors
                      ${
                        active
                          ? 'border-accent bg-accent-soft shadow-card'
                          : 'border-line bg-paper hover:border-accent/40 hover:bg-accent-soft'
                      }`}
                  >
                    <Thumbnail layout={layout} active={active} />
                    <div className="space-y-0.5">
                      <div
                        className={`text-mono text-[10px] uppercase tracking-widest ${
                          active ? 'text-accent' : 'text-fg-muted group-hover:text-fg'
                        }`}
                      >
                        {layout.label}
                        {active && <span className="ml-1.5 text-accent">· 선택됨</span>}
                      </div>
                      <div className="text-[11px] leading-tight text-fg-faint">{layout.caption}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prev / Next nav */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="이전 무드"
          data-touch="44"
          className="absolute left-1 top-[38%] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/90 text-fg shadow-card backdrop-blur transition-colors hover:border-accent hover:text-accent"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ‹
          </span>
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="다음 무드"
          data-touch="44"
          className="absolute right-1 top-[38%] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/90 text-fg shadow-card backdrop-blur transition-colors hover:border-accent hover:text-accent"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ›
          </span>
        </button>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1">
        {LAYOUTS.map((layout, i) => {
          const isCurrent = i === activeIndex;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => select(i)}
              aria-label={`${layout.label} 보기`}
              aria-current={isCurrent}
              data-touch="44"
              className="flex h-11 w-11 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`block rounded-full transition-all ${
                  isCurrent ? 'h-2 w-5 bg-accent' : 'h-2 w-2 bg-line'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LayoutPicker);

interface ThumbColors {
  stroke: string;
  dim: string;
}

const THUMBNAIL_RENDERERS: Record<LayoutId, (c: ThumbColors) => ReactNode> = {
  minimal: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="22" fill={dim} opacity="0.3" />
      <rect x="6" y="9" width="14" height="3" fill={stroke} />
      <rect x="56" y="9" width="18" height="3" fill={stroke} />
      <rect x="0" y="22" width="80" height="48" fill={dim} opacity="0.15" />
      <rect x="0" y="60" width="80" height="40" fill="rgba(0,0,0,0.6)" />
      <rect x="6" y="68" width="40" height="4" fill={stroke} />
      <rect x="6" y="76" width="50" height="6" fill={stroke} />
      <rect x="6" y="86" width="14" height="2" fill={dim} />
      <rect x="22" y="86" width="20" height="2" fill={dim} />
      <rect x="6" y="92" width="10" height="2" fill={dim} />
      <rect x="58" y="86" width="14" height="6" fill={dim} />
    </>
  ),
  criterion: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="100" fill={dim} opacity="0.2" />
      <rect x="0" y="0" width="9" height="100" fill="rgba(255,255,255,0.06)" />
      <line x1="9" y1="0" x2="9" y2="100" stroke={stroke} strokeWidth="0.5" />
      <text
        x="4.5"
        y="50"
        textAnchor="middle"
        fontSize="3"
        fill={stroke}
        transform="rotate(-90 4.5 50)"
      >
        PHOTOTICKET
      </text>
      <text
        x="4.5"
        y="84"
        textAnchor="middle"
        fontSize="1.8"
        fill={dim}
        transform="rotate(-90 4.5 84)"
      >
        Made by FILME
      </text>
      <rect x="14" y="14" width="3" height="3" fill="none" stroke={stroke} strokeWidth="0.4" />
      <rect x="50" y="10" width="22" height="6" fill={stroke} opacity="0.7" />
      <line x1="14" y1="38" x2="74" y2="38" stroke={stroke} strokeWidth="0.4" />
      <rect x="14" y="42" width="40" height="6" fill={stroke} />
      <line x1="14" y1="58" x2="74" y2="58" stroke={stroke} strokeWidth="0.4" />
      <rect x="14" y="80" width="36" height="2" fill={dim} />
      <circle cx="64" cy="84" r="9" fill="none" stroke={stroke} strokeWidth="0.5" />
      <circle
        cx="64"
        cy="84"
        r="6"
        fill="none"
        stroke={stroke}
        strokeWidth="0.3"
        strokeDasharray="0.8 1.4"
      />
    </>
  ),
  '35mm': ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="9" fill="#0a0a0a" />
      <rect x="0" y="91" width="80" height="9" fill="#0a0a0a" />
      {[6, 16, 26, 36, 46, 56, 66, 76].map((x) => (
        <rect key={`top-${x}`} x={x} y="3" width="4" height="3" rx="0.5" fill="#f6f1e4" />
      ))}
      {[6, 16, 26, 36, 46, 56, 66, 76].map((x) => (
        <rect key={`bot-${x}`} x={x} y="94" width="4" height="3" rx="0.5" fill="#f6f1e4" />
      ))}
      <rect x="0" y="9" width="80" height="82" fill={dim} opacity="0.18" />
      <rect x="0" y="64" width="80" height="27" fill="rgba(0,0,0,0.7)" />
      <rect x="6" y="68" width="22" height="2" fill={dim} />
      <rect x="6" y="74" width="48" height="4" fill={stroke} />
      <rect x="6" y="82" width="30" height="2" fill={dim} />
      <rect x="58" y="82" width="14" height="4" fill={dim} />
    </>
  ),
  editorial: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="32" height="100" fill={dim} opacity="0.5" />
      <line x1="33" y1="0" x2="33" y2="100" stroke={stroke} strokeWidth="0.4" strokeDasharray="0.6 1" />
      <rect x="34" y="0" width="46" height="100" fill="#f4ede0" />
      <rect x="34" y="0" width="0.8" height="100" fill="#A8312A" />
      <rect x="38" y="6" width="14" height="3" fill="#1a1612" />
      <rect x="56" y="6" width="20" height="2" fill="#8a7e63" />
      <line x1="38" y1="14" x2="78" y2="14" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="20" width="36" height="6" fill="#1a1612" />
      <rect x="38" y="30" width="22" height="2" fill="#8a7e63" />
      <line x1="38" y1="38" x2="78" y2="38" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="44" width="14" height="3" fill="#1a1612" />
      <rect x="58" y="44" width="14" height="3" fill="#1a1612" />
      <rect x="38" y="56" width="14" height="3" fill="#1a1612" />
      <rect x="58" y="56" width="14" height="3" fill="#1a1612" />
      <line x1="38" y1="74" x2="78" y2="74" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="80" width="10" height="2" fill="#1a1612" />
      <rect x="62" y="80" width="14" height="6" fill="#1a1612" />
    </>
  ),
};

const Thumbnail = memo(function Thumbnail({
  layout,
  active,
}: {
  layout: LayoutSpec;
  active: boolean;
}) {
  const stroke = active ? '#9B5436' : '#756B62';
  const dim = active ? 'rgba(155,84,54,0.55)' : 'rgba(44,38,34,0.25)';
  const inkBg = active ? 'rgba(200,112,79,0.10)' : 'rgba(44,38,34,0.04)';

  return (
    <div
      className="relative w-full overflow-hidden rounded-field bg-bg"
      style={{ aspectRatio: layout.orientation === 'landscape' ? '4/3' : '0.78/1' }}
    >
      <svg
        viewBox="0 0 80 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{ background: inkBg }}
      >
        {THUMBNAIL_RENDERERS[layout.id]({ stroke, dim })}
      </svg>
    </div>
  );
});
