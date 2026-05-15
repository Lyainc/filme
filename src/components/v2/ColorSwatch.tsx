type SwatchVariant = 'white' | 'black' | 'gold' | 'custom';

interface ColorSwatchProps {
  variant: SwatchVariant;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: number;
}

export function ColorSwatch({ variant, color, selected = false, onClick, size = 28 }: ColorSwatchProps) {
  const bgClass =
    variant === 'white'
      ? 'bg-white border border-line'
      : variant === 'black'
      ? 'bg-black'
      : variant === 'gold'
      ? 'bg-[#D4AF37]'
      : '';

  const inlineStyle =
    variant === 'custom' && color
      ? { width: size, height: size, minWidth: size, minHeight: size, background: color }
      : { width: size, height: size, minWidth: size, minHeight: size };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full transition-all duration-150 cursor-pointer ${bgClass} ${
        selected ? 'ring-2 ring-accent ring-offset-2' : ''
      }`}
      style={inlineStyle}
    />
  );
}
