import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getCroppedImg, Area } from '@/utils/imageCrop';

const ImageCropModal = dynamic(() => import('./ImageCropModal'), { ssr: false });

interface ImageUploaderProps {
  onUpload: (croppedImageUrl: string) => void;
  isProcessing: boolean;
  hasImage?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/jpg,image/webp';

export default function ImageUploader({ onUpload, isProcessing, hasImage = false }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const openFile = (file: File) => {
    // 이전 selectedImageSrc는 아래 effect cleanup이 단일 소유자로 revoke (이중 revoke 방지)
    const objectUrl = URL.createObjectURL(file);
    setSelectedImageSrc(objectUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && ACCEPT.includes(file.type)) openFile(file);
  };

  const handleCropComplete = async (croppedAreaPixels: Area) => {
    if (!selectedImageSrc) return;
    setIsCropping(true);
    try {
      const croppedUrl = await getCroppedImg(selectedImageSrc, croppedAreaPixels);
      onUpload(croppedUrl);
      setSelectedImageSrc(null); // effect cleanup이 직전 selectedImageSrc revoke
    } catch (error) {
      console.error('크롭 실패:', error);
      alert('이미지 크롭에 실패했습니다.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleCropCancel = () => {
    setSelectedImageSrc(null); // effect cleanup이 직전 selectedImageSrc revoke
  };

  // selectedImageSrc blob의 단일 소유자: 값이 바뀌거나(교체·크롭완료·취소) 언마운트될 때
  // 직전 URL을 revoke. 명시 revoke를 두면 이 cleanup과 겹쳐 이중 revoke가 됨.
  useEffect(() => {
    return () => {
      if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
    };
  }, [selectedImageSrc]);

  const busy = isProcessing || isCropping;

  return (
    <section className="h-full">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        data-touch="44"
        className={`group relative flex h-full w-full flex-col justify-center overflow-hidden rounded-card border bg-paper p-4 text-left shadow-card transition-colors
          ${isDragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40'}
          ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
              {hasImage ? 'Replace' : 'Drop or click'}
            </div>
            <p className="text-[15px] font-medium leading-tight text-fg md:text-[16px]">
              {hasImage ? '포스터 교체' : '포스터 업로드'}
            </p>
            <p className="max-w-[36ch] text-[12px] leading-relaxed text-fg-muted">
              JPEG · PNG · WEBP. 0.65 : 1 비율로 직접 크롭할 수 있어요.
            </p>
          </div>

          <span
            aria-hidden
            className="text-mono shrink-0 text-xl font-normal text-accent transition-transform group-hover:rotate-90 md:text-2xl"
          >
            +
          </span>
        </div>

        {busy && (
          <div className="text-mono mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent-ink">
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

      {selectedImageSrc && (
        <ImageCropModal
          imageSrc={selectedImageSrc}
          onClose={handleCropCancel}
          onComplete={handleCropComplete}
          isProcessing={isCropping}
        />
      )}
    </section>
  );
}
