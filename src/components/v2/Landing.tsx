import type { DragEvent, ReactNode } from 'react';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import TicketRenderer from '../TicketRenderer';
import { LayoutStrip } from '../LayoutPicker';
import { AppFooter } from './AppFooter';
import { Wordmark } from './Wordmark';

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
 * 무드의 조판·타이포·필드 자리는 실물 그대로 보인다.
 *
 * **무드칩 탐색은 진짜 `components.layout`을 바로 안 건드린다** — 셸의 `heroLayout` 로컬 state를
 * 대신 읽고(`onLayoutChange`도 그 로컬 setter), "포스터부터 올리기"·"영화 검색해서 가져오기"·
 * "직접 입력"·OCR 성공 네 진입점에서만 셸이 `commitHeroLayout()`으로 실제 state에 흘려보낸다
 * (fresh-context 리뷰가 잡은 회귀: 바로 `updateComponents`를 태우면 dirtyTick이 올라
 * autosave-draft가 1초 뒤 draft를 쓰고, 다음 방문에 draftRestored=true가 돼 무드칩만 훑어본
 * 방문자에게도 랜딩이 영구히 숨었다). 네 진입점에서 커밋하는 이유는 그래야 크롭 프리셋
 * (`ImageCropModal`이 읽는 `posterOrientation`)이 랜딩에서 고른 무드와 어긋나지 않기 때문이다
 * (#529, Seed spec blindspot 3번 해소) — TMDB 검색(#537)도 같은 크롭 파이프라인으로 합류하므로
 * 동일하게 적용된다. 배경 타일 그리드는 #613 자산이 없어 이번 구현엔 없다 — #612에 남은 결정으로 기록.
 */
/**
 * 톤 토큰(D8, #615) — 랜딩 전용 타이포 스케일 · 여백 리듬 · 강조색 사용법.
 * 편집 셸 적용은 범위 밖(#612 D8) — 여기 값을 편집 셸 컴포넌트에 재사용하지 말 것.
 */
const LANDING_TONE = {
  heading: 'text-[26px] font-bold leading-[1.25] tracking-tight text-fg break-keep',
  body: 'max-w-[300px] text-[14px] leading-relaxed text-fg-muted break-keep',
  caption: 'text-[12px] text-fg-muted',
  // 카피 → 히어로 → 이탈경로 사이 기본 리듬. 섹션 사이 gap-4, 이탈경로 앞 mt-2/뒤 mt-3은 그 안의 미세 조정이라 그대로 둔다.
  sectionGap: 'gap-4',
  // 강조색은 상태(선택된 무드칩 링·포커스링)에만 쓴다 — 정적 카피·CTA 배경엔 안 쓰고 fg 대비로 위계를 잡는다(#635 OCR 주 CTA).
} as const;

export function Landing({
  mode,
  onCta,
  onTmdbSearch,
  onSkip,
  dropProps,
  dragOver,
  heroMovieInfo,
  heroComponents,
  heroLayout,
  onLayoutChange,
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
  /** 히어로 프리뷰의 색·스탬프 등 layout 이외 필드 — 셸의 실제 components(레이아웃은 아래 heroLayout이 대신 결정). */
  heroComponents: TicketComponents;
  /** 무드칩으로 탐색 중인 무드 — 셸의 로컬 state(진짜 components.layout이 아니다, 위 컴포넌트 주석). */
  heroLayout: LayoutId;
  /** 무드칩 선택 → 셸의 heroLayout 로컬 setter. 실제 state 커밋은 onCta/onSkip/OCR 성공 시점에 셸이 한다. */
  onLayoutChange: (id: LayoutId) => void;
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

      <div className={`flex flex-1 flex-col items-center justify-center ${LANDING_TONE.sectionGap} px-6 py-6 text-center`}>
        {overlay && (
          <>
            {/* 카피는 1줄+1줄로 압축(Seed spec c5) — 선택 가능한 히어로가 "그래서 뭘 얻나"를
                문장보다 세게 답하므로 카피 의존도가 낮다. 세로 예산은 아래 히어로+무드칩이 새로
                차지한다(400×675, measure-chrome.mjs로 실측). */}
            <h1 className={LANDING_TONE.heading}>
              티켓 한 장이, 내 굿즈가 돼요
            </h1>
            <p className={LANDING_TONE.body}>
              스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.
            </p>

            {/* 히어로(#615) — 실제 렌더 엔진, 이미지 자산 아님(위 컴포넌트 주석 참고). */}
            <div className="w-full max-w-[120px]">
              <TicketRenderer
                croppedImageUrl={null}
                movieInfo={heroMovieInfo}
                components={heroComponents.layout === heroLayout ? heroComponents : { ...heroComponents, layout: heroLayout }}
                fieldVisibility={ALL_FIELDS_ON}
                ghost
              />
            </div>
            <LayoutStrip value={heroLayout} onChange={onLayoutChange} />
          </>
        )}

        <div className="mt-2 w-full max-w-[280px]">
          {/* OCR 주 진입점(#635) — 포스터 CTA가 보조로 내려가고 이게 주연이다(#142 위계 반전).
              모드가 갈려도 이 슬롯의 트리 위치는 고정이라 카드가 remount되지 않는다. */}
          {children}

          {/* 이탈 경로 3종(#635 c6 + #537) — "스크린샷 없음"은 이 세 링크로, "OCR 실패"·
              "rate limit 초과"는 OcrUploadCard의 토스트 뒤에도 이 줄이 그대로 남아 이어진다.
              새 세로 공간 0 — 예전 포스터 CTA 자리(caption + "포스터 없이 시작")를 한 줄로 합쳤고,
              TMDB 검색(#537)도 별도 블록이 아니라 여기 세 번째 링크로 합류한다. */}
          <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${LANDING_TONE.caption}`}>
            <button type="button" onClick={onCta} className="underline">
              포스터부터 올리기
            </button>
            <span aria-hidden="true" className="text-fg-faint">·</span>
            {/* TMDB 인앱 포스터 검색(#537) — 파일을 직접 못 구했을 때의 진입로. 선택 후는
                onCta와 같은 크롭 파이프라인(usePosterCrop.openFile)으로 합류한다. */}
            <button type="button" onClick={onTmdbSearch} className="underline">
              영화 검색해서 가져오기
            </button>
            <span aria-hidden="true" className="text-fg-faint">·</span>
            {/* 포스터 없이 시작(#631) — 단색 바탕 + 조판만으로도 티켓이 성립하는 경로의 진입점. */}
            <button type="button" onClick={onSkip} data-testid="landing-skip-poster" className="underline">
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
