/**
 * Poster 배선 테스트 공용 스텁 — happy-dom은 레이아웃을 안 돌려 offsetWidth/Height가 0이고,
 * <img>는 complete=false·naturalWidth=0이라 슬롯 크기와 포스터 자연 치수를 프로토타입에 실어준다.
 * 셋 다 restore 함수를 돌려주니 afterEach에서 그대로 호출하면 된다.
 *
 * `<img>` 자연 치수를 여기서 스텁하는 게 핵심이다(#526 ①): Poster는 전경 <img>가 이미 로드한 값을
 * 읽지, 같은 src를 new Image()로 또 디코드하지 않는다. 프로브가 되살아나면 이 스텁만으론
 * natAspect가 안 잡혀 마스크가 사라진다.
 */
function stubProps(target: object, props: Record<string, unknown>): () => void {
  const saved = Object.entries(props).map(([k]) => [k, Object.getOwnPropertyDescriptor(target, k)] as const);
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(target, k, { configurable: true, get: () => v });
  }
  return () => {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(target, k, d);
      else delete (target as Record<string, unknown>)[k];
    }
  };
}

/** 모든 HTMLElement의 레이아웃 박스를 w×h로 고정한다. */
export function stubBox(w: number, h: number): () => void {
  return stubProps(HTMLElement.prototype, { offsetWidth: w, offsetHeight: h });
}

/** 모든 <img>를 "이미 로드 완료 + 자연 치수 w×h"로 만든다. */
export function stubImgNatural(w: number, h: number): () => void {
  return stubProps(HTMLImageElement.prototype, { complete: true, naturalWidth: w, naturalHeight: h });
}
