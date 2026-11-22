import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Eyebrow } from '@/components/v2/Eyebrow';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { shouldCommitSliderValue } from './BrightnessSlider';
import { cn } from '@/utils/cn';
import { inputVariants, pressableVariants } from '@/components/ui/variants';

interface RatingPickerProps {
  value: number;
  onValueChange: (rating: number) => void;
  /** 표시 토글은 옛 시트(FieldEditorBody RatingSheet)만 넘긴다 — 입력 패널은 정보 목록 눈으로만 바꾼다(#826 S3 constraint-7). */
  visible?: boolean;
  onVisibleChange?: (next: boolean) => void;
}

/** 입력 패널 한 줄 높이에 맞춘 16px 입력(#826 S3 constraint-3 · 10) — 보이는 높이 36. */
const DECIMAL_INPUT_CLS = cn(inputVariants({ surface: 'glass' }), 'tabular-nums h-9 w-full min-w-0 rounded-ctl px-3 text-title text-ink');

const STARS = [1, 2, 3, 4, 5];
const LONG_PRESS_MS = 500;
const DRAG_MOVE_THRESHOLD = 8; // px — 이 이상 움직여야 드래그로 보고 롱프레스 타이머를 취소한다.

/**
 * 별 줄(row) 폭 기준 0.5 단위 별점(#496) — 별 5개×반개=10등분해 offsetX가 속한 구간을 그대로 반환.
 * 개별 버튼 rect 대신 row 전체 폭 하나만 재는 이유는 드래그 중 5개 버튼 rect를 매 pointermove마다
 * 다시 재는 것보다 싸고, gap을 포함해 전체 폭을 매끄러운 스케일로 다루는 편이 터치 드래그에 자연스럽기
 * 때문. 순수 함수로 뽑아 happy-dom의 getBoundingClientRect(항상 0) 제약 없이 직접 테스트한다.
 */
export function ratingFromRowOffset(offsetX: number, rowWidth: number): number {
  if (rowWidth <= 0) return 0;
  const segments = STARS.length * 2;
  const halfWidth = rowWidth / segments;
  const segment = Math.min(segments - 1, Math.floor(Math.max(0, offsetX) / halfWidth));
  return (segment + 1) * 0.5;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

/**
 * 별 줄과 숫자(소수 입력) 두 조각을 따로 돌려준다(#826 S3 K-05) — 입력 패널은 숫자를 첫 줄 입력 자리에, 별을 둘째 줄에
 * 놓는다. 값 · 드래그 · 롱터치 상태는 하나라 두 조각이 같은 값을 본다.
 */
export function useRatingPicker({
  value,
  onValueChange,
  dim = false,
  resetKey,
  onEnter,
  enterKeyHint,
  panel = false,
}: {
  value: number;
  onValueChange: (rating: number) => void;
  dim?: boolean;
  /** 이 값이 바뀌면 소수 입력을 접는다 — 입력 패널은 필드가 바뀌어도 살아 있어 평점으로 돌아오면 처음 상태여야 한다. */
  resetKey?: unknown;
  /** 소수 입력의 Return — 입력 패널은 다음 항목(마지막이면 완료)으로 잇는다(#826 S3 constraint-3). */
  onEnter?: (e: KeyboardEvent<HTMLInputElement>) => void;
  enterKeyHint?: 'next' | 'done';
  /**
   * 입력 패널 배치(D16 4-A): 숫자 조각이 [− 숫자 +] 스테퍼(0.1, 누르고 있으면 반복)가 되고, 별 줄이 패널 폭을 다 쓴다.
   * 숫자를 누르면 그 자리가 소수 입력으로 바뀐다. 옛 시트(RatingPicker 기본 export)는 이 배치를 안 쓴다.
   */
  panel?: boolean;
}): { stars: ReactNode; number: ReactNode } {
  const [hoverPreview, setHoverPreview] = useState(0);
  const [numberInputOpen, setNumberInputOpen] = useState(false);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setNumberInputOpen(false);
  }

  // #507과 동일한 지연 커밋 패턴(BrightnessSlider) — 드래그 중 매 pointermove마다 onValueChange를
  // 바로 부르면 부모 state가 틱마다 바뀌어 티켓이 리렌더로 튄다. 별점은 0.5 단위(최대 11값)라 슬라이더
  // 만큼 틱이 몰리진 않지만 같은 위험이라 같은 가드를 재사용한다.
  const [localValue, setLocalValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }
  const deferredValue = useDeferredValue(localValue);
  useEffect(() => {
    if (shouldCommitSliderValue(deferredValue, localValue, value)) onValueChange(deferredValue);
  }, [deferredValue, localValue, value, onValueChange]);

  const dragRef = useRef<DragState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 별 채움은 0.5 단위로 내림(#384 결정 스펙: 3.3 → 별 3개, 3.5~3.9 → 별 3개 반) — 저장값(텍스트)은 입력 그대로 유지.
  const current = hoverPreview || localValue || 0;
  const starRating = Math.floor(current * 2) / 2;

  function clearLongPressTimer() {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  useEffect(() => clearLongPressTimer, []);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPreview(0);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setLocalValue(ratingFromRowOffset(e.clientX - rect.left, rect.width));
    // 롱터치(#496) — 움직이지 않은 채 LONG_PRESS_MS가 지나면 소수 입력을 편다. 드래그로 판정되면
    // handlePointerMove가 이 타이머를 취소한다.
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      if (dragRef.current && !dragRef.current.moved) setNumberInputOpen(true);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) {
      // 눌림 없이 지나가는 마우스는 미리보기만(클릭 전 확정 안 함) — 터치엔 hover 개념이 없다.
      if (e.pointerType === 'mouse') {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverPreview(ratingFromRowOffset(e.clientX - rect.left, rect.width));
      }
      return;
    }
    if (!drag.moved) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD) {
        drag.moved = true;
        clearLongPressTimer();
      }
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setLocalValue(ratingFromRowOffset(e.clientX - rect.left, rect.width));
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      clearLongPressTimer();
    }
  }

  // 스테퍼(D16 4-A) — 0.1씩, 0~5로 묶는다. 부동소수 오차는 한 자리로 반올림해 끊는다.
  const repeatRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRepeat = () => {
    if (repeatRef.current != null) {
      clearTimeout(repeatRef.current);
      repeatRef.current = null;
    }
  };
  useEffect(() => stopRepeat, []);
  // 마우스 호버 미리보기가 떠 있어도 스테퍼는 저장된 값에서 출발한다 — 미리보기를 걷어 보이는 값과 맞춘다.
  const bump = (dir: 1 | -1) => {
    setHoverPreview(0);
    setLocalValue((v) => Math.min(5, Math.max(0, Math.round(((v || 0) + dir * 0.1) * 10) / 10)));
  };
  // 포인터 누름이 이미 한 칸을 올렸으면 뒤따르는 click은 건너뛴다. detail(0=키보드)로 가르면 스크린리더 가상 클릭이
  // 포인터 이벤트와 함께 와 한 번에 두 칸이 될 수 있어, 누름을 직접 기억한다.
  const pointerBumpedRef = useRef(false);
  // 버튼이 지금 눌려 있는지 — 떼기 전에 밖으로 나가거나 취소된 누름만 '버린 누름'이다. 터치 · 펜은 같은 제스처에서
  // pointerup → pointerleave → click 순으로 오므로, 뗀 뒤의 leave가 플래그를 내리면 click이 한 칸을 더 올린다(PR #842 리뷰).
  const pressedRef = useRef(false);
  const releasePress = () => {
    stopRepeat();
    pressedRef.current = false;
  };
  const abandonPress = () => {
    stopRepeat();
    if (pressedRef.current) pointerBumpedRef.current = false;
    pressedRef.current = false;
  };
  // 누르면 한 번, 누르고 있으면 400ms 뒤부터 80ms마다 반복. 주 버튼(왼쪽 클릭 · 터치 · 펜)만 — 오른쪽 클릭은 메뉴가
  // 뜨며 pointerup을 삼켜 반복이 멈추지 않는다. 메뉴 · 포커스 잃음에도 멈춘다.
  const stepperProps = (dir: 1 | -1) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      pointerBumpedRef.current = true;
      pressedRef.current = true;
      bump(dir);
      stopRepeat();
      const tick = (delay: number) => {
        repeatRef.current = setTimeout(() => {
          bump(dir);
          tick(80);
        }, delay);
      };
      tick(400);
    },
    // 떼기(pointerup)는 뒤따르는 click이 플래그를 내린다. 눌린 채 밖으로 끌고 나가거나 취소되면 click이 안 와 플래그가
    // 남아 다음 키보드 click 한 번을 삼키므로, 눌린 상태의 그 길들에선 반복과 함께 플래그도 내린다(PR #842 리뷰).
    onPointerUp: releasePress,
    onPointerLeave: abandonPress,
    onPointerCancel: abandonPress,
    onContextMenu: abandonPress,
    onBlur: abandonPress,
    onClick: () => {
      if (pointerBumpedRef.current) pointerBumpedRef.current = false;
      else bump(dir);
    },
  });

  const stars = (
    <div
      // -ml-2(#422): 별 버튼은 44px 탭타깃 안에 28px 별을 중앙정렬해 좌측에 8px 여백이 생긴다 — 줄 시작선을 맞추려 당긴다.
      // 패널(D16 4-A)은 별 다섯이 패널 폭을 나눠 가져 한 칸이 약 70px — 반 칸 드래그가 쉬워진다(ratingFromRowOffset은 줄 폭 기준).
      className={cn(panel ? 'flex w-full' : '-ml-2 flex gap-1.5', dim && 'opacity-40')}
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => {
        if (!dragRef.current) setHoverPreview(0);
      }}
      role="radiogroup"
      aria-label="별점"
    >
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={localValue >= star}
          // 키보드 접근성 전용 — 포인터/터치 클릭은 위 row 핸들러가 처리한다. 실제 포인터 클릭도
          // click 이벤트를 내지만 detail>=1이라 여기선 걸러지고, 키보드 Enter/Space는 detail===0.
          onClick={(e) => {
            if (e.detail === 0) setLocalValue(star);
          }}
          aria-label={`${star}점`}
          data-touch="44"
          className={cn(pressableVariants(), 'relative inline-flex min-h-touch min-w-touch items-center justify-center', panel && 'flex-1')}
        >
          <span className={cn('relative inline-block', panel ? 'h-8 w-8' : 'h-7 w-7')}>
            <StarSVG className={cn('absolute inset-0 text-ink-3/40', panel && 'h-8 w-8')} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{
                width:
                  starRating >= star
                    ? '100%'
                    : starRating >= star - 0.5
                    ? '50%'
                    : '0%',
              }}
            >
              <StarSVG className={cn('text-accent', panel && 'h-8 w-8')} />
            </span>
          </span>
        </button>
      ))}
    </div>
  );

  // 소수 입력 토글(#496) — 항상 뜨는 숫자 상자가 과하다는 지적으로 접어 두고, 별 롱터치(위 핸들러) 또는 이 숫자 탭으로
  // 편다. aria-label을 고정해 두는 이유는 표시값(예: "★ 3.3")이 바뀔 때마다 접근명이 같이 흔들리면 스크린리더 사용자가
  // 매번 다른 라벨을 듣기 때문 — 값은 시각 전용, 의미는 라벨 하나로 고정. 표기는 티켓 얼굴·fieldPreview와 같은 `★ N.N`(#445).
  const decimalInput = (
        <input
          id="rating-decimal-input"
          type="number"
          // 숫자 키패드에 소수점이 있어야 0.1 단위를 넣는다(#826 S3 K-05) — type=number만으론 iOS가 소수점 없는 키패드를 줄 수 있다.
          inputMode="decimal"
          min={0}
          max={5}
          step={0.1}
          value={localValue || 0}
          onChange={(e) => {
            const raw = e.target.value;
            // 지우는 중(raw==='')엔 커밋하지 않는다 — Number('')===0이라 그대로 두면
            // 재입력 전 순간적으로 평점이 0으로 찍힌다(#190 nit, PR #409 claude-review).
            if (raw === '') return;
            const next = Number(raw);
            if (!Number.isNaN(next)) setLocalValue(Math.min(5, Math.max(0, next)));
          }}
          onKeyDown={(e) => {
            // 패널(D16 4-A)은 숫자 버튼 자리가 입력으로 바뀌어 접는 버튼이 없다 — Escape로 숫자로 되돌린다.
            if (panel && e.key === 'Escape') {
              e.preventDefault();
              setNumberInputOpen(false);
              return;
            }
            onEnter?.(e);
          }}
          enterKeyHint={enterKeyHint}
          // 패널에선 숫자를 누른 그 자리에 입력이 열려 바로 친다(키보드가 올라온다). 옛 시트는 토글 옆에 열려 그대로 둔다.
          autoFocus={panel}
          // 포커스가 떠나면(다른 컨트롤 · 바깥 탭) 숫자로 접는다 — 값은 치는 대로 이미 반영돼 있다.
          onBlur={panel ? () => setNumberInputOpen(false) : undefined}
          aria-label="평점 직접 입력 (0.1 단위)"
          // 16px 미만이면 iOS Safari가 포커스 시 자동 줌인해 레이아웃이 틀어진다(#274).
          className={DECIMAL_INPUT_CLS}
        />
  );
  const stepBtn = 'inline-flex h-touch w-touch shrink-0 items-center justify-center';
  const stepBox = 'inline-flex h-9 w-touch items-center justify-center rounded-ctl border border-hair-strong text-title text-ink';
  const number = panel ? (
    <div className={cn('flex min-w-0 flex-1 items-center gap-1', dim && 'opacity-40')}>
      <button type="button" aria-label="평점 0.1 내리기" {...stepperProps(-1)} className={cn(pressableVariants(), stepBtn)}>
        <span className={stepBox} aria-hidden="true">−</span>
      </button>
      {numberInputOpen ? (
        <div className="min-w-0 flex-1">{decimalInput}</div>
      ) : (
        <button
          type="button"
          onClick={() => setNumberInputOpen(true)}
          aria-controls="rating-decimal-input"
          aria-label="평점 소수 입력 토글"
          className={cn(pressableVariants(), 'tabular-nums inline-flex h-touch min-w-0 flex-1 items-center justify-center text-title font-semibold text-ink')}
        >
          {current.toFixed(1)}
        </button>
      )}
      <button type="button" aria-label="평점 0.1 올리기" {...stepperProps(1)} className={cn(pressableVariants(), stepBtn)}>
        <span className={stepBox} aria-hidden="true">+</span>
      </button>
    </div>
  ) : (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${dim ? 'opacity-40' : ''}`}>
      <button
        type="button"
        onClick={() => setNumberInputOpen((open) => !open)}
        aria-expanded={numberInputOpen}
        aria-controls="rating-decimal-input"
        aria-label="평점 소수 입력 토글"
        className={cn(pressableVariants(), 'tabular-nums inline-flex min-h-touch shrink-0 items-center text-left')}
      >
        <Eyebrow tone="faint">
          ★ {current.toFixed(1)}
        </Eyebrow>
      </button>

      {numberInputOpen && decimalInput}
    </div>
  );

  return { stars, number };
}

export default function RatingPicker({ value, onValueChange, visible = true, onVisibleChange }: RatingPickerProps) {
  const { stars, number } = useRatingPicker({ value, onValueChange, dim: !visible });
  return (
    <div className="space-y-field">
      {onVisibleChange && <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="평점" />}
      <div className="space-y-3">
        {stars}
        {number}
      </div>
    </div>
  );
}

function StarSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={cn('h-7 w-7', className)} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
