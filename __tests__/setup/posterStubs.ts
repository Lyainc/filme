/**
 * Poster 배선 테스트 공용 스텁 — happy-dom은 레이아웃을 안 돌려 offsetWidth/Height가 0이고,
 * <img>는 complete=false·naturalWidth=0이라 슬롯 크기와 포스터 자연 치수를 프로토타입에 실어준다.
 * 셋 다 restore 함수를 돌려주니 afterEach에서 그대로 호출하면 된다.
 *
 * `<img>` 자연 치수를 여기서 스텁하는 게 핵심이다(#526 ①): Poster는 전경 <img>가 이미 로드한 값을
 * 읽지, 같은 src를 new Image()로 또 디코드하지 않는다. 프로브가 되살아나면 이 스텁만으론
 * natAspect가 안 잡혀 마스크가 사라진다.
 */
/** 값이 함수면 getter로 그대로 쓴다(this = 대상 엘리먼트) — 엘리먼트마다 다른 값을 줄 때. */
function stubProps(target: object, props: Record<string, unknown>): () => void {
  const saved = Object.entries(props).map(([k]) => [k, Object.getOwnPropertyDescriptor(target, k)] as const);
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(target, k, { configurable: true, get: typeof v === 'function' ? (v as () => unknown) : () => v });
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

/**
 * src → [w, h] 매핑으로 `<img>`마다 다른 자연 치수를 준다(#539). 매핑에 없는 src는 **미로드**
 * (complete=false, 자연 치수 0) — 로드 전 프레임과 로드 실패를 같은 스텁으로 재현하므로,
 * "src를 갈면 이전 종횡비를 즉시 폐기한다"는 계약을 매핑 밖 src로 검증할 수 있다.
 */
export function stubImgNaturalBySrc(dims: Record<string, [number, number]>): () => void {
  // 속성으로 읽는다 — `.src` 프로퍼티는 절대 URL로 풀려 'blob:tall' 같은 키와 안 맞는다.
  const nat = (el: HTMLImageElement) => dims[el.getAttribute('src') ?? ''];
  return stubProps(HTMLImageElement.prototype, {
    complete: function (this: HTMLImageElement) { return !!nat(this); },
    naturalWidth: function (this: HTMLImageElement) { return nat(this)?.[0] ?? 0; },
    naturalHeight: function (this: HTMLImageElement) { return nat(this)?.[1] ?? 0; },
  });
}

/**
 * `new Image()`로 흘러간 src를 전부 기록한다 — "이미 렌더하는 src를 또 디코드하지 않는다"(#526 ①,
 * #539)가 이 저장소의 회귀 1순위라, 높이·마스크 단언과 별개로 이걸 따로 못 박는다(프로브를
 * 되살려도 그 프로브가 로드되기만 하면 나머지 단언은 통과한다).
 */
export function trapImageProbe(): { decoded: string[]; restore: () => void } {
  const decoded: string[] = [];
  const orig = globalThis.Image;
  (globalThis as { Image: unknown }).Image = class {
    set src(v: string) {
      decoded.push(v);
    }
  };
  return { decoded, restore: () => { (globalThis as { Image: unknown }).Image = orig; } };
}
