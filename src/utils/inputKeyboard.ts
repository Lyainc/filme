/**
 * 입력 · 키보드 기하(#826 S4, 마스터 K-01 · K-08). DOM 없이 부를 수 있는 순수 함수만 둔다 — 측정(rect · visualViewport
 * 읽기)은 훅이 하고, 여기는 받은 숫자로 계산만 한다.
 */

/** visualViewport에서 키보드 계산에 쓰는 두 값 — 테스트가 객체 리터럴로 넘길 수 있게 좁힌다. */
export interface VisualViewportBox {
  offsetTop: number;
  height: number;
}

/**
 * 키보드 높이 = 프레임 바닥 − 보이는 영역 바닥(visualViewport.offsetTop + height), 0 미만은 0.
 *
 * 창 바닥(window.innerHeight)이 아니라 #phone-frame 바닥 기준이라 데스크톱 400 프레임과 휴대폰 전체 화면이 같은 식이다 —
 * 패널은 contain:paint 프레임 안 fixed라 bottom 값도 프레임 바닥에서 잰다. 키보드 높이 고정값(iOS 근사치 같은 숫자)은 두지 않는다:
 * 기기 · 입력 방식마다 달라 언제나 이 식으로 잰다. visualViewport가 없는 환경은 키보드 0이다.
 */
export function keyboardInset(frameBottom: number, vv: VisualViewportBox | null | undefined): number {
  if (!vv) return 0;
  return Math.max(0, frameBottom - (vv.offsetTop + vv.height));
}

/** 입력 중 티켓 확대 상한(마스터 frames.js kb() scale(1.18), K-01 ②). */
export const EDIT_SCALE_MAX = 1.18;

/**
 * 입력 중 래퍼 배율 = min(1.18, 무대 폭 ÷ 맞춤 폭)(D17-1 A). 맞춤 폭은 셸의 fitWidth와 같은 식
 * `min(무대 폭, 무대 높이 × 티켓 가로/세로)`이라, 폭이 먼저 차는 가로 무드는 정확히 1이 되고 확대된 티켓이 프레임 밖으로
 * 나가지 않는다. 무대를 아직 못 쟀으면(0) 확대하지 않는다 — 넘칠 수 있는 쪽보다 맞춤 크기가 안전하다.
 */
export function editScale(stageWidth: number, stageHeight: number, aspect: number): number {
  if (!(stageWidth > 0) || !(stageHeight > 0) || !(aspect > 0)) return 1;
  const fit = Math.min(stageWidth, stageHeight * aspect);
  return Math.min(EDIT_SCALE_MAX, stageWidth / fit);
}

/** 고른 필드 아래 끝과 패널 윗변 사이 간격(D12 '고른 필드가 패널 30px 위'). */
export const FIELD_GAP_ABOVE_PANEL = 30;

/**
 * 입력 중 티켓 세로 이동(px, ≤0). 래퍼는 transform-origin이 top center라 배율이 윗변을 움직이지 않는다 — 그래서 확대 뒤
 * 필드 아래 끝 = 래퍼 윗변(이동 성분 뺀 값) + 래퍼 안 필드 아래 끝 × 배율. 그 아래 끝이 패널 윗변 30px 위에 오도록 위로만
 * 민다: 이미 그보다 위면 0이고, 티켓을 맞춤 위치보다 아래로 내리지 않는다.
 */
export function editLift(wrapperTop: number, fieldBottomLocal: number, scale: number, panelTop: number): number {
  const fieldBottom = wrapperTop + fieldBottomLocal * scale;
  return Math.min(0, Math.round(panelTop - FIELD_GAP_ABOVE_PANEL - fieldBottom));
}
