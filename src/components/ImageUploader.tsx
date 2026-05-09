import { useRef, useState, useEffect } from 'react';
import ImageCropModal from './ImageCropModal';
import { getCroppedImg, Area } from '@/utils/imageCrop';
import SectionHeader from './ui/SectionHeader';

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
    if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
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
      URL.revokeObjectURL(selectedImageSrc);
      setSelectedImageSrc(null);
    } catch (error) {
      console.error('크롭 실패:', error);
      alert('이미지 크롭에 실패했습니다.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleCropCancel = () => {
    if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
    setSelectedImageSrc(null);
  };

  useEffect(() => {
    return () => {
      if (selectedImageSrc) URL.revokeObjectURL(selectedImageSrc);
    };
  }, [selectedImageSrc]);

  const busy = isProcessing || isCropping;

  return (
    <section>
      <SectionHeader index="01" title="Poster" caption="Source image · 0.65:1 crop" />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={busy}
        className={`group relative block w-full overflow-hidden border bg-ink-100 p-8 text-left transition-all md:p-10
          ${isDragging ? 'border-gold bg-gold/[0.04]' : 'border-white/[0.08] hover:border-white/20'}
          ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="text-mono text-[10px] uppercase tracking-widest text-bone-400">
              {hasImage ? '— REPLACE —' : '— DROP OR CLICK —'}
            </div>
            <p className="text-display text-2xl font-light italic leading-tight tracking-tight text-paper md:text-[28px]">
              {hasImage ? 'Swap poster' : 'Upload film poster'}
            </p>
            <p className="max-w-[36ch] text-xs leading-relaxed text-bone-400 md:text-[13px]">
              JPEG · PNG · WEBP. 업로드 후 0.65:1 비율로 직접 크롭할 수 있어요.
            </p>
          </div>

          <span
            aria-hidden
            className="text-mono shrink-0 text-3xl font-light text-gold transition-transform group-hover:rotate-90 group-hover:translate-x-0 md:text-4xl"
          >
            +
          </span>
        </div>

        {busy && (
          <div className="mt-6 flex items-center gap-3 text-mono text-[10px] uppercase tracking-widest text-gold">
            <span className="h-1 w-1 animate-pulse rounded-full bg-gold" />
            Processing image…
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
      </button>

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
