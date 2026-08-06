import type { DragEvent, ReactNode } from 'react';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';
import { AppFooter } from './AppFooter';
import { MoodGallery } from './MoodGallery';
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
 * 그대로 써서 `MoodGallery`가 무드 6종을 `TicketRenderer`(`croppedImageUrl=null` + `ghost`)로
 * 실제 렌더한다 — 포스터 없이도 무드의 조판·타이포·필드 자리는 실물 그대로 보인다.
 *
 * **무드 갤러리 클릭은 미리보기가 아니라 즉시 커밋이다(#615 설계 변경)** — 옛 `LayoutStrip` 무드칩은
 * 셸의 `heroLayout` 로컬 state만 바꾸고(`onLayoutChange`), 실제 `components.layout` 커밋은
 * "포스터부터 올리기"·"영화 검색해서 가져오기"·"직접 입력"·OCR 성공 네 진입점에서만 셸이
 * `commitHeroLayout()`으로 흘려보냈다(무드만 훑어보는 방문이 dirtyTick을 올려 autosave-draft가
 * 랜딩을 영구히 숨기는 회귀를 막으려던 설계). 갤러리 샘플엔 그 "훑어보기" 중간 단계가 없다 —
 * 클릭 즉시 그 무드가 posterless 상태로 커밋되고 편집 화면에 들어간다(`onSampleSelect`, #631 경로
 * 재사용). 위 네 진입점과 별개인 다섯 번째 커밋 지점이다. 크롭 프리셋(`ImageCropModal`이 읽는
 * `posterOrientation`)이 여기서 고른 무드와 어긋나지 않는 계약(#529)은 그대로 유지된다 — TMDB
 * 검색(#537)도 같은 크롭 파이프라인으로 합류하므로 동일하게 적용된다. 배경 타일 그리드는 #613
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
  onSampleSelect,
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
  /** 히어로 갤러리용 movieInfo — 업로드 전이라 사실상 항상 빈 값, ghost 자리표시만 보인다. */
  heroMovieInfo: MovieInfo;
  /** 히어로 갤러리의 색·스탬프 등 layout 이외 필드 — 셸의 실제 components(레이아웃은 샘플마다 갤러리가 덮어쓴다). */
  heroComponents: TicketComponents;
  /** 무드 샘플 클릭 — 다섯 번째 커밋 지점(위 컴포넌트 주석). 그 무드를 posterless 상태로 즉시 커밋하고 편집 화면에 진입시킨다. */
  onSampleSelect: (id: LayoutId) => void;
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
                문장보다 세게 답하므로 카피 의존도가 낮다. 세로 예산은 아래 무드 갤러리가 새로
                차지한다(400×675, measure-chrome.mjs로 실측). */}
            <h1 className="text-display font-bold text-fg break-keep">
              티켓 한 장이, 내 굿즈가 돼요
            </h1>
            <p className="max-w-[300px] text-body leading-relaxed text-fg-muted break-keep">
              스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.
            </p>

            {/* 히어로 무드 갤러리(#615) — 실제 렌더 엔진, 이미지 자산 아님(위 컴포넌트 주석 참고).
                클릭이 곧 다섯 번째 커밋 지점이다. */}
            <MoodGallery movieInfo={heroMovieInfo} components={heroComponents} onSelect={onSampleSelect} />
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
