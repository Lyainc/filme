import { Sprocket } from './Sprocket';
import { PhaseIndicator } from './PhaseIndicator';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentPhase: 1 | 2;
  onPhaseClick?: (phase: 1 | 2) => void;
  canAdvanceToPhase2?: boolean;
}

export function AppHeader({
  theme,
  onThemeChange,
  currentPhase,
  onPhaseClick,
  canAdvanceToPhase2 = false,
}: AppHeaderProps) {
  const steps = [
    {
      label: '영화 정보',
      status: (currentPhase > 1 ? 'done' : currentPhase === 1 ? 'active' : 'pending') as 'done' | 'active' | 'pending',
      onClick: onPhaseClick ? () => onPhaseClick(1) : undefined,
    },
    {
      label: '티켓 디자인',
      status: (currentPhase === 2 ? 'active' : 'pending') as 'done' | 'active' | 'pending',
      onClick: canAdvanceToPhase2 && onPhaseClick ? () => onPhaseClick(2) : undefined,
    },
  ];

  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-line bg-surface shrink-0">
      <div className="flex items-center gap-2">
        <Sprocket size={20} className="text-accent" />
        <span
          className="font-display text-fg"
          style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}
        >
          Phototicket
        </span>
      </div>

      <PhaseIndicator steps={steps} />

      <div className="flex items-center gap-2">
        <a
          href="https://github.com/Lyainc/PhototicketMaker"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub 저장소"
          className="inline-flex items-center text-fg-muted hover:text-fg transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}
