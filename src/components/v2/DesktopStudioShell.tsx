import dynamic from 'next/dynamic';
import { useRef, useState, type ReactNode } from 'react';
import ImageUploader from '@/components/ImageUploader';
import TicketRenderer from '@/components/TicketRenderer';
import { AppHeader } from './AppHeader';
import { FieldLauncher } from './FieldLauncher';
import { DesignRail } from './DesignRail';
import { ResultPanel } from './ResultPanel';
import { PreviewFilmCell } from './PreviewFilmCell';
import { PrimaryCta } from './PrimaryCta';
import { OcrUploadCard, type OcrDirectField } from './OcrUploadCard';
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
  const { croppedImageUrl } = photo.state;

  // OCR 낙관적 주입 + 즉시 되돌리기 — EditorCanvas의 poster 섹션 wiring을 그대로 옮긴다.
  // 필드 칩(ocrFilledFields)은 이 셸에 필드 입력칸이 없어 배너 카운트 용도로만 유지한다.
  const [ocrFilledFields, setOcrFilledFields] = useState<Set<OcrDirectField>>(new Set());
  const [ocrSnapshot, setOcrSnapshot] = useState<Partial<MovieInfo> | null>(null);
  const [ocrComponentSnapshot, setOcrComponentSnapshot] = useState<Partial<TicketComponents> | null>(null);
  const ocrEpochRef = useRef(0);

  function handleOcrApply({
    keys,
    prevValues,
    prevComponents,
  }: {
    keys: Set<OcrDirectField>;
    prevValues: Partial<MovieInfo>;
    prevComponents?: Partial<TicketComponents>;
  }) {
    setOcrFilledFields(keys);
    setOcrSnapshot(prevValues);
    setOcrComponentSnapshot(prevComponents ?? null);
  }

  function handleCancelOcr() {
    ocrEpochRef.current++;
    if (ocrSnapshot) photo.updateMovieInfo(ocrSnapshot);
    // chain 라벨/노출도 OCR 적용 전으로 되돌린다(#141 리뷰 P1).
    if (ocrComponentSnapshot) photo.updateComponents(ocrComponentSnapshot);
    setOcrFilledFields(new Set());
    setOcrSnapshot(null);
    setOcrComponentSnapshot(null);
  }

  function handleConfirmOcr() {
    setOcrSnapshot(null);
    setOcrComponentSnapshot(null);
  }

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
                className={`flex flex-col items-center justify-center gap-1 rounded-field-sm transition-colors ${
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

        {/* 중앙: 캔버스 — 티켓 중앙 + accent-soft radial glow. 줌 없음(#225). */}
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

          {croppedImageUrl && (
            <div className="w-full max-w-[380px]">
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
        </main>

        {/* 우: 컨텍스트 인스펙터 — 스크롤 body + 고정 footer(편집 모드만). */}
        <aside className="flex h-full flex-none flex-col border-l border-line" style={{ width: 380 }}>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {resultOpen ? (
              <ResultPanel
                croppedImageUrl={croppedImageUrl}
                movieInfo={photo.state.movieInfo}
                components={photo.state.components}
                fieldVisibility={fieldVisibility}
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
                    onOcrApply={handleOcrApply}
                    setComponents={photo.updateComponents}
                    currentComponents={photo.state.components}
                    ocrEpochRef={ocrEpochRef}
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
                <DesignRail photo={photo} />
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
      </div>

      {/* 필드 편집 하단시트(vaul, dynamic) — 정보 탭에서 행 탭 시 열린다. 탭 전환과 무관하게 항상 마운트. */}
      <FieldEditSheet activeField={activeField} onClose={() => setActiveField(null)} photo={photo} />

      {/* OCR 되돌리기 배너 — 화면 하단 중앙 고정(EditorCanvas 패턴). */}
      {ocrSnapshot && (
        <div className="fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 animate-slide-up items-center gap-4 rounded-card border border-accent bg-surface-elevated p-3 shadow-lg">
          <p className="flex-1 text-[13px] text-fg">
            {ocrFilledFields.size > 0
              ? `${ocrFilledFields.size}개 항목이 자동 입력되었어요.`
              : '영화 정보를 자동으로 불러왔어요.'}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleCancelOcr}
              className="text-[12px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={handleConfirmOcr}
              className="rounded-chip bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* OCR announce — 라이브리전은 콘텐츠 변경 전부터 DOM에 있어야 SR이 잡으므로 항상 마운트하고 텍스트만 바꾼다(#199). */}
      <div role="status" aria-live="polite" className="sr-only">
        {ocrSnapshot
          ? ocrFilledFields.size > 0
            ? `${ocrFilledFields.size}개 항목이 자동 입력되었어요.`
            : '영화 정보를 자동으로 불러왔어요.'
          : ''}
      </div>
    </div>
  );
}
