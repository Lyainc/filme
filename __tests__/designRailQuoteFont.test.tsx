/**
 * #558 — 디자인 레일 '커스텀' 항목의 한줄평 폰트 4택 상호작용 테스트.
 *
 * 레일 피커와 Criterion 렌더를 **같은 photo 상태**에 물려, 칩을 실제로 눌렀을 때 티켓의 한줄평
 * fontFamily가 그 폰트로 바뀌는지를 끝까지 본다(피커 state만 보면 배선이 끊겨도 통과한다).
 * TicketRenderer는 ResizeObserver 스케일 래퍼라 여기선 안 태우고 무드를 직접 렌더한다 —
 * 검증 대상이 폰트 배선이라 스케일 래퍼는 노이즈다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodCriterion } from '@/components/moods/MoodCriterion';

// rating 0 + quote 미입력이면 MoodCriterion이 떨어뜨리는 기본 문구(항상 영문이라 세리프가 산다).
const DEFAULT_QUOTE = 'the paying customer is the last honest critic';
const KR_QUOTE = '인생 영화였다';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'criterion' })}>
        criterion으로 전환
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'minimal' })}>
        minimal로 전환
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ quote: KR_QUOTE })}>
        한글 한줄평 입력
      </button>
      <div data-testid="quote-font">{photo.state.components.quoteFont ?? '(미설정)'}</div>
      <DesignRail photo={photo} />
      <MoodCriterion
        movieInfo={photo.state.movieInfo}
        components={photo.state.components}
        croppedImageUrl="blob:x"
      />
    </>
  );
}

/** 티켓에 실제로 그려진 한줄평 엘리먼트의 inline fontFamily. */
function renderedQuoteFont(text: string) {
  return (screen.getByText(text) as HTMLElement).style.fontFamily;
}

async function openCustomPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
  await user.click(screen.getByRole('button', { name: '커스텀' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 커스텀 — 한줄평 폰트 4택 (#558)', () => {
  test('커스텀 항목은 Criterion에서만 레일에 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드는 minimal — appliesTo(['criterion'])에서 탈락.
    expect(screen.queryByRole('button', { name: '커스텀' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    expect(screen.getByRole('button', { name: '커스텀' })).not.toBeNull();
  });

  test('4택 각각이 티켓 한줄평의 fontFamily로 반영된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    // 기본값 auto + 영문 기본 문구 → 자동분기가 FONT_DISPLAY(세리프 이탤릭)를 고른다.
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('--font-display');

    await user.click(screen.getByRole('radio', { name: '손글씨' }));
    expect(screen.getByTestId('quote-font').textContent).toBe('hand');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('--font-quote-kr');

    await user.click(screen.getByRole('radio', { name: '고딕' }));
    expect(screen.getByTestId('quote-font').textContent).toBe('gothic');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('Pretendard');

    await user.click(screen.getByRole('radio', { name: '세리프' }));
    expect(screen.getByTestId('quote-font').textContent).toBe('serif');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('--font-display');

    // 되돌리면 자동분기로 복귀 — 기본값이 픽셀을 안 바꾼다는 c3의 UI 쪽 확인.
    await user.click(screen.getByRole('radio', { name: '자동' }));
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('--font-display');
  });

  test('한글 한줄평이면 세리프 칩은 숨김이 아니라 disabled + 사유 문구', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    const serif = () => screen.getByRole('radio', { name: '세리프' }) as HTMLButtonElement;
    expect(serif().disabled).toBe(false);
    expect(screen.queryByText(/세리프는 한글 글리프가 없어/)).toBeNull();

    await user.click(screen.getByRole('button', { name: '한글 한줄평 입력' }));

    // 칩은 자리에 남아 있고(숨김 아님) 눌리지만 않는다 + 사유 문구가 뜬다.
    expect(serif()).not.toBeNull();
    expect(serif().disabled).toBe(true);
    expect(screen.queryByText(/세리프는 한글 글리프가 없어/)).not.toBeNull();

    // 나머지 3택은 그대로 살아 있고, 한글에서도 렌더까지 이어진다.
    await user.click(screen.getByRole('radio', { name: '고딕' }));
    expect(renderedQuoteFont(KR_QUOTE)).toContain('Pretendard');
  });

  test('세리프를 고른 뒤 한글을 입력하면 손글씨로 되돌려 글리프 깨짐을 막는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    await user.click(screen.getByRole('radio', { name: '세리프' }));
    await user.click(screen.getByRole('button', { name: '한글 한줄평 입력' }));

    // 저장값은 'serif'로 남지만(칩 disabled는 새로 고르는 것만 막는다) 렌더는 손글씨로 떨어진다.
    expect(screen.getByTestId('quote-font').textContent).toBe('serif');
    expect(renderedQuoteFont(KR_QUOTE)).toContain('--font-quote-kr');
  });

  test('무드를 왕복해도 고른 폰트가 보존된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    await user.click(screen.getByRole('radio', { name: '고딕' }));
    // 다른 무드로 나가면 커스텀 항목 자체가 사라진다(#523 자동 닫힘).
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.queryByRole('button', { name: '커스텀' })).toBeNull();
    expect(screen.getByTestId('quote-font').textContent).toBe('gothic');

    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    await user.click(screen.getByRole('button', { name: '커스텀' }));
    expect((screen.getByRole('radio', { name: '고딕' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect(renderedQuoteFont(DEFAULT_QUOTE)).toContain('Pretendard');
  });
});
