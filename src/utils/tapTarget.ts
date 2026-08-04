import { cva } from 'class-variance-authority';

// 탭 타깃 44px 표기 통일(#647) — min-h-touch(tailwind.config.js `spacing.touch`)가
// 유일한 44px 소스다. 여기서 min-h-[44px]/h-11로 새 값을 만들지 말 것(expert-panel 조건 1).
export const tapTarget = cva('min-h-touch', {
  variants: {
    shape: {
      auto: '',
      square: 'min-w-touch',
    },
  },
  defaultVariants: {
    shape: 'auto',
  },
});
