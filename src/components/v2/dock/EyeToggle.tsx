import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';

/** 도크 행 끝의 '티켓에 표시' 눈 토글 — 정보 행과 로고 행이 같이 쓴다. */
export function EyeToggle({
  label,
  on,
  onToggle,
  disabled,
  title,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} 티켓에 표시`}
      aria-pressed={on}
      disabled={disabled}
      title={title}
      onClick={onToggle}
      className={cn(
        pressableVariants(),
        `-mr-2 inline-flex h-touch w-touch shrink-0 items-center justify-center transition-colors disabled:opacity-40 ${on ? 'text-ink' : 'text-ink-3'}`,
      )}
    >
      <EyeIcon open={on} size={18} />
    </button>
  );
}
