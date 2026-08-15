/**
 * 티켓 배경 이미지(#672) — Editorial·Criterion·Stub 세 무드가 공유하는 단일 스타일 소스.
 * 무드는 "어느 슬롯에 어떤 clip으로 깔지"만 정하고, 스타일 자체는 여기 하나에서 나온다.
 *
 * #530이 넣었던 기하 프리셋 3종(도트·사선·그리드)은 #672에서 걷어냈다 — 무드 조판 위에서 값을
 * 못 했다(잉크 6~12%로 눌러 두면 인쇄에서 사실상 안 보이고, 올리면 조판을 침범한다). 프리셋이
 * 사라지면서 id 필드(`backgroundPattern`)도 같이 없앴다: 남는 'none'/'custom' 2택은
 * `backgroundPatternImage`의 유무와 정보가 완전히 겹쳐, "custom인데 이미지 없음" 같은 표현
 * 불가능한 조합만 관리 대상으로 남기 때문이다.
 *
 * 이름에 'pattern'이 남은 건 `backgroundPatternImage`가 이미 저장된 draft의 키라서다 — 필드를
 * 개명하면 기존 저장물이 조용히 유실된다. 사용자에게 보이는 이름만 '배경'으로 바꿨다.
 *
 * [risk] iOS Safari 저장물에서 이 배경만 빠질 수 있다(#439·#671에서 인계). captureToImage가
 * 기록한 실측이 "raster를 foreignObject에 넣으면 iOS가 조용히 떨어뜨린다 — blob/data/canvas 세
 * 라운드 다 같은 함정"이고, 그래서 포스터·로고는 html-to-image에서 빼고 compositeRaster로 직접
 * 합성한다. 이 배경은 CSS `background-image`라 그 탈출구가 없다. macOS Chrome 하네스로는 원리적으로
 * 못 보는 축이라 **머지 전 실기기 저장 1회 확인이 필요**하고, 깨지면 `data-bg-pattern`도
 * `filter`에서 빼고 compositeRaster 계열로 내려야 한다.
 */
/**
 * 배경 이미지 레이어. 이미지가 없으면 아무것도 안 그린다 — 그래야 업로드 전에 빈 div가 안 남는다.
 *
 * cover/center/no-repeat인 이유: 여기 들어오는 건 임의의 사진이라 타일링하면 이음매가 그대로
 * 보인다. 알파는 안 깎는다 — 사용자가 고른 이미지를 임의로 흐리면 "내가 올린 게 왜 안 보이지"가 된다.
 * ponytail: 농도 슬라이더는 안 넣었다. 원하는 목소리가 나오면 그때.
 *
 * **두 겹인 이유는 clip이다**(#680). `clip-path`는 요소의 로컬 좌표계에서 정의된 뒤 요소 전체가
 * transform되므로, 배율을 이미지와 같은 요소에 걸면 PATTERN_CLIP까지 같이 확대돼 저장물에서 배경이
 * 포스터 **위에** 인쇄된다(#490/#495 z-order). 그래서 clip은 바깥이 쥐고 배율은 안쪽만 건다.
 * 배율 1.0에서도 겹은 그대로다 — 배율에 따라 DOM 모양이 갈리면 조건부 JSX의 depth 분기가 되고,
 * 이 레포는 그걸로 이미 한 번 remount에 데였다.
 *
 * `data-bg-pattern`이 바깥에 붙는 것도 같은 이유다: 이 속성을 쓰는 쪽(iOS에서 배경이 떨어지면
 * compositeRaster로 내려야 한다는 아래 [risk])이 필요한 건 서브트리 전체지 안쪽 한 겹이 아니다.
 */
export function BackgroundPatternLayer({
  image,
  scale = 1,
  clipPath,
}: {
  image?: string;
  /** 표시 배율 1.0~1.5(#680). 1.0 = 지금까지의 cover 렌더 그대로. */
  scale?: number;
  clipPath?: string;
}) {
  if (!image) return null;
  return (
    <div data-bg-pattern="true" aria-hidden="true" style={{ position: 'absolute', inset: 0, clipPath, overflow: 'hidden' }}>
      <div
        data-bg-pattern-image="true"
        style={{
          position: 'absolute',
          inset: 0,
          // transform-origin 기본값 center가 backgroundPosition center와 같은 기준점이라,
          // 확대해도 화면 중앙이 그대로 중앙이다(오프셋 컨트롤을 안 여는 근거 — #680 D6).
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
