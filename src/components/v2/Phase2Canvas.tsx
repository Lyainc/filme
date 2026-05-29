import LayoutPicker from '@/components/LayoutPicker';
import TheaterChainPicker from '@/components/wizard/TheaterChainPicker';
import FormatPicker from '@/components/wizard/FormatPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import ColorPicker from '@/components/wizard/ColorPicker';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { LayoutId, TicketField } from '@/types';

const FIELD_LABELS: Record<TicketField, string> = {
  title: '제목',
  titleOg: '원제',
  actors: '출연',
  watchDate: '관람일',
  watchTime: '관람 시간',
  theater: '극장',
  screen: '상영관',
  seat: '좌석',
  runtime: '러닝타임',
  rating: '평점',
  releaseDate: '개봉일',
  reissue: '재개봉',
  bookingNo: '예매 번호',
  edition: '에디션',
};

const FIELD_ORDER: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime',
  'theater', 'screen', 'seat', 'runtime', 'rating',
  'releaseDate', 'reissue', 'bookingNo', 'edition',
];

interface Phase2CanvasProps {
  photo: ReturnType<typeof usePhototicket>;
  onGoBack?: () => void;
}

export function Phase2Canvas({ photo, onGoBack }: Phase2CanvasProps) {
  const { components, recommendedColors, fieldVisibility } = photo.state;
  const setComp = photo.updateComponents;
  const setField = photo.updateFieldVisibility;

  const allOn = FIELD_ORDER.every((f) => fieldVisibility[f]);
  const allOff = FIELD_ORDER.every((f) => !fieldVisibility[f]);
  const selectedCount = FIELD_ORDER.filter((f) => fieldVisibility[f]).length;

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

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="space-y-1">
            <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Display Fields</h3>
            <p className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
              {selectedCount}/{FIELD_ORDER.length} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setField(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])) as Record<TicketField, boolean>)}
              disabled={allOn}
              className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface-elevated px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={() => setField(Object.fromEntries(FIELD_ORDER.map((f) => [f, false])) as Record<TicketField, boolean>)}
              disabled={allOff}
              className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface-elevated px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
            >
              전체 해제
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FIELD_ORDER.map((field) => {
            const active = fieldVisibility[field];
            return (
              <button
                key={field}
                type="button"
                onClick={() => setField({ [field]: !active })}
                aria-pressed={active}
                data-touch="44"
                className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors focus-visible:ring-2 focus-visible:ring-accent-soft
                  ${active ? 'border-accent bg-accent text-white' : 'border-line bg-surface-elevated text-fg-muted hover:bg-accent-soft'}`}
              >
                {FIELD_LABELS[field]}
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}
