import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { DesignRail } from './DesignRail';
import { Landing } from './Landing';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { AdvancedSettingsModal } from './AdvancedSettingsModal';
import {
  FloatingToolbar,
  TB_STORAGE_KEY,
  TB_EDGE,
  loadPrefs as loadTbPrefs,
  type TbPrefs,
  type TbOrient,
  type TbPlace,
} from './FloatingToolbar';
import { getFrameRect } from './PhoneFrame';
import { Wordmark } from './Wordmark';
import type { ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import EmbossBrushLayer from '@/components/v2/EmbossBrushLayer';
import { getLayout } from '@/utils/layouts';
import type { Area } from '@/utils/imageCrop';
import { useEditHistory } from '@/hooks/useEditHistory';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';
import { triggerKobisLookup } from '@/utils/kobisLookup';
import { ErrorToastHost } from '@/utils/errorToast';

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

// 포스터 탭(#259) 크롭 모달 — 로고 크롭과 같은 컴포넌트다. 탭 전엔 안 쓰므로 dynamic.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

// TMDB 인앱 포스터 검색 모달(#537) — 랜딩의 보조 CTA를 누르기 전엔 안 쓰므로 dynamic.
const TmdbPosterModal = dynamic(
  () => import('@/components/TmdbPosterModal').then((m) => m.TmdbPosterModal),
  { ssr: false },
);

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

// 헤더 서브메뉴의 행 그룹(#569/#580) — 오버레이 패널(--overlay-fill)은 티켓 위에 뜨는 유리라
// 그 위 직접 텍스트는 --fg만 AA를 넘는다(globals.css --overlay-* 주석의 실측표). muted 아이콘·
// accent 라디오·danger 초기화 라벨까지 읽히게 텍스트 행은 불투명 표면에 얹는다 — FieldDrawer의
// 처방과 같다. --surface-elevated가 아니라 --surface인 건 danger 잉크 때문:
// #EF4444가 #1E2326에선 4.22:1(미달), #161A1C에선 4.66:1이다.
// 포스터 파일 입력의 accept이자 드롭 필터(#607) — input과 드롭이 서로 다른 목록을 쓰면
// 드롭만 되는(혹은 안 되는) 포맷이 조용히 갈린다.
const POSTER_ACCEPT = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

const MENU_GROUP_CLS = 'rounded-[12px] bg-surface p-1'; // 행 반경(rounded-lg 8) + p-1(4)과 동심

// 필드 드로어 엣지 핸들 세로 위치 영속(#579) — 툴바(filme:toolbar:v1)와 별도 키. 핸들은
// y 좌표 하나뿐이라(가로 이동은 엣지 탭 구조상 의미가 없다) 툴바처럼 orient/place를 얹은
// 객체가 아니라 단일 값이면 충분하다.
const DRAWER_HANDLE_KEY = 'filme:drawer:v1';
// 핸들의 탭(열기)/드래그(수평=열기, 수직=이동) 구분 임계 거리(px) — FloatingToolbar의
// TB_TAP_SLOP(#568)과 같은 값, 같은 근거로 6px.
const HANDLE_DRAG_SLOP = 6;

function loadDrawerHandleY(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAWER_HANDLE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && typeof p.y === 'number' ? p.y : null;
  } catch {
    return null;
  }
}

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
      // arm 표시가 채움 틴트(rgba(229,103,95,.16))였을 땐 danger 잉크 대비가 3.79:1로 떨어졌다
      // (#569 실측 — 붉은 틴트가 배경을 밝혀 같은 붉은 글자와 붙는다). 채움 대신 1px 링으로 바꾸면
      // 배경이 그대로라 라벨은 4.66:1을 유지하고, 링 자체는 비텍스트 3:1 기준을 넘는다.
      style={armed ? { boxShadow: 'inset 0 0 0 1px var(--danger)' } : undefined}
    >
      <span
        className={`flex min-w-0 items-center gap-2.5 text-body ${danger ? 'text-danger' : 'text-fg'}`}
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
  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유(#141-class drift 방지).
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
    // 스냅 좌표계도 프레임이다(#607) — 뷰포트로 계산하면 데스크톱에서 x=1388이 나와 400px 프레임
    // 밖으로 나간다. 드래그 없는 대체 경로(WCAG 2.2 SC 2.5.7)라 그게 필요한 사용자부터 깨진다.
    const frame = getFrameRect();
    const x = side === 'left' ? TB_EDGE : frame.width - rect.width - TB_EDGE;
    setTbPrefs((prev) => ({ ...prev, x, y: rect.top - frame.top }));
    // 모달(#574)이 풀페이지라 스냅하는 순간 툴바가 안 보인다 — 이동했다는 사실만 토스트로 알린다.
    flashToast(side === 'left' ? '왼쪽 가장자리로 옮겼어요' : '오른쪽 가장자리로 옮겼어요');
  };
  // 초기화 2탭 arm(#374, 시안 clearArm) — window.confirm 대체. 1탭에 arm(라벨이 확인 문구로
  // 바뀌고 3.2초 뒤 자동 해제), arm 상태에서 한 번 더 탭해야 실행. 메뉴가 닫히면 함께 해제.
  const [clearArmed, setClearArmed] = useState(false);
  // 랜딩 오버레이를 사용자가 걷었는지(#614). 걷는 조건 3가지 중 이 state가 필요한 건 OCR뿐이다 —
  // 드래프 복원은 photo.draftRestored가, CTA 파일 선택은 crop.cropOpen/croppedImageUrl이 이미
  // 말해준다(아래 showLanding). 초기화(handleClearTap)가 false로 되돌려 랜딩이 복귀한다.
  const [landingDismissed, setLandingDismissed] = useState(false);
  // OCR이 실제로 필드를 채운 적이 있는가(#652) — landingDismissed는 onSkip과 onOcrApply 둘 다
  // 세우지만 이 신호는 후자만 세운다. #388(편집 중엔 OCR 진입점이 드로어 하나)과 #631 D2(a)
  // (포스터 재진입 동선은 랜딩 inline 자체)가 부딪히는 지점인데, 이 신호가 서면 #388이 이긴다 —
  // Landing 컨테이너 자체(mode)는 그대로 inline으로 두되(#631 D1 유지), 그 안의 주 CTA(children=
  // OcrUploadCard)와 이탈 경로 줄을 통째로 CSS로 숨겨 드로어를 유일한 재진입점으로 만든다.
  // '직접 입력'(onSkip)만 거친 상태는 이 신호가 안 서므로 #631의 포스터 재진입 동선이 그대로
  // 남는다. 초기화(handleClearTap)가 false로 되돌린다.
  const [ocrApplied, setOcrApplied] = useState(false);
  // 포스터가 없어도 편집 캔버스는 설 수 있다(#631) — "포스터가 있다"(croppedImageUrl)와 "편집할
  // 캔버스가 섰다"는 다른 명제다. 랜딩의 "포스터 없이 시작"(onSkip)이 landingDismissed를 세워
  // canvasReady를 연다. 랜딩 자체를 숨길지는 별개 판정(D1, 아래 Landing mode) — croppedImageUrl
  // 없이 landingDismissed만으로는 랜딩을 안 숨긴다. #614 걷는 조건 ③과 계약이 같다.
  const canvasReady = !!croppedImageUrl || landingDismissed;
  const clearArmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 습관적 더블탭이 arm과 실행을 한 번에 뚫지 않게 arm 직후 재탭은 무시(claude-review PR #375 P1).
  const clearArmedAt = useRef(0);
  // 고급 설정 모달(#574) — 툴바 설정이 메뉴 안 접이식 섹션(#447)에서 이 모달로 이사했다.
  // 메뉴를 닫으면서 열리므로 둘이 중첩되지 않는다(Escape 한 번이 둘 다 닫는 문제가 안 생긴다).
  const [advOpen, setAdvOpen] = useState(false);
  // 모달을 연 '고급 설정' 행은 메뉴와 함께 사라지므로 닫힘 포커스는 살아있는 햄버거로 되돌린다.
  const hamburgerRef = useRef<HTMLButtonElement>(null);
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
  // 엣지 핸들 세로 위치(#579) — null이면 기존 화면 정중앙(top-1/2 -translate-y-1/2) 유지.
  const drawerHandleRef = useRef<HTMLButtonElement>(null);
  const [drawerHandleY, setDrawerHandleY] = useState<number | null>(loadDrawerHandleY);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAWER_HANDLE_KEY, JSON.stringify({ y: drawerHandleY }));
      } catch {
        // 영속 실패(쿼터·프라이빗 모드)는 무시 — best-effort, FloatingToolbar와 동일.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [drawerHandleY]);
  const clampHandleY = (y: number) => {
    const h = drawerHandleRef.current?.offsetHeight ?? 96; // h-24 폴백
    const frame = getFrameRect();
    return Math.max(TB_EDGE, Math.min(frame.height - h - TB_EDGE, y));
  };
  // 저장된 y가 리사이즈·회전으로 프레임 밖에 나가면 재클램프 — FloatingToolbar clampPos
  // 재클램프 이펙트(#190/#607)와 같은 패턴.
  useEffect(() => {
    if (drawerHandleY == null) return;
    const reclamp = () => {
      const c = clampHandleY(drawerHandleY);
      if (c !== drawerHandleY) setDrawerHandleY(c);
    };
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [drawerHandleY]); // eslint-disable-line react-hooks/exhaustive-deps

  // 엣지 핸들 축 분리 드래그(#567·#579, 동반 설계 — 같은 핸들이 두 제스처를 축으로 갈라
  // 쓴다). 첫 이동이 HANDLE_DRAG_SLOP을 넘는 순간 우세 축으로 잠그고(axis) 이후 이동은
  // 그 축만 처리한다 — 대각선 드래그가 두 동작을 동시에 트리거하지 않게. 수평은 "임계
  // 넘으면 그때 열기"(추적 없음, #567 설계 메모 권장안 — FieldDrawer가 마운트=열림이라
  // 실시간 peek은 구조 변경이 필요하다), 수직은 FloatingToolbar 그립(onGripDown/Move/Up)처럼
  // 손가락을 실시간으로 따라간다. 수평 우세인데 오른쪽(무의미한 방향)이면 axis를 잠그지
  // 않는다 — 잠갔다면 이후 click까지 드래그로 오판돼 순수 탭이 흔들림 하나로 조용히
  // 무시된다(실브라우저 CDP 트러스티드 클릭으로 재현·확인).
  const handleDragRef = useRef<{ px: number; py: number; oy: number; axis: 'h' | 'v' | null } | null>(null);
  // 드래그 끝의 click 억제(FloatingToolbar draggedRef, #568과 같은 패턴) — 수직 이동으로
  // 끝난 제스처가 click에서 다시 드로어를 열면 탭=열기/드래그=이동 구분이 무너진다.
  const handleDraggedRef = useRef(false);
  const onHandlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = drawerHandleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frame = getFrameRect();
    handleDragRef.current = { px: e.clientX, py: e.clientY, oy: rect.top - frame.top, axis: null };
    handleDraggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = handleDragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.axis) {
      if (Math.abs(dx) < HANDLE_DRAG_SLOP && Math.abs(dy) < HANDLE_DRAG_SLOP) return;
      const axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (axis === 'h' && dx >= 0) return; // 오른쪽(무의미한 방향) — 잠그지 않고 탭 취급으로 남겨 click 폴백이 살아있게 한다.
      d.axis = axis;
      handleDraggedRef.current = true;
      if (d.axis === 'h') {
        setDrawerOpen(true); // 왼쪽(화면 안쪽)으로 당기면 열기.
        return; // 열기는 1회성 — 이 제스처 동안 더 볼 필요 없다.
      }
    }
    if (d.axis === 'v') setDrawerHandleY(clampHandleY(d.oy + dy));
  };
  const onHandlePointerUp = () => {
    handleDragRef.current = null;
  };
  const onHandleClick = () => {
    if (handleDraggedRef.current) {
      handleDraggedRef.current = false;
      return;
    }
    setDrawerOpen(true);
  };
  // 비드래그 대체 경로(WCAG 2.2 SC 2.5.7) — 고급 설정 모달(#574)의 상/하 스냅 버튼이 호출.
  const snapDrawerHandleTo = (edge: 'top' | 'bottom') => {
    const rect = drawerHandleRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frame = getFrameRect();
    const y = edge === 'top' ? TB_EDGE : frame.height - rect.height - TB_EDGE;
    setDrawerHandleY(y);
    flashToast(edge === 'top' ? '위쪽 가장자리로 옮겼어요' : '아래쪽 가장자리로 옮겼어요');
  };
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
  const editing = activeField != null && viewMode === 'default' && canvasReady;
  const closeEditor = useCallback(() => {
    setActiveField(null);
    setEditLift(0);
  }, []);
  // 포스터 크롭 파이프라인(#259 on-ticket tap + #315 서브메뉴 교체/재크롭 통합 단일 소스).
  // 상태머신(원본 objectURL·cropOpen·pendingNewFile·복원 시드·revoke)은 #548에서 usePhototicket의
  // usePosterCrop으로 올라갔다 — 이 셸은 브레이크포인트 전환에서 통째로 언마운트되므로, 여기가
  // 원본 blob을 소유하면 훅이 아직 참조 중인 URL이 revoke된다. 이제 소비만 한다.
  const posterInputRef = useRef<HTMLInputElement>(null);
  const crop = photo.posterCrop;
  // 랜딩 오버레이를 걷는 조건 3가지(#614)를 한 줄로 — 전부 "이미 편집에 들어왔다"의 다른 얼굴이다.
  //  · croppedImageUrl: 포스터가 있다(정상 진입 완료 · 포스터 있던 draft 복원)
  //  · crop.cropOpen: CTA로 파일을 골라 크롭 모달이 떴다 — onChange 그 프레임에 걷힌다. 파생값이라
  //    크롭 취소(cropOpen→false, 포스터 없음)면 랜딩이 저절로 돌아온다. 안 그러면 포스터도 랜딩도
  //    없는 빈 셸에 갇힌다.
  //  · photo.draftRestored: 재방문자(텍스트만 있던 draft 포함) — 랜딩 생략, 마찰 0(D7)
  //  · landingDismissed: OCR로 티켓 스크린샷이 인식됐다
  const showLanding =
    !croppedImageUrl && !crop.cropOpen && !photo.draftRestored && !landingDismissed;

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
    // 초기화는 새 문서니까 랜딩도 처음 상태로 — 안 되돌리면 포스터도 draft도 없는 빈 셸에 남는다(#614).
    setLandingDismissed(false);
    setOcrApplied(false);
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
    if (file) crop.openFile(file);
    e.target.value = '';
  }

  // TMDB 인앱 포스터 검색(#537) — 판본이 확정되면 그 Blob을 File로 감싸 기존 크롭 파이프라인에
  // 그대로 태운다(c1·c7). 별도 상태머신을 안 만드는 이유: crop.openFile이 이미 objectURL 발급·
  // 재크롭용 원본 보관·commit 시 posterOriginal 영속까지 다 하므로, 소스가 파일 선택이든 TMDB
  // 다운로드든 이 지점부터는 완전히 같은 경로다.
  const [tmdbOpen, setTmdbOpen] = useState(false);
  const handleTmdbSelect = useCallback((file: File, title: string) => {
    setTmdbOpen(false);
    crop.openFile(file);
    // KOBIS 보강(c8) — 이미 채워진 필드는 fillEmptyMovieInfo가 덮지 않는다. OcrUploadCard의
    // 같은 트리거(triggerKobisLookup)를 재사용(c8 근거) — dedup 캐시도 같이 공유된다.
    triggerKobisLookup(title).then((kobisInfo) => {
      photo.fillEmptyMovieInfo(kobisInfo);
    });
  }, [crop, photo.fillEmptyMovieInfo]);
  const handleTmdbFallback = useCallback(() => {
    setTmdbOpen(false);
    handlePosterTap();
  }, [handlePosterTap]);
  // 파일 드롭 업로드(#607) — 데스크톱 ImageUploader의 드롭존이 지워지며 같이 사라졌던 경로다.
  // 프레임 안이라도 데스크톱에선 Finder에서 끌어다 놓는 게 여전히 자연스러운 진입이라 되살린다.
  // 되살린 건 **첫 업로드 CTA 하나**다. ImageUploader는 업로드 후 썸네일에도 드롭을 받았지만,
  // 그 자리를 잇는 건 온-티켓 프리뷰이고 거기에 파일 드롭을 얹는 건 #365가 미스터치 때문에
  // 걷어낸 온-티켓 포스터 제스처를 되돌리는 셈이다. 교체는 헤더 메뉴 '포스터 교체'가 담당한다.
  // 크롭 진행 중 드롭은 막는다 — getCroppedImg가 읽고 있는 원본 blob을 openFile의 교체가
  // revoke해버린다(버튼은 모달에 가려지지만 드롭은 따로 막아야 한다).
  const [posterDragOver, setPosterDragOver] = useState(false);
  const posterDropProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setPosterDragOver(true);
    },
    onDragLeave: () => setPosterDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setPosterDragOver(false);
      if (crop.isCropping) return;
      const file = e.dataTransfer.files?.[0];
      if (!file || !POSTER_ACCEPT.includes(file.type)) return;
      crop.openFile(file);
    },
  };
  async function handlePosterCropComplete(area: Area, preserveRatio: boolean) {
    const isFirstUpload = !photo.state.croppedImageUrl;
    const ok = await crop.complete(area, preserveRatio);
    // 첫 업로드는 문서 시작 — 같이 일어나는 fieldVisibility 기본셋 리셋이 undo 1스텝으로
    // 잡히면 시작하자마자 undo가 활성돼 어색하다(#356). 교체는 히스토리 유지(포스터 자체는
    // 스냅샷 밖이라 스텝도 안 생긴다).
    if (ok && isFirstUpload) history.clear();
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
  // 컨테이너 width만으로 렌더 크기를 몰기(TicketRenderer는 width에 맞춰 스케일). max는 세로 예산
  // (TicketRenderer가 스스로 max-width로 거는 것과 같은 식)을 채우는 width를 역산 — 이 항은 래퍼
  // (탭 타깃·포커스링)가 티켓 폭에 붙게 하는 몫이라 스테이지 자체 클램프와 별개로 필요하다(#532).
  const previewWidth = `min(90cqw, calc(${PREVIEW_MAX_HEIGHT} * ${layout.width} / ${layout.height}))`;
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
  const rotatedInnerWidth = `min(${PREVIEW_MAX_HEIGHT}, calc(90cqw * ${layout.width} / ${layout.height}))`;
  const rotatedStageWidth = `calc(${rotatedInnerWidth} * ${layout.height} / ${layout.width})`;

  // 앰비언트 다크 크롬(#353→#363→#415) — theme==='dark'일 때만 .chrome-dark 스코프(데스크톱
  // 레포의 data-theme 바인딩 패턴과 통일). #363에서 "테마와 무관하게 상시
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
        // 기준은 뷰포트가 아니라 폰 프레임(#605) — 모바일에선 프레임 높이가 100dvh라 값이 같다.
        height: '100cqh',
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
          #315가 제거했던 워드마크는 #363에서 복귀 확정(Wordmark 컴포넌트 재사용,
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
        <div className="flex items-center gap-0.5">
        <AutoSaveIndicator
          enabled={photo.autoSaveEnabled}
          lastSavedAt={photo.lastSavedAt}
          onToggle={photo.toggleAutoSave}
        />
        <button
          ref={hamburgerRef}
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
        {/* 완료(다음)는 편집 캔버스가 서야 렌더(canvasReady, #631 — 포스터 유무가 아니다) — 랜딩은
            진입 액션에만 집중(#363). 진입 후 canExport 전까지는 기존대로 aria-disabled + 사유 토스트. */}
        {canvasReady && (
        <button
          type="button"
          onClick={handleDone}
          aria-disabled={!canExport}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-body font-semibold transition-colors ${
            canExport ? '' : 'border border-line bg-surface-elevated text-fg-muted'
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
            {/* v8 dark-glass(#364) — 일반 카드 대신 오버레이 계층 토큰(#580) + blur. 햄버거가
                우측으로 가며(#363) 앵커도 우측 정렬.
                #569 — 배경이 --glass-fill(8%)일 땐 밝은 포스터 위에서 항목이 아예 안 읽혔다
                (흰 포스터 최악 케이스 1.02:1). 유리를 --overlay-fill(80%)로 올리고, 그래도 AA가
                안 서는 잉크(muted·accent·danger)를 위해 행 그룹을 불투명 표면에 얹는다 —
                FieldDrawer가 세운 규칙 그대로다(패널은 유리, 텍스트는 불투명 위에). */}
            {/* 내부 행 문법(#374) — 전 항목을 MenuRow(리딩 아이콘 + 14px 라벨 + 트레일링 스위치)로
                통일하고 토글/포스터 액션/문서 액션 세 그룹을 구분(시안 L296-322 이식). 구분은
                헤어라인이었으나 #569에서 그룹이 불투명 카드가 되며 카드 사이 여백이 대신한다. */}
            <div
              id="editor-menu-panel"
              role="menu"
              aria-label="편집 메뉴"
              className="absolute right-3 top-[calc(100%+8px)] z-50 w-64 rounded-card border p-2 shadow-card"
              style={{
                background: 'var(--overlay-fill)',
                borderColor: 'var(--overlay-border)',
                backdropFilter: 'blur(13px)',
                WebkitBackdropFilter: 'blur(13px)',
              }}
            >
              <div className={MENU_GROUP_CLS}>
                <MenuRow
                  iconPath={MENU_ICONS.moon}
                  label="다크모드"
                  checked={theme === 'dark'}
                  onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                />
                {/* 빈 항목은 프리뷰(포스터)가 있어야 의미가 있으므로 기존과 동일하게 게이팅. 잉크는
                    DesignRail 시절과 동일하게 포스터 유무와 무관하게 항상 노출. '전체 표시'는 필드
                    목록이 있는 FieldDrawer로 이전(#424) — 필드 목록과 한 자리에 두는 게 더 직관적이다. */}
                {canvasReady && (
                  <MenuRow
                    iconPath={MENU_ICONS.eye}
                    label="빈 항목"
                    ariaLabel="빈 항목 미리보기"
                    checked={ghostMode}
                    onClick={() => setGhostMode((v) => !v)}
                  />
                )}
                {/* 고급 설정(#574) — 접이식 '툴바 설정' 섹션을 대체하는 풀페이지 모달 진입점.
                    아래 FloatingToolbar와 **같은 조건**(canvasReady && !isMax)이어야 한다: 툴바가
                    안 떠 있으면 모달 안 스냅이 조용히 no-op이 된다(claude-review PR #405 P1).
                    #631이 툴바를 canvasReady로 옮겼으므로 이 진입점도 같이 옮긴다. 설정 성격이라
                    다크모드·빈 항목과 같은 카드에 둔다 — 메뉴는 세 카드로 유지. */}
                {canvasReady && !isMax && (
                  <MenuRow
                    iconPath={MENU_ICONS.gear}
                    label="고급 설정"
                    onClick={() => {
                      setMenuOpen(false);
                      setAdvOpen(true);
                    }}
                  />
                )}
              </div>
              {croppedImageUrl && (
                <div className={`mt-2 ${MENU_GROUP_CLS}`}>
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
                    disabled={!crop.originalSrc}
                    title={crop.originalSrc ? undefined : '재크롭하려면 포스터를 다시 업로드해 주세요'}
                    onClick={() => {
                      setMenuOpen(false);
                      crop.openRecrop();
                    }}
                  />
                </div>
              )}

              {/* 임시저장/초기화(#310) — 자동저장 폐지에 따른 명시적 트리거. croppedImageUrl 유무와
                  무관하게 항상 노출한다 — 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등
                  나머지 필드는 복원되므로(#310이 고치려는 시나리오 자체), 포스터 재업로드 전에도
                  초기화에 닿을 수 있어야 한다. 초기화 확인은 2탭 arm(#374, handleClearTap). 저장
                  피드백은 기존 flashToast 재사용. */}
              <div className={`mt-2 ${MENU_GROUP_CLS}`}>
                <MenuRow
                  iconPath={MENU_ICONS.save}
                  label="임시저장"
                  onClick={() => {
                    setMenuOpen(false);
                    // 실패 시(#645 C1) 성공 토스트를 안 띄운다 — saveDraft 내부가 이미 showError로 알린다.
                    if (photo.saveDraft()) flashToast('임시저장했어요');
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
          {canvasReady && (
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
                    // 작업면(#571) — 이 박스가 곧 "작업대"다. 배경에서 한 칸 갈린 면이라 헤더·dock과
                    // 영역이 나뉘고, 그 위에서 티켓 그림자가 비로소 보인다(--workbench 주석 참고).
                    // 패딩(px-4 py-3)은 못 건드린다 — cqw/cqh가 여기서 나오므로 #563 프리뷰 불변식
                    // (226.8×362.3)이 패딩에 물려 있다.
                    { containerType: 'size', background: 'var(--workbench)' }
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
                    ? 'crop-marks transition-transform duration-300 ease-out motion-reduce:transition-none'
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
                        // 작업면 위에 놓인 인쇄물로 읽히게 하는 양감(#571). 캡처 대상(TicketRenderer
                        // 내부 ref) 밖 래퍼라 export JPEG엔 안 섞인다. 토큰 재사용 — 결과 표면의
                        // 승격 그림자(더 강한 값 + accent 링)와 세기가 갈려 위계가 유지된다(#98).
                        // #509의 유저 형압 후가공과 별개(MoodCriterion.tsx의 대칭 주석 참고).
                        boxShadow: 'var(--shadow-pop)',
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
                    embossStamps={photo.state.embossStamps}
                    embossPaths={photo.state.embossPaths}
                    embossIntensity={photo.state.embossIntensity}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 형압 브러시(#509 c9) — 명시적 편집 모드일 때만 전체화면 포인터 캡처 레이어를 띄운다.
              position:fixed라 DOM 삽입 위치는 무관하고, getPosterEl이 매 이벤트마다 ticketBoxEl
              안의 [data-poster-root]를 다시 찾아 좌표를 낸다(무드마다 포스터 위치·크기가 달라도
              별도 동기화 없이 항상 맞는다). */}
          {photo.embossEditMode && (
            <EmbossBrushLayer
              getPosterEl={() => ticketBoxEl?.querySelector('[data-poster-root]') ?? null}
              tool={photo.embossTool}
              brushRadius={photo.embossBrushRadius}
              onStamp={photo.addEmbossStamp}
              onPath={photo.addEmbossPath}
            />
          )}

          {/* 줌 pill(#328)은 #356에서 제거 — 최대화 진입은 플로팅 툴바가 흡수, max 탈출은
              기존 티켓 탭 복귀 그대로. */}

          {/* 랜딩 오버레이(#614) — 점선 드롭존 히어로 + 랜딩 footer가 여기로 흡수됐다. 편집 셸을
              덮는 fixed 레이어지만 **셸 안 이 자리에서** 렌더한다: Landing이 조건부 unmount가 아니라
              항상 마운트 + CSS hidden이고 OCR 카드를 children으로 받아 자리만 빌려주므로, 아래
              OcrUploadCard가 랜딩·업로드 후에 걸쳐 같은 트리 위치에 남아 로컬 상태(isProcessing·
              토스트)를 전환 때마다 리셋하지 않는다 — 업로드 후·max(#328)엔 통째로 hidden이고 OCR
              진입점은 드로어(#355)로 일원화된다(#388).
              **in-flight KOBIS 보강은 remount에 안전하다**: 최신성 판정을 셸이 소유한 ocrEpochRef가
              epoch 비교로 하므로(#388 / claude-review PR #413 P0, 커밋 007f381) 카드가 unmount돼도
              setInfo는 셸의 photo 상태에 그대로 적용된다 — 드로어 카드는 닫힐 때마다 unmount되는데
              titleOg·releaseDate가 살아남는 게 그 근거다. 인스턴스 로컬 mountedRef 가드를 되살리면
              #413 P0을 재도입한다(옛 "단일 인스턴스가 아니면 레이스가 되살아난다" 서술은 #624로
              철회 — CLAUDE.md 🔍 참조). OCR 로직은 셸의 useOcrUndo가 소유. */}
          <Landing
            // 포스터가 실제로 있어야(croppedImageUrl) 랜딩을 숨긴다 — canvasReady(D1, #631)로
            // 걸면 "포스터 없이 시작" 직후에도 랜딩이 숨어 포스터를 나중에 추가할 진입점이
            // 사라진다(D2 (a): 이 inline 상태 자체가 진입점). #614 걷는 조건 ③이 이 계약을 고정한다.
            mode={croppedImageUrl || isMax ? 'hidden' : showLanding ? 'overlay' : 'inline'}
            onCta={handlePosterTap}
            onTmdbSearch={() => setTmdbOpen(true)}
            onSkip={() => setLandingDismissed(true)}
            // 갤러리 샘플 클릭 — 다섯 번째 진입점(#615). 다른 넷과 달리 "훑어보고 나중에 커밋"할
            // 로컬 미러가 없다 — 샘플 자체가 훑어보기 없는 완결된 선택이라 클릭된 무드를 그 자리에서
            // 바로 components.layout에 커밋한다.
            onEnterMood={(id) => {
              // 이미 켜져 있는 무드를 다시 누른 건 편집이 아니라 진입이다 — updateComponents는
              // 값이 같아도 dirtyTick을 올리고(usePhototicket.ts), 그러면 1초 뒤 autosave가 draft를
              // 써서 다음 방문에 draftRestored=true가 돼 랜딩(마케팅 카피·OCR 주 CTA)이 영구히
              // 안 뜬다(#615 fresh-context 리뷰). 첫 카드는 현재 무드라 오탭 한 번의 대가가 그거였다.
              // 폐기된 commitHeroLayout에 있던 동일값 가드를 이 자리로 되살린다 — 비교 대상은
              // previewComponents(280ms debounce)가 아니라 실시간 state여야 방금 바꾼 무드를 읽는다.
              //
              // **다른 무드 탭에는 일부러 안 건다.** 그쪽도 같은 경로로 draft를 쓰지만 그건 버그가
              // 아니라 autosave가 하라는 일이다 — 사용자가 실제로 고른 선택이라 다음 방문에 그
              // 무드로 돌아오는 게 맞다. 막아야 할 건 "아무것도 안 고른 탭이 상태를 만드는 것"
              // 하나뿐이고, 그래서 가드가 동일값에만 걸린다(claude-review가 물은 비대칭의 답).
              if (id !== photo.state.components.layout) photo.updateComponents({ layout: id });
              setLandingDismissed(true);
            }}
            dropProps={posterDropProps}
            dragOver={posterDragOver}
            heroMovieInfo={photo.state.movieInfo}
            heroComponents={previewComponents}
            ocrApplied={ocrApplied}
          >
            <OcrUploadCard
              setInfo={photo.updateMovieInfo}
              currentInfo={photo.state.movieInfo}
              // 스크린샷이 인식되면 랜딩을 걷는다(#614 걷는 조건 ③) — 사용자가 이미 편집에
              // 들어온 것이고, 채워진 필드가 오버레이 뒤에 가려져 있으면 안 된다. ocrApplied는
              // 그 뒤 이 카드 자신을 CSS로 숨겨 드로어가 유일한 재진입점이 되게 한다(#388, #652).
              onOcrApply={(params) => {
                setLandingDismissed(true);
                setOcrApplied(true);
                ocr.apply(params);
              }}
              setComponents={photo.updateComponents}
              currentComponents={photo.state.components}
              ocrEpochRef={ocr.epochRef}
            />
          </Landing>
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
        className={`relative shrink-0 px-4 pt-3${isMax || !canvasReady ? ' hidden' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {/* 크기 섹션의 재크롭 진입(#492) — 헤더 메뉴 '재크롭'과 같은 crop.openRecrop을 공유한다.
            원본이 없으면 안 넘겨 버튼 자체가 안 뜬다(메뉴 쪽은 disabled + 재업로드 안내를 유지). */}
        <DesignRail photo={photo} onRecropPoster={crop.originalSrc ? crop.openRecrop : undefined} />
      </div>

      {/* 필드 드로어 엣지 핸들(#364) — 우측 엣지에 드로어 존재를 암시하는 상시 인디케이터.
          툴바의 항목목록 버튼과 진입점 병존(툴바를 모르면 드로어를 못 찾는 문제의 직접 해소).
          #569 — 탭 배경이 --glass-fill(8%)이라 밝은 포스터 위에서 핸들 자체가 안 보였다.
          오버레이 계층 토큰으로 올리고, 셰브런 잉크도 --fg-muted → --fg로(라이트 테마 최악
          케이스에서 muted는 2.77:1로 비텍스트 3:1도 못 넘긴다. --fg는 8.66/10.31:1).
          히트영역은 44px(왼쪽으로 투명 확장), 보이는 탭은 24px 글래스(#447 — 이전 20px는 눈에
          덜 띈다는 지적). z-30 — 편집 백드롭(z-40) 아래라 인플레이스 편집 중엔 가려지고,
          드로어(z-50)가 열리면 그 뒤에 깔린다.
          #567·#579 — 순수 탭은 여전히 onClick으로 열린다(비드래그 대체 경로, WCAG 2.2 SC
          2.5.7). 수평 드래그(왼쪽으로 당기기)는 열기, 수직 드래그는 핸들 이동 — 위 onHandle*
          핸들러가 축을 가른다. drawerHandleY가 null이면 기존 화면 정중앙 그대로. */}
      {canvasReady && !isMax && (
        <button
          ref={drawerHandleRef}
          type="button"
          onClick={onHandleClick}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-label="티켓 항목 목록 열기"
          className={`fixed right-0 z-30 flex h-24 w-11 items-center justify-end ${
            drawerHandleY == null ? 'top-1/2 -translate-y-1/2' : ''
          }`}
          style={{
            touchAction: 'none',
            ...(drawerHandleY != null ? { top: drawerHandleY, transform: 'none' } : undefined),
          }}
        >
          <span
            aria-hidden="true"
            className="flex h-full w-6 items-center justify-center rounded-l-[10px] border border-r-0 border-[var(--overlay-border)] text-fg"
            style={{
              background: 'var(--overlay-fill)',
              backdropFilter: 'blur(13px)',
              WebkitBackdropFilter: 'blur(13px)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </span>
        </button>
      )}

      {/* 플로팅 툴바(#356) — undo/redo·항목목록·최대화·숨김(배치설정은 #387에서 헤더 메뉴로 이전).
          프리뷰가 있어야 의미가 있고, max는 티켓만 남기는 풀스크린이라 숨긴다(탈출은 티켓 탭).
          필드 편집·드로어 중에도 셸이 계속 렌더한다 — 겹침 규칙은 z-index로(툴바 45: 편집 백드롭 40 위,
          드로어 50 아래). */}
      {canvasReady && !isMax && (
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

      {/* 고급 설정 모달(#574) — 햄버거의 '고급 설정' 행이 연다. 게이팅은 진입점과 동일하게
          canvasReady && !isMax(#631): 툴바가 안 떠 있으면 toolbarRef가 비어 스냅이 조용히
          no-op된다(claude-review PR #405 P1). tbPrefs 소유권은 셸에 남기고 값만 내려준다. */}
      {advOpen && canvasReady && !isMax && (
        <AdvancedSettingsModal
          triggerRef={hamburgerRef}
          prefs={tbPrefs}
          onModeChange={applyToolbarMode}
          onSnap={snapToolbarTo}
          onSnapDrawerHandle={snapDrawerHandleTo}
          onClose={() => setAdvOpen(false)}
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
      {drawerOpen && canvasReady && (
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
            onNeedManualTitle={() => {
              setDrawerOpen(false);
              handleField('title');
            }}
          />
        </FieldDrawer>
      )}

      {/* 포스터 크롭 파이프라인(#259 on-ticket tap + #315 드롭존·서브메뉴 교체/재크롭 통합) — 숨김
          파일 input + 크롭 모달. 탭 → input.click() → 파일 선택 → ImageCropModal(기본 0.667) →
          getCroppedImg → handleImageUpload. originalSrc는 크롭 완료 후에도 유지돼 재크롭에 재사용된다. */}
      {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus) — FieldDrawer.tsx:297와 동일 판단. */}
      <input
        ref={posterInputRef}
        type="file"
        accept={POSTER_ACCEPT.join(',')}
        aria-label="포스터 이미지 파일"
        onChange={handlePosterFile}
        className="sr-only"
      />
      {crop.cropOpen && crop.originalSrc && (
        <ImageCropModal
          imageSrc={crop.originalSrc}
          onClose={crop.cancel}
          onComplete={handlePosterCropComplete}
          isProcessing={crop.isCropping}
          // previewComponents(pages/index.tsx의 280ms debounce)가 아니라 실시간 state를 읽는다 —
          // debounced 값을 쓰면 모달이 방금 커밋된 무드가 아니라 직전 무드의 크롭 프리셋으로
          // 열렸다가 ~280ms 뒤 갑자기 재계산됐다(#529 invariant 위반, claude-review PR #636 P0).
          layout={photo.state.components.layout}
        />
      )}

      {tmdbOpen && (
        <TmdbPosterModal
          onClose={() => setTmdbOpen(false)}
          onSelect={handleTmdbSelect}
          onFallbackUpload={handleTmdbFallback}
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
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-line bg-surface-elevated px-4 py-2 text-body text-fg"
          style={{ maxWidth: 'calc(100% - 32px)', boxShadow: 'var(--shadow-pop)' }}
        >
          {toast}
        </div>
      )}

      {/* 실패 알림 단일 진입점(#645) — usePosterCrop·usePhototicket 등 셸 트리 밖 훅이 직접
          부르는 모듈 싱글턴을 여기서 한 번만 구독해 렌더한다. PhoneFrame 안에 있어야 fixed
          좌표가 contain:paint에 갇힌다(#609). */}
      <ErrorToastHost />
    </div>
  );
}
