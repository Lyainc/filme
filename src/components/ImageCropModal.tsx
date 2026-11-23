import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import { Area } from '@/utils/imageCrop';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { POSTER_LANDSCAPE_RATIO, POSTER_RATIO } from '@/utils/constants';
import { getLayout } from '@/utils/layouts';
import type { LayoutId } from '@/types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { PHONE_FRAME_ID } from '@/components/v2/PhoneFrame';

/**
 * 크롭 대상 → 제목 표(#826 S6 D20-2 A). 위 줄에 보이는 제목이자 다이얼로그 접근 이름이다.
 * 호출부는 이 표의 키만 고른다 — 이 모듈은 dynamic import라 호출부가 문자열 상수를 정적으로
 * 끌어가면 크롭 번들(react-image-crop 포함)이 메인 청크로 딸려 온다(키 타입은 `import type`이라 지워진다).
 */
const CROP_TITLE = {
  poster: '포스터 자르기',
  logo: '로고 자르기',
  signature: '서명 자르기',
  stamp: '스탬프 자르기',
} as const;
export type CropTarget = keyof typeof CROP_TITLE;

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  /** preserveRatio는 #420 "원본 비율 보존" 스위치 상태 — layout 없이 연 크롭이면 항상 false. */
  onComplete: (croppedAreaPixels: Area, preserveRatio: boolean) => void;
  isProcessing?: boolean;
  /** 무엇을 자르는지 — CROP_TITLE에서 제목을 고른다. */
  target: CropTarget;
  /**
   * 현재 무드(#420 → #440) — 포스터 크롭이면(layout 전달) "원본 비율 보존" 스위치를 노출하고
   * 그 스위치가 크롭 종횡비를 정한다. layout 없이 연 크롭(로고 · 서명 · 스탬프)은 완전 자유 비율이다
   * (#826 S6 D20-3 B — #421의 자연비 잠금을 되돌렸다).
   */
  layout?: LayoutId;
  /** '다른 사진'이 여는 사진 선택의 accept — 호출부의 원래 업로드 입력과 같은 값. */
  accept: string;
  /** '다른 사진'으로 고른 이미지 파일 — 호출부가 자기 열기 경로(usePosterCrop.openFile 등)로 크롭을 다시 시작한다. */
  onPickFile: (file: File) => void;
  /** 크롭 훅이 쥔 자르기 실패 상태(#826 S6 constraint-20) — 크롭 화면 안 경고 한 줄로 보인다. */
  cropFailed?: boolean;
}

/** 스위치 손잡이 모양 — EditorMenu의 것과 같은 치수(그 파일은 S6 범위 밖이라 공유하지 않는다). */
function SwitchKnob({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative h-[26px] w-11 shrink-0 rounded-[13px] transition-colors', checked ? 'bg-ink' : 'bg-hair-strong')}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] h-5 w-5 rounded-[10px] border transition-transform',
          checked ? 'translate-x-[18px] border-transparent bg-stage' : 'border-hair-strong bg-s2',
        )}
      />
    </span>
  );
}

export default function ImageCropModal({
  imageSrc,
  onClose,
  onComplete,
  isProcessing = false,
  target,
  layout,
  accept,
  onPickFile,
  cropFailed = false,
}: ImageCropModalProps) {
  const title = CROP_TITLE[target];
  // 포스터 크롭(layout 전달)이면 전 무드에서 "원본 비율 보존" 스위치 노출. #525 (a)로 stub 예외가
  // 사라졌다 — 모든 무드가 contain 단일 정책이라 stub도 같은 스위치를 탄다.
  const showPreserveToggle = layout != null;
  const [preserveRatio, setPreserveRatio] = useState(false);
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  // 이미지 로드 실패(#645 C4 → #826 S6 C-03) — onLoad가 안 오면 '적용'이 말없이 막히므로 크롭 화면 안에서 알린다.
  const [loadFailed, setLoadFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  // '다른 사진'으로 새 사진이 들어오면 처음 연 것과 같은 상태로 되돌린다 — 포스터는 스위치 꺼짐 ·
  // 프리셋 비율로 열리고(constraint-8), 직전 사진의 로드 실패 경고도 지운다. 렌더 중 prop 비교 패턴
  // (effect로 하면 한 프레임 동안 옛 크롭 좌표가 새 사진 위에 선다).
  const [shownSrc, setShownSrc] = useState(imageSrc);
  if (shownSrc !== imageSrc) {
    setShownSrc(imageSrc);
    setPreserveRatio(false);
    setMediaAspect(null);
    setLoadFailed(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
  }

  // 표준 프리셋의 방향은 **현재 무드의 포스터 슬롯**을 따른다(#529 결정 1) — 35mm Wide의 컷은
  // 926×617(3:2)이라 세로 크롭을 넣으면 무드 쪽 fit="cover"가 사용자가 잡은 프레임의 위아래를
  // 잘라낸다. 자동 프리셋이지 잠금이 아니다: 프레임은 그대로 드래그·리사이즈되고, 나중에 무드를
  // 바꿔도 이미 확정된 크롭은 유지된다(무드별 재크롭은 #529 결정 2 — 범위 밖).
  const presetAspect = layout && getLayout(layout).posterOrientation === 'landscape' ? POSTER_LANDSCAPE_RATIO : POSTER_RATIO;
  // 포스터: 꺼짐=포스터 표준(#525 룰 1), 켜짐=이미지 자연비로 잠금(#420). layout 없이 연 크롭은
  // aspect가 없다 — 가로와 세로를 따로 끄는 완전 자유 비율(#826 S6 D20-3 B, #220 · #421 원래 요청).
  const aspect = showPreserveToggle ? (preserveRatio ? mediaAspect ?? undefined : presetAspect) : undefined;

  // aspect 기준으로 크롭 영역을 (재)초기화. aspect가 없거나(자유 비율) 이미지 자연 종횡비와 (사실상)
  // 같으면 — "원본 비율 보존"(#420) — 전체 이미지(100%)로 연다. makeAspectCrop({width:90})은 종횡비가
  // 같아도 90%로 줄여 가장자리를 잘라내는데(#439), 그건 원본 손실이다. 종횡비가 다를 때(포스터 표준)만
  // 90% 중앙 크롭으로 열어 사용자가 프레임을 조정하게 한다. 실제 2:3 포스터라면 표준 프리셋에서도
  // matchesImage가 참이라 100%로 열린다 — 손실 0(#525).
  const initCrop = useCallback((forAspect: number | undefined, width: number, height: number) => {
    const matchesImage = forAspect != null && width > 0 && height > 0 && Math.abs(forAspect - width / height) < 0.005;
    const initial: Crop = forAspect && !matchesImage
      ? centerCrop(makeAspectCrop({ unit: '%', width: 90 }, forAspect, width, height), width, height)
      : { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    setCrop(initial);
    setCompletedCrop(convertToPixelCrop(initial, width, height));
  }, []);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natural = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null;
    setMediaAspect(natural);
    const forAspect = showPreserveToggle ? (preserveRatio ? natural ?? undefined : presetAspect) : undefined;
    initCrop(forAspect, img.width, img.height);
  };

  // 스위치(포스터 전용)를 바꾸면 이미 로드된 이미지 기준으로 재계산한다.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) initCrop(aspect, img.width, img.height);
  }, [preserveRatio]);

  const handleConfirm = () => {
    if (isProcessing || loadFailed || !completedCrop || !completedCrop.width || !completedCrop.height) return;
    const img = imgRef.current;
    if (!img) return;
    // completedCrop은 <img>의 렌더 픽셀 좌표계 — getCroppedImg는 원본(natural) 픽셀 좌표를
    // 기대하므로 naturalWidth/renderedWidth 비율로 환산한다(react-image-crop 표준 패턴).
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    onComplete(
      {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      },
      preserveRatio,
    );
  };

  // '다른 사진'의 파일 입력은 크롭 화면 **안**에 산다(constraint-19) — 기존 업로드 입력은 전부 크롭
  // 화면 뒤 inert 영역(#685)에 있고, inert 입력의 click()이 iOS에서 사진 선택을 여는지는 실측되지 않았다.
  const fileRef = useRef<HTMLInputElement>(null);

  // 포털 타깃은 첫 렌더에 한 번만 정하고 고정한다(#604 리뷰). 매 렌더 getElementById를 다시 읽으면
  // 프레임이 이 모달과 같은 커밋에 마운트되는 경로에서 컨테이너가 body→프레임으로 바뀌고, createPortal은
  // 서브트리를 통째로 다시 만든다(크롭 선택 초기화 · 포커스 유실). body 폴백은 이 모달을 프레임 없이
  // 단독 렌더하는 테스트(logoCropFreeAspect 등)를 위해 남긴다.
  const portalTargetRef = useRef<HTMLElement | null>(null);
  if (!portalTargetRef.current) {
    portalTargetRef.current = document.getElementById(PHONE_FRAME_ID) ?? document.body;
  }

  const dialogRef = useRef<HTMLDivElement>(null);
  // 스크롤 잠금 + 배경 inert(#685) — dialogRef(포커스 트랩과 같은 루트)를 그대로 재사용.
  // 모달은 크롭 열림 상태에서만 마운트되므로 항상 열린 상태.
  useBodyScrollLock(true, dialogRef);
  // tabindex=-1인 숨은 파일 입력은 순환 대상이 아니다(constraint-19) — input 선택자가 tabindex를 봐야 한다.
  const getFocusables = useCallback(
    () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),[href],[tabindex]:not([tabindex="-1"])',
            ),
          )
        : [],
    [],
  );

  // 마운트 시 첫 포커서블(없으면 다이얼로그 자체)로 포커스 이동, 언마운트 시 직전 포커스 복원.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (getFocusables()[0] ?? dialogRef.current)?.focus();
    // 성공 크롭 등으로 트리거가 언마운트되면(showPreview 전환) prev는 detached — 복원하면
    // body로 떨어지므로 살아있을 때만 되돌린다. 그 경우 새 포커스 타깃은 모달을 연 부모 몫.
    return () => {
      if (prev?.isConnected) prev.focus();
    };
  }, [getFocusables]);

  // Escape 닫기 + Tab 순환 트랩 (포커스가 모달 뒤 페이지로 새지 않게)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isProcessing) onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const node = dialogRef.current;
      if (!node) return;
      const els = getFocusables();
      // 처리 중엔 모든 컨트롤이 disabled라 els가 비고, 캔버스 클릭 등으로 포커스가 모달 밖에
      // 있을 수도 있다. 둘 다 다이얼로그 안으로 끌어와 가둔다(빈 경우엔 다이얼로그 자체로).
      if (els.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      // node.contains(node)는 true라(DOM: 자기 자신 포함) 다이얼로그 자체가 포커스를 쥔
      // 경우(빈 focusables 분기 직후)도 "밖" 취급해 first로 끌어와야 Tab이 안 샌다.
      if (!node.contains(active) || active === node) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isProcessing, onClose, getFocusables]);

  // 경고는 한 줄 하나 — 다음 행동은 버튼('다른 사진' · '적용')이 맡는다(COPY_TONE_GUIDE 축 3).
  const warning = loadFailed ? '이미지를 불러오지 못했어요' : cropFailed ? '자르지 못했어요' : null;

  // dynamic(ssr:false)로만 import되므로 document는 항상 존재 — mount 가드 불필요.
  // 포털 타깃은 body가 아니라 폰 프레임(#606) — body에 붙으면 프레임의 contain:paint 조상이
  // 사라져 모달이 프레임 밖 전체 화면에 뜬다. fixed inset-0이 곧 프레임 전체다(마스터 C-DLG
  // "전체 화면 모달, 다크 고정"). 앱 테마와 무관하게 .chrome-dark 스코프로 어두운 토큰을 칠한다.
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      // 접근 이름 = 위 줄에 보이는 제목(같은 표 값). 하네스 봉쇄 축이 이 속성으로 크롭 화면을 집는다.
      aria-label={title}
      tabIndex={-1}
      data-testid="crop-dialog"
      className="chrome-dark fixed inset-0 z-50 flex flex-col overscroll-contain bg-stage text-ink animate-fade-in"
    >
      {/* 위 줄 — 왼쪽 44px 빈 자리 · 가운데 제목 · 오른쪽 닫기(44×44). 위 안전 영역을 비운다. */}
      <div className="flex shrink-0 items-center px-1" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <span aria-hidden="true" className="w-touch shrink-0" />
        <h2 className="min-w-0 flex-1 truncate text-center text-body font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          aria-label="닫기"
          data-touch="44"
          className={cn(pressableVariants(), 'inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-field-sm text-ink-2 transition-colors hover:bg-accent-soft hover:text-ink disabled:opacity-30')}
        >
          ✕
        </button>
      </div>

      {/* 사진 무대 — 모서리 · 변 핸들로 크롭 영역 자체를 리사이즈한다(#421, react-image-crop). */}
      <div className="min-h-0 flex-1 px-4 py-2">
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden"
          data-testid="crop-frame"
          data-aspect={aspect === undefined ? 'undefined' : aspect}
          // 아래 <img>의 cq 단위가 이 프레임을 기준으로 풀리게 하는 size container 선언(#474).
          style={{ containerType: 'size' }}
        >
          {loadFailed ? (
            <p className="text-body text-ink-3">이미지를 표시할 수 없어요</p>
          ) : (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              keepSelection
              minWidth={20}
              minHeight={20}
              disabled={isProcessing}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                onLoad={onImageLoad}
                onError={() => setLoadFailed(true)}
                // cq 단위(프레임 = size container)로 contain 시킨다(#474). `100%`는 안 통한다 —
                // `.ReactCrop`이 inline-block이라 높이가 content-based(indefinite)라서 퍼센트
                // 높이가 해소되지 않고, 라이브러리의 `max-height:inherit` 체인도 `none`으로 끝난다.
                style={{ maxWidth: '100cqw', maxHeight: '100cqh', display: 'block' }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          )}
        </div>
      </div>

      {/* 아래 줄 — 경고 · (포스터만) 스위치 행 · [다른 사진] [적용]. 아래 안전 영역을 비운다. */}
      <div
        className="flex shrink-0 flex-col gap-3 px-4 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}
      >
        {warning && (
          <div role="alert" className="flex items-center gap-2 rounded-field-sm border border-warn px-3 py-2 text-body text-warn">
            <span aria-hidden="true">!</span>
            <span>{warning}</span>
          </div>
        )}
        {showPreserveToggle && (
          // 행 전체가 스위치라 라벨을 눌러도 바뀌고, 네이티브 button이라 Space · Enter로 바뀐다.
          <button
            type="button"
            role="switch"
            aria-checked={preserveRatio}
            onClick={() => setPreserveRatio((v) => !v)}
            disabled={isProcessing}
            className={cn(pressableVariants(), 'flex min-h-touch w-full items-center justify-between gap-3 text-body text-ink disabled:opacity-40')}
          >
            <span>원본 비율 보존</span>
            <SwitchKnob checked={preserveRatio} />
          </button>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isProcessing}
            data-touch="44"
            className={cn(pressableVariants(), 'inline-flex min-h-btn items-center justify-center rounded-field border border-hair bg-s1 px-5 text-body font-medium text-ink transition-colors hover:bg-accent-soft disabled:opacity-30')}
          >
            다른 사진
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || loadFailed || !completedCrop?.width || !completedCrop?.height}
            data-touch="44"
            className={cn(pressableVariants(), 'inline-flex min-h-btn items-center justify-center gap-2 rounded-field bg-accent px-6 text-body font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40')}
          >
            {isProcessing ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ink" />
                적용 중
              </>
            ) : (
              '적용'
            )}
          </button>
        </div>
        {/* 숨은 사진 선택 — tabIndex -1이라 Tab 순환에 안 들고, 접근 이름은 바깥 업로드 입력과 겹치지 않는다.
            이미지가 아니면 선택 취소와 같이 크롭 화면을 그대로 둔다. 같은 파일을 다시 골라도 change가 뜨게 비운다. */}
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          tabIndex={-1}
          aria-label="다른 사진 파일"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.type.startsWith('image/')) onPickFile(file);
            e.target.value = '';
          }}
          className="sr-only"
        />
      </div>
    </div>,
    portalTargetRef.current
  );
}
