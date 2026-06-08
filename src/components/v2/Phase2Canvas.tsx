import LayoutPicker from '@/components/LayoutPicker';
import TheaterChainPicker from '@/components/wizard/TheaterChainPicker';
import FormatPicker from '@/components/wizard/FormatPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import ColorPicker from '@/components/wizard/ColorPicker';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { LayoutId } from '@/types';

interface Phase2CanvasProps {
  photo: ReturnType<typeof usePhototicket>;
  onGoBack?: () => void;
}

export function Phase2Canvas({ photo, onGoBack }: Phase2CanvasProps) {
  const { components, recommendedColors } = photo.state;
  const setComp = photo.updateComponents;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="text-mono inline-flex min-h-[44px] items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
          >
            ← 정보 수정
          </button>
        )}
      </div>

      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent">Phase 2</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg">
          무드와 마감을 골라요.
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          4가지 레이아웃 중 하나를 선택하고, 극장 · 포맷 · 텍스처를 지정해요.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Mood</h3>
        <LayoutPicker
          value={components.layout}
          onChange={(id: LayoutId) => setComp({ layout: id })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Theater</h3>
        <TheaterChainPicker
          value={components.chain}
          visible={components.chainVisible}
          onVisibilityChange={(v) => setComp({ chainVisible: v })}
          onChange={(chain) => setComp({ chain })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Format</h3>
        <FormatPicker
          value={components.format}
          visible={components.formatVisible}
          onVisibilityChange={(v) => setComp({ formatVisible: v })}
          onChange={(format) => setComp({ format })}
          chain={components.chain}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Texture</h3>
        <TexturePicker
          value={components.texture}
          onChange={(texture) => setComp({ texture })}
          croppedImageUrl={photo.state.croppedImageUrl}
        />
      </section>

      <section className="space-y-5 rounded-card border border-border bg-surface-elevated p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <BrightnessSlider
          value={components.posterOpacity}
          onChange={(posterOpacity) => setComp({ posterOpacity })}
        />
        <div className="border-t border-border pt-5">
          <ColorPicker
            value={components.themeColor}
            onChange={(themeColor) => setComp({ themeColor })}
            recommended={recommendedColors}
          />
        </div>
      </section>
    </div>
  );
}
