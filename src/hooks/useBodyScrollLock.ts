import { useEffect, type RefObject } from 'react';

// 중첩 오버레이(예: 필드 드로어 위 로고 크롭 모달, #355 리뷰 P1) 카운트 — 안쪽 오버레이가
// 언마운트하며 바깥 lock까지 풀지 않도록, 첫 lock만 잠그고 마지막 unlock만 복원한다.
let lockCount = 0;
let savedScrollY = 0;

// 배경 inert 스택(#685) — 스크린리더 가상 커서(VoiceOver·TalkBack 스와이프 탐색)는 포커스
// 트랩을 안 타므로 별도로 막아야 한다. 세 다이얼로그(ImageCropModal·AdvancedSettingsModal·
// FieldDrawer)는 DOM 깊이도 포털 대상도 서로 다르므로(크롭 모달은 #phone-frame에 포털, 나머지
// 둘은 그 안 어딘가에 인라인) "부모의 형제"가 아니라 "루트까지 경로 위 형제 전부"를 inert 대상으로
// 삼는다 — 그러면 중첩(드로어 위 크롭 모달)에서 드로어가 크롭 모달의 조상 트리에 얹혀 있든 아니든
// 자동으로 걸린다: 크롭 모달이 열리면 그 경로 밖 전부(드로어를 감싼 트리 포함)가 inert되고,
// 닫히면 스택 최상위(드로어) 기준으로 다시 계산해 드로어만 풀린다.
const dialogStack: HTMLElement[] = [];
let inertedEls: HTMLElement[] = [];

function recomputeInert() {
  inertedEls.forEach((el) => {
    el.inert = false;
  });
  inertedEls = [];
  const top = dialogStack[dialogStack.length - 1];
  if (!top) return;
  let node: HTMLElement | null = top;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    Array.from(parent.children).forEach((sib) => {
      if (sib instanceof HTMLElement && sib !== node) {
        sib.inert = true;
        inertedEls.push(sib);
      }
    });
    node = parent;
  }
}

/**
 * `locked`인 동안 body 스크롤을 잠근다.
 * iOS Safari는 overflow:hidden만으로는 안 막혀서 position:fixed로 고정하고,
 * 해제 시 원래 스크롤 위치로 복원한다. (모달·라이트박스 공용, 중첩 안전)
 *
 * `dialogRef`를 같이 넘기면 그 엘리먼트만 남기고 나머지 전부에 `inert`를 건다(#685) —
 * `aria-modal`·포커스 트랩만으론 스크린리더 가상 커서가 배경을 읽는 걸 못 막는다. 중첩 시
 * 최상위 하나만 상호작용 가능하고 나머지(바깥 다이얼로그 포함)는 자동으로 inert된다.
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
