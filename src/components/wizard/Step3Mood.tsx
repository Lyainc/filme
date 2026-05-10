import LayoutPicker from '@/components/LayoutPicker';
import TheaterChainPicker from './TheaterChainPicker';
import FormatPicker from './FormatPicker';
import TexturePicker from './TexturePicker';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { LayoutId } from '@/types';

interface Step3MoodProps {
  photo: ReturnType<typeof usePhototicket>;
}

export default function Step3Mood({ photo }: Step3MoodProps) {
  const { components } = photo.state;
  const setComp = photo.updateComponents;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">[03] Mood</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg md:text-[28px]">
          무드와 마감을 골라요.
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          4가지 레이아웃 중 하나를 선택하고, 극장 · 포맷 · 텍스처를 칩으로 골라요.
        </p>
      </header>

      <LayoutPicker
        value={components.layout}
        onChange={(id: LayoutId) => setComp({ layout: id })}
      />

      <TheaterChainPicker
        value={components.chain}
        onChange={(chain) => setComp({ chain })}
      />

      <FormatPicker
        value={components.format}
        onChange={(format) => setComp({ format })}
      />

      <TexturePicker
        value={components.texture}
        onChange={(texture) => setComp({ texture })}
      />
    </div>
  );
}
