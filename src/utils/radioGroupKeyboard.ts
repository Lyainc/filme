import type { KeyboardEvent } from 'react';

/**
 * APG Radio Group 키보드 계약(#730 c3) — ColorPicker·TexturePicker·LayoutPicker(LayoutStrip)
 * 셋이 공유한다. 컨테이너(role="radiogroup")의 onKeyDown에 그대로 연결하면 방향키가
 * [role="radio"] 자식 사이로 포커스+선택을 같이 옮긴다(APG 관례 — 이동이 곧 선택). 실제
 * onChange 호출은 각 항목이 이미 가진 onClick을 .click() 디스패치로 재사용하므로 셋 다
 * 선택 로직을 다시 쓰지 않는다.
 */
export function handleRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;

  const radios = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'),
  );
  if (radios.length === 0) return;
  e.preventDefault();

  const current = radios.indexOf(document.activeElement as HTMLElement);
  let next: number;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = radios.length - 1;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % radios.length;
  else next = current < 0 ? 0 : (current - 1 + radios.length) % radios.length;

  radios[next].focus();
  radios[next].click();
}
