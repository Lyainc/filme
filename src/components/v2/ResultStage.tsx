import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { PreviewFilmCell } from './PreviewFilmCell';
import { ResultPanel } from './ResultPanel';
import { WordmarkCompact } from './Wordmark';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

interface ResultStageProps {
  theme: 'light' | 'dark';
  onBack: () => void;
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

/**
 * 모바일 결과 전체화면 스테이지(#258) — 편집 셸(MobileEditorShell)을 교체하는 별도 화면.
 * 상단 네브(뒤로가기+FILME+빈 스페이서) + 확대 hero(캡처 대상과 분리된 표시 전용
 * TicketRenderer, 데스크톱 hero와 동형 — DesktopStudioShell 참고) + 하단 액션(ResultPanel,
 * hidePreview로 캡처 대상만 off-screen 유지). 구 ResultSheet(vaul 바텀시트, #197)를 대체.
 */
export function ResultStage({
  theme,
  onBack,
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
}: ResultStageProps) {
  const layout = getLayout(components.layout);
  const heroWidth = `min(84vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;

  return (
    <div
      data-theme={theme}
      className="app-canvas"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* 상단 네브 — MobileEditorShell 헤더와 동형 구조(뒤로가기·워드마크·우측 슬롯)를 유지해
          편집↔완료 전환에서 네브 위치가 튀지 않게 한다. 완료 화면엔 테마/완료 버튼이 없어
          우측은 좌측 뒤로가기 버튼과 같은 폭의 빈 스페이서로 균형만 맞춘다. */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="편집으로 돌아가기"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <WordmarkCompact />
        <div aria-hidden="true" className="h-9 w-9" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6">
        {croppedImageUrl && (
          <div className="relative mx-auto mb-6" style={{ width: heroWidth }}>
            <PreviewFilmCell promoted>
              <TicketRenderer
                croppedImageUrl={croppedImageUrl}
                movieInfo={movieInfo}
                components={components}
                fieldVisibility={fieldVisibility}
              />
            </PreviewFilmCell>
            {/* 바닥 그림자 — hero가 화면에 떠 보이도록 아래에 흐린 타원 그림자를 깐다.
                캡처 대상(ResultPanel의 off-screen 인스턴스) 밖이라 내보내기에 섞이지 않는다. */}
            <div
              aria-hidden="true"
              className="mx-auto mt-3"
              style={{
                width: '78%',
                height: 18,
                borderRadius: '50%',
                background: 'radial-gradient(closest-side, rgba(0,0,0,0.35), transparent 75%)',
                filter: 'blur(2px)',
              }}
            />
          </div>
        )}

        <div className="mx-auto max-w-md">
          <ResultPanel
            croppedImageUrl={croppedImageUrl}
            movieInfo={movieInfo}
            components={components}
            fieldVisibility={fieldVisibility}
            hidePreview
          />
        </div>
      </div>
    </div>
  );
}
