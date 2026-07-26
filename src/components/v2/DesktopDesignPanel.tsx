import { useId, type ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';
import { RAIL_ITEMS, filterItemsForMood, type RailItem } from './designRailItems';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 데스크톱 DESIGN 패널(#228): 모바일 DesignRail은 가로 rail로 한 번에 한 축만 펼쳐 380px 세로
// 인스펙터를 낭비한다. 데스크톱은 무드·컬러·후보정·투명도·크기 5섹션을 세로 스택으로 상시
// 노출한다. 항목 정의(라벨·eyebrow·본문)는 #523에서 ./designRailItems.tsx 공용 목록으로
// 이관 — 이 파일은 배치(상시 노출 세로 스택)만 담당한다.
// #523 AC2 — DesignRail(모바일)과 같은 filterItemsForMood를 걸어, appliesTo로 숨는 항목이
// 두 화면에 자동 반영되게 한다(/simplify altitude 지적 — 실사용 5항목은 appliesTo 미설정이라
// 오늘은 no-op, 첫 실사용 항목이 생겼을 때 모바일만 숨고 데스크톱은 계속 그리는 비대칭 방지).
// 열림 state가 없는 상시 스택이라 DesignRail의 자동 닫힘 로직은 여기 대응물이 필요 없다.
// items prop은 DesignRail과 동일한 이유로 열어둔다(기본값 RAIL_ITEMS) — 합성 항목으로 이
// 배선 자체를 검증하는 상호작용 테스트가 주입할 수 있게(claude-review PR #533 P1).

// 각 섹션은 eyebrow를 접근성 이름으로 갖는 region 랜드마크(#229) — <section>+aria-labelledby면
// 이미 region이지만 role을 명시해 testing-library getByRole('region')·SR 노출을 확정한다.
function Section({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <section className="space-y-field" role="region" aria-labelledby={labelId}>
      <Eyebrow as="div" id={labelId} size={11}>
        {eyebrow}
      </Eyebrow>
      {children}
    </section>
  );
}

export function DesktopDesignPanel({
  photo,
  items = RAIL_ITEMS,
  onRecropPoster,
}: {
  photo: ReturnType<typeof usePhototicket>;
  items?: readonly RailItem[];
  /** 포스터 재크롭 진입(#492) — DesignRail과 동일 계약(셸이 크롭 파이프라인 소유). */
  onRecropPoster?: () => void;
}) {
  const visibleItems = filterItemsForMood(items, photo.state.components.layout);
  return (
    <div className="space-y-section">
      {visibleItems.map((item) => (
        <Section key={item.id} eyebrow={item.eyebrow}>
          {item.render(photo, 'desktop', { onRecropPoster })}
        </Section>
      ))}
    </div>
  );
}
