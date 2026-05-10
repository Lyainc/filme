import { useState } from 'react';

interface RatingPickerProps {
  value: number;
  show: boolean;
  onValueChange: (rating: number) => void;
  onShowChange: (show: boolean) => void;
}

export default function RatingPicker({ value, show, onValueChange, onShowChange }: RatingPickerProps) {
  const [hover, setHover] = useState(0);
  const current = hover || value || 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">Rating</span>
        <label className="text-mono inline-flex cursor-pointer items-center gap-2 text-[10px] uppercase tracking-widest text-fg-faint">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => onShowChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Show on ticket
        </label>
      </div>

      {show && (
        <div className="flex items-center gap-4">
          <div
            className="flex gap-1.5"
            onMouseLeave={() => setHover(0)}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={value}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={(e) => onValueChange(computeRating(e, star))}
                onMouseMove={(e) => setHover(computeRating(e, star))}
                aria-label={`${star} stars`}
                data-touch="44"
                className="relative inline-flex min-h-touch min-w-touch items-center justify-center"
              >
                <span className="relative inline-block h-7 w-7">
                  <StarSVG className="absolute inset-0 text-fg-faint/40" />
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      width:
                        current >= star
                          ? '100%'
                          : current >= star - 0.5
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
          <span className="text-mono text-[12px] tracking-widest text-fg-muted">
            {current.toFixed(1)} <span className="text-fg-faint">/ 5.0</span>
          </span>
        </div>
      )}
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
