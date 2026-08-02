import type { HTMLAttributes, ReactNode } from 'react';

type EyebrowTag = 'span' | 'div' | 'p' | 'label';
type EyebrowTone = 'muted' | 'faint' | 'accent';

const TONE_CLS: Record<EyebrowTone, string> = {
  // 2nd 시네마틱 neutral(#203) — eyebrow는 정의상 구조 요소라 cool-neutral 회색 대신 warm neutral-2로.
  muted: 'text-neutral-2',
  faint: 'text-neutral-2/60',
  accent: 'text-accent',
};

interface EyebrowProps extends Omit<HTMLAttributes<HTMLElement>, 'color'> {
  as?: EyebrowTag;
  tone?: EyebrowTone;
  htmlFor?: string;
  children?: ReactNode;
}

/**
 * Mono·대문자·와이드 트래킹 필름 슬러그 캡션. 필드 라벨·섹션 헤더·done 카피 등 ~30곳 복붙 정리(#201).
 * 크기는 스케일의 micro 한 단이다 — 10/11을 고르던 `size` prop은 #616이 스케일을 다섯 단으로
 * 모으며 두 값이 같은 단(11px)이 돼 사라졌다.
 */
export function Eyebrow({
  as: Tag = 'span',
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
      className={`text-mono text-micro uppercase tracking-widest ${TONE_CLS[tone]}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </As>
  );
}
