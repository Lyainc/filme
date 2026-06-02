type PhaseStatus = 'done' | 'active' | 'pending';

interface PhaseStep {
  label: string;
  status: PhaseStatus;
  onClick?: () => void;
}

interface PhaseIndicatorProps {
  steps: PhaseStep[];
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M10.28 2.28 4.75 7.81 1.72 4.78.28 6.22l4.47 4.47 7-7-1.47-1.41z" />
    </svg>
  );
}

export function PhaseIndicator({ steps }: PhaseIndicatorProps) {
  return (
    <nav aria-label="진행 단계" className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <button
            type="button"
            onClick={step.onClick}
            disabled={!step.onClick}
            aria-current={step.status === 'active' ? 'step' : undefined}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors duration-150 ${
              step.onClick ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                step.status === 'done'
                  ? 'bg-accent-soft text-accent'
                  : step.status === 'active'
                  ? 'bg-accent text-white'
                  : 'bg-surface-elevated border border-line text-fg-muted'
              }`}
            >
              {step.status === 'done' ? <CheckIcon /> : index + 1}
            </span>
            <span
              className={`sr-only whitespace-nowrap sm:not-sr-only ${
                step.status === 'active' ? 'text-accent' : 'text-fg-muted'
              }`}
            >
              {step.label}
            </span>
          </button>
          {index < steps.length - 1 && (
            <span className="h-px w-6 bg-line shrink-0" aria-hidden="true" />
          )}
        </div>
      ))}
    </nav>
  );
}
