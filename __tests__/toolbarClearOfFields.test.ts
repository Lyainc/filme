/**
 * #777 — 세로·고정 툴바는 티켓 필드 탭 대상과 겹칠 때만 그 아래로 내린다. happy-dom은 레이아웃이 없어
 * rect를 스텁한다.
 */
import { describe, expect, test } from 'bun:test';
import { clearOfFields } from '@/components/v2/FloatingToolbar';

type R = { left: number; right: number; top: number; bottom: number; width: number; height: number };
const rect = (left: number, top: number, width: number, height: number): R => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const el = (r: R, fields: R[] = []) =>
  ({
    getBoundingClientRect: () => r,
    querySelectorAll: () => fields.map((f) => el(f)),
  }) as unknown as HTMLElement;

const toolbar = el(rect(14, 0, 42, 180)); // 393×852 실측 폭·높이
const ticket = (fields: R[]) => el(rect(16, 100, 361, 577), fields);

describe('clearOfFields (#777)', () => {
  test('겹치는 필드가 없으면 기본 자리', () => {
    expect(clearOfFields(68, toolbar, ticket([rect(200, 120, 50, 20)]))).toBe(68);
  });

  test('겹치면 그 필드 아래(+10)로, 연쇄로 겹치면 다시 그 아래로', () => {
    // title(120~139) → 149로 내리면 chain(300~320)과 겹쳐 330으로.
    expect(clearOfFields(68, toolbar, ticket([rect(40, 120, 73, 19), rect(40, 300, 45, 20)]))).toBe(330);
  });

  test('티켓 아래까지 빈자리가 없으면 기본 자리로 돌아간다', () => {
    // 149로 내리면 긴 필드(300~600)와 겹치고, 그 아래 610 + 180은 티켓 바닥(677)을 넘는다.
    expect(clearOfFields(68, toolbar, ticket([rect(40, 120, 73, 19), rect(40, 300, 45, 300)]))).toBe(68);
  });

  test('폭이 0인 필드(숨김)는 무시한다', () => {
    expect(clearOfFields(68, toolbar, ticket([rect(40, 120, 0, 19)]))).toBe(68);
  });
});
