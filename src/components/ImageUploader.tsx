import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PosterCrop } from '@/hooks/usePosterCrop';
import type { LayoutId } from '@/types';

const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

interface ImageUploaderProps {
  /**
   * 포스터 크롭 파이프라인(#548) — 원본 objectURL·모달 상태는 usePhototicket이 소유하고
   * 이 컴포넌트는 소비만 한다. 예전엔 여기 로컬 state였는데, 그러면 이 컴포넌트가 언마운트될 때
   * 훅이 아직 참조 중인 원본 blob이 revoke됐다(#548의 실패 모드).
   */
  crop: PosterCrop;
  isProcessing: boolean;
  /** 업로드 후 프리뷰로 보여줄 크롭 결과(부모 소유 objectURL). */
  imageUrl?: string | null;
  /** 현재 무드(#420 배선) — ImageCropModal에 그대로 전달해 프리셋 토글 노출 여부를 결정한다. */
  layout: LayoutId;
}

const ACCEPT = 'image/jpeg,image/png,image/jpg,image/webp';

export default function ImageUploader({ crop, isProcessing, imageUrl, layout }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { originalSrc } = crop;

  const openFile = (file: File) => {
    crop.openFile(file);
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

  const busy = isProcessing || crop.isCropping;
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
                onClick={crop.openRecrop}
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

      {crop.cropOpen && originalSrc && (
        <ImageCropModal
          imageSrc={originalSrc}
          onClose={crop.cancel}
          onComplete={crop.complete}
          isProcessing={crop.isCropping}
          layout={layout}
        />
      )}
    </section>
  );
}
