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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-sm overscroll-contain animate-fade-in">
      <div className="relative flex h-[85vh] max-h-[820px] w-full max-w-xl flex-col overflow-hidden border border-white/[0.08] bg-ink-100 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-mono text-[10px] uppercase tracking-widest text-gold">
              [CROP]
            </span>
            <h3 className="text-display text-lg font-light italic tracking-tight text-paper">
              Frame the poster
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
            className="text-mono p-2 text-sm text-bone-400 transition-colors hover:text-paper disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Cropper */}
        <div className="relative flex-1 bg-black">
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
          <div className="text-mono pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-widest text-paper/60">
            0.65 : 1
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-4 border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-4">
            <span
              id="zoom-label"
              className="text-mono whitespace-nowrap text-[10px] uppercase tracking-widest text-bone-400"
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
              onClick={onClose}
              disabled={isProcessing}
              className="text-mono border border-white/[0.12] py-3 text-[10px] uppercase tracking-widest text-bone-400 transition-colors hover:border-white/30 hover:text-paper disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || !croppedAreaPixels}
              className="text-mono group flex items-center justify-center gap-2 border border-gold bg-gold/[0.08] py-3 text-[10px] uppercase tracking-widest text-gold transition-all hover:bg-gold/[0.18] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isProcessing ? (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
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
