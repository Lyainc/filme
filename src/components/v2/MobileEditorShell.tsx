import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AppFooter } from './AppFooter';
import { DesignRail } from './DesignRail';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import {
  FloatingToolbar,
  TOOLBAR_MODES,
  TB_STORAGE_KEY,
  TB_EDGE,
  ICON as TB_ICON,
  loadPrefs as loadTbPrefs,
  type TbPrefs,
  type TbOrient,
  type TbPlace,
} from './FloatingToolbar';
import { Wordmark } from './Wordmark';
import type { ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { getCroppedImg, type Area } from '@/utils/imageCrop';
import { TARGET_HEIGHT, TARGET_WIDTH } from '@/utils/constants';
import { useEditHistory } from '@/hooks/useEditHistory';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';

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

// 서브메뉴 행 리딩 아이콘(#374) — 시안 Siyan-C-v8 L296-322와 동일한 18px/stroke 1.7 계열.
// 멀티 서브패스도 단일 d 문자열로 합쳐 MenuRow가 <path> 하나로 렌더한다.
const MENU_ICONS = {
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  upload: 'M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z M17 21v-8H7v8 M7 3v5h8',
  trash:
    'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  gear: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

// 헤더 서브메뉴 공용 행(#374, 시안 Siyan-C-v8 설정 시트의 행 문법 이식) — 리딩 아이콘 +
// 14px 라벨 + (토글 행이면) 트레일링 스위치. checked를 주면 role="switch" 토글 행,
// 없으면 액션 행. 스위치 비주얼은 구 TogglePill 것을 그대로 승계.
function MenuRow({
  iconPath,
  label,
  onClick,
  checked,
  disabled = false,
  ariaLabel,
  title,
  danger = false,
  armed = false,
}: {
  iconPath: string;
  label: string;
  onClick: () => void;
  checked?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  danger?: boolean;
  armed?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked !== undefined ? 'switch' : undefined}
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title ?? ariaLabel ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left transition-colors ${
        disabled ? 'opacity-40' : 'hover:bg-white/5'
      }`}
      style={armed ? { background: 'rgba(229,103,95,.16)' } : undefined}
    >
      <span
        className={`flex min-w-0 items-center gap-2.5 text-[14px] ${danger ? 'text-danger' : 'text-fg'}`}
        style={{ fontWeight: armed ? 700 : 500 }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={danger ? 'shrink-0' : 'shrink-0 text-fg-muted'}
        >
          <path d={iconPath} />
        </svg>
        <span className="truncate">{label}</span>
      </span>
      {checked !== undefined && (
        <span
          aria-hidden="true"
          className="relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors"
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
      )}
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
  const [activeField, setActiveField] = useState<SheetTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  // 빈 항목 미리보기(ghost, #216) — 셸 로컬, 미영속(기본 on).
  const [ghostMode, setGhostMode] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 헤더 서브메뉴(#315) — 다크모드·전체표시·빈 항목 토글 + 포스터 교체/재크롭 액션을 호스팅.
  // 배치설정(#387에서 플로팅 툴바 gear로부터 이전)도 이 메뉴가 호스팅한다.
  const [menuOpen, setMenuOpen] = useState(false);
  // 플로팅 툴바 배치 상태(#387) — 이전엔 FloatingToolbar 로컬 state였으나, 배치설정 UI를
  // 이 헤더 메뉴로 옮기며 부모가 소유하는 controlled 값으로 승격(localStorage 영속도 여기로).
  const [tbPrefs, setTbPrefs] = useState<TbPrefs>(loadTbPrefs);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(TB_STORAGE_KEY, JSON.stringify(tbPrefs));
      } catch {
        // 영속 실패(쿼터·프라이빗 모드)는 무시 — best-effort.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [tbPrefs]);
  const applyToolbarMode = (o: TbOrient, p: TbPlace) => {
    // 모드 전환은 프리셋 기본 위치로 리셋(x/y null) — 방향이 바뀌면 이전 좌표는 클램프 밖일 수 있다.
    setTbPrefs((prev) => ({ ...prev, orient: o, place: p, x: null, y: null }));
  };
  const snapToolbarTo = (side: 'left' | 'right') => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = side === 'left' ? TB_EDGE : window.innerWidth - rect.width - TB_EDGE;
    setTbPrefs((prev) => ({ ...prev, x, y: rect.top }));
  };
  // 초기화 2탭 arm(#374, 시안 clearArm) — window.confirm 대체. 1탭에 arm(라벨이 확인 문구로
  // 바뀌고 3.2초 뒤 자동 해제), arm 상태에서 한 번 더 탭해야 실행. 메뉴가 닫히면 함께 해제.
  const [clearArmed, setClearArmed] = useState(false);
  const clearArmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 습관적 더블탭이 arm과 실행을 한 번에 뚫지 않게 arm 직후 재탭은 무시(claude-review PR #375 P1).
  const clearArmedAt = useRef(0);
  useEffect(() => {
    if (!menuOpen) {
      clearTimeout(clearArmTimer.current);
      setClearArmed(false);
    }
  }, [menuOpen]);
  useEffect(() => () => clearTimeout(clearArmTimer.current), []);
  // 헤더 메뉴는 Escape로도 닫힌다 — 삭제된 플로팅 툴바 배치 서브메뉴가 갖고 있던 키보드 닫기
  // 경로(PR #361 리뷰 P2)를 이 메뉴가 배치설정을 흡수하며 함께 승계한다(claude-review PR #405 P1).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  // 필드 목록 우측 드로어(#355). 진입은 헤더 목록 버튼 — #356 플로팅 툴바가 오면 그쪽
  // field-list 버튼이 이 진입점을 이어받는다.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 헤더 ref(#419) — 플로팅 툴바 세로·고정 기본 위치가 이 아래로 오도록 FloatingToolbar가 실측한다.
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
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

  function handleClearTap() {
    if (!clearArmed) {
      setClearArmed(true);
      clearArmedAt.current = Date.now();
      clearTimeout(clearArmTimer.current);
      clearArmTimer.current = setTimeout(() => setClearArmed(false), 3200);
      return;
    }
    if (Date.now() - clearArmedAt.current < 350) return;
    clearTimeout(clearArmTimer.current);
    setMenuOpen(false); // 닫힘 effect가 clearArmed도 함께 해제
    photo.clearDraft();
    // 초기화는 새 문서 — undo로 못 돌아간다(로고·포스터 blob이 revoke돼
    // 복원해도 죽은 참조라 히스토리째 파기가 맞다).
    history.clear();
    flashToast('초기화했어요');
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

  // 첫 업로드·교체(새 파일 선택) — 포스터 드롭존 탭, 서브메뉴 "교체" 둘 다 이 경로.
  // 온-티켓 빈 공간 탭 경로(#259)는 미스터치로 파일선택창이 떠서 제거(#365) — TicketRenderer에
  // onPosterTap을 더는 넘기지 않는다.
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
  async function handlePosterCropComplete(area: Area, preserveRatio: boolean) {
    if (!posterOriginalSrc) return;
    setPosterCropping(true);
    try {
      // 원본 비율 보존(#420): 고정 960×1477 스트레치 대신 크롭 종횡비를 유지하며 긴 변만 캡한다.
      const url = await getCroppedImg(
        posterOriginalSrc,
        area,
        preserveRatio ? { maxSide: TARGET_HEIGHT * 2 } : undefined
      );
      const isFirstUpload = !photo.state.croppedImageUrl;
      photo.handleImageUpload(url);
      photo.updateComponents({ posterFit: preserveRatio ? 'contain' : 'cover' });
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

  const doneEnabledStyle = canExport
    ? { background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))', color: 'var(--accent-ink)' }
    : undefined;

  const layout = getLayout(previewComponents.layout);
  // max 재정의(#328): 헤더·서브메뉴·pill·OCR까지 다 숨기고 티켓만 화면에 fixed 오버레이로 띄운다 —
  // 나가는 길은 티켓 자신을 탭(기존 default 복귀 핸들러 재사용). ViewMode가 'default' | 'max' 2값뿐이라
  // viewMode !== 'default'는 항상 isMax와 동치 — 아래 rotateLandscape도 이걸 재사용한다.
  const isMax = viewMode === 'max';
  // max 진입 시 포커스를 티켓 래퍼(유일한 탈출구)로 옮긴다 — 진입 버튼이 있던 플로팅 툴바가
  // max에서 통째로 언마운트돼 포커스가 body로 떨어지면 키보드 사용자가 복귀 수단을 잃는다(#190).
  useEffect(() => {
    if (isMax) previewWrapEl?.focus();
  }, [isMax, previewWrapEl]);
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). max는 세로를
  // TicketRenderer의 자체 maxHeight(min(72vh,720px)) 한도까지 채우는 width를 역산.
  const previewWidth = `min(90vw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;
  // 기본 모드 프리뷰 폭(#366) — 고정 280px 캡 대신 fit 스테이지(container-type:size)의 가용
  // 공간에서 역산한다: 가로는 스테이지 폭, 세로는 스테이지 높이 × 종횡비 중 작은 쪽. dock 패널이
  // 열려 스테이지가 줄면 티켓이 통째로 축소돼 어떤 뷰포트에서도 하단(서명 등)이 dock에 안 가리고,
  // 큰 화면에선 캡 없이 커져 빈 공간도 채운다. cq 단위는 뷰포트가 아니라 스테이지 기준이라
  // Safari 동적 툴바(dvh 변동)에도 산수가 그대로 성립한다.
  const fitWidth = `min(100cqw, calc(100cqh * ${layout.width} / ${layout.height}))`;
  // 가로형(editorial·35mm-landscape) 무드는 세로 화면 폭 기준 스케일이면 작은 가로 띠로 렌더되므로
  // (#275-8) max에서 90° 회전 + 화면 꽉 채우기로 배치. rotatedInnerWidth는 회전 전(자연 방향)
  // TicketRenderer 폭 — 회전 후 세로가 화면 상한을 채우도록 역산. rotatedStageWidth(회전 후 화면에
  // 보이는 폭)는 같은 비율로 calc 유도해 반올림을 피한다.
  const rotateLandscape = layout.orientation === 'landscape' && isMax;
  const rotatedInnerWidth = `min(${PREVIEW_MAX_HEIGHT}, calc(90vw * ${layout.width} / ${layout.height}))`;
  const rotatedStageWidth = `calc(${rotatedInnerWidth} * ${layout.height} / ${layout.width})`;

  // 앰비언트 다크 크롬(#353→#363→#415) — theme==='dark'일 때만 .chrome-dark 스코프(데스크톱
  // DesktopStudioShell.tsx의 data-theme 바인딩 패턴과 통일). #363에서 "테마와 무관하게 상시
  // 다크"로 고정했던 게 다크모드 토글을 죽은 컨트롤로 만들어(#415) 원래 의도(라이트/다크 둘 다
  // 지원)로 되돌린다.
  return (
    <div
      data-theme={theme}
      className={`app-canvas${theme === 'dark' ? ' chrome-dark' : ''}`}
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
      {/* 앰비언트 배경(#353→#415) — .chrome-ambient는 테마 무관 리터럴 다크 그라디언트라
          (globals.css) chrome-dark 토글만으론 안 가려진다. theme==='dark'일 때만 렌더하고,
          라이트 테마는 데스크톱과 톤을 맞춰(#415 권장) app-canvas의 --bg 그대로 노출한다.
          형제 콘텐츠(header는 relative, 본문 래퍼도 relative)가 위에 그려진다. */}
      {theme === 'dark' && (
        <div
          aria-hidden="true"
          data-testid="chrome-ambient"
          className="chrome-ambient pointer-events-none absolute inset-0"
        />
      )}
      {/* 상단 네브(v8 §1, #363): 좌측 브랜드 워드마크 + 우측 [편집 메뉴 → 완료(최외곽)].
          #315가 제거했던 워드마크는 #363에서 복귀 확정(데스크톱 AppHeader와 동일 컴포넌트 재사용,
          셸은 상호배타 마운트라 h1 중복 없음). 상시 chrome-dark 스코프(#363)가 잉크를 이미 라이트로
          고정해 v8이 말한 --chrome-ink 신규 토큰은 추가하지 않는다. 다크모드·전체표시·빈 항목·잉크
          토글과 포스터 교체·재크롭 액션은 서브메뉴로 통합. max(#328)는 이 헤더(서브메뉴 포함)까지
          숨기는 풀스크린 모드라 통째로 언마운트한다. 배경은 앰비언트 위라 투명(v8 §1). */}
      {!isMax && (
      <header ref={setHeaderEl} className="relative flex h-14 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2 pl-1.5">
          <Wordmark as="h1" />
        </div>

        {/* '티켓 항목 목록' 헤더 버튼(#355/#360 임시 진입점)은 플로팅 툴바의 항목목록 버튼(#356)이
            대체 — 드로어 배선(handleField·OCR 슬롯)은 그대로 재사용한다. */}
        <div className="flex items-center gap-1">
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
        {/* 완료(다음)는 포스터가 있어야 렌더(v8 §1·시안 nextShown) — 랜딩은 업로드 액션에만
            집중(#363). 업로드 후 canExport 전까지는 기존대로 aria-disabled + 사유 토스트. */}
        {croppedImageUrl && (
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
        )}
        </div>

        {menuOpen && (
          <>
            {/* 메뉴 밖 탭으로 닫기 — top-14로 헤더 자신(h-14)은 덮지 않는다. inset-0으로 전체를
                덮으면 z-index 없는 헤더 버튼(햄버거·완료)이 이 오버레이 밑에 깔려 탭이 메뉴만
                닫고 버튼 클릭은 씹힌다(claude-review PR #331 P2 지적). */}
            <div className="fixed inset-x-0 bottom-0 top-14 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            {/* v8 dark-glass(#364) — 일반 카드 대신 글래스 토큰 + blur. 상시 다크 크롬(#363)이라
                항상 white-alpha 유리. 햄버거가 우측으로 가며(#363) 앵커도 우측 정렬. */}
            {/* 내부 행 문법(#374) — 전 항목을 MenuRow(리딩 아이콘 + 14px 라벨 + 트레일링 스위치)로
                통일하고 토글/포스터 액션/문서 액션 세 그룹을 헤어라인으로 구분(시안 L296-322 이식). */}
            <div
              id="editor-menu-panel"
              role="menu"
              aria-label="편집 메뉴"
              className="absolute right-3 top-[calc(100%+8px)] z-50 w-64 rounded-card border p-2 shadow-card"
              style={{
                background: 'var(--glass-fill)',
                borderColor: 'var(--glass-border)',
                backdropFilter: 'blur(13px)',
                WebkitBackdropFilter: 'blur(13px)',
              }}
            >
              <MenuRow
                iconPath={MENU_ICONS.moon}
                label="다크모드"
                checked={theme === 'dark'}
                onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              />
              {/* 빈 항목은 프리뷰(포스터)가 있어야 의미가 있으므로 기존과 동일하게 게이팅. 잉크는
                  DesignRail 시절과 동일하게 포스터 유무와 무관하게 항상 노출. '전체 표시'는 필드
                  목록이 있는 FieldDrawer로 이전(#424) — 필드 목록과 한 자리에 두는 게 더 직관적이다. */}
              {croppedImageUrl && (
                <MenuRow
                  iconPath={MENU_ICONS.eye}
                  label="빈 항목"
                  ariaLabel="빈 항목 미리보기"
                  checked={ghostMode}
                  onClick={() => setGhostMode((v) => !v)}
                />
              )}
              {/* 배치설정(#387, 플로팅 툴바 gear에서 이전) — 방향(가로/세로) × 배치(고정/이동)
                  라디오 4종 + 이동식일 때 좌/우 가장자리 스냅(WCAG 2.2 SC 2.5.7 대체 경로).
                  잉크 토글은 컬러 패널(White/Black 프리셋)과 중복이라 이 자리에서 삭제.
                  FloatingToolbar 자체가 croppedImageUrl && !isMax일 때만 마운트되므로(아래) 이
                  섹션도 동일 조건으로 게이팅 — 아니면 toolbarRef가 비어 스냅이 조용히 no-op된다
                  (claude-review PR #405 P1). role은 이 메뉴의 다른 항목·레포 컨벤션(radiogroup+radio,
                  LayoutPicker 등)과 맞춰 radio를 쓴다(menuitemradio는 옛 menu+menuitemradio 조합의
                  잔재였다, 같은 리뷰 지적). */}
              {croppedImageUrl && !isMax && (
                <div className="mt-2 border-t border-[var(--glass-border)] pt-2">
                  <div className="flex items-center gap-2.5 px-2.5 pb-1 text-[14px] font-medium text-fg">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="shrink-0 text-fg-muted"
                    >
                      <path d={MENU_ICONS.gear} />
                    </svg>
                    <span>툴바 설정</span>
                  </div>
                  <div role="radiogroup" aria-label="툴바 배치">
                    {TOOLBAR_MODES.map((m) => {
                      const on = tbPrefs.orient === m.orient && tbPrefs.place === m.place;
                      return (
                        <button
                          key={m.label}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => applyToolbarMode(m.orient, m.place)}
                          className={`flex h-11 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[12px] font-semibold ${
                            on ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-white/5'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-[7px] w-[7px] shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-border-strong'}`}
                          />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  {tbPrefs.place === 'movable' && (
                    <div className="mt-1 flex gap-1 border-t border-[var(--glass-border)] pt-1.5">
                      <button
                        type="button"
                        onClick={() => snapToolbarTo('left')}
                        aria-label="왼쪽 가장자리로 이동"
                        title="왼쪽 가장자리로 이동"
                        className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                      >
                        <svg {...TB_ICON}>
                          <path d="M3 19V5" />
                          <path d="m13 6-6 6 6 6" />
                          <path d="M7 12h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => snapToolbarTo('right')}
                        aria-label="오른쪽 가장자리로 이동"
                        title="오른쪽 가장자리로 이동"
                        className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                      >
                        <svg {...TB_ICON}>
                          <path d="M21 5v14" />
                          <path d="m11 18 6-6-6-6" />
                          <path d="M17 12H3" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {croppedImageUrl && (
                <div className="mt-2 border-t border-[var(--glass-border)] pt-2">
                  <MenuRow
                    iconPath={MENU_ICONS.upload}
                    label="포스터 교체"
                    onClick={() => {
                      setMenuOpen(false);
                      handlePosterTap();
                    }}
                  />
                  <MenuRow
                    iconPath={MENU_ICONS.crop}
                    label="재크롭"
                    disabled={!posterOriginalSrc}
                    title={posterOriginalSrc ? undefined : '재크롭하려면 포스터를 다시 업로드해 주세요'}
                    onClick={() => {
                      setMenuOpen(false);
                      handlePosterRecrop();
                    }}
                  />
                </div>
              )}

              {/* 임시저장/초기화(#310) — 자동저장 폐지에 따른 명시적 트리거. croppedImageUrl 유무와
                  무관하게 항상 노출한다 — 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등
                  나머지 필드는 복원되므로(#310이 고치려는 시나리오 자체), 포스터 재업로드 전에도
                  초기화에 닿을 수 있어야 한다. 초기화 확인은 2탭 arm(#374, handleClearTap). 저장
                  피드백은 기존 flashToast 재사용. */}
              <div className="mt-2 border-t border-[var(--glass-border)] pt-2">
                <MenuRow
                  iconPath={MENU_ICONS.save}
                  label="임시저장"
                  onClick={() => {
                    setMenuOpen(false);
                    photo.saveDraft();
                    flashToast('임시저장했어요');
                  }}
                />
                <MenuRow
                  iconPath={MENU_ICONS.trash}
                  label={clearArmed ? '한 번 더 눌러 전체 삭제' : '초기화'}
                  danger
                  armed={clearArmed}
                  onClick={handleClearTap}
                />
              </div>
            </div>
          </>
        )}
      </header>
      )}

      {/* 본문: 업로드 후엔 인라인 프리뷰만(OCR 진입점은 드로어로 일원화 — #388, footer는 편집 화면에서
          제거 — rail dock 위에 고지가 끼는 어색한 위계를 없앴다. 고지는 랜딩 + 공유 플로우
          (ResultPanel·/t/[id])가 커버), 업로드 전엔 랜딩 히어로 + footer. 디자인 rail은 #357에서 본문 밖 하단 고정 dock으로 이동.
          업로드 후엔 프리뷰가 fit 스테이지(flex-1, #366)라 콘텐츠가 정확히 본문 높이에 맞아
          스크롤이 생기지 않고, 업로드 전(랜딩)도 _app.tsx min-h-dvh 통일(#416)로 화면 안에
          보통 들어오지만, 가로모드·저해상도 등 짧은 뷰포트에선 여전히 넘칠 수 있어(claude-review
          PR #426 P1) 안쪽엔 overflow를 걸지 않고 이 바깥 div의 overflow-y-auto에 맡긴다 —
          안 넘치면 육안상 스크롤 없이 그대로, 넘치면 클리핑 대신 스크롤로 안전하게 빠진다.
          relative — absolute 앰비언트 레이어 위에 그려지기 위함(#353). */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* 업로드 후엔 h-full로 높이를 확정해야 fit 스테이지(flex-1)의 cq 단위가 산다(#366) —
            min-h-full(height:auto)이면 CSS상 indefinite라 cqh가 0으로 폴백해 티켓이 사라진다.
            업로드 전(랜딩 본문)도 같은 이유로 h-full을 쓰되, overflow-hidden은 걸지 않는다
            (짧은 뷰포트에서 콘텐츠가 클리핑되지 않고 바깥 스크롤 컨테이너로 넘어가야 하므로). */}
        <div className="flex h-full flex-col">
          {croppedImageUrl && (
            <div
              className={
                isMax
                  ? 'fixed inset-0 z-50 flex items-center justify-center bg-surface px-6'
                  : 'flex min-h-0 flex-1 items-center justify-center px-4 py-3'
              }
              style={
                isMax
                  ? {
                      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
                    }
                  : // fit 스테이지(#366) — flex-1 + basis 0이라 높이가 "본문 - OCR·footer"로 확정되고,
                    // container-type:size라 자식(티켓)이 이 높이에 기여하지 않아 순환이 없다.
                    // 아래 fitWidth의 cqw/cqh가 이 박스를 컨테이너로 읽는다.
                    { containerType: 'size' }
              }
            >
              {/* 래퍼 트리는 rotate 여부와 무관하게 항상 바깥 div → 안쪽 div → TicketRenderer로 depth가
                  고정돼 있다 — 요소 "타입"뿐 아니라 트리 "깊이"가 바뀌어도 React가 그 지점부터 서브트리를
                  통째로 remount해 TicketRenderer의 scale state가 1로 리셋되며 깜빡인다(#259, 리뷰 지적
                  #275 PR — rotate 분기를 별도 JSX 트리로 나눴을 때 default↔max 전환에서 재현됨).
                  안쪽 div는 항상 존재하고 rotate일 때만 회전 스타일을 얹는다. default는 인라인 폭 + 티켓
                  위 필드 직접 탭(onField — 포스터 탭은 #365에서 제거), max는 확대 폭 + 래퍼 전체 탭→기본
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
                    ? 'transition-transform duration-300 ease-out motion-reduce:transition-none'
                    : 'transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft'
                } ${rotateLandscape ? 'overflow-hidden' : ''}`}
                style={
                  viewMode === 'default'
                    ? {
                        // fit 폭(#366) — 스테이지 크기 변경(dock 패널 개폐)에 cq 단위가 즉시
                        // 따라가고, TicketRenderer의 ResizeObserver가 재스케일한다.
                        width: fitWidth,
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
                  />
                </div>
              </div>
            </div>
          )}

          {/* 줌 pill(#328)은 #356에서 제거 — 최대화 진입은 플로팅 툴바가 흡수, max 탈출은
              기존 티켓 탭 복귀 그대로. */}

          {/* OCR 섹션 — 랜딩에선 시안(Siyan-C-v8) 드롭존 히어로(포스터 비율 960/1534 점선 카드,
              OCR은 보조 직하 — #142 위계)가 유일한 진입점이라 노출한다. 업로드 후(croppedImageUrl)엔
              이 섹션을 통째로 CSS hidden — OCR 진입점은 드로어(#355) 쪽으로 일원화한다(#388, "업로드 후
              프리뷰 직하 카드" 중복 제거). unmount가 아니라 hidden인 이유는 이 OcrUploadCard가 랜딩·
              업로드 후에 걸쳐 같은 트리 위치의 단일 인스턴스(DOM 노드)로 남아야 하기 때문이다 —
              분기별 별도 JSX로 심어 전환 순간 remount되면 in-flight KOBIS 보강의 mountedRef 가드가
              setInfo를 조용히 버려 titleOg·releaseDate(완료 게이트 필수 필드)가 유실된다(PR #372 리뷰
              P1, 커밋 514baab #363). max(#328)도 같은 이유로 hidden — 최대화 왕복 중의 동일 레이스까지
              함께 막는다. OCR 로직은 셸의 useOcrUndo가 소유(DesktopStudioShell과 동형). */}
          <section
            className={
              isMax || croppedImageUrl
                ? 'hidden'
                : 'flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8'
            }
          >
            {!croppedImageUrl && (
              <button
                type="button"
                onClick={handlePosterTap}
                data-touch="44"
                className="group relative flex w-full max-w-[230px] flex-col items-center justify-center gap-3.5 overflow-hidden rounded-card border-2 border-dashed border-border-strong bg-surface p-6 text-center transition-colors hover:border-accent/40"
                style={{ aspectRatio: `${TARGET_WIDTH} / ${TARGET_HEIGHT}` }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'radial-gradient(70% 45% at 50% 34%, var(--accent-soft), transparent 72%)' }}
                />
                <span
                  aria-hidden="true"
                  className="relative flex h-[62px] w-[62px] items-center justify-center rounded-[18px] bg-accent text-accent-ink transition-transform group-hover:scale-105"
                  style={{ boxShadow: '0 14px 30px -12px color-mix(in srgb, var(--accent) 70%, transparent)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                </span>
                <span className="relative text-[15.5px] font-bold leading-tight text-fg">포스터 업로드</span>
              </button>
            )}
            <OcrUploadCard
              setInfo={photo.updateMovieInfo}
              currentInfo={photo.state.movieInfo}
              onOcrApply={ocr.apply}
              setComponents={photo.updateComponents}
              currentComponents={photo.state.components}
              ocrEpochRef={ocr.epochRef}
            />
          </section>

          {/* 랜딩 footer — 편집 화면(업로드 후)엔 없음(rail dock 위에 고지가 끼는 위계 방지). */}
          {!croppedImageUrl && <AppFooter ambient />}
        </div>
      </div>

      {/* 스타일링 dock(#357) — rail을 스크롤 본문 밖 하단 고정 슬롯으로. 시안의 railTop 절대
          산수(390×844 하드코딩) 대신 flex라 iPhone SE(667px)를 포함한 어떤 뷰포트에서도 dock이
          화면 안에 있다. 언박스 패널이 열리면 dock 영역이 위로 자라고 본문(flex-1)이 줄어드는데,
          티켓은 fit 스테이지(#366)가 같이 축소해 dock에 가려지지 않는다(이전엔 고정 280px 폭이라
          소형 화면에서 하단이 dock 뒤로 잘렸다). DOM 순서는 본문 뒤라 기존 "OCR → rail 최하단"
          위계(#261)가 유지된다. max는 티켓 전용 풀스크린이라 숨기고, 랜딩(업로드 전)도 스타일링
          대상이 없어 숨긴다(#363) — 둘 다 CSS hidden으로만. 조건부 unmount면 DesignRail의
          pop(열린 패널) state가 왕복마다 리셋된다(#297 P1과 동일 패턴, PR #362 리뷰 P2).
          relative는 absolute 앰비언트(#353) 위에 그려지기 위함. */}
      <div
        className={`relative shrink-0 px-4 pt-3${isMax || !croppedImageUrl ? ' hidden' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <DesignRail photo={photo} />
      </div>

      {/* 필드 드로어 엣지 핸들(#364) — 우측 엣지에 드로어 존재를 암시하는 상시 인디케이터.
          툴바의 항목목록 버튼과 진입점 병존(툴바를 모르면 드로어를 못 찾는 문제의 직접 해소).
          히트영역은 44px(왼쪽으로 투명 확장), 보이는 탭은 20px 글래스. z-30 — 편집 백드롭(z-40)
          아래라 인플레이스 편집 중엔 가려지고, 드로어(z-50)가 열리면 그 뒤에 깔린다. */}
      {croppedImageUrl && !isMax && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="티켓 항목 목록 열기"
          className="fixed right-0 top-1/2 z-30 flex h-14 w-11 -translate-y-1/2 items-center justify-end"
        >
          <span
            aria-hidden="true"
            className="flex h-full w-5 items-center justify-center rounded-l-[10px] border border-r-0 border-[var(--glass-border)] text-fg-muted"
            style={{
              background: 'var(--glass-fill)',
              backdropFilter: 'blur(13px)',
              WebkitBackdropFilter: 'blur(13px)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </span>
        </button>
      )}

      {/* 플로팅 툴바(#356) — undo/redo·항목목록·최대화·숨김(배치설정은 #387에서 헤더 메뉴로 이전).
          프리뷰가 있어야 의미가 있고, max는 티켓만 남기는 풀스크린이라 숨긴다(탈출은 티켓 탭).
          필드 편집·드로어 중에도 셸이 계속 렌더한다 — 겹침 규칙은 z-index로(툴바 45: 편집 백드롭 40 위,
          드로어 50 아래). */}
      {croppedImageUrl && !isMax && (
        <FloatingToolbar
          ref={toolbarRef}
          prefs={tbPrefs}
          onPrefsChange={setTbPrefs}
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
          headerEl={headerEl}
          contentTopEl={ticketBoxEl}
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
          상단 슬롯엔 OCR 카드를 꽂는다 — 업로드 후 유일한 OCR 진입점이다(#388, 본문 카드는 hidden). */}
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
            context="drawer"
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
          layout={previewComponents.layout}
          initialPreserveRatio={previewComponents.posterFit === 'contain'}
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
