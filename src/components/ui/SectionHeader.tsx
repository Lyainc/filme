interface SectionHeaderProps {
  index: string;
  title: string;
  caption?: string;
}

export default function SectionHeader({ index, title, caption }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-baseline justify-between border-b border-white/[0.06] pb-3">
      <div className="flex items-baseline gap-4">
        <span className="text-mono text-[11px] uppercase tracking-widest text-gold">[{index}]</span>
        <h2 className="text-display text-xl font-normal tracking-tight text-paper md:text-[22px]">
          {title}
        </h2>
      </div>
      {caption && (
        <span className="hidden text-mono text-[10px] uppercase tracking-widest text-bone-500 md:block">
          {caption}
        </span>
      )}
    </div>
  );
}
