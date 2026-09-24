import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';

interface AutoSaveIndicatorProps {
  enabled: boolean;
  lastSavedAt: number | null;
  onToggle: () => void;
}

/** 자동 임시저장 on/off 스위치 겸 인디케이터 — 저장 시 ping으로 반짝이고, 클릭하면 토글한다(#436).
 * ping 애니메이션은 Tailwind 내장 keyframe(새 CSS 불필요), motion-safe:로 reduced-motion 자동 대응.
 * "자동저장" 캡션은 title 툴팁(터치 기기에서 안 뜸)에 기대지 않고도 점의 기능을 보이게 한다(#570).
 * 점과 캡션은 하나의 switch 버튼이 소유한다(#782) — 예전엔 캡션이 버튼 밖 pointer-events-none 텍스트라
 * 캡션을 누르면 아무 일도 안 일어났다. 버튼이 h-touch min-w-touch로 44px 이상 히트 타깃을 지키고, 점만 h-2 w-2로 작다(#570).
 * 캡션이 이 스위치의 보이는 라벨이 됐으니 접근성 이름도 그 글자("자동저장")를 담는다(WCAG 2.5.3 Label in Name,
 * docs/COPY_TONE_GUIDE.md 제약 ①) — 음성 제어 사용자가 보이는 글자로 부를 수 있어야 한다. */
export function AutoSaveIndicator({ enabled, lastSavedAt, onToggle }: AutoSaveIndicatorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? '자동저장 켜짐' : '자동저장 꺼짐'}
      title={enabled ? '자동저장 켜짐 — 클릭하면 꺼요' : '자동저장 꺼짐 — 클릭하면 켜요'}
      onClick={onToggle}
      className={cn(pressableVariants(), 'inline-flex h-touch min-w-touch items-center justify-center gap-1 px-1 transition-colors')}
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
      <span aria-hidden="true" className="whitespace-nowrap text-micro text-fg-muted">
        자동저장
      </span>
    </button>
  );
}
