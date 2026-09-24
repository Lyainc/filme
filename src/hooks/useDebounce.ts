import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number, immediate = false): T {
  const [debounced, setDebounced] = useState<T>(value);

  // 직접 편집은 같은 렌더에서 반영하고, 닫힌 뒤에도 마지막 입력을 유지한다(#775).
  if (immediate && debounced !== value) setDebounced(value);

  useEffect(() => {
    if (immediate) return;
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay, immediate]);

  return immediate ? value : debounced;
}
