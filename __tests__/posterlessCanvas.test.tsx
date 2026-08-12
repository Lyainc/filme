/**
 * #631 회귀 테스트 — 포스터 없이도 편집 캔버스가 선다(canvasReady).
 *
 * "포스터가 있다"(croppedImageUrl)와 "편집할 캔버스가 섰다"는 다른 명제다. 랜딩의
 * '포스터 없이 시작'이 후자만 세우고, 셸 크롬(완료·드로어 핸들·고급 설정·툴바)은 전자가
 * 아니라 후자를 따라야 한다. 아래 세 항목이 그 계약을 고정한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { Poster } from '@/components/moods/_shared';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('포스터 없이 시작 (#631)', () => {
  test("'포스터 없이 시작'이 포스터 없이 편집 크롬을 연다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 시작 상태 — 캔버스가 안 섰으므로 완료·드로어 핸들이 없다.
    expect(screen.queryByRole('button', { name: '완료' })).toBeNull();
    expect(screen.queryByRole('button', { name: '티켓 항목 목록 열기' })).toBeNull();

    await user.click(screen.getByTestId('landing-skip-poster'));

    expect(screen.getByRole('button', { name: '완료' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '티켓 항목 목록 열기' })).toBeTruthy();
  });

  // #674로 D2(a)의 **자리**가 바뀌었다. 랜딩 inline은 컨테이너가 flex-1이라 같은 flex-1인 티켓
  // 스테이지와 본문 높이를 반씩 나눠 가졌으므로(실측 393×659: 티켓 218.5×349.2 → 109.3×174.6),
  // 캔버스가 서면 랜딩은 숨고 포스터 재진입 동선은 헤더 메뉴 '포스터 추가'가 이어받는다.
  // 아래 두 테스트가 "숨었다"와 "그래서 어디로 가느냐"를 쌍으로 잠근다 — 하나만 두면 진입점이
  // 사라진 채로도 통과한다.
  test('캔버스가 서면 랜딩은 숨는다 — 스테이지와 본문을 나눠 갖지 않는다(#674)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('landing-skip-poster'));

    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('hidden')).toBe(true);
    // flex-1을 들고 흐름에 남으면 안 된다 — #674의 원인이 정확히 이 클래스 조합이었다.
    expect(landing.classList.contains('flex-1')).toBe(false);
  });

  test('포스터 재진입 동선은 헤더 메뉴로 옮겨 유지된다(D2 a → #674)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('landing-skip-poster'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('button', { name: '포스터 추가' })).toBeTruthy();
    // 재크롭은 포스터가 있어야 의미가 있으므로 이 상태엔 없다(죽은 컨트롤 금지).
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
  });

  test("'고급 설정'이 죽은 컨트롤이 아니다 — 툴바와 같은 조건(canvasReady)이라 모달이 실제로 열린다", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId('landing-skip-poster'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '고급 설정' }));

    expect(screen.getByRole('dialog', { name: '고급 설정' })).toBeTruthy();
  });
});

describe('Poster src=null — export 필터 계약 (#631)', () => {
  test('포스터가 없으면 data-poster-root를 안 달고 <img>도 안 그린다', () => {
    const html = renderToStaticMarkup(<Poster src={null} background="#101010" />);

    // captureToImage는 data-poster-root 서브트리를 html-to-image에서 제외하고 canvas로 재합성한다.
    // 재합성할 래스터가 없는데 속성이 붙으면 그 자리가 배경도 없는 구멍으로 남는다.
    expect(html).not.toContain('data-poster-root');
    // src=""는 문서 URL을 다시 받아와 decodeImage가 naturalWidth 0을 '깨진 이미지'로 보고
    // 캡처를 통째로 중단시킨다 — <img>를 아예 안 그리는 게 계약이다.
    expect(html).not.toContain('<img');
    expect(html).toContain('#101010');
  });

  test('포스터가 있으면 data-poster-root와 <img>가 그대로 붙는다(대조군)', () => {
    const html = renderToStaticMarkup(<Poster src="blob:test-poster" background="#101010" />);

    expect(html).toContain('data-poster-root="true"');
    expect(html).toContain('blob:test-poster');
  });
});
