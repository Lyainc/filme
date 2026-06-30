import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Area } from '@/utils/imageCrop';
import { TARGET_RATIO } from '@/utils/constants';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

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
      if (!node.contains(active)) {
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
      aria-label="Frame the poster"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain animate-fade-in"
      style={{ background: 'rgba(44,38,34,0.55)' }}
    >
      <div className="relative flex h-[85svh] max-h-[820px] w-full max-w-xl flex-col overflow-hidden rounded-modal bg-paper shadow-card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-baseline gap-3">
            <span className="text-mono text-[10px] uppercase tracking-widest text-accent">
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

        <div className="flex flex-col gap-4 border-t border-line px-5 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
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
              className="text-mono group inline-flex min-h-btn items-center justify-center gap-2 rounded-field bg-accent text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>,
    document.body
  );
}
