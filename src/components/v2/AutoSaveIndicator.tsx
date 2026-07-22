interface AutoSaveIndicatorProps {
  enabled: boolean;
  lastSavedAt: number | null;
  onToggle: () => void;
}

/** 자동 임시저장 on/off 스위치 겸 인디케이터 — 저장 시 ping으로 반짝이고, 클릭하면 토글한다(#436).
 * ping 애니메이션은 Tailwind 내장 keyframe(새 CSS 불필요), motion-safe:로 reduced-motion 자동 대응. */
export function AutoSaveIndicator({ enabled, lastSavedAt, onToggle }: AutoSaveIndicatorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? '자동 임시저장 켜짐 — 클릭하면 꺼요' : '자동 임시저장 꺼짐 — 클릭하면 켜요'}
      title={enabled ? '자동 임시저장 켜짐' : '자동 임시저장 꺼짐'}
      onClick={onToggle}
      className="inline-flex h-11 w-11 items-center justify-center transition-colors"
    >
      <span className="relative inline-flex h-2.5 w-2.5">
        {enabled && lastSavedAt !== null && (
          <span
            key={lastSavedAt}
            aria-hidden="true"
            className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 motion-safe:animate-[ping_600ms_ease-out_1]"
          />
        )}
        <span
          aria-hidden="true"
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${enabled ? 'bg-accent' : 'bg-fg-faint'}`}
        />
      </span>
    </button>
  );
}
