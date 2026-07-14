import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AppFooter } from './AppFooter';
import { CLEAR_DRAFT_CONFIRM_MESSAGE } from './AppHeader';
import { DesignRail } from './DesignRail';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { ThemeToggle } from './ThemeToggle';
import { FloatingToolbar } from './FloatingToolbar';
import type { ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { getCroppedImg, type Area } from '@/utils/imageCrop';
import { useEditHistory } from '@/hooks/useEditHistory';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';
import { ALL_FIELDS_ON, ALL_FIELDS_OFF_KEEP_REQUIRED } from '@/constants/fieldVisibility';

// 필드 목록 우측 드로어(#355, 구 FieldEditSheet 대체) — 크롭 모달·로고 훅을 끌어오고 열기 전엔
// 안 쓰므로 dynamic(ssr:false)로 분리, 첫 열기에 로드된다.
const FieldDrawer = dynamic(
  () => import('./FieldDrawer').then((m) => m.FieldDrawer),
  { ssr: false },
);

// 온티켓 인플레이스 에디터(#354) — RatingPicker·DateSheet(FieldEditorBody)를 끌어오므로
// 시트와 같은 이유로 dynamic(ssr:false), 첫 필드 탭에 로드된다.
const InPlaceFieldEditor = dynamic(
  () => import('./InPlaceFieldEditor').then((m) => m.InPlaceFieldEditor),
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
  // 전역 undo/redo(#356) — usePhototicket 위 히스토리 레이어. useOcrUndo와는 독립(이슈 결정,
  // #141 회귀 테스트 보호). 진입점은 플로팅 툴바.
  const history = useEditHistory(photo);
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
  // 필드 목록 우측 드로어(#355). 진입은 헤더 목록 버튼 — #356 플로팅 툴바가 오면 그쪽
  // field-list 버튼이 이 진입점을 이어받는다.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // pill 클릭 시 서브메뉴가 열린 채로 남지 않게 항상 같이 닫는다(claude-review PR #332 P2 —
  // 메뉴 오버레이가 마우스 클릭은 막아도 키보드 포커스는 막지 않아 Tab으로 pill까지 도달 가능).
  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setMenuOpen(false);
    setActiveField(null); // 인플레이스 편집(#354)은 default 줌 전용 — 줌 전환 시 닫는다.
  }
  // 인플레이스 에디터(#354)의 portal 대상(래퍼)·측정 대상(티켓 div). callback ref state라
  // 엘리먼트가 준비되면 에디터가 리렌더로 붙는다.
  const [previewWrapEl, setPreviewWrapEl] = useState<HTMLDivElement | null>(null);
  const [ticketBoxEl, setTicketBoxEl] = useState<HTMLDivElement | null>(null);
  // 편집 중 티켓 lift(px, ≤0) — 에디터가 계산해 올리고 셸이 transform으로만 적용(폭 애니메이트 금지,
  // TicketRenderer의 ResizeObserver 스케일과 싸우지 않게).
  const [editLift, setEditLift] = useState(0);
  const editing = activeField != null && viewMode === 'default' && !!croppedImageUrl;
  const closeEditor = useCallback(() => {
    setActiveField(null);
    setEditLift(0);
  }, []);
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
      const isFirstUpload = !photo.state.croppedImageUrl;
      photo.handleImageUpload(url);
      // 첫 업로드는 문서 시작 — 같이 일어나는 fieldVisibility 기본셋 리셋이 undo 1스텝으로
      // 잡히면 시작하자마자 undo가 활성돼 어색하다(#356). 교체는 히스토리 유지(포스터 자체는
      // 스냅샷 밖이라 스텝도 안 생긴다).
      if (isFirstUpload) history.clear();
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
  // max 재정의(#328): 헤더·서브메뉴·pill·OCR까지 다 숨기고 티켓만 화면에 fixed 오버레이로 띄운다 —
  // 나가는 길은 티켓 자신을 탭(기존 default 복귀 핸들러 재사용). ViewMode가 'default' | 'max' 2값뿐이라
  // viewMode !== 'default'는 항상 isMax와 동치 — 아래 rotateLandscape/collapseBody도 이걸 재사용한다.
  const isMax = viewMode === 'max';
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). max는 세로를
  // TicketRenderer의 자체 maxHeight(min(72vh,720px)) 한도까지 채우는 width를 역산.
  const previewWidth = `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;
  // 가로형(editorial·35mm-landscape) 무드는 세로 화면 폭 기준 스케일이면 작은 가로 띠로 렌더되므로
  // (#275-8) max에서 90° 회전 + 화면 꽉 채우기로 배치. rotatedInnerWidth는 회전 전(자연 방향)
  // TicketRenderer 폭 — 회전 후 세로가 화면 상한을 채우도록 역산. rotatedStageWidth(회전 후 화면에
  // 보이는 폭)는 같은 비율로 calc 유도해 반올림을 피한다.
  const rotateLandscape = layout.orientation === 'landscape' && isMax;
  const rotatedInnerWidth = `min(${PREVIEW_MAX_HEIGHT}, calc(90vw * ${layout.width} / ${layout.height}))`;
  const rotatedStageWidth = `calc(${rotatedInnerWidth} * ${layout.height} / ${layout.width})`;
  // 기본이 아닐 때만 편집 본문(Poster 드롭존 + rail)을 접어 프리뷰에 세로 공간을 내준다. 이미지가
  // 없으면(업로드 전) 접지 않는다 — 그땐 프리뷰/pill 자체가 없다.
  const collapseBody = !!croppedImageUrl && isMax;

  // 앰비언트 다크 크롬(#353) — 포스터가 있으면 셸 전체가 .chrome-dark 스코프에 들어가
  // 기존 토큰이 다크 값으로 로컬 재정의되고(공유 컴포넌트 0줄 변경), 그 뒤에 앰비언트
  // 배경이 .35s 페이드인된다. 테마와 무관(라이트 테마여도 다크 크롬).
  const chromeDark = !!croppedImageUrl;

  return (
    <div
      data-theme={theme}
      className={`app-canvas${chromeDark ? ' chrome-dark' : ''}`}
      style={{
        position: 'relative',
        // height 캡(#357) — minHeight면 콘텐츠가 길 때 문서 전체가 자라 하단 dock이 접근성만
        // 남고 화면 밖으로 밀린다. 캡을 걸어야 본문(flex-1)이 내부 스크롤하고 dock이 항상 보인다.
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* 앰비언트 배경(#353) — 클래스 토글 대신 opacity 페이드라 사라질 때도 트랜지션이 걸린다.
          형제 콘텐츠(header는 relative, 본문 래퍼도 relative)가 위에 그려진다. */}
      <div
        aria-hidden="true"
        data-testid="chrome-ambient"
        className="chrome-ambient pointer-events-none absolute inset-0"
        style={{ opacity: chromeDark ? 1 : 0 }}
      />
      {/* 상단 네브(#315): 뒤로가기·워드마크(무의미해 제거) 대신 좌측 햄버거 서브메뉴 + 우측 완료.
          다크모드·전체표시·빈 항목·잉크 토글과 포스터 교체·재크롭 액션은 서브메뉴로 통합.
          max(#328)는 이 헤더(서브메뉴 포함)까지 숨기는 풀스크린 모드라 통째로 언마운트한다.
          배경은 앰비언트가 깔리면 투명(플랫 바로 끊기지 않게, v8 §1), 없으면 기존 surface. */}
      {!isMax && (
      <header className={`relative flex h-14 shrink-0 items-center justify-between border-b border-line px-3 ${chromeDark ? '' : 'bg-surface'}`}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="editor-menu-panel"
          aria-label="편집 메뉴"
          className="flex h-11 w-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

        {/* '티켓 항목 목록' 헤더 버튼(#355/#360 임시 진입점)은 플로팅 툴바의 항목목록 버튼(#356)이
            대체 — 드로어 배선(handleField·OCR 슬롯)은 그대로 재사용한다. */}
        <div className="flex items-center gap-1">
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

              {/* 임시저장/초기화(#310) — 자동저장 폐지에 따른 명시적 트리거. croppedImageUrl 유무와
                  무관하게 항상 노출한다 — 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등
                  나머지 필드는 복원되므로(#310이 고치려는 시나리오 자체), 포스터 재업로드 전에도
                  초기화에 닿을 수 있어야 한다. 초기화는 파괴적이라 네이티브 confirm으로 한 번 확인한다
                  (이 코드베이스엔 확인 모달 인프라가 없어 새로 만들지 않는다). 저장 피드백은 기존
                  flashToast 재사용. */}
              <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    photo.saveDraft();
                    flashToast('임시저장했어요');
                  }}
                  className="text-mono flex min-h-[36px] items-center rounded-chip border border-line bg-surface px-3 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft"
                >
                  임시저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm(CLEAR_DRAFT_CONFIRM_MESSAGE)) {
                      photo.clearDraft();
                      // 초기화는 새 문서 — undo로 못 돌아간다(로고·포스터 blob이 revoke돼
                      // 복원해도 죽은 참조라 히스토리째 파기가 맞다).
                      history.clear();
                      flashToast('초기화했어요');
                    }
                  }}
                  className="text-mono flex min-h-[36px] items-center rounded-chip border border-line bg-surface px-3 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft"
                >
                  초기화
                </button>
              </div>
            </div>
          </>
        )}
      </header>
      )}

      {/* 스크롤 본문: 인라인 프리뷰 + OCR + 편집 본문(Poster 드롭존 + footer). 디자인 rail은
          #357에서 본문 밖 하단 고정 dock으로 이동. 비-기본 모드에선 justify-center로 프리뷰를
          세로 중앙에 두고 본문을 접는다. relative — absolute 앰비언트 레이어 위에 그려지기 위함(#353). */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
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
                ref={setPreviewWrapEl}
                className={`relative mx-auto block rounded-card ${
                  viewMode === 'default'
                    ? 'w-full max-w-[280px] transition-transform duration-300 ease-out motion-reduce:transition-none'
                    : 'transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft'
                } ${rotateLandscape ? 'overflow-hidden' : ''}`}
                style={
                  viewMode === 'default'
                    ? {
                        // 편집 중 lift + scale(#354, 시안 §5 ~1.08) — transform만 바꾼다. 폭을
                        // 애니메이트하면 TicketRenderer의 ResizeObserver 스케일과 싸운다.
                        // 비편집에도 항등 transform을 유지해야 해제 시 transform→none 이산 점프 없이
                        // 트랜지션이 걸린다. z-41은 편집 backdrop(z-40) 위로 티켓 탭을 살린다.
                        transform: editing
                          ? `translateY(${editLift}px) scale(1.08)`
                          : 'translateY(0) scale(1)',
                        transformOrigin: 'top center',
                        zIndex: editing ? 41 : undefined,
                      }
                    : rotateLandscape
                      ? { width: rotatedStageWidth, height: rotatedInnerWidth }
                      : { width: previewWidth }
                }
              >
                <div
                  ref={setTicketBoxEl}
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
                    // 편집 중 ghost 강제 on(#354 시안 결정: ghostEff = ghostOn || editing) —
                    // 빈/숨김 필드도 탭·순회 타깃으로 티켓에 남는다.
                    ghost={ghostMode || editing}
                    onField={viewMode === 'default' ? handleField : undefined}
                    onPosterTap={viewMode === 'default' ? handlePosterTap : undefined}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 줌 pill(#328)은 #356에서 제거 — 최대화 진입은 플로팅 툴바가 흡수, max 탈출은
              기존 티켓 탭 복귀 그대로. */}

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

          {/* 편집 본문(Poster 드롭존 + footer) — collapse는 grid-rows 0fr↔1fr 트랜지션(overflow-hidden 필수).
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

                {/* 앱 chrome footer(#327) — max에선 이 grid-rows 0fr collapse가 그대로 숨겨준다(별도 분기 불필요). */}
                <AppFooter />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 스타일링 dock(#357) — rail을 스크롤 본문 밖 하단 고정 슬롯으로. 시안의 railTop 절대
          산수(390×844 하드코딩) 대신 flex라 iPhone SE(667px)를 포함한 어떤 뷰포트에서도 dock이
          화면 안에 있다. 언박스 패널이 열리면 dock 영역이 위로 자라고 본문(flex-1)이 줄어든다.
          DOM 순서는 본문 뒤라 기존 "OCR → rail 최하단" 위계(#261)가 유지된다. max는 티켓 전용
          풀스크린이라 숨기되 CSS hidden으로만 — 조건부 unmount면 DesignRail의 pop(열린 패널)
          state가 최대화 왕복마다 리셋된다(#297 P1과 동일 패턴, PR #362 리뷰 P2).
          relative는 absolute 앰비언트(#353) 위에 그려지기 위함. */}
      <div
        className={`relative shrink-0 px-4 pt-3${isMax ? ' hidden' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <DesignRail photo={photo} />
      </div>

      {/* 플로팅 툴바(#356) — undo/redo·항목목록·최대화·배치·숨김. 프리뷰가 있어야 의미가 있고,
          max는 티켓만 남기는 풀스크린이라 숨긴다(탈출은 티켓 탭). 필드 편집·드로어 중에도 셸이
          계속 렌더한다 — 겹침 규칙은 z-index로(툴바 45: 편집 백드롭 40 위, 드로어 50 아래). */}
      {croppedImageUrl && !isMax && (
        <FloatingToolbar
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => {
            history.undo();
            flashToast('되돌렸어요');
          }}
          onRedo={() => {
            history.redo();
            flashToast('다시 실행했어요');
          }}
          onFieldList={() => setDrawerOpen(true)}
          onMaximize={() => handleViewModeChange('max')}
        />
      )}

      {/* 온티켓 인플레이스 에디터(#354) — 필드 탭이 시트 대신 이걸 연다. 투명 input + 필드바 +
          aid 패널(KOBIS/별점/날짜). 위치는 래퍼/티켓 ref 기반 측정, lift는 setEditLift로 위 transform에.
          onField는 handleField가 아니라 setActiveField — prev/next 순회는 순수 탐색이라 경유 필드의
          가시성을 켜면 안 된다(PR #359 리뷰 P1). 자동 표시 on은 FieldTap 직접 탭(handleField)에만. */}
      {editing && activeField && (
        <InPlaceFieldEditor
          photo={photo}
          field={activeField}
          wrapperEl={previewWrapEl}
          ticketEl={ticketBoxEl}
          onField={setActiveField}
          onClose={closeEditor}
          onLift={setEditLift}
        />
      )}

      {/* 필드 목록 우측 드로어(#355) — 행 탭은 handleField(자동 표시 on + 인플레이스 열기)로,
          상단 슬롯엔 OCR 카드를 한 번 더 꽂는다(#142: 편집 화면 카드는 그대로 유지, 진입점 병존). */}
      {drawerOpen && croppedImageUrl && (
        <FieldDrawer
          photo={photo}
          onClose={() => setDrawerOpen(false)}
          onField={(target) => {
            setDrawerOpen(false);
            handleField(target);
          }}
        >
          <OcrUploadCard
            setInfo={photo.updateMovieInfo}
            currentInfo={photo.state.movieInfo}
            onOcrApply={ocr.apply}
            setComponents={photo.updateComponents}
            currentComponents={photo.state.components}
            ocrEpochRef={ocr.epochRef}
          />
        </FieldDrawer>
      )}

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
