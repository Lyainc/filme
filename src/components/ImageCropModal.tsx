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
import { TARGET_RATIO } from '@/utils/constants';
import type { LayoutId } from '@/types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  /** preserveRatio는 #420 "원본 비율 보존" 토글 상태 — layout이 미전달되거나 대상 무드가 아니면 항상 false. */
  onComplete: (croppedAreaPixels: Area, preserveRatio: boolean) => void;
  isProcessing?: boolean;
  /**
   * 크롭 종횡비. 생략 시 포스터 기본(TARGET_RATIO). 로고는 `undefined`를 넘겨
   * "업로드 이미지의 자연 종횡비" 프레임으로 연다(#347).
   * 주의: 구조분해 기본값을 쓰면 명시적 `undefined`가 기본값으로 덮이므로,
   * 아래에서 `'aspect' in props`로 "미전달"과 "명시적 undefined"를 구분한다.
   * layout이 전달되면(포스터 전용) 이 prop 대신 프리셋 토글이 aspect를 결정한다.
   */
  aspect?: number;
  /** aria 라벨(다이얼로그 접근성 이름). 기본 '포스터 크롭', 로고는 '로고 크롭'. 시각 헤딩은 #320에서 제거. */
  title?: string;
  /**
   * 현재 무드(#420 → #440) — 포스터 크롭이면(layout 전달) 전 무드에서 "원본 비율 보존" 토글을
   * 노출한다. 로고 크롭 호출부는 이 prop을 넘기지 않아 토글이 뜨지 않는다.
   */
  layout?: LayoutId;
  /**
   * 토글 초기 체크 상태 — 호출부가 현재 `components.posterFit === 'contain'`을 넘긴다.
   * 없으면 재크롭 때마다 모달이 unchecked로 새로 열려, 크롭 영역만 조정해도 posterFit이
   * 조용히 'cover'로 되돌아간다(claude-review PR #429 P1).
   */
  initialPreserveRatio?: boolean;
}

export default function ImageCropModal(props: ImageCropModalProps) {
  const {
    imageSrc,
    onClose,
    onComplete,
    isProcessing = false,
    title = '포스터 크롭',
    layout,
    initialPreserveRatio = false,
  } = props;

  // #440 포스터 크롭(layout 전달)이면 "원본 비율 보존" 토글 노출. stub은 MoodStub이 posterFit을
  // 읽어 contain 시 blur 레터박스로 렌더하지만(#440 정교화), 크롭 UI에서 토글을 켜고 끄는 흐름은
  // 아직 별도로 배선하지 않아 여기선 계속 제외 — 크롭은 원본 비율로 고정한다(포스터 전체를 받아
  // usePhototicket 기본값 'contain'을 그대로 탄다) — claude-review PR #448 P1, 토글 노출은 후속 nit.
  const isStubCrop = layout === 'stub';
  const showPreserveToggle = layout != null && !isStubCrop;
  const [preserveRatio, setPreserveRatio] = useState(initialPreserveRatio);
  // stub은 원본 비율 고정. 그 외엔 프리셋 토글이 요청 aspect를 정하고(켜짐=원본 비율, 꺼짐=TARGET_RATIO
  // 고정), 토글이 없으면 aspect prop('aspect' in props로 "미전달"과 명시적 undefined 구분) → 포스터 기본.
  const requestedAspect = isStubCrop
    ? undefined
    : showPreserveToggle
      ? preserveRatio
        ? undefined
        : TARGET_RATIO
      : 'aspect' in props
        ? props.aspect
        : TARGET_RATIO;
  // requestedAspect가 undefined(로고 자유 크롭 #347, 포스터 원본 비율 보존 #420)면 업로드
  // 이미지의 자연 종횡비로 잠근다 — 완전 자유형이 아니라 "그 비율의 박스를 리사이즈"(#421)다.
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const aspect = requestedAspect ?? mediaAspect ?? undefined;

  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  // aspect 기준으로 크롭 영역을 (재)초기화 — aspect 있으면 중앙 최대 크기, 없으면 전체 이미지.
  const initCrop = useCallback((forAspect: number | undefined, width: number, height: number) => {
    const initial: Crop = forAspect
      ? centerCrop(makeAspectCrop({ unit: '%', width: 90 }, forAspect, width, height), width, height)
      : { unit: '%', x: 0, y: 0, width: 100, height: 100 };
    setCrop(initial);
    setCompletedCrop(convertToPixelCrop(initial, width, height));
  }, []);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natural = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : null;
    setMediaAspect(natural);
    initCrop(requestedAspect ?? natural ?? undefined, img.width, img.height);
  };

  // 프리셋 토글(포스터 전용)로 requestedAspect가 바뀌면 이미 로드된 이미지 기준으로 재계산한다.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) initCrop(aspect, img.width, img.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAspect]);

  const handleConfirm = () => {
    if (isProcessing || !completedCrop || !completedCrop.width || !completedCrop.height) return;
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
      // stub은 토글이 없지만 원본 비율을 유지해 밴드 cover에 온전한 포스터를 넘긴다(#448 P1).
      isStubCrop ? true : preserveRatio,
    );
  };

  // 모달은 크롭 열림 상태에서만 마운트되므로 항상 열린 상태 — 스크롤 잠금
  useBodyScrollLock(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const getFocusables = useCallback(
    () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])',
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
    // body로 떨어지므로 살아있을 때만 되돌린다. 그 경우 새 포커스 타깃은 부모(ImageUploader) 몫.
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

  // dynamic(ssr:false)로만 import되므로 document는 항상 존재 — mount 가드 불필요
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain animate-fade-in"
      style={{ background: 'rgba(44,38,34,0.55)' }}
    >
      <div className="relative flex h-[85svh] max-h-[820px] w-full max-w-sm flex-col overflow-hidden rounded-card bg-paper shadow-card rail:h-[700px] rail:max-h-[88vh] rail:max-w-2xl">
        {/* Header — 정사각 닫기 버튼. 제목은 aria-label(다이얼로그 접근성 이름)로만 유지, 시각 헤딩은 제거(#320) */}
        <div className="flex items-center justify-end border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="닫기"
            data-touch="44"
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-field-sm border border-line text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Crop area — 여백 안에 라운드 인셋. 모서리 핸들 드래그로 크롭 영역 자체를 리사이즈한다(#421,
            react-image-crop). ponytail: 줌 슬라이더는 리사이즈로 대체돼 제거 — 아주 큰 원본에서
            정밀도가 부족해지면 그때 이미지 스케일 컨트롤을 다시 추가. */}
        <div className="min-h-0 flex-1 p-4">
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-field bg-fg/95"
            data-testid="crop-frame"
            data-aspect={aspect === undefined ? 'undefined' : aspect}
          >
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                onLoad={onImageLoad}
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        </div>

        {/* Footer — (포스터 전용) 원본 비율 보존 토글 + 액션 버튼 */}
        <div
          className="flex flex-col gap-3 border-t border-line px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.875rem)' }}
        >
          {showPreserveToggle && (
            <label className="flex items-center gap-2 text-[13px] text-fg">
              <input
                type="checkbox"
                checked={preserveRatio}
                onChange={(e) => setPreserveRatio(e.target.checked)}
                disabled={isProcessing}
                className="h-3.5 w-3.5 accent-accent"
              />
              원본 비율 보존
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              data-touch="44"
              className="inline-flex min-h-btn items-center justify-center rounded-field border border-line bg-surface text-[13px] font-medium text-fg transition-colors hover:bg-accent-soft disabled:opacity-30"
            >
              다른 사진 선택
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing || !completedCrop?.width || !completedCrop?.height}
              data-touch="44"
              className="inline-flex min-h-btn items-center justify-center gap-2 rounded-field bg-accent text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
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
        </div>
      </div>
    </div>,
    document.body
  );
}
