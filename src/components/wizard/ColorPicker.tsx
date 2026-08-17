import { cn } from '@/utils/cn';
import { inputVariants } from '@/components/ui/variants';

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
  const displayHex = value.toUpperCase();

  return (
    <div className="space-y-field">
      <div className={`flex flex-wrap items-center gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
        {swatches.map((s) => {
          const active = s.value.toLowerCase() === lowerValue;
          return (
            <button
              key={s.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(s.value)}
              title={s.label}
              aria-label={s.label}
              data-touch="44"
              // active:scale-[0.97]은 선택 스와치엔 안 얹는다(#647 리뷰) — 선택 상태의 정적
              // scale-105와 :active 규칙이 동시에 걸리면 특이성상 :active가 이겨(scale-105보다
              // scale-[0.97]의 명시성이 높음) 눌렀을 때 105%에서 105%가 아니라 그 미만인 97%로
              // 순간 줄었다 튀는 깜빡임이 생긴다. 선택 스와치는 이미 scale-105로 상태가
              // 또렷하니 나머지(미선택)만 눌림 피드백을 받는다.
              className={`relative inline-flex min-h-touch min-w-touch items-center justify-center rounded-chip border-2 transition-transform ${
                active
                  ? 'border-accent scale-105'
                  : 'border-line hover:border-accent/40 active:scale-[0.97]'
              }`}
              style={{
                // 46px — rail 상세패널 공통 칩 크기(#367, 무드·후보정 칩과 동일).
                width: 46,
                height: 46,
                // 이중 링: 내부 bg-gap + accent 링으로 작은 원에서도 활성 상태 또렷
                boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
              }}
            >
              <span
                className="block h-7 w-7 rounded-chip"
                style={{
                  backgroundColor: s.value,
                  boxShadow: 'inset 0 0 0 1px rgba(44,38,34,0.08)',
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

        {/* 시각 라벨 없이 title/aria로만 — 스와치·무드·후보정 칩과 같은 문법. 375px에서
            'custom' 텍스트가 고아 줄바꿈을 만들던 Eyebrow는 제거(#190). */}
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
              isCustom ? 'border-accent scale-105' : 'border-line hover:border-accent/40'
            }`}
            style={{
              background:
                'conic-gradient(from 0deg, #C08079, #D4B483, #8FA99E, #7E93A8, #9A8BA3, #C08079)',
              boxShadow: isCustom ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
            }}
            aria-hidden
          />
        </label>

        {/* 헥스 직접 입력 — 스와치 줄에 인라인(#678). 예전엔 전폭 행(w-full, text-title
            16px + py-2.5 + tracking-widest)이 슬롯 폭 361px를 혼자 다 먹었다. 폰트는
            16px(text-title) 그대로 둔다 — iOS가 16px 미만 입력에 포커스 시 화면을 자동
            확대하는 걸 막는 하한(variants.ts 주석)이라 줄일 수 있는 건 폭뿐이다. */}
        <div
          className={`inline-flex h-[46px] items-stretch overflow-hidden rounded-chip border-2 border-line ${disabled ? '' : 'focus-within:border-accent'}`}
        >
          <span
            aria-hidden
            className="inline-flex shrink-0 items-center justify-center border-r border-line px-2 text-body text-fg-muted"
          >
            #
          </span>
          <input
            type="text"
            disabled={disabled}
            value={displayHex.replace('#', '')}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
              onChange(`#${sanitized}`);
            }}
            maxLength={6}
            aria-label="색상 코드"
            placeholder="FFFFFF"
            className={cn(
              inputVariants({ surface: 'paper' }),
              // focus-visible:ring-2(inputVariants 기본)는 부모의 overflow-hidden에 잘려
              // 오른쪽·아래가 끊긴 채로 보인다 — 링을 끄고 부모의 focus-within:border-accent
              // 하나로 포커스 표시를 통일한다.
              'text-mono w-[92px] border-0 px-2.5 text-title uppercase text-fg transition-colors placeholder:text-fg-muted focus-visible:ring-0 disabled:cursor-not-allowed',
            )}
          />
        </div>
      </div>

      {/* 잠금 안내는 컨트롤(스와치·헥스) 바로 뒤에 붙인다(#678) — 예전엔 패널 맨 위에 있어
          슬롯이 넘칠 때 아래로 스크롤해 헥스 입력을 보면 문구가 화면 밖으로 나갔다. 컨트롤
          바로 다음 형제로 두면 둘 중 어느 쪽을 보려고 스크롤해도 같이 딸려온다. */}
      {disabled && disabledNote && (
        <p className="text-caption text-fg-muted">{disabledNote}</p>
      )}
    </div>
  );
}
