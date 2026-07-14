import { useState, useEffect } from 'react';
import { getCroppedImg, Area } from '@/utils/imageCrop';

/**
 * 극장/포맷 로고 업로드용 자유 크롭 흐름(#220).
 *
 * 포스터 크롭과 달리 고정 종횡비가 없고(프레임 = 업로드 이미지의 자연 종횡비, #347),
 * 크롭 결과가 곧 로고 이미지(투명 PNG)다.
 * 파일 선택 → 원본 objectURL 생성 → 크롭 모달 → '적용' 시 getCroppedImg(png, 종횡비 보존)
 * → 원본 URL을 revoke하고 새 크롭 URL을 onChange로 넘긴다. 직전 로고 URL은 undo 히스토리
 * (#356)가 참조하므로 여기서 revoke하지 않는다(handleComplete 주석 참고).
 *
 * 재크롭은 범위 밖(#220): 크롭 완료/취소 후 원본을 유지하지 않으므로 다시 업로드로 재크롭.
 *
 * @param onChange 크롭 완료 시 새 로고 URL 전달.
 */
export function useLogoCrop(onChange: (url: string) => void) {
  // 크롭 모달 소스이자 getCroppedImg가 읽는 원본. 완료/취소 시 null로 비워 revoke.
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const openFile = (file: File) => {
    // 이전 rawSrc는 아래 effect cleanup이 단일 소유자로 revoke(이중 revoke 방지).
    setRawSrc(URL.createObjectURL(file));
  };

  const handleComplete = async (croppedAreaPixels: Area) => {
    if (!rawSrc) return;
    setIsCropping(true);
    try {
      const cropped = await getCroppedImg(rawSrc, croppedAreaPixels, {
        mimeType: 'image/png', // 투명 PNG 로고의 알파 보존
        maxSide: 640, // 자유 종횡비 유지, 긴 변만 캡해 파일 크기 제한
      });
      // 직전 로고(value)는 교체 시점에 revoke하지 않는다 — undo 히스토리(#356)가 이전 URL을
      // 참조하므로 여기서 풀면 undo가 죽은 이미지를 복원한다. 최신 로고는 usePhototicket이
      // 언마운트·clearDraft에서 revoke하고, 히스토리 속 과거 로고는 탭 수명 누수로 수용한다
      // (640px 캡 PNG라 작다). ponytail: 히스토리 밀림에 맞춘 참조 카운팅이 필요해지면 그때.
      onChange(cropped);
      setRawSrc(null); // effect cleanup이 원본 revoke
    } catch (err) {
      // ImageUploader 포스터 크롭과 동일한 사용자 피드백(canvas/SVG 오류로 실패 가능).
      console.error('로고 크롭 실패:', err);
      alert('이미지 크롭에 실패했습니다.');
      setRawSrc(null);
    } finally {
      setIsCropping(false);
    }
  };

  const handleCancel = () => setRawSrc(null);

  // rawSrc blob의 단일 소유자: 값이 바뀌거나(새 파일) 언마운트될 때 직전 URL을 revoke.
  useEffect(() => {
    return () => {
      if (rawSrc) URL.revokeObjectURL(rawSrc);
    };
  }, [rawSrc]);

  return { rawSrc, isCropping, openFile, handleComplete, handleCancel };
}
