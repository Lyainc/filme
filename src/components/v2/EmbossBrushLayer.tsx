import { useCallback, useEffect, useRef, useState } from 'react';
import { getFrameRect } from '@/components/v2/PhoneFrame';
import { parseObjectPosition, posterContentFrac, type EmbossContentFrac } from '@/utils/posterFeather';
import { buildLassoGradientMap, snapToEdge, LASSO_SNAP_RADIUS_PX, type GradientMap } from '@/utils/embossLasso';
import type { EmbossPath, EmbossStamp } from '@/utils/textureRecipes';

interface EmbossBrushLayerProps {
  /** 포스터 서브트리를 담은 컨테이너에서 [data-poster-root]를 찾아온다. 매 포인터 이벤트·매
   *  rAF 프레임마다 다시 부른다 — 별도 캐시 없이 항상 최신 레이아웃을 읽는다(무드·크롭 전환에도 안전). */
  getPosterEl: () => Element | null;
  /** 포토샵풍 도구 전환(#509 2단계 c9/c10 UI 절반) — 브러시는 원형 스탬프를 찍고, 올가미는
   *  드래그를 엣지-스냅해 닫힌 다각형 하나로 커밋한다. 같은 레이어가 포인터를 소비하되 해석만 갈린다. */
  tool: 'brush' | 'lasso';
  /** 포스터 root 박스 폭 기준 분율 반경 — clientToStamp이 저장 직전 자연 이미지 분율로 변환한다
   *  (#509 재매핑). */
  brushRadius: number;
  onStamp: (stamp: EmbossStamp) => void;
  /** 올가미 트레이스가 포인터업 시점에 닫힌 다각형(>=3점)으로 커밋될 때만 호출된다. */
  onPath: (path: EmbossPath) => void;
  /** max 뷰모드(#729 c2) — max 스테이지가 `z-50`이라 이 레이어도 그 위(51)로 올라가야 포스터
   *  탭이 "기본 크기로 돌아가기"가 아니라 이 레이어에 먼저 닿는다. 기본 모드의 45는 필드
   *  드로어(z-50)를 가리지 않으려고 그대로 둔다. */
  isMax: boolean;
  /** 가로형 무드가 max에서 90도 회전됐는지(#729 c5). getBoundingClientRect는 회전된 요소의
   *  축정렬 bbox만 주므로, 참이면 클라이언트 좌표를 로컬(자연) 좌표로 되돌리기 전에 축을
   *  90도 되돌려야 한다. */
  rotated: boolean;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// 스탬프 사이 최소 간격(브러시 반경 기준 분율) — 이걸 안 두면 pointermove 빈도만큼(수십~수백Hz)
// 스탬프가 쌓여 마스크 배열이 금방 비대해진다. 0.3이면 원끼리 충분히 겹쳐 매끈한 선이 되면서도
// 실사용 드래그 한 번이 수십 개 스탬프 수준으로 묶인다.
const MIN_STAMP_SPACING = 0.3;

// 올가미 정점 사이 최소 간격(자연 분율) — 브러시의 MIN_STAMP_SPACING과 같은 목적(pointermove
// 빈도만큼 정점이 쌓이는 것 방지). 브러시는 반경에 상대적이지만 올가미엔 반경이 없어 절대값을
// 쓴다 — 브러시 반경 범위(0.02~0.2)의 하단 근처로 잡아 촘촘한 트레이스에서도 굴곡을 살린다.
const MIN_LASSO_SPACING = 0.01;

/**
 * 화면(축정렬 bbox) 사각형을, 포스터 root 자신의 화면 중심을 회전축 삼아 90도(시계방향)
 * 회전 이전 로컬 좌표계로 되돌린다(#729 c5) — clientToNaturalFrac의 boxX/boxY 역변환과 같은
 * 가정(회전축 ≈ 포스터 root 중심)이다. 풀블리드 무드(editorial·35mm Wide)만 이 경로를 타는데,
 * 그 두 무드는 포스터 root가 티켓 캔버스 전체에 가까워 root 중심이 실제 회전축(ticketBoxEl
 * 중심)과 실측상 일치한다 — 브러시 레이어 위치 자체가 이미 그 가정으로 서 있다(#729 c4).
 * 절대 좌표는 임의 원점이라 의미 없고, posterContentFrac이 쓰는 폭/높이/상대 오프셋만 맞으면 된다.
 */
function toLocalRect(pivotCx: number, pivotCy: number, r: DOMRect): { left: number; top: number; width: number; height: number } {
  const corners = [
    { x: r.left, y: r.top },
    { x: r.left + r.width, y: r.top + r.height },
  ].map((p) => ({ x: p.y - pivotCy, y: -(p.x - pivotCx) }));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/**
 * 포스터 root 박스 대비 실제 이미지 콘텐츠 사각형을 실측한다(#509 재매핑) — Poster 컴포넌트가
 * 프리뷰 렌더에서 쓰는 것과 같은 posterContentFrac이지만, 여긴 React state가 아니라 DOM을 직접
 * 잰다(브러시는 Poster 트리 밖의 별도 오버레이라 그 내부 상태에 접근할 수 없다). 실제 사진 <img>의
 * rect·natural 크기·style.objectFit/objectPosition을 읽는 게 captureToImage.compositeRaster와
 * 동일한 근거 — 브라우저가 object-fit을 어디에 그렸는지는 이 값들로 계산하는 것 말고 알 방법이 없다.
 *
 * `rotated`(#729 c5)일 때 rootR/imgR는 getBoundingClientRect가 주는 **회전된 축정렬 bbox**라
 * width/height가 로컬 폭/높이와 뒤바뀌어 있다 — 그대로 posterContentFrac에 먹이면 contain/cover
 * fit 판정 자체가 뒤집혀 오프셋이 어긋난다(실측: avgX가 예측 사분면을 벗어남, 심하면 음수).
 * toLocalRect로 두 rect를 같은 회전 이전 좌표계로 되돌린 뒤 넘긴다.
 */
function measureEmbossContentFrac(posterEl: Element, rotated: boolean): EmbossContentFrac | null {
  const img = posterEl.querySelector('img[data-role="poster"]:not([data-poster-bg])') as HTMLImageElement | null;
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const rootR = posterEl.getBoundingClientRect();
  const imgR = img.getBoundingClientRect();
  if (rootR.width <= 0 || rootR.height <= 0 || imgR.height <= 0) return null;
  const natAspect = img.naturalWidth / img.naturalHeight;
  const fit = img.style.objectFit === 'cover' ? 'cover' : 'contain';
  const [posX, posY] = parseObjectPosition(img.style.objectPosition || '');
  if (!rotated) {
    return posterContentFrac(rootR.width, rootR.height, imgR.top - rootR.top, imgR.height, natAspect, fit, posX, posY);
  }
  const pivotCx = rootR.left + rootR.width / 2;
  const pivotCy = rootR.top + rootR.height / 2;
  const rootLocal = toLocalRect(pivotCx, pivotCy, rootR);
  const imgLocal = toLocalRect(pivotCx, pivotCy, imgR);
  return posterContentFrac(rootLocal.width, rootLocal.height, imgLocal.top - rootLocal.top, imgLocal.height, natAspect, fit, posX, posY);
}

/** 포스터의 실제 <img>(자연 픽셀) 엘리먼트 — measureEmbossContentFrac과 같은 쿼리, 그라디언트 맵 굽기용. */
function getPosterImg(posterEl: Element): HTMLImageElement | null {
  return posterEl.querySelector('img[data-role="poster"]:not([data-poster-bg])') as HTMLImageElement | null;
}

/**
 * 형압(#509) 1단계 브러시 + 2단계 자석 올가미(c10) — 포스터 위 포인터 드래그를 해석한다.
 * `position:fixed`지만 전체 화면이 아니라 **포스터 rect에 맞춰 매 프레임 재배치**하는 레이어다 —
 * 포스터가 무드마다 다른 위치·크기(풀블리드 vs Stub/Criterion 도판)에 있어도 DOM 트리 삽입 지점과
 * 무관하게 항상 올바르게 겹친다. 전체 화면으로 덮으면 헤더·dock·자기 종료 버튼까지 z-index로
 * 가려 클릭이 전부 안 먹힌다(실측으로 확인된 회귀 — `document.elementFromPoint`가 세 버튼 자리
 * 전부에서 이 레이어를 돌려줬다) — 포스터 rect 밖은 아예 안 덮는 게 고침이다. 드래그가 포스터
 * 밖으로 나가도 `setPointerCapture`가 이후 move/up을 이 엘리먼트로 계속 보내주므로(브라우저 표준
 * Pointer Capture 동작, 엘리먼트 크기와 무관) 좌표 변환·스트로크 추적은 안 끊긴다.
 * 두 도구 모두 포스터 자연 픽셀 0..1 분율(c7)로 결과를 내보내 material/coating과 같은 좌표계를 쓴다.
 */
export default function EmbossBrushLayer({
  getPosterEl,
  tool,
  brushRadius,
  onStamp,
  onPath,
  isMax,
  rotated,
}: EmbossBrushLayerProps) {
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);
  const [rect, setRect] = useState<Rect | null>(null);

  // 올가미 트레이스 상태 — lassoPointsRef(자연 분율)가 커밋 시 onPath로 나가는 원본이고,
  // previewPoints(박스 분율 %, React state)는 실시간 시각 피드백(포토샵 자석 올가미처럼 트레이스
  // 선이 보임)을 위한 렌더 트리거다. 스트로크마다 새로 굽는 그라디언트 맵은 gradMapRef에 캐시한다
  // (같은 스트로크 안에서는 이미지가 안 바뀌므로 pointermove마다 다시 구울 이유가 없다).
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const gradMapRef = useRef<GradientMap | null>(null);
  const [previewPoints, setPreviewPoints] = useState<{ x: number; y: number }[]>([]);

  // getPosterEl은 호출부(MobileEditorShell)가 매 렌더 새로 만드는 인라인 클로저라 참조가 매번
  // 바뀐다 — 아래 rAF 이펙트의 deps에 그대로 두면 이 셸처럼 자주 리렌더되는 부모 아래에서
  // 이펙트가 매번 cleanup→재시작을 반복해, rAF 스케줄이 취소·재예약되는 헛수고가 쌓인다.
  // ref로 최신 함수만 갈아끼우고 이펙트 자체는 마운트 1회만 돌게 분리한다.
  const getPosterElRef = useRef(getPosterEl);
  getPosterElRef.current = getPosterEl;

  // 레이어를 포스터 rect에 실시간으로 맞춘다(fresh-context 리뷰 지적 — 실측으로 확인된 blocking
  // 버그). 예전엔 position:fixed inset:0 전체화면이라 헤더·dock·자기 종료 버튼까지 z-index로
  // 덮어 클릭이 하나도 안 먹혔다(`document.elementFromPoint`로 실측: 세 버튼 자리 전부 이 레이어가
  // 잡혔다). 레이어를 포스터 rect로 좁히면 그 밖 UI는 애초에 안 덮여 정상 히트테스트된다.
  //
  // PhoneFrame의 `left/top`는 뷰포트가 아니라 **프레임 원점 기준**이다(PhoneFrame.tsx 주석 —
  // `contain: paint`가 `position: fixed`의 컨테이닝 블록을 프레임으로 바꾼다). `getBoundingClientRect`는
  // 항상 뷰포트 기준이라 그 값을 그대로 style.left/top에 꽂으면 데스크톱(프레임이 뷰포트 중앙에
  // 뜬 상태)에서 프레임 폭만큼 오른쪽으로 밀린다(실측: 700px) — getFrameRect()로 프레임 원점을
  // 빼야 한다. 플로팅 툴바가 이미 같은 이유로 쓰는 패턴(PhoneFrame.tsx getFrameRect 주석). 모바일은
  // 프레임=뷰포트라 프레임 원점이 (0,0)이므로 이 보정이 항등이다(회귀 없음). 수정 후
  // `document.elementFromPoint`로 재실측: 브러시 rect가 포스터 rect와 일치하고, 종료 버튼·헤더
  // 좌표가 더는 이 레이어에 안 잡힌다.
  //
  // rAF로 매 프레임 재측정하는 이유 — rect가 움직이는 경로가 여러 개다(dock 패널 펼침
  // 트랜지션 300ms, 무드 전환, 스크롤). 포스터 "자기 크기"는 안 변해도 dock 높이 변화로
  // 위치만 밀릴 수 있어 ResizeObserver 하나로는 못 잡는다. 편집 모드가 켜져 있는 동안만 도는
  // 루프라 상시 비용이 아니다 — 언마운트(모드 종료)와 함께 멎는다.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const poster = getPosterElRef.current();
      const pr = poster?.getBoundingClientRect() ?? null;
      const r = pr
        ? (() => {
            const frame = getFrameRect();
            return { left: pr.left - frame.left, top: pr.top - frame.top, width: pr.width, height: pr.height };
          })()
        : null;
      setRect((prev) => {
        if (!r) return prev === null ? prev : null;
        if (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height) {
          return prev;
        }
        return r;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** 클라이언트 좌표 → 포스터 자연 이미지 0..1 분율(반경 없이). 브러시·올가미 공용 1차 변환. */
  const clientToNaturalFrac = useCallback(
    (clientX: number, clientY: number): { x: number; y: number; cf: EmbossContentFrac } | null => {
      const poster = getPosterEl();
      if (!poster) return null;
      const r = poster.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const u = (clientX - r.left) / r.width;
      const v = (clientY - r.top) / r.height;
      // 그리기 가능 영역은 포스터 root 박스 전체(레터박스 포함) — 기존 UX와 동일.
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      // 회전 가로 무드(#729 c5) — getBoundingClientRect는 회전된 요소의 축정렬 bbox를 주므로
      // 화면 x/y가 로컬 x/y와 90도 어긋난다. rotate(90deg) 시계방향의 역변환: 로컬 x = 화면 y,
      // 로컬 y = 1 - 화면 x (중심 기준 회전행렬 (x,y)→(-y,x)에서 역산, #729 실측으로 방향 확인).
      const boxX = rotated ? v : u;
      const boxY = rotated ? 1 - u : v;
      const cf = measureEmbossContentFrac(poster, rotated);
      if (!cf || cf.fw <= 0 || cf.fh <= 0) return null; // 이미지 아직 안 뜬 상태 — 보류
      return { x: (boxX - cf.fx) / cf.fw, y: (boxY - cf.fy) / cf.fh, cf };
    },
    [getPosterEl, rotated],
  );

  const clientToStamp = useCallback(
    (clientX: number, clientY: number): EmbossStamp | null => {
      const nat = clientToNaturalFrac(clientX, clientY);
      if (!nat) return null;
      return { x: nat.x, y: nat.y, r: brushRadius / nat.cf.fw };
    },
    [clientToNaturalFrac, brushRadius],
  );

  const paint = useCallback(
    (clientX: number, clientY: number) => {
      const stamp = clientToStamp(clientX, clientY);
      if (!stamp) return;
      const last = lastPointRef.current;
      // 간격 판정도 stamp와 같은 자연 분율 단위로(stamp.r는 이미 그 스케일로 변환된 값) — box
      // 분율 기준 브러시 반경(brushRadius)을 그대로 쓰면 cover 크롭처럼 자연 이미지가 박스보다
      // 크게 표시되는 경우 두 좌표계의 스케일이 달라 간격 판정이 어긋난다.
      if (last && Math.hypot(stamp.x - last.x, stamp.y - last.y) < stamp.r * MIN_STAMP_SPACING) return;
      // lastPointRef가 null이면 이 스트로크의 첫 스탬프 — embossBitmapSvg가 이걸로 앞(이전
      // 스트로크 마지막) 스탬프와 선으로 잇지 않게 게이트한다(#509 실측: 안 그르면 스트로크
      // 사이에 원치 않는 연결선이 남는다).
      const newStroke = last === null;
      lastPointRef.current = { x: stamp.x, y: stamp.y };
      onStamp({ ...stamp, newStroke });
    },
    [clientToStamp, onStamp],
  );

  /** 올가미 정점 하나를 엣지-스냅해 추가한다 — 자연 분율(커밋용)과 박스 분율(미리보기용) 둘 다 갱신. */
  const lassoAppend = useCallback(
    (clientX: number, clientY: number) => {
      const nat = clientToNaturalFrac(clientX, clientY);
      if (!nat) return;
      const map = gradMapRef.current;
      let snapped = { x: nat.x, y: nat.y };
      if (map) {
        const s = snapToEdge(map, nat.x * map.width, nat.y * map.height, LASSO_SNAP_RADIUS_PX);
        snapped = { x: s.x / map.width, y: s.y / map.height };
      }
      const last = lassoPointsRef.current[lassoPointsRef.current.length - 1];
      if (last && Math.hypot(snapped.x - last.x, snapped.y - last.y) < MIN_LASSO_SPACING) return;
      lassoPointsRef.current = [...lassoPointsRef.current, snapped];
      // 미리보기 SVG는 이 레이어 자신의(화면 방향) 박스에 viewBox 0 0 100 100으로 얹힌다 —
      // 로컬(자연) 분율이 아니라 화면 분율이 필요하므로, 회전 무드에선 clientToNaturalFrac의
      // 역변환을 한 번 더 거친다(#729 c5, 위 boxX/boxY 주석과 대칭).
      const localBoxX = nat.cf.fx + snapped.x * nat.cf.fw;
      const localBoxY = nat.cf.fy + snapped.y * nat.cf.fh;
      const screenX = (rotated ? 1 - localBoxY : localBoxX) * 100;
      const screenY = (rotated ? localBoxX : localBoxY) * 100;
      setPreviewPoints((prev) => [...prev, { x: screenX, y: screenY }]);
    },
    [clientToNaturalFrac, rotated],
  );

  const resetLasso = useCallback(() => {
    lassoPointsRef.current = [];
    gradMapRef.current = null;
    setPreviewPoints([]);
  }, []);

  // 포스터를 못 찾았으면(마운트 전 첫 프레임·포스터 없음) 아무것도 안 그린다 — 크기 0인
  // 레이어를 fixed로 띄워봐야 클릭을 가로챌 일만 남는다.
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  // 온-티켓 편집은 포인터 전용이라는 이 저장소의 기존 입장(_shared.tsx FieldTap/posterTapProps
  // 주석)과 동일 — 브러시·올가미 둘 다 연속 좌표가 본질이라 키보드 대응 조작이 없다.
  return (
    <div
      aria-hidden="true"
      data-emboss-brush-layer="true"
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        // max 스테이지가 z-50이라(MobileEditorShell.tsx) max에서는 그 위(51)로 올려야 포스터
        // 탭이 이 레이어에 먼저 닿는다(#729 c2) — 기본 모드는 필드 드로어(z-50)를 안 가리려고 45 유지.
        zIndex: isMax ? 51 : 45,
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        paintingRef.current = true;
        if (tool === 'brush') {
          lastPointRef.current = null;
          paint(e.clientX, e.clientY);
        } else {
          resetLasso();
          const poster = getPosterEl();
          const img = poster && getPosterImg(poster);
          // 그라디언트 맵을 스트로크 시작 시점에 1회 굽는다 — CORS 오염 등으로 못 구우면(null)
          // lassoAppend가 스냅 없이 원좌표 그대로 트레이스한다(엣지-스냅은 향상 기능, 필수 아님).
          gradMapRef.current = img ? buildLassoGradientMap(img) : null;
          lassoAppend(e.clientX, e.clientY);
        }
      }}
      onPointerMove={(e) => {
        if (!paintingRef.current) return;
        if (tool === 'brush') paint(e.clientX, e.clientY);
        else lassoAppend(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        paintingRef.current = false;
        if (tool === 'brush') {
          lastPointRef.current = null;
        } else {
          // 3점 미만이면 다각형이 아니다(면적 없는 클릭·짧은 드래그) — 조용히 버린다.
          if (lassoPointsRef.current.length >= 3) onPath({ points: lassoPointsRef.current });
          resetLasso();
        }
      }}
      onPointerCancel={() => {
        paintingRef.current = false;
        lastPointRef.current = null;
        if (tool === 'lasso') resetLasso();
      }}
    >
      {tool === 'lasso' && previewPoints.length > 0 && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <polyline
            points={previewPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* 시작점 표시 — 포토샵처럼 여기로 돌아오면 닫힌다는 시각 힌트. 실제 닫힘 판정은
              포인터업 시점의 점 개수(>=3)로만 하고, 시작점 근접 클릭을 별도로 요구하진 않는다
              (드래그 종료 = 닫기가 이 레이어의 유일한 계약이라 더 단순하다). */}
          <circle cx={previewPoints[0].x} cy={previewPoints[0].y} r={1.4} fill="#fff" />
        </svg>
      )}
    </div>
  );
}
