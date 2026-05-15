import { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

interface AppShellProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  currentPhase: 1 | 2;
  onPhaseClick?: (phase: 1 | 2) => void;
  canAdvanceToPhase2?: boolean;
  rail?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  theme,
  onThemeChange,
  currentPhase,
  onPhaseClick,
  canAdvanceToPhase2,
  rail,
  children,
}: AppShellProps) {
  return (
    <div
      data-theme={theme}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}
    >
      <AppHeader
        theme={theme}
        onThemeChange={onThemeChange}
        currentPhase={currentPhase}
        onPhaseClick={onPhaseClick}
        canAdvanceToPhase2={canAdvanceToPhase2}
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>

        {rail && (
          <aside className="hidden lg:flex flex-col w-80 xl:w-96 shrink-0 border-l border-line bg-surface overflow-y-auto sticky top-0 h-screen">
            <div className="p-4 flex flex-col gap-4">
              {rail}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
