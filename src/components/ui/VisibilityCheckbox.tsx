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
    // 14px 체크박스를 label로 감싸 패딩으로 탭타깃을 넓히고, 같은 크기의 음수 마진으로
    // 시각 레이아웃은 그대로 둔다(인접 gap-2 안쪽으로만 확장 — 레이아웃 불변). (#199 P3)
    <label className="-m-2 inline-flex shrink-0 cursor-pointer p-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`${label} 티켓에 표시`}
        title={checked ? '티켓에 표시 중 — 끄면 숨겨져요' : '티켓에서 숨김 — 켜면 표시돼요'}
        className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
      />
    </label>
  );
}
