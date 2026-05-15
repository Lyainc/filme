interface SectionHeaderProps {
  index: string;
  title: string;
  caption?: string;
}

export default function SectionHeader({ index, title, caption }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
      <div className="flex items-baseline gap-3">
        <span className="text-mono text-[11px] uppercase tracking-widest text-accent-ink">
          [{index}]
        </span>
        <h2 className="text-[18px] font-medium tracking-tight text-fg md:text-[20px]">
          {title}
        </h2>
      </div>
      {caption && (
        <span className="hidden text-mono text-[10px] uppercase tracking-widest text-fg-faint md:block">
          {caption}
        </span>
      )}
    </div>
  );
}
