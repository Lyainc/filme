/**
 * `cn()`의 커스텀 font-size 그룹 회귀 (#647 / PR #664 리뷰 P1).
 *
 * tailwind.config.js의 커스텀 스케일(text-display/title/body/caption/micro)은 기본 tailwind-merge가
 * 모르는 이름이라, 등록하지 않으면 `text-` 접두어만 보고 text-color 그룹으로 오인해 색상 클래스가
 * 폰트 크기 클래스를 지운다 — `cn('text-title', 'text-fg')`가 `text-fg`만 남기는 식이다.
 * text-title=16px는 #274(iOS Safari 자동 줌인 방지) 하한이라 조용히 사라지면 실제 버그가 된다.
 * cn.ts의 extendTailwindMerge 등록이 빠지거나 스케일 이름이 늘 때 여기서 걸린다.
 */
import { describe, expect, test } from 'bun:test';
import { cn } from '@/utils/cn';

const SCALE = ['text-display', 'text-title', 'text-body', 'text-caption', 'text-micro'] as const;

describe('cn — 커스텀 font-size가 text-color에 먹히지 않는다', () => {
  test('스케일 5종 각각이 색상 클래스와 공존한다', () => {
    for (const size of SCALE) {
      const out = cn(size, 'text-fg');
      expect(out.split(' ')).toContain(size);
      expect(out.split(' ')).toContain('text-fg');
    }
  });

  test('선언 순서가 반대여도 같다', () => {
    expect(cn('text-fg', 'text-title').split(' ')).toContain('text-title');
  });

  test('같은 그룹끼리는 여전히 뒤가 이긴다(그룹 등록이 병합 자체를 끄지 않는다)', () => {
    expect(cn('text-title', 'text-caption')).toBe('text-caption');
    expect(cn('text-fg', 'text-fg-muted')).toBe('text-fg-muted');
  });
});
