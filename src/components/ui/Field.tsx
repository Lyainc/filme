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
          className="text-mono text-[10px] uppercase tracking-widest text-bone-400"
        >
          {label}
          {optional && <span className="ml-2 text-bone-500/60 normal-case">— optional</span>}
        </label>
        {meta && (
          <span className="text-mono text-[10px] uppercase tracking-widest text-bone-500">
            {meta}
          </span>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        className={`w-full border-0 border-b border-white/[0.12] bg-transparent px-0 py-2.5 text-[15px] text-paper outline-none transition-colors placeholder:text-bone-500/50 focus:border-gold ${className}`}
        {...props}
      />
      {hint && <p className="text-[11px] leading-relaxed text-bone-500">{hint}</p>}
    </div>
  );
});

export default Field;
