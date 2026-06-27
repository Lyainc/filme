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
    <section>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        data-touch="44"
        className={`group relative flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-card border bg-paper p-6 text-center shadow-card transition-colors
          ${isDragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40'}
          ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        <span
          aria-hidden
          className="text-mono text-2xl font-normal leading-none text-accent transition-transform group-hover:rotate-90 md:text-3xl"
        >
          +
        </span>
        <p className="text-[16px] font-medium leading-tight text-fg">
          {hasImage ? '포스터 교체' : '포스터 업로드'}
        </p>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          드래그 또는 클릭{hasImage ? '으로 교체' : ''}
        </p>
        <p className="text-[11px] leading-relaxed text-fg-faint">
          JPEG · PNG · WEBP · 0.65 : 1 크롭
        </p>

        {busy && (
          <div className="text-mono mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
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
