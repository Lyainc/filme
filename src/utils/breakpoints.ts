/**
 * rail(데스크톱 인플레이스 결과·CTA) ↔ dock·sheet(모바일) 단일 경계(#104).
 *
 * 이 값 미만이면 모바일 셸(MobileEditorShell·ResultSheet), 이상이면 데스크톱 rail이 뜬다.
 * 두 경계가 어긋나면 그 사이 폭에서 진입 CTA가 둘 다 사라지는 dead zone이 생긴다
 * (이전: rail은 lg=1024, isMobile은 640 기준이라 641~1023 구간이 비어 있었음).
 *
 * CSS 쪽은 tailwind.config.js의 `screens.rail`(동일 px)이 미러다 — 둘은 항상 같이
 * 움직여야 하고, 한쪽만 바꾸면 dead zone이 재발한다.
 */
export const RAIL_BREAKPOINT_PX = 1024;

/** rail 미만(= 모바일 패턴) 매칭 쿼리. useMatchMedia에 그대로 넘긴다. */
export const BELOW_RAIL_QUERY = `(max-width: ${RAIL_BREAKPOINT_PX - 1}px)`;
