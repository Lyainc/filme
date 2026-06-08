import { useId, type ReactNode } from 'react';

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

interface OptionalDetailsAccordionProps {
  title?: string;
  hint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export default function OptionalDetailsAccordion({
  title = 'Optional details',
  hint = '관람 시간 · 좌석 · 평점 등 선택 항목',
  open,
  onOpenChange,
  children,
}: OptionalDetailsAccordionProps) {
  const reactId = useId();
  const panelId = `optdetails-${reactId}`;

  return (
    <div className="rounded-card border border-line bg-paper">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        data-touch="44"
        className="text-mono flex min-h-touch w-full items-center justify-between gap-4 px-5 text-left transition-colors hover:bg-accent-soft"
      >
        <span className="flex flex-col items-start">
          <span className="text-[11px] uppercase tracking-widest text-fg-muted">{title}</span>
          <span className="mt-0.5 text-[12px] normal-case tracking-normal text-fg-faint">
            {hint}
          </span>
        </span>
        <span aria-hidden className="inline-flex text-fg-muted transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <div id={panelId} className="border-t border-line px-5 py-5">
          {children}
        </div>
      )}
    </div>
  );
}
