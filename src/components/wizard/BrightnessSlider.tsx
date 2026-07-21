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

export default function BrightnessSlider({
  value,
  onChange,
  label = 'Poster brightness',
  id = 'posterOpacity',
  min = 0,
  max = 1,
}: BrightnessSliderProps) {
  return (
    <div className="space-y-field">
      <div className="flex items-baseline justify-between">
        <Eyebrow as="label" htmlFor={id}>
          {label}
        </Eyebrow>
        <Eyebrow tone="accent">{Math.round(value * 100)}%</Eyebrow>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
