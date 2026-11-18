import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketComponents } from '@/types';
import { STAMP_KEYS, STAMP_LABELS, STAMP_TARGETS, type SheetTarget, type StampTarget } from '@/constants/fields';
import { TARGET_HEIGHT } from '@/utils/constants';
import { BACKGROUND_OPACITY_DEFAULT, BACKGROUND_PATTERN_MOODS } from '../designRailItems';

// 로고·스탬프 크롭 모달 — 열기 전엔 안 쓰므로 dynamic(ssr:false)로 react-image-crop을 분리한다.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

type Photo = ReturnType<typeof usePhototicket>;

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

// 마스터 C-AROW 버튼 문법 — 행 안 동작은 보조(테두리) 버튼과 텍스트 버튼 둘뿐이다. 둘 다 44px 타깃.
const SEC_BTN = 'inline-flex h-touch shrink-0 items-center rounded-md border border-hair-strong px-2.5 text-body text-ink transition-colors disabled:opacity-40';
const TXT_BTN = 'inline-flex h-touch shrink-0 items-center px-2 text-body text-ink underline underline-offset-4 transition-colors disabled:no-underline disabled:opacity-40';

/** 포스터가 이미 있을 때 그 픽셀 크기('960 × 1440') — 크롭 출력 크기가 상태에 안 실려 이미지를 한 번 읽어 잰다. */
function useImageSize(url: string | null | undefined): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number; url: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0) setSize({ w: img.naturalWidth, h: img.naturalHeight, url });
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [url]);
  return url && size?.url === url ? size : null;
}

/** 행 하나(C-AROW) — 썸네일 · 이름 + 상태 한 줄 · 동작. 이름 영역이 버튼이면 onOpen을 준다. */
function AssetRow({
  thumb,
  name,
  status,
  onOpen,
  children,
}: {
  thumb: ReactNode;
  name: string;
  status: string;
  /** 이름 영역을 눌러 여는 편집(로고 텍스트). 없으면 정적 영역이다. */
  onOpen?: () => void;
  children: ReactNode;
}) {
  const label = (
    <>
      <b className="truncate text-body font-medium text-ink">{name}</b>
      <small className="truncate text-caption text-ink-2">{status}</small>
    </>
  );
  return (
    <div data-asset-row={name} className="flex min-h-12 items-center gap-3 border-b border-hair">
      {thumb}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${name} 편집`}
          className={cn(pressableVariants(), 'flex min-h-touch min-w-0 flex-1 flex-col items-start justify-center text-left')}
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col">{label}</span>
      )}
      {children}
    </div>
  );
}

const THUMB_BASE = 'shrink-0 overflow-hidden rounded-sm border';

function PosterThumb({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className={cn(THUMB_BASE, 'h-10 w-[26px] border-hair-strong object-cover')} />
  ) : (
    <span aria-hidden="true" className={cn(THUMB_BASE, 'h-10 w-[26px] border-dashed border-hair-strong')} />
  );
}

function LogoThumb({ src, text }: { src: string; text: string }) {
  if (src) return <img src={src} alt="" className={cn(THUMB_BASE, 'h-[26px] w-10 border-hair-strong bg-s2 object-contain')} />;
  if (text) {
    return (
      <span
        aria-hidden="true"
        className={cn(THUMB_BASE, 'grid h-[26px] w-10 place-items-center border-hair-strong bg-s2 text-micro font-semibold text-ink')}
      >
        <span className="max-w-full truncate px-0.5">{text}</span>
      </span>
    );
  }
  return <span aria-hidden="true" className={cn(THUMB_BASE, 'h-[26px] w-10 border-dashed border-hair-strong')} />;
}

function EyeToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${label} 티켓에 표시`}
      aria-pressed={on}
      onClick={onToggle}
      className={cn(pressableVariants(), `-mr-2 inline-flex h-touch w-touch shrink-0 items-center justify-center transition-colors ${on ? 'text-ink' : 'text-ink-3'}`)}
    >
      <EyeIcon open={on} size={18} />
    </button>
  );
}

function PosterRow({
  photo,
  onPick,
  onRecrop,
}: {
  photo: Photo;
  onPick: () => void;
  /** 원본이 있을 때만 넘어온다 — 없으면 자르기가 비활성이다. */
  onRecrop?: () => void;
}) {
  const url = photo.state.croppedImageUrl;
  const size = useImageSize(url);
  // awaitingPosterRestore(#683) — croppedImageUrl은 아직 null이지만 복원 중인 포스터가 있다. '추가'로 두면
  // 없는 걸 새로 올리는 것처럼 읽혀 도착 순간 라벨이 설명 없이 바뀌므로 교체로 미리 맞춘다.
  const hasPoster = !!url || photo.awaitingPosterRestore;
  const status = !url
    ? photo.awaitingPosterRestore
      ? '불러오는 중'
      : '없음'
    : !onRecrop
      ? '원본 없음'
      : size
        ? `${size.w} × ${size.h}`
        : '포스터 있음';
  return (
    <AssetRow thumb={<PosterThumb src={url ?? null} />} name="포스터" status={status}>
      {url && (
        <button type="button" onClick={onRecrop} disabled={!onRecrop} className={cn(pressableVariants(), TXT_BTN)}>
          자르기
        </button>
      )}
      <button type="button" onClick={onPick} className={cn(pressableVariants(), SEC_BTN)}>
        {hasPoster ? '교체' : '추가'}
      </button>
    </AssetRow>
  );
}

function LogoRow({ target, photo, onEdit }: { target: StampTarget; photo: Photo; onEdit: (t: SheetTarget) => void }) {
  const keys = STAMP_KEYS[target];
  const components = photo.state.components;
  const image = String(components[keys.image] ?? '');
  const text = String(components[keys.label] ?? '').trim();
  const visible = !!components[keys.visible];
  const label = STAMP_LABELS[target];
  const setImage = (url: string) => photo.updateComponents({ [keys.image]: url } as Partial<TicketComponents>);
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(setImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const status = image ? '이미지' : text ? `텍스트 · ${text}` : '비어 있음';
  return (
    <AssetRow thumb={<LogoThumb src={image} text={text} />} name={label} status={status} onOpen={() => onEdit(target)}>
      {image ? (
        <>
          <button type="button" onClick={() => setImage('')} className={cn(pressableVariants(), TXT_BTN)}>
            제거
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={cn(pressableVariants(), SEC_BTN)}>
            교체
          </button>
        </>
      ) : text ? (
        <button type="button" onClick={() => fileRef.current?.click()} className={cn(pressableVariants(), SEC_BTN)}>
          이미지로
        </button>
      ) : (
        // 텍스트와 이미지 둘 다 들어가는 인플레이스 입력(필드바 이미지 칩)을 연다 — 빈 로고는 어느 쪽으로
        // 채울지 아직 정해지지 않았으므로 업로드로 바로 가지 않는다.
        <button type="button" onClick={() => onEdit(target)} className={cn(pressableVariants(), SEC_BTN)}>
          추가
        </button>
      )}
      <EyeToggle
        label={label}
        on={visible}
        onToggle={() => photo.updateComponents({ [keys.visible]: !visible } as Partial<TicketComponents>)}
      />
      {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus). */}
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        aria-label={`${label} 이미지 파일`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.type.startsWith('image/')) openFile(file);
          e.target.value = '';
        }}
        className="sr-only"
      />
      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          title="로고 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </AssetRow>
  );
}

/**
 * 배경 스탬프 행(#530 → #826 S2 G-01) — 옛 스탬프 레일 항목의 업로드·제거가 사진 모드로 왔다. 크기는 크기 도구,
 * 투명도는 투명도 도구가 이어받는다.
 */
function StampRow({ photo }: { photo: Photo }) {
  const image = photo.state.components.backgroundPatternImage;
  // 업로드는 로고 스탬프와 **같은** 자유비 크롭 흐름(useLogoCrop, #220)을 그대로 탄다. maxSide는 로고 기본값(640)을
  // 쓰면 안 된다 — cover로 캔버스 전면을 채워 저장물(pixelRatio 2)에서 3~5배 확대돼 뭉갠다(#671).
  // 투명도 write-time 커밋(#728 c4) — 이미지와 투명도를 같은 updateComponents 호출에 묶어 undo 한 번이 반쯤
  // 되돌린 상태를 만들지 않게 한다.
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(
    (backgroundPatternImage) =>
      photo.updateComponents({
        backgroundPatternImage,
        backgroundPatternOpacity: photo.state.components.backgroundPatternOpacity ?? BACKGROUND_OPACITY_DEFAULT,
      }),
    TARGET_HEIGHT,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <AssetRow thumb={<LogoThumb src={image ?? ''} text="" />} name="배경 스탬프" status={image ? '이미지' : '비어 있음'}>
      {image && (
        // blob revoke는 여기서 하지 않는다 — undo 히스토리(#356)가 이 URL을 참조한다(useLogoCrop 주석과 같은 이유).
        <button
          type="button"
          onClick={() => photo.updateComponents({ backgroundPatternImage: '' })}
          className={cn(pressableVariants(), TXT_BTN)}
        >
          제거
        </button>
      )}
      <button type="button" onClick={() => fileRef.current?.click()} className={cn(pressableVariants(), SEC_BTN)}>
        {image ? '교체' : '추가'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        aria-label="스탬프 이미지 업로드"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.type.startsWith('image/')) openFile(file);
          // 같은 파일을 다시 골라도 change가 뜨게 비운다.
          e.target.value = '';
        }}
        className="sr-only"
      />
      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          title="스탬프 이미지 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </AssetRow>
  );
}

/** 사진 모드(G-01) — 이미지 자산 행: 포스터 · 극장 로고 · 포맷 로고, 스탬프 무드는 배경 스탬프까지. */
export function PhotoPane({
  photo,
  onPosterPick,
  onPosterRecrop,
  onEditField,
}: {
  photo: Photo;
  onPosterPick: () => void;
  onPosterRecrop?: () => void;
  onEditField: (target: SheetTarget) => void;
}) {
  const layout = photo.state.components.layout;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <PosterRow photo={photo} onPick={onPosterPick} onRecrop={onPosterRecrop} />
      {STAMP_TARGETS.map((target) => (
        <LogoRow key={target} target={target} photo={photo} onEdit={onEditField} />
      ))}
      {BACKGROUND_PATTERN_MOODS.includes(layout) && <StampRow photo={photo} />}
    </div>
  );
}
