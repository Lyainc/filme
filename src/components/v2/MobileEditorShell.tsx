import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { EditorCanvas } from './EditorCanvas';
import { ThemeToggle } from './ThemeToggle';
import TicketRenderer from '@/components/TicketRenderer';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

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

      {/* 스크롤 본문: 인라인 프리뷰 + 편집 본문(#215까지는 기존 EditorCanvas 재사용) */}
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
        {croppedImageUrl && (
          <div className="px-4 pt-5">
            <button
              type="button"
              onClick={() => setActiveField('title')}
              aria-label="제목 편집"
              className="mx-auto block w-full max-w-[280px] rounded-card transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
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

        <div className="px-4 pb-24 pt-6">
          <EditorCanvas photo={photo} onPendingFetchChange={onPendingFetchChange} />
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
