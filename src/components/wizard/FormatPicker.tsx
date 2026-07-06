import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import { FORMAT_PRESETS } from '@/constants/fields';

const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

interface FormatPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** 텍스트 라벨(이미지 없을 때 티켓에 표시) — 프리셋/수동 입력이 1차 소스(#141 (7)). */
  label: string;
  onLabelChange: (value: string) => void;
  chain: string;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export default function FormatPicker({
  value,
  onChange,
  label,
  onLabelChange,
  visible,
  onVisibilityChange,
}: FormatPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 프리셋 활성화 직전의 커스텀 입력값 보존 — 프리셋 해제 시 빈 문자열 대신 이 값으로 복원(#162).
  const prevLabelRef = useRef('');
  // 업로드 → 자유 크롭 모달 → '적용' 시 크롭된 PNG를 onChange로 넘긴다(#220).
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(value, onChange);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) openFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="text-mono w-14 shrink-0 text-[10px] uppercase tracking-widest text-fg-muted">
          Format
        </span>
        <button
          type="button"
          onClick={() => onVisibilityChange(!visible)}
          className={`text-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-chip border transition-colors ${
            visible ? 'border-accent text-accent' : 'border-line text-fg-muted hover:text-fg'
          }`}
        >
          {visible ? 'ON' : 'OFF'}
        </button>
      </div>

      {visible && (value ? (
        <div className="flex items-center gap-2 bg-paper border border-line rounded-chip px-3 py-1.5 h-9 w-fit">
          <img src={value} alt="Uploaded Format" className="h-5 w-auto object-contain" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-fg-muted hover:text-fg underline ml-1"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* 이미지 없을 때 텍스트 라벨로 출력 — 프리셋/직접 입력(#141 (7)) */}
            <input
              type="text"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="IMAX"
              maxLength={24}
              aria-label="포맷 텍스트 라벨"
              className="text-mono w-24 rounded-field border border-line bg-surface-elevated px-3 py-2 text-[12px] uppercase tracking-widest text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-mono inline-flex min-h-touch items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
            >
              Upload Format
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FORMAT_PRESETS.map((preset) => {
              const active = label === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    if (active) {
                      onLabelChange(prevLabelRef.current);
                    } else {
                      // 프리셋 값은 보존하지 않음 — 프리셋끼리 갈아타도 직전 커스텀 입력이 살아남게.
                      if (!FORMAT_PRESETS.includes(label)) prevLabelRef.current = label;
                      onLabelChange(preset);
                    }
                  }}
                  className={`text-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-chip border transition-colors ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-surface-elevated text-fg-muted hover:text-fg hover:border-accent'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="sr-only"
      />

      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          aspect={undefined}
          title="로고 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </div>
  );
}
