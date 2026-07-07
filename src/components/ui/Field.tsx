import { forwardRef, type ReactNode } from 'react';

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  optional?: boolean;
  meta?: string;
  /** 라벨 왼쪽에 붙는 보조 컨트롤(예: 표시여부 체크박스). dim/disabled와 무관하게 항상 클릭 가능. */
  labelAccessory?: ReactNode;
  /** 표시 OFF 시 입력은 막지 않고 흐리게만 표시(#130). disabled와 달리 편집은 항상 가능. */
  dimmed?: boolean;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, optional, meta, labelAccessory, dimmed, id, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          {labelAccessory}
          <label
            htmlFor={id}
            className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
          >
            {label}
            {optional && <span className="ml-2 normal-case text-fg-faint">— optional</span>}
          </label>
        </span>
        {meta && (
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
            {meta}
          </span>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        className={[
          'w-full rounded-field border border-line bg-paper px-3.5 py-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-40 disabled:cursor-not-allowed',
          dimmed && 'opacity-40',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      />
      {hint && <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p>}
    </div>
  );
});

export default Field;
