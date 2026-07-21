import type { DateGranularity } from '@/types';

// Merges coarser-granularity edits onto a full-ISO value so switching year↔date doesn't discard precision.
function mergeDatePrefix(stored: string, edit: string): string {
  if (!stored || !edit) return edit;
  if (stored === edit || stored.startsWith(`${edit}-`)) return stored;
  return edit;
}

// 필드 편집 시트(#215)의 개봉일/재개봉일 입력이 이 granularity 인식 입력을 재사용한다.
export function DateInput({
  value,
  granularity,
  onChange,
  ariaLabel,
}: {
  value: string;
  granularity: DateGranularity;
  onChange: (next: string) => void;
  /** placeholder만 있던 스핀버튼에 접근명을 부여 — SR이 무라벨로 읽지 않게(#198). */
  ariaLabel?: string;
}) {
  const base =
    'flex-1 min-w-[160px] rounded-field border border-line bg-paper px-3.5 py-3 text-[16px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const parts = value ? value.split('-') : [];
  if (granularity === 'year') {
    // Display only the year part; preserve stored month/day on edit.
    const yearView = parts[0] || '';
    return (
      <input
        type="number"
        min={1900}
        max={2099}
        value={yearView}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
          onChange(mergeDatePrefix(value, v));
        }}
        aria-label={ariaLabel}
        className={base}
      />
    );
  }
  if (granularity === 'year-month') {
    // type="month" expects YYYY-MM; trim a stored full ISO down to that.
    const monthView = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : '';
    return (
      <input
        type="month"
        value={monthView}
        onChange={(e) => onChange(mergeDatePrefix(value, e.target.value))}
        aria-label={ariaLabel}
        className={base}
      />
    );
  }
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={base}
    />
  );
}
