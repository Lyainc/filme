import type { LayoutId } from '@/types';

export type Orientation = 'portrait' | 'landscape';

export interface LayoutSpec {
  id: LayoutId;
  label: string;
  caption: string;
  width: number;
  height: number;
  /** 캔버스(티켓 전체) 방향. 포스터 슬롯 방향과 **다른 축**이다 — 아래 posterOrientation 참고. */
  orientation: Orientation;
  /**
   * 포스터 슬롯 방향(#529) — 크롭 프리셋이 이걸 따른다(세로 2:3 / 가로 3:2, #525 룰 1).
   * `orientation`으로 대신하면 안 된다: editorial은 캔버스가 가로여도 포스터 컬럼이
   * 640×960(0.667)이라 세로이고, 거꾸로 stub은 캔버스가 세로인데 포스터 밴드가 960×640(3:2)이라
   * 가로다. 가로 슬롯은 35mm Wide의 포스터 컷(926×617)과 stub 밴드 둘.
   * 필수 필드라 무드를 추가하면 컴파일러가 이 판단을 강제한다 — 캔버스가 아니라 그 무드의
   * **포스터 프레임**이 3:2인지 보고 적을 것.
   */
  posterOrientation: Orientation;
}

export const LAYOUTS: readonly LayoutSpec[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    caption: '미니멀 시네마틱',
    width: 960,
    height: 1534,
    orientation: 'portrait',
    posterOrientation: 'portrait',
  },
  {
    id: 'criterion',
    label: 'Criterion',
    caption: '크라이테리언 임프린트',
    width: 960,
    height: 1534,
    orientation: 'portrait',
    posterOrientation: 'portrait',
  },
  {
    id: '35mm',
    label: '35mm',
    caption: '35mm 임프린트',
    width: 960,
    height: 1534,
    orientation: 'portrait',
    posterOrientation: 'portrait',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    caption: '에디토리얼 스텁',
    width: 1534,
    height: 960,
    orientation: 'landscape',
    posterOrientation: 'portrait',
  },
  {
    id: 'stub',
    label: 'Stub',
    caption: '티켓 스텁 절취',
    width: 960,
    height: 1534,
    orientation: 'portrait',
    // 캔버스는 세로인데 포스터 슬롯은 가로다 — 상단 밴드가 960×640(3:2)이라(#527 오너 확정)
    // 가로 크롭이 풀블리드로 들어간다. orientation과 갈리는 두 번째 사례(editorial의 반대 방향).
    posterOrientation: 'landscape',
  },
  {
    id: '35mm-landscape',
    label: '35mm Wide',
    caption: '35mm 가로 필름',
    width: 1534,
    height: 960,
    orientation: 'landscape',
    // 6무드 중 유일하게 포스터 슬롯이 가로다 — 포스터 컷 926×617(3:2).
    posterOrientation: 'landscape',
  },
] as const;

export function getLayout(id: LayoutId): LayoutSpec {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
