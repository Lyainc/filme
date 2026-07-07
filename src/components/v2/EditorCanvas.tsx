import { useState, useRef } from 'react';
import ImageUploader from '@/components/ImageUploader';
import MovieInfoForm from '@/components/MovieInfoForm';
import Field from '@/components/ui/Field';
import OptionalDetailsAccordion from '@/components/wizard/OptionalDetailsAccordion';
import RatingPicker from '@/components/wizard/RatingPicker';
import LayoutPicker from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import ColorPicker from '@/components/wizard/ColorPicker';
import { OcrUploadCard } from './OcrUploadCard';
import type { OcrDirectField } from './OcrUploadCard';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { formatDate } from '@/utils/dateFormat';
import { useOcrUndo, type OcrApplyParams } from '@/hooks/useOcrUndo';
import { OcrUndoBanner } from './OcrUndoBanner';
import type { DateFormatToken, TicketField, LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';
import { ALL_FIELDS_ON, ALL_FIELDS_OFF } from '@/constants/fieldVisibility';
import { FIELD_LABELS } from '@/constants/fields';

interface EditorCanvasProps {
  photo: ReturnType<typeof usePhototicket>;
  onPendingFetchChange: (pending: boolean) => void;
  /** 모바일 디자인 레일(#217+)로 옮겨진 섹션(무드·후보정)을 인라인 폼에서 숨긴다. #218/#219가 확장. */
  hideRailSections?: boolean;
  /**
   * 모바일 탭-투-에딧(#215): 인라인 MovieInfo 폼(Film 섹션 + Optional 아코디언, RatingPicker 포함)을
   * 숨긴다 — 이 필드들은 온-티켓 탭 → FieldEditSheet로 편집한다. 포스터·OCR·표시항목 일괄은 유지.
   * (로고 픽커 섹션은 #231에서 EditorCanvas에서 통째로 제거 — 로고는 StampSheet가 담당하므로
   *  이 플래그와 무관하게 더 이상 렌더되지 않는다.)
   */
  hideFormSections?: boolean;
}

// 기본값 kr-compact를 첫 번째로(#141 (12)). kr-compact 샘플은 끝점 포함 YYYY.MM.DD.(#141 (13)).
const WATCH_FORMAT_TOKENS: { value: DateFormatToken; sample: string }[] = [
  { value: 'kr-compact', sample: '2026.05.12.' },
  { value: 'iso', sample: '2026-05-12' },
  { value: 'cinema-mono', sample: '12·MAY·2026' },
  { value: 'en-long', sample: 'May 12, 2026' },
];

const FIELD_ORDER: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime',
  'theater', 'screen', 'seat', 'runtime', 'rating',
  'releaseDate', 'reissue', 'bookingNo', 'signature',
];

function OcrChip({
  field,
  filled,
}: {
  /** 주어지면 칩이 자기 조건·`flex justify-start` 래퍼를 흡수해 호출부가 한 줄로 축소된다. */
  field?: OcrDirectField;
  filled?: Set<OcrDirectField>;
}) {
  const chip = (
    <span className="text-mono text-[8px] uppercase tracking-wider bg-accent-soft text-accent px-1.5 py-0.5 rounded-chip leading-none">
      OCR
    </span>
  );
  // field 없이 쓰면(watchDate 라벨 행) 칩만 반환 — 래퍼는 호출부가 가진다.
  if (!field) return chip;
  if (!filled?.has(field)) return null;
  return <div className="flex justify-start">{chip}</div>;
}

export function EditorCanvas({ photo, onPendingFetchChange, hideRailSections = false, hideFormSections = false }: EditorCanvasProps) {
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

  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유한다(DesktopStudioShell과 공유, #141-class drift 방지).
  const ocr = useOcrUndo(photo);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const accordionRef = useRef<HTMLDivElement>(null);

  // 훅의 apply에 이 사이트만의 UI 사이드이펙트(Optional 아코디언 열기 + 스크롤)를 얹는다.
  function handleOcrApply(params: OcrApplyParams) {
    ocr.apply(params);
    setAccordionOpen(true);

    // Smooth scroll into view if offscreen
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Poster</span>
          <InfoTooltip
            text="영화 포스터 이미지를 올리는 곳이에요. 아래 '티켓 스크린샷으로 자동입력'에 티켓 스크린샷을 넣으면 영화 정보가 자동으로 채워져요."
            label="포스터 추가 안내"
            placement="right"
          />
        </div>
        {/* 포스터 주연 드롭존(크게) + 하단 자동 인식 보조 액션(작게)으로 위계를 명확히(#142 (18)). */}
        <div className="space-y-2.5">
          <ImageUploader
            onUpload={photo.handleImageUpload}
            isProcessing={false}
            hasImage={!!photo.state.croppedImageUrl}
            imageUrl={photo.state.croppedImageUrl}
          />
          <OcrUploadCard
            setInfo={setInfo}
            currentInfo={movieInfo}
            onOcrApply={handleOcrApply}
            setComponents={photo.updateComponents}
            currentComponents={photo.state.components}
            ocrEpochRef={ocr.epochRef}
          />
        </div>
      </section>

      {/* 표시 항목 일괄 컨트롤 — 각 필드 옆 체크박스(인라인)를 전체 제어(#116).
          'Display Fields' 칩 섹션을 대체하고, 입력 그룹 상단에 콤팩트하게 둔다. */}
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface-elevated px-3.5 py-2.5">
        <span className="flex items-center gap-2">
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
            표시 항목 <span className="text-fg-faint">{selectedCount}/{FIELD_ORDER.length}</span>
          </span>
          <InfoTooltip
            text="티켓에 실제로 새길 항목을 고르는 곳이에요. 각 입력칸 옆 체크박스를 한 번에 켜고 끌 수 있어요."
            label="표시 항목 안내"
            placement="right"
          />
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setField(ALL_FIELDS_ON)}
            disabled={allOn}
            className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => setField(ALL_FIELDS_OFF)}
            disabled={allOff}
            className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-2.5 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
          >
            전체 해제
          </button>
        </div>
      </div>

      {/* MovieInfo 인라인 폼(Film + Optional 아코디언) — 모바일 탭-투-에딧(#215)에선 숨기고
          온-티켓 탭 → FieldEditSheet로 대체. 데스크톱은 hideFormSections 미전달이라 그대로 렌더. */}
      {!hideFormSections && (
      <section className="space-y-4">
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Film</span>
        <MovieInfoForm
          movieInfo={movieInfo}
          onChange={setInfo}
          onPendingFetchChange={onPendingFetchChange}
          fieldVisibility={fieldVisibility}
          onFieldVisibilityChange={setField}
        />
      </section>
      )}

      {!hideFormSections && (
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
                {ocr.filledFields.has('watchDate') && <OcrChip />}{/* 라벨 행 안 — 래퍼 없는 칩 */}
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
                onChange={(e) => {
                  setInfo({ watchDate: e.target.value });
                  ocr.removeField('watchDate');
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
          </div>

          {/* Theater + Booking No.를 2열로 묶어 세로 한 줄 절약(#180 (8)). 둘 다 짧은 거래 정보라 짝이 맞는다. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <OcrChip field="theater" filled={ocr.filledFields} />
              <Field
                id="editor-theater"
                label="Theater"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('theater')} />}
                value={movieInfo.theater || ''}
                dimmed={!fieldVisibility.theater}
                onChange={(e) => {
                  setInfo({ theater: e.target.value });
                  ocr.removeField('theater');
                }}
                placeholder="CGV 용산아이파크몰"
              />
            </div>
            <div className="space-y-1">
              <OcrChip field="bookingNumber" filled={ocr.filledFields} />
              <Field
                id="editor-bookingNumber"
                label="Booking No."
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('bookingNo')} />}
                value={movieInfo.bookingNumber || ''}
                dimmed={!fieldVisibility.bookingNo}
                onChange={(e) => {
                  setInfo({ bookingNumber: e.target.value });
                  ocr.removeField('bookingNumber');
                }}
                placeholder="T-20260510-0014"
              />
            </div>
          </div>

          <Field
            id="editor-actors"
            label="Cast"
            optional
            labelAccessory={<VisibilityCheckbox {...visProps('actors')} />}
            value={movieInfo.actors || ''}
            dimmed={!fieldVisibility.actors}
            onChange={(e) => setInfo({ actors: e.target.value })}
            placeholder="매튜 맥커너히, 앤 해서웨이"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <OcrChip field="watchTime" filled={ocr.filledFields} />
              <Field
                id="editor-watchTime"
                label="Showtime"
                type="time"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('watchTime')} />}
                value={movieInfo.watchTime || ''}
                dimmed={!fieldVisibility.watchTime}
                onChange={(e) => {
                  setInfo({ watchTime: e.target.value });
                  ocr.removeField('watchTime');
                }}
              />
            </div>
            <Field
              id="editor-runtime"
              label="Runtime"
              optional
              labelAccessory={<VisibilityCheckbox {...visProps('runtime')} />}
              value={movieInfo.runtime || ''}
              dimmed={!fieldVisibility.runtime}
              onChange={(e) => setInfo({ runtime: e.target.value })}
              placeholder="150 MIN"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <OcrChip field="screen" filled={ocr.filledFields} />
              <Field
                id="editor-screen"
                label="Screen"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('screen')} />}
                value={movieInfo.screen || ''}
                dimmed={!fieldVisibility.screen}
                onChange={(e) => {
                  setInfo({ screen: e.target.value });
                  ocr.removeField('screen');
                }}
                placeholder="IMAX관"
              />
            </div>
            <div className="space-y-1">
              <OcrChip field="seat" filled={ocr.filledFields} />
              <Field
                id="editor-seat"
                label="Seat"
                optional
                labelAccessory={<VisibilityCheckbox {...visProps('seat')} />}
                value={movieInfo.seat || ''}
                dimmed={!fieldVisibility.seat}
                onChange={(e) => {
                  setInfo({ seat: e.target.value });
                  ocr.removeField('seat');
                }}
                placeholder="G14, G15"
              />
            </div>
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
      )}

      {/* 정보 입력 ↔ 티켓 디자인 영역 경계 — 단일 스크롤에서 스캔을 돕는 시각 구분. 모바일
          (hideRailSections)에선 뒤따르는 무드·질감·색 섹션이 전부 레일로 빠져 divider가 고아가
          되므로 숨긴다(#266 갭3). 데스크톱은 그대로 노출. */}
      {!hideRailSections && (
      <div className="flex items-center gap-3 pt-2" aria-hidden="true">
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">Ticket Design</span>
        <div className="h-px flex-1 bg-line" />
      </div>
      )}

      {!hideRailSections && (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Mood</span>
          <InfoTooltip
            text="티켓의 전체 분위기를 정하는 곳이에요. 미니멀·크라이테리온·35mm·에디토리얼 무드별로 레이아웃과 질감이 달라져요."
            label="티켓 무드 안내"
            placement="right"
          />
        </div>
        <LayoutPicker
          value={components.layout}
          onChange={(id: LayoutId) => setComp({ layout: id })}
        />
      </section>
      )}

      {/* Logos(극장/포맷 스탬프)는 온-티켓 탭 → StampSheet(자유 크롭)로 편집한다. 구
          TheaterChainPicker/FormatPicker는 이 !hideFormSections 폼 경로에서만 쓰였는데, 데스크톱이
          DesktopStudioShell로 넘어가고 모바일은 hideFormSections를 늘 넘기면서 렌더 경로가 사라져
          제거됨(#231). 로고 크롭은 StampSheet의 useLogoCrop + ImageCropModal(aspect undefined)이 담당. */}

      {!hideRailSections && (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Texture</span>
          <InfoTooltip
            text="티켓 표면의 종이·필름 질감을 입히는 곳이에요. 같은 무드라도 질감에 따라 인쇄물 느낌이 확 달라져요."
            label="Texture 안내"
            placement="right"
          />
        </div>
        <TexturePicker
          value={components.texture}
          onChange={(texture) => setComp({ texture })}
          croppedImageUrl={photo.state.croppedImageUrl}
        />
      </section>
      )}

      {/* 밝기+컬러 박스 — 모바일(hideRailSections)에선 둘 다 레일(#218/#219)로 옮겨졌으므로 박스째 숨긴다
          (빈 테두리 박스가 남지 않게). 데스크톱은 밝기·컬러를 그대로 인라인 노출. */}
      {!hideRailSections && (
      <section className="space-y-4 rounded-card border border-border bg-surface-elevated p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <BrightnessSlider
          value={components.posterOpacity}
          onChange={(posterOpacity) => setComp({ posterOpacity })}
        />
        <div className="border-t border-border pt-4">
          <ColorPicker
            value={components.themeColor}
            onChange={(themeColor) => setComp({ themeColor })}
            recommended={recommendedColors}
            disabled={components.layout === '35mm'}
            disabledNote="35mm 무드는 필름 톤(크림·먹색)이 고정이라 잉크 색을 바꿀 수 없어요."
          />
        </div>
      </section>
      )}

      {/* OCR 되돌리기 배너 + sr-only 라이브리전 — DesktopStudioShell과 공유(useOcrUndo/OcrUndoBanner,
          #141-class drift 방지). spacer는 모바일에서 마지막 섹션이 하단 고정 배너에 가리지 않게 이 사이트에만 둔다(#213). */}
      <OcrUndoBanner
        snapshot={ocr.snapshot}
        filledFields={ocr.filledFields}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />
      {ocr.snapshot && <div className="h-20" aria-hidden="true" />}
    </div>
  );
}
