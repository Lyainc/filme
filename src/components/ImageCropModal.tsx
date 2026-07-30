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
import { POSTER_LANDSCAPE_RATIO, POSTER_RATIO } from '@/utils/constants';
import { getLayout } from '@/utils/layouts';
import type { LayoutId } from '@/types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { PHONE_FRAME_ID } from '@/components/v2/PhoneFrame';

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  /** preserveRatio는 #420 "원본 비율 보존" 토글 상태 — 로고 크롭(layout 미전달)이면 항상 false. */
  onComplete: (croppedAreaPixels: Area, preserveRatio: boolean) => void;
  isProcessing?: boolean;
  /** aria 라벨(다이얼로그 접근성 이름). 기본 '포스터 크롭', 로고는 '로고 크롭'. 시각 헤딩은 #320에서 제거. */
  title?: string;
  /**
   * 현재 무드(#420 → #440) — 포스터 크롭이면(layout 전달) "원본 비율 보존" 토글을 노출하고
   * 그 토글이 크롭 종횡비를 정한다. 로고 크롭 호출부는 이 prop을 넘기지 않아, 토글 없이
   * 업로드 이미지의 자연 종횡비로 열린다(#347).
   */
  layout?: LayoutId;
}

export default function ImageCropModal({
  imageSrc,
  onClose,
  onComplete,
  isProcessing = false,
  title = '포스터 크롭',
  layout,
}: ImageCropModalProps) {
  // 포스터 크롭(layout 전달)이면 전 무드에서 "원본 비율 보존" 토글 노출. #525 (a)로 stub 예외가
  // 사라졌다 — 이전엔 stub만 posterFit 'cover' 배선이 없어 원본 비율로 고정했는데(PR #448 P1),
  // 이제 모든 무드가 contain 단일 정책이라 stub도 같은 토글을 탄다.
  const showPreserveToggle = layout != null;
  const [preserveRatio, setPreserveRatio] = useState(false);
  // 표준 프리셋의 방향은 **현재 무드의 포스터 슬롯**을 따른다(#529 결정 1) — 35mm Wide의 컷은
  // 926×617(3:2)이라 세로 크롭을 넣으면 무드 쪽 fit="cover"가 사용자가 잡은 프레임의 위아래를
  // 잘라낸다. 자동 프리셋이지 잠금이 아니다: 프레임은 그대로 드래그·리사이즈되고, 나중에 무드를
  // 바꿔도 이미 확정된 크롭은 유지된다(무드별 재크롭은 #529 결정 2 — 범위 밖).
  const presetAspect = layout && getLayout(layout).posterOrientation === 'landscape' ? POSTER_LANDSCAPE_RATIO : POSTER_RATIO;
  // 포스터는 프리셋 토글이 요청 aspect를 정한다 — 켜짐=원본(자연) 비율, 꺼짐=포스터 표준(#525 룰 1).
  // 로고는 항상 자연 비율(undefined → 아래 mediaAspect로 잠금).
  const requestedAspect = showPreserveToggle && !preserveRatio ? presetAspect : undefined;
  // requestedAspect가 undefined(로고 자유 크롭 #347, 포스터 원본 비율 보존 #420)면 업로드
  // 이미지의 자연 종횡비로 잠근다 — 완전 자유형이 아니라 "그 비율의 박스를 리사이즈"(#421)다.
  const [mediaAspect, setMediaAspect] = useState<number | null>(null);
  const aspect = requestedAspect ?? mediaAspect ?? undefined;

  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  // aspect 기준으로 크롭 영역을 (재)초기화. 크롭 종횡비가 이미지 자연 종횡비와 (사실상) 같으면
  // — "원본 비율 보존"(#420, aspect=자연비) 또는 로고 자유 크롭(#347) — 전체 이미지(100%)로 연다.
  // makeAspectCrop({width:90})은 종횡비가 같아도 90%로 줄여 좌우·상하 5%씩 잘라내는데(=원본 손실),
  // "원본 비율 보존"의 취지(포스터를 통째로 넣기)와 정면으로 어긋난다 — 실사용에서 세로 포스터의
  // 좌우 가장자리(예: 제목 첫·끝 글자)가 잘려 나가는 걸로 발견(#439). 종횡비가 다를 때(POSTER_RATIO
  // 고정)만 90% 중앙 크롭으로 열어 사용자가 프레임을 조정하게 한다. 실제 2:3 포스터라면 표준
  // 프리셋에서도 matchesImage가 참이라 100%로 열린다 — 손실 0(#525).
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
      preserveRatio,
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

  // dynamic(ssr:false)로만 import되므로 document는 항상 존재 — mount 가드 불필요.
  // 포털 타깃은 body가 아니라 폰 프레임(#606) — body에 붙으면 프레임의 contain:paint 조상이
  // 사라져 모달이 프레임 밖 전체 화면에 뜬다. InPlaceFieldEditor가 쓰는 패턴과 같다.
  // 프레임이 없는 경로(데스크톱 셸, #607에서 삭제)는 body로 폴백해 오늘 동작 그대로.
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
      {/* 세로 단위는 폰 프레임 기준(cqh, #605) — 프레임에 포털되면 프레임 높이, 프레임이 없는
          경로(데스크톱 셸)에선 컨테이너가 없어 small viewport로 폴백해 기존 svh와 같은 값이 된다. */}
      <div className="relative flex h-[85cqh] max-h-[820px] w-full max-w-sm flex-col overflow-hidden rounded-card bg-paper shadow-card rail:h-[700px] rail:max-h-[88cqh] rail:max-w-2xl">
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
            // 아래 <img>의 cq 단위가 이 프레임을 기준으로 풀리게 하는 size container 선언(#474).
            style={{ containerType: 'size' }}
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
                // cq 단위(프레임 = size container)로 contain 시킨다(#474). `100%`는 안 통한다 —
                // `.ReactCrop`이 inline-block이라 높이가 content-based(indefinite)라서 퍼센트
                // 높이가 해소되지 않고, 라이브러리의 `max-height:inherit` 체인도 `none`으로 끝난다.
                // 인라인이라 라이브러리 규칙을 이기고, `.ReactCrop`은 그대로 img를 shrink-wrap 해서
                // 크롭 좌표계(`.ReactCrop` 절대배치 ↔ img 박스)가 어긋나지 않는다.
                style={{ maxWidth: '100cqw', maxHeight: '100cqh', display: 'block' }}
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
    document.getElementById(PHONE_FRAME_ID) ?? document.body
  );
}
