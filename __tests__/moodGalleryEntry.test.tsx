/**
 * 무드 갤러리(#615) 회귀 테스트 — Landing이 쓰던 LayoutStrip 무드칩이 auto-scroll 갤러리로
 * 바뀌면서 생긴 두 계약을 고정한다.
 *
 *  - 샘플 클릭 = 다섯 번째 커밋 지점. 무드칩처럼 미리보기만 하는 중간 단계 없이, 클릭한 무드가
 *    그 자리에서 posterless 상태(#631 경로)로 커밋되고 편집 화면에 들어간다 — 기존 CTA 3종
 *    (포스터부터 올리기·영화 검색해서 가져오기·직접 입력)과 별개 진입점이다.
 *  - `prefers-reduced-motion`에서는 auto-scroll 트랙(리스트 2벌 복제) 대신 6종이 줄바꿈 그리드로
 *    한 번씩만 정지 노출된다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { PhototicketState } from '@/types';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');
const gallery = () => within(landing()).getByRole('group', { name: '무드 선택' });

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('무드 갤러리 샘플 클릭 = 다섯 번째 커밋 지점 (#615)', () => {
  test('클릭한 무드가 즉시 실제 state에 커밋된다(CTA를 거치지 않는다)', () => {
    render(<Harness />);
    expect(captured.components.layout).toBe('minimal');

    fireEvent.click(within(gallery()).getByRole('button', { name: 'Criterion' }));

    expect(captured.components.layout).toBe('criterion');
  });

  test('클릭이 포스터 없이(#631) 편집 화면을 바로 연다', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: '완료' })).toBeNull();
    expect(captured.croppedImageUrl).toBeNull();

    fireEvent.click(within(gallery()).getByRole('button', { name: 'Criterion' }));

    expect(screen.getByRole('button', { name: '완료' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '티켓 항목 목록 열기' })).toBeTruthy();
    expect(captured.croppedImageUrl).toBeNull(); // 포스터는 여전히 없다 — posterless 진입.
    // 랜딩은 inline으로 남아 포스터를 나중에 추가할 진입점이 유지된다(#631 D2 (a)와 같은 계약).
    expect(landing().classList.contains('hidden')).toBe(false);
    expect(landing().classList.contains('fixed')).toBe(false);
  });
});

describe('prefers-reduced-motion 정지 폴백 (#615)', () => {
  function setPrefersReducedMotion(value: 'reduce' | 'no-preference') {
    (
      window as unknown as { happyDOM: { settings: { device: { prefersReducedMotion: string } } } }
    ).happyDOM.settings.device.prefersReducedMotion = value;
  }

  afterEach(() => {
    setPrefersReducedMotion('no-preference');
  });

  test('reduce에서는 marquee 트랙 없이 6종이 줄바꿈 그리드로 한 번만 그려진다', () => {
    setPrefersReducedMotion('reduce');
    render(<Harness />);

    const g = gallery();
    expect(g.querySelector('.animate-marquee')).toBeNull();
    // 정지 그리드는 리스트를 복제하지 않는다 — marquee의 seamless loop용 12칸이 아니라 6칸.
    expect(within(g).getAllByRole('button').length).toBe(6);

    // 클릭은 reduce에서도 그대로 다섯 번째 커밋 지점으로 동작한다.
    fireEvent.click(within(g).getByRole('button', { name: 'Stub' }));
    expect(captured.components.layout).toBe('stub');
  });

  test('no-preference(기본값)에서는 marquee 트랙 + 복제 리스트로 돌아온다(대조군)', () => {
    setPrefersReducedMotion('no-preference');
    render(<Harness />);

    const g = gallery();
    expect(g.querySelector('.animate-marquee')).not.toBeNull();
    // DOM엔 seamless loop용 사본까지 12개가 있지만, 사본은 aria-hidden이라 접근 가능한 버튼은 6개뿐.
    expect(g.querySelectorAll('button').length).toBe(12);
    expect(within(g).getAllByRole('button').length).toBe(6);
  });
});
