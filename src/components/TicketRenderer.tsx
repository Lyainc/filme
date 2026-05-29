'use client';

import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { MoodMinimal } from './moods/MoodMinimal';
import { MoodCriterion } from './moods/MoodCriterion';
import { Mood35mm } from './moods/Mood35mm';
import { MoodEditorial } from './moods/MoodEditorial';
import { getLayout } from '@/utils/layouts';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';

interface TicketRendererProps {
  croppedImageUrl: string;
  movieInfo: MovieInfo;
  components: TicketComponents;
}

const SCALE_EPSILON = 0.001;

const TicketRenderer = forwardRef<HTMLDivElement, TicketRendererProps>(function TicketRenderer(
  { croppedImageUrl, movieInfo, components },
  ref
) {
  const layout = getLayout(components.layout);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const w = container.clientWidth;
      if (w <= 0) return;
      const next = w / layout.width;
      setScale((prev) => (Math.abs(prev - next) < SCALE_EPSILON ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [layout.width]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-black shadow-2xl shadow-black/40"
      style={{
        aspectRatio: `${layout.width} / ${layout.height}`,
        maxHeight: 'min(72vh, 720px)',
      }}
    >
      <div
        ref={ref}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: layout.width,
          height: layout.height,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }}
      >
        <Mood
          layoutId={components.layout}
          croppedImageUrl={croppedImageUrl}
          movieInfo={movieInfo}
          components={components}
        />
      </div>
    </div>
  );
});

const Mood = memo(function Mood({
  layoutId,
  croppedImageUrl,
  movieInfo,
  components,
}: {
  layoutId: LayoutId;
  croppedImageUrl: string;
  movieInfo: MovieInfo;
  components: TicketComponents;
}) {
  const props = { croppedImageUrl, movieInfo, components };
  switch (layoutId) {
    case 'minimal':
      return <MoodMinimal {...props} />;
    case 'criterion':
      return <MoodCriterion {...props} />;
    case '35mm':
      return <Mood35mm {...props} />;
    case 'editorial':
      return <MoodEditorial {...props} />;
  }
});

export default TicketRenderer;
