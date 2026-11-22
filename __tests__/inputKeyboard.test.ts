/**
 * #826 S4 — 키보드 높이 · 입력 중 배율 · 리프트 순수 함수(Seed docs/specs/826-s4-input-keyboard.yaml acceptance-3 · 4).
 * DOM 없이 숫자만 넣는다 — 측정은 hooks/useInputKeyboard.ts가 하고, 지오메트리 실측은 헤드리스 표본(acceptance-10)이 잰다.
 */
import { describe, expect, test } from 'bun:test';
import { EDIT_SCALE_MAX, editLift, editScale, keyboardInset } from '@/utils/inputKeyboard';

describe('keyboardInset — 프레임 바닥 − (visualViewport.offsetTop + height), 0 미만은 0 (acceptance-3)', () => {
  test('(a) 키보드 없음 — 보이는 영역 바닥이 프레임 바닥과 같으면 0', () => {
    expect(keyboardInset(852, { offsetTop: 0, height: 852 })).toBe(0);
  });
  test('(b) 키보드가 보이는 영역을 줄이면 그 차가 키보드 높이다', () => {
    expect(keyboardInset(852, { offsetTop: 0, height: 522 })).toBe(330);
  });
  test('(c) iOS가 레이아웃 뷰포트를 밀어 offsetTop > 0이면 그만큼 빼고 잰다', () => {
    expect(keyboardInset(852, { offsetTop: 120, height: 402 })).toBe(330);
  });
  test('(d) 프레임 바닥이 창 바닥보다 위(데스크톱 400 프레임)면 음수가 아니라 0이다', () => {
    expect(keyboardInset(675, { offsetTop: 0, height: 900 })).toBe(0);
  });
  test('(e) visualViewport가 없으면 키보드 0이다', () => {
    expect(keyboardInset(852, null)).toBe(0);
    expect(keyboardInset(852, undefined)).toBe(0);
  });
});

describe('editScale — min(1.18, 무대 폭 ÷ 맞춤 폭) (acceptance-4, D17-1 A)', () => {
  const PORTRAIT = 960 / 1534;
  const LANDSCAPE = 1534 / 960;
  test('세로 무드는 높이가 먼저 차 맞춤 폭이 좁으니 상한 1.18이다', () => {
    expect(editScale(368, 350, PORTRAIT)).toBe(EDIT_SCALE_MAX);
  });
  test('가로 무드는 맞춤 폭 = 무대 폭이라 정확히 1이다(프레임 밖으로 안 나간다)', () => {
    expect(editScale(368, 350, LANDSCAPE)).toBe(1);
    expect(editScale(361.4, 500.2, LANDSCAPE)).toBe(1);
  });
  test('무대 여유가 18%보다 작으면 그 비율까지만 키운다', () => {
    const s = editScale(361, 520, PORTRAIT);
    expect(s > 1 && s < EDIT_SCALE_MAX).toBe(true);
    expect(Math.min(361, 520 * PORTRAIT) * s).toBeCloseTo(361, 6);
  });
  test('무대를 못 쟀으면(0) 키우지 않는다', () => {
    expect(editScale(0, 0, PORTRAIT)).toBe(1);
  });
});

describe('editLift — 고른 필드 아래 끝이 패널 윗변 30px 위, 위로만 (acceptance-4)', () => {
  test('필드가 패널 근처 아래면 확대 뒤 아래 끝이 패널 윗변 − 30에 오도록 올린다', () => {
    // 래퍼 윗변 100, 필드 아래 끝(로컬) 300 × 1.18 = 354 → 454. 패널 윗변 462 → 목표 432, 22 올린다.
    expect(editLift(100, 300, 1.18, 462)).toBe(-22);
  });
  test('이미 충분히 위에 있으면 0 — 티켓을 맞춤 위치보다 아래로 내리지 않는다', () => {
    expect(editLift(100, 50, 1.18, 462)).toBe(0);
  });
});
