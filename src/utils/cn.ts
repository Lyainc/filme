import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind.config.js fontSize 커스텀 토큰(display/title/body/caption/micro) — 기본 tailwind-merge는
// text-body/text-fg를 같은 충돌군으로 오판해 폰트 크기를 지워버린다(#647 리뷰에서 실측 발견,
// twMerge('text-body text-fg') === 'text-fg'). 여기 등록해야 크기·색이 독립으로 합쳐진다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['display', 'title', 'body', 'caption', 'micro'].map((k) => `text-${k}`),
      // globals.css @layer utilities .text-mono — 기본 twMerge는 미인식 text-* 값을 전부
      // text-color로 흡수해 text-mono와 text-micro/text-fg 같은 걸 같은 충돌군으로 오판한다.
      'font-family': ['text-mono'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
