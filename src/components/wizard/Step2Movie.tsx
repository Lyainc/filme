import MovieInfoForm from '@/components/MovieInfoForm';
import Field from '@/components/ui/Field';
import OptionalDetailsAccordion from './OptionalDetailsAccordion';
import RatingPicker from './RatingPicker';
import { formatDate } from '@/utils/dateFormat';
import type { DateFormatToken } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

interface Step2MovieProps {
  photo: ReturnType<typeof usePhototicket>;
  onPendingFetchChange: (pending: boolean) => void;
}

const WATCH_FORMAT_TOKENS: { value: DateFormatToken; sample: string }[] = [
  { value: 'iso', sample: '2026-05-12' },
  { value: 'kr-compact', sample: '2026.05.12' },
  { value: 'cinema-mono', sample: '12·MAY·2026' },
  { value: 'en-long', sample: 'May 12, 2026' },
];

export default function Step2Movie({ photo, onPendingFetchChange }: Step2MovieProps) {
  const { movieInfo } = photo.state;
  const setInfo = photo.updateMovieInfo;
  const watchToken = movieInfo.watchDateFormat || 'kr-compact';

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">[02] Film</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg md:text-[28px]">
          영화 정보를 채워볼까요.
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          제목 · 원제 · 개봉연도가 필수예요. 나머지는 선택사항이고 무드 디자인에 따라 자연스럽게 배치돼요.
        </p>
      </header>

      <MovieInfoForm
        movieInfo={movieInfo}
        onChange={setInfo}
        onPendingFetchChange={onPendingFetchChange}
      />

      <OptionalDetailsAccordion>
        <div className="space-y-5">
          {/* Watched (관람일) */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="watchDate"
                className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted"
              >
                Watched
              </label>
              <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
                {formatDate(movieInfo.watchDate, watchToken, 'date') || '—'}
              </span>
            </div>
            <input
              id="watchDate"
              type="date"
              value={movieInfo.watchDate || ''}
              onChange={(e) => setInfo({ watchDate: e.target.value })}
              className="w-full rounded-field border hairline bg-paper px-3.5 py-3 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
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
                    onClick={() => setInfo({ watchDateFormat: opt.value })}
                    data-touch="44"
                    className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors
                      ${active ? 'border-accent bg-accent text-white' : 'hairline bg-paper text-fg hover:bg-accent-soft'}`}
                  >
                    {opt.sample}
                  </button>
                );
              })}
            </div>
          </div>

          <Field
            id="theater"
            label="Theater"
            optional
            value={movieInfo.theater || ''}
            onChange={(e) => setInfo({ theater: e.target.value })}
            placeholder="CGV 용산아이파크몰"
          />

          <Field
            id="actors"
            label="Cast"
            optional
            value={movieInfo.actors || ''}
            onChange={(e) => setInfo({ actors: e.target.value })}
            placeholder="매튜 맥커너히, 앤 해서웨이"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="watchTime"
              label="Showtime"
              type="time"
              optional
              value={movieInfo.watchTime || ''}
              onChange={(e) => setInfo({ watchTime: e.target.value })}
            />
            <Field
              id="runtime"
              label="Runtime"
              optional
              value={movieInfo.runtime || ''}
              onChange={(e) => setInfo({ runtime: e.target.value })}
              placeholder="150 MIN"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="screen"
              label="Screen"
              optional
              value={movieInfo.screen || ''}
              onChange={(e) => setInfo({ screen: e.target.value })}
              placeholder="IMAX관"
            />
            <Field
              id="seat"
              label="Seat"
              optional
              value={movieInfo.seat || ''}
              onChange={(e) => setInfo({ seat: e.target.value })}
              placeholder="G14, G15"
            />
          </div>

          <Field
            id="bookingNumber"
            label="Booking No."
            optional
            value={movieInfo.bookingNumber || ''}
            onChange={(e) => setInfo({ bookingNumber: e.target.value })}
            placeholder="T-20260510-0014"
          />

          <RatingPicker
            value={movieInfo.rating}
            show={movieInfo.showRating !== false}
            onValueChange={(rating) => setInfo({ rating })}
            onShowChange={(showRating) => setInfo({ showRating })}
          />
        </div>
      </OptionalDetailsAccordion>
    </div>
  );
}
