import { useEffect } from 'react';

// 중첩 오버레이(예: 필드 드로어 위 로고 크롭 모달, #355 리뷰 P1) 카운트 — 안쪽 오버레이가
// 언마운트하며 바깥 lock까지 풀지 않도록, 첫 lock만 잠그고 마지막 unlock만 복원한다.
let lockCount = 0;
let savedScrollY = 0;

/**
 * `locked`인 동안 body 스크롤을 잠근다.
 * iOS Safari는 overflow:hidden만으로는 안 막혀서 position:fixed로 고정하고,
 * 해제 시 원래 스크롤 위치로 복원한다. (모달·라이트박스 공용, 중첩 안전)
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [locked]);
}
