import { useDeferredValue, useEffect, useState } from 'react';
import { Eyebrow } from '@/components/v2/Eyebrow';

interface BrightnessSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** 슬라이더 라벨. 기본은 데스크톱의 'Poster brightness'. 레일 듀얼 슬라이더가 재사용(#219). */
  label?: string;
  /** input/label 연결 id. 한 화면에 두 슬라이더가 뜨면 고유해야 한다(#219). */
  id?: string;
  /** 슬라이더 하한. 기본 0(불투명도류). 로고 크기(#441)처럼 0..1을 벗어나는 범위도 재사용. */
  min?: number;
  /** 슬라이더 상한. 기본 1. */
  max?: number;
}

// #507 — 드래그 중 매 onChange 틱마다 onChange(부모의 updateComponents)를 바로 부르면
// 960×1534 자연픽셀 TicketRenderer가 틱마다 통째로 리렌더·리스케일된다. thumb/% 라벨은
// localValue로 즉시 반응시키고, 실제 커밋(onChange 호출)은 useDeferredValue로 낮은 우선순위
// 렌더에 미뤄 React 스케줄러가 프레임당 최대 1회로 합쳐 내보내게 한다. 마운트 시 오탐 커밋을
// 막기 위해 deferredValue를 부모가 준 value와 비교해 실제로 달라졌을 때만 onChange를 부른다.
export default function BrightnessSlider({
  value,
  onChange,
  label = 'Poster brightness',
  id = 'posterOpacity',
  min = 0,
  max = 1,
}: BrightnessSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // 무드/재질 전환 기본값 적용, undo/redo 등 슬라이더 밖에서 value가 바뀌면 로컬도 맞춘다.
  // useEffect 동기화는 페인트 이후에야 반영돼 구값이 한 프레임 노출되므로(claude-review PR #516
  // P1), 렌더 중 state 조정(React 공식 패턴)으로 같은 렌더 안에서 맞춘다.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }
  const deferredValue = useDeferredValue(localValue);

  // deferredValue는 렌더 중 조정으로 localValue가 바뀐 직후 곧바로 따라잡지 못하고 한두 렌더
  // 뒤처진 채 커밋될 수 있다 — 그 과도기에 커밋하면 외부에서 갓 들어온 value를 구 deferredValue로
  // 즉시 덮어써버린다. deferredValue가 localValue에 완전히 수렴했을 때만(=지연이 끝났을 때만) 커밋한다.
  useEffect(() => {
    if (deferredValue === localValue && deferredValue !== value) onChange(deferredValue);
  }, [deferredValue, localValue, value, onChange]);

  return (
    <div className="space-y-field">
      <div className="flex items-baseline justify-between">
        <Eyebrow as="label" htmlFor={id}>
          {label}
        </Eyebrow>
        <Eyebrow tone="accent">{Math.round(localValue * 100)}%</Eyebrow>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step="0.01"
        value={localValue}
        onChange={(e) => setLocalValue(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
