import { useRef } from 'react';

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export default function ImageUploader({ onUpload, isProcessing }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">1. 포스터 업로드</h2>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg,image/webp"
        onChange={handleChange}
        disabled={isProcessing}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
      />
      {isProcessing && (
        <p className="text-sm text-blue-600 mt-2 animate-pulse">이미지 처리 중...</p>
      )}
    </section>
  );
}
