'use client';

import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { getLayout } from '@/utils/layouts';
import type { LayoutId, MovieInfo, TicketComponents, TicketField } from '@/types';
import type { SheetTarget } from '@/constants/fields';

// 무드 4종은 한 번에 하나만 렌더되므로 각각 별도 청크로 분리해 초기 번들에서 제외.
// ssr: false — 캡처(captureToImage)는 프리뷰가 이미 보이는(=청크 로드 완료) 시점의
// 사용자 액션이라 로딩 placeholder와 캡처 타이밍이 충돌하지 않음.
const MoodMinimal = dynamic(() => import('./moods/MoodMinimal').then((m) => m.MoodMinimal), { ssr: false });
const MoodCriterion = dynamic(() => import('./moods/MoodCriterion').then((m) => m.MoodCriterion), { ssr: false });
const Mood35mm = dynamic(() => import('./moods/Mood35mm').then((m) => m.Mood35mm), { ssr: false });
const MoodEditorial = dynamic(() => import('./moods/MoodEditorial').then((m) => m.MoodEditorial), { ssr: false });
const MoodStub = dynamic(() => import('./moods/MoodStub').then((m) => m.MoodStub), { ssr: false });
const Mood35mmLandscape = dynamic(() => import('./moods/Mood35mmLandscape').then((m) => m.Mood35mmLandscape), { ssr: false });

interface TicketRendererProps {
  croppedImageUrl: string;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility?: Record<TicketField, boolean>;
  /**
   * 빈 항목 미리보기(ghost, #216) — 모바일 전용. undefined면 데스크톱/기존 호출자로 간주해
   * 오늘의 동작(스탬프 placeholder 항상 on, 필드 placeholder off)을 그대로 둔다. 데스크톱 프리뷰
   * 호출부는 이 프롭을 넘기지 않는다.
   */
  ghost?: boolean;
  /**
   * 온-티켓 탭 편집(#259) — 모바일 default 줌 전용. 넘기면 무드 필드/포스터가 탭 가능해진다.
   * 캡처(ResultPanel)·데스크톱·max/actual 줌은 안 넘겨 비인터랙티브(포커스링/탭UI 유출 원천 차단).
   */
  onField?: (field: SheetTarget) => void;
  onPosterTap?: () => void;
}

const SCALE_EPSILON = 0.001;

// 프리뷰 컨테이너의 세로 상한. MobileEditorShell의 max 모드 width 역산이 이 값을 그대로
// 참조하므로(둘이 어긋나면 잘림/여백 발생) 단일 소스로 export한다.
export const PREVIEW_MAX_HEIGHT = 'min(72vh, 720px)';

const TicketRenderer = memo(forwardRef<HTMLDivElement, TicketRendererProps>(function TicketRenderer(
  { croppedImageUrl, movieInfo, components, fieldVisibility, ghost, onField, onPosterTap },
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
        maxHeight: PREVIEW_MAX_HEIGHT,
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
          fieldVisibility={fieldVisibility}
          ghost={ghost}
          onField={onField}
          onPosterTap={onPosterTap}
        />
      </div>
    </div>
  );
}));

const Mood = memo(function Mood({
  layoutId,
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
  ghost,
  onField,
  onPosterTap,
}: {
  layoutId: LayoutId;
  croppedImageUrl: string;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility?: Record<TicketField, boolean>;
  ghost?: boolean;
  onField?: (field: SheetTarget) => void;
  onPosterTap?: () => void;
}) {
  const props = { croppedImageUrl, movieInfo, components, fieldVisibility, ghost, onField, onPosterTap };
  switch (layoutId) {
    case 'minimal':
      return <MoodMinimal {...props} />;
    case 'criterion':
      return <MoodCriterion {...props} />;
    case '35mm':
      return <Mood35mm {...props} />;
    case 'editorial':
      return <MoodEditorial {...props} />;
    case 'stub':
      return <MoodStub {...props} />;
    case '35mm-landscape':
      return <Mood35mmLandscape {...props} />;
  }
});

export default TicketRenderer;
