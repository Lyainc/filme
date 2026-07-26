import { useCallback, useEffect, useRef, useState } from 'react';
import { getCroppedImg, type Area } from '@/utils/imageCrop';
import { POSTER_PRESERVE_MAX_SIDE } from '@/utils/constants';

/**
 * 포스터 크롭 파이프라인의 단일 소유자(#548).
 *
 * 이전엔 같은 상태머신(원본 objectURL · cropOpen · pendingNewFile · 복원 시드 · revoke)이
 * ImageUploader와 MobileEditorShell에 한 벌씩 복제돼 있었고, 그 원본 URL을 usePhototicket이
 * 자기 ref로 따로 들고 persist했다. 즉 훅이 참조하는 blob을 컴포넌트가 자기 수명에 맞춰
 * revoke하는 구조라, 셸이 언마운트되는 경로(AppShell의 모바일↔데스크톱 브레이크포인트 전환)에서
 *   - 복원 시드가 이미 죽은 URL을 다시 물어 재크롭 버튼만 활성으로 남고(모달이 빈 채로 뜬다)
 *   - saveDraft가 죽은 URL을 blobUrlToBlob에 넣어 posterOriginal을 undefined로 덮어
 *     IndexedDB에서 원본을 영구히 지웠다.
 *
 * 그래서 이 훅은 usePhototicket 안에서 호출된다 — 원본 blob의 수명이 문서 상태와 정확히 같아지고,
 * 셸/패널은 이 객체를 소비만 한다. 소비자가 언마운트돼도 원본은 안 죽는다.
 *
 * @param commit 크롭 확정 시 (크롭 결과 URL, 원본 URL)을 넘긴다 — usePhototicket.handleImageUpload.
 */
export interface PosterCrop {
  /** 크롭 전 원본 objectURL. 재크롭의 소스이자 saveDraft가 IndexedDB에 실어보내는 값. null이면 재크롭 불가. */
  originalSrc: string | null;
  /** 크롭 모달 열림 여부 — 소비자가 `cropOpen && originalSrc`로 모달을 렌더한다. */
  cropOpen: boolean;
  /** getCroppedImg 진행 중(모달 '적용 중' + 드롭존 busy). */
  isCropping: boolean;
  /** 첫 업로드·교체: 새 파일로 원본을 갈아끼우고 모달을 연다. */
  openFile: (file: File) => void;
  /** 재크롭: 새 파일 없이 기존 원본으로 모달만 다시 연다. 원본이 없으면 no-op. */
  openRecrop: () => void;
  /** 모달 '적용'. 성공하면 true — 호출부의 후처리(모바일 첫 업로드 시 history.clear) 게이트다. */
  complete: (area: Area, preserveRatio: boolean) => Promise<boolean>;
  /** 모달 닫기 — 새 파일을 고른 뒤였으면 그 원본을 버린다(아래 pendingNewFile 주석). */
  cancel: () => void;
  /** 원본이 아직 없을 때만 채운다(자동저장 복원 #489 · handleImageUpload의 originalUrl 인자 공용 경로). */
  seedOriginal: (url: string | null) => void;
  /** clearDraft — 원본을 버리고(revoke는 아래 effect) 모달 상태까지 초기 슬레이트로. */
  reset: () => void;
}

export function usePosterCrop(commit: (croppedUrl: string, originalUrl: string) => void): PosterCrop {
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  // 방금 고른 새 파일이 아직 크롭 확정 전인지. 첫 업로드·교체에서 true, 크롭 완료 시 false.
  // 재크롭(새 파일 안 고름)에선 false로 남아 취소해도 원본을 유지한다(#182 PR #191 P1).
  const [pendingNewFile, setPendingNewFile] = useState(false);
  // originalSrc의 즉시 읽기용 미러 — setState 이전/직후에도 현재 원본을 알아야 하는 두 곳에서
  // 쓴다: seedOriginal의 "이미 있으면 무시" 판정(state updater 안에서 판정하면 밀려난 URL을
  // 순수하게 revoke할 수 없다)과 complete()의 await 이후 원본 교체 감지. 아래 setOriginalSrc를
  // 부르는 자리마다 함께 갱신한다(전부 이벤트/effect 경로라 렌더 순수성과 무관).
  const originalSrcRef = useRef<string | null>(null);

  // originalSrc blob의 단일 소유자: 값이 바뀌거나(새 파일 선택) 언마운트될 때 직전 URL을 revoke.
  // 크롭 완료/취소는 값을 안 바꾸므로 원본이 살아남아 재크롭에 쓰인다.
  useEffect(() => {
    return () => {
      if (originalSrc) URL.revokeObjectURL(originalSrc);
    };
  }, [originalSrc]);

  const openFile = useCallback((file: File) => {
    // 이전 originalSrc는 위 effect cleanup이 단일 소유자로 revoke (이중 revoke 방지)
    const url = URL.createObjectURL(file);
    originalSrcRef.current = url;
    setOriginalSrc(url);
    setPendingNewFile(true);
    setCropOpen(true);
  }, []);

  const openRecrop = useCallback(() => {
    if (originalSrc) setCropOpen(true);
  }, [originalSrc]);

  const complete = useCallback(
    async (area: Area, preserveRatio: boolean) => {
      if (!originalSrc) return false;
      setIsCropping(true);
      try {
        // 원본 비율 보존(#420): 포스터 표준 해상도 대신 크롭 종횡비를 유지하며 긴 변만 캡한다.
        const croppedUrl = await getCroppedImg(
          originalSrc,
          area,
          preserveRatio ? { maxSide: POSTER_PRESERVE_MAX_SIDE } : undefined,
        );
        // await 사이에 원본이 갈렸으면(clearDraft 등) 결과를 버린다 — 그대로 commit하면 이미
        // revoke된 URL이 originalSrc로 되살아나 #548의 증상(재크롭 버튼만 활성 + saveDraft가
        // 죽은 URL을 persist)이 그대로 재현된다.
        if (originalSrcRef.current !== originalSrc) {
          URL.revokeObjectURL(croppedUrl);
          return false;
        }
        commit(croppedUrl, originalSrc);
        setPendingNewFile(false);
        setCropOpen(false); // originalSrc는 유지 — 재크롭에 재사용
        return true;
      } catch (error) {
        // useLogoCrop과 동일한 사용자 피드백(canvas/SVG 오류로 실패 가능).
        console.error('포스터 크롭 실패:', error);
        alert('이미지 크롭에 실패했습니다.');
        return false;
      } finally {
        setIsCropping(false);
      }
    },
    [originalSrc, commit],
  );

  const cancel = useCallback(() => {
    setCropOpen(false);
    // 새 파일(첫 업로드·교체)을 고른 뒤 취소면 원본을 버린다 — 교체 취소 땐 직전 포스터의 원본이
    // 이미 revoke됐으므로 재크롭 불가, originalSrc를 null로 둬 정합성을 맞춘다.
    // 재크롭 취소(새 파일 안 고름)면 originalSrc를 유지해 다음 재크롭에 재사용.
    if (pendingNewFile) {
      originalSrcRef.current = null;
      setOriginalSrc(null);
      setPendingNewFile(false);
    }
  }, [pendingNewFile]);

  const seedOriginal = useCallback((url: string | null) => {
    // 이미 원본이 있으면 무시한다 — IndexedDB 복원(#489)은 비동기라, 그 사이 사용자가 이미
    // 새 포스터를 올렸을 수 있다(레이스). 무조건 덮으면 방금 올린 원본을 지워버린다.
    // 교체는 openFile이 담당하므로 이 경로가 원본을 갈아끼울 일은 없다.
    if (originalSrcRef.current) {
      // 밀려난 복원본은 여기서 바로 푼다 — 아무도 안 쥐고 있어 revoke effect가 못 잡는다.
      // 단 지금 쥔 것과 같은 URL이면 버려지는 게 아니다(크롭 확정이 원본을 그대로 되돌려주는
      // 경로) — 여기서 풀면 방금 확정한 원본이 죽는다.
      if (url && url !== originalSrcRef.current) URL.revokeObjectURL(url);
      return;
    }
    originalSrcRef.current = url;
    setOriginalSrc(url);
  }, []);

  const reset = useCallback(() => {
    originalSrcRef.current = null;
    setOriginalSrc(null);
    setCropOpen(false);
    setPendingNewFile(false);
  }, []);

  return { originalSrc, cropOpen, isCropping, openFile, openRecrop, complete, cancel, seedOriginal, reset };
}
