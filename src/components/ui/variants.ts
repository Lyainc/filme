import { cva } from 'class-variance-authority';

/**
 * 눌림 피드백(#647 축 1) + 버튼 전환시간(축 4). `active:scale-[0.97]`는 OcrUploadCard/PrimaryCta/
 * Landing 모드갤러리 카드가 이미 쓰던 값 그대로 — 새 값 아님. `transition: 'cta'`도 OcrUploadCard/
 * PrimaryCta가 이미 쓰던 duration-200 + 확장 transition-property 그대로.
 */
export const pressableVariants = cva('active:scale-[0.97]', {
  variants: {
    transition: {
      base: 'transition-transform',
      cta: 'transition-[background-color,color,opacity,transform] duration-200',
    },
  },
  defaultVariants: {
    transition: 'base',
  },
});

/**
 * 탭 타깃 44px(#647 축 2). height/width를 독립 축으로 둔 이유 — 정사각 아이콘 버튼(h-11 w-11)과
 * 풀폭 CTA(min-h-[44px]만, width는 w-full 별도)가 섞여 있어 h+w를 한 variant로 묶으면 후자에
 * 원치 않는 width 클래스가 붙는다. 값은 전부 tailwind.config.js의 spacing.touch(44px) 하나에서 나옴.
 */
export const touchTargetVariants = cva('', {
  variants: {
    height: {
      fixed: 'h-touch',
      min: 'min-h-touch',
    },
    width: {
      fixed: 'w-touch',
      min: 'min-w-touch',
      none: '',
    },
  },
  defaultVariants: {
    width: 'none',
  },
});

/**
 * 입력창 포커스 링(#647 축 3). 마우스 클릭에도 뜨던 focus:를 focus-visible:로 바꾸는 것만 스코프 —
 * 패딩·폰트·transition-colors·disabled 상태는 컴포넌트별로 다르므로 여기 안 넣고 각자 cn()으로 얹는다.
 * 링이 원래 없던 자리(FieldEditorBody.tsx select)는 이 variant를 쓰지 않고 focus: → focus-visible:만
 * 직접 스왑한다 — 링을 새로 추가하는 건 축 3 스코프 밖.
 */
export const inputVariants = cva(
  'outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-soft',
  {
    variants: {
      surface: {
        paper: 'border border-line bg-paper',
        glass: 'border border-[var(--glass-border)] bg-[var(--glass-fill)]',
      },
    },
  },
);
