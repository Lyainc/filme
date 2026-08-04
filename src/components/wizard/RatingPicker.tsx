import { useDeferredValue, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eyebrow } from '@/components/v2/Eyebrow';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { shouldCommitSliderValue } from './BrightnessSlider';
import { cn } from '@/utils/cn';
import { tapTarget } from '@/utils/tapTarget';

interface RatingPickerProps {
  value: number;
  onValueChange: (rating: number) => void;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
}

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

export default function RatingPicker({ value, onValueChange, visible, onVisibleChange }: RatingPickerProps) {
  const [hoverPreview, setHoverPreview] = useState(0);
  const [numberInputOpen, setNumberInputOpen] = useState(false);

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

  return (
    <div className="space-y-field">
      <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="평점" />

      <div className={`space-y-3 ${visible ? '' : 'opacity-40'}`}>
        <div
          // -ml-2(#422): 별 버튼은 44px 탭타깃 안에 28px 별을 중앙정렬해 좌측에 8px 여백이 생기고,
          // 노출 토글(VisibilityCheckbox)은 음수 마진으로 탭타깃만 넓혀 아이콘이 좌측에 그대로
          // 붙는다 — 두 행의 좌측 시작선을 맞추려 그 8px만큼 별 그룹 전체를 당긴다.
          className="-ml-2 flex gap-1.5"
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
              className={cn(tapTarget({ shape: 'square' }), 'relative inline-flex items-center justify-center')}
            >
              <span className="relative inline-block h-7 w-7">
                <StarSVG className="absolute inset-0 text-fg-faint/40" />
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
                  <StarSVG className="text-accent" />
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* 소수 입력 토글(#496) — 항상 뜨는 풀폭 number 박스가 과하다는 지적으로 접어 두고, 별
            롱터치(위 핸들러) 또는 이 캡션 탭으로 편다. aria-label을 고정해 두는 이유는 표시값(예:
            "★ 3.3")이 바뀔 때마다 접근명이 같이 흔들리면 스크린리더 사용자가 매번 다른 라벨을
            듣기 때문 — 값은 시각 전용, 의미는 라벨 하나로 고정.
            표기는 티켓 얼굴·fieldPreview와 같은 `★ N.N`(#445) — 분모는 위 별 5개가 이미 보여준다. */}
        <button
          type="button"
          onClick={() => setNumberInputOpen((open) => !open)}
          aria-expanded={numberInputOpen}
          aria-controls="rating-decimal-input"
          aria-label="평점 소수 입력 토글"
          className={cn(tapTarget(), 'text-mono inline-flex items-center text-left')}
        >
          <Eyebrow tone="faint">
            ★ {current.toFixed(1)}
          </Eyebrow>
        </button>

        {numberInputOpen && (
          <input
            id="rating-decimal-input"
            type="number"
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
            aria-label="평점 직접 입력 (0.1 단위)"
            // 16px 미만이면 iOS Safari가 포커스 시 자동 줌인해 레이아웃이 틀어진다(#274) — FieldEditorBody의
            // INPUT_CLS와 동일 톤(글래스 서피스·풀폭·16px)으로 통일(#435). RatingPicker→FieldEditorBody
            // 순환 import를 피하려 리터럴을 중복하니, 톤을 바꿀 땐 두 곳을 같이 고칠 것.
            className="text-mono w-full rounded-field border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-3 text-title text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        )}
      </div>
    </div>
  );
}

function StarSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-7 w-7 ${className}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
