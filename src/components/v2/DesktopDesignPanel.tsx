import { useId, type ReactNode } from 'react';
import LayoutPicker from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 데스크톱 DESIGN 패널(#228): 모바일 DesignRail은 가로 rail로 한 번에 한 축만 펼쳐 380px 세로
// 인스펙터를 낭비한다. 데스크톱은 무드·컬러·후보정·투명도 4섹션을 세로 스택으로 상시 노출한다.
// 로직·와이어링은 DesignRail과 동일 피커 재사용 — 배치만 바꾼다. 무드·후보정·컬러는 다듬은 섹션,
// 투명도만 기능만(정식 섹션 라벨·% 표기는 #230).

// 각 섹션은 eyebrow를 접근성 이름으로 갖는 region 랜드마크(#229) — <section>+aria-labelledby면
// 이미 region이지만 role을 명시해 testing-library getByRole('region')·SR 노출을 확정한다.
function Section({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <section className="space-y-2.5" role="region" aria-labelledby={labelId}>
      <div id={labelId} className="text-mono text-[11px] uppercase tracking-widest text-fg-muted">
        {eyebrow}
      </div>
      {children}
    </section>
  );
}

export function DesktopDesignPanel({ photo }: { photo: ReturnType<typeof usePhototicket> }) {
  const { components, croppedImageUrl, recommendedColors } = photo.state;
  const setComp = photo.updateComponents;

  return (
    <div className="space-y-6">
      <Section eyebrow="무드">
        <LayoutPicker value={components.layout} onChange={(id: LayoutId) => setComp({ layout: id })} />
      </Section>

      <Section eyebrow="후보정">
        <TexturePicker
          value={components.texture}
          onChange={(texture) => setComp({ texture })}
          croppedImageUrl={croppedImageUrl}
        />
      </Section>

      {/* 컬러·잉크(#229) — 잉크는 별도 상태 축 없이 단일 themeColor. White↔Black 프리셋이 곧
          라이트/다크 잉크 원터치, 추천 추출색·커스텀 hex는 포인트 컬러. 35mm는 톤 고정이라 disabled. */}
      <Section eyebrow="컬러">
        <ColorPicker
          value={components.themeColor}
          onChange={(themeColor) => setComp({ themeColor })}
          recommended={recommendedColors}
          disabled={components.layout === '35mm'}
          disabledNote="35mm 무드는 필름 톤(크림·먹색)이 고정이라 잉크 색을 바꿀 수 없어요."
        />
      </Section>

      {/* 투명도 — #228은 기능만. 정식 섹션 라벨·% 표기는 #230. 듀얼 슬라이더(포스터·컴포넌트). */}
      <div className="space-y-4">
        <BrightnessSlider
          label="포스터"
          id="desktop-poster-opacity"
          value={components.posterOpacity}
          onChange={(posterOpacity) => setComp({ posterOpacity })}
        />
        <BrightnessSlider
          label="컴포넌트"
          id="desktop-component-opacity"
          value={components.componentOpacity ?? 1}
          onChange={(componentOpacity) => setComp({ componentOpacity })}
        />
      </div>
    </div>
  );
}
