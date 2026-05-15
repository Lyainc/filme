import { ReactNode } from 'react';

interface SectionBlockProps {
  eyebrow?: string;
  title?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function SectionBlock({ eyebrow, title, required, children, className = '' }: SectionBlockProps) {
  return (
    <div
      className={`rounded-card bg-surface-elevated p-5 space-y-4 ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {(eyebrow || title) && (
        <div className="space-y-0.5">
          {eyebrow && (
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
              {eyebrow}
            </p>
          )}
          {title && (
            <h3 className="text-base font-semibold text-fg">
              {title}
              {required && <span className="ml-1 text-accent">*</span>}
            </h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
