interface AutoSaveIndicatorProps {
  enabled: boolean;
  lastSavedAt: number | null;
  onToggle: () => void;
}

/** 자동 임시저장 on/off 스위치 겸 인디케이터 — 저장 시 ping으로 반짝이고, 클릭하면 토글한다(#436).
 * ping 애니메이션은 Tailwind 내장 keyframe(새 CSS 불필요), motion-safe:로 reduced-motion 자동 대응.
 * "자동저장" 캡션은 title 툴팁(터치 기기에서 안 뜸)에 기대지 않고도 점의 기능을 보이게 한다(#570).
 * 캡션은 버튼 바깥의 비상호작용 텍스트라 44px 히트 타깃(h-touch w-touch)엔 안 얹힌다 — 점만 h-2 w-2로 축소. */
export function AutoSaveIndicator({ enabled, lastSavedAt, onToggle }: AutoSaveIndicatorProps) {
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? '자동 임시저장 켜짐 — 클릭하면 꺼요' : '자동 임시저장 꺼짐 — 클릭하면 켜요'}
        title={enabled ? '자동 임시저장 켜짐' : '자동 임시저장 꺼짐'}
        onClick={onToggle}
        className="inline-flex h-touch w-touch items-center justify-end pr-1 transition-colors"
      >
        <span className="relative inline-flex h-2 w-2">
          {enabled && lastSavedAt !== null && (
            <span
              key={lastSavedAt}
              aria-hidden="true"
              className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 motion-safe:animate-[ping_600ms_ease-out_1]"
            />
          )}
          <span
            aria-hidden="true"
            className={`relative inline-flex h-2 w-2 rounded-full ${enabled ? 'bg-accent' : 'bg-fg-faint'}`}
          />
        </span>
      </button>
      <span aria-hidden="true" className="pointer-events-none whitespace-nowrap text-micro text-fg-muted">
        자동저장
      </span>
    </span>
  );
}
