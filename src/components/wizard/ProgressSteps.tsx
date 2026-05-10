import type { WizardStep } from '@/hooks/useWizard';

interface ProgressStepsProps {
  current: WizardStep;
  completed: ReadonlySet<WizardStep>;
  onJump: (step: WizardStep) => void;
}

const STEPS: ReadonlyArray<{ id: WizardStep; label: string }> = [
  { id: 1, label: 'Poster' },
  { id: 2, label: 'Film' },
  { id: 3, label: 'Mood' },
  { id: 4, label: 'Export' },
];

export default function ProgressSteps({ current, completed, onJump }: ProgressStepsProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Wizard progress">
      {STEPS.map((s, i) => {
        const isActive = current === s.id;
        const isDone = completed.has(s.id);
        const state = isActive ? 'active' : isDone ? 'done' : 'pending';
        const reachable = isActive || isDone;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => reachable && onJump(s.id)}
              disabled={!reachable}
              aria-current={isActive ? 'step' : undefined}
              data-state={state}
              data-touch="44"
              className={`group flex min-h-touch items-center gap-2 rounded-chip px-3 py-1.5 text-mono text-[11px] uppercase tracking-widest transition-colors
                ${isActive ? 'bg-accent text-white' : ''}
                ${state === 'done' ? 'text-fg hover:bg-accent-soft' : ''}
                ${state === 'pending' ? 'text-fg-faint cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium
                  ${isActive ? 'bg-paper/25 text-white' : ''}
                  ${state === 'done' ? 'bg-accent-soft text-accent-ink' : ''}
                  ${state === 'pending' ? 'border border-hairline text-fg-faint' : ''}`}
              >
                {isDone ? '✓' : s.id}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="hidden h-px w-6 bg-hairline md:inline-block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
