import { useEffect } from 'react';

/**
 * `locked`인 동안 body 스크롤을 잠근다.
 * iOS Safari는 overflow:hidden만으로는 안 막혀서 position:fixed로 고정하고,
 * 해제 시 원래 스크롤 위치로 복원한다. (모달·라이트박스 공용)
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
