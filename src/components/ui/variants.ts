import { cva } from 'class-variance-authority';

/**
 * 눌림 피드백(#647 축 1) + 버튼 전환시간(축 4). `active:scale-[0.97]`는 OcrUploadCard/PrimaryCta/
 * Landing 모드갤러리 카드가 이미 쓰던 값 그대로 — 새 값 아님.
 *
 * base엔 transition-property를 안 넣는다 — Tailwind의 transition-colors/transition-transform은
 * 둘 다 같은 CSS `transition-property` 선언이라, 이미 transition-colors(호버 색 전환)를 쓰는
 * 버튼(대다수)에 transition-transform을 얹으면 컴파일된 CSS에서 나중에 나온 쪽이 통째로 이기고
 * 앞쪽이 사라진다(합쳐지지 않음) — 호버 색 전환이 조용히 없어지는 회귀. 그래서 base는 눌림
 * scale만 얹고 애니메이션 유무는 각 버튼이 이미 가진 transition-property에 맡긴다.
 * `transition: 'cta'`는 OcrUploadCard/PrimaryCta가 이미 쓰던 duration-200 + 확장
 * transition-property(transform 포함) 그대로 — 이 둘처럼 transform까지 부드럽게 걸고 싶은
 * 자리만 명시적으로 쓴다.
 */
/**
 * 스프링 눌림(#731, `~/vault/notes/kinetics-spring-motion-reference.md`의 Push Button 값).
 * `cta` variant에만 얹는다 — base는 transition-property가 없어(위 주석) 그 자리에 duration/easing만
 * 추가해봐야 대상 프로퍼티가 없어 무효하고, 리터럴 `transition-colors`를 이미 쓰는 나머지 소비처에
 * 붙이면 twMerge가 같은 transition-property 그룹으로 보고 나중 인자(그 버튼의 기존 transition-colors)만
 * 남겨 조용히 사라진다. cta는 이미 transform까지 포함한 전용 transition-property 목록을 갖고 있어
 * 충돌 없이 얹을 수 있는 유일한 자리다. 누를 때는 60ms ease-out으로 빠르게, 뗄 때(비-active 상태로
 * 돌아갈 때)는 200ms + 스프링 오버슈트 easing으로 정착한다 — CSS transition은 전이 시작 시점의
 * "도착" 상태 값을 쓰므로 active: 쪽엔 눌림용, base 쪽엔 정착용 duration/easing이 각각 걸린다.
 */
export const pressableVariants = cva('active:scale-[0.97]', {
  variants: {
    transition: {
      cta: 'transition-[background-color,color,opacity,transform] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:duration-[60ms] active:ease-out',
    },
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
