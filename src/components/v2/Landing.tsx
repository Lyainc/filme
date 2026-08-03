import type { DragEvent, ReactNode } from 'react';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { LAYOUTS } from '@/utils/layouts';
import TicketRenderer from '../TicketRenderer';
import { AppFooter } from './AppFooter';
import { Wordmark } from './Wordmark';

/** 트랙 카드 폭 — 라벨을 없앤 대신 샘플 자체를 키운다(사용자 피드백). 세로는 TicketRenderer가
 *  각 무드의 실제 비율로 스스로 계산하므로 여기선 폭만 선언한다. */
const TRACK_CARD_WIDTH = 140;
/** 정지 그리드 카드 폭 — 트랙과 다른 값이다. 400×675 안에서 6장을 스크롤 없이 한 화면에 다 넣어야
 *  하는 정지 폴백은 트랙만큼 키우면 넘친다(실측 회귀) — 3열 그리드가 들어가는 최대치로 별도로 잡는다. */
const GRID_CARD_WIDTH = 92;

/**
 * 히어로 무드 auto-scroll 갤러리(#615 2026-08-04 개정) — 무드 6종을 실제 렌더 엔진(TicketRenderer,
 * ghost + croppedImageUrl=null, #613 이미지 자산 대기 중)으로 노출하고 자동으로 흘려보낸다.
 * 이전의 "칩으로 훑어보고 다른 CTA로 커밋"(LayoutStrip + heroLayout 로컬 미러)은 폐기됐다 — 샘플
 * 클릭 자체가 `onEnterMood`를 통해 그 무드를 즉시 커밋하는 독립된 다섯 번째 진입점이라, 훑어보기용
 * 중간 상태가 필요 없다. 무드 이름 라벨은 없다 — 이미지 자체를 키우는 쪽을 택했다(사용자 피드백):
 * `aria-label`엔 여전히 실려 있어 접근성 정보 손실은 없다.
 *
 * **탭 타깃과 눌림 피드백이 서로 다른 엘리먼트에 산다** — `<button>`은 `active:scale-[0.97]`을
 * 들고 있어(PrimaryCta·OcrUploadCard와 동일 패턴) `__tests__/tapTargets.ts`의 변형 금지 정규식
 * (`\S+:(?:h|w|size|scale|max-[hw])-`)에 그대로 걸린다 — 그래서 폭 선언은 그 클래스가 없는 안쪽
 * 카드 div가 인라인 style로 대신 지고(파서가 읽는 두 형태 중 인라인 px, TexturePicker 칩과 같은
 * 경우), 테스트는 그 안쪽 div만 잰다(LayoutStrip/TexturePicker가 스와치를 재고 바깥 버튼은 안
 * 재는 것과 같은 분리).
 *
 * **seamless loop의 뒤 절반은 접근성 트리에서 지운다** — 리스트를 두 벌 이어붙이는 marquee
 * 관용구라 같은 이름의 `<button>`이 12개 존재하는데, 뒤 절반은 시각적 연속을 위한 복제일 뿐 키보드
 * 사용자에게는 같은 무드로 가는 죽은 자리 6개가 더 생기는 셈이다(fresh-context 리뷰 지적). 뒤 절반만
 * `aria-hidden` + `tabIndex={-1}`로 접근성 트리·탭 순서에서 뺀다 — 포인터로는 여전히 두 벌 다 눌린다
 * (겹치는 시각 콘텐츠라 눌러도 같은 결과라 무해하다).
 *
 * **`prefers-reduced-motion`은 애니메이션만 죽이는 게 아니라 레이아웃을 바꾼다** — 전역 CSS 가드
 * (`globals.css`의 `@media (prefers-reduced-motion: reduce)`)가 이미 모든 `animation-duration`을
 * 0.01ms로 죽이지만, 그것만으로는 overflow-hidden 트랙이 스크롤 안 된 첫 프레임에 멈춰 6종 중 일부만
 * 보인다. `useMatchMedia`(PrimaryCta와 동일 훅)로 감지해 정지 시엔 트랙 대신 줄바꿈 그리드로 6종을
 * 한 화면에 전부 그린다 — 그리드 카드는 트랙보다 작은 별도 크기다(400×675 무스크롤 예산, 위 상수 참고).
 */
function MoodAutoScrollGallery({
  heroMovieInfo,
  heroComponents,
  onEnterMood,
}: {
  heroMovieInfo: MovieInfo;
  heroComponents: TicketComponents;
  onEnterMood: (id: LayoutId) => void;
}) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');

  const sample = (layout: (typeof LAYOUTS)[number], key: string, width: number, decorative: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => onEnterMood(layout.id)}
      aria-label={`${layout.label} 무드로 바로 시작 · ${layout.caption}`}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      title={layout.caption}
      data-touch={String(width)}
      className="shrink-0 transition-transform active:scale-[0.97]"
    >
      {/* 라벨이 없어져 카드 높이가 TicketRenderer 하나로 끝나므로, 무드별 실제 캔버스 비율로
          정확히 계산한다(가로 슬롯 2종은 세로 슬롯 4종보다 낮다) — 실측용 상수를 아무 무드에나
          똑같이 씌우면 가로 슬롯에서 여백이 남거나 잘린다. */}
      <div style={{ width, height: (width * layout.height) / layout.width }}>
        <TicketRenderer
          croppedImageUrl={null}
          movieInfo={heroMovieInfo}
          components={{ ...heroComponents, layout: layout.id }}
          fieldVisibility={ALL_FIELDS_ON}
          ghost
        />
      </div>
    </button>
  );

  if (prefersReducedMotion) {
    return (
      <div data-testid="mood-gallery" className="flex flex-wrap items-start justify-center gap-3">
        {LAYOUTS.map((layout) => sample(layout, layout.id, GRID_CARD_WIDTH, false))}
      </div>
    );
  }

  return (
    <div data-testid="mood-gallery" className="w-full overflow-hidden">
      {/* 리스트를 두 번 이어붙이고 -50%까지 트랜슬레이트하면 이음매 없는 순환 루프가 된다(marquee
          관용구) — 새 라이브러리 없이 keyframes + animation만으로 충분(#615 구현 지침).
          hover/focus-within에서 정지하는 건 SC 2.2.2(움직이는 콘텐츠 일시정지) 대응 — 계속 움직이는
          트랙 위에서 Tab으로 포커스가 옮겨가면 포커스 링이 흐르는 채로 잡혀 따라가기 어렵다. */}
      <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
        {LAYOUTS.map((layout) => sample(layout, `a-${layout.id}`, TRACK_CARD_WIDTH, false))}
        {LAYOUTS.map((layout) => sample(layout, `b-${layout.id}`, TRACK_CARD_WIDTH, true))}
      </div>
    </div>
  );
}

/**
 * 랜딩(#614 → #635 OCR 승격 → #615 무드 히어로) — 포스터가 아직 없을 때의 진입 화면.
 * 세 모드를 한 컴포넌트가 든다.
 *
 *  - `overlay`: 편집 셸 위를 덮는 `fixed` 레이어. 마케팅 카피 + 히어로 + OCR(주 CTA) + 고지.
 *  - `inline`:  오버레이를 걷었는데 포스터는 아직 없는 상태(드래프 복원 D7 · OCR 진입)의 본문
 *               블록. 카피/히어로 없이 진입 컨트롤만. 이 모드가 없으면 그 두 경로가 헤더만 남은
 *               빈 화면으로 떨어진다 — 포스터가 없으면 프리뷰·dock·드로어·완료가 전부 게이팅되고,
 *               특히 IndexedDB 포스터 복원 실패 시 "재업로드를 유도"하는 #489 결정 5의 경로가
 *               갈 곳을 잃는다.
 *  - `hidden`:  포스터가 있거나 max(#328). display:none이지 unmount가 아니다(아래).
 *
 * 새 라우트가 아니라 오버레이인 이유는 CTA가 파일 다이얼로그를 여는 데 있다: 라우트를 갈면
 * 사용자 제스처 컨텍스트가 끊겨 `input.click()`이 무시되는 브라우저가 있고, 오버레이면 셸이 이미
 * 마운트돼 있어 걷는 순간 지연 0으로 드러난다.
 *
 * **셸 안에서 렌더된다** — 이슈 #614의 구조도는 `index.tsx`의 형제로 그렸지만, 그러면 랜딩의 OCR
 * 진입점이 셸의 `OcrUploadCard`와 다른 인스턴스가 된다. 그 카드는 셸의 `useOcrUndo`·`ocrEpochRef`에
 * 배선돼 있고 진입점이 늘어나는 만큼 같은 상태를 쓰는 인스턴스가 늘어나므로, 셸이 쥔 하나를
 * children으로 받아 자리만 빌려준다. 모드가 갈려도 이 컴포넌트가 트리에 그대로 있어야 그 카드가
 * remount되지 않는다 — remount의 대가는 진행 중인 OCR의 로컬 상태(`isProcessing`·토스트)가
 * 리셋되는 것이다. (예전엔 in-flight KOBIS 보강 자체가 유실됐지만 #388/PR #413 P0이 그 판정을
 * 인스턴스 로컬 `mountedRef`에서 셸 소유 `ocrEpochRef`로 옮겨 unmount에도 안전해졌다 — 커밋
 * 007f381. #363/PR #372의 원래 레이스는 그쪽이 막는다.)
 *
 * `fixed`의 컨테이닝 블록은 뷰포트가 아니라 `PhoneFrame`이다(contain:paint, #607) — 데스크톱
 * 1440 뷰포트에서도 오버레이가 400px 프레임 안에 선다. `measure-chrome.mjs`의 frameFit 축이
 * 이걸 판정한다.
 *
 * **히어로는 이미지 자산이 아니라 실제 렌더 엔진이다(#615)** — #613(예시 이미지 수동 제작·번들)이
 * 아직 안 끝나 저작권 없는 무드 이미지가 없다. 대신 #631이 이미 열어둔 posterless 렌더 경로를
 * 그대로 써서 `TicketRenderer`를 `croppedImageUrl=null` + `ghost`로 띄운다 — 포스터 없이도
 * 무드의 조판·타이포·필드 자리는 실물 그대로 보인다. 실제 히어로 마크업은 `MoodAutoScrollGallery`
 * (아래) — 6종을 auto-scroll 트랙으로 동시에 보여준다(2026-08-04 설계 변경, D1 재검토: "동시에
 * 더 많이 보인다" 요건은 트랙이 그대로 만족해 크로스페이드 캐러셀로 되돌아가는 게 아니다).
 *
 * **샘플 클릭은 훑어보기가 아니라 즉시 커밋이다** — 예전 무드칩(`LayoutStrip`)은 셸의 `heroLayout`
 * 로컬 미러만 바꾸고 실제 `components.layout` 커밋은 다른 CTA가 맡았지만, auto-scroll 갤러리의
 * 샘플은 그 자체가 완결된 액션이다: 클릭하면 `onEnterMood(id)`가 그 무드를 바로 커밋하고 편집
 * 화면으로 들어간다 — "포스터부터 올리기"·"영화 검색해서 가져오기"·"직접 입력"·OCR 성공과
 * 나란한 **다섯 번째** 진입점이다(#631 경로, 같은 canvasReady 커밋). 크롭 프리셋
 * (`ImageCropModal`이 읽는 `posterOrientation`)이 랜딩에서 고른 무드와 어긋나지 않는 이유(#529)도
 * 동일 — 무드가 커밋된 채로 편집에 들어가므로 재크롭 없이 방향이 맞다. 배경 타일 그리드는 #613
 * 자산이 없어 이번 구현엔 없다 — #612에 남은 결정으로 기록.
 */
export function Landing({
  mode,
  onCta,
  onTmdbSearch,
  onSkip,
  dropProps,
  dragOver,
  heroMovieInfo,
  heroComponents,
  onEnterMood,
  ocrApplied,
  children,
}: {
  mode: 'overlay' | 'inline' | 'hidden';
  /** 이탈 경로 "포스터부터 올리기" — 셸의 숨은 포스터 input을 그 자리에서 click()한다(같은 제스처, 라우트 전환 0). */
  onCta: () => void;
  /** 이탈 경로 "영화 검색해서 가져오기"(#537) — 포스터 파일이 없어도 영화 검색으로 판본을 골라 같은 크롭 경로로 들어간다. */
  onTmdbSearch: () => void;
  /** 이탈 경로 "직접 입력" — 포스터 없이 편집으로 진입(#631). 셸의 canvasReady를 세운다. */
  onSkip: () => void;
  /** 셸의 포스터 드롭 핸들러(#607) — 점선 드롭존이 여기로 흡수되며 같이 넘어왔다. */
  dropProps: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
  dragOver: boolean;
  /** 히어로 프리뷰용 movieInfo — 업로드 전이라 사실상 항상 빈 값, ghost 자리표시만 보인다. */
  heroMovieInfo: MovieInfo;
  /** 히어로 갤러리 샘플의 색·스탬프 등 layout 이외 필드 — 셸의 실제 components(레이아웃은 샘플마다 override). */
  heroComponents: TicketComponents;
  /** 갤러리 샘플 클릭 → 그 무드를 즉시 커밋 + 편집 화면 진입(다섯 번째 진입점, 위 컴포넌트 주석). */
  onEnterMood: (id: LayoutId) => void;
  /** OCR이 이미 필드를 채운 적 있는가(#652) — true면 children(주 CTA)과 이탈 경로 줄을 통째로
   * CSS로만 숨겨 드로어를 유일한 재진입점으로 만든다(#388 > #631 D2 a, 이 상태에 한해). '직접
   * 입력'(onSkip)만 거친 상태는 이 값이 안 서므로 포스터 재진입 동선이 그대로 남는다. */
  ocrApplied: boolean;
  /** OCR 진입점 슬롯 — 셸이 소유한 단일 OcrUploadCard 인스턴스가 들어온다(이제 주 CTA, #635). */
  children: ReactNode;
}) {
  const overlay = mode === 'overlay';
  return (
    <div
      data-testid="landing"
      {...dropProps}
      // 'hidden'과 'flex'를 동시에 얹으면 Tailwind 유틸 순서에 판정이 걸리므로 배타로 쓴다.
      className={
        mode === 'hidden'
          ? 'hidden'
          : `flex flex-col ${
              overlay ? 'fixed inset-0 z-50 overflow-y-auto bg-bg' : 'flex-1'
            } ${dragOver ? 'outline outline-2 -outline-offset-2 outline-accent' : ''}`
      }
      style={
        overlay
          ? {
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }
          : undefined
      }
    >
      {/* 마케팅 층은 오버레이에서만 — inline은 이미 편집 화면이라 브랜드·카피가 아니라 진입
          컨트롤만 필요하고, hidden에선 그리지도 않는다(숨은 채 매 렌더 reconcile되는 걸 피한다). */}
      {overlay && (
        // 셸 헤더가 오버레이에 가리므로 브랜드를 여기서도 세운다. 페이지 제목 역할은 아래
        // 헤드카피(h1)가 하므로 워드마크는 기본 span으로 둔다.
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
          <Wordmark />
        </div>
      )}

      {/* 카피 → 히어로 → 이탈경로 사이 기본 리듬(D8, #615). gap-4는 #201 세로 리듬의 group(16px)과
          같은 값이라 편집 셸과 이미 이어져 있고, 이탈경로 앞 mt-2/뒤 mt-3은 그 안의 미세 조정이다. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        {overlay && (
          <>
            {/* 카피는 1줄+1줄로 압축(Seed spec c5) — 선택 가능한 히어로가 "그래서 뭘 얻나"를
                문장보다 세게 답하므로 카피 의존도가 낮다. 세로 예산은 아래 히어로+무드칩이 새로
                차지한다(400×675, measure-chrome.mjs로 실측). */}
            <h1 className="text-display font-bold text-fg break-keep">
              티켓 한 장이, 내 굿즈가 돼요
            </h1>
            {/* text-caption(#615 사용자 피드백) — 원래 text-body(14px)는 헤드카피 대비 존재감이
                과했다. 카피 3종(헤드·서브·CTA) 크기를 낮춰 갤러리에 세로 예산을 넘긴다. */}
            <p className="max-w-[300px] text-caption leading-relaxed text-fg-muted break-keep">
              스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.
            </p>

            {/* 히어로(#615, 2026-08-04 개정) — auto-scroll 갤러리 하나가 이전의 "전경 1장 + 무드칩
                스트립" 두 축을 대체한다(위 컴포넌트 주석). */}
            <MoodAutoScrollGallery
              heroMovieInfo={heroMovieInfo}
              heroComponents={heroComponents}
              onEnterMood={onEnterMood}
            />
          </>
        )}

        {/* #652 — OCR이 실제로 필드를 채운 뒤(ocrApplied)엔 주 CTA도 이탈 경로 줄도 편집 본문에
            남지 않는다: #388(편집 중 OCR 진입점은 드로어 하나)이 #631 D2(a)(랜딩 inline이 포스터
            재진입 동선)를 이 상태에 한해 이긴다 — "6개 항목이 자동 입력되었어요" 배너 옆에 방금 쓴
            그 CTA와 세 이탈 경로가 그대로 남으면 "입력이 안 끝났나"로 읽히던 게 #652의 재현이다.
            unmount가 아니라 CSS hidden으로만 숨긴다 — children(OcrUploadCard)은 #614/#624가 지키는
            "항상 마운트" 계약이 있어 트리에서 빼면 안 된다. '직접 입력'(onSkip)만 거친 상태는
            ocrApplied가 안 서므로 이 블록이 그대로 보이고, #631 D2(a)의 포스터 재진입 동선은
            그쪽에서 유지된다(posterlessCanvas.test.tsx). */}
        <div className={`mt-2 w-full max-w-[280px]${ocrApplied ? ' hidden' : ''}`}>
          {/* OCR 주 진입점(#635) — 포스터 CTA가 보조로 내려가고 이게 주연이다(#142 위계 반전).
              모드가 갈려도 이 슬롯의 트리 위치는 고정이라 카드가 remount되지 않는다. */}
          {children}

          {/* 이탈 경로 3종(#635 c6 + #537) — "스크린샷 없음"은 이 세 링크로, "OCR 실패"·
              "rate limit 초과"는 OcrUploadCard의 토스트 뒤에도 이 줄이 그대로 남아 이어진다.
              새 세로 공간 0 — 예전 포스터 CTA 자리(caption + "포스터 없이 시작")를 한 줄로 합쳤고,
              TMDB 검색(#537)도 별도 블록이 아니라 여기 세 번째 링크로 합류한다. */}
          {/* WCAG 2.5.8(AA) 최소 24×24 미달 — 같은 파일 OCR CTA(min-h-[44px])와 동일하게 min-h-touch(44px)로 채운다(#646). */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption text-fg-muted">
            <button type="button" onClick={onCta} className="min-h-touch inline-flex items-center underline">
              포스터부터 올리기
            </button>
            <span aria-hidden="true" className="text-fg-faint">·</span>
            {/* TMDB 인앱 포스터 검색(#537) — 파일을 직접 못 구했을 때의 진입로. 선택 후는
                onCta와 같은 크롭 파이프라인(usePosterCrop.openFile)으로 합류한다. */}
            <button type="button" onClick={onTmdbSearch} className="min-h-touch inline-flex items-center underline">
              영화 검색해서 가져오기
            </button>
            <span aria-hidden="true" className="text-fg-faint">·</span>
            {/* 포스터 없이 시작(#631) — 단색 바탕 + 조판만으로도 티켓이 성립하는 경로의 진입점. */}
            <button type="button" onClick={onSkip} data-testid="landing-skip-poster" className="min-h-touch inline-flex items-center underline">
              직접 입력
            </button>
          </div>
        </div>
      </div>

      {/* 미인증 티켓 고지는 법적 성격이라 랜딩에서 사라지면 안 된다(#614) — AppFooter가 소유.
          편집 화면(inline·hidden)엔 없다: rail dock 위에 고지가 끼는 위계를 없앤 #363 결정이고,
          그 명제를 DOM 부재로 재는 회귀 테스트(appFooterNotice)가 있다. */}
      {overlay && <AppFooter ambient />}
    </div>
  );
}
