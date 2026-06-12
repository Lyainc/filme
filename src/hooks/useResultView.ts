import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 완성 결과 뷰(데스크톱 rail 인플레이스 / 모바일 바텀시트)의 열림 상태.
 *
 * 열 때 history에 항목을 하나 push해서, 안드로이드 백버튼·브라우저 뒤로가기로
 * "결과만" 닫히고 편집 상태(폼·포스터·무드)는 같은 페이지에 그대로 보존되게 한다.
 * 결과는 별도 라우트/화면이 아니라 현재 편집 컨텍스트 위에 떠 있을 뿐이라,
 * 닫혀도 작업이 날아가지 않는다.
 */
export function useResultView() {
  const [open, setOpen] = useState(false);
  // 우리가 pushState로 쌓은 history 항목이 아직 살아있는지 추적해
  // 중복 push / 잘못된 back 호출을 막는다.
  const pushedRef = useRef(false);

  useEffect(() => {
    function onPopState() {
      // 우리 항목이 pop되면(뒤로가기) 결과만 닫는다.
      pushedRef.current = false;
      setOpen(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openView = useCallback(() => {
    setOpen(true);
    if (!pushedRef.current) {
      pushedRef.current = true;
      window.history.pushState({ phototicketResult: true }, '');
    }
  }, []);

  const closeView = useCallback(() => {
    if (pushedRef.current) {
      // history 항목을 pop → popstate 핸들러가 setOpen(false)까지 처리.
      window.history.back();
    } else {
      setOpen(false);
    }
  }, []);

  return { open, openView, closeView };
}
