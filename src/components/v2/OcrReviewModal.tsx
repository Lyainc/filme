import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { OcrBoxItem } from '@/utils/ocr';

export interface OcrReviewModalProps {
  items: OcrBoxItem[];
  onClose: () => void;
  onConfirm: (mappedData: Record<string, string>) => void;
}

const FIELDS = [
  { value: 'title', label: '영화 제목' },
  { value: 'theater', label: '극장 지점' },
  { value: 'screen', label: '상영관' },
  { value: 'watchDate', label: '관람 날짜' },
  { value: 'watchTime', label: '관람 시각' },
  { value: 'seat', label: '좌석' },
  { value: 'bookingNumber', label: '예매번호' },
];

export default function OcrReviewModal({ items, onClose, onConfirm }: OcrReviewModalProps) {
  const [chips, setChips] = useState<{ id: number; text: string; field: string | null; deleted: boolean }[]>([]);

  useEffect(() => {
    setChips(
      items.map((it, i) => ({
        id: i,
        text: it.text || '',
        field: it.field || null,
        deleted: false,
      }))
    );
  }, [items]);

  useBodyScrollLock(true);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const toggleDelete = (id: number) => {
    setChips(chips.map(c => c.id === id ? { ...c, deleted: !c.deleted } : c));
  };

  const changeField = (id: number, field: string | null) => {
    setChips(chips.map(c => c.id === id ? { ...c, field } : c));
  };

  const handleTextChange = (id: number, text: string) => {
    setChips(chips.map(c => c.id === id ? { ...c, text } : c));
  };

  const handleOk = () => {
    const result: Record<string, string> = {};
    for (const c of chips) {
      if (!c.deleted && c.field && c.text) {
        if (result[c.field] && c.field === 'seat') {
          result[c.field] += `, ${c.text}`;
        } else {
          result[c.field] = c.text;
        }
      }
    }
    onConfirm(result);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50 animate-fade-in"
    >
      <div className="flex flex-col w-full max-w-md max-h-[85vh] bg-surface rounded-modal shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">
              Review
            </span>
            <h3 className="text-[16px] font-medium tracking-tight text-fg">인식된 정보 검수</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-mono inline-flex min-h-touch min-w-touch items-center justify-center rounded-chip text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-paper">
          {chips.length === 0 && <p className="text-sm text-fg-muted text-center py-4">인식된 텍스트 칩이 없습니다.</p>}
          {chips.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 p-2 rounded-field border transition-opacity ${
                c.deleted ? 'opacity-40 border-line bg-surface' : 'border-line bg-surface-elevated'
              }`}
            >
              <input
                type="text"
                value={c.text}
                onChange={(e) => handleTextChange(c.id, e.target.value)}
                className={`flex-1 bg-transparent text-sm text-fg outline-none w-full min-w-0 ${c.deleted ? 'line-through' : ''}`}
                disabled={c.deleted}
              />
              <select
                value={c.field || ''}
                onChange={(e) => changeField(c.id, e.target.value || null)}
                disabled={c.deleted}
                className="text-xs bg-paper border border-line rounded px-1.5 py-1 text-fg min-w-24 outline-none focus:border-accent"
              >
                <option value="">미분류</option>
                {FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleDelete(c.id)}
                className="text-xs px-2 py-1 bg-line text-fg rounded-chip hover:bg-accent-soft transition-colors whitespace-nowrap"
              >
                {c.deleted ? '복구' : '삭제'}
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-5 grid grid-cols-2 gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
          <button
            type="button"
            onClick={onClose}
            className="text-mono inline-flex min-h-btn items-center justify-center rounded-field border border-line bg-paper text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="text-mono inline-flex min-h-btn items-center justify-center rounded-field bg-accent text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-ink"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
