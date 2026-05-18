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
          4가지 레이아웃 중 하나를 선택하고, 극장 · 포맷 · 텍스처를 칩으로 골라요.
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
          onChange={(chain) => setComp({ chain })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Format</h3>
        <FormatPicker
          value={components.format}
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

      <section className="space-y-5 rounded-card border border-border bg-surface-elevated p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Finish</h3>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="finish-vignette" className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Vignette
            </label>
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">
              {Math.round(components.vignette * 100)}%
            </span>
          </div>
          <input
            id="finish-vignette"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={components.vignette}
            onChange={(e) => setComp({ vignette: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="finish-temperature" className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Temperature
            </label>
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">
              {components.temperature === 0
                ? '—'
                : components.temperature > 0
                ? `Warm ${Math.round(components.temperature * 100)}%`
                : `Cool ${Math.round(-components.temperature * 100)}%`}
            </span>
          </div>
          <input
            id="finish-temperature"
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={components.temperature}
            onChange={(e) => setComp({ temperature: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="finish-grain" className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Grain
            </label>
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">
              {Math.round(components.grain * 100)}%
            </span>
          </div>
          <input
            id="finish-grain"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={components.grain}
            onChange={(e) => setComp({ grain: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      </section>
    </div>
  );
}
