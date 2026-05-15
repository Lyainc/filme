type ChipState = 'selected' | 'unselected' | 'unavailable';

interface ChipProps {
  label: string;
  state?: ChipState;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, state = 'unselected', onClick, className = '' }: ChipProps) {
  const isUnavailable = state === 'unavailable';
  const isSelected = state === 'selected';

  const stateClasses = isSelected
    ? 'bg-accent text-white border-accent'
    : isUnavailable
    ? 'opacity-40 cursor-not-allowed bg-surface-elevated border-line text-fg'
    : 'bg-surface-elevated border-line text-fg hover:border-accent-hover cursor-pointer';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isUnavailable}
      disabled={isUnavailable}
      onClick={isUnavailable ? undefined : onClick}
      className={`inline-flex items-center justify-center rounded-chip px-3 min-h-[36px] text-sm font-medium border transition-colors duration-150 select-none ${stateClasses} ${className}`}
    >
      {label}
    </button>
  );
}
