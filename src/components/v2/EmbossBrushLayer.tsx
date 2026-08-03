import { useCallback, useRef } from 'react';
import type { EmbossStamp } from '@/utils/textureRecipes';

interface EmbossBrushLayerProps {
  /** 포스터 서브트리를 담은 컨테이너에서 [data-poster-root]를 찾아온다. 매 포인터 이벤트마다
   *  다시 부른다 — 별도 ResizeObserver 없이 항상 최신 레이아웃을 읽는다(무드·크롭 전환에도 안전). */
  getPosterEl: () => Element | null;
  /** 포스터 폭 기준 분율 반경(#509 c7과 동일 좌표계). */
  brushRadius: number;
  onStamp: (stamp: EmbossStamp) => void;
}

// 스탬프 사이 최소 간격(브러시 반경 기준 분율) — 이걸 안 두면 pointermove 빈도만큼(수십~수백Hz)
// 스탬프가 쌓여 마스크 배열이 금방 비대해진다. 0.3이면 원끼리 충분히 겹쳐 매끈한 선이 되면서도
// 실사용 드래그 한 번이 수십 개 스탬프 수준으로 묶인다.
const MIN_STAMP_SPACING = 0.3;

/**
 * 형압(#509) 1단계 브러시 — 포스터 위 포인터 드래그로 원형 스탬프를 찍는다. `position:fixed`
 * 전체 화면 캡처 레이어라 포스터가 무드마다 다른 위치·크기(풀블리드 vs Stub/Criterion 도판)에
 * 있어도 DOM 트리 삽입 지점과 무관하게 항상 올바르게 겹친다 — 좌표 변환은 매 이벤트마다
 * `getPosterEl().getBoundingClientRect()`를 다시 읽어서 하므로 별도 레이아웃 동기화가 없다.
 * 포스터 자연 픽셀 0..1 분율(c7)로 스탬프를 내보내 material/coating과 같은 좌표계를 쓴다.
 */
export default function EmbossBrushLayer({ getPosterEl, brushRadius, onStamp }: EmbossBrushLayerProps) {
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const paintingRef = useRef(false);

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

  // 온-티켓 편집은 포인터 전용이라는 이 저장소의 기존 입장(_shared.tsx FieldTap/posterTapProps
  // 주석)과 동일 — 브러시는 연속 좌표가 본질이라 키보드 대응 조작이 없다.
  return (
    <div
      aria-hidden="true"
      data-emboss-brush-layer="true"
      style={{ position: 'fixed', inset: 0, zIndex: 45, cursor: 'crosshair', touchAction: 'none' }}
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
