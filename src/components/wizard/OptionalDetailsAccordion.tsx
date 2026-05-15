import { useId, useState, type ReactNode } from 'react';

interface OptionalDetailsAccordionProps {
  title?: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function OptionalDetailsAccordion({
  title = 'Optional details',
  hint = '관람 시간 · 좌석 · 평점 등 선택 항목',
  defaultOpen = false,
  children,
}: OptionalDetailsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const panelId = `optdetails-${reactId}`;

  return (
    <div className="rounded-card border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        <span aria-hidden className="text-fg-muted transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ⌄
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
