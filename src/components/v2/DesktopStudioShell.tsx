import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import ImageUploader from '@/components/ImageUploader';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { AppHeader } from './AppHeader';
import { FieldLauncher } from './FieldLauncher';
import { DesktopDesignPanel } from './DesktopDesignPanel';
import { ResultPanel } from './ResultPanel';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { ZoomSegment, actualSize, type ViewMode } from './viewMode';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import { getLayout } from '@/utils/layouts';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import type { SheetTarget } from '@/constants/fields';

// 필드 편집 시트는 vaul(+radix)을 끌어와 무겁고 필드 탭 전엔 안 쓰므로 dynamic(ssr:false)로 분리 —
// 셸 자체는 즉시 필요하지만 vaul은 시트가 열릴 때만 로드된다(MobileEditorShell과 동일 패턴).
// #226이 이 드로어를 인라인 아코디언으로 교체한다.
const FieldEditSheet = dynamic(
  () => import('./FieldEditSheet').then((m) => m.FieldEditSheet),
  { ssr: false },
);

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
  /** MovieInfoForm이 이 셸엔 없어(제목 검색은 FieldEditSheet 경유) 현재는 미소비 — index 대칭용 prop. */
  onPendingFetchChange: (pending: boolean) => void;
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-mono text-[11px] uppercase tracking-widest text-fg-muted">{children}</div>
  );
}

/**
 * 데스크톱(≥1024px) Studio 셸(#224) — 헤더 + 3-pane(아이콘 내비 · 중앙 캔버스 · 컨텍스트 인스펙터).
 * 모바일 #212가 만든 콘텐츠 leaf(ImageUploader·OcrUploadCard·FieldLauncher·FieldEditSheet·DesignRail·
 * ResultPanel)를 새 하우징에 재배치만 한다 — 새 편집/디자인/결과 로직은 없다. 색은 전부 CSS var 토큰.
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
  const [activeField, setActiveField] = useState<SheetTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const { croppedImageUrl } = photo.state;

  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유한다(EditorCanvas와 공유, #141-class drift 방지).
  // 이 셸엔 필드 입력칸이 없어 EditorCanvas의 아코디언 열기 같은 사이트별 사이드이펙트 없이 apply를 그대로 쓴다.
  const ocr = useOcrUndo(photo);

  // 줌은 편집 모드만 — 결과(resultOpen)에선 캔버스 hero 티켓이 기본 크기로 고정된다(인스펙터=ResultPanel).
  const mode = resultOpen ? 'default' : viewMode;
  const layout = getLayout(previewComponents.layout);
  const actual = actualSize(layout);
  // 티켓 컨테이너 width로 렌더 크기를 몬다(TicketRenderer는 width에 맞춰 스케일, 모바일과 동일 방식).
  // actual은 짧은 변을 CSS cm로, max는 TicketRenderer maxHeight 한도까지 채우는 width를 역산.
  const previewWidth =
    mode === 'actual'
      ? actual.shortSideCm
      : `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;

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

        {/* 중앙: 캔버스 — 티켓 중앙 + accent-soft radial glow. 3단 줌(#225): 기본/최대화/실제 크기. */}
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

          {/* 줌 세그먼트 — 편집 모드 + 티켓 있을 때만. max에서 인스펙터를 숨겨도 이 세그먼트는
              캔버스에 남아 기본으로 돌아오는 유일한 길이 된다. */}
          {!resultOpen && croppedImageUrl && (
            <ZoomSegment viewMode={viewMode} onChange={setViewMode} className="absolute right-7 top-6 z-10" />
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
                />
              </PreviewFilmCell>
            </div>
          )}

          {croppedImageUrl && mode === 'actual' && (
            <p
              className="text-mono pt-3 text-center text-fg-muted"
              style={{ fontSize: 11, letterSpacing: '0.08em' }}
            >
              실제 크기 · {actual.caption}
            </p>
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
              <div className="space-y-4">
                <Eyebrow>POSTER</Eyebrow>
                <div className="space-y-2.5">
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
              <div className="space-y-4">
                <Eyebrow>INFO</Eyebrow>
                <FieldLauncher photo={photo} onSelect={setActiveField} />
              </div>
            ) : (
              <div className="space-y-4">
                <Eyebrow>DESIGN</Eyebrow>
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

      {/* 필드 편집 하단시트(vaul, dynamic) — 정보 탭에서 행 탭 시 열린다. 탭 전환과 무관하게 항상 마운트. */}
      <FieldEditSheet activeField={activeField} onClose={() => setActiveField(null)} photo={photo} />

      {/* OCR 되돌리기 배너 + sr-only 라이브리전 — EditorCanvas와 공유(useOcrUndo/OcrUndoBanner, #141-class drift 방지). */}
      <OcrUndoBanner
        snapshot={ocr.snapshot}
        filledFields={ocr.filledFields}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />
    </div>
  );
}
