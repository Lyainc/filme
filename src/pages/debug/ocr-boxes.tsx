import { useState } from 'react';
import { runOcrBoxes, type OcrBoxItem } from '@/utils/ocr';

export default function DebugOcrBoxes() {
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<OcrBoxItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await runOcrBoxes(file);
      if (result.preprocessedImage) setImage(result.preprocessedImage);
      setItems(result.items || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-surface min-h-screen text-fg">
      <h1 className="text-xl font-bold mb-4">OCR Boxes Debug</h1>
      <input type="file" accept="image/*" onChange={handleFile} className="mb-4" />
      {loading && <p className="text-accent mb-4">Loading (processing and calling API)...</p>}
      <div className="relative mt-4 inline-block">
        {image && <img src={image} alt="Preprocessed" className="max-w-none border border-line" />}
        {items.map((item, i) => {
          if (!item.box) return null;
          return (
            <div
              key={i}
              className="absolute border border-accent bg-accent/20"
              style={{
                left: item.box.x,
                top: item.box.y,
                width: item.box.w,
                height: item.box.h,
              }}
            >
              <span className="bg-accent text-white text-[10px] px-1 absolute -top-4 left-0 whitespace-nowrap z-10 rounded-sm">
                {item.field ?? 'null'}: {item.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
