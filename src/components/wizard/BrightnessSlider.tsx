interface BrightnessSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** 슬라이더 라벨. 기본은 데스크톱 EditorCanvas의 'Poster brightness'. 레일 듀얼 슬라이더가 재사용(#219). */
  label?: string;
  /** input/label 연결 id. 한 화면에 두 슬라이더가 뜨면 고유해야 한다(#219). */
  id?: string;
}

export default function BrightnessSlider({
  value,
  onChange,
  label = 'Poster brightness',
  id = 'posterOpacity',
}: BrightnessSliderProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
        >
          {label}
        </label>
        <span className="text-mono text-[10px] uppercase tracking-widest text-accent">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
