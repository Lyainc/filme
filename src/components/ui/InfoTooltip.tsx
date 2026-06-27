import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

interface InfoTooltipProps {
  /** 툴팁에 표시할 안내 문구 */
  text: string;
  /** 트리거 버튼 aria-label */
  label?: string;
  /**
   * 말풍선 위치. 'bottom'(기본, 항목 아래·하위호환) | 'right'(항목 오른쪽).
   * 어느 쪽이든 뷰포트 좌우 밖으로 나가면 자동으로 안쪽으로 보정한다(#142 (17)).
   */
  placement?: 'bottom' | 'right';
}

/**
 * 기능 타이틀 옆 정보(ℹ️) 아이콘. 데스크톱은 호버, 모바일은 탭/포커스로 안내를 띄운다(#115).
 * 상시 노출되던 안내 텍스트를 대체해 화면을 비운다.
 */
export default function InfoTooltip({ text, label = '도움말', placement = 'bottom' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  // 열렸을 때 말풍선이 뷰포트 좌우 경계를 넘으면 그만큼 수평 보정(px). 닫히면 0으로 리셋.
  const [shiftX, setShiftX] = useState(0);

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

  // Edge-collision 클램프: 말풍선을 그린 뒤 실제 위치를 재서, 화면 좌우 여백(8px) 밖으로
  // 삐져나가면 그만큼 안쪽으로 당긴다. max-w가 100vw-16px로 캡돼 있어 한 번 보정으로 항상
  // 안에 들어오고, 너비를 넘기는 긴 문구는 whitespace-normal로 줄바꿈된다(잘림 대신 wrap).
  useLayoutEffect(() => {
    if (!open) {
      setShiftX(0);
      return;
    }
    const el = tooltipRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    // rect엔 이미 적용된 shiftX가 반영돼 있으므로 빼서 미보정 baseline 위치를 복원한 뒤
    // 절대 보정량을 다시 계산한다. text/placement가 바뀌어 effect가 재실행돼도 과거 shift가
    // 잔류·누적되지 않는다(#142 P1). shiftX를 deps에 넣어도 dx가 안정값이라 다음 실행에서
    // 같은 값으로 수렴해 React가 bail-out, 루프가 생기지 않는다.
    const right = rect.right - shiftX;
    const left = rect.left - shiftX;
    let dx = 0;
    if (right > vw - margin) dx = vw - margin - right;
    else if (left < margin) dx = margin - left;
    setShiftX(dx);
  }, [open, text, placement, shiftX]);

  const baseMl = placement === 'right' ? 8 : 0; // 'right'의 기본 간격(ml-2 상당)을 인라인으로 흡수
  const positionClass =
    placement === 'right'
      ? 'left-full top-1/2 -translate-y-1/2'
      : 'left-1/2 top-full mt-2 -translate-x-1/2';

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
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={{ marginLeft: baseMl + shiftX }}
          className={`absolute z-30 w-max max-w-[min(240px,calc(100vw_-_16px))] whitespace-normal rounded-card border border-line bg-surface-elevated px-3 py-2 text-[12px] font-normal normal-case leading-relaxed tracking-normal text-fg shadow-pop ${positionClass}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
