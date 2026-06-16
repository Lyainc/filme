import { useState, useRef } from 'react';
import ImageUploader from '@/components/ImageUploader';
import MovieInfoForm from '@/components/MovieInfoForm';
import Field from '@/components/ui/Field';
import OptionalDetailsAccordion from '@/components/wizard/OptionalDetailsAccordion';
import RatingPicker from '@/components/wizard/RatingPicker';
import LayoutPicker from '@/components/LayoutPicker';
import TheaterChainPicker from '@/components/wizard/TheaterChainPicker';
import FormatPicker from '@/components/wizard/FormatPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import ColorPicker from '@/components/wizard/ColorPicker';
import { OcrUploadCard } from './OcrUploadCard';
import type { OcrDirectField } from './OcrUploadCard';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { formatDate } from '@/utils/dateFormat';
import type { DateFormatToken, TicketField, MovieInfo, LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

interface EditorCanvasProps {
  photo: ReturnType<typeof usePhototicket>;
  onPendingFetchChange: (pending: boolean) => void;
}

const WATCH_FORMAT_TOKENS: { value: DateFormatToken; sample: string }[] = [
  { value: 'iso', sample: '2026-05-12' },
  { value: 'kr-compact', sample: '2026.05.12' },
  { value: 'cinema-mono', sample: '12·MAY·2026' },
  { value: 'en-long', sample: 'May 12, 2026' },
];

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
};

const FIELD_ORDER: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime',
  'theater', 'screen', 'seat', 'runtime', 'rating',
  'releaseDate', 'reissue', 'bookingNo',
];

function OcrChip() {
  return (
    <span className="text-mono text-[8px] uppercase tracking-wider bg-accent-soft text-accent px-1.5 py-0.5 rounded-chip leading-none">
      OCR
    </span>
  );
}

export function EditorCanvas({ photo, onPendingFetchChange }: EditorCanvasProps) {
  const { movieInfo, fieldVisibility, components, recommendedColors } = photo.state;
  const setInfo = photo.updateMovieInfo;
  const setField = photo.updateFieldVisibility;
  const setComp = photo.updateComponents;
  const watchToken = movieInfo.watchDateFormat || 'kr-compact';

  // 인라인 표시여부 체크박스 prop 빌더(#116) — 반복 제거. dim 래퍼 바깥(라벨 행)에 둘 것.
  const visProps = (field: TicketField) => ({
    checked: fieldVisibility[field],
    onChange: (v: boolean) => setField({ [field]: v }),
    label: FIELD_LABELS[field],
  });

  const allOn = FIELD_ORDER.every((f) => fieldVisibility[f]);
  const allOff = FIELD_ORDER.every((f) => !fieldVisibility[f]);
  const selectedCount = FIELD_ORDER.filter((f) => fieldVisibility[f]).length;

  // Tracks which fields were last filled by OCR. Cleared field-by-field on user edit.
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<OcrDirectField>>(new Set());
  const [ocrSnapshot, setOcrSnapshot] = useState<Partial<MovieInfo> | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const accordionRef = useRef<HTMLDivElement>(null);
  // Incremented on cancel (undo) to invalidate any in-flight KOBIS fetch so it
  // can't re-populate the form after revert. NOT bumped on confirm: confirm
  // accepts the OCR injection, and KOBIS enrichment (which carries title itself,
  // not just titleOg/releaseDate/actors/runtime) must still be allowed to land.
  const ocrEpochRef = useRef(0);

  function removeFromOcr(key: OcrDirectField) {
    setOcrFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleOcrApply({ keys, prevValues }: { keys: Set<OcrDirectField>; prevValues: Partial<MovieInfo> }) {
    setOcrFilledFields(keys);
    setOcrSnapshot(prevValues);
    setAccordionOpen(true);

    // Smooth scroll into view if offscreen
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  function handleCancelOcr() {
    ocrEpochRef.current++;
    if (ocrSnapshot) {
      setInfo(ocrSnapshot);
    }
    setOcrFilledFields(new Set());
    setOcrSnapshot(null);
  }

  function handleConfirmOcr() {
    setOcrSnapshot(null);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h2 className="font-sans text-2xl font-semibold tracking-tight text-fg">
          티켓 만들기
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          제목 · 원제 · 개봉연도가 필수예요. 포스터부터 무드까지 이 화면에서 한 번에 끝나요.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Poster</h3>
        <div className="grid grid-cols-2 gap-4 items-stretch">
          <ImageUploader
            onUpload={photo.handleImageUpload}
            isProcessing={false}
            hasImage={!!photo.state.croppedImageUrl}
          />
          <OcrUploadCard
            setInfo={setInfo}
            currentInfo={movieInfo}
            onOcrApply={handleOcrApply}
            setComponents={photo.updateComponents}
            ocrEpochRef={ocrEpochRef}
          />
        </div>
      </section>

      {/* 표시 항목 일괄 컨트롤 — 각 필드 옆 체크박스(인라인)를 전체 제어(#116).
          'Display Fields' 칩 섹션을 대체하고, 입력 그룹 상단에 콤팩트하게 둔다. */}
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface-elevated px-3.5 py-2.5">
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
          표시 항목 <span className="text-fg-faint">{selectedCount}/{FIELD_ORDER.length}</span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setField(Object.fromEntries(FIELD_ORDER.map((f) => [f, true])) as Record<TicketField, boolean>)}
            disabled={allOn}
            className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => setField(Object.fromEntries(FIELD_ORDER.map((f) => [f, false])) as Record<TicketField, boolean>)}
            disabled={allOff}
            className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
          >
            전체 해제
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Film</h3>
        <MovieInfoForm
          movieInfo={movieInfo}
          onChange={setInfo}
          onPendingFetchChange={onPendingFetchChange}
          fieldVisibility={fieldVisibility}
          onFieldVisibilityChange={setField}
        />
      </section>

      <div ref={accordionRef}>
        <OptionalDetailsAccordion open={accordionOpen} onOpenChange={setAccordionOpen}>
          <div className="space-y-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VisibilityCheckbox {...visProps('watchDate')} />
                <label
                  htmlFor="editor-watchDate"
                  className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted"
                >
                  Watched
                </label>
                {ocrFilledFields.has('watchDate') && <OcrChip />}
              </div>
              <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
                {formatDate(movieInfo.watchDate, watchToken, 'date') || '—'}
              </span>
            </div>
            <div className={`space-y-2.5 ${fieldVisibility.watchDate ? '' : 'opacity-40'}`}>
              <input
                id="editor-watchDate"
                type="date"
                value={movieInfo.watchDate || ''}
                disabled={!fieldVisibility.watchDate}
                onChange={(e) => {
                  setInfo({ watchDate: e.target.value });
                  removeFromOcr('watchDate');
                }}
                className="w-full rounded-field border border-line bg-surface-elevated px-3.5 py-3 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed"
              />
              <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Watched 표기">
                {WATCH_FORMAT_TOKENS.map((opt) => {
                  const active = watchToken === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!fieldVisibility.watchDate}
                      onClick={() => setInfo({ watchDateFormat: opt.value })}
                      data-touch="44"
                      className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors disabled:cursor-not-allowed
                        ${active ? 'border-accent bg-accent text-white' : 'border-line bg-surface-elevated text-fg hover:bg-accent-soft'}`}
                    >
                      {opt.sample}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {ocrFilledFields.has('theater') && (
              <div className="flex justify-start"><OcrChip /></div>
            )}
            <Field
              id="editor-theater"
              label="Theater"
              optional
              labelAccessory={<VisibilityCheckbox {...visProps('theater')} />}
              value={movieInfo.theater || ''}
              disabled={!fieldVisibility.theater}
              onChange={(e) => {
                setInfo({ theater: e.target.value });
                removeFromOcr('theater');
              }}
              placeholder="CGV 용산아이파크몰"
            />
          </div>

          <Field
            id="editor-actors"
            label="Cast"
            optional
            labelAccessory={<VisibilityCheckbox {...visProps('actors')} />}
            value={movieInfo.actors || ''}
            disabled={!fieldVisibility.actors}
            onChange={(e) => setInfo({ actors: e.target.value })}
            placeholder="매튜 맥커너히, 앤 해서웨이"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              {ocrFilledFields.has('watchTime') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="editor-watchTime"
                label="Showtime"
                type="time"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('watchTime')} />}
                value={movieInfo.watchTime || ''}
                disabled={!fieldVisibility.watchTime}
                onChange={(e) => {
                  setInfo({ watchTime: e.target.value });
                  removeFromOcr('watchTime');
                }}
              />
            </div>
            <Field
              id="editor-runtime"
              label="Runtime"
              optional
              labelAccessory={<VisibilityCheckbox {...visProps('runtime')} />}
              value={movieInfo.runtime || ''}
              disabled={!fieldVisibility.runtime}
              onChange={(e) => setInfo({ runtime: e.target.value })}
              placeholder="150 MIN"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              {ocrFilledFields.has('screen') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="editor-screen"
                label="Screen"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('screen')} />}
                value={movieInfo.screen || ''}
                disabled={!fieldVisibility.screen}
                onChange={(e) => {
                  setInfo({ screen: e.target.value });
                  removeFromOcr('screen');
                }}
                placeholder="IMAX관"
              />
            </div>
            <div className="space-y-1">
              {ocrFilledFields.has('seat') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="editor-seat"
                label="Seat"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('seat')} />}
                value={movieInfo.seat || ''}
                disabled={!fieldVisibility.seat}
                onChange={(e) => {
                  setInfo({ seat: e.target.value });
                  removeFromOcr('seat');
                }}
                placeholder="G14, G15"
              />
            </div>
          </div>

          <div className="space-y-1">
            {ocrFilledFields.has('bookingNumber') && (
              <div className="flex justify-start"><OcrChip /></div>
            )}
            <Field
              id="editor-bookingNumber"
              label="Booking No."
              optional
              labelAccessory={<VisibilityCheckbox {...visProps('bookingNo')} />}
              value={movieInfo.bookingNumber || ''}
              disabled={!fieldVisibility.bookingNo}
              onChange={(e) => {
                setInfo({ bookingNumber: e.target.value });
                removeFromOcr('bookingNumber');
              }}
              placeholder="T-20260510-0014"
            />
          </div>

          <RatingPicker
            value={movieInfo.rating}
            onValueChange={(rating) => setInfo({ rating })}
            visible={fieldVisibility.rating}
            onVisibleChange={(v) => setField({ rating: v })}
          />
          </div>
        </OptionalDetailsAccordion>
      </div>

      {/* 정보 입력 ↔ 티켓 디자인 영역 경계 — 단일 스크롤에서 스캔을 돕는 시각 구분 */}
      <div className="flex items-center gap-3 pt-2" aria-hidden="true">
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">Ticket Design</span>
        <div className="h-px flex-1 bg-line" />
      </div>

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

      {/* OCR Result Banner — floats above MobileDock on mobile, above viewport bottom on desktop.
          dock 실제 높이(--mobile-dock-h, MobileDock이 측정해 노출)에 12px 띄워 앵커한다 —
          hint 유무로 dock 높이가 변해도 항상 dock 위에 뜬다(매직넘버 제거, #102/#97).
          var 미설정(측정 전 한 틱) 시 96px fallback. 데스크톱은 dock이 없어 sm:bottom-6로 덮어쓴다. */}
      {ocrSnapshot && (
        <div className="fixed bottom-[calc(var(--mobile-dock-h,_96px)_+_12px)] sm:bottom-6 left-1/2 -translate-x-1/2 bg-surface-elevated border border-accent rounded-card shadow-lg p-3 z-50 flex items-center gap-4 w-[90%] max-w-sm animate-slide-up">
          <p className="text-[13px] text-fg flex-1">
            {ocrFilledFields.size > 0
              ? `${ocrFilledFields.size}개 항목이 자동 입력되었어요.`
              : '영화 정보를 자동으로 불러왔어요.'}
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelOcr}
              className="text-[12px] font-medium text-fg-muted hover:text-fg transition-colors"
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={handleConfirmOcr}
              className="rounded-chip bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Spacer — prevents last section from being hidden behind the OCR banner */}
      {ocrSnapshot && (
        <div className="h-40 sm:h-20" aria-hidden="true" />
      )}
    </div>
  );
}
