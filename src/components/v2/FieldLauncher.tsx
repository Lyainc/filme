import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketField } from '@/types';
import { formatDate } from '@/utils/dateFormat';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { FIELD_LABELS, FIELD_INFO_KEY, LAUNCHER_GROUPS } from '@/constants/fields';

interface FieldLauncherProps {
  photo: ReturnType<typeof usePhototicket>;
  /** 행 탭 → 해당 필드의 편집 시트를 연다. */
  onSelect: (field: TicketField) => void;
}

/** 필드 현재값 미리보기 문자열. 비어 있으면 '' 반환(호출부가 placeholder로 대체). */
function fieldPreview(field: TicketField, info: MovieInfo): string {
  if (field === 'rating') return `${(info.rating ?? 0).toFixed(1)} / 5.0`;
  if (field === 'watchDate') return formatDate(info.watchDate, info.watchDateFormat || 'kr-compact', 'date');
  if (field === 'releaseDate') {
    return formatDate(info.releaseDate, info.releaseDateFormat || 'kr-compact', info.releaseDateGranularity || 'date');
  }
  const key = FIELD_INFO_KEY[field];
  return key ? String(info[key] ?? '') : '';
}

/**
 * 모바일 탭-투-에딧 진입점(#215 PART A) — 인라인 폼을 대체하는 탭 가능한 필드 행 목록.
 * 각 행: 필드 라벨(ko) + 현재값 미리보기(없으면 '비어 있음') + (선택 필드) 표시여부 눈 토글.
 * 행 본문 탭 → onSelect(field)로 그 필드의 FieldEditSheet를 연다. 스탬프(극장/포맷 로고)는 PART B.
 */
export function FieldLauncher({ photo, onSelect }: FieldLauncherProps) {
  const { movieInfo, fieldVisibility } = photo.state;

  return (
    <div className="space-y-5">
      {LAUNCHER_GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <span className="text-mono px-1 text-[10px] uppercase tracking-widest text-fg-muted">
            {group.title}
          </span>
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-elevated">
            {group.fields.map((field) => {
              const preview = fieldPreview(field, movieInfo);
              return (
                <div key={field} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onSelect(field)}
                    aria-label={`${FIELD_LABELS[field]} 편집`}
                    data-touch="44"
                    className="flex min-h-touch min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-soft"
                  >
                    <span className="shrink-0 text-[14px] font-medium text-fg">{FIELD_LABELS[field]}</span>
                    <span
                      className={`min-w-0 truncate text-right text-[13px] ${preview ? 'text-fg-muted' : 'text-fg-faint'}`}
                    >
                      {preview || '비어 있음'}
                    </span>
                  </button>
                  {/* 표시여부 눈 토글 — 모든 필드(제목·개봉일 포함). 데스크톱 MovieInfoForm이
                      title/releaseDate에도 VisibilityCheckbox를 두므로 모바일도 동일 조작 제공. */}
                  <span className="shrink-0 pl-1 pr-3">
                    <VisibilityCheckbox
                      checked={fieldVisibility[field]}
                      onChange={(v) => photo.updateFieldVisibility({ [field]: v })}
                      label={FIELD_LABELS[field]}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
