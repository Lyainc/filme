import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabBarItem<K extends string> {
  key: K;
  label: string;
  /** 탭 라벨 옆에 붙는 표시(필수 누락 점 등). 접근명에는 sr-only 문구를 함께 넣을 것. */
  badge?: ReactNode;
}

/**
 * APG tabs 한 벌(#826 S2) — 도크 모드 바(사진 · 정보 · 디자인)와 디자인 도구 줄이 같은 키보드 계약을 쓴다:
 * 선택된 탭만 tabIndex 0(roving), 좌우 화살표·Home·End가 이웃 탭으로 포커스를 옮기며 바로 선택한다
 * (본문 교체가 가벼워 자동 활성). 탭 id는 `${idPrefix}-tab-${key}`, 패널은 `panelId`로 연결한다.
 */
export function TabBar<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  panelId,
  className,
  style,
  tabClassName,
}: {
  items: readonly TabBarItem<K>[];
  value: K;
  onChange: (next: K) => void;
  ariaLabel: string;
  idPrefix: string;
  panelId: string;
  className?: string;
  style?: CSSProperties;
  /** 탭 하나의 클래스. selected를 받아 선택 표시를 바꾼다. */
  tabClassName: (selected: boolean) => string;
}) {
  const refs = useRef(new Map<K, HTMLButtonElement>());

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex((it) => it.key === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = items[next];
    onChange(target.key);
    refs.current.get(target.key)?.focus();
  };

  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className={className} style={style}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <button
            key={it.key}
            ref={(el) => {
              if (el) refs.current.set(it.key, el);
              else refs.current.delete(it.key);
            }}
            id={`${idPrefix}-tab-${it.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(it.key)}
            className={cn(tabClassName(selected))}
          >
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}
