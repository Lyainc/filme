import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';
import { missingExportFields } from '@/hooks/useExportReady';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketField } from '@/types';
import { FIELD_LABELS, fieldPreview, launcherGroupsFor, type SheetTarget } from '@/constants/fields';
import { ALL_FIELDS_ON, ALL_FIELDS_OFF_KEEP_REQUIRED, isRequiredField } from '@/constants/fieldVisibility';

type Photo = ReturnType<typeof usePhototicket>;

// 표시 항목 일괄 스위치의 도메인 필드 집합(#261) — ALL_FIELDS_ON 키가 곧 전체 티켓 필드.
const ALL_FIELDS = Object.keys(ALL_FIELDS_ON) as TicketField[];

/**
 * 정보 행(C-IROW) — 이름 · 값('비어 있음') · 표시 토글. 필수(제목 · 개봉일)가 비면 이름에 앰버 점과 값 자리에
 * 앰버 '필수'가 서고(E-02 · E-03), 숨긴 항목은 값에 취소선이 간다. 제목은 숨김 토글이 비활성이다(#260).
 */
function InfoRow({
  field,
  photo,
  missing,
  onOpen,
}: {
  field: TicketField;
  photo: Photo;
  missing: boolean;
  onOpen: () => void;
}) {
  const { movieInfo, components, fieldVisibility } = photo.state;
  const label = FIELD_LABELS[field];
  const preview = fieldPreview(field, movieInfo, components);
  const shown = fieldVisibility[field];
  const locked = isRequiredField(field);
  const hintId = `info-row-${field}-missing`;
  return (
    <div data-field-row={field} data-missing={missing ? 'true' : undefined} className="flex min-h-touch items-center gap-2 border-b border-hair">
      <button
        type="button"
        onClick={onOpen}
        // 접근명은 이름 + 값(내용에서 나온다)이다 — aria-label '○○ 편집'은 티켓 위 필드 탭(FieldTap)이 이미 쓰는
        // 이름이라, 도크가 항상 떠 있는 지금은 같은 이름의 버튼이 둘이 돼 스크린리더·테스트가 가리지 못한다.
        aria-describedby={missing ? hintId : undefined}
        className={cn(pressableVariants(), 'flex min-h-touch min-w-0 flex-1 items-center gap-2 text-left')}
      >
        <span className="flex w-16 shrink-0 items-center gap-1 whitespace-nowrap text-caption text-ink-2">
          {label}
          {missing && <span aria-hidden="true" data-testid="missing-dot" className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />}
        </span>
        {/* 접근명이 '제목필수'로 붙지 않게 이름과 값 사이에 공백 텍스트를 둔다. */}
        {' '}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-body',
            missing && !preview ? 'text-warn' : preview ? 'text-ink' : 'text-ink-3',
            missing && preview && 'text-warn',
            !shown && 'text-ink-3 line-through decoration-hair-strong',
          )}
        >
          {preview || (missing ? '필수' : '비어 있음')}
        </span>
      </button>
      {missing && (
        <span id={hintId} className="sr-only">
          필수 미입력
        </span>
      )}
      <button
        type="button"
        aria-label={`${label} 티켓에 표시`}
        aria-pressed={shown}
        disabled={locked}
        title={locked ? '필수 항목 — 항상 표시돼요' : undefined}
        onClick={() => photo.updateFieldVisibility({ [field]: !shown })}
        className={cn(pressableVariants(), `-mr-2 inline-flex h-touch w-touch shrink-0 items-center justify-center transition-colors disabled:opacity-40 ${shown ? 'text-ink' : 'text-ink-3'}`)}
      >
        <EyeIcon open={shown} size={18} />
      </button>
    </div>
  );
}

/**
 * 정보 모드(I-01) — 위에 '스크린샷으로 자동입력' 보조 버튼, 아래에 영화 / 관람 / 기록 행. 무드가 안 그리는 항목은
 * 목록에서 빠진다(MOOD_EXCLUDED_FIELDS, #287). 행 탭은 티켓 위 인플레이스 입력을 연다 — 필수 누락 행은
 * openMissingField(#776)를 타서 숨겨 둔 필드면 편집이 끝날 때 다시 숨긴다. 옛 드로어 맨 위의 '전체 표시'
 * 스위치는 목록 끝으로 왔다.
 */
export function InfoPane({
  photo,
  onField,
  onMissingField,
  onOcrOpen,
  ocrBusy,
}: {
  photo: Photo;
  onField: (target: SheetTarget) => void;
  onMissingField: (target: TicketField) => void;
  /** 랜딩에 한 벌뿐인 OcrUploadCard의 업로드를 연다(Seed constraint-17). */
  onOcrOpen: () => void;
  ocrBusy: boolean;
}) {
  const { movieInfo, components, fieldVisibility } = photo.state;
  const missing = missingExportFields(movieInfo);
  const allVisOn = ALL_FIELDS.every((f) => fieldVisibility[f]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <button
        type="button"
        onClick={onOcrOpen}
        aria-busy={ocrBusy}
        aria-disabled={ocrBusy}
        data-touch="44"
        className={cn(pressableVariants(), 'mt-1 inline-flex h-touch items-center gap-2 rounded-md border border-hair-strong px-4 text-body text-ink aria-disabled:cursor-default aria-disabled:opacity-70')}
      >
        {ocrBusy ? '티켓 인식 중…' : '스크린샷으로 자동입력'}
      </button>
      {launcherGroupsFor(components.layout).map((group) => (
        <section key={group.title} aria-label={group.title}>
          <p className="pb-1 pt-3 text-caption font-semibold text-ink-3">{group.title}</p>
          {group.fields.map((field) => {
            const isMissing = missing.includes(field as 'title' | 'releaseDate');
            return (
              <InfoRow
                key={field}
                field={field}
                photo={photo}
                missing={isMissing}
                onOpen={() => (isMissing ? onMissingField(field) : onField(field))}
              />
            );
          })}
        </section>
      ))}
      <button
        type="button"
        role="switch"
        aria-checked={allVisOn}
        onClick={() => photo.updateFieldVisibility(allVisOn ? ALL_FIELDS_OFF_KEEP_REQUIRED : ALL_FIELDS_ON)}
        className={cn(pressableVariants(), 'mt-2 flex h-touch w-full items-center justify-between text-body text-ink-2 transition-colors hover:text-ink')}
      >
        <span>전체 표시</span>
        <span className="-mr-2 inline-flex h-touch w-touch items-center justify-center">
          <EyeIcon open={allVisOn} size={18} />
        </span>
      </button>
    </div>
  );
}
