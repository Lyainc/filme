import type { ReactNode } from 'react';
import LayoutPicker from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 데스크톱 DESIGN 패널(#228): 모바일 DesignRail은 가로 rail로 한 번에 한 축만 펼쳐 380px 세로
// 인스펙터를 낭비한다. 데스크톱은 무드·컬러·후보정·투명도 4섹션을 세로 스택으로 상시 노출한다.
// 로직·와이어링은 DesignRail과 동일 피커 재사용 — 배치만 바꾼다. 무드·후보정은 다듬은 섹션,
// 컬러·투명도는 기능만(정식 섹션 chrome·라벨은 #229/#230).

function Section({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="text-mono text-[11px] uppercase tracking-widest text-fg-muted">{eyebrow}</div>
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

      {/* 컬러 — #228은 기능만. 정식 섹션 chrome·잉크 원터치는 #229. ColorPicker 자체 헤더로 충분.
          잉크는 단일 축(themeColor). 35mm는 톤 고정이라 disabled(DesignRail 계승). */}
      <ColorPicker
        value={components.themeColor}
        onChange={(themeColor) => setComp({ themeColor })}
        recommended={recommendedColors}
        disabled={components.layout === '35mm'}
        disabledNote="35mm 무드는 필름 톤(크림·먹색)이 고정이라 잉크 색을 바꿀 수 없어요."
      />

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
