import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind.config.js theme.extend.fontSize의 커스텀 스케일(display/title/body/caption/micro,
// #647 리뷰 발견) — 기본 tailwind-merge는 이 이름들을 모른 채 `text-` 접두어만 보고 text-color
// 그룹으로 오인해, `text-title text-fg`를 합치면 색상 클래스가 폰트크기 클래스를 지워버린다
// (twMerge('text-title text-fg') === 'text-fg', title 소실 — 재현 확인됨). title=16px는 #274
// iOS Safari 자동 줌인 방지 하한이라 조용히 사라지면 실제 버그로 이어진다. font-size 그룹에
// 명시적으로 등록해 text-color와 충돌하지 않게 분리한다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-display', 'text-title', 'text-body', 'text-caption', 'text-micro'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
