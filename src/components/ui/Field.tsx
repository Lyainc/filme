import { forwardRef } from 'react';

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  optional?: boolean;
  meta?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, optional, meta, id, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
        >
          {label}
          {optional && <span className="ml-2 normal-case text-fg-faint">— optional</span>}
        </label>
        {meta && (
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
            {meta}
          </span>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        className={`w-full rounded-field border hairline bg-paper px-3.5 py-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft ${className}`}
        {...props}
      />
      {hint && <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p>}
    </div>
  );
});

export default Field;
