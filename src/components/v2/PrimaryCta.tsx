import type { ReactNode } from 'react';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { Sprocket } from './Sprocket';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

interface PrimaryCtaProps {
  state?: CtaState;
  label?: string;
  successLabel?: string;
  onClick?: () => void;
  className?: string;
  /** idle/disabled 상태의 leading 아이콘. 미지정 시 기본 Sprocket(브랜드). Done 저장 CTA는 다운로드 아이콘을 넘긴다(#222). */
  icon?: ReactNode;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M10.28 2.28 4.75 7.81 1.72 4.78.28 6.22l4.47 4.47 7-7-1.47-1.41z" />
    </svg>
  );
}

export function PrimaryCta({
  state = 'idle',
  label = '티켓 저장',
  successLabel = '저장됨!',
  onClick,
  className = '',
  icon,
}: PrimaryCtaProps) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const isDisabled = state === 'disabled' || state === 'loading';

  return (
    <button
      type="button"
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      aria-busy={state === 'loading'}
      className={`w-full min-h-[44px] rounded-field-sm flex items-center justify-center gap-2 font-semibold text-sm transition-[background-color,color,opacity,transform] duration-200 active:scale-[0.97] ${
        state === 'disabled'
          ? 'opacity-50 cursor-not-allowed bg-accent text-accent-ink'
          : state === 'success'
          ? 'bg-success text-white cursor-default'
          : 'bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer'
      } ${className}`}
    >
      {state === 'loading' && (
        <>
          <span className={prefersReducedMotion ? '' : 'animate-sprocket-spin'}>
            <Sprocket size={16} />
          </span>
          <span>저장 중...</span>
        </>
      )}
      {state === 'success' && (
        <>
          <CheckIcon />
          <span>{successLabel}</span>
        </>
      )}
      {(state === 'idle' || state === 'disabled') && (
        <>
          {icon ?? <Sprocket size={16} />}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
