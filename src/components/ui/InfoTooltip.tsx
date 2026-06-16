import { useEffect, useId, useRef, useState } from 'react';

interface InfoTooltipProps {
  /** 툴팁에 표시할 안내 문구 */
  text: string;
  /** 트리거 버튼 aria-label */
  label?: string;
}

/**
 * 기능 타이틀 옆 정보(ℹ️) 아이콘. 데스크톱은 호버, 모바일은 탭/포커스로 안내를 띄운다(#115).
 * 상시 노출되던 안내 텍스트를 대체해 화면을 비운다.
 */
export default function InfoTooltip({ text, label = '도움말' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLSpanElement>(null);

  // 열렸을 때만 외부 탭/Escape로 닫기. hover-open과 click-open이 모두 open 방향이라
  // 닫기는 전부 여기에 위임한다(hover 중 클릭해도 안 닫히는 게 핵심, #130).
  useEffect(() => {
    if (!open) return;
    const onPointerDownOutside = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDownOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType !== 'touch') setOpen(false); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line text-fg-faint transition-colors hover:border-accent hover:text-accent"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path strokeLinecap="round" d="M8 7.4v3.4" />
          <circle cx="8" cy="5" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-2 w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-card border border-line bg-surface-elevated px-3 py-2 text-[12px] font-normal normal-case leading-relaxed tracking-normal text-fg shadow-pop"
        >
          {text}
        </span>
      )}
    </span>
  );
}
