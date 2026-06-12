import { ReactNode } from 'react';

interface PreviewFilmCellProps {
  /** 다운로드(저장) 진행 중이면 오버레이를 띄운다. */
  saving?: boolean;
  /**
   * 결과 표면("완성됨")에서 편집 프리뷰와 구분되는 시각 승격을 켠다 — accent 헤어라인
   * 프레임 + 강화 그림자. 편집 프리뷰는 끄고(기본값), 결과(rail 인플레이스·시트)만 켜서
   * "지금 이 상태로 저장·공유" 신호를 한 곳에서 제어한다(#98 1단계).
   */
  promoted?: boolean;
  /**
   * promoted일 때 셀 하단 캡션. 캡처 대상(TicketRenderer 내부 ref) 밖이라 내보내기
   * JPEG에는 들어가지 않는다. data-hide-on-export로 한 번 더 방어한다.
   */
  label?: string;
  children?: ReactNode;
  className?: string;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PreviewFilmCell({ saving = false, promoted = false, label, children, className = '' }: PreviewFilmCellProps) {
  return (
    <div
      data-promoted={promoted || undefined}
      // promoted(결과 표면)로 마운트될 때 "철컥 안착" 모션 1회(#98 2단계). 편집 프리뷰는 끔.
      className={`flex flex-col bg-black rounded-card overflow-hidden transition-shadow duration-300 ${promoted ? 'animate-settle' : ''} ${className}`}
      style={{
        position: 'relative',
        isolation: 'isolate',
        // accent 헤어라인 ring + 강화 그림자를 box-shadow 한 줄로(편집 프리뷰는 그림자 없음).
        // reduced-motion은 globals.css 전역 가드가 transition-duration을 죽인다.
        ...(promoted
          ? {
              boxShadow:
                '0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 16px 50px -16px rgba(0,0,0,0.6)',
            }
          : {}),
      }}
    >
      <div className="relative flex-1 flex items-center justify-center bg-black">
        {children}

        {saving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm z-10">
            <span className="text-white"><Spinner /></span>
            <span className="text-white text-sm font-medium">저장 중...</span>
          </div>
        )}
      </div>

      {promoted && label && (
        <div
          data-hide-on-export
          className="flex items-center justify-center gap-1.5 bg-surface-elevated px-3 py-2 text-[11px] font-medium tracking-tight text-accent"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {label}
        </div>
      )}
    </div>
  );
}
