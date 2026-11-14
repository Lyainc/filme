import { cn } from '@/utils/cn';
import {
  RAIL_CHIP_SELECTED_RING,
  RAIL_CHIP_SELECTED_SCALE,
  RAIL_CHIP_TOUCH,
  pressableVariants,
} from '@/components/ui/variants';
import { handleRadioGroupKeyDown } from '@/utils/radioGroupKeyboard';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  recommended: string[];
  /** true면 모든 컨트롤을 비활성화하고 안내(disabledNote)를 노출 — 색이 고정된 무드(35mm)용. */
  disabled?: boolean;
  disabledNote?: string;
}

const PRESETS = [
  { label: '흰색', value: '#FFFFFF' },
  { label: '검정', value: '#000000' },
  { label: '골드', value: '#E5B469' },
];

export default function ColorPicker({ value, onChange, recommended, disabled = false, disabledNote }: ColorPickerProps) {
  // 추천색이 프리셋과(또는 서로) 같은 hex일 수 있어 — 순백/순흑 단색 포스터 등 — value가
  // 곧 React key인 이상 중복이면 key 충돌 경고가 난다. 첫 항목(프리셋 우선)을 남기고
  // hex(대소문자 무시)로 dedupe한다(#105). 추출 단계 dedupe와 별개로 프리셋 충돌까지 막는다.
  const seen = new Set<string>();
  const swatches = [
    ...PRESETS,
    ...(recommended[0] ? [{ label: '추천색 1', value: recommended[0] }] : []),
    ...(recommended[1] ? [{ label: '추천색 2', value: recommended[1] }] : []),
  ].filter((s) => {
    const key = s.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const lowerValue = value.toLowerCase();
  const isCustom = !swatches.some((s) => s.value.toLowerCase() === lowerValue);

  return (
    <div className="space-y-field">
      <div className={`flex flex-wrap items-center gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
        {/* display:contents — 시각 레이아웃은 부모의 flex-wrap 행에 그대로 맡기고, ARIA
            트리에서만 스와치를 커스텀 라벨과 분리한다(#730 c4: radiogroup 안엔 radio만). */}
        <div
          role="radiogroup"
          aria-label="잉크 색"
          className="contents"
          onKeyDown={handleRadioGroupKeyDown}
        >
          {swatches.map((s, index) => {
            const active = s.value.toLowerCase() === lowerValue;
            // roving tabindex(#730 c3) — 선택된 스와치가 유일한 탭 스톱. 커스텀 색을 쓰는 중이라
            // 어떤 스와치도 선택 상태가 아니면(isCustom) 첫 스와치가 대신 탭 스톱을 맡는다.
            const tabIndex = active ? 0 : isCustom && index === 0 ? 0 : -1;
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={tabIndex}
                disabled={disabled}
                onClick={() => onChange(s.value)}
                title={s.label}
                aria-label={s.label}
                data-touch={RAIL_CHIP_TOUCH}
                // active:scale-[0.97]은 선택 스와치엔 안 얹는다(#647 리뷰) — 선택 상태의 정적
                // scale과 :active 규칙이 동시에 걸리면 특이성상 :active가 이겨 눌렀을 때 105%에서
                // 105%가 아니라 그 미만인 97%로 순간 줄었다 튀는 깜빡임이 생긴다. 선택 스와치는
                // 이미 확대로 상태가 또렷하니 나머지(미선택)만 눌림 피드백을 받는다.
                // min-h-touch/min-w-touch(44px 하한)는 안 붙인다 — 아래 인라인 46px가 이미
                // 하한을 넘고, 두 선언이 같이 있으면 __tests__/tapTargets.ts의 클래스 우선
                // 판정이 44를 읽어 실제 46px 렌더와 어긋난다(#730 ac7 실측).
                className={cn(
                  'relative inline-flex items-center justify-center rounded-chip border-2 transition-transform',
                  active
                    ? 'border-accent'
                    : ['border-line hover:border-accent/40', pressableVariants()],
                )}
                style={{
                  // 46px — rail 상세패널 공통 칩 크기(#367, 무드·후보정 칩과 동일).
                  width: 46,
                  height: 46,
                  // scale-* 클래스가 아니라 인라인 transform — __tests__/tapTargets.ts가 클래스
                  // 파싱으로 축소 우회를 막는 판정기라(#730 c6), 정적 확대는 클래스가 아니라
                  // 여기로만 걸어야 파서를 우회하지 않는다(TexturePicker·LayoutPicker와 동일 패턴).
                  transform: active ? RAIL_CHIP_SELECTED_SCALE : undefined,
                  // 이중 링: 내부 bg-gap + accent 링으로 작은 원에서도 활성 상태 또렷
                  boxShadow: active ? RAIL_CHIP_SELECTED_RING : undefined,
                }}
              >
                <span
                  // 46px 칩을 꽉 채운다(#730 c7) — 헥스 입력이 사라져 남는 시각 예산을 색
                  // 면적으로 돌린다. absolute inset-0가 border-2(4px)만큼 안쪽에서 딱 맞는다.
                  className="absolute inset-0 rounded-chip"
                  style={{
                    backgroundColor: s.value,
                    // 다크 테마 대응(#730 c8) — 고정 rgba(0,0,0,0.08)은 다크 앰비언트에서
                    // 대비가 거의 0이라 흰 스와치와 배경 경계가 안 보인다. DesignRail.tsx의
                    // 스크롤 그림자가 같은 함정을 var(--fg-faint)로 고친 선례를 따른다.
                    boxShadow: 'inset 0 0 0 1px var(--fg-faint)',
                  }}
                />
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center text-micro mix-blend-difference text-white"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 시각 라벨 없이 title/aria로만 — 스와치·무드·후보정 칩과 같은 문법. 375px에서
            'custom' 텍스트가 고아 줄바꿈을 만들던 Eyebrow는 제거(#190). radiogroup 밖(#730 c4) —
            확정된 값 중 하나를 고르는 라디오가 아니라 OS 피커를 여는 트리거다. */}
        <label
          title="직접 지정"
          className={`relative inline-flex min-h-touch min-w-touch items-center justify-center ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <input
            type="color"
            aria-label="직접 지정"
            disabled={disabled}
            value={isCustom ? value : '#FFFFFF'}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <span
            className={`flex h-[46px] w-[46px] items-center justify-center rounded-chip border-2 transition-transform ${
              isCustom ? 'border-accent' : 'border-line hover:border-accent/40'
            }`}
            style={{
              background:
                'conic-gradient(from 0deg, #C08079, #D4B483, #8FA99E, #7E93A8, #9A8BA3, #C08079)',
              transform: isCustom ? RAIL_CHIP_SELECTED_SCALE : undefined,
              boxShadow: isCustom ? RAIL_CHIP_SELECTED_RING : undefined,
            }}
            aria-hidden
          />
        </label>
      </div>

      {/* 잠금 안내는 컨트롤(스와치) 바로 뒤에 붙인다(#678, 헥스 제거 후에도 안내 인접 명제는
          유지 — #730 c10) — 예전엔 패널 맨 위에 있어 슬롯이 넘칠 때 아래로 스크롤해 컨트롤을
          보면 문구가 화면 밖으로 나갔다. 컨트롤 바로 다음 형제로 두면 스크롤해도 같이 딸려온다. */}
      {disabled && disabledNote && (
        <p className="text-caption text-fg-muted">{disabledNote}</p>
      )}
    </div>
  );
}
