import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { EditorCanvas } from './EditorCanvas';
import { DesignRail } from './DesignRail';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { ThemeToggle } from './ThemeToggle';
import { ZoomSegment, actualSize, type ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { getCroppedImg, type Area } from '@/utils/imageCrop';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';
import { ALL_FIELDS_ON, ALL_FIELDS_OFF_KEEP_REQUIRED } from '@/constants/fieldVisibility';

// 필드 시트는 vaul(+radix)을 끌어와 무겁고 필드 탭 전엔 안 쓰므로 dynamic(ssr:false)로 분리 —
// 셸 자체는 모바일 첫 페인트에 즉시 필요하므로 static, vaul은 시트가 열릴 때만 로드된다.
const FieldEditSheet = dynamic(
  () => import('./FieldEditSheet').then((m) => m.FieldEditSheet),
  { ssr: false },
);

// 포스터 탭(#259) 크롭 모달 — ImageUploader와 동일 컴포넌트 재사용. 탭 전엔 안 쓰므로 dynamic.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

// 표시 항목 일괄 스위치의 도메인 필드 집합(#261) — ALL_FIELDS_ON 키가 곧 전체 티켓 필드.
const ALL_FIELDS = Object.keys(ALL_FIELDS_ON) as TicketField[];

// chrome 토글 행(#261)의 라벨+스위치 pill — allVis(전체 표시)·ghost(빈 항목 미리보기)가 공유한다.
// 기존 ghost 토글 마크업을 그대로 승격해 두 스위치의 생김새를 일치시킨다.
function TogglePill({
  label,
  checked,
  onClick,
  disabled = false,
  ariaLabel,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      title={ariaLabel ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-elevated pl-3 pr-1.5 transition-opacity ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <span
        className="text-mono text-fg-muted"
        style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        className="relative inline-block h-5 w-9 rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent)' : 'var(--border)' }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
          style={{
            left: 2,
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </span>
    </button>
  );
}

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
  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유(DesktopStudioShell·EditorCanvas와 공유, #141-class
  // drift 방지). #261에서 OCR 카드를 EditorCanvas Poster 섹션에서 셸 프리뷰 직하로 승격하며 이 훅도 셸이 쥔다.
  const ocr = useOcrUndo(photo);
  // 표시 항목 일괄 단일 스위치(#261, #260 연계) — 전체 켜짐 여부. 끄기는 필수 필드(title)를 켠 채 유지한다.
  const allVisOn = ALL_FIELDS.every((f) => photo.state.fieldVisibility[f]);
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
          {/* 줌 모드 pill — 3모드 어디서든 항상 보인다(기본으로 돌아오는 유일한 길). ghost 토글은
              #261에서 프리뷰 아래 chrome 토글 행(allVis와 space-between)으로 내렸다. */}
          {croppedImageUrl && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4">
              <ZoomSegment viewMode={viewMode} onChange={setViewMode} />
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

          {/* OCR + allVis/ghost 토글 행은 collapse 밖에 둔다(#261 리뷰 P1) — 줌(max/actual) 모드에서도
              닿게. 특히 allVis는 줌에서 비활성화할 이유가 없고, ghost는 actual에서 disabled 스타일로만
              명시 비활성(inert로 조용히 사라지지 않게). #212 시안 섹션 A 순서: OCR(프리뷰 직하 최상단)
              → allVis+ghost 토글 행 → (아래 collapse의) Poster 드롭존 → 디자인 rail 최하단. */}
          <div className="space-y-4 px-4 pt-6">
            {/* OCR 자동입력 — 주 자동입력 어포던스라 chrome 최상단(프리뷰 직하)으로 승격. 로직은
                셸의 useOcrUndo가 소유, 아코디언 없는 모바일이라 apply를 그대로 넘긴다(DesktopStudioShell과 동형). */}
            <OcrUploadCard
              setInfo={photo.updateMovieInfo}
              currentInfo={photo.state.movieInfo}
              onOcrApply={ocr.apply}
              setComponents={photo.updateComponents}
              currentComponents={photo.state.components}
              ocrEpochRef={ocr.epochRef}
            />

            {/* 토글 행 — 표시 항목 일괄(전체 표시) 단일 스위치 ⟷ 빈 항목 미리보기(ghost).
                프리뷰가 있을 때만(croppedImageUrl) 의미가 있으므로 게이팅. #260: 끄기는 title 유지. */}
            {croppedImageUrl && (
              <div className="flex items-center justify-between gap-3">
                <TogglePill
                  label="전체 표시"
                  checked={allVisOn}
                  onClick={() =>
                    photo.updateFieldVisibility(allVisOn ? ALL_FIELDS_OFF_KEEP_REQUIRED : ALL_FIELDS_ON)
                  }
                />
                {/* 빈 항목 미리보기(#216) — 실제 크기 모드에선 비활성(ghost 강제 off). */}
                <TogglePill
                  label="빈 항목"
                  ariaLabel="빈 항목 미리보기"
                  checked={ghostEffective}
                  disabled={isActual}
                  onClick={() => setGhostMode((v) => !v)}
                />
              </div>
            )}
          </div>

          {/* 편집 본문(Poster 드롭존 + rail) — collapse는 grid-rows 0fr↔1fr 트랜지션(overflow-hidden 필수).
              비-기본 모드에선 접어 프리뷰에 세로 공간을 내준다. reduced-motion은 globals.css 전역 가드가
              transition-duration을 죽여 즉시 전환 + motion-reduce:transition-none로 이중 차단. 접혔을 땐
              inert로 포커스/Tab/SR 진입 차단(OptionalDetailsAccordion 패턴, React 19 inert prop). */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
            style={{ gridTemplateRows: collapseBody ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden" inert={collapseBody || undefined}>
              <div className="space-y-6 px-4 pb-24 pt-6">
                {/* Poster 드롭존만 남긴 EditorCanvas(#261 hideChromeControls) — OCR·allVis·배너는 위/아래에서
                    셸이 직접 소유. 필드 편집은 온-티켓 탭(#259, FieldTap)이 전담(구 런처는 #266 PR-E에서 제거). */}
                <EditorCanvas photo={photo} onPendingFetchChange={onPendingFetchChange} hideRailSections hideFormSections hideChromeControls />

                {/* 디자인 rail을 최하단으로(#261 시안 섹션 A). #217은 rail을 폼 위에 둬 무스크롤 접근을
                    노렸지만, 인라인 폼이 탭-투-에딧 시트(#215)로 빠진 지금 rail 위 chrome은 OCR·토글·드롭존
                    뿐이라 짧다 — 시안 순서(최하단)로 옮겨도 스크롤 부담이 없어 시안을 따른다. */}
                <DesignRail photo={photo} />
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

      {/* OCR 되돌리기 배너(#261 승격) — 화면 하단 고정(fixed), useOcrUndo/OcrUndoBanner 공유(#141-class
          drift 방지). EditorCanvas는 hideChromeControls로 자기 배너를 숨기므로 중복되지 않는다. */}
      <OcrUndoBanner
        snapshot={ocr.snapshot}
        filledFields={ocr.filledFields}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />

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
