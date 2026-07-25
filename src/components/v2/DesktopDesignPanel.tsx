import { useId, type ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';
import { RAIL_ITEMS } from './designRailItems';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 데스크톱 DESIGN 패널(#228): 모바일 DesignRail은 가로 rail로 한 번에 한 축만 펼쳐 380px 세로
// 인스펙터를 낭비한다. 데스크톱은 무드·컬러·후보정·투명도·크기 5섹션을 세로 스택으로 상시
// 노출한다. 항목 정의(라벨·eyebrow·본문)는 #523에서 ./designRailItems.tsx 공용 목록으로
// 이관 — 이 파일은 배치(상시 노출 세로 스택)만 담당한다.

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

export function DesktopDesignPanel({ photo }: { photo: ReturnType<typeof usePhototicket> }) {
  return (
    <div className="space-y-section">
      {RAIL_ITEMS.map((item) => (
        <Section key={item.id} eyebrow={item.eyebrow}>
          {item.render(photo, 'desktop')}
        </Section>
      ))}
    </div>
  );
}
