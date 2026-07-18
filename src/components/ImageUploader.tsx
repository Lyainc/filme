import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getCroppedImg, Area } from '@/utils/imageCrop';
import { TARGET_HEIGHT } from '@/utils/constants';
import type { LayoutId } from '@/types';

const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

interface ImageUploaderProps {
  /** preserveRatio는 #420 "원본 비율 보존" 프리셋 토글 결과 — posterFit 컴포넌트 상태로 이어서 저장할 것. */
  onUpload: (croppedImageUrl: string, preserveRatio: boolean) => void;
  isProcessing: boolean;
  /** 업로드 후 프리뷰로 보여줄 크롭 결과(부모 소유 objectURL). */
  imageUrl?: string | null;
  /** 현재 무드(#420 배선) — ImageCropModal에 그대로 전달해 프리셋 토글 노출 여부를 결정한다. */
  layout: LayoutId;
}

const ACCEPT = 'image/jpeg,image/png,image/jpg,image/webp';

export default function ImageUploader({ onUpload, isProcessing, imageUrl, layout }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 크롭 모달의 소스이자 재크롭을 위해 유지되는 원본 objectURL. 크롭 완료 후에도 버리지 않는다.
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 방금 고른 새 파일이 아직 크롭 확정 전인지. 첫 업로드·교체에서 true, 크롭 완료 시 false.
  // 재크롭(새 파일 안 고름)에선 false로 남아 취소해도 원본을 유지한다.
  const [pendingNewFile, setPendingNewFile] = useState(false);

  const openFile = (file: File) => {
    // 이전 originalSrc는 아래 effect cleanup이 단일 소유자로 revoke (이중 revoke 방지)
    const objectUrl = URL.createObjectURL(file);
    setOriginalSrc(objectUrl);
    setPendingNewFile(true);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // 크롭/처리 중 드롭하면 진행 중인 getCroppedImg가 읽고 있는 원본 blob을
    // cleanup이 revoke해버린다(버튼은 disabled지만 드롭은 따로 막아야 함).
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file && ACCEPT.includes(file.type)) openFile(file);
  };

  const handleCropComplete = async (croppedAreaPixels: Area, preserveRatio: boolean) => {
    if (!originalSrc) return;
    setIsCropping(true);
    try {
      // 원본 비율 보존(#420): 고정 960×1477 스트레치 대신 크롭 종횡비를 유지하며 긴 변만 캡한다.
      const croppedUrl = await getCroppedImg(
        originalSrc,
        croppedAreaPixels,
        preserveRatio ? { maxSide: TARGET_HEIGHT * 2 } : undefined
      );
      onUpload(croppedUrl, preserveRatio);
      setPendingNewFile(false);
      setCropOpen(false); // originalSrc는 유지 — 재크롭에 재사용
    } catch (error) {
      console.error('크롭 실패:', error);
      alert('이미지 크롭에 실패했습니다.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    // 새 파일(첫 업로드·교체)을 고른 뒤 취소면 원본을 버린다 — 교체 취소 땐 직전 포스터의
    // 원본이 이미 revoke됐으므로 재크롭 불가, originalSrc를 null로 둬 정합성을 맞춘다.
    // 재크롭 취소(새 파일 안 고름)면 originalSrc를 유지해 다음 재크롭에 재사용.
    if (pendingNewFile) {
      setOriginalSrc(null);
      setPendingNewFile(false);
    }
  };

  // originalSrc blob의 단일 소유자: 값이 바뀌거나(새 파일 선택) 언마운트될 때 직전 URL을 revoke.
  // 크롭 완료/취소는 값을 안 바꾸므로 원본이 살아남아 재크롭에 쓰인다.
  useEffect(() => {
    return () => {
      if (originalSrc) URL.revokeObjectURL(originalSrc);
    };
  }, [originalSrc]);

  const busy = isProcessing || isCropping;
  const showPreview = !!imageUrl;

  return (
    <section>
      {showPreview ? (
        // 업로드 후: 포스터 썸네일이 주연. 큰 빈 드롭존 대신 결과를 한눈에(#182).
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex items-center gap-3 rounded-card border bg-paper p-3 shadow-card transition-colors
            ${isDragging ? 'border-accent bg-accent-soft' : 'border-line'}
            ${busy ? 'opacity-60' : ''}`}
        >
          <img
            src={imageUrl!}
            alt="업로드한 포스터"
            className="h-[88px] w-[57px] shrink-0 rounded-field border border-line object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                data-touch="44"
                className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-3 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
              >
                교체
              </button>
              <button
                type="button"
                onClick={() => originalSrc && setCropOpen(true)}
                disabled={busy || !originalSrc}
                data-touch="44"
                className="text-mono inline-flex min-h-[32px] items-center rounded-chip border border-line bg-surface px-3 text-[10px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40"
                title={originalSrc ? undefined : '재크롭하려면 다시 업로드해 주세요'}
              >
                재크롭
              </button>
            </div>
          </div>
          {busy && (
            <span className="text-mono flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Processing…
            </span>
          )}
        </div>
      ) : (
        // 업로드 전: 컴팩트 드롭존.
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-touch="44"
          className={`group relative flex min-h-[96px] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-card border bg-paper p-4 text-center shadow-card transition-colors
            ${isDragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40'}
            ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
        >
          <span
            aria-hidden
            className="text-mono text-2xl font-normal leading-none text-accent transition-transform group-hover:rotate-90"
          >
            +
          </span>
          <p className="text-[15px] font-medium leading-tight text-fg">포스터 업로드</p>

          {busy && (
            <div className="text-mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Processing…
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleChange}
            disabled={busy}
            className="sr-only"
          />
        </label>
      )}

      {/* 프리뷰 분기에선 label 밖이라 hidden input을 따로 둔다(교체 버튼이 click). */}
      {showPreview && (
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          disabled={busy}
          className="sr-only"
        />
      )}

      {cropOpen && originalSrc && (
        <ImageCropModal
          imageSrc={originalSrc}
          onClose={handleCropCancel}
          onComplete={handleCropComplete}
          isProcessing={isCropping}
          layout={layout}
        />
      )}
    </section>
  );
}
