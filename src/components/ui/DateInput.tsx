import type { KeyboardEvent } from 'react';
import type { DateGranularity } from '@/types';
import { cn } from '@/utils/cn';
import { inputVariants } from './variants';
import { focusInPlace } from '@/components/v2/KeyboardPanel';

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
  className,
  autoFocus,
  onKeyDown,
  enterKeyHint,
}: {
  value: string;
  granularity: DateGranularity;
  onChange: (next: string) => void;
  /** placeholder만 있던 스핀버튼에 접근명을 부여 — SR이 무라벨로 읽지 않게(#198). */
  ariaLabel?: string;
  /** 크기 · 표면 클래스를 통째로 바꾼다 — 입력 패널은 한 줄 높이(36)에 맞춘 자기 클래스를 넘긴다(#826 S3). */
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  enterKeyHint?: 'next' | 'done';
}) {
  const base = className ?? cn(
    inputVariants({ surface: 'paper' }),
    'flex-1 min-w-[160px] rounded-field px-3.5 py-3 text-title text-ink',
  );
  // 세 입력(연 · 연월 · 날짜)이 같이 받는 속성 — 하나 더할 때 한 곳만 고친다.
  // autoFocus는 스크롤 없는 마운트 포커스로 건다 — 입력 패널의 ‹ › 전환에서 iOS가 문서를 스크롤하지 않게(KeyboardPanel focusInPlace, #826 S8).
  const common = { 'aria-label': ariaLabel, className: base, ref: autoFocus ? focusInPlace : undefined, onKeyDown, enterKeyHint };
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
        {...common}
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
        {...common}
      />
    );
  }
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      {...common}
    />
  );
}
