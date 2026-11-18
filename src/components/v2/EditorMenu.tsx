import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { handleRadioGroupKeyDown } from '@/utils/radioGroupKeyboard';
import type { ThemePreference } from '@/constants/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

const ROW_CLS = 'flex min-h-touch w-full items-center gap-3 border-t border-hair px-3 text-left text-body text-ink first:border-t-0';
const CARD_CLS = 'overflow-hidden rounded-md border border-hair-strong bg-s2';

// 초기화 2탭 arm(#374) — 1탭에 arm(라벨이 확인 문구로 바뀌고 3.2초 뒤 자동 해제), 한 번 더 탭해야 실행.
// 습관적 더블탭이 arm과 실행을 한 번에 뚫지 않게 arm 직후 350ms 재탭은 무시한다(PR #375 P1).
const CLEAR_ARM_MS = 3200;
const CLEAR_DOUBLE_TAP_GUARD_MS = 350;

/** '11:42 저장' — 마지막 자동저장 시각 메타(D09). 자동저장이 꺼져 있거나 아직 저장 전이면 없다. */
export function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} 저장`;
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative h-[26px] w-11 shrink-0 rounded-[13px] transition-colors', checked ? 'bg-ink' : 'bg-hair-strong')}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] h-5 w-5 rounded-[10px] border transition-transform',
          checked ? 'translate-x-[18px] border-transparent bg-stage' : 'border-hair-strong bg-s2',
        )}
      />
    </span>
  );
}

function SwitchRow({
  label,
  meta,
  checked,
  onToggle,
  ariaLabel,
  title,
  buttonRef,
}: {
  label: string;
  meta?: string;
  checked: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  title?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      onClick={onToggle}
      className={cn(pressableVariants(), ROW_CLS, 'transition-colors')}
    >
      <span className="min-w-0 flex-1 truncate">
        {label}
        {meta && <small className="ml-1.5 text-caption text-ink-3">{meta}</small>}
      </span>
      <Switch checked={checked} />
    </button>
  );
}

function ActionRow({
  children,
  onClick,
  disabled = false,
  busy,
  armed,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** 주면 초기화 행이다 — arm 문구 전환을 스크린리더에 알린다. */
  armed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={cn(pressableVariants(), ROW_CLS, 'transition-colors disabled:opacity-70', armed && 'font-semibold text-warn')}
    >
      <span className="min-w-0 flex-1 truncate" aria-live={armed === undefined ? undefined : 'polite'}>
        {children}
      </span>
    </button>
  );
}

/**
 * 편집 메뉴 시트(#826 S2 D09) — 카드 두 장(설정 · 문서), 행 44, 머리줄 없음. 아래에서 올라오는 시트지만 끌어서 닫는
 * 동작은 없어 손잡이도 없다. 닫기는 바깥(스크림) 탭 · ⋯ 재탭 · Escape.
 *
 * 열려 있는 동안만 마운트된다 — 그래서 초기화 arm 상태가 닫힘과 함께 저절로 풀리고, 열릴 때 첫 행으로 포커스가 가고,
 * 그냥 닫힐 때(Escape · 스크림 · ⋯ 재탭)는 언마운트에서 ⋯로 돌아간다(행 동작으로 닫힐 땐 안 돌아간다). role=dialog + aria-modal(APG dialog)이지만 앱 배경을 inert로 잠그지 않는다:
 * 스크림이 상단 줄 아래부터라 ⋯ 재탭 닫기가 살아 있어야 해서다. fixed 좌표는 PhoneFrame의 contain:paint가 프레임 안에
 * 가둔다(#609).
 */
export function EditorMenu({
  ghost,
  onGhostChange,
  themePreference,
  onThemeChange,
  autoSaveEnabled,
  lastSavedAt,
  onAutoSaveToggle,
  onOcrOpen,
  ocrBusy,
  onSaveDraft,
  onClear,
  onClose,
  returnFocusRef,
}: {
  ghost: boolean;
  onGhostChange: (next: boolean) => void;
  themePreference: ThemePreference;
  onThemeChange: (next: ThemePreference) => void;
  autoSaveEnabled: boolean;
  lastSavedAt: number | null;
  onAutoSaveToggle: () => void;
  /** 랜딩에 한 벌뿐인 OcrUploadCard의 업로드 열기(constraint-17). */
  onOcrOpen: () => void;
  ocrBusy: boolean;
  onSaveDraft: () => void;
  /** 실제 초기화 — 2탭 arm을 통과한 뒤에만 불린다. */
  onClear: () => void;
  onClose: () => void;
  /** 닫힐 때 포커스가 돌아갈 ⋯ 버튼. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const armedAt = useRef(0);
  // 포커스는 **그냥 닫힐 때만** ⋯로 돌아간다(Escape · 스크림 · ⋯ 재탭). 행이 일을 하고 닫을 땐 그 일이 포커스를 쥔다 —
  // 자동입력은 파일 선택을 열고, 초기화 · 임시저장은 메뉴를 떠난 흐름이라 ⋯로 끌어오면 오히려 어긋난다.
  const restoreFocusRef = useRef(true);
  const closeAfterAction = () => {
    restoreFocusRef.current = false;
    onClose();
  };

  useEffect(() => {
    firstRowRef.current?.focus();
    const trigger = returnFocusRef.current;
    return () => {
      clearTimeout(armTimer.current);
      if (restoreFocusRef.current) trigger?.focus();
    };
  }, [returnFocusRef]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Tab이 시트 밖으로 새지 않게 가둔다(aria-modal).
  function onDialogKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const items = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])') ?? [],
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleClearTap() {
    if (!clearArmed) {
      setClearArmed(true);
      armedAt.current = Date.now();
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setClearArmed(false), CLEAR_ARM_MS);
      return;
    }
    if (Date.now() - armedAt.current < CLEAR_DOUBLE_TAP_GUARD_MS) return;
    clearTimeout(armTimer.current);
    closeAfterAction();
    onClear();
  }

  return (
    <>
      {/* 스크림은 상단 줄(52px) 아래부터다 — 덮으면 ⋯ 재탭이 스크림에 먹혀 "닫기"가 아니라 우연한 닫힘이 된다. */}
      <div className="fixed inset-x-0 bottom-0 top-[52px] z-40" onClick={onClose} aria-hidden="true" data-testid="editor-menu-scrim" />
      <div
        ref={dialogRef}
        id="editor-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="편집 메뉴"
        onKeyDown={onDialogKeyDown}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 rounded-t-[12px] border-t border-hair-strong bg-s1 px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div role="group" aria-label="설정" className={CARD_CLS}>
          {/* aria-label은 보이는 글자와 같다 — 기기 검증 스크립트(scripts/ios-sim/run768.py)가 속성 셀렉터로 집는다. */}
          <SwitchRow
            buttonRef={firstRowRef}
            label="빈 항목 표시"
            ariaLabel="빈 항목 표시"
            checked={ghost}
            onToggle={() => onGhostChange(!ghost)}
          />
          <div role="radiogroup" aria-label="테마" onKeyDown={handleRadioGroupKeyDown} className={cn(ROW_CLS, 'justify-between')}>
            <span className="flex-1">테마</span>
            <span className="-mr-3 inline-flex shrink-0">
              {THEME_OPTIONS.map((o) => {
                const selected = o.value === themePreference;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => onThemeChange(o.value)}
                    className={cn(
                      'grid min-h-touch min-w-[52px] place-items-center border-l border-hair px-2 text-body transition-colors',
                      selected ? 'bg-s1 font-semibold text-ink' : 'text-ink-2',
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </span>
          </div>
          <SwitchRow
            label="자동저장"
            meta={autoSaveEnabled && lastSavedAt !== null ? formatSavedAt(lastSavedAt) : undefined}
            checked={autoSaveEnabled}
            onToggle={onAutoSaveToggle}
            // 상태 라벨은 상태 명사구, 끄고 켜는 방법은 title(COPY_TONE_GUIDE 축 2 예외) — 보이는 라벨 '자동저장'을 이름에 담는다(2.5.3).
            ariaLabel={autoSaveEnabled ? '자동저장 켜짐' : '자동저장 꺼짐'}
            title={autoSaveEnabled ? '자동저장 켜짐 — 클릭하면 꺼요' : '자동저장 꺼짐 — 클릭하면 켜요'}
          />
        </div>
        <div role="group" aria-label="문서" className={CARD_CLS}>
          <ActionRow
            disabled={ocrBusy}
            busy={ocrBusy}
            onClick={() => {
              // 파일 선택은 사용자 제스처 안에서 열려야 해서 닫기보다 먼저 호출한다.
              onOcrOpen();
              closeAfterAction();
            }}
          >
            {ocrBusy ? '티켓 인식 중…' : '스크린샷으로 자동입력'}
          </ActionRow>
          <ActionRow
            onClick={() => {
              closeAfterAction();
              onSaveDraft();
            }}
          >
            임시저장
          </ActionRow>
          <ActionRow armed={clearArmed} onClick={handleClearTap}>
            {clearArmed ? '한 번 더 눌러 전체 삭제' : '초기화'}
          </ActionRow>
        </div>
      </div>
    </>
  );
}
