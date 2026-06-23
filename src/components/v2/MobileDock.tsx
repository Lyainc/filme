import { useEffect, useRef } from 'react';
import { Sprocket } from './Sprocket';

// grabber(렌더 높이 약 20px) 위로 끌어올림으로 인정하는 최소 이동량. 단순 탭과 구분되게 잡았다.
const GRAB_SWIPE_THRESHOLD_PX = 28;

interface MobileDockProps {
  ctaLabel: string;
  disabled?: boolean;
  /** CTA가 비활성일 때 이유를 한 줄로 안내 (데스크탑 rail의 RailReason과 패리티). */
  hint?: string;
  hasImage: boolean;
  previewThumb?: string;
  onPreviewClick?: () => void;
  onCtaClick?: () => void;
}

export function MobileDock({
  ctaLabel,
  disabled = false,
  hint,
  hasImage,
  previewThumb,
  onPreviewClick,
  onCtaClick,
}: MobileDockProps) {
  const showThumb = hasImage && previewThumb;
  const dockRef = useRef<HTMLDivElement>(null);

  // grabber에서 위로 스와이프하면 프리뷰를 연다(#117, 미니뷰어 풀업). 탭도 동일하게 연다.
  const swipeStartY = useRef<number | null>(null);
  const handleGrabTouchStart = (e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleGrabTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (swipeStartY.current != null && y != null && swipeStartY.current - y > GRAB_SWIPE_THRESHOLD_PX) {
      swipeStartY.current = null;
      onPreviewClick?.();
    }
  };

  // dock의 실제 렌더 높이를 --mobile-dock-h로 노출(hint 유무로 높이가 달라짐).
  // 콘텐츠 여백(DOCK_PADDING)과 OCR 배너가 매직넘버 대신 이 값에 묶인다(#102/#97).
  // offsetHeight는 safe-area paddingBottom까지 포함하므로 따로 더하지 않는다.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--mobile-dock-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--mobile-dock-h');
    };
  }, []);

  return (
    <div
      ref={dockRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 40,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-translucent)',
      }}
    >
      {hasImage && (
        <button
          type="button"
          onClick={onPreviewClick}
          onTouchStart={handleGrabTouchStart}
          onTouchMove={handleGrabTouchMove}
          aria-label="미리보기 열기"
          className="flex w-full items-center justify-center pt-2 pb-1 text-fg-faint transition-colors active:text-accent"
        >
          {/* dock은 움직이지 않고 프리뷰 시트만 위로 열리므로, 드래그 핸들 바 대신
              방향을 직접 가리키는 위 chevron으로 '끌어올려 미리보기' 의도를 명확히 한다(#117). */}
          <svg width="22" height="10" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-6 9 6" />
          </svg>
        </button>
      )}
      {disabled && hint && (
        <p className="px-4 pt-2 text-[13px] leading-none text-fg-muted">{hint}</p>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onPreviewClick}
          aria-label="미리보기 확대"
          className="group transition-transform active:scale-95"
          style={{
            position: 'relative',
            width: 44,
            height: 56,
            flexShrink: 0,
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onPreviewClick ? 'pointer' : 'default',
          }}
        >
          {showThumb ? (
            <img
              src={previewThumb}
              alt="티켓 미리보기"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-faint)" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          )}
          {/* 탭 어포던스 — 누르면 확대 아이콘 오버레이 페이드인 */}
          {showThumb && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-active:opacity-100"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m21 21-4.3-4.3M11 8v6M8 11h6" />
              </svg>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={disabled ? undefined : onCtaClick}
          disabled={disabled}
          style={{
            flex: 1,
            height: 44,
            // PrimaryCta(rounded-field-sm)와 같은 토큰에 묶어 화면 폭에 따른 반경 불일치 제거.
            borderRadius: 'var(--r-field)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontWeight: 600,
            fontSize: 14,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            background: 'var(--accent)',
            color: '#fff',
            transition: 'background 150ms, opacity 150ms',
          }}
        >
          <Sprocket size={14} />
          <span>{ctaLabel}</span>
        </button>
      </div>
    </div>
  );
}
