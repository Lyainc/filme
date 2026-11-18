import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { EditorDock, type DockMode } from './dock/EditorDock';
import { EditorMenu } from './EditorMenu';
import { Landing } from './Landing';
import { OcrUploadCard } from './OcrUploadCard';
import { OcrUndoBanner } from './OcrUndoBanner';
import { APP_BACKGROUND_ID } from './PhoneFrame';
import type { ViewMode } from './viewMode';
import TicketRenderer, { PREVIEW_MAX_HEIGHT } from '@/components/TicketRenderer';
import { getLayout } from '@/utils/layouts';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import type { Area } from '@/utils/imageCrop';
import { useEditHistory } from '@/hooks/useEditHistory';
import { useOcrUndo } from '@/hooks/useOcrUndo';
import type { usePhototicket } from '@/hooks/usePhototicket';
import { INITIAL_STATE } from '@/hooks/usePhototicket';
import type { LayoutId, MovieInfo, TicketComponents, TicketField } from '@/types';
import { isStampTarget, STAMP_KEYS, type SheetTarget } from '@/constants/fields';
import { ErrorToastHost } from '@/utils/errorToast';
import type { ThemePreference } from '@/constants/theme';

// 온티켓 인플레이스 에디터(#354) — RatingPicker·DateSheet(FieldEditorBody)를 끌어오므로
// 시트와 같은 이유로 dynamic(ssr:false), 첫 필드 탭에 로드된다.
const InPlaceFieldEditor = dynamic(
  () => import('./InPlaceFieldEditor').then((m) => m.InPlaceFieldEditor),
  { ssr: false },
);

// 포스터 탭(#259) 크롭 모달 — 로고 크롭과 같은 컴포넌트다. 탭 전엔 안 쓰므로 dynamic.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

// 포스터 파일 입력의 accept이자 드롭 필터(#607) — input과 드롭이 서로 다른 목록을 쓰면
// 드롭만 되는(혹은 안 되는) 포맷이 조용히 갈린다.
const POSTER_ACCEPT = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

// 상단 줄 아이콘(#826 S2 C-TB, 마스터 lib.js ICONS) — 20px / stroke 1.75, 버튼 44px 안에 앉는다.
const TB_ICONS = {
  back: <path d="M15 5l-7 7 7 7" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" />,
};

const TB_BUTTON_CLS =
  'flex h-touch w-touch shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:text-ink disabled:opacity-40';

function TbIcon({ name }: { name: keyof typeof TB_ICONS }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TB_ICONS[name]}
    </svg>
  );
}

interface MobileEditorShellProps {
  photo: ReturnType<typeof usePhototicket>;
  canExport: boolean;
  /** 실제로 칠하는 테마 — 선호가 시스템이면 OS 값으로 풀린 결과다. */
  theme: 'light' | 'dark';
  /** 메뉴 테마 행이 보여 주는 선호값(#826 S2 D09). */
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
  /** 완료(결과 열기) — useResultView.openView */
  onDone: () => void;
  /** 완료 비활성 시 안내 문구(=railMessage). 탭하면 토스트로 노출. */
  disabledReason: string;
  /** 인라인 프리뷰는 디바운스된 값으로 렌더(폼 입력이 프리뷰를 매타건 리렌더하지 않게). 티켓 위 직접 편집 중엔 부모가 debounce를 건너뛴다(#775). */
  previewMovieInfo: MovieInfo;
  /** 티켓 위 직접 편집 진입/종료 알림 — 부모가 그동안 프리뷰 debounce를 건너뛴다(#775). */
  onFieldEditingChange?: (editing: boolean) => void;
  previewComponents: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

export function MobileEditorShell({
  photo,
  canExport,
  theme,
  themePreference,
  onThemeChange,
  onDone,
  disabledReason,
  previewMovieInfo,
  onFieldEditingChange,
  previewComponents,
  fieldVisibility,
}: MobileEditorShellProps) {
  const { croppedImageUrl } = photo.state;
  // OCR 낙관적 주입 + 되돌리기 로직은 useOcrUndo가 소유(#141-class drift 방지).
  // OCR 카드는 셸 프리뷰 직하에 두고(#261) 이 훅도 셸이 쥔다.
  const ocr = useOcrUndo(photo);
  // 전역 undo/redo(#356) — usePhototicket 위 히스토리 레이어. useOcrUndo와는 독립(이슈 결정,
  // #141 회귀 테스트 보호). 진입점은 상단 줄의 실행 취소 · 다시 실행(#826 S2).
  const history = useEditHistory(photo);
  const [activeField, setActiveField] = useState<SheetTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  // 빈 항목 표시(ghost, #216) — 셸 로컬, 미영속. 메뉴 스위치가 사진 · 디자인 모드의 값을 정한다(D03 A, 기본 꺼짐).
  // 정보 모드는 자동으로 켜지고 필드 입력 중은 강제로 켠다(아래 ghost 합성).
  const [ghostMode, setGhostMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 편집 메뉴 시트(#826 S2 D09) — 열려 있는 동안만 EditorMenu가 마운트된다(초기화 arm도 그 안에 산다).
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // ⋯ 버튼 — 메뉴가 닫힐 때 포커스가 돌아간다.
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // 랜딩을 사용자가 **떠났는가** — 랜딩 표시 판정의 단일 소스다(#727 c2, #675 D7 뒤집기).
  // 예전엔 draftRestored·croppedImageUrl·crop.cropOpen 같은 파생값을 섞었는데, 그러면 "사용자가
  // 방금 크롭했다"와 "IndexedDB 복원이 포스터를 늦게 가져왔다"가 구분되지 않아 포스터 있던 draft
  // 재방문에서 랜딩이 도로 숨었다. 이탈을 state로 명시하면 그 구분이 공짜로 생긴다.
  // 세우는 다섯 경로: OCR 적용 · 포스터 크롭 확정 · 직접 입력 · 무드 갤러리 탭 · 이어서 만들기.
  // 초기화(performClear)와 편집 상단 ‹(handleBack, #826 S2)가 false로 되돌려 랜딩이 복귀한다.
  const [landingDismissed, setLandingDismissed] = useState(false);
  // ocrApplied(#652)는 #727에서 삭제됐다 — 그 신호가 하던 일(OCR 적용 후 랜딩 본문의 주 CTA·이탈
  // 경로를 CSS로 숨겨 OCR 재진입을 한 곳으로 모으기, #388 > #631 D2 a)은 이제 Landing
  // 컨테이너 자체가 한다: OCR 적용은 landingDismissed를 세우고 그게 곧 mode='hidden'이라
  // 안쪽 블록을 따로 숨길 상태가 코드상 존재하지 않는다(inline 소멸, c3).
  // 편집 크롬(완료·도크·툴바)을 열지 판정하는 **셸 게이트**다 — #727부터 랜딩 표시와는
  // 완전히 갈렸다(랜딩은 landingDismissed 하나로만 판정한다, c2). 포스터가 없어도 편집 캔버스는
  // 설 수 있다(#631) — "포스터가 있다"(croppedImageUrl)와 "편집할 캔버스가 섰다"는 다른 명제다.
  // photo.awaitingPosterRestore(#683)는 포스터 있던 draft 재방문에서 croppedImageUrl이 IndexedDB
  // 왕복을 기다리는 창을 메운다 — 그 창에도 크롬이 서 있어야 랜딩 뒤가 빈 셸이 아니다.
  const canvasReady = !!croppedImageUrl || landingDismissed || photo.awaitingPosterRestore;
  // 편집 도크 모드(#826 S2 E-01) — 사진 · 정보 · 디자인. 처음 진입은 스크린샷으로 채웠으면 디자인(OCR 적용이
  // 랜딩에서 온 새 문서일 때 onOcrApply가 올린다), 아니면 정보다. 새로 시작하는 경로(포스터 업로드 · 직접 입력 ·
  // 무드 탭 · 초기화)는 startFreshDoc/performClear가 정보로 되돌린다. 완료 실패(handleDone)와 온-티켓 항목 목록
  // 버튼도 정보로 보낸다.
  const [dockMode, setDockMode] = useState<DockMode>('info');
  // 랜딩에 한 벌뿐인 OcrUploadCard의 업로드 열기(#826 S2 constraint-17) — 카드가 매 렌더 채운다. 정보 모드
  // 버튼이 같은 파일 선택을 열고, 인식 중 표시는 카드가 onBusyChange로 알려 준다.
  const ocrOpenRef = useRef<(() => void) | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  // 보기 전환(전체 보기 진입 · 복귀)이 메뉴를 열린 채로 남기지 않게 항상 같이 닫는다(claude-review PR #332 P2).
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
  useEffect(() => {
    onFieldEditingChange?.(editing);
    return () => onFieldEditingChange?.(false);
  }, [editing, onFieldEditingChange]);
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
  // 랜딩을 걷는 조건은 이제 하나다(#727 c1·c2·c4) — 사용자가 실제로 떠났는가.
  //  · croppedImageUrl을 뺀 이유: IndexedDB 복원이 포스터를 늦게 가져오는 것과 사용자가 방금
  //    크롭한 것을 구분하지 못해, 포스터 있던 draft 재방문에서 랜딩이 다시 숨었다(c1).
  //  · crop.cropOpen을 뺀 이유: 크롭 모달은 z-50 + DOM 순서상 랜딩보다 뒤라 걷지 않아도 위에
  //    그려진다. 이 항이 하던 일(취소 시 빈 셸 방지)은 이탈 state가 안 서 있으므로 저절로 성립한다(c4).
  //  · draftRestored를 뺀 이유: 그게 #675 D7이고, 이 작업이 뒤집는 명제 자체다(c1).

  function flashToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function handleDone() {
    if (!canExport) {
      flashToast(disabledReason);
      // 사유 토스트만으론 어디서 채우는지 모른다(#776) — 정보 모드로 바꿔 빈 필수 행의 앰버 점과 '필수'가 보이게
      // 한다(E-03). 키보드는 자동으로 올리지 않는다 — 행을 탭해야 입력이 열리고, 숨겨 둔 필드면 그 탭(openMissingField)이
      // 편집 뒤 다시 숨긴다.
      setDockMode('info');
      return;
    }
    onDone();
  }

  // 메뉴 초기화 행(2탭 arm, #374)이 부르는 실제 초기화 절차. 워드마크 탭 초기화(#578 · #669)는 #826 S2에서 없앴다.
  function performClear() {
    photo.clearDraft();
    rehideOnLeaveRef.current.clear(); // 누락 바로가기의 재숨김(#776)이 새 문서로 넘어가지 않게.
    // 초기화는 새 문서니까 랜딩도 처음 상태로 — 안 되돌리면 포스터도 draft도 없는 빈 셸에 남는다(#614).
    setLandingDismissed(false);
    setDockMode('info');
    // 초기화는 새 문서 — undo로 못 돌아간다(로고·포스터 blob이 revoke돼
    // 복원해도 죽은 참조라 히스토리째 파기가 맞다).
    history.clear();
    // OCR 되돌리기도 옛 문서의 것이다(#804) — startFreshDoc 주석 참고.
    ocr.confirm();
    flashToast('초기화했어요');
  }

  // 임시저장(#310) — 실패 시(#645 C1) 성공 토스트를 안 띄운다. saveDraft 내부가 이미 showError로 알린다.
  function handleSaveDraft() {
    if (photo.saveDraft()) flashToast('임시저장했어요');
  }

  // 편집 상단 ‹(#826 S2 constraint-15) — 문서를 지우지 않고 랜딩으로 간다. 임시저장을 한 번 하고(자동저장이 꺼져 있어도 새로고침에
  // 남는다) 랜딩을 다시 띄운다. 저장이 실패하면 편집 화면에 남는다 — 실패 알림은 saveDraft가 이미 띄웠고, 랜딩으로 가면 그 사이
  // 문서가 유실될 수 있는 길이 열린다. 랜딩의 '이어서 만들기'(onRestore)는 저장분이 아니라 메모리 문서를 그대로 연다.
  // has-draft는 그 행의 첫 페인트 게이트라(globals.css) 이 세션에 저장분이 처음 생긴 경우에도 행이 보이게 같이 세운다.
  function handleBack() {
    closeMenu();
    if (!photo.saveDraft()) return;
    document.documentElement.classList.add('has-draft');
    closeEditor();
    setLandingDismissed(false);
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

  // 정보 모드 필수 누락 행의 바로가기(#776) — 저장 필수 입력은 채우되 표시 선택은 지킨다. 인플레이스 편집기는
  // 티켓 위 앵커가 있어야 떠서 handleField가 숨긴 필드를 켜는데, 바로가기로 들어온 필드가 원래
  // 숨겨져 있었다면 편집이 끝나는 순간(닫힘·다른 필드로 이동) 다시 숨긴다. 행 탭은 "보이게 켜고
  // 편집"이 의도라 이 복원을 안 탄다.
  // ponytail: 편집 중 필드바의 '티켓 노출'로 일부러 켰어도 끝날 때 다시 숨긴다 — 그 조작을 가려야
  // 할 일이 생기면 복원 대상을 그 토글에서 지운다.
  // 대기 중인 필드는 집합으로 든다 — 같은 바로가기를 다시 눌러도(이미 켜져 있어 판정이 '보임'이 된다)
  // 잊지 않고, 다른 누락 필드로 옮기면 떠나는 쪽을 숨긴다. 새 문서(초기화·새로 시작)에선 비운다.
  const rehideOnLeaveRef = useRef(new Set<TicketField>());
  const openMissingField = useCallback((target: TicketField) => {
    if (!photo.state.fieldVisibility[target]) rehideOnLeaveRef.current.add(target);
    handleField(target);
  }, [handleField, photo.state.fieldVisibility]);
  useEffect(() => {
    const pending = rehideOnLeaveRef.current;
    const leaving = Array.from(pending).filter((field) => field !== activeField);
    if (leaving.length === 0) return;
    leaving.forEach((field) => pending.delete(field));
    photo.updateFieldVisibility(Object.fromEntries(leaving.map((field) => [field, false])));
  }, [activeField, photo.updateFieldVisibility]);

  // 첫 업로드·교체(새 파일 선택) — 포스터 드롭존 탭, 서브메뉴 "교체", 그리고 포스터가 없을 때의
  // 온-티켓 탭(#723)이 전부 이 경로.
  // 온-티켓 탭은 #259가 넣었다가 미스터치로 파일선택창이 떠서 제거됐는데(#365), 그때 문제가 된 건
  // "포스터가 **있는** 상태에서 빈 곳 오탭"이다. #723이 `!croppedImageUrl` 게이트를 달아 되살렸다 —
  // 포스터 없이 진입한 세션(#631 '직접 입력' · OCR)에선 그 자리가 단색 바탕이라 오탭할 '빈 곳'이
  // 아니라 그 자체가 비어 있는 포스터 슬롯이고, 재진입 동선이 한 곳뿐이었다(#674 — 지금은 도크 사진 모드, #826 S2).
  const handlePosterTap = useCallback(() => {
    posterInputRef.current?.click();
  }, []);
  function handlePosterFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) crop.openFile(file);
    e.target.value = '';
  }

  // 파일 드롭 업로드(#607) — 데스크톱 ImageUploader의 드롭존이 지워지며 같이 사라졌던 경로다.
  // 프레임 안이라도 데스크톱에선 Finder에서 끌어다 놓는 게 여전히 자연스러운 진입이라 되살린다.
  // 되살린 건 **첫 업로드 CTA 하나**다. ImageUploader는 업로드 후 썸네일에도 드롭을 받았지만,
  // 그 자리를 잇는 건 온-티켓 프리뷰이고 거기에 파일 드롭을 얹는 건 #365가 미스터치 때문에
  // 걷어낸 온-티켓 포스터 제스처를 되돌리는 셈이다. 교체는 도크 사진 모드(#826 S2)가 담당한다.
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
  // 랜딩의 "새로 시작" 네 경로가 공유하는 진입 커밋(#727 c7) — 메모리 문서만 새 문서로 되돌리고
  // localStorage/IndexedDB 저장분은 그대로 둔다. 저장분이 덮이는 건 새 문서의 첫 자동저장이라,
  // 자동 회전 캐러셀 오탭 같은 사고가 새로고침 한 번으로 복구된다. "이어서 만들기"는 이걸 안 부른다.
  function startFreshDoc(opts?: { layout?: LayoutId; keepPoster?: boolean }) {
    photo.resetDocument(opts);
    // 새 문서의 첫 모드는 정보다 — 스크린샷으로 채운 경우만 onOcrApply가 이 뒤에 디자인으로 올린다(같은 배치의
    // 마지막 setState가 이긴다).
    setDockMode('info');
    rehideOnLeaveRef.current.clear(); // performClear와 같은 이유(#776).
    // 새 문서 — 복원된 문서로 undo해 돌아가면 안 된다(#356 clear는 다음 상태를 새 베이스라인으로 잡는다).
    history.clear();
    // OCR 되돌리기 스냅샷도 옛 문서의 것이라 버린다(#804) — 안 버리면 배너가 남아 새 문서에 옛
    // OCR 전 값을 되돌린다. 랜딩 OCR(onOcrApply)은 이 직후 같은 배치에서 ocr.apply로 새 스냅샷을
    // 뜨므로 마지막 setState인 그쪽이 이긴다. epochRef는 안 올린다: 리셋 뒤 늦은 KOBIS 보강은
    // docEpochRef(#793)가 이미 버리고, 그때 부르는 dropKobisFields가 새 스냅샷의 KOBIS 키를
    // 건드리려면 새 OCR에 제목이 있어야 하는데 그 실행이 epoch를 올려 옛 응답을 먼저 걸러낸다.
    // #806 이후로는 이 줄이 막을 스냅샷이 오는 경로가 없다 — 랜딩을 다시 띄우는 performClear가 이미
    // 버리고, 초기화를 건너 도착한 OCR 응답은 OcrUploadCard가 버린다(captureDraft). 그래서 어떤 테스트도
    // 이 줄 단독 삭제를 못 잡는다. 그래도 둔다: history.clear()와 짝인 "새 문서엔 옛 OCR 되돌리기가 없다"를 이
    // 경계에서 지키면, 그 두 비국소 전제 중 하나가 바뀌어도 되살아나지 않는다.
    ocr.confirm();
  }

  async function handlePosterCropComplete(area: Area, preserveRatio: boolean) {
    // 랜딩에서 올라온 첫 포스터는 "새로 시작"이다(c7). 교체·재크롭은 이미 이탈한 상태라 문서를
    // 안 건드린다 — 여기를 게이트 없이 리셋하면 포스터를 바꿀 때마다 문서가 통째로 날아간다.
    const fresh = !landingDismissed;
    const isFirstUpload = !photo.state.croppedImageUrl;
    const ok = await crop.complete(area, preserveRatio);
    // 실패(getCroppedImg 예외·await 사이 원본 교체)면 모달이 열린 채 남아 재시도 가능하고,
    // 랜딩도 문서도 손대지 않은 그대로다.
    if (!ok) return;
    if (fresh) {
      // **크롭이 성공한 뒤에** 되돌린다. 먼저 되돌리면 실패 토스트("다시 시도해 주세요") 뒤에
      // 랜딩은 그대로인데 문서만 비어, "이어서 만들기"가 제목 없는 라벨로 빈 편집 화면을 열고
      // 그 상태의 첫 편집이 멀쩡한 저장분을 덮는다(c7이 막으려는 그 유실). keepPoster는 방금
      // 확정한 포스터·크롭 원본을 유지하고 노출셋만 첫 업로드 기본값으로 세운다 — setState가
      // 전부 함수형이라 커밋 뒤에 큐에 들어가도 결과는 같다.
      startFreshDoc({ keepPoster: true });
      setLandingDismissed(true);
      return; // startFreshDoc이 이미 history.clear()를 했다
    }
    // 첫 업로드는 문서 시작 — 같이 일어나는 fieldVisibility 기본셋 리셋이 undo 1스텝으로
    // 잡히면 시작하자마자 undo가 활성돼 어색하다(#356). 교체는 히스토리 유지(포스터 자체는
    // 스냅샷 밖이라 스텝도 안 생긴다).
    if (isFirstUpload) history.clear();
  }

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
      {/* 앱 배경 래퍼(#685) — 다이얼로그가 열리면 이 안(헤더·본문·dock·툴바)만 inert된다.
          display:contents라 app-canvas의 flex 레이아웃엔 안 끼어든다(레이아웃용 박스가 아니라
          inert 타깃 하나 잡으려는 용도). 토스트류는 이 래퍼 밖(아래)에 남겨 다이얼로그가 열려도
          계속 살아있게 한다 — PhoneFrame.tsx의 APP_BACKGROUND_ID 주석 참고. */}
      <div id={APP_BACKGROUND_ID} className="contents">
      {/* 앰비언트 배경(#353→#415) — .chrome-ambient는 --pr-stage 평면(globals.css)이다.
          theme==='dark'일 때만 렌더하고,
          라이트 테마는 데스크톱과 톤을 맞춰(#415 권장) app-canvas의 --bg 그대로 노출한다.
          형제 콘텐츠(header는 relative, 본문 래퍼도 relative)가 위에 그려진다. */}
      {theme === 'dark' && (
        <div
          aria-hidden="true"
          data-testid="chrome-ambient"
          className="chrome-ambient pointer-events-none absolute inset-0"
        />
      )}
      {/* 상단 줄(#826 S2 C-TB, E-01) — ‹ · 빈 공간 · 실행 취소 · 다시 실행 · 전체 보기 · ⋯ · 완료. 높이 52, 버튼 44.
          워드마크는 이 줄에 없다(편집 화면에선 브랜드 표시를 안 쓴다 — 워드마크 탭 초기화 제거, Seed constraint-7).
          전체 보기(max, #328)는 이 줄까지 숨기는 풀스크린 모드라 통째로 언마운트한다. 완료는 편집 캔버스가 서야 렌더(canvasReady,
          #631 — 포스터 유무가 아니다), 차단 상태는 테두리만 있는 aria-disabled이고 탭하면 사유 토스트 + 정보 모드(handleDone). */}
      {!isMax && (
        <header className="relative flex h-[52px] shrink-0 items-center px-1">
          <button type="button" onClick={handleBack} aria-label="랜딩으로 돌아가기" className={cn(pressableVariants(), TB_BUTTON_CLS)}>
            <TbIcon name="back" />
          </button>
          <span className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => {
              history.undo();
              flashToast('되돌렸어요');
            }}
            disabled={!history.canUndo}
            aria-label="실행 취소"
            className={cn(pressableVariants(), TB_BUTTON_CLS)}
          >
            <TbIcon name="undo" />
          </button>
          <button
            type="button"
            onClick={() => {
              history.redo();
              flashToast('다시 실행했어요');
            }}
            disabled={!history.canRedo}
            aria-label="다시 실행"
            className={cn(pressableVariants(), TB_BUTTON_CLS)}
          >
            <TbIcon name="redo" />
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('max')}
            disabled={!canvasReady}
            aria-label="전체 보기"
            className={cn(pressableVariants(), TB_BUTTON_CLS)}
          >
            <TbIcon name="expand" />
          </button>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="editor-menu-panel"
            aria-label="편집 메뉴"
            className={cn(pressableVariants(), TB_BUTTON_CLS)}
          >
            <TbIcon name="more" />
          </button>
          {canvasReady && (
            <button
              type="button"
              onClick={handleDone}
              aria-disabled={!canExport}
              className={cn(
                pressableVariants(),
                'ml-2 mr-3 inline-flex h-touch shrink-0 items-center justify-center rounded-md border border-accent bg-accent px-4 text-body font-semibold text-accent-ink transition-colors',
                'aria-disabled:border-hair-strong aria-disabled:bg-transparent aria-disabled:font-medium aria-disabled:text-ink-2',
              )}
            >
              완료
            </button>
          )}
        </header>
      )}

      {/* 편집 메뉴 시트(#826 S2 D09) — 앱 배경 래퍼 안에 둔다. 배경을 inert로 잠그지 않는 건 ⋯ 재탭 닫기가 살아야 해서다. */}
      {!isMax && menuOpen && (
        <EditorMenu
          ghost={ghostMode}
          onGhostChange={setGhostMode}
          themePreference={themePreference}
          onThemeChange={onThemeChange}
          autoSaveEnabled={photo.autoSaveEnabled}
          lastSavedAt={photo.lastSavedAt}
          onAutoSaveToggle={photo.toggleAutoSave}
          // 랜딩에 한 벌뿐인 OcrUploadCard의 업로드를 연다(constraint-17) — 카드를 메뉴에 새로 마운트하지 않는다.
          onOcrOpen={() => ocrOpenRef.current?.()}
          ocrBusy={ocrBusy}
          onSaveDraft={handleSaveDraft}
          onClear={performClear}
          onClose={closeMenu}
          returnFocusRef={menuButtonRef}
        />
      )}

      {/* 본문: 업로드 후엔 인라인 프리뷰만(OCR 진입점은 정보 모드 버튼 — #388 → #826 S2, footer는 편집 화면에서
          제거 — 도크 위에 고지가 끼는 어색한 위계를 없앴다. 고지는 랜딩 + 공유 플로우
          (ResultPanel·/t/[id])가 커버), 업로드 전엔 랜딩 히어로 + footer. 꾸미기는 #357에서 본문 밖 하단 고정 dock으로 이동.
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
              // 포스터 드롭(#607)은 원래 랜딩 루트에만 걸려 있었는데, #674로 캔버스가 서면 랜딩이
              // 숨으므로 그대로 두면 display:none 위의 죽은 핸들러가 된다 — '직접 입력'·OCR·무드
              // 샘플로 들어온 세 경로가 첫 업로드 전에 드롭을 잃는다. 랜딩이 보이는 상태와 이
              // 스테이지가 뜨는 상태는 canvasReady로 배타라 중복 발화가 없다.
              {...posterDropProps}
              // max 스테이지 자체도 "포스터 rect 밖 탭" 탈출구여야 한다(#729 ac3) — 안쪽 wrapper
              // (setPreviewWrapEl)는 풀블리드 무드(minimal·stub·editorial)에서 포스터와 거의 같은
              // 크기라, 포스터와 스테이지 사이 여백(실측 47.9~120.8px)을 탭하면 이 바깥 div가
              // 먼저 잡혀 wrapper의 onClick까지 안 닿는다(elementFromPoint 실측으로 확인된 버그 —
              // 비풀블리드 무드는 wrapper가 더 커서 우연히 가려져 있었다). wrapper 자체 클릭은
              // 버블링으로 여기도 같이 타지만 handleViewModeChange가 멱등이라 무해하다.
              onClick={isMax ? () => handleViewModeChange('default') : undefined}
              className={
                isMax
                  ? `fixed inset-0 z-50 flex items-center justify-center bg-s1 px-6${
                      posterDragOver ? ' outline outline-2 -outline-offset-2 outline-accent' : ''
                    }`
                  : `flex min-h-0 flex-1 items-center justify-center px-4 py-3${
                      posterDragOver ? ' outline outline-2 -outline-offset-2 outline-accent' : ''
                    }`
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
                      // handleViewModeChange 경유 — 직접 setViewMode를 부르면 max→default 탈출이
                      // 메뉴·인플레이스 편집 정리를 못 탄다(위 handleViewModeChange).
                      onClick: () => handleViewModeChange('default'),
                      onKeyDown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleViewModeChange('default');
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
                    // 빈 항목(#826 S2 constraint-8): 필드 입력 중 강제 on(#354) · 정보 모드 자동 on · 그 밖엔 메뉴 스위치.
                    // 전체 보기에선 항상 끈다. 빈/숨김 필드도 탭·순회 타깃으로 티켓에 남는다.
                    ghost={!isMax && (ghostMode || editing || dockMode === 'info')}
                    onField={viewMode === 'default' ? handleField : undefined}
                    // 포스터가 없을 때만 온-티켓 탭으로 업로드를 연다(#723) — 게이트가 #365의
                    // 미스터치(포스터가 있는데 빈 곳을 눌러 파일선택창이 뜨던 것)를 되도입하지
                    // 않게 막는다. viewMode 조건은 위 onField와 같은 이유 — max에선 티켓 탭이
                    // "기본 크기로 돌아가기"라 그쪽이 먼저다.
                    onPosterTap={
                      viewMode === 'default' && !croppedImageUrl ? handlePosterTap : undefined
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* 줌 pill(#328)은 #356에서 제거 — 전체 보기 진입은 상단 줄 버튼(#826 S2), 탈출은
              기존 티켓 탭 복귀 그대로. */}

          {/* 랜딩 오버레이(#614) — 점선 드롭존 히어로 + 랜딩 footer가 여기로 흡수됐다. 편집 셸을
              덮는 fixed 레이어지만 **셸 안 이 자리에서** 렌더한다: Landing이 조건부 unmount가 아니라
              항상 마운트 + CSS hidden이고 OCR 카드를 children으로 받아 자리만 빌려주므로, 아래
              OcrUploadCard가 랜딩·업로드 후에 걸쳐 같은 트리 위치에 남아 로컬 상태(isProcessing·
              토스트)를 전환 때마다 리셋하지 않는다 — 업로드 후·max(#328)엔 통째로 hidden이고 OCR
              진입점은 도크 정보 모드 버튼(#826 S2, 옛 드로어 #355)이 이 카드의 업로드를 연다(#388).
              **in-flight KOBIS 보강은 remount에 안전하다**: 최신성 판정을 셸이 소유한 ocrEpochRef가
              epoch 비교로 하므로(#388 / claude-review PR #413 P0, 커밋 007f381) 카드가 unmount돼도
              setInfo는 셸의 photo 상태에 그대로 적용된다 — 옛 드로어 카드는 닫힐 때마다 unmount됐는데
              titleOg·releaseDate가 살아남은 게 그 근거다(카드는 지금 한 벌뿐이다). 영화 수명(captureMovieSelection의
              movieSelectionRef·docEpochRef, #793)도 셸이 쥐어 같은 이유로 remount와 무관하다.
              인스턴스 로컬 mountedRef 가드를 되살리면 #413 P0을 재도입한다(옛 "단일 인스턴스가
              아니면 레이스가 되살아난다" 서술은 #624로 철회 — docs/CONTRIBUTING.md §5 참조). OCR 로직은 셸의 useOcrUndo가 소유. */}
          <Landing
            // 랜딩은 두 모드뿐이다(#727 c3) — 떠났으면 hidden, 아니면 overlay. inline은 삭제됐다:
            // 새 판정에선 도달 불가능하고(landingDismissed ⇒ hidden), 실제 화면도 헤드카피·히어로·
            // 배경 타일·AppFooter를 전부 안 그려 "랜딩이 안 뜬 것"처럼 보였다. inline이 지키던 두
            // 명제(텍스트만 있던 draft의 진입 표면, IDB 복원 실패 시 #489 결정 5의 재업로드 유도)는
            // 이제 상시 노출되는 오버레이 랜딩 자신이 더 낫게 받는다.
            // mode='hidden'은 unmount가 아니라 CSS다(#297 P1) — children(OcrUploadCard) 단일
            // 인스턴스 계약(#614/#624)이 여기 걸려 있다.
            // **포스터 재진입 동선은 도크 사진 모드에 있다**(#826 S2) — canvasReady를 따라 도크가 뜬다.
            mode={isMax || landingDismissed ? 'hidden' : 'overlay'}
            onCta={handlePosterTap}
            // "이어서 만들기"(#727 c5) — 유일하게 문서를 안 되돌리는 이탈이다. 복원된 draft를
            // 그대로 들고 편집으로 들어간다.
            onRestore={() => setLandingDismissed(true)}
            restoreTitle={photo.state.movieInfo.title}
            onSkip={() => {
              startFreshDoc();
              setLandingDismissed(true);
            }}
            // 갤러리 샘플 클릭 — 네 번째 진입점(#615). 다른 셋과 달리 "훑어보고 나중에 커밋"할
            // 로컬 미러가 없다 — 샘플 자체가 훑어보기 없는 완결된 선택이라 클릭된 무드를 그 자리에서
            // 바로 components.layout에 커밋한다.
            onEnterMood={(id) => {
              // 무드 탭은 "새 문서를 이 무드로 시작"이다 — #615의 동일값 가드는 #727에서 필요
              // 없어졌다. 그 가드가 막던 건 updateComponents가 dirtyTick을 올려 1초 뒤 autosave가
              // draft를 쓰고, 그 draft 때문에 다음 방문에 랜딩이 영영 안 뜨는 연쇄였다. 이제
              // ① 랜딩은 draft 유무와 무관하게 뜨고(c1) ② 무드는 updateComponents가 아니라
              // resetDocument의 layout 인자로 실려 dirtyTick을 아예 안 올린다(c7) — 연쇄의 두 고리가
              // 다 끊겼다. 덕분에 오탭해도 자동저장이 안 걸려 새로고침 한 번으로 draft가 돌아온다.
              startFreshDoc({ layout: id });
              setLandingDismissed(true);
            }}
            dropProps={posterDropProps}
            dragOver={posterDragOver}
          >
            <OcrUploadCard
              setInfo={photo.updateMovieInfo}
              currentInfo={photo.state.movieInfo}
              // 스크린샷이 인식되면 랜딩을 걷는다 — 사용자가 이미 편집에 들어온 것이고, 채워진
              // 필드가 오버레이 뒤에 가려져 있으면 안 된다. 랜딩을 떠나는 "새로 시작" 경로이므로
              // 복원된 문서를 먼저 새 문서로 되돌린다(#727 c7). 이게 성립하려면 OcrUploadCard가
              // **필드를 쓰기 전에** 이 콜백을 불러야 한다 — 그래서 그쪽 applyOcr의 호출 순서가
              // #727에서 바뀌었다(같은 배치의 마지막 setState가 이기므로). update*는 전부 함수형
              // 갱신이라 리셋 위에 OCR 결과가 정확히 얹힌다.
              //
              // 새 문서 위의 적용이면 되돌리기 스냅샷도 "빈 새 문서" 기준이어야 한다(#737) — 카드가
              // 만든 prevValues/prevComponents는 리셋 **전** currentInfo에서 뜬 값이라 옛 draft를
              // 담고 있다. 문서 전체를 다시 리셋하는 대신(그러면 OCR 적용~되돌리기 사이에 사용자가
              // 한 다른 편집까지 undo가 통째로 삼킨다 — fresh-context 리뷰 지적), 카드가 이미 골라둔
              // 같은 키 집합을 유지한 채 값만 INITIAL_STATE 기준으로 다시 채운다 — 그러면 cancel()은
              // 여느 때와 똑같이 부분 병합(updateMovieInfo/updateComponents)만 하고, OCR이 안 건드린
              // 필드(포스터·밝기 등)는 그대로 남는다.
              onOcrApply={(params) => {
                const fresh = !landingDismissed;
                if (fresh) startFreshDoc();
                setLandingDismissed(true);
                // 랜딩의 스크린샷 인식으로 채운 새 문서는 디자인 모드로 연다(Seed constraint-2 E-01) — 채워진 정보를
                // 검토하기보다 꾸미기로 넘어가는 흐름이다. startFreshDoc이 정보로 세운 값을 이 줄이 덮는다.
                if (fresh) setDockMode('design');
                if (!fresh) {
                  ocr.apply(params);
                  return;
                }
                const prevValues = Object.fromEntries(
                  Object.keys(params.prevValues).map((k) => [
                    k,
                    INITIAL_STATE.movieInfo[k as keyof MovieInfo],
                  ]),
                ) as Partial<MovieInfo>;
                const prevComponents = params.prevComponents
                  ? (Object.fromEntries(
                      Object.keys(params.prevComponents).map((k) => [
                        k,
                        INITIAL_STATE.components[k as keyof TicketComponents],
                      ]),
                    ) as Partial<TicketComponents>)
                  : undefined;
                ocr.apply({ ...params, prevValues, prevComponents });
              }}
              setComponents={photo.updateComponents}
              currentComponents={photo.state.components}
              ocrEpochRef={ocr.epochRef}
              captureMovieSelection={photo.captureMovieSelection}
              captureDraft={photo.captureDraft}
              onKobisDiscarded={ocr.dropKobisFields}
              onKobisApplied={ocr.recordKobisApplied}
              // 정보 모드 버튼이 이 카드의 업로드를 연다(constraint-17) — 카드를 도크에 새로 마운트하지 않는다.
              openRef={ocrOpenRef}
              onBusyChange={setOcrBusy}
              // 랜딩이 걷히면 카드가 display:none 안이라 자체 토스트가 안 보인다 — 셸 토스트가 대신한다.
              notify={landingDismissed ? flashToast : undefined}
              // 인식 결과에 제목이 없으면 정보 모드로 바꿔 제목 입력을 연다(옛 드로어 카드의 같은 콜백 승계).
              onNeedManualTitle={() => {
                setDockMode('info');
                handleField('title');
              }}
            />
          </Landing>
        </div>
      </div>

      {/* 편집 도크(#826 S2) — 옛 스타일링 dock(#357, DesignRail)과 필드 드로어·엣지 핸들(#355)을 하나로 합친
          하단 고정 영역이다. 높이는 모드·도구와 무관하게 하나(마스터 C-DOCK)라 티켓이 도크 때문에 흔들리지 않고,
          DOM 순서는 본문 뒤라 기존 "OCR → 도크 최하단" 위계(#261)가 유지된다. max는 티켓 전용 풀스크린이라 숨기고,
          랜딩(업로드 전)도 꾸밀 대상이 없어 숨긴다(#363) — 둘 다 CSS hidden으로만. 조건부 unmount면 도구 선택
          같은 로컬 state가 왕복마다 리셋된다(#297 P1과 동일 패턴, PR #362 리뷰 P2). */}
      <EditorDock
        photo={photo}
        mode={dockMode}
        onModeChange={setDockMode}
        hidden={isMax || !canvasReady}
        onField={handleField}
        onMissingField={openMissingField}
        onOcrOpen={() => ocrOpenRef.current?.()}
        ocrBusy={ocrBusy}
        onPosterPick={handlePosterTap}
        // 원본이 없으면 안 넘겨 사진 모드의 자르기가 비활성이 된다(옛 메뉴 '재크롭'의 disabled와 같은 규칙).
        onPosterRecrop={crop.originalSrc ? crop.openRecrop : undefined}
      />

      {/* 온티켓 인플레이스 에디터(#354) — 필드 탭이 시트 대신 이걸 연다. 투명 input + 필드바 +
          aid 패널(KOBIS/별점/날짜). 위치는 래퍼/티켓 ref 기반 측정, lift는 setEditLift로 위 transform에.
          onField는 handleField가 아니라 setActiveField — prev/next 순회는 순수 탐색이라 경유 필드의
          가시성을 켜면 안 된다(PR #359 리뷰 P1). 자동 표시 on은 FieldTap 직접 탭(handleField)에만.
          앱 배경 래퍼 안에 둔다(#685 fresh-eyes 리뷰) — 래퍼 밖에 남으면 다이얼로그(크롭 모달)가 열려도
          이 투명 input이 계속 탭 가능한 채로 남는다. */}
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

      {/* 포스터 크롭 파이프라인(#259 on-ticket tap + #315 드롭존·서브메뉴 교체/재크롭 통합) — 숨김
          파일 input. 탭 → input.click() → 파일 선택 → ImageCropModal(기본 0.667, 아래 다이얼로그
          구역에서 렌더) → getCroppedImg → handleImageUpload. originalSrc는 크롭 완료 후에도 유지돼
          재크롭에 재사용된다. */}
      {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus) — 도크 로고 입력과
          동일 판단. 앱 배경 래퍼 안에 둔다(#685 fresh-eyes 리뷰) — 래퍼 밖이면 다이얼로그가 열려도
          이 input이 계속 탭 순서에 남는다. */}
      <input
        ref={posterInputRef}
        type="file"
        accept={POSTER_ACCEPT.join(',')}
        aria-label="포스터 이미지 파일"
        onChange={handlePosterFile}
        className="sr-only"
      />
      </div>

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

      {/* OCR 되돌리기 배너(#261 승격) — 화면 하단 고정(fixed), useOcrUndo/OcrUndoBanner 공유(#141-class
          drift 방지). 배너는 셸이 단독 소유하므로 중복되지 않는다. max(#328)는 티켓만 노출하는
          풀스크린이라 시각 배너를 숨긴다 — snapshot을 null로 넘겨도 컴포넌트 자신은 계속 마운트돼
          sr-only 라이브리전의 mutation 감지 계약(#199)은 유지된다. */}
      <OcrUndoBanner
        snapshot={isMax ? null : ocr.snapshot}
        filledFields={ocr.filledFields}
        stampCount={ocr.stampCount}
        onCancel={ocr.cancel}
        onConfirm={ocr.confirm}
      />

      {/* 완료 비활성 사유 — SR 라이브리전은 콘텐츠와 함께 삽입되면 mutation을 놓치므로(#199)
          항상 마운트하고 텍스트만 토글한다. 시각 토스트는 별도로 aria-hidden, max(#328)에선 숨김. */}
      <div role="status" aria-live="polite" className="sr-only">{toast ?? ''}</div>
      {/* OCR 배너(bottom-6, p-3 + min-h-touch 44px ≈ 70px 높이)와 좌표가 문자까지 같았다(#731) —
          배너가 떠 있으면 그 위로 띄워 서로 안 가리게 한다. 배너엔 자동 소멸이 없어서(useOcrUndo에
          타이머 없음) 그 창에서 뜨는 어떤 flashToast(전역 undo '되돌렸어요' 포함, 8곳)도 이 조건
          하나로 같이 걷힌다 — 호출부마다 따로 고칠 필요가 없다. */}
      {!isMax && toast && (
        <div
          aria-hidden="true"
          data-testid="global-toast"
          className={`fixed left-1/2 z-[60] -translate-x-1/2 rounded-full border border-hair bg-s2 px-4 py-2 text-body text-ink ${
            ocr.snapshot ? 'bottom-28' : 'bottom-6'
          }`}
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
