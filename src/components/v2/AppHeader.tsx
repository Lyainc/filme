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
          className="font-semibold text-fg"
          style={{ fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }}
        >
          Phototicket
        </span>
      </div>

      <PhaseIndicator steps={steps} />

      <ThemeToggle theme={theme} onChange={onThemeChange} />
    </header>
  );
}
