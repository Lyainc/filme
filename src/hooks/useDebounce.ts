import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number, immediate = false): T {
  const [debounced, setDebounced] = useState<T>(value);
  const [wasImmediate, setWasImmediate] = useState(immediate);

  // 직접 편집 중엔 값을 그대로 넘기고, 편집이 끝나는 렌더에서 마지막 입력을 넘겨받는다(#775) —
  // 안 넘겨받으면 닫는 순간 편집 전 값으로 돌아갔다가 delay 뒤에 되돌아온다. 전환 시점에만 동기화해서
  // 키 입력마다 렌더 중 setState로 부모 렌더를 두 번 돌리지 않는다.
  if (wasImmediate !== immediate) {
    setWasImmediate(immediate);
    if (!immediate) setDebounced(value);
  }

  useEffect(() => {
    if (immediate) return;
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, immediate]);

  return immediate ? value : debounced;
}
