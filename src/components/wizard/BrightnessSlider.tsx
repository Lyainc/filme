interface BrightnessSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function BrightnessSlider({ value, onChange }: BrightnessSliderProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor="posterOpacity"
          className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
        >
          Poster brightness
        </label>
        <span className="text-mono text-[10px] uppercase tracking-widest text-accent">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        id="posterOpacity"
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
