import { useEffect, type RefObject } from 'react';
import { APP_BACKGROUND_ID } from '@/components/v2/PhoneFrame';

// 중첩 오버레이(예: 필드 드로어 위 로고 크롭 모달, #355 리뷰 P1) 카운트 — 안쪽 오버레이가
// 언마운트하며 바깥 lock까지 풀지 않도록, 첫 lock만 잠그고 마지막 unlock만 복원한다.
let lockCount = 0;
let savedScrollY = 0;

// 배경 inert 스택(#685) — 두 층으로 나눠 관리한다.
// 1. 스택 안 다이얼로그끼리: 최상위 하나만 남기고 나머지(예: 크롭 모달 밑 드로어)는 inert.
// 2. "앱 배경"(APP_BACKGROUND_ID, 헤더·본문·dock·툴바) 전체: 스택이 비어있지 않으면 통째로 inert.
// 앱 배경 밖(OcrUndoBanner·에러 토스트·ErrorToastHost)은 일부러 안 건드린다 — z-60/70이 다이얼로그
// 위에 계속 보이는 계약이라 안내·해제 기능이 다이얼로그 열림과 무관하게 살아있어야 한다. DOM
// 조상 경로를 걸어 올라가며 형제를 지우는 방식은 그 토스트 레이어까지 같이 삼켜(#685 fresh-eyes
// 리뷰 지적) 폐기했다 — 대신 앱 배경을 고정 id 하나로 직접 지목한다(DOM 깊이·포털 대상 무관).
const dialogStack: HTMLElement[] = [];
let inertedEls: HTMLElement[] = [];

function recomputeInert() {
  inertedEls.forEach((el) => {
    el.inert = false;
  });
  inertedEls = [];
  if (dialogStack.length === 0) return;
  dialogStack.slice(0, -1).forEach((el) => {
    el.inert = true;
    inertedEls.push(el);
  });
  const bg = document.getElementById(APP_BACKGROUND_ID);
  if (bg) {
    bg.inert = true;
    inertedEls.push(bg);
  }
}

/** 테스트 전용 — 모듈 싱글턴이라 프로세스(=bun test 전체 실행) 내내 남는다. unmount cleanup을
 *  안 거치고 죽는 테스트(assert가 act() 안에서 던지는 경우 등)가 있으면 dialogStack에 잔여
 *  엘리먼트가 남아 뒤 테스트의 inert 판정이 조용히 틀어진다(errorToast.tsx의 resetErrorToastForTest
 *  와 같은 클래스, #611) — __tests__/setup/happydom.ts의 전역 afterEach가 매 테스트 뒤 이걸 부른다. */
export function resetDialogInertForTest(): void {
  inertedEls.forEach((el) => {
    el.inert = false;
  });
  inertedEls = [];
  dialogStack.length = 0;
}

/**
 * `locked`인 동안 body 스크롤을 잠근다.
 * iOS Safari는 overflow:hidden만으로는 안 막혀서 position:fixed로 고정하고,
 * 해제 시 원래 스크롤 위치로 복원한다. (모달·라이트박스 공용, 중첩 안전)
 *
 * `dialogRef`를 같이 넘기면 앱 배경 전체와(그 다이얼로그가 최상위가 아니면) 자기 자신까지
 * `inert`를 건다(#685) — `aria-modal`·포커스 트랩만으론 스크린리더 가상 커서가 배경을 읽는 걸
 * 못 막는다. 토스트/에러 레이어는 앱 배경 밖이라 안 걸린다(recomputeInert 주석 참고).
 */
export function useBodyScrollLock(locked: boolean, dialogRef?: RefObject<HTMLElement | null>) {
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

    const el = dialogRef?.current ?? null;
    if (el) {
      dialogStack.push(el);
      recomputeInert();
    }

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, savedScrollY);
      }
      if (el) {
        const idx = dialogStack.indexOf(el);
        if (idx !== -1) dialogStack.splice(idx, 1);
        recomputeInert();
      }
    };
  }, [locked, dialogRef]);
}
