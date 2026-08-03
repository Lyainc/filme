import { useCallback, useEffect, useRef, useState } from 'react';
import { getFrameRect } from '@/components/v2/PhoneFrame';
import type { EmbossStamp } from '@/utils/textureRecipes';

interface EmbossBrushLayerProps {
  /** 포스터 서브트리를 담은 컨테이너에서 [data-poster-root]를 찾아온다. 매 포인터 이벤트·매
   *  rAF 프레임마다 다시 부른다 — 별도 캐시 없이 항상 최신 레이아웃을 읽는다(무드·크롭 전환에도 안전). */
  getPosterEl: () => Element | null;
  /** 포스터 폭 기준 분율 반경(#509 c7과 동일 좌표계). */
  brushRadius: number;
  onStamp: (stamp: EmbossStamp) => void;
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

/**
 * 형압(#509) 1단계 브러시 — 포스터 위 포인터 드래그로 원형 스탬프를 찍는다. `position:fixed`지만
 * 전체 화면이 아니라 **포스터 rect에 맞춰 매 프레임 재배치**하는 레이어다 — 포스터가 무드마다
 * 다른 위치·크기(풀블리드 vs Stub/Criterion 도판)에 있어도 DOM 트리 삽입 지점과 무관하게 항상
 * 올바르게 겹친다. 전체 화면으로 덮으면 헤더·dock·자기 종료 버튼까지 z-index로 가려 클릭이
 * 전부 안 먹는다(실측으로 확인된 회귀 — `document.elementFromPoint`가 세 버튼 자리 전부에서
 * 이 레이어를 돌려줬다) — 포스터 rect 밖은 아예 안 덮는 게 고침이다. 드래그가 포스터 밖으로
 * 나가도 `setPointerCapture`가 이후 move/up을 이 엘리먼트로 계속 보내주므로(브라우저 표준
 * Pointer Capture 동작, 엘리먼트 크기와 무관) 좌표 변환·스트로크 추적은 안 끊긴다.
 * 포스터 자연 픽셀 0..1 분율(c7)로 스탬프를 내보내 material/coating과 같은 좌표계를 쓴다.
 */
export default function EmbossBrushLayer({ getPosterEl, brushRadius, onStamp }: EmbossBrushLayerProps) {
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);
  const [rect, setRect] = useState<Rect | null>(null);

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

  const clientToStamp = useCallback(
    (clientX: number, clientY: number): EmbossStamp | null => {
      const poster = getPosterEl();
      if (!poster) return null;
      const r = poster.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { x, y, r: brushRadius };
    },
    [getPosterEl, brushRadius],
  );

  const paint = useCallback(
    (clientX: number, clientY: number) => {
      const stamp = clientToStamp(clientX, clientY);
      if (!stamp) return;
      const last = lastPointRef.current;
      if (last && Math.hypot(stamp.x - last.x, stamp.y - last.y) < brushRadius * MIN_STAMP_SPACING) return;
      // lastPointRef가 null이면 이 스트로크의 첫 스탬프 — embossBitmapSvg가 이걸로 앞(이전
      // 스트로크 마지막) 스탬프와 선으로 잇지 않게 게이트한다(#509 실측: 안 그르면 스트로크
      // 사이에 원치 않는 연결선이 남는다).
      const newStroke = last === null;
      lastPointRef.current = { x: stamp.x, y: stamp.y };
      onStamp({ ...stamp, newStroke });
    },
    [clientToStamp, onStamp, brushRadius],
  );

  // 포스터를 못 찾았으면(마운트 전 첫 프레임·포스터 없음) 아무것도 안 그린다 — 크기 0인
  // 레이어를 fixed로 띄워봐야 클릭을 가로챌 일만 남는다.
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  // 온-티켓 편집은 포인터 전용이라는 이 저장소의 기존 입장(_shared.tsx FieldTap/posterTapProps
  // 주석)과 동일 — 브러시는 연속 좌표가 본질이라 키보드 대응 조작이 없다.
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
        zIndex: 45,
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        paintingRef.current = true;
        lastPointRef.current = null;
        paint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!paintingRef.current) return;
        paint(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        paintingRef.current = false;
        lastPointRef.current = null;
      }}
      onPointerCancel={() => {
        paintingRef.current = false;
        lastPointRef.current = null;
      }}
    />
  );
}
