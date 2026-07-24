/**
 * #496 — RatingPicker 별점 포인터/터치 드래그 + 롱터치 소수 입력 회귀.
 *
 * happy-dom의 getBoundingClientRect는 항상 {0,0,0,0}이라(floatingToolbar.test.tsx 선례와 동일 제약)
 * Element.prototype을 스텁으로 오버라이드해 별점 줄(radiogroup)의 실측 폭을 흉내낸다. 롱터치 타이밍은
 * jest 가짜 타이머로 발화시킨다. 드래그 커밋 저빈도화(#507 패턴)는 sliderDragThrottle.test.tsx와
 * 동일하게 "여러 틱을 한 act() 블록에 몰아 한 프레임 도착을 흉내"내 검증한다.
 */
import { describe, expect, test, mock, afterEach, beforeEach, jest } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import RatingPicker, { ratingFromRowOffset } from '@/components/wizard/RatingPicker';

const ROW_WIDTH = 250; // 5개 별 × 반개 2개 = 10구간 × 25px

function Harness({ initial = 0 }: { initial?: number }) {
  const [rating, setRating] = useState(initial);
  return <RatingPicker value={rating} onValueChange={setRating} visible={true} onVisibleChange={() => {}} />;
}

const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;

function stubRect(): DOMRect {
  return {
    left: 0, right: ROW_WIDTH, width: ROW_WIDTH, top: 0, bottom: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.getAttribute('role') === 'radiogroup' ? stubRect() : nativeGetBoundingClientRect.call(this);
  };
});
afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
});

function down(row: HTMLElement, clientX: number) {
  fireEvent.pointerDown(row, { pointerId: 1, clientX, clientY: 0, pointerType: 'touch' });
}
function move(row: HTMLElement, clientX: number) {
  fireEvent.pointerMove(row, { pointerId: 1, clientX, clientY: 0, pointerType: 'touch' });
}
function up(row: HTMLElement, clientX: number) {
  fireEvent.pointerUp(row, { pointerId: 1, clientX, clientY: 0, pointerType: 'touch' });
}

describe('ratingFromRowOffset 순수 함수 (#496)', () => {
  test('폭 0이면 항상 0', () => {
    expect(ratingFromRowOffset(50, 0)).toBe(0);
  });
  test('음수 offset은 0으로 클램프 → 첫 반개(0.5)', () => {
    expect(ratingFromRowOffset(-10, 250)).toBe(0.5);
  });
  test('폭을 넘는 offset은 마지막 구간(5.0)으로 클램프', () => {
    expect(ratingFromRowOffset(9999, 250)).toBe(5);
  });
  test('구간별 offset이 대응하는 반개 단위로 떨어진다', () => {
    expect(ratingFromRowOffset(10, 250)).toBe(0.5); // 0~25
    expect(ratingFromRowOffset(110, 250)).toBe(2.5); // 100~125
    expect(ratingFromRowOffset(240, 250)).toBe(5); // 225~250
  });
});

describe('별 포인터/터치 드래그 선택 (#496)', () => {
  test('여러 프레임에 걸친 드래그 — 지나온 구간마다 커밋되고 최종값은 놓은 지점', () => {
    const onValueChange = mock((_next: number) => {});
    render(<RatingPicker value={0} onValueChange={onValueChange} visible={true} onVisibleChange={() => {}} />);
    const row = screen.getByRole('radiogroup', { name: '별점' });

    down(row, 10); // 0.5
    move(row, 110); // 2.5 — 별도 프레임(각 fireEvent가 자체 act)이라 개별 커밋
    move(row, 240); // 5.0
    up(row, 240);

    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual([0.5, 2.5, 5]);
  });

  test('한 배치 안의 연속 틱은 다운스트림 커밋 1회로 합쳐진다(#507 패턴)', () => {
    const onValueChange = mock((_next: number) => {});
    render(<RatingPicker value={0} onValueChange={onValueChange} visible={true} onVisibleChange={() => {}} />);
    const row = screen.getByRole('radiogroup', { name: '별점' });

    act(() => {
      down(row, 10);
      move(row, 60);
      move(row, 110);
      move(row, 240);
      up(row, 240);
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(5);
  });

  test('드래그 중 캡션은 커밋 전에도 눌린 지점을 즉시 반영한다', () => {
    render(<Harness />);
    const row = screen.getByRole('radiogroup', { name: '별점' });

    down(row, 110);
    expect(screen.getByText('2.5')).toBeTruthy();
    up(row, 110);
  });
});

describe('별 롱터치 → 소수 입력 펼침(모바일 경로, #496)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('움직임 없이 500ms 누르면 소수 입력이 펼쳐진다', () => {
    render(<Harness />);
    const row = screen.getByRole('radiogroup', { name: '별점' });
    expect(screen.queryByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' })).toBeNull();

    act(() => down(row, 110));
    act(() => jest.advanceTimersByTime(500));

    expect(screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' })).toBeTruthy();
  });

  test('임계값 이상 움직이면 드래그로 판정돼 롱터치 타이머가 취소된다', () => {
    render(<Harness />);
    const row = screen.getByRole('radiogroup', { name: '별점' });

    act(() => {
      down(row, 10);
      move(row, 40); // dx=30 > DRAG_MOVE_THRESHOLD(8)
    });
    act(() => jest.advanceTimersByTime(500));

    expect(screen.queryByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' })).toBeNull();
  });

  test('타이머가 뜨기 전에 손을 떼면(짧은 탭) 소수 입력이 안 열린다', () => {
    render(<Harness />);
    const row = screen.getByRole('radiogroup', { name: '별점' });

    act(() => {
      down(row, 110);
      up(row, 110);
    });
    act(() => jest.advanceTimersByTime(500));

    expect(screen.queryByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' })).toBeNull();
  });
});

describe('캡션 토글 — 데스크톱/키보드/스크린리더 대체 경로 (#496)', () => {
  test('캡션 버튼을 누르면 소수 입력이 펼쳐지고 다시 누르면 접힌다', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: '평점 소수 입력 토글' });

    expect(screen.queryByRole('spinbutton')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
