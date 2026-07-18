import type { LayoutId } from '@/types';

export type Orientation = 'portrait' | 'landscape';

export interface LayoutSpec {
  id: LayoutId;
  label: string;
  caption: string;
  width: number;
  height: number;
  orientation: Orientation;
}

export const LAYOUTS: readonly LayoutSpec[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    caption: '미니멀 시네마틱',
    width: 960,
    height: 1477,
    orientation: 'portrait',
  },
  {
    id: 'criterion',
    label: 'Criterion',
    caption: '크라이테리언 임프린트',
    width: 960,
    height: 1477,
    orientation: 'portrait',
  },
  {
    id: '35mm',
    label: '35mm',
    caption: '35mm 임프린트',
    width: 960,
    height: 1477,
    orientation: 'portrait',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    caption: '에디토리얼 스텁',
    width: 1477,
    height: 960,
    orientation: 'landscape',
  },
  {
    id: 'stub',
    label: 'Stub',
    caption: '티켓 스텁 절취',
    width: 960,
    height: 1477,
    orientation: 'portrait',
  },
  {
    id: '35mm-landscape',
    label: '35mm Wide',
    caption: '35mm 가로 필름',
    width: 1477,
    height: 960,
    orientation: 'landscape',
  },
] as const;

export function getLayout(id: LayoutId): LayoutSpec {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/**
 * 세로 풀블리드 무드(#420) — 포스터 크롭 모달의 "원본 비율 보존" 프리셋이 opt-in으로 뜨는 대상.
 * 가로·분할 무드(editorial/stub/35mm-landscape)는 v1 스코프 밖(#420 채택 방향 4).
 */
export const POSTER_PRESERVE_RATIO_LAYOUTS: ReadonlySet<LayoutId> = new Set<LayoutId>([
  'minimal',
  'criterion',
  '35mm',
]);
