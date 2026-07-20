// 원본 비율 보존(contain) 포스터의 선명한 전경과 블러 레터박스 배경(#440) 사이 하드 경계를
// 부드럽게 잇는 페더(#459). 프리뷰(CSS mask-image)와 export(canvas destination-in) 두 경로가
// 동일한 씸·세기로 그리도록, "어느 축이 레터박스인가 + 씸 위치"를 여기 한 곳에서 계산한다.
// object-fit:contain은 한 축은 슬롯을 꽉 채우고 나머지 한 축에만 레터박스를 만드므로(둘 다
// 남는 건 종횡비가 정확히 같을 때뿐) 페더도 최대 한 축 — mask-composite 없이 단일 그라데이션이면 된다.

// 전경 가장자리가 투명으로 흐려지는 깊이(CSS px). export는 이 값을 pixelRatio로 스케일해 쓴다.
// ponytail: 실기기 육안 기준 상수. 프리뷰↔export 세기가 어긋나면 여기만 조정.
export const POSTER_EDGE_FEATHER = 24;

const EPS = 0.5; // 이 px 이하 레터박스는 씸으로 치지 않는다(종횡비 근접 시 미세 잔여 무시).

export interface ContainRect {
  cw: number;
  ch: number;
  insetX: number;
  insetY: number;
}

/** box(레터박스 포함 슬롯)에 natAspect(=natW/natH) 포스터를 object-fit:contain 했을 때의 실제 내용 사각형. */
export function posterContainRect(boxW: number, boxH: number, natAspect: number): ContainRect {
  const boxAspect = boxW / boxH;
  let cw: number;
  let ch: number;
  if (natAspect >= boxAspect) {
    cw = boxW; // 폭에 맞음 → 위아래 레터박스
    ch = boxW / natAspect;
  } else {
    ch = boxH; // 높이에 맞음 → 좌우 레터박스
    cw = boxH * natAspect;
  }
  return { cw, ch, insetX: Math.max(0, (boxW - cw) / 2), insetY: Math.max(0, (boxH - ch) / 2) };
}

/** 페더가 필요한 축(레터박스 밴드가 있는 쪽). contain이라 최대 한 축만 true. */
export function posterFeatherAxes(boxW: number, boxH: number, natAspect: number): { x: boolean; y: boolean } {
  const { insetX, insetY } = posterContainRect(boxW, boxH, natAspect);
  return { x: insetX > EPS, y: insetY > EPS };
}

/**
 * 프리뷰 전경 <img>에 걸 mask-image 값(box 좌표계, px). 레터박스가 있는 축의 내용 가장자리
 * feather px를 투명으로 흘려 뒤의 블러 배경과 잇는다. 레터박스가 없으면(슬롯을 꽉 채움)
 * undefined — 마스크 없이 오늘과 동일해 무손실 가장자리를 보존한다(#439).
 */
export function posterFeatherMask(
  boxW: number,
  boxH: number,
  natAspect: number,
  feather: number = POSTER_EDGE_FEATHER,
): string | undefined {
  const { insetX, insetY } = posterContainRect(boxW, boxH, natAspect);
  if (insetY > EPS) return featherGradient('to bottom', insetY, boxH - insetY, feather);
  if (insetX > EPS) return featherGradient('to right', insetX, boxW - insetX, feather);
  return undefined;
}

// a..b(내용이 차지하는 축 구간) 안쪽으로 f px씩 투명↔불투명 램프를 둔다. 내용이 얇아 램프가
// 겹치면 f를 절반 폭으로 클램프(하드 컷 대신 삼각 페이드).
function featherGradient(dir: string, a: number, b: number, feather: number): string {
  const f = Math.min(feather, (b - a) / 2);
  const r = (n: number) => Math.round(n);
  return `linear-gradient(${dir}, transparent ${r(a)}px, #000 ${r(a + f)}px, #000 ${r(b - f)}px, transparent ${r(b)}px)`;
}
