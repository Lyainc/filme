/**
 * #437 — 디자인 레일 '커스텀' 항목의 서명 폰트 9택 상호작용 테스트.
 *
 * quoteFont(designRailQuoteFont.test.tsx)와 같은 모양이되, signatureFont는 독립 축이라
 * ①quoteFont와 값이 안 섞이는지 ②6무드 전부(텍스트 스팬 4종 + FilmCreditCut 크레딧 컷 경유
 * 35mm 계열)에서 실제 렌더 fontFamily로 이어지는지 ③signatureImage가 있으면 피커 전체가
 * 잠기는지를 끝까지 본다.
 *
 * 크기 보정도 같이 본다 — 서명은 무드마다 base fontSize가 달라서(Minimal 32 · 35mm 크레딧 컷
 * 26), 배율이 base에 곱해지는지 아니면 어느 한 무드에만 하드코딩됐는지가 여기서 갈린다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodMinimal } from '@/components/moods/MoodMinimal';
import { Mood35mm } from '@/components/moods/Mood35mm';
import {
  ALL_FONT_LABELS,
  AUTO_HANGUL_FAMILY,
  AUTO_LATIN_FAMILY,
  FONT_CHIPS,
  expectedFontSize,
} from './userTextFontOptions';

const KR_SIGNATURE = '인생 영화였다';
const EN_SIGNATURE = 'signed by nobody';
/** 서명 base fontSize — 무드마다 다르다(`MoodMinimal.tsx` · `_shared.tsx`의 FilmCreditCut). */
const MINIMAL_BASE = 32;
const CREDIT_CUT_BASE = 26;

function signatureRadio(name: string) {
  return within(screen.getByRole('radiogroup', { name: '서명 폰트' })).getByRole('radio', { name }) as HTMLButtonElement;
}

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'minimal' })}>
        minimal로 전환
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: '35mm' })}>
        35mm로 전환
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ signature: EN_SIGNATURE })}>
        영문 서명 입력
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ signature: KR_SIGNATURE })}>
        한글 서명 입력
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: 'blob:sig' })}>
        서명 이미지 첨부
      </button>
      <div data-testid="signature-font">{photo.state.components.signatureFont ?? '(미설정)'}</div>
      <div data-testid="quote-font">{photo.state.components.quoteFont ?? '(미설정)'}</div>
      <DesignRail photo={photo} />
      {photo.state.components.layout === '35mm' ? (
        <Mood35mm movieInfo={photo.state.movieInfo} components={photo.state.components} croppedImageUrl="blob:x" />
      ) : (
        <MoodMinimal movieInfo={photo.state.movieInfo} components={photo.state.components} croppedImageUrl="blob:x" />
      )}
    </>
  );
}

function signatureStyle(text: string) {
  return (screen.getByText(text) as HTMLElement).style;
}

async function openCustomPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '커스텀' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 커스텀 — 서명 폰트 9택 (#437)', () => {
  test('서명 폰트 피커는 6무드 전부에서 뜨고 quoteFont와 독립이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드 minimal — quote는 이 무드에서 안 뜨지만 signature는 뜬다. queryByRole 결과를
    // 그대로 toBeNull()에 넣으면 실패 시 bun이 노드 그래프 전체를 찍어 수십 초가 걸린다(#693)
    // — !!로 강제 변환해 값만 비교한다.
    await openCustomPanel(user);
    expect(!!screen.queryByRole('radiogroup', { name: '한줄평 폰트' })).toBe(false);
    expect(!!screen.queryByRole('radiogroup', { name: '서명 폰트' })).toBe(true);

    await user.click(signatureRadio('고딕'));
    expect(screen.getByTestId('signature-font').textContent).toBe('gothic');
    // quoteFont는 이 무드에 컨트롤이 없으니 기본값 그대로.
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
  });

  test('칩은 자동 + 8종 = 9개고 라벨 순서가 한줄평 피커와 같다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCustomPanel(user);

    const chips = within(screen.getByRole('radiogroup', { name: '서명 폰트' })).getAllByRole('radio');
    expect(chips.map((c) => c.textContent)).toEqual(ALL_FONT_LABELS);
  });

  test('9택 각각이 텍스트 스팬 무드(Minimal)의 서명 fontFamily + 보정된 fontSize로 반영된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    expect(signatureStyle(EN_SIGNATURE).fontFamily).toContain(AUTO_LATIN_FAMILY);
    expect(signatureStyle(EN_SIGNATURE).fontSize).toBe(expectedFontSize(MINIMAL_BASE, 1));

    for (const chip of FONT_CHIPS) {
      await user.click(signatureRadio(chip.label));
      expect(screen.getByTestId('signature-font').textContent).toBe(chip.value);
      const style = signatureStyle(EN_SIGNATURE);
      expect(style.fontFamily).toContain(chip.family);
      expect(style.fontSize).toBe(expectedFontSize(MINIMAL_BASE, chip.latin));
    }
  });

  test('한글 서명이면 한글 축 배율이 걸리고, 잠기는 칩은 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '한글 서명 입력' }));
    await openCustomPanel(user);

    expect(signatureStyle(KR_SIGNATURE).fontFamily).toContain(AUTO_HANGUL_FAMILY);
    expect(signatureStyle(KR_SIGNATURE).fontSize).toBe(expectedFontSize(MINIMAL_BASE, 1));

    for (const chip of FONT_CHIPS) {
      await user.click(signatureRadio(chip.label));
      const style = signatureStyle(KR_SIGNATURE);
      expect(style.fontFamily).toContain(chip.family);
      expect(style.fontSize).toBe(expectedFontSize(MINIMAL_BASE, chip.hangul));
    }
    // #437 이전의 '세리프' 칩(한글에서 disabled)이 사라졌는지 — 8종 전부 한글 글리프가 있다.
    for (const label of ALL_FONT_LABELS) expect(signatureRadio(label).disabled).toBe(false);
  });

  test('35mm 크레딧 컷(FilmCreditCut)도 같은 배선을 타고, base가 달라도 배율이 곱해진다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '35mm로 전환' }));
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    // Minimal(32)과 다른 base(26)라, 배율이 base에 곱해지는 게 아니라 어느 무드에 하드코딩된
    // 값이면 여기서 갈린다.
    for (const chip of FONT_CHIPS) {
      await user.click(signatureRadio(chip.label));
      const style = signatureStyle(EN_SIGNATURE);
      expect(style.fontFamily).toContain(chip.family);
      expect(style.fontSize).toBe(expectedFontSize(CREDIT_CUT_BASE, chip.latin));
    }
  });

  test('서명 이미지가 있으면 9택 전부 disabled + 사유 문구', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    // 이미지 첨부 전엔 전부 눌린다.
    expect(signatureRadio('고딕').disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: '서명 이미지 첨부' }));
    for (const label of ALL_FONT_LABELS) expect(signatureRadio(label).disabled).toBe(true);
    expect(!!screen.queryByText(/서명 이미지가 있으면 폰트가 적용되지 않아요/)).toBe(true);
  });
});
