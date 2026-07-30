import type { ReactNode } from 'react';

/**
 * 크롭 모달처럼 `createPortal`로 트리를 갈아타는 오버레이가 프레임 안에 붙게 하는 앵커(#606).
 * 프레임이 아직 안 떠 있는 경로(데스크톱 셸, #607에서 삭제)에선 `document.body`로 폴백한다.
 */
export const PHONE_FRAME_ID = 'phone-frame';

/**
 * 폰 프레임(#604) — 모바일 셸 한 벌을 데스크톱에서도 폰 폭으로 세우는 컨테이너.
 *
 * - 모바일: `width:100%` · `height:100dvh` — 프레임 사각형이 뷰포트와 같아 기존 동작 그대로다.
 * - 데스크톱(rail=1024 이상): 폭 400px 고정 + 가로 센터링. 400인 근거는 `scripts/measure-chrome.mjs`의
 *   #563 불변식(dock 232.6 / 프리뷰 226.8×362.3)이 400×675 기준이라, 같은 하네스가 값 변경 없이
 *   데스크톱 프레임의 회귀 게이트가 되기 때문(#609).
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
