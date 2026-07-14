/**
 * 눈 아이콘(#355, v8 시안 §5·§6) — 윤곽만으론 작은 크기에서 눈으로 안 읽혀 뜬 상태는 동공을
 * 채운다. 인플레이스 필드바(InPlaceFieldEditor)·눈 토글(VisibilityCheckbox)·필드 드로어가 공유.
 */
export function EyeIcon({ open, size = 17 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d="M10.7 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.5 3.5M6.6 6.6C3.7 8.6 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2" />
          <path d="m3 3 18 18" />
        </>
      )}
    </svg>
  );
}

interface VisibilityCheckboxProps {
  /** 현재 티켓에 표시되는지 여부 */
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 필드 이름(한글) — aria/tooltip에 사용 */
  label: string;
}

/**
 * 입력란 라벨 옆에 붙는 "티켓 표시 여부" 눈 토글.
 * 네이티브 체크박스에서 눈+채운 동공 아이콘 스위치로 교체(#355, v8 시안 §5) — 데스크톱
 * FieldAccordion·모바일 필드 드로어가 공유한다. 항상 상호작용 가능해야 하므로
 * 입력란을 흐리는 dim/disabled 래퍼 *바깥*(라벨 행)에 배치할 것.
 */
export default function VisibilityCheckbox({ checked, onChange, label }: VisibilityCheckboxProps) {
  return (
    // 아이콘을 패딩으로 44px 탭타깃까지 넓히고, 같은 크기의 음수 마진으로 시각 레이아웃은
    // 그대로 둔다(인접 gap 안쪽으로만 확장 — 레이아웃 불변). (#199 P3 패턴, #355에서 44px로 상향)
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      aria-label={`${label} 티켓에 표시`}
      title={checked ? '티켓에 표시 중 — 끄면 숨겨져요' : '티켓에서 숨김 — 켜면 표시돼요'}
      className={`-m-[13px] inline-flex shrink-0 cursor-pointer p-[13px] transition-colors ${
        checked ? 'text-fg' : 'text-fg-faint'
      }`}
    >
      <EyeIcon open={checked} size={18} />
    </button>
  );
}
