import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { DateFormatToken, DateGranularity, MovieInfo, TicketComponents, TicketField } from '@/types';
import { formatDate, openDtToIso } from '@/utils/dateFormat';
import { useKobisSearch } from '@/hooks/useKobisSearch';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import { Eyebrow } from './Eyebrow';
import { DateInput } from '@/components/MovieInfoForm';
import RatingPicker from '@/components/wizard/RatingPicker';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import {
  FIELD_LABELS,
  FIELD_SHEET_TYPE,
  FIELD_INFO_KEY,
  STAMP_LABELS,
  STAMP_KEYS,
  isStampTarget,
  STAMP_LABEL_MAX,
  QUOTE_MAX_LENGTH,
  type SheetTarget,
  type StampTarget,
} from '@/constants/fields';
import { DATE_FORMAT_TOKENS, GRANULARITY_OPTIONS } from '@/constants/dateTokens';

// 로고 크롭 모달 — 픽커들과 동일하게 dynamic(ssr:false)로 로드(react-image-crop을 시트 청크에서 뺀다).
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

type Photo = ReturnType<typeof usePhototicket>;

/** 로컬 타임존 기준 오늘 날짜(YYYY-MM-DD). watchDate 미입력 시 표기 미리보기 fallback용(#390). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INPUT_CLS =
  // 16px 미만이면 iOS Safari가 포커스 시 자동 줌인해 레이아웃이 틀어진다(#274) — 편집 폼 컨트롤은 16px 이상.
  // 글래스 톤(#367) — 다크 앰비언트 위 solid 카드 대신 v8 글래스 토큰. 데스크톱 아코디언(라이트
  // 서피스)에선 밝은 유리로 등가 렌더된다(토큰이 스코프별 해석).
  'w-full rounded-field border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-3 text-[16px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft';

/**
 * 필드 편집 본문(#226) — 필드/스탬프 타깃별 에디터 콘텐츠(text/date/title/rating + 스탬프)를
 * 렌더한다. 데스크톱 인라인 아코디언(FieldAccordion)과 모바일 인플레이스 에디터(#354)가 하우징만
 * 달리해 이 본문을 공유한다(구 FieldEditSheet vaul 하우징은 #355에서 제거).
 */
export function FieldEditorBody({ target, photo }: { target: SheetTarget; photo: Photo }) {
  return isStampTarget(target) ? (
    <StampSheet target={target} photo={photo} />
  ) : (
    <SheetBody field={target} photo={photo} />
  );
}

function SheetBody({ field, photo }: { field: TicketField; photo: Photo }) {
  const type = FIELD_SHEET_TYPE[field];
  if (type === 'rating') return <RatingSheet photo={photo} />;
  if (type === 'date') return <DateSheet field={field} photo={photo} />;
  if (field === 'title') return <TitleSheet photo={photo} />;
  if (type === 'text') return <TextSheet field={field} photo={photo} />;
  return null; // reissue 등 PART A에서 시트가 없는 필드는 본문 없음.
}

/** 일반 텍스트 필드 — MovieInfo 키에 직접 바인딩. watchTime만 시간 입력. */
function TextSheet({ field, photo }: { field: TicketField; photo: Photo }) {
  const key = FIELD_INFO_KEY[field];
  if (!key) return null;
  const value = String(photo.state.movieInfo[key] ?? '');
  return (
    <input
      autoFocus
      type={field === 'watchTime' ? 'time' : 'text'}
      value={value}
      // key는 문자열 필드(title/titleOg/... bookingNumber/signature)만 — 값이 늘 string이라 안전.
      onChange={(e) => photo.updateMovieInfo({ [key]: e.target.value } as Partial<MovieInfo>)}
      aria-label={FIELD_LABELS[field]}
      maxLength={field === 'signature' ? 20 : field === 'quote' ? QUOTE_MAX_LENGTH : undefined}
      className={INPUT_CLS}
    />
  );
}

/** 제목 — 텍스트 입력 + KOBIS 검색(디바운스 → 결과 목록 → 선택 시 제목/원제/개봉일/출연/러닝타임 채움). */
function TitleSheet({ photo }: { photo: Photo }) {
  const title = photo.state.movieInfo.title;
  // 검색 코어는 데스크톱 폼과 공용 훅을 쓴다(#242 drift 방지). 시트는 축소판 UX라
  // 키보드 내비·pending 게이팅 없이 에러 문구만 캐주얼 톤으로.
  const { results, loading, error, open, scheduleSearch, runSearch, selectMovie } = useKobisSearch({
    apply: photo.updateMovieInfo,
    messages: { noResults: '검색 결과가 없어요.', requestFailed: '검색 중 문제가 생겼어요.' },
  });

  // OCR이 채운 제목을 들고 편집기를 열었을 때도 후보가 바로 보이도록, 마운트 시
  // 초기값이 있으면 한 번 자동 검색(#383). onChange/onCompositionEnd는 이후 입력에만 반응한다.
  useEffect(() => {
    const v = title.trim();
    if (v) scheduleSearch(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <input
        autoFocus
        type="text"
        value={title}
        // 한글 IME는 마지막 음절을 커밋(스페이스/엔터/blur) 전까지 조합 상태로 두고,
        // 조합 종료 시 trailing change 없이 값만 반영되는 IME가 있어(#82) 최종 커밋 값으로
        // 재검색한다. MovieInfoForm의 동일 검색 UI와 동작을 맞춘다.
        onCompositionEnd={(e) => {
          const v = e.currentTarget.value.trim();
          if (v) scheduleSearch(v);
        }}
        onChange={(e) => {
          const v = e.target.value;
          photo.updateMovieInfo({ title: v });
          scheduleSearch(v.trim());
        }}
        aria-label="제목"
        className={INPUT_CLS}
      />
      <Eyebrow as="div" tone="faint" className="flex items-center justify-between">
        <span>KOBIS 검색</span>
        <button
          type="button"
          onClick={() => runSearch(title.trim())}
          className="rounded-chip bg-accent px-3 py-1.5 text-accent-ink transition-colors hover:bg-accent-hover"
        >
          ↗ 검색
        </button>
      </Eyebrow>

      {open && (
        <div className="overflow-hidden rounded-card border border-line bg-surface-elevated">
          {loading ? (
            <div className="text-mono px-4 py-5 text-center text-[11px] uppercase tracking-widest text-fg-faint">
              Loading…
            </div>
          ) : error ? (
            <div role="alert" className="text-mono px-4 py-5 text-center text-[11px] uppercase tracking-widest text-danger">
              {error}
            </div>
          ) : results.length > 0 ? (
            <ul role="listbox" aria-label="검색 결과" className="max-h-56 overflow-y-auto">
              {results.map((movie) => (
                <li key={movie.movieCd} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => selectMovie(movie)}
                    data-touch="44"
                    className="block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent-soft"
                  >
                    <div className="text-[15px] font-medium text-fg">{movie.movieNm}</div>
                    <Eyebrow as="div" tone="faint" className="mt-1">
                      {movie.openDt && formatDate(openDtToIso(movie.openDt), 'kr-compact', 'date')}
                      {movie.genreAlt ? ` · ${movie.genreAlt.split(',')[0]}` : ''}
                      {movie.nationAlt ? ` · ${movie.nationAlt}` : ''}
                    </Eyebrow>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** 날짜 표기 토큰 칩(#141) — watchDate/releaseDate 공용. */
function FormatChips({
  token,
  onChange,
  label,
  preview,
}: {
  token: DateFormatToken;
  onChange: (next: DateFormatToken) => void;
  label: string;
  preview: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <Eyebrow tone="faint">{preview || '—'}</Eyebrow>
      </div>
      {/* 4번째 칩(en-long)이 좁은 폭에서 2줄로 감기던 문제(#390) — 가로 스크롤 레일로 전환.
          같은 레포 기존 패턴(LayoutPicker.tsx의 snap-start 레일)을 그대로 재사용. */}
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x [scrollbar-width:thin]" role="radiogroup" aria-label={label}>
        {DATE_FORMAT_TOKENS.map((opt) => {
          const active = token === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              data-touch="44"
              className={`text-mono inline-flex min-h-touch shrink-0 snap-start items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors ${
                active
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg hover:bg-accent-soft'
              }`}
            >
              {opt.sample}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 날짜 필드 — watchDate(입력+표기 칩) / releaseDate(정밀도+표기 칩+재개봉 토글).
 * export(#354): 인플레이스 에디터의 aid 패널이 재사용 — 날짜는 투명 input 대신 이 편집기가
 * 키보드 자리에 뜬다(표기 칩·정밀도·재개봉 토글까지 보존하는 유일한 기존 UI).
 */
export function DateSheet({ field, photo }: { field: TicketField; photo: Photo }) {
  const info = photo.state.movieInfo;
  const set = photo.updateMovieInfo;

  if (field === 'watchDate') {
    const token = info.watchDateFormat || 'kr-compact';
    return (
      <div className="space-y-group">
        <input
          type="date"
          value={info.watchDate || ''}
          onChange={(e) => set({ watchDate: e.target.value })}
          aria-label="관람일"
          className={INPUT_CLS}
        />
        <FormatChips
          token={token}
          onChange={(watchDateFormat) => set({ watchDateFormat })}
          label="관람일 표기"
          // 미입력 상태에도 표기 형식을 오늘 날짜로 미리 보여준다 — 값 자체는 그대로 비워
          // 둬서 "미입력"과 "오늘 실제 선택"이 섞이지 않게 한다(#390, 표시 전용 fallback).
          preview={formatDate(info.watchDate || todayIso(), token, 'date')}
        />
      </div>
    );
  }

  // releaseDate — 정밀도(연/연월/연월일) 인식 입력 + 표기 칩 + 재개봉 토글(인라인 폼과 동일 로직).
  const gran = info.releaseDateGranularity || 'date';
  const token = info.releaseDateFormat || 'kr-compact';
  return (
    <div className="space-y-group">
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={gran}
          onChange={(e) => set({ releaseDateGranularity: e.target.value as DateGranularity })}
          aria-label="개봉일 정밀도"
          className="text-mono rounded-field border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-3 text-[16px] uppercase tracking-widest text-fg outline-none focus:border-accent"
        >
          {GRANULARITY_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <DateInput
          value={info.releaseDate || ''}
          granularity={gran}
          onChange={(releaseDate) => set({ releaseDate })}
          ariaLabel="개봉일"
        />
      </div>
      <FormatChips
        token={token}
        onChange={(releaseDateFormat) => set({ releaseDateFormat })}
        label="개봉일 표기"
        preview={formatDate(info.releaseDate, token, gran)}
      />

      <Eyebrow as="label" className="inline-flex cursor-pointer items-center gap-1.5 hover:text-fg">
        <input
          type="checkbox"
          checked={!!info.isReissue}
          onChange={(e) => set({ isReissue: e.target.checked })}
          className="h-3.5 w-3.5 accent-accent"
        />
        재개봉작
      </Eyebrow>

      {info.isReissue && (
        <div className="space-y-field border-l-2 border-line pl-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <DateInput
              value={info.reissueDate || ''}
              granularity={gran}
              onChange={(reissueDate) => set({ reissueDate })}
              ariaLabel="재개봉일"
            />
            <Eyebrow tone="faint" className="inline-flex items-center">
              표기: {formatDate(info.reissueDate, token, gran) || '—'}
            </Eyebrow>
          </div>
          <span className="flex items-center gap-2">
            <VisibilityCheckbox
              checked={photo.state.fieldVisibility.reissue}
              onChange={(v) => photo.updateFieldVisibility({ reissue: v })}
              label="재개봉"
            />
            <Eyebrow>
              티켓에 재개봉일 표시
            </Eyebrow>
          </span>
        </div>
      )}
    </div>
  );
}

/** 평점 — RatingPicker 재사용(자체 표시여부 토글 포함). */
function RatingSheet({ photo }: { photo: Photo }) {
  return (
    <RatingPicker
      value={photo.state.movieInfo.rating}
      onValueChange={(rating) => photo.updateMovieInfo({ rating })}
      visible={photo.state.fieldVisibility.rating}
      onVisibleChange={(v) => photo.updateFieldVisibility({ rating: v })}
    />
  );
}

/**
 * 스탬프(극장/포맷 로고, #215 PART B) — 텍스트 라벨 + 로고 이미지 업로드. 데이터는 TicketComponents에
 * 산다(chain/chainLabel · format/formatLabel). '이미지가 라벨보다 우선'하는 규칙은 _shared.tsx가
 * 이미 처리하므로, 이미지가 있으면 텍스트 대신 이미지+'제거'만 노출한다.
 * 극장·포맷 모두 완전 자유입력(#317) — 프리셋/자동완성 없음.
 */
function StampSheet({ target, photo }: { target: StampTarget; photo: Photo }) {
  const components = photo.state.components;
  const keys = STAMP_KEYS[target];
  const imageUrl = String(components[keys.image] ?? '');
  const labelValue = String(components[keys.label] ?? '');

  const setLabel = (v: string) =>
    photo.updateComponents({ [keys.label]: v } as Partial<TicketComponents>);
  const setImage = (url: string) =>
    photo.updateComponents({ [keys.image]: url } as Partial<TicketComponents>);

  // 로고 업로드 → 자유 크롭 → PNG. 픽커들과 동일한 useLogoCrop 흐름(#220).
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(setImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) openFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = () => {
    // blob revoke는 하지 않는다 — undo 히스토리(#356)가 이 URL을 참조한다(useLogoCrop 참고).
    setImage('');
  };

  // 이미지가 있으면 이미지 + 제거만(이미지 우선). 텍스트는 숨긴다.
  if (imageUrl) {
    return (
      <div className="flex items-center gap-3 rounded-field border border-line bg-surface-elevated px-3.5 py-3">
        <img src={imageUrl} alt={`${STAMP_LABELS[target]} 이미지`} className="h-8 w-auto object-contain" />
        <button
          type="button"
          onClick={removeImage}
          className="text-mono ml-auto rounded-chip border border-line px-3 py-1.5 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          이미지 제거
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        autoFocus
        type="text"
        value={labelValue}
        onChange={(e) => setLabel(e.target.value)}
        aria-label={STAMP_LABELS[target]}
        maxLength={STAMP_LABEL_MAX}
        className={INPUT_CLS}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-mono inline-flex min-h-touch items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
      >
        로고 업로드
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="sr-only"
      />

      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          aspect={undefined}
          title="로고 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </div>
  );
}
