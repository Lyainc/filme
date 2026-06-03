import { useState } from 'react';
import ImageUploader from '@/components/ImageUploader';
import MovieInfoForm from '@/components/MovieInfoForm';
import Field from '@/components/ui/Field';
import OptionalDetailsAccordion from '@/components/wizard/OptionalDetailsAccordion';
import RatingPicker from '@/components/wizard/RatingPicker';
import { OcrUploadCard } from './OcrUploadCard';
import type { OcrDirectField } from './OcrUploadCard';
import { formatDate } from '@/utils/dateFormat';
import type { DateFormatToken, TicketField } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

interface Phase1CanvasProps {
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
  edition: '에디션',
};

const FIELD_ORDER: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime',
  'theater', 'screen', 'seat', 'runtime', 'rating',
  'releaseDate', 'reissue', 'bookingNo', 'edition',
];

// dim/disable a wrapper when its field's visibility toggle is off.
const dim = (on: boolean) => (on ? '' : 'opacity-40 pointer-events-none');

function OcrChip() {
  return (
    <span className="text-mono text-[8px] uppercase tracking-wider bg-accent-soft text-accent px-1.5 py-0.5 rounded-chip leading-none">
      OCR
    </span>
  );
}

export function Phase1Canvas({ photo, onPendingFetchChange }: Phase1CanvasProps) {
  const { movieInfo, fieldVisibility } = photo.state;
  const setInfo = photo.updateMovieInfo;
  const setField = photo.updateFieldVisibility;
  const watchToken = movieInfo.watchDateFormat || 'kr-compact';

  const allOn = FIELD_ORDER.every((f) => fieldVisibility[f]);
  const allOff = FIELD_ORDER.every((f) => !fieldVisibility[f]);
  const selectedCount = FIELD_ORDER.filter((f) => fieldVisibility[f]).length;

  // Tracks which fields were last filled by OCR. Cleared field-by-field on user edit.
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<OcrDirectField>>(new Set());

  function removeFromOcr(key: OcrDirectField) {
    setOcrFilledFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleOcrFill(keys: Set<OcrDirectField>) {
    setOcrFilledFields((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent">Phase 1</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg">
          포스터와 영화 정보
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          제목 · 원제 · 개봉연도가 필수예요. 3가지만 채우면 바로 다음으로 넘어갈 수 있어요.
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Poster</h3>
        <div className="grid grid-cols-2 gap-4">
          <ImageUploader
            onUpload={photo.handleImageUpload}
            isProcessing={false}
            hasImage={!!photo.state.croppedImageUrl}
          />
          <OcrUploadCard
            setInfo={setInfo}
            currentInfo={movieInfo}
            onOcrFill={handleOcrFill}
            setComponents={photo.updateComponents}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Film</h3>
        <MovieInfoForm
          movieInfo={movieInfo}
          onChange={setInfo}
          onPendingFetchChange={onPendingFetchChange}
        />
      </section>

      <OptionalDetailsAccordion>
        <div className="space-y-5">
          <div className={`space-y-2.5 ${dim(fieldVisibility.watchDate)}`}>
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="p1-watchDate"
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
            <input
              id="p1-watchDate"
              type="date"
              value={movieInfo.watchDate || ''}
              disabled={!fieldVisibility.watchDate}
              onChange={(e) => {
                setInfo({ watchDate: e.target.value });
                removeFromOcr('watchDate');
              }}
              className="w-full rounded-field border border-line bg-surface-elevated px-3.5 py-3 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
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
                    className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors
                      ${active ? 'border-accent bg-accent text-white' : 'border-line bg-surface-elevated text-fg hover:bg-accent-soft'}`}
                  >
                    {opt.sample}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`space-y-1 ${dim(fieldVisibility.theater)}`}>
            {ocrFilledFields.has('theater') && (
              <div className="flex justify-start"><OcrChip /></div>
            )}
            <Field
              id="p1-theater"
              label="Theater"
              optional
              value={movieInfo.theater || ''}
              disabled={!fieldVisibility.theater}
              onChange={(e) => {
                setInfo({ theater: e.target.value });
                removeFromOcr('theater');
              }}
              placeholder="CGV 용산아이파크몰"
            />
          </div>

          <div className={dim(fieldVisibility.actors)}>
            <Field
              id="p1-actors"
              label="Cast"
              optional
              value={movieInfo.actors || ''}
              disabled={!fieldVisibility.actors}
              onChange={(e) => setInfo({ actors: e.target.value })}
              placeholder="매튜 맥커너히, 앤 해서웨이"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`space-y-1 ${dim(fieldVisibility.watchTime)}`}>
              {ocrFilledFields.has('watchTime') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="p1-watchTime"
                label="Showtime"
                type="time"
                optional
                value={movieInfo.watchTime || ''}
                disabled={!fieldVisibility.watchTime}
                onChange={(e) => {
                  setInfo({ watchTime: e.target.value });
                  removeFromOcr('watchTime');
                }}
              />
            </div>
            <div className={dim(fieldVisibility.runtime)}>
              <Field
                id="p1-runtime"
                label="Runtime"
                optional
                value={movieInfo.runtime || ''}
                disabled={!fieldVisibility.runtime}
                onChange={(e) => setInfo({ runtime: e.target.value })}
                placeholder="150 MIN"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`space-y-1 ${dim(fieldVisibility.screen)}`}>
              {ocrFilledFields.has('screen') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="p1-screen"
                label="Screen"
                optional
                value={movieInfo.screen || ''}
                disabled={!fieldVisibility.screen}
                onChange={(e) => {
                  setInfo({ screen: e.target.value });
                  removeFromOcr('screen');
                }}
                placeholder="IMAX관"
              />
            </div>
            <div className={`space-y-1 ${dim(fieldVisibility.seat)}`}>
              {ocrFilledFields.has('seat') && (
                <div className="flex justify-start"><OcrChip /></div>
              )}
              <Field
                id="p1-seat"
                label="Seat"
                optional
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

          <div className={`space-y-1 ${dim(fieldVisibility.bookingNo)}`}>
            {ocrFilledFields.has('bookingNumber') && (
              <div className="flex justify-start"><OcrChip /></div>
            )}
            <Field
              id="p1-bookingNumber"
              label="Booking No."
              optional
              value={movieInfo.bookingNumber || ''}
              disabled={!fieldVisibility.bookingNo}
              onChange={(e) => {
                setInfo({ bookingNumber: e.target.value });
                removeFromOcr('bookingNumber');
              }}
              placeholder="T-20260510-0014"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="p1-serialNo"
              label="Serial No."
              optional
              value={movieInfo.serialNo || ''}
              onChange={(e) => setInfo({ serialNo: e.target.value })}
              placeholder="자동 부여"
            />
            <Field
              id="p1-collectionNo"
              label="Collection No."
              optional
              value={movieInfo.collectionNo || ''}
              onChange={(e) => setInfo({ collectionNo: e.target.value })}
              placeholder="03 / 12"
            />
          </div>

          <RatingPicker
            value={movieInfo.rating}
            onValueChange={(rating) => setInfo({ rating })}
          />

          <div className="space-y-4 border-t border-line pt-5">
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
          </div>
        </div>
      </OptionalDetailsAccordion>
    </div>
  );
}
