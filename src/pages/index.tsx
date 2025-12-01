import { useState } from 'react';
import PhototicketCanvas from '@/components/PhototicketCanvas';
import { cropImage } from '@/utils/imageCrop';
import { downloadCanvasAsJPEG } from '@/utils/canvasExport';

export default function Home() {
  // 상태 관리 (Context API 없이 간단하게)
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [movieTitle, setMovieTitle] = useState('');
  const [watchDate, setWatchDate] = useState('');
  const [theater, setTheater] = useState('');
  const [chain, setChain] = useState('');
  const [format, setFormat] = useState('');

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cropped = await cropImage(file);
      setCroppedImageUrl(cropped);
    } catch (error) {
      console.error('크롭 실패:', error);
      alert('이미지 처리 실패');
    }
  };

  // 다운로드
  const handleDownload = () => {
    const canvas = (window as any).phototicketCanvas;
    if (!canvas) {
      alert('먼저 이미지를 업로드하세요');
      return;
    }
    const filename = `phototicket_${movieTitle || 'untitled'}.jpg`;
    downloadCanvasAsJPEG(canvas, filename);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🎬 포토티켓 메이커</h1>

        <div className="grid grid-cols-2 gap-8">
          {/* 왼쪽: 입력 폼 */}
          <div className="space-y-6">
            {/* 이미지 업로드 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">1. 포스터 업로드</h2>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={handleImageUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* 영화 정보 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">2. 영화 정보</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">영화 제목</label>
                  <input
                    type="text"
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="인터스텔라"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">관람일</label>
                  <input
                    type="text"
                    value={watchDate}
                    onChange={(e) => setWatchDate(e.target.value)}
                    placeholder="2024. 11. 28."
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">극장 위치</label>
                  <input
                    type="text"
                    value={theater}
                    onChange={(e) => setTheater(e.target.value)}
                    placeholder="CGV 용산아이파크몰"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* 컴포넌트 선택 */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">3. 컴포넌트 선택</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">극장 체인</label>
                  <select
                    value={chain}
                    onChange={(e) => setChain(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="">선택 안함</option>
                    <option value="CGV">CGV</option>
                    <option value="롯데시네마">롯데시네마</option>
                    <option value="메가박스">메가박스</option>
                    <option value="씨네Q">씨네Q</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">상영 포맷</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="">선택 안함</option>
                    <option value="IMAX">IMAX</option>
                    <option value="4DX">4DX</option>
                    <option value="DOLBY CINEMA">DOLBY CINEMA</option>
                    <option value="ScreenX">ScreenX</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 다운로드 */}
            <button
              onClick={handleDownload}
              disabled={!croppedImageUrl}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ⬇️ JPEG 다운로드
            </button>
          </div>

          {/* 오른쪽: 프리뷰 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">미리보기</h2>
            {croppedImageUrl ? (
              <PhototicketCanvas
                croppedImageUrl={croppedImageUrl}
                movieTitle={movieTitle}
                watchDate={watchDate}
                theater={theater}
                chain={chain}
                format={format}
              />
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-100 rounded">
                <p className="text-gray-400">이미지를 업로드하면 여기에 표시됩니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
