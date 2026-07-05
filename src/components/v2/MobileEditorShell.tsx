import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorCanvas } from './EditorCanvas';
import { ThemeToggle } from './ThemeToggle';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

// 프리뷰 3단 줌 모드(#214): 기본(인라인) · 최대화(세로 꽉) · 실제 크기(물리 cm).
type ViewMode = 'default' | 'max' | 'actual';

const ICON_SVG = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const VIEW_MODES: { id: ViewMode; label: string; icon: ReactNode }[] = [
  {
    // 기본: 베이스라인 있는 둥근 사각(인라인 카드)
    id: 'default',
    label: '기본',
    icon: (
      <svg {...ICON_SVG}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <line x1="4" y1="15" x2="20" y2="15" />
      </svg>
    ),
  },
  {
    // 최대화: 네 모서리 확장 화살표
    id: 'max',
    label: '최대화',
    icon: (
      <svg {...ICON_SVG}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    ),
  },
  {
    // 실제 크기: 점선 바깥틀 + 채운 안쪽 사각
    id: 'actual',
    label: '실제 크기',
    icon: (
      <svg {...ICON_SVG}>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2.5" />
        <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

// 필드 시트는 vaul(+radix)을 끌어와 무겁고 필드 탭 전엔 안 쓰므로 dynamic(ssr:false)로 분리 —
// 셸 자체는 모바일 첫 페인트에 즉시 필요하므로 static, vaul은 시트가 열릴 때만 로드된다.
const FieldEditSheet = dynamic(
  () => import('./FieldEditSheet').then((m) => m.FieldEditSheet),
  { ssr: false },
);

interface MobileEditorShellProps {
  photo: ReturnType<typeof usePhototicket>;
  canExport: boolean;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onPendingFetchChange: (pending: boolean) => void;
  /** 완료(결과 열기) — useResultView.openView */
  onDone: () => void;
  /** 완료 비활성 시 안내 문구(=railMessage). 탭하면 토스트로 노출. */
  disabledReason: string;
  /** 인라인 프리뷰는 디바운스된 값으로 렌더(폼 입력이 프리뷰를 매타건 리렌더하지 않게). */
  previewMovieInfo: MovieInfo;
  previewComponents: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

export function MobileEditorShell({
  photo,
  canExport,
  theme,
  onThemeChange,
  onPendingFetchChange,
  onDone,
  disabledReason,
  previewMovieInfo,
  previewComponents,
  fieldVisibility,
}: MobileEditorShellProps) {
  const { croppedImageUrl } = photo.state;
  const [activeField, setActiveField] = useState<TicketField | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bodyRef = useRef<HTMLDivElement>(null);

  function flashToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function handleDone() {
    if (!canExport) {
      flashToast(disabledReason);
      return;
    }
    onDone();
  }

  // 에디터가 루트 화면이라 상위 내비 타깃이 없다 — 본문 최상단으로 스크롤(#213 임시 어포던스,
  // 실제 이전 화면이 생기면 교체). 시트 열림 땐 vaul 스크림이 헤더를 덮어 이 버튼은 닿지 않는다.
  function handleBack() {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const doneEnabledStyle = canExport
    ? { background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))', color: 'var(--accent-ink)' }
    : undefined;

  // 활성 레이아웃의 방향으로 실제 크기 결정 — portrait 5.5×8.5cm, landscape 8.5×5.5cm.
  const layout = getLayout(previewComponents.layout);
  const isLandscape = layout.orientation === 'landscape';
  const actualCaption = isLandscape ? '8.5 × 5.5cm' : '5.5 × 8.5cm';
  const isActual = viewMode === 'actual';
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). actual은
  // 짧은 변(portrait 5.5cm / landscape 8.5cm)을 그대로 줘 물리 크기로 렌더. max는 세로를
  // TicketRenderer의 자체 maxHeight(min(72vh,720px)) 한도까지 채우는 width를 역산.
  const previewWidth = isActual
    ? isLandscape
      ? '8.5cm'
      : '5.5cm'
    : `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;
  // 기본이 아닐 때만 편집 본문(EditorCanvas)을 접어 프리뷰에 세로 공간을 내준다. 이미지가
  // 없으면(업로드 전) 접지 않는다 — 그땐 프리뷰/pill 자체가 없다.
  const collapseBody = !!croppedImageUrl && viewMode !== 'default';

  return (
    <div
      data-theme={theme}
      className="app-canvas"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* 상단 네브: 뒤로 · FILME 워드마크 · (테마) · 완료 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="맨 위로"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <span
          className="text-mono text-fg-muted"
          style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}
        >
          FILME
        </span>

        <div className="flex items-center gap-1.5">
          <ThemeToggle theme={theme} onChange={onThemeChange} />
          <button
            type="button"
            onClick={handleDone}
            aria-disabled={!canExport}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
              canExport ? '' : 'border border-line bg-surface-elevated text-fg-faint'
            }`}
            style={doneEnabledStyle}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            완료
          </button>
        </div>
      </header>

      {/* 스크롤 본문: 줌 pill + 인라인 프리뷰 + 편집 본문(#215까지는 기존 EditorCanvas 재사용).
          비-기본 모드에선 justify-center로 pill+프리뷰를 세로 중앙에 두고 본문을 접는다. */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={`flex min-h-full flex-col ${collapseBody ? 'justify-center' : ''}`}>
          {/* 줌 모드 pill — 3모드 어디서든 항상 보인다(기본으로 돌아오는 유일한 길). */}
          {croppedImageUrl && (
            <div className="flex justify-center px-4 pt-4">
              <div
                role="group"
                aria-label="미리보기 크기"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-elevated p-1"
              >
                {VIEW_MODES.map((m) => {
                  const selected = viewMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setViewMode(m.id)}
                      aria-pressed={selected}
                      aria-label={m.label}
                      title={m.label}
                      className={`flex h-9 items-center justify-center rounded-full px-3.5 transition-colors ${
                        selected ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:text-fg'
                      }`}
                    >
                      {m.icon}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {croppedImageUrl && (
            <div className="px-4 pt-4">
              {/* 래퍼는 3모드 모두 <button>로 고정 — 요소 타입이 바뀌면 TicketRenderer가
                  remount돼 내부 scale이 1로 리셋되며 깜빡인다. 크기/동작만 모드별로 달리한다:
                  기본은 인라인 폭 + 탭→필드 시트, max/actual은 확대 폭 + 탭→기본 복귀.
                  #216 seam: ghost 모드가 들어오면 actual일 때 강제로 끈다
                  (예: ghost={isActual ? false : ghostMode}). 지금은 ghostMode 상태가 없어 게이팅할 것이 없다. */}
              <button
                type="button"
                onClick={
                  viewMode === 'default'
                    ? () => setActiveField('title')
                    : () => setViewMode('default')
                }
                aria-label={viewMode === 'default' ? '제목 편집' : '기본 크기로 돌아가기'}
                className={`mx-auto block rounded-card transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft ${
                  viewMode === 'default' ? 'w-full max-w-[280px]' : ''
                }`}
                style={viewMode === 'default' ? undefined : { width: previewWidth }}
              >
                <TicketRenderer
                  croppedImageUrl={croppedImageUrl}
                  movieInfo={previewMovieInfo}
                  components={previewComponents}
                  fieldVisibility={fieldVisibility}
                />
              </button>
            </div>
          )}

          {croppedImageUrl && isActual && (
            <p
              className="text-mono px-4 pt-3 text-center text-fg-muted"
              style={{ fontSize: 11, letterSpacing: '0.08em' }}
            >
              실제 크기 · {actualCaption}
            </p>
          )}

          {/* 편집 본문 — collapse는 grid-rows 0fr↔1fr 트랜지션(overflow-hidden 필수).
              reduced-motion은 globals.css 전역 가드가 transition-duration을 죽여 즉시 전환
              + motion-reduce:transition-none로 이중 차단. 접혔을 땐 inert로 포커스/Tab/SR
              진입 차단(OptionalDetailsAccordion 패턴, React 19 inert prop). */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
            style={{ gridTemplateRows: collapseBody ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden" inert={collapseBody || undefined}>
              <div className="px-4 pb-24 pt-6">
                <EditorCanvas photo={photo} onPendingFetchChange={onPendingFetchChange} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 필드 편집 하단시트 — vaul은 dynamic(ssr:false)라 시트가 열릴 때만 로드된다.
          #213은 제목만, #215가 타입별 콘텐츠와 개별 티켓 필드 탭을 채운다. */}
      <FieldEditSheet activeField={activeField} onClose={() => setActiveField(null)} photo={photo} />

      {/* 완료 비활성 사유 — SR 라이브리전은 콘텐츠와 함께 삽입되면 mutation을 놓치므로(#199)
          항상 마운트하고 텍스트만 토글한다. 시각 토스트는 별도로 aria-hidden. */}
      <div role="status" aria-live="polite" className="sr-only">{toast ?? ''}</div>
      {toast && (
        <div
          aria-hidden="true"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-line bg-surface-elevated px-4 py-2 text-[13px] text-fg"
          style={{ maxWidth: 'calc(100% - 32px)', boxShadow: 'var(--shadow-pop)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
