import { getLayout } from '@/utils/layouts';
import BrightnessSlider from './BrightnessSlider';
import ColorPicker from './ColorPicker';
import type { usePhototicket } from '@/hooks/usePhototicket';

interface Step4ExportProps {
  photo: ReturnType<typeof usePhototicket>;
  onDownload: () => void;
  isExporting: boolean;
}

export default function Step4Export({ photo, onDownload, isExporting }: Step4ExportProps) {
  const layout = getLayout(photo.state.components.layout);
  const ready = !!photo.state.croppedImageUrl;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">[04] Export</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg md:text-[28px]">
          마감과 다운로드.
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          {layout.label} · {layout.width}×{layout.height}px JPEG로 내보낼게요.
        </p>
      </header>

      <div className="space-y-5 rounded-card border hairline bg-paper p-5 shadow-card">
        <BrightnessSlider
          value={photo.state.components.posterOpacity}
          onChange={(posterOpacity) => photo.updateComponents({ posterOpacity })}
        />
        <div className="border-t hairline pt-5">
          <ColorPicker
            value={photo.state.components.themeColor}
            onChange={(themeColor) => photo.updateComponents({ themeColor })}
            recommended={photo.state.recommendedColors}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onDownload}
        disabled={!ready || isExporting}
        data-touch="44"
        className="text-mono inline-flex min-h-btn w-full items-center justify-center gap-2 rounded-field bg-accent px-6 text-[11px] uppercase tracking-widest text-paper transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isExporting ? 'Capturing…' : 'Download JPEG ↓'}
      </button>
    </div>
  );
}
