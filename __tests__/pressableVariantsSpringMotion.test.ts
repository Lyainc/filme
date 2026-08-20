import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pressableVariants } from '@/components/ui/variants';

// #731 — pressableVariants의 cta variant에 스프링 눌림(kinetics Push Button 값)을 얹었다.
// 회귀 잠금 둘: ① 값 자체(60ms 눌림 / 200ms+스프링 정착), ② base엔 transition-property를
// 안 넣는다는 설계(변경하면 twMerge가 다른 소비처의 transition-colors를 조용히 지운다,
// variants.ts 주석 참고)가 다시 깨지지 않는지.
describe('#731 — pressableVariants 스프링 눌림', () => {
  test('cta variant는 눌림 60ms / 정착 200ms+스프링 easing을 갖는다', () => {
    const cta = pressableVariants({ transition: 'cta' });
    expect(cta).toContain('active:duration-[60ms]');
    expect(cta).toContain('duration-200');
    expect(cta).toContain('ease-[cubic-bezier(0.34,1.56,0.64,1)]');
  });

  test('base는 여전히 transition-property를 안 갖는다(다른 소비처의 transition-colors와 충돌 방지)', () => {
    const base = pressableVariants();
    expect(base).toBe('active:scale-[0.97]');
  });
});

describe('#731 — 전역 prefers-reduced-motion 가드가 새 모션도 죽인다', () => {
  test('globals.css 가드가 모든 요소의 transition-duration을 강제로 0으로 만든다', () => {
    const css = readFileSync(
      join(__dirname, '..', 'src', 'styles', 'globals.css'),
      'utf8',
    );
    const guardMatch = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{([^}]*)\}/,
    );
    expect(guardMatch).not.toBeNull();
    const body = guardMatch![1];
    expect(body).toContain('transition-duration: 0.01ms !important');
  });
});
