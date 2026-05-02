import { useRef } from 'react';
import PhototicketCanvas from '@/components/PhototicketCanvas';
import ImageUploader from '@/components/ImageUploader';
import MovieInfoForm from '@/components/MovieInfoForm';
import ComponentSelector from '@/components/ComponentSelector';
import { usePhototicket } from '@/hooks/usePhototicket';
import { downloadCanvasAsJPEG } from '@/utils/canvasExport';

export default function Home() {
  const {
    state,
    debouncedState,
    isProcessing,
    handleImageUpload,
    updateMovieInfo,
    updateComponents,
  } = usePhototicket();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 다운로드 핸들러
  const handleDownload = () => {
    if (!canvasRef.current || !state.croppedImageUrl) {
      alert('먼저 이미지를 업로드하세요');
      return;
    }

    const filename = `phototicket_${state.movieInfo.title || 'untitled'}.jpg`;
    downloadCanvasAsJPEG(canvasRef.current, filename);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">🎬 포토티켓 메이커</h1>
          <p className="text-sm lg:text-base text-gray-600 mt-2">
            영화 포스터를 업로드하고 정보를 입력하면 CGV 포토플레이용 포토티켓을 생성합니다
          </p>
        </header>

        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8">
          {/* 입력 폼 영역 */}
          <div className="space-y-6 order-2 lg:order-1">
            <ImageUploader
              onUpload={handleImageUpload}
              isProcessing={isProcessing}
            />

            <MovieInfoForm
              movieInfo={state.movieInfo}
              onChange={updateMovieInfo}
            />

            <ComponentSelector
              components={state.components}
              onChange={updateComponents}
            />

            <div className="hidden lg:block">
              <button
                onClick={handleDownload}
                disabled={!state.croppedImageUrl}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
              >
                ⬇️ JPEG 다운로드 (960×1477px)
              </button>
            </div>
          </div>

          {/* 프리뷰 영역 - 모바일에서는 상단 고정(Sticky) 또는 우선 배치 */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-8 self-start">
            <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg lg:text-xl font-bold text-gray-800">미리보기</h2>
                {state.croppedImageUrl && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium">
                    실시간 반영 중
                  </span>
                )}
              </div>
              
              <div className="relative group">
                {state.croppedImageUrl ? (
                  <PhototicketCanvas
                    ref={canvasRef}
                    croppedImageUrl={state.croppedImageUrl} // 이미지는 딜레이 없이 즉시 렌더링
                    movieTitle={debouncedState.movieInfo.title}
                    watchDate={debouncedState.movieInfo.watchDate}
                    theater={debouncedState.movieInfo.theater}
                    screen={debouncedState.movieInfo.screen}
                    seat={debouncedState.movieInfo.seat}
                    chain={debouncedState.components.chain}
                    format={debouncedState.components.format}
                    texture={debouncedState.components.texture}
                  />
                ) : (
                  <div className="flex items-center justify-center aspect-[0.65/1] w-full max-w-[320px] mx-auto bg-gray-100 rounded-xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 text-center text-sm p-4">
                      이미지를 업로드하면<br />여기에 표시됩니다
                    </p>
                  </div>
                )}
              </div>

              {/* 모바일 전용 다운로드 버튼 (스크롤 하단 고정될 때 유용) */}
              <div className="mt-6 lg:hidden">
                <button
                  onClick={handleDownload}
                  disabled={!state.croppedImageUrl}
                  className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
                >
                  ⬇️ JPEG 다운로드
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 하단 플로팅 다운로드 버튼 (선택 사항) */}
      {state.croppedImageUrl && (
        <div className="lg:hidden fixed bottom-6 left-4 right-4 z-50">
          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-2xl active:scale-[0.96] transition-transform flex items-center justify-center gap-2"
          >
            <span>⬇️</span>
            <span>포토티켓 저장하기</span>
          </button>
        </div>
      )}
    </div>
  );
}
