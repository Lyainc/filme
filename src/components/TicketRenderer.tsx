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
//
// **여기만 cqh가 아니라 vh다**(#605). cq 단위는 이름으로 컨테이너를 고를 수 없고 항상 "가장 가까운"
// 사이즈 컨테이너로 풀리는데, 아래 maxWidth를 쓰는 default 모드 TicketRenderer는 fit 스테이지
// (`MobileEditorShell`의 `container-type:size`, #366) **안에** 있다. 72cqh로 바꾸면 프레임이 아니라
// 그 스테이지 높이의 72%로 풀려 상한이 프리뷰 자신보다 작아지고 #563 불변식(226.8×362.3)이 깨진다.
// 폰 프레임은 데스크톱에서도 높이가 100dvh(뷰포트 전체)라 세로 축은 vh가 이미 프레임 기준과 같다 —
// 프레임이 좁히는 건 가로뿐이고, 그쪽은 이 상수를 안 쓴다.
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
        // 세로 상한은 max-height가 아니라 '그 높이를 채우는 폭'으로 건다(#532). max-height로 걸면
        // w-full이 잡은 폭은 그대로인 채 높이만 깎여 aspect-ratio가 깨지고, 폭 기준으로 잡힌
        // scale이 컨테이너보다 큰 트리를 만들어 하단이 overflow-hidden에 잘린다.
        maxWidth: `calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height})`,
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
