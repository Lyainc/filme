interface VisibilityCheckboxProps {
  /** 현재 티켓에 표시되는지 여부 */
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 필드 이름(한글) — aria/tooltip에 사용 */
  label: string;
}

/**
 * 입력란 라벨 옆에 붙는 "티켓 표시 여부" 인라인 체크박스.
 * 별도 'Display Fields' 칩 섹션을 대체한다(#116). 항상 상호작용 가능해야 하므로
 * 입력란을 흐리는 dim/disabled 래퍼 *바깥*(라벨 행)에 배치할 것.
 */
export default function VisibilityCheckbox({ checked, onChange, label }: VisibilityCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={`${label} 티켓에 표시`}
      title={checked ? '티켓에 표시 중 — 끄면 숨겨져요' : '티켓에서 숨김 — 켜면 표시돼요'}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
    />
  );
}
