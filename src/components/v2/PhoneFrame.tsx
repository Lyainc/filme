import type { ReactNode } from 'react';

/**
 * 크롭 모달처럼 `createPortal`로 트리를 갈아타는 오버레이가 프레임 안에 붙게 하는 앵커(#606).
 * 앱 경로에선 프레임이 항상 서 있고, 모달을 단독 렌더하는 테스트만 `document.body`로 폴백한다.
 */
export const PHONE_FRAME_ID = 'phone-frame';

/**
 * 이동식 툴바의 좌표·클램프·스냅이 쓰는 기준 사각형(#607).
 *
 * `contain: paint`가 `position: fixed`의 컨테이닝 블록을 프레임으로 바꾸므로 그 위에 얹히는
 * `translate(x, y)`도 뷰포트가 아니라 **프레임 원점 기준**이다. `window.innerWidth/innerHeight`로
 * 클램프하면 1440 뷰포트에서 x가 1388까지 허용돼 400px 프레임 밖으로 나가고, 그 좌표가
 * localStorage에 영속돼 다시 열어도 안 돌아온다.
 *
 * 모바일에선 프레임이 뷰포트와 같은 사각형(left/top 0, 100% × 100dvh)이라 반환값이 동일 —
 * 기존 동작은 불변이다. 프레임이 없거나 아직 레이아웃 전(테스트 환경)이면 뷰포트로 폴백한다.
 */
export function getFrameRect(): { left: number; top: number; width: number; height: number } {
  const r = document.getElementById(PHONE_FRAME_ID)?.getBoundingClientRect();
  if (r && r.width > 0 && r.height > 0) return { left: r.left, top: r.top, width: r.width, height: r.height };
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/**
 * 폰 프레임(#604) — 모바일 셸 한 벌을 데스크톱에서도 폰 폭으로 세우는 컨테이너.
 *
 * - 모바일: `width:100%` · `height:100dvh` — 프레임 사각형이 뷰포트와 같아 기존 동작 그대로다.
 * - 데스크톱(rail=1024 이상): 폭 400px 고정 + 가로 센터링. #607에서 데스크톱 전용 셸이 삭제돼
 *   이제 이 프레임이 데스크톱의 유일한 레이아웃이다. 400인 근거는 `scripts/measure-chrome.mjs`의
 *   #563 불변식(dock 232.6 / 프리뷰 226.8×362.3)이 400×675 기준이라, 폭을 맞춰두면 같은 하네스가
 *   값 변경 없이 데스크톱 프레임에도 쓰이기 때문이다. **#609에서 실제로 게이트가 됐다** — 그
 *   스크립트가 대조 기준을 뷰포트에서 이 엘리먼트의 rect로 옮겨, `--viewport 1440x675`로 돌려도
 *   프레임이 400×675면 같은 불변식을 그대로 대조하고 어긋나면 exit 1이다(실측: 프레임 400×675
 *   at x=520, dock·프리뷰 값 무변경).
 *
 * 여기 걸린 두 속성은 **각자 다른 일을 하고 하나로 대체되지 않는다**:
 *
 * 1. `container-type: size` — `cqw`/`cqh`가 이 박스를 기준으로 풀리게 한다(#605). 확정된 높이를
 *    요구하므로 height를 명시한다(auto면 컨테이너가 죽어 cqh가 0으로 폴백한다).
 * 2. `contain: paint` — `position: fixed`의 컨테이닝 블록을 이 엘리먼트로 바꿔, 셸 곳곳의 fixed
 *    오버레이(드로어·메뉴 백드롭·max 모드·레일 핸들·토스트·인플레이스 편집·크롭 모달)를 한 줄도
 *    안 고치고 프레임 안으로 끌어온다.
 *
 * #603 에픽 본문은 "`container-type: size`가 `contain: size layout style paint`를 함의한다"고
 * 적었지만 **틀렸다.** 스펙상 `container-type: size`가 켜는 건 `layout` · `style` · `size`뿐이고
 * `paint`는 안 들어간다. `contain: paint` 없이 재면 프레임은 400px로 서고 cq 단위도 프레임
 * 기준으로 잘 풀리는데 fixed만 뷰포트로 탈출한다(1440×900 실측: 크롭 모달이 프레임에 포털됐는데도
 * 1440×900, 레일 핸들 x=1396, 드로어 x=1128). `contain: paint`를 얹으면 전부 프레임 안에 들어온다.
 * 이 한 줄을 지우면 measure-chrome이 크롭 모달·필드 드로어·max 오버레이 셋을 좌 520px 넘침으로
 * 잡아 exit 1이다(#609 실측) — 그때도 dock/프리뷰 불변식은 통과하므로, 그 숫자만으로는 못 잡는다.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      id={PHONE_FRAME_ID}
      data-testid="phone-frame"
      className="relative mx-auto w-full rail:w-[400px]"
      style={{ height: '100dvh', containerType: 'size', contain: 'paint' }}
    >
      {children}
    </div>
  );
}
