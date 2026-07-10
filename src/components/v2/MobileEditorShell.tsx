import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { DesignRail } from './DesignRail';
import { Eyebrow } from './Eyebrow';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { ThemeToggle } from './ThemeToggle';
import { ZoomSegment, type ViewMode } from './viewMode';
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

// 잉크 원탭 토글(#262, #315에서 DesignRail 레일 → 헤더 서브메뉴로 이전). 값은 ColorPicker의
// White/Black 프리셋과 동일한 hex라야 두 UI가 안 어긋난다.
const LIGHT_INK = '#FFFFFF';
const DARK_INK = '#000000';

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
  onDone,
  disabledReason,
  previewMovieInfo,
  previewComponents,
  fieldVisibility,
}: MobileEditorShellProps) {
  const { croppedImageUrl } = photo.state;
  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유(DesktopStudioShell과 공유, #141-class drift 방지).
  // OCR 카드는 셸 프리뷰 직하에 두고(#261) 이 훅도 셸이 쥔다.
  const ocr = useOcrUndo(photo);
  // 표시 항목 일괄 단일 스위치(#261, #260 연계) — 전체 켜짐 여부. 끄기는 필수 필드(title)를 켠 채 유지한다.
  const allVisOn = ALL_FIELDS.every((f) => photo.state.fieldVisibility[f]);
  const [activeField, setActiveField] = useState<SheetTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  // 빈 항목 미리보기(ghost, #216) — 셸 로컬, 미영속(기본 on).
  const [ghostMode, setGhostMode] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 헤더 서브메뉴(#315) — 다크모드·전체표시·빈 항목·잉크 토글 + 포스터 교체/재크롭 액션을 호스팅.
  const [menuOpen, setMenuOpen] = useState(false);
  // pill 클릭 시 서브메뉴가 열린 채로 남지 않게 항상 같이 닫는다(claude-review PR #332 P2 —
  // 메뉴 오버레이가 마우스 클릭은 막아도 키보드 포커스는 막지 않아 Tab으로 pill까지 도달 가능).
  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setMenuOpen(false);
  }
  // 포스터 크롭 파이프라인(#259 on-ticket tap + #315 서브메뉴 교체/재크롭 통합 단일 소스).
  // originalSrc는 첫 업로드 이후에도 유지돼야 재크롭이 되므로(#315 설계, ImageUploader의
  // pendingNewFile 패턴을 그대로 포팅) 크롭 완료 시 revoke하지 않는다 — 값이 바뀌거나(교체로
  // 새 파일 선택) 언마운트될 때만 아래 effect가 이전 URL을 단일 소유자로 revoke한다.
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [posterOriginalSrc, setPosterOriginalSrc] = useState<string | null>(null);
  const [posterCropOpen, setPosterCropOpen] = useState(false);
  const [posterCropping, setPosterCropping] = useState(false);
  const [posterPendingNewFile, setPosterPendingNewFile] = useState(false);

  useEffect(() => {
    return () => {
      if (posterOriginalSrc) URL.revokeObjectURL(posterOriginalSrc);
    };
  }, [posterOriginalSrc]);

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

  // 온-티켓 필드 탭(#259). 숨김 필드 탭 시 자동 표시 on(시안 setActive) 후 시트를 연다 — 스탬프는
  // chainVisible/formatVisible, 나머지는 fieldVisibility. 이미 켜진 필드면 no-op이라 안전하다.
  const handleField = useCallback((target: SheetTarget) => {
    if (isStampTarget(target)) {
      photo.updateComponents({ [STAMP_KEYS[target].visible]: true } as Partial<TicketComponents>);
    } else {
      photo.updateFieldVisibility({ [target]: true });
    }
    setActiveField(target);
  }, [photo.updateComponents, photo.updateFieldVisibility]);

  // 첫 업로드·교체(새 파일 선택) — 포스터 드롭존 탭, 온-티켓 탭, 서브메뉴 "교체" 셋 다 이 경로.
  const handlePosterTap = useCallback(() => {
    posterInputRef.current?.click();
  }, []);
  function handlePosterFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPosterOriginalSrc(URL.createObjectURL(file));
      setPosterPendingNewFile(true);
      setPosterCropOpen(true);
    }
    e.target.value = '';
  }
  // 재크롭 — 새 파일 없이 기존 원본으로 크롭 모달만 재오픈(서브메뉴 전용 진입점).
  const handlePosterRecrop = useCallback(() => {
    if (posterOriginalSrc) setPosterCropOpen(true);
  }, [posterOriginalSrc]);
  async function handlePosterCropComplete(area: Area) {
    if (!posterOriginalSrc) return;
    setPosterCropping(true);
    try {
      const url = await getCroppedImg(posterOriginalSrc, area);
      photo.handleImageUpload(url);
      setPosterPendingNewFile(false);
      setPosterCropOpen(false); // 원본은 유지 — 재크롭에 재사용
    } catch (err) {
      console.error('포스터 크롭 실패:', err);
    } finally {
      setPosterCropping(false);
    }
  }
  function handlePosterCropCancel() {
    setPosterCropOpen(false);
    // 새 파일(첫 업로드·교체) 취소면 원본을 버린다 — 직전 포스터의 원본은 이미 위 revoke effect가
    // 정리했으므로 재크롭 불가, originalSrc를 null로 둬 정합성을 맞춘다(ImageUploader와 동일 패턴).
    // 재크롭 취소(새 파일 안 고름)면 originalSrc를 유지해 다음 재크롭에 재사용.
    if (posterPendingNewFile) {
      setPosterOriginalSrc(null);
      setPosterPendingNewFile(false);
    }
  }

  // 잉크 원탭 토글(#262, #315에서 헤더 서브메뉴로 이전) — 라이트↔다크. 색이 고정된 35mm 무드는
  // 컬러 패널과 동일하게 disabled.
  const isLightInk = (photo.state.components.themeColor || '').toLowerCase() === LIGHT_INK.toLowerCase();
  const inkDisabled = photo.state.components.layout === '35mm';
  const toggleInk = () => photo.updateComponents({ themeColor: isLightInk ? DARK_INK : LIGHT_INK });

  const doneEnabledStyle = canExport
    ? { background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))', color: 'var(--accent-ink)' }
    : undefined;

  const layout = getLayout(previewComponents.layout);
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). max는 세로를
  // TicketRenderer의 자체 maxHeight(min(72vh,720px)) 한도까지 채우는 width를 역산.
  const previewWidth = `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;
  // 가로형(editorial·35mm-landscape) 무드는 세로 화면 폭 기준 스케일이면 작은 가로 띠로 렌더되므로
  // (#275-8) max에서 90° 회전 + 화면 꽉 채우기로 배치. rotatedInnerWidth는 회전 전(자연 방향)
  // TicketRenderer 폭 — 회전 후 세로가 화면 상한을 채우도록 역산. rotatedStageWidth(회전 후 화면에
  // 보이는 폭)는 같은 비율로 calc 유도해 반올림을 피한다.
  const rotateLandscape = layout.orientation === 'landscape' && viewMode !== 'default';
  const rotatedInnerWidth = `min(${PREVIEW_MAX_HEIGHT}, calc(90vw * ${layout.width} / ${layout.height}))`;
  const rotatedStageWidth = `calc(${rotatedInnerWidth} * ${layout.height} / ${layout.width})`;
  // 기본이 아닐 때만 편집 본문(Poster 드롭존 + rail)을 접어 프리뷰에 세로 공간을 내준다. 이미지가
  // 없으면(업로드 전) 접지 않는다 — 그땐 프리뷰/pill 자체가 없다.
  const collapseBody = !!croppedImageUrl && viewMode !== 'default';
  // max 재정의(#328): 헤더·서브메뉴·pill·OCR까지 다 숨기고 티켓만 화면에 fixed 오버레이로 띄운다 —
  // 나가는 길은 티켓 자신을 탭(기존 default 복귀 핸들러 재사용).
  const isMax = viewMode === 'max';

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
      {/* 상단 네브(#315): 뒤로가기·워드마크(무의미해 제거) 대신 좌측 햄버거 서브메뉴 + 우측 완료.
          다크모드·전체표시·빈 항목·잉크 토글과 포스터 교체·재크롭 액션은 서브메뉴로 통합.
          max(#328)는 이 헤더(서브메뉴 포함)까지 숨기는 풀스크린 모드라 통째로 언마운트한다. */}
      {!isMax && (
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-3">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="editor-menu-panel"
          aria-label="편집 메뉴"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

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

        {menuOpen && (
          <>
            {/* 메뉴 밖 탭으로 닫기 — top-14로 헤더 자신(h-14)은 덮지 않는다. inset-0으로 전체를
                덮으면 z-index 없는 헤더 버튼(햄버거·완료)이 이 오버레이 밑에 깔려 탭이 메뉴만
                닫고 버튼 클릭은 씹힌다(claude-review PR #331 P2 지적). */}
            <div className="fixed inset-x-0 bottom-0 top-14 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              id="editor-menu-panel"
              role="menu"
              aria-label="편집 메뉴"
              className="absolute left-3 top-[calc(100%+8px)] z-50 w-64 space-y-3 rounded-card border border-line bg-surface-elevated p-3 shadow-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-fg-muted">다크모드</span>
                <ThemeToggle theme={theme} onChange={onThemeChange} />
              </div>

              <div className="flex flex-col items-start gap-2">
                {/* 전체표시/빈 항목은 프리뷰(포스터)가 있어야 의미가 있으므로 기존과 동일하게 게이팅.
                    잉크는 DesignRail 시절과 동일하게 포스터 유무와 무관하게 항상 노출. */}
                {croppedImageUrl && (
                  <>
                    <TogglePill
                      label="전체 표시"
                      checked={allVisOn}
                      onClick={() =>
                        photo.updateFieldVisibility(allVisOn ? ALL_FIELDS_OFF_KEEP_REQUIRED : ALL_FIELDS_ON)
                      }
                    />
                    <TogglePill
                      label="빈 항목"
                      ariaLabel="빈 항목 미리보기"
                      checked={ghostMode}
                      onClick={() => setGhostMode((v) => !v)}
                    />
                  </>
                )}
                <TogglePill
                  label="잉크"
                  ariaLabel={`잉크 색상 전환, 현재 ${isLightInk ? '라이트' : '다크'}`}
                  checked={!isLightInk}
                  disabled={inkDisabled}
                  onClick={toggleInk}
                />
              </div>

              {croppedImageUrl && (
                <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handlePosterTap();
                    }}
                    className="text-mono flex min-h-[36px] items-center rounded-chip border border-line bg-surface px-3 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft"
                  >
                    포스터 교체
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handlePosterRecrop();
                    }}
                    disabled={!posterOriginalSrc}
                    title={posterOriginalSrc ? undefined : '재크롭하려면 포스터를 다시 업로드해 주세요'}
                    className="text-mono flex min-h-[36px] items-center rounded-chip border border-line bg-surface px-3 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft disabled:opacity-40"
                  >
                    재크롭
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </header>
      )}

      {/* 스크롤 본문: 줌 pill + 인라인 프리뷰 + 편집 본문(Poster 드롭존 + 디자인 rail).
          비-기본 모드에선 justify-center로 pill+프리뷰를 세로 중앙에 두고 본문을 접는다. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`flex min-h-full flex-col ${collapseBody ? 'justify-center' : ''}`}>
          {croppedImageUrl && (
            <div
              className={
                isMax
                  ? 'fixed inset-0 z-50 flex items-center justify-center bg-surface px-6'
                  : 'px-4 pt-4'
              }
              style={
                isMax
                  ? {
                      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                    }
                  : undefined
              }
            >
              {/* 래퍼 트리는 rotate 여부와 무관하게 항상 바깥 div → 안쪽 div → TicketRenderer로 depth가
                  고정돼 있다 — 요소 "타입"뿐 아니라 트리 "깊이"가 바뀌어도 React가 그 지점부터 서브트리를
                  통째로 remount해 TicketRenderer의 scale state가 1로 리셋되며 깜빡인다(#259, 리뷰 지적
                  #275 PR — rotate 분기를 별도 JSX 트리로 나눴을 때 default↔max 전환에서 재현됨).
                  안쪽 div는 항상 존재하고 rotate일 때만 회전 스타일을 얹는다. default는 인라인 폭 + 티켓
                  위 필드/포스터 직접 탭(onField/onPosterTap), max는 확대 폭 + 래퍼 전체 탭→기본
                  복귀(max는 헤더·pill 자체가 없으니 이 탭이 유일한 탈출구). rotateLandscape(#275-8)는
                  가로형 무드의 max에서만 90도 회전 + 화면 꽉 채우기 — TicketRenderer 자신은 늘
                  자연(비회전) 방향으로 렌더돼 scale 계산이 방향을 몰라도 된다. isMax는 바깥 div의
                  className/style만 바꿀 뿐 이 안쪽부터의 depth는 그대로라 전환 시 TicketRenderer가
                  remount되지 않는다. */}
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
                className={`relative mx-auto block rounded-card ${
                  viewMode === 'default'
                    ? 'w-full max-w-[280px]'
                    : 'transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft'
                } ${rotateLandscape ? 'overflow-hidden' : ''}`}
                style={
                  viewMode === 'default'
                    ? undefined
                    : rotateLandscape
                      ? { width: rotatedStageWidth, height: rotatedInnerWidth }
                      : { width: previewWidth }
                }
              >
                <div
                  className={rotateLandscape ? 'absolute left-1/2 top-1/2' : undefined}
                  style={
                    rotateLandscape
                      ? { width: rotatedInnerWidth, transform: 'translate(-50%, -50%) rotate(90deg)' }
                      : undefined
                  }
                >
                  <TicketRenderer
                    croppedImageUrl={croppedImageUrl}
                    movieInfo={previewMovieInfo}
                    components={previewComponents}
                    fieldVisibility={fieldVisibility}
                    ghost={ghostMode}
                    onField={viewMode === 'default' ? handleField : undefined}
                    onPosterTap={viewMode === 'default' ? handlePosterTap : undefined}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 줌 모드 pill — 프리뷰(포스터) 아래로 이동(#328). 원래 "포스터 드롭존 아래"였으나 업로드 후
              드롭존 자체가 통째로 언마운트되므로(#324) 프리뷰 자신을 기준점으로 재정의(#331 코멘트).
              default에선 기본으로 돌아오는 길이지만, max는 pill째로 숨기고 티켓 탭 복귀(위
              onClick)로 대체한다. ghost 토글은 #315에서 헤더 서브메뉴로 이전. */}
          {croppedImageUrl && !isMax && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-4">
              <ZoomSegment viewMode={viewMode} onChange={handleViewModeChange} />
            </div>
          )}

          {/* OCR은 collapse 밖(#261 리뷰 P1). max(#328)는 모든 UX를 숨기는
              풀스크린이라 OCR도 예외 없이 숨긴다. allVis/ghost/잉크 토글은 #315에서 헤더 서브메뉴로 이전. */}
          {!isMax && (
          <div className="space-y-group px-4 pt-6">
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
          </div>
          )}

          {/* 편집 본문(Poster 드롭존 + rail) — collapse는 grid-rows 0fr↔1fr 트랜지션(overflow-hidden 필수).
              비-기본 모드에선 접어 프리뷰에 세로 공간을 내준다. reduced-motion은 globals.css 전역 가드가
              transition-duration을 죽여 즉시 전환 + motion-reduce:transition-none로 이중 차단. 접혔을 땐
              inert로 포커스/Tab/SR 진입 차단(OptionalDetailsAccordion 패턴, React 19 inert prop). */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
            style={{ gridTemplateRows: collapseBody ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden" inert={collapseBody || undefined}>
              <div className="space-y-section px-4 pb-24 pt-6">
                {/* Poster 드롭존 — 업로드 전에만 노출(#315). 업로드 후엔 온-티켓 탭 + 헤더 서브메뉴의
                    교체/재크롭이 대신하므로(#324) 툴팁·적용 카드 없이 섹션 자체가 사라진다. */}
                {!croppedImageUrl && (
                  <section className="space-y-group">
                    <Eyebrow>Poster</Eyebrow>
                    <button
                      type="button"
                      onClick={handlePosterTap}
                      data-touch="44"
                      className="group relative flex min-h-[96px] w-full flex-col items-center justify-center gap-1 rounded-card border border-line bg-paper p-4 text-center shadow-card transition-colors hover:border-accent/40"
                    >
                      <span
                        aria-hidden="true"
                        className="text-mono text-2xl font-normal leading-none text-accent transition-transform group-hover:rotate-90"
                      >
                        +
                      </span>
                      <p className="text-[15px] font-medium leading-tight text-fg">포스터 업로드</p>
                      <p className="text-[11px] leading-relaxed text-fg-faint">
                        탭해서 선택 · JPEG · PNG · WEBP · 0.65 : 1
                      </p>
                    </button>
                  </section>
                )}

                {/* 디자인 rail을 최하단으로(#261 시안 섹션 A). #217은 rail을 폼 위에 둬 무스크롤 접근을
                    노렸지만, 인라인 폼이 탭-투-에딧 시트(#215)로 빠진 지금 rail 위 chrome은 OCR·드롭존뿐이라
                    짧다 — 시안 순서(최하단)로 옮겨도 스크롤 부담이 없어 시안을 따른다. */}
                <DesignRail photo={photo} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 필드 편집 하단시트 — vaul은 dynamic(ssr:false)라 시트가 열릴 때만 로드된다.
          #213은 제목만, #215가 타입별 콘텐츠와 개별 티켓 필드 탭을 채운다. */}
      <FieldEditSheet activeField={activeField} onClose={() => setActiveField(null)} photo={photo} />

      {/* 포스터 크롭 파이프라인(#259 on-ticket tap + #315 드롭존·서브메뉴 교체/재크롭 통합) — 숨김
          파일 input + 크롭 모달. 탭 → input.click() → 파일 선택 → ImageCropModal(기본 0.65:1) →
          getCroppedImg → handleImageUpload. originalSrc는 크롭 완료 후에도 유지돼 재크롭에 재사용된다. */}
      <input
        ref={posterInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        onChange={handlePosterFile}
        className="sr-only"
        aria-hidden="true"
      />
      {posterCropOpen && posterOriginalSrc && (
        <ImageCropModal
          imageSrc={posterOriginalSrc}
          onClose={handlePosterCropCancel}
          onComplete={handlePosterCropComplete}
          isProcessing={posterCropping}
        />
      )}

      {/* OCR 되돌리기 배너(#261 승격) — 화면 하단 고정(fixed), useOcrUndo/OcrUndoBanner 공유(#141-class
          drift 방지). 배너는 셸이 단독 소유하므로 중복되지 않는다. max(#328)는 티켓만 노출하는
          풀스크린이라 시각 배너를 숨긴다 — snapshot을 null로 넘겨도 컴포넌트 자신은 계속 마운트돼
          sr-only 라이브리전의 mutation 감지 계약(#199)은 유지된다. */}
      <OcrUndoBanner
        snapshot={isMax ? null : ocr.snapshot}
        filledFields={ocr.filledFields}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />

      {/* 완료 비활성 사유 — SR 라이브리전은 콘텐츠와 함께 삽입되면 mutation을 놓치므로(#199)
          항상 마운트하고 텍스트만 토글한다. 시각 토스트는 별도로 aria-hidden, max(#328)에선 숨김. */}
      <div role="status" aria-live="polite" className="sr-only">{toast ?? ''}</div>
      {!isMax && toast && (
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
