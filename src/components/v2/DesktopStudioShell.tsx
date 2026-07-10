import { useState, type ReactNode } from 'react';
import ImageUploader from '@/components/ImageUploader';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { AppHeader } from './AppHeader';
import { FieldAccordion } from './FieldAccordion';
import { DesktopDesignPanel } from './DesktopDesignPanel';
import { ResultPanel } from './ResultPanel';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { ZoomSegment, type ViewMode } from './viewMode';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import { getLayout } from '@/utils/layouts';
import { ALL_FIELDS_ON, isRequiredField } from '@/constants/fieldVisibility';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

// 전체 표시/숨김 대상 = 모든 티켓 필드 - 필수 필드(#260 REQUIRED_FIELDS). ALL_FIELDS_ON을 도메인 소스로.
const TOGGLE_FIELDS = (Object.keys(ALL_FIELDS_ON) as TicketField[]).filter((f) => !isRequiredField(f));

// 데스크톱은 필드를 인라인 아코디언(FieldAccordion, #226)으로 편집한다 — vaul-free라 상시 마운트해도
// vaul이 메인 번들로 안 딸려온다. 모바일(MobileEditorShell)만 vaul 하단시트(FieldEditSheet)를 쓴다.

type StudioTab = 'poster' | 'info' | 'design';

const NAV_ICON = {
  width: 19,
  height: 19,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const TABS: { id: StudioTab; label: string; icon: ReactNode }[] = [
  {
    id: 'poster',
    label: 'POSTER',
    icon: (
      <svg {...NAV_ICON}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: 'info',
    label: 'INFO',
    icon: (
      <svg {...NAV_ICON}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  },
  {
    id: 'design',
    label: 'DESIGN',
    icon: (
      <svg {...NAV_ICON}>
        <circle cx="13.5" cy="6.5" r=".6" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".6" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".6" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".6" fill="currentColor" />
        <path d="M12 2a10 10 0 1 0 10 10c0-1.1-.9-2-2-2h-2.2a2 2 0 0 1-2-2.3A2 2 0 0 1 17.6 6 10 10 0 0 0 12 2Z" />
      </svg>
    ),
  },
];

interface DesktopStudioShellProps {
  photo: ReturnType<typeof usePhototicket>;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  canExport: boolean;
  /** = index의 railMessage. 완료 비활성 사유 힌트. */
  disabledReason: string | null;
  resultOpen: boolean;
  /** = useResultView.openView */
  onDone: () => void;
  /** = useResultView.closeView */
  onBackToEdit: () => void;
  previewMovieInfo: MovieInfo;
  previewComponents: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

/**
 * 전체 표시/숨김 일괄 토글(#227) — INFO 탭 상단. 필수 필드(제목)는 대상에서 제외(TOGGLE_FIELDS).
 * 라벨은 다음 동작을 가리킨다: 전부 켜져 있으면 '전체 숨김', 하나라도 꺼져 있으면 '전체 표시'.
 */
function AllVisibilityToggle({ photo }: { photo: ReturnType<typeof usePhototicket> }) {
  const { fieldVisibility } = photo.state;
  const allShown = TOGGLE_FIELDS.every((f) => fieldVisibility[f]);
  const setAll = (v: boolean) =>
    photo.updateFieldVisibility(
      Object.fromEntries(TOGGLE_FIELDS.map((f) => [f, v])) as Partial<Record<TicketField, boolean>>,
    );
  return (
    <button
      type="button"
      onClick={() => setAll(!allShown)}
      className="text-mono rounded-chip border border-line px-2.5 py-1 text-[9.5px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
    >
      {allShown ? '전체 숨김' : '전체 표시'}
    </button>
  );
}

/**
 * 데스크톱(≥1024px) Studio 셸(#224) — 헤더 + 3-pane(아이콘 내비 · 중앙 캔버스 · 컨텍스트 인스펙터).
 * 모바일 #212가 만든 콘텐츠 leaf(ImageUploader·OcrUploadCard·DesignRail·ResultPanel)를 재배치하고,
 * INFO는 데스크톱 인라인 아코디언(FieldAccordion, #226)으로 편집한다 — 모바일 시트와 본문(FieldEditorBody)
 * 공유. 새 편집/디자인/결과 로직은 없다. 색은 전부 CSS var 토큰.
 * 3-pane row는 rail(1024) 미만에서 hidden — 모바일 pre-mount 시 가로 overflow 방지.
 */
export function DesktopStudioShell({
  photo,
  theme,
  onThemeChange,
  canExport,
  disabledReason,
  resultOpen,
  onDone,
  onBackToEdit,
  previewMovieInfo,
  previewComponents,
  fieldVisibility,
}: DesktopStudioShellProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('poster');
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const { croppedImageUrl } = photo.state;

  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유한다(MobileEditorShell과 공유, #141-class drift 방지).
  // 이 셸엔 필드 입력칸이 없어 사이트별 사이드이펙트 없이 apply를 그대로 쓴다.
  const ocr = useOcrUndo(photo);

  // 빈 항목 미리보기(ghost, #227) — 셸 로컬, 미영속(기본 on).
  const [ghostMode, setGhostMode] = useState(true);

  // 줌은 편집 모드만 — 결과(resultOpen)에선 캔버스 hero 티켓이 기본 크기로 고정된다(인스펙터=ResultPanel).
  const mode = resultOpen ? 'default' : viewMode;
  const layout = getLayout(previewComponents.layout);
  // 티켓 컨테이너 width로 렌더 크기를 몬다(TicketRenderer는 width에 맞춰 스케일, 모바일과 동일 방식).
  // max는 TicketRenderer maxHeight 한도까지 채우는 width를 역산.
  const previewWidth = `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;

  return (
    <div
      data-theme={theme}
      className="app-canvas flex h-screen flex-col overflow-hidden"
    >
      <AppHeader theme={theme} onThemeChange={onThemeChange} />

      {/* 3-pane row — rail(1024) 미만에선 숨겨 모바일 pre-mount의 가로 overflow를 막는다(AppShell aside 패턴). */}
      <div className="hidden min-h-0 flex-1 rail:flex">
        {/* 좌: 아이콘 내비 */}
        <nav
          className="flex flex-none flex-col items-center gap-2.5 border-r border-line pt-5"
          style={{ width: 76 }}
        >
          {TABS.map((tab) => {
            const active = !resultOpen && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={active}
                // 완성(resultOpen) 모드에선 인스펙터가 ResultPanel 우선이라 탭 클릭이 무반응 —
                // disabled로 죽은 클릭을 막고 시각적으로도 비활성 표시(리뷰 P2).
                disabled={resultOpen}
                className={`flex flex-col items-center justify-center gap-1 rounded-field-sm transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                  active ? 'bg-accent-soft text-accent' : 'text-fg-faint hover:text-fg-muted'
                }`}
                style={{ width: 48, height: 48 }}
              >
                {tab.icon}
                <span className="text-mono" style={{ fontSize: 8.5, letterSpacing: '0.06em' }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* 중앙: 캔버스 — 티켓 중앙 + accent-soft radial glow. 2단 줌(#225): 기본/최대화. */}
        <main
          className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-6"
          style={{ background: 'radial-gradient(60% 50% at 50% 38%, var(--accent-soft), transparent 70%)' }}
        >
          {resultOpen && (
            <button
              type="button"
              onClick={onBackToEdit}
              className="absolute left-7 top-6 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-elevated px-3.5 py-2 text-[11.5px] text-fg-muted transition-colors hover:text-fg"
            >
              ← 편집으로
            </button>
          )}

          {/* 캔버스 컨트롤 바 — 편집 모드 + 티켓 있을 때만. 빈 항목 미리보기 토글 + 줌 세그먼트.
              max에서 인스펙터를 숨겨도 이 바는 캔버스에 남아 기본으로 돌아오는 유일한 길이 된다. */}
          {!resultOpen && croppedImageUrl && (
            <div className="absolute right-7 top-6 z-10 flex items-center gap-2.5">
              {/* 빈 항목 미리보기 토글(#227). */}
              <button
                type="button"
                role="switch"
                aria-checked={ghostMode}
                aria-label="빈 항목 미리보기"
                title="빈 항목 미리보기"
                onClick={() => setGhostMode((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-elevated pl-3 pr-1.5 transition-opacity"
              >
                <span
                  className="text-mono text-fg-muted"
                  style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  빈 항목
                </span>
                <span
                  aria-hidden="true"
                  className="relative inline-block h-5 w-9 rounded-full transition-colors"
                  style={{ background: ghostMode ? 'var(--accent)' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                    style={{
                      left: 2,
                      background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      transform: ghostMode ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </span>
              </button>
              <ZoomSegment viewMode={viewMode} onChange={setViewMode} />
            </div>
          )}

          {croppedImageUrl && (
            <div
              className={mode === 'default' ? 'w-full max-w-[380px]' : ''}
              style={mode === 'default' ? undefined : { width: previewWidth }}
            >
              <PreviewFilmCell>
                <TicketRenderer
                  croppedImageUrl={croppedImageUrl}
                  movieInfo={previewMovieInfo}
                  components={previewComponents}
                  fieldVisibility={fieldVisibility}
                  ghost={ghostMode}
                />
              </PreviewFilmCell>
            </div>
          )}
        </main>

        {/* 우: 컨텍스트 인스펙터 — 스크롤 body + 고정 footer(편집 모드만).
            최대화 모드에선 숨겨 캔버스를 넓힌다(state는 셸 레벨이라 유지, 렌더만 토글 — #225 제약). */}
        {mode !== 'max' && (
        <aside className="flex h-full flex-none flex-col border-l border-line" style={{ width: 380 }}>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {resultOpen ? (
              <ResultPanel
                croppedImageUrl={croppedImageUrl}
                movieInfo={previewMovieInfo}
                components={previewComponents}
                fieldVisibility={fieldVisibility}
                // 캔버스 hero 티켓이 이미 프리뷰라 인스펙터는 액션만 — 이중 노출 제거(#233).
                hidePreview
              />
            ) : activeTab === 'poster' ? (
              <div className="space-y-group">
                <div className="space-y-field">
                  <ImageUploader
                    onUpload={photo.handleImageUpload}
                    isProcessing={false}
                    hasImage={!!croppedImageUrl}
                    imageUrl={croppedImageUrl}
                  />
                  <OcrUploadCard
                    setInfo={photo.updateMovieInfo}
                    currentInfo={photo.state.movieInfo}
                    onOcrApply={ocr.apply}
                    setComponents={photo.updateComponents}
                    currentComponents={photo.state.components}
                    ocrEpochRef={ocr.epochRef}
                  />
                </div>
              </div>
            ) : activeTab === 'info' ? (
              <div className="space-y-group">
                <div className="flex justify-end">
                  <AllVisibilityToggle photo={photo} />
                </div>
                <FieldAccordion photo={photo} />
              </div>
            ) : (
              <div className="space-y-group">
                <DesktopDesignPanel photo={photo} />
              </div>
            )}
          </div>

          {!resultOpen && (
            <div className="flex-none border-t border-line" style={{ padding: '18px 24px' }}>
              {!canExport && disabledReason && (
                <div className="mb-2.5 text-center text-[11px] text-fg-muted">{disabledReason}</div>
              )}
              <PrimaryCta
                state={canExport ? 'idle' : 'disabled'}
                label="티켓 완성"
                onClick={onDone}
              />
            </div>
          )}
        </aside>
        )}
      </div>

      {/* OCR 되돌리기 배너 + sr-only 라이브리전 — MobileEditorShell과 공유(useOcrUndo/OcrUndoBanner, #141-class drift 방지). */}
      <OcrUndoBanner
        snapshot={ocr.snapshot}
        filledFields={ocr.filledFields}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />
    </div>
  );
}
