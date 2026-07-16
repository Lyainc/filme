import { useState } from 'react';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';

interface RatingPickerProps {
  value: number;
  onValueChange: (rating: number) => void;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
}

export default function RatingPicker({ value, onValueChange, visible, onVisibleChange }: RatingPickerProps) {
  const [hover, setHover] = useState(0);
  const current = hover || value || 0;
  // 별 채움은 0.5 단위로 내림(#384 결정 스펙: 3.3 → 별 3개, 3.5~3.9 → 별 3개 반) — 저장값(텍스트)은 입력 그대로 유지.
  const starRating = Math.floor(current * 2) / 2;

  return (
    <div className="space-y-field">
      <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="평점" />

      <div className={`flex items-center gap-4 ${visible ? '' : 'opacity-40'}`}>
          <div
            className="flex gap-1.5"
            onMouseLeave={() => setHover(0)}
            role="radiogroup"
            aria-label="별점"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={value >= star}
                onClick={(e) => onValueChange(computeRating(e, star))}
                onMouseMove={(e) => setHover(computeRating(e, star))}
                aria-label={`${star}점`}
                data-touch="44"
                className="relative inline-flex min-h-touch min-w-touch items-center justify-center"
              >
                <span className="relative inline-block h-7 w-7">
                  <StarSVG className="absolute inset-0 text-fg-faint/40" />
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      width:
                        starRating >= star
                          ? '100%'
                          : starRating >= star - 0.5
                          ? '50%'
                          : '0%',
                    }}
                  >
                    <StarSVG className="text-accent" />
                  </span>
                </span>
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={value || 0}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isNaN(next)) onValueChange(Math.min(5, Math.max(0, next)));
            }}
            aria-label="평점 직접 입력 (0.1 단위)"
            className="text-mono w-14 rounded-field border border-line bg-transparent px-1.5 py-1 text-[12px] text-fg outline-none focus:border-accent"
          />
          <span className="text-mono text-[12px] tracking-widest text-fg-muted">
            {current.toFixed(1)} <span className="text-fg-faint">/ 5.0</span>
          </span>
        </div>
    </div>
  );
}

function computeRating(e: React.MouseEvent<HTMLElement>, star: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const isHalf = e.clientX - rect.left < rect.width / 2;
  return isHalf ? star - 0.5 : star;
}

function StarSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-7 w-7 ${className}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
