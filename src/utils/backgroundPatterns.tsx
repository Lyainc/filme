/**
 * 티켓 스탬프 이미지(#671→#672→#728) — Editorial·Criterion·Stub 세 무드가 공유하는 단일 스타일
 * 소스. 무드는 "어느 고정 박스에 놓을지"만 정하고(`box`), 스타일 자체는 여기 하나에서 나온다.
 *
 * #530이 넣었던 기하 프리셋 3종(도트·사선·그리드)은 #672에서 걷어냈다 — 무드 조판 위에서 값을
 * 못 했다(잉크 6~12%로 눌러 두면 인쇄에서 사실상 안 보이고, 올리면 조판을 침범한다). 프리셋이
 * 사라지면서 id 필드(`backgroundPattern`)도 같이 없앴다: 남는 'none'/'custom' 2택은
 * `backgroundPatternImage`의 유무와 정보가 완전히 겹쳐, "custom인데 이미지 없음" 같은 표현
 * 불가능한 조합만 관리 대상으로 남기 때문이다.
 *
 * #728로 캔버스 전면 cover이던 배치를 무드별 고정 박스로 좁혔다 — 사용자는 위치를 고르지 않고
 * 크기·투명도만 정한다. 이름에 'pattern'이 남은 건 `backgroundPatternImage`가 이미 저장된 draft의
 * 키라서다 — 필드를 개명하면 기존 저장물이 조용히 유실된다. 사용자에게 보이는 이름은 '스탬프'다
 * (docs/specs/background-to-stamp.yaml c1 — 코드 쪽 식별자는 `stamp`가 형압/로고 두 뜻을 이미
 * 쥐고 있어 그대로 `backgroundPattern*`을 유지한다).
 *
 * [risk] iOS Safari 저장물에서 이 레이어만 빠질 수 있다(#439·#671에서 인계). captureToImage가
 * 기록한 실측이 "raster를 foreignObject에 넣으면 iOS가 조용히 떨어뜨린다 — blob/data/canvas 세
 * 라운드 다 같은 함정"이고, 그래서 포스터·로고는 html-to-image에서 빼고 compositeRaster로 직접
 * 합성한다. 이 레이어는 CSS `background-image`라 그 탈출구가 없다. macOS Chrome 하네스로는 원리적으로
 * 못 보는 축이라 **머지 전 실기기 저장 1회 확인이 필요**하고, 깨지면 `data-bg-pattern`도
 * `filter`에서 빼고 compositeRaster 계열로 내려야 한다.
 */
/**
 * 스탬프 레이어. 이미지가 없으면 아무것도 안 그린다 — 그래야 업로드 전에 빈 div가 안 남는다.
 *
 * cover/center/no-repeat인 이유: 여기 들어오는 건 임의의 사진이라 타일링하면 이음매가 그대로
 * 보인다. 알파를 안 깎는다는 #672의 결정은 #728로 뒤집혔다 — 그때 배경은 캔버스 전면이라 흐리면
 * 존재 자체가 안 보였는데, 스탬프는 고정 박스라 반투명이어도 그 자리에 있는 게 보인다("내가 올린
 * 게 왜 안 보이지"의 발생 조건이 사라졌다). 기본 투명도는 `BackgroundPatternPanel`의 write-time
 * 커밋이 정하고, 여기 `opacity`는 그 값을 그대로 그릴 뿐이다(`?? 1` — 기존 저장본 무변경).
 *
 * **한 겹으로 합쳤다**(#728, c10). 전면 cover 시절엔 PATTERN_CLIP이 캔버스 전체에서 포스터 자리만
 * 구멍으로 파야 했고, `clip-path`가 로컬 좌표계에서 정의된 뒤 요소 전체가 transform되는 성질 때문에
 * 배율을 이미지와 같은 요소에 걸면 클립까지 같이 확대됐다(#490/#495 z-order 파손). 고정 박스가
 * 포스터 슬롯과 애초에 안 겹치면(#728이 고른 세 무드의 세 박스가 전부 그렇다) 그 경로 자체가 안
 * 열려 clip이 필요 없다 — 겹을 나눌 이유가 사라졌으니 박스 위치·배율·투명도를 한 요소에 같이 건다.
 */
export function BackgroundPatternLayer({
  image,
  box,
  scale = 1,
  opacity = 1,
}: {
  image?: string;
  /** 무드가 정하는 고정 박스(캔버스 절대 좌표, px). 사용자는 이 자리를 고르지 않는다(#728 c3). */
  box: { left: number; top: number; width: number; height: number };
  /** 표시 배율 1.0~1.5(#680). 1.0 = 박스를 꽉 채우는 cover 렌더 그대로. */
  scale?: number;
  /** 표시 투명도 0.2~1.0(#728). 미설정 1.0 = 기존 저장본 렌더 그대로. */
  opacity?: number;
}) {
  if (!image) return null;
  return (
    <div
      data-bg-pattern="true"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        opacity,
        overflow: 'hidden',
      }}
    >
      <div
        data-bg-pattern-image="true"
        style={{
          position: 'absolute',
          inset: 0,
          // transform-origin 기본값 center가 backgroundPosition center와 같은 기준점이라,
          // 확대해도 박스 중앙이 그대로 중앙이다(오프셋 컨트롤을 안 여는 근거 — #680 D6).
          transform: `scale(${scale})`,
          backgroundImage: `url("${image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
