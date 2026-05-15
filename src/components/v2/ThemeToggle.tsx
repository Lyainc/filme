interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onChange: (theme: 'light' | 'dark') => void;
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zM2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2zm18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2zM11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0zm0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41L4.58 18a1 1 0 0 0 1.41 1.41l1.06-1.05z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
    </svg>
  );
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-pressed={isDark}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      onClick={() => onChange(isDark ? 'light' : 'dark')}
      className="relative inline-flex items-center bg-surface-elevated border border-line rounded-chip min-h-[44px] px-2 gap-2 cursor-pointer transition-colors duration-150"
      style={{ minWidth: 72 }}
    >
      <span className={`transition-colors duration-150 ${!isDark ? 'text-accent' : 'text-fg-muted'}`}>
        <SunIcon />
      </span>
      <span
        className="absolute w-6 h-6 rounded-full bg-accent shadow-sm transition-transform duration-150"
        style={{
          top: '50%',
          transform: `translateY(-50%) translateX(${isDark ? '28px' : '0px'})`,
          left: 8,
        }}
        aria-hidden="true"
      />
      <span className={`transition-colors duration-150 ml-auto ${isDark ? 'text-accent' : 'text-fg-muted'}`}>
        <MoonIcon />
      </span>
    </button>
  );
}
