import type { HTMLAttributes, ReactNode } from 'react';

type EyebrowTag = 'span' | 'div' | 'p' | 'label';
type EyebrowTone = 'muted' | 'faint' | 'accent';

const TONE_CLS: Record<EyebrowTone, string> = {
  muted: 'text-fg-muted',
  faint: 'text-fg-faint',
  accent: 'text-accent',
};

const SIZE_CLS: Record<10 | 11, string> = {
  10: 'text-[10px]',
  11: 'text-[11px]',
};

interface EyebrowProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  as?: EyebrowTag;
  size?: 10 | 11;
  tone?: EyebrowTone;
  htmlFor?: string;
  children?: ReactNode;
}

/** Mono·대문자·와이드 트래킹 필름 슬러그 캡션. 필드 라벨·섹션 헤더·done 카피 등 ~30곳 복붙 정리(#201). */
export function Eyebrow({
  as: Tag = 'span',
  size = 10,
  tone = 'muted',
  className = '',
  htmlFor,
  children,
  ...rest
}: EyebrowProps) {
  const As = Tag as any;
  return (
    <As
      htmlFor={htmlFor}
      className={`text-mono ${SIZE_CLS[size]} uppercase tracking-widest ${TONE_CLS[tone]}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </As>
  );
}
