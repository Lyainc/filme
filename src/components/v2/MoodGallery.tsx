import { useMatchMedia } from '@/hooks/useMatchMedia';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { LAYOUTS } from '@/utils/layouts';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';
import TicketRenderer from '../TicketRenderer';

const SAMPLE_WIDTH = 132;

function MoodSample({
  layoutId,
  movieInfo,
  components,
  onSelect,
  fixedWidth,
  duplicate,
}: {
  layoutId: LayoutId;
  movieInfo: MovieInfo;
  components: TicketComponents;
  onSelect: (id: LayoutId) => void;
  fixedWidth?: boolean;
  /** marquee 트랙의 2벌째 사본(seamless loop용) — 스크린리더 낭독·Tab 순회에서 제외한다. */
  duplicate?: boolean;
}) {
  const layout = LAYOUTS.find((l) => l.id === layoutId)!;
  return (
    <button
      type="button"
      onClick={() => onSelect(layoutId)}
      tabIndex={duplicate ? -1 : 0}
      aria-hidden={duplicate || undefined}
      // 접근명을 티켓 렌더 서브트리(제목·필드 placeholder 등)에서 자동 계산시키지 않고 무드명
      // 하나로 고정 — 무드가 바뀔 때마다 흔들리는 이름이 아니라, 안에 뭐가 렌더되든 안정적으로
      // 이 값으로 쿼리할 수 있다(LayoutStrip 라디오와 같은 이유).
      aria-label={layout.label}
      className={`flex shrink-0 flex-col items-center gap-1.5 ${fixedWidth ? '' : 'w-full'}`}
      style={fixedWidth ? { width: SAMPLE_WIDTH } : undefined}
    >
      {/* 장식용 실제 렌더 — 위 aria-label이 접근명을 이미 고정했으니 서브트리는 스크린리더
          탐색에서 뺀다(중복 낭독 방지). */}
      <div aria-hidden="true">
        <TicketRenderer
          croppedImageUrl={null}
          movieInfo={movieInfo}
          components={components.layout === layoutId ? components : { ...components, layout: layoutId }}
          fieldVisibility={ALL_FIELDS_ON}
          ghost
        />
      </div>
      <span aria-hidden="true" className="text-micro font-medium text-fg-muted">{layout.label}</span>
    </button>
  );
}

/**
 * 히어로 무드 auto-scroll 갤러리(#615) — Landing이 쓰던 `LayoutStrip` 무드칩 자리를 대신한다.
 * 자산 이슈(#613)의 이미지 세트가 아직 없어, 지금은 `TicketRenderer`를 `croppedImageUrl=null` +
 * `ghost`로 무드 6종 실제 렌더한 게 곧 샘플이다.
 *
 * **클릭은 미리보기가 아니라 즉시 커밋이다** — 옛 무드칩은 히어로 프리뷰만 바꾸고 실제 진입은
 * CTA 3종에서 따로 일어났지만(Landing.tsx 컴포넌트 주석), 갤러리 샘플엔 그 중간 "훑어보기"
 * 단계가 없다. 클릭 자체가 다섯 번째 커밋 지점(부모의 `onSelect` → MobileEditorShell의
 * posterless 즉시 진입)이다.
 *
 * marquee는 리스트를 2벌 이어붙인 트랙을 -50% translateX로 돌리는 list-duplication 패턴으로
 * seamless loop을 만든다 — 2벌째 사본은 `aria-hidden` + `tabIndex=-1`로 스크린리더·키보드
 * 순회에서 뺀다(같은 이름의 버튼이 6개 더 잡히는 걸 막는다).
 *
 * `prefers-reduced-motion`에서는 트랙 자체를 안 그리고 6종을 줄바꿈 그리드로 정지 노출한다 —
 * 전역 CSS 가드(globals.css `@media (prefers-reduced-motion: reduce)`)는 animation-duration을
 * 0.01ms로 죽일 뿐이라, 그것만 믿으면 duplicated 트랙이 그대로 남아 "정지된 채 뒷부분이 잘린
 * 12칸"이 된다. 그래서 DOM 자체를 이 컴포넌트가 갈아끼운다.
 */
export function MoodGallery({
  movieInfo,
  components,
  onSelect,
}: {
  movieInfo: MovieInfo;
  components: TicketComponents;
  onSelect: (id: LayoutId) => void;
}) {
  const reducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');

  if (reducedMotion) {
    return (
      <div className="grid w-full grid-cols-2 gap-3" role="group" aria-label="무드 선택">
        {LAYOUTS.map((layout) => (
          <MoodSample
            key={layout.id}
            layoutId={layout.id}
            movieInfo={movieInfo}
            components={components}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" role="group" aria-label="무드 선택">
      <div className="flex animate-marquee gap-3">
        {LAYOUTS.map((layout) => (
          <MoodSample
            key={layout.id}
            layoutId={layout.id}
            movieInfo={movieInfo}
            components={components}
            onSelect={onSelect}
            fixedWidth
          />
        ))}
        {LAYOUTS.map((layout) => (
          <MoodSample
            key={`dup-${layout.id}`}
            layoutId={layout.id}
            movieInfo={movieInfo}
            components={components}
            onSelect={onSelect}
            fixedWidth
            duplicate
          />
        ))}
      </div>
    </div>
  );
}
