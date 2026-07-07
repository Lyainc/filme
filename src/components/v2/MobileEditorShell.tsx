import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { EditorCanvas } from './EditorCanvas';
import { DesignRail } from './DesignRail';
import { ThemeToggle } from './ThemeToggle';
import { ZoomSegment, actualSize, type ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { getCroppedImg, type Area } from '@/utils/imageCrop';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';

// 필드 시트는 vaul(+radix)을 끌어와 무겁고 필드 탭 전엔 안 쓰므로 dynamic(ssr:false)로 분리 —
// 셸 자체는 모바일 첫 페인트에 즉시 필요하므로 static, vaul은 시트가 열릴 때만 로드된다.
const FieldEditSheet = dynamic(
  () => import('./FieldEditSheet').then((m) => m.FieldEditSheet),
  { ssr: false },
);

// 포스터 탭(#259) 크롭 모달 — ImageUploader와 동일 컴포넌트 재사용. 탭 전엔 안 쓰므로 dynamic.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

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
  const [activeField, setActiveField] = useState<SheetTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  // 빈 항목 미리보기(ghost, #216) — 셸 로컬, 미영속(기본 on). 실제 크기 모드에선 강제 off.
  const [ghostMode, setGhostMode] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 포스터 온-티켓 탭(#259) — 파일 선택 → 크롭. ImageUploader와 별개의 진입점이라 여기서 자족한다
  // (크롭 완료 시 photo.handleImageUpload이 이전 croppedImageUrl을 revoke하므로 누수 없음).
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [posterCropSrc, setPosterCropSrc] = useState<string | null>(null);
  const [posterCropping, setPosterCropping] = useState(false);

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

  // 온-티켓 필드 탭(#259). 숨김 필드 탭 시 자동 표시 on(시안 setActive) 후 시트를 연다 — 스탬프는
  // chainVisible/formatVisible, 나머지는 fieldVisibility. 이미 켜진 필드면 no-op이라 안전하다.
  function handleField(target: SheetTarget) {
    if (isStampTarget(target)) {
      photo.updateComponents({ [STAMP_KEYS[target].visible]: true } as Partial<TicketComponents>);
    } else {
      photo.updateFieldVisibility({ [target]: true });
    }
    setActiveField(target);
  }

  function handlePosterTap() {
    posterInputRef.current?.click();
  }
  function handlePosterFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPosterCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  }
  async function handlePosterCropComplete(area: Area) {
    if (!posterCropSrc) return;
    setPosterCropping(true);
    try {
      const url = await getCroppedImg(posterCropSrc, area);
      photo.handleImageUpload(url);
    } catch (err) {
      console.error('포스터 크롭 실패:', err);
    } finally {
      URL.revokeObjectURL(posterCropSrc);
      setPosterCropSrc(null);
      setPosterCropping(false);
    }
  }
  function handlePosterCropCancel() {
    if (posterCropSrc) URL.revokeObjectURL(posterCropSrc);
    setPosterCropSrc(null);
  }

  const doneEnabledStyle = canExport
    ? { background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))', color: 'var(--accent-ink)' }
    : undefined;

  // 활성 레이아웃의 방향으로 실제 크기 결정 — portrait 5.5×8.5cm, landscape 8.5×5.5cm(공용 actualSize).
  const layout = getLayout(previewComponents.layout);
  const actual = actualSize(layout);
  const isActual = viewMode === 'actual';
  // 실제 크기에선 ghost를 강제로 끈다(물리 크기 정밀 비교엔 자리표시자가 방해). 그 외엔 토글값.
  const ghostEffective = !isActual && ghostMode;
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). actual은
  // 짧은 변(portrait 5.5cm / landscape 8.5cm)을 그대로 줘 물리 크기로 렌더. max는 세로를
  // TicketRenderer의 자체 maxHeight(min(72vh,720px)) 한도까지 채우는 width를 역산.
  const previewWidth = isActual
    ? actual.shortSideCm
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
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4">
              <ZoomSegment viewMode={viewMode} onChange={setViewMode} />

              {/* 빈 항목 미리보기 토글(#216) — 실제 크기 모드에선 비활성(ghost 강제 off). */}
              <button
                type="button"
                role="switch"
                aria-checked={ghostEffective}
                aria-label="빈 항목 미리보기"
                title="빈 항목 미리보기"
                disabled={isActual}
                onClick={() => setGhostMode((v) => !v)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-elevated pl-3 pr-1.5 transition-opacity ${
                  isActual ? 'opacity-40' : ''
                }`}
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
                  style={{ background: ghostEffective ? 'var(--accent)' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
                    style={{
                      left: 2,
                      background: '#fff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      transform: ghostEffective ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </span>
              </button>
            </div>
          )}

          {croppedImageUrl && (
            <div className="px-4 pt-4">
              {/* 래퍼는 3모드 모두 <div>로 고정 — 요소 타입이 바뀌면 TicketRenderer가 remount돼 내부
                  scale이 1로 리셋되며 깜빡인다(#259 전엔 button 고정, on-ticket 탭엔 내부에 필드 button이
                  중첩돼 div로 전환). default는 인라인 폭 + 티켓 위 필드/포스터 직접 탭(onField/onPosterTap),
                  max/actual은 확대 폭 + 래퍼 전체 탭→기본 복귀. #216: ghost는 actual에서 강제 off. */}
              <div
                {...(viewMode === 'default'
                  ? {}
                  : {
                      role: 'button' as const,
                      tabIndex: 0,
                      onClick: () => setViewMode('default'),
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setViewMode('default');
                        }
                      },
                      'aria-label': '기본 크기로 돌아가기',
                    })}
                className={`mx-auto block rounded-card ${
                  viewMode === 'default'
                    ? 'w-full max-w-[280px]'
                    : 'transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft'
                }`}
                style={viewMode === 'default' ? undefined : { width: previewWidth }}
              >
                <TicketRenderer
                  croppedImageUrl={croppedImageUrl}
                  movieInfo={previewMovieInfo}
                  components={previewComponents}
                  fieldVisibility={fieldVisibility}
                  ghost={ghostEffective}
                  onField={viewMode === 'default' ? handleField : undefined}
                  onPosterTap={viewMode === 'default' ? handlePosterTap : undefined}
                />
              </div>
            </div>
          )}

          {croppedImageUrl && isActual && (
            <p
              className="text-mono px-4 pt-3 text-center text-fg-muted"
              style={{ fontSize: 11, letterSpacing: '0.08em' }}
            >
              실제 크기 · {actual.caption}
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
              <div className="space-y-6 px-4 pb-24 pt-6">
                {/* 무드·후보정은 인라인 폼에서 빼(hideRailSections) 디자인 레일(#217)로 옮긴다.
                    레일을 폼 위(프리뷰 바로 아래)에 둬 폼 전체를 스크롤하지 않고 닿게 한다. */}
                <DesignRail photo={photo} />
                {/* 필드 편집은 티켓 위 온-티켓 탭(#259, FieldTap)이 전담 — 끄기=시트 헤더 눈,
                    켜기=ghost 재탭/전체표시. 별도 필드 목록 UI(구 런처)는 #266 PR-E에서 제거. */}
                <EditorCanvas photo={photo} onPendingFetchChange={onPendingFetchChange} hideRailSections hideFormSections />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 필드 편집 하단시트 — vaul은 dynamic(ssr:false)라 시트가 열릴 때만 로드된다.
          #213은 제목만, #215가 타입별 콘텐츠와 개별 티켓 필드 탭을 채운다. */}
      <FieldEditSheet activeField={activeField} onClose={() => setActiveField(null)} photo={photo} />

      {/* 포스터 온-티켓 탭(#259) — 숨김 파일 input + 크롭 모달. 티켓 위 포스터 탭 → input.click() →
          파일 선택 → ImageCropModal(기본 0.65:1) → getCroppedImg → handleImageUpload. */}
      <input
        ref={posterInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        onChange={handlePosterFile}
        className="sr-only"
        aria-hidden="true"
      />
      {posterCropSrc && (
        <ImageCropModal
          imageSrc={posterCropSrc}
          onClose={handlePosterCropCancel}
          onComplete={handlePosterCropComplete}
          isProcessing={posterCropping}
        />
      )}

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
