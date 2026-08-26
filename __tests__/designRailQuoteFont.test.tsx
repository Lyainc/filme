/**
 * #558 4택 → #437 9택 — 디자인 레일 '커스텀' 항목의 한줄평 폰트 상호작용 테스트.
 *
 * 레일 피커와 Criterion 렌더를 **같은 photo 상태**에 물려, 칩을 실제로 눌렀을 때 티켓의 한줄평
 * fontFamily가 그 폰트로 바뀌는지를 끝까지 본다(피커 state만 보면 배선이 끊겨도 통과한다).
 * TicketRenderer는 ResizeObserver 스케일 래퍼라 여기선 안 태우고 무드를 직접 렌더한다 —
 * 검증 대상이 폰트 배선이라 스케일 래퍼는 노이즈다.
 *
 * 9택이 되면서 축이 하나 늘었다: 폰트마다 체감 크기가 달라 fontSize에 실측 배율이 곱해지므로
 * (#437), fontFamily만 보면 보정이 통째로 빠져도 통과한다 — 둘을 같이 본다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodCriterion } from '@/components/moods/MoodCriterion';
import {
  ALL_FONT_LABELS,
  AUTO_HANGUL_FAMILY,
  AUTO_LATIN_FAMILY,
  FONT_CHIPS,
  expectedFontSize,
} from './userTextFontOptions';

// rating 0 + quote 미입력이면 MoodCriterion이 떨어뜨리는 기본 문구(항상 영문이라 라틴 축이다).
const DEFAULT_QUOTE = 'the paying customer is the last honest critic';
const KR_QUOTE = '인생 영화였다';
/** MoodCriterion 한줄평의 base fontSize — 배율이 곱해지기 전 값(`MoodCriterion.tsx`). */
const QUOTE_BASE = 50;

// Criterion은 signature 폰트 피커(#437)도 같이 뜨고 옵션 라벨이 동일해, 스코프 없는
// screen.getByRole('radio', ...)는 9택 전부에서 중복 매치로 깨진다.
function quoteRadio(name: string) {
  return within(screen.getByRole('radiogroup', { name: '한줄평 폰트' })).getByRole('radio', { name }) as HTMLButtonElement;
}

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

/** 티켓에 실제로 그려진 한줄평 엘리먼트의 inline style. */
function quoteStyle(text: string) {
  return (screen.getByText(text) as HTMLElement).style;
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

describe('레일 커스텀 — 한줄평 폰트 9택 (#558 → #437)', () => {
  test('커스텀 항목은 6무드 전부에서 뜨고, 한줄평 폰트만 Criterion 전용이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드 minimal — 서명 폰트 축(#437)이 있어 커스텀 항목 자체는 뜨지만 한줄평 폰트는 없다.
    // queryByRole 결과를 그대로 toBeNull()에 넣으면 실패 시 bun이 노드 그래프 전체를 찍어
    // 수십 초가 걸린다(#693) — !!로 강제 변환해 값만 비교한다.
    await user.click(screen.getByRole('button', { name: '커스텀' }));
    expect(!!screen.queryByRole('radiogroup', { name: '한줄평 폰트' })).toBe(false);

    // 무드를 바꿔도 'custom' 항목은 appliesTo가 6무드 전부라 패널이 안 닫힌다(#523 pop 유지).
    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    expect(!!screen.queryByRole('radiogroup', { name: '한줄평 폰트' })).toBe(true);
  });

  test('칩은 자동 + 8종 = 9개고 라벨 순서가 고정이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    const chips = within(screen.getByRole('radiogroup', { name: '한줄평 폰트' })).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(ALL_FONT_LABELS);
  });

  test('9택 각각이 티켓 한줄평의 fontFamily + 보정된 fontSize로 반영된다 (라틴)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    // 기본값 auto + 영문 기본 문구 → 자동분기가 Instrument Serif(세리프 이탤릭)를 고르고,
    // 그게 라틴 축의 기준(배율 1)이라 base fontSize가 그대로 나온다.
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
    expect(quoteStyle(DEFAULT_QUOTE).fontFamily).toContain(AUTO_LATIN_FAMILY);
    expect(quoteStyle(DEFAULT_QUOTE).fontSize).toBe(expectedFontSize(QUOTE_BASE, 1));

    for (const chip of FONT_CHIPS) {
      await user.click(quoteRadio(chip.label));
      expect(screen.getByTestId('quote-font').textContent).toBe(chip.value);
      const style = quoteStyle(DEFAULT_QUOTE);
      expect(style.fontFamily).toContain(chip.family);
      expect(style.fontSize).toBe(expectedFontSize(QUOTE_BASE, chip.latin));
    }

    // 되돌리면 자동분기로 복귀 — 기본값이 픽셀을 안 바꾼다는 #558 c3의 UI 쪽 확인.
    await user.click(quoteRadio('자동'));
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
    expect(quoteStyle(DEFAULT_QUOTE).fontFamily).toContain(AUTO_LATIN_FAMILY);
    expect(quoteStyle(DEFAULT_QUOTE).fontSize).toBe(expectedFontSize(QUOTE_BASE, 1));
  });

  test('한글 한줄평에서도 9택이 다 서고, 한글 축 배율이 따로 걸린다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);
    await user.click(screen.getByRole('button', { name: '한글 한줄평 입력' }));

    // auto는 한글에서 자람(아이스자람체)으로 가고, 그게 한글 축의 기준(배율 1)이다.
    expect(quoteStyle(KR_QUOTE).fontFamily).toContain(AUTO_HANGUL_FAMILY);
    expect(quoteStyle(KR_QUOTE).fontSize).toBe(expectedFontSize(QUOTE_BASE, 1));

    for (const chip of FONT_CHIPS) {
      await user.click(quoteRadio(chip.label));
      const style = quoteStyle(KR_QUOTE);
      expect(style.fontFamily).toContain(chip.family);
      // 라틴 배율이 아니라 한글 배율이어야 한다 — 하나만 두면 경기천년바탕(한글 0.757 /
      // 라틴 1.039)처럼 방향이 반대인 폰트에서 반대로 보정된다.
      expect(style.fontSize).toBe(expectedFontSize(QUOTE_BASE, chip.hangul));
    }
  });

  test('한글에서 잠기는 칩이 없다 — 8종 전부 한글 글리프를 갖고 있다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);
    await user.click(screen.getByRole('button', { name: '한글 한줄평 입력' }));

    // #558엔 한글에서 disabled가 되는 '세리프' 칩이 있었다. 9택은 한글 되는 세리프('바탕')로
    // 갈아탔으므로 잠기는 칩도 사유 문구도 없어야 한다 — 남아 있으면 옛 분기가 살아 있는 것.
    for (const label of ALL_FONT_LABELS) expect(quoteRadio(label).disabled).toBe(false);
    expect(!!screen.queryByText(/글리프가 없어/)).toBe(false);
  });

  test('무드를 왕복해도 고른 한줄평 폰트가 보존된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    await user.click(quoteRadio('바탕'));
    // 다른 무드로 나가면 한줄평 피커는 사라지지만(quote는 Criterion 전용), 패널 자체는 서명
    // 폰트 축(#437) 덕분에 열린 채 남는다(#523 pop 유지) — quoteFont 값은 그대로 보존.
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(!!screen.queryByRole('radiogroup', { name: '한줄평 폰트' })).toBe(false);
    expect(screen.getByTestId('quote-font').textContent).toBe('batang');

    // 패널이 이미 열려 있으므로 '커스텀'을 다시 누르지 않는다 — 누르면 토글로 닫혀버린다.
    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    expect(quoteRadio('바탕').getAttribute('aria-checked')).toBe('true');
    expect(quoteStyle(DEFAULT_QUOTE).fontFamily).toContain('--font-batang');
  });
});
