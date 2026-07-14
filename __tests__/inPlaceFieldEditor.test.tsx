/**
 * #354 회귀 테스트 — 온티켓 인플레이스 편집 + 필드바.
 *
 * 검증 축:
 *  1. 탭 → 투명 인플레이스 input이 뜨고, 타이핑이 movieInfo에 반영된다(티켓이 텍스트를 렌더).
 *  2. prev/next 순회는 현재 무드 DOM에 실제 존재하는 필드(data-field-tap 앵커)만 돈다 —
 *     minimal은 bookingNo 미렌더(MOOD_EXCLUDED_FIELDS)라 순회에 안 나온다.
 *  3. 완료(체크) → 에디터 닫힘. 필드바 눈 토글 흐름은 mobileEditorShellFieldCoverage가 커버.
 *  4. 편집 중 ghost 강제 on(ghostEff = ghostOn || editing) — 셸 "빈 항목" 스위치가 꺼져 있어도
 *     편집에 들어가면 빈 필드 placeholder가 탭 타깃으로 남는다.
 *
 * happy-dom은 레이아웃이 없어 rect가 전부 0이지만, 측정 게이트는 "앵커 존재"라 오버레이가 뜬다
 * (위치 어서션은 하지 않는다 — 지오메트리는 브라우저 E2E 몫).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="movie-title">{photo.state.movieInfo.title}</div>
      <div data-testid="movie-theater">{photo.state.movieInfo.theater}</div>
      <div data-testid="vis-actors">{String(photo.state.fieldVisibility.actors)}</div>
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0' });
        }}
      >
        seed
      </button>
      <button type="button" onClick={() => photo.updateFieldVisibility({ actors: false })}>
        hide-actors
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('인플레이스 필드 에디터 (#354)', () => {
  test('필드 탭 → 인플레이스 input → 타이핑이 폼 상태에 반영', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    const input = await screen.findByRole('textbox', { name: '극장' });
    fireEvent.change(input, { target: { value: 'CGV 용산아이파크몰' } });
    expect(screen.getByTestId('movie-theater').textContent).toBe('CGV 용산아이파크몰');
  });

  test('prev/next 순회 — 현재 무드에 실제 렌더되는 필드만 돈다(minimal: bookingNo 제외)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // title에서 시작해 next로 전체 한 바퀴 — 도는 동안 bookingNo(예매 번호) input이 나오면 실패.
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });

    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
      // input 없는 필드(평점·날짜)도 필드바는 항상 있으므로 바의 존재로 순회를 관찰한다.
      const bar = screen.getByRole('toolbar', { name: '필드 편집 도구' });
      expect(bar).toBeTruthy();
      const input = screen.queryByRole('textbox');
      if (input) seen.push(input.getAttribute('aria-label') ?? '');
      if (screen.queryByRole('textbox', { name: '제목' })) break; // 한 바퀴 완료
    }
    expect(seen).not.toContain('예매 번호'); // minimal 미렌더 필드는 순회에 없다
    expect(seen).toContain('출연'); // 렌더되는 필드는 순회에 있다
    expect(screen.getByRole('textbox', { name: '제목' })).toBeTruthy(); // 순환 복귀
  });

  test('prev가 역방향으로 돈다 (제목 → 이전 = 마지막 렌더 필드)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });
    fireEvent.click(screen.getByRole('button', { name: '이전 항목' }));
    // 제목이 아닌 다른 필드로 이동했다(순환) — 정확한 타깃은 무드 구성에 따르므로 이탈만 확인.
    expect(screen.queryByRole('textbox', { name: '제목' })).toBeNull();
  });

  test('완료(체크) → 에디터 닫힘', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('textbox', { name: '극장' });
    fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
    expect(screen.queryByRole('textbox', { name: '극장' })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: '필드 편집 도구' })).toBeNull();
  });

  test('prev/next 순회 경유는 숨긴 필드 가시성을 켜지 않는다 (PR #359 리뷰 P1)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('hide-actors'));
    expect(screen.getByTestId('vis-actors').textContent).toBe('false');

    // title에서 next를 눌러 actors를 경유·통과해도 actors 가시성은 그대로 꺼져 있어야 한다.
    // (자동 표시 on은 FieldTap 직접 탭(handleField) 전용 — 순회는 순수 탐색.)
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    await screen.findByRole('textbox', { name: '제목' });
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
    }
    expect(screen.getByTestId('vis-actors').textContent).toBe('false');
  });

  test('편집 중 ghost 강제 on — "빈 항목" off여도 빈 필드 탭 타깃이 남는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // 셸 "빈 항목" 스위치 off (기본 on → 토글).
    fireEvent.click(await screen.findByRole('button', { name: '편집 메뉴' }));
    fireEvent.click(await screen.findByRole('switch', { name: '빈 항목 미리보기' }));
    // 메뉴 닫기(오버레이 탭).
    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // 편집 진입 전: 빈 필드(출연)는 placeholder가 없어 탭 타깃 없음.
    expect(screen.queryByRole('button', { name: '출연 편집' })).toBeNull();

    // 극장 편집 진입 → ghostEff 강제 on → 출연 탭 타깃 등장.
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('textbox', { name: '극장' });
    expect(await screen.findByRole('button', { name: '출연 편집' })).toBeTruthy();
  });
});
