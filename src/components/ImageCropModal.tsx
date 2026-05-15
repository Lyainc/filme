import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Area } from '@/utils/imageCrop';
import { TARGET_RATIO } from '@/utils/constants';

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onComplete: (croppedAreaPixels: Area) => void;
  isProcessing?: boolean;
}

export default function ImageCropModal({
  imageSrc,
  onClose,
  onComplete,
  isProcessing = false,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_a: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = () => {
    if (croppedAreaPixels && !isProcessing) onComplete(croppedAreaPixels);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isProcessing, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain animate-fade-in"
      style={{ background: 'rgba(44,38,34,0.55)' }}
    >
      <div className="relative flex h-[85vh] max-h-[820px] w-full max-w-xl flex-col overflow-hidden rounded-modal bg-paper shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent-ink">
              Crop
            </span>
            <h3 className="text-[16px] font-medium tracking-tight text-fg">Frame the poster</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
            data-touch="44"
            className="text-mono inline-flex min-h-touch min-w-touch items-center justify-center rounded-chip text-fg-muted transition-colors hover:bg-accent-soft hover:text-fg disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        <div className="relative flex-1 bg-fg/95">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={TARGET_RATIO}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            objectFit="contain"
          />
          <div className="text-mono pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-white/70">
            0.65 : 1
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line px-5 py-4">
          <div className="flex items-center gap-4">
            <span
              id="zoom-label"
              className="text-mono whitespace-nowrap text-[10px] uppercase tracking-widest text-fg-muted"
            >
              Zoom · {zoom.toFixed(1)}×
            </span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="zoom-label"
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              data-touch="44"
              className="text-mono inline-flex min-h-btn items-center justify-center rounded-field border border-line bg-paper text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
              data-touch="44"
              className="text-mono group inline-flex min-h-btn items-center justify-center gap-2 rounded-field bg-accent text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessing ? (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper" />
                  Processing
                </>
              ) : (
                <>
                  Apply <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
