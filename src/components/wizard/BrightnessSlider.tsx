import { useDeferredValue, useEffect, useState } from 'react';
import { Eyebrow } from '@/components/v2/Eyebrow';

interface BrightnessSliderProps {
  value: number;
  onChange: (value: number) => void;
  /**
   * 슬라이더 라벨. 필수 — 예전 기본값('Poster brightness')은 호출부가 전부 한국어 라벨을
   * 넘겨서 아무도 안 쓰는 죽은 영어였고, 새 호출부가 빠뜨리면 영어가 튀어나왔다(#562).
   */
  label: string;
  /** input/label 연결 id. 한 화면에 두 슬라이더가 뜨면 고유해야 한다(#219). */
  id?: string;
  /** 슬라이더 하한. 기본 0(불투명도류). 로고 크기(#441)처럼 0..1을 벗어나는 범위도 재사용. */
  min?: number;
  /** 슬라이더 상한. 기본 1. */
  max?: number;
  /**
   * 라벨 줄에 붙는 보조 텍스트 액션(#682 다이어트) — 형압 패널의 "칠한 영역 지우기"처럼 이
   * 슬라이더에 종속된 동작을 별도 전폭 버튼(줄+간격 52px)으로 안 두고 라벨 옆에 접어, 슬라이더
   * 하나만큼의 세로 예산으로 둘을 같이 담는다. 옵션이라 기존 호출부는 전부 그대로다.
   */
  action?: { label: string; onClick: () => void };
}

// #507 — 드래그 중 매 onChange 틱마다 onChange(부모의 updateComponents)를 바로 부르면
// 960×1534 자연픽셀 TicketRenderer가 틱마다 통째로 리렌더·리스케일된다. thumb/% 라벨은
// localValue로 즉시 반응시키고, 실제 커밋(onChange 호출)은 useDeferredValue로 낮은 우선순위
// 렌더에 미뤄 React 스케줄러가 프레임당 최대 1회로 합쳐 내보내게 한다. 마운트 시 오탐 커밋을
// 막기 위해 deferredValue를 부모가 준 value와 비교해 실제로 달라졌을 때만 onChange를 부른다.

/**
 * deferredValue가 커밋해도 되는 상태인지 판정하는 순수 함수(claude-review PR #516 P1 후속) —
 * effect 밖으로 뽑은 이유는 "deferredValue가 localValue를 아직 못 따라잡은 과도기" 조건을
 * happy-dom act()의 동기 flush 없이 결정론적으로 테스트하기 위함. act()는 React 트랜지션을
 * 완전히 flush해버려 그 과도기 자체를 렌더 타이밍으로는 재현할 수 없다 — 판정 로직만 분리해
 * 값 조합으로 직접 검증한다. deferredValue !== localValue(아직 수렴 전)면 절대 커밋하지 않고,
 * 수렴했어도 이미 부모 value와 같으면(우리 자신의 커밋이 되돌아온 라운드트립) 커밋하지 않는다.
 */
export function shouldCommitSliderValue(deferredValue: number, localValue: number, value: number): boolean {
  return deferredValue === localValue && deferredValue !== value;
}

/** 값 축의 10%p — 드래그·화살표 한 틱(#562). 0..1은 10단계, 0.6..1.3(로고 크기)은 7단계. */
const SLIDER_STEP = 0.1;

const STEP_UP_KEYS = new Set(['ArrowRight', 'ArrowUp', 'PageUp']);
const STEP_DOWN_KEYS = new Set(['ArrowLeft', 'ArrowDown', 'PageDown']);

/** 0.1 배수 연산이 남기는 부동소수 꼬리(0.7000000000000001)를 % 표기 정밀도로 자른다. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 10% 스텝을 `<input type="range">`의 `step`이 아니라 여기서 거는 이유(#562) — `step`은 상호작용
 * 단위가 아니라 **값의 제약**이라, `step=0.1`이면 % 입력이 넣은 37%를 요소가 40%로 잘라낸다
 * (브라우저 실측). 그러면 "10% 스텝이 앗아간 세밀 조정을 % 입력이 대체한다"는 이슈의 전제가
 * 무너져 둘 중 하나만 한 것과 같아진다. 그래서 요소는 `step="any"`로 열어 두고 드래그 스냅과
 * 화살표 이동을 이 두 함수가 맡는다.
 */
export function snapToStep(value: number, min: number, max: number): number {
  // 클램프가 필요한 이유 — 격자에 얹히지 않은 하한(예: 0.65)이 생기면 스냅이 그 아래(0.6)로
  // 내려보낸다. 오늘 쓰는 범위는 넷 다 0.1 격자 위(0/1, 0.6/1.1, 0.6/1.3, 0.2/1 — #728 스탬프
  // 투명도)라 안 걸리지만, 걸리면 슬라이더가 제 min 밖의 값을 조용히 커밋한다.
  return Math.min(Math.max(round2(Math.round(value / SLIDER_STEP) * SLIDER_STEP), min), max);
}

/** 화살표 한 틱 — 격자 밖 값(% 직접 입력 직후)에서도 다음/이전 눈금으로 간다. */
export function stepFrom(value: number, dir: 1 | -1, min: number, max: number): number {
  const k = value / SLIDER_STEP;
  const n = dir > 0 ? Math.floor(k + 1e-6) + 1 : Math.ceil(k - 1e-6) - 1;
  return Math.min(Math.max(round2(n * SLIDER_STEP), min), max);
}

/** 자연수 % 입력을 값 축으로 되돌린다. 빈 문자열·비숫자는 null(= 커밋 안 함), 나머지는 범위로 클램프. */
export function parsePercentInput(raw: string, min: number, max: number): number | null {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(Math.max(n, Math.round(min * 100)), Math.round(max * 100)) / 100;
}

export default function BrightnessSlider({
  value,
  onChange,
  label,
  id = 'posterOpacity',
  min = 0,
  max = 1,
  action,
}: BrightnessSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  // % 입력 중의 날것 문자열. null이면 슬라이더 값을 그대로 보여준다 — 타이핑 중간 상태("", "1")를
  // 곧바로 값으로 바꾸면 커서가 튀고 0%로 한 번씩 커밋된다.
  const [draft, setDraft] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState(value);
  // 무드/재질 전환 기본값 적용, undo/redo 등 슬라이더 밖에서 value가 바뀌면 로컬도 맞춘다.
  // useEffect 동기화는 페인트 이후에야 반영돼 구값이 한 프레임 노출되므로(claude-review PR #516
  // P1), 렌더 중 state 조정(React 공식 패턴)으로 같은 렌더 안에서 맞춘다.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }
  const deferredValue = useDeferredValue(localValue);

  useEffect(() => {
    if (shouldCommitSliderValue(deferredValue, localValue, value)) onChange(deferredValue);
  }, [deferredValue, localValue, value, onChange]);

  const commitDraft = () => {
    if (draft === null) return;
    const next = parsePercentInput(draft, min, max);
    setDraft(null);
    if (next !== null) setLocalValue(next);
  };

  return (
    <div className="space-y-field">
      <div className="flex items-baseline justify-between">
        <span className="flex items-baseline gap-2">
          <Eyebrow as="label" htmlFor={id}>
            {label}
          </Eyebrow>
          {action && (
            // 라벨 옆 인라인 텍스트 액션이라 WCAG 2.5.8(AA)의 "문장/텍스트 블록 안" 예외 대상이라
            // 너비를 따로 강제할 필요는 없지만(폭은 텍스트 길이를 따라간다), 높이는 명시 클래스로
            // 못박는다 — line-height만으로 맞추면 24px 하한과 마진이 1px 미만이라 나중에 폰트
            // 토큰이 바뀌면 하한 밑으로 조용히 떨어질 수 있다(fresh-context 리뷰). h-7(28px)로
            // 하한보다 4px 여유를 두고 `flex items-center`로 line-height와 무관하게 채운다.
            <button
              type="button"
              onClick={action.onClick}
              className="-my-1 flex h-7 items-center px-1 text-micro text-fg-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-fg"
            >
              {action.label}
            </button>
          )}
        </span>
        {/* % 직접 입력(#562) — 10% 스텝이 앗아간 세밀 조정의 대체 경로라 둘은 같이 간다.
            라벨 줄에 인라인으로 얹는 배치가 필수다: 레일 상세 슬롯(#563)이 400×675에서 118px
            고정인데 투명도 탭 콘텐츠가 정확히 118px이라 여유가 0이다 — 새 줄로 내리면 슬라이더당
            +20~25px이라 그 탭부터 스크롤이 생긴다. Eyebrow와 같은 타이포를 그대로 입혀 줄 높이가
            안 변하고(밑줄은 text-decoration이라 레이아웃 박스 밖), dock·프리뷰 실측도 그대로다.
            소프트 키보드가 dock을 덮는 문제(#558)는 한 칸짜리 숫자 입력이라 감수한다 — 값이
            라벨 줄에 그대로 보여서 키보드가 떠도 무엇을 고치는지가 안 가린다. */}
        <span className="flex items-baseline">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`${label} 퍼센트`}
            value={draft ?? String(Math.round(localValue * 100))}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            // 폭 4.5ch — 로고 크기축 상한 "130"이 3자에 tracking-widest(0.1em)까지 얹혀 25px이라
            // 3.5ch(21px)에선 잘렸다(브라우저 실측). 폭만 늘어나고 줄 높이는 안 변한다.
            // 점선 밑줄이 "누르면 고칠 수 있다"는 유일한 정지 상태 신호다(text-decoration이라
            // 레이아웃 박스를 안 건드려 줄 높이가 그대로다). 포커스 표시는 globals.css의 전역
            // :focus-visible 링에 맡긴다 — outline-none으로 지우면 키보드 사용자가 위치를 잃는다.
            className="text-mono w-[4.5ch] bg-transparent text-right text-micro uppercase tracking-widest text-accent underline decoration-dotted underline-offset-2"
          />
          <Eyebrow tone="accent" aria-hidden="true">
            %
          </Eyebrow>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        // "any" + 수동 스냅(#562) — step 속성은 값 자체를 격자에 가둬서 % 입력의 37%를 40%로
        // 잘라낸다(위 snapToStep 주석). 드래그는 onChange에서 10%p 격자로 스냅하고, 화살표는
        // 아래 onKeyDown이 다음 눈금으로 옮긴다. 1%(0.01)는 100단계를 손가락으로 훑어야 해서
        // 모바일 터치로 원하는 값에 못 세웠다 — 그게 이 이슈의 출발점.
        step="any"
        value={localValue}
        onChange={(e) => setLocalValue(snapToStep(parseFloat(e.target.value), min, max))}
        // PageUp/Down도 같이 잡는다 — step="any"에서 네이티브 페이지 이동은 (max-min)/10이라
        // 로고 크기축(0.6..1.3)에선 0.07씩 움직여 격자 밖(0.67)에 선다. Home/End는 네이티브가
        // min/max로 보내고 둘 다 격자 위라 그대로 둔다.
        onKeyDown={(e) => {
          const dir = STEP_UP_KEYS.has(e.key) ? 1 : STEP_DOWN_KEYS.has(e.key) ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          setLocalValue(stepFrom(localValue, dir, min, max));
        }}
        className="w-full"
      />
    </div>
  );
}
