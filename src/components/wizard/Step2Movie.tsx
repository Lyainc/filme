import MovieInfoForm from '@/components/MovieInfoForm';
import Field from '@/components/ui/Field';
import OptionalDetailsAccordion from './OptionalDetailsAccordion';
import RatingPicker from './RatingPicker';
import type { usePhototicket } from '@/hooks/usePhototicket';

interface Step2MovieProps {
  photo: ReturnType<typeof usePhototicket>;
  onPendingFetchChange: (pending: boolean) => void;
}

export default function Step2Movie({ photo, onPendingFetchChange }: Step2MovieProps) {
  const { movieInfo } = photo.state;
  const setInfo = photo.updateMovieInfo;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">[02] Film</p>
        <h2 className="text-2xl font-medium tracking-tight text-fg md:text-[28px]">
          영화 정보를 채워볼까요.
        </h2>
        <p className="max-w-[42ch] text-[13px] leading-relaxed text-fg-muted">
          제목 옆 검색으로 KOBIS에서 자동 채움이 가능해요. 제목 · 관람일 · 극장이 필수예요.
        </p>
      </header>

      <MovieInfoForm
        movieInfo={movieInfo}
        onChange={setInfo}
        onPendingFetchChange={onPendingFetchChange}
      />

      <OptionalDetailsAccordion>
        <div className="space-y-5">
          <Field
            id="movieTitleOg"
            label="Original Title"
            optional
            value={movieInfo.titleOg || ''}
            onChange={(e) => setInfo({ titleOg: e.target.value })}
            placeholder="Interstellar"
          />
          <Field
            id="actors"
            label="Cast"
            optional
            value={movieInfo.actors || ''}
            onChange={(e) => setInfo({ actors: e.target.value })}
            placeholder="매튜 맥커너히, 앤 해서웨이"
          />
          <Field
            id="releaseDate"
            label="Released"
            optional
            value={movieInfo.releaseDate || ''}
            onChange={(e) => setInfo({ releaseDate: e.target.value })}
            placeholder="2014. 11. 06."
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

          <div className="grid grid-cols-2 gap-4">
            <Field
              id="audienceCert"
              label="Cert"
              optional
              value={movieInfo.audienceCert || ''}
              onChange={(e) => setInfo({ audienceCert: e.target.value })}
              placeholder="12"
            />
            <Field
              id="bookingNumber"
              label="Booking No."
              optional
              value={movieInfo.bookingNumber || ''}
              onChange={(e) => setInfo({ bookingNumber: e.target.value })}
              placeholder="T-20260510-0014"
            />
          </div>

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
