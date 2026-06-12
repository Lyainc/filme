import { ReactNode } from 'react';
import { AppHeader } from './AppHeader';

interface AppShellProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  rail?: ReactNode;
  children: ReactNode;
}

export function AppShell({ theme, onThemeChange, rail, children }: AppShellProps) {
  return (
    <div
      data-theme={theme}
      className="app-canvas"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}
    >
      <AppHeader theme={theme} onThemeChange={onThemeChange} />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>

        {rail && (
          <aside className="hidden rail:flex flex-col w-80 xl:w-96 shrink-0 border-l border-line bg-surface overflow-y-auto sticky top-0 h-screen shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.12)]">
            <div className="p-4 flex flex-col gap-4">
              {rail}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
