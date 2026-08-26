/**
 * #437 — 디자인 레일 '커스텀' 항목의 서명 폰트 4택 상호작용 테스트.
 *
 * quoteFont(#558, designRailQuoteFont.test.tsx)와 같은 모양이되, signatureFont는 독립 축이라
 * ①quoteFont와 값이 안 섞이는지 ②6무드 전부(텍스트 스팬 4종 + FilmCreditCut 크레딧 컷 경유
 * 35mm 계열)에서 실제 렌더 fontFamily로 이어지는지 ③signatureImage가 있으면 피커 전체가
 * 잠기는지를 끝까지 본다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { MoodMinimal } from '@/components/moods/MoodMinimal';
import { Mood35mm } from '@/components/moods/Mood35mm';

const KR_SIGNATURE = '인생 영화였다';
const EN_SIGNATURE = 'signed by nobody';

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

function renderedSignatureFont(text: string) {
  return (screen.getByText(text) as HTMLElement).style.fontFamily;
}

async function openCustomPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '커스텀' }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('레일 커스텀 — 서명 폰트 4택 (#437)', () => {
  test('서명 폰트 피커는 6무드 전부에서 뜨고 quoteFont와 독립이다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 초기 무드 minimal — quote는 이 무드에서 안 뜨지만 signature는 뜬다. queryByRole 결과를
    // 그대로 toBeNull()에 넣으면 실패 시 bun이 노드 그래프 전체를 찍어 수십 초가 걸린다(#693)
    // — !!로 강제 변환해 값만 비교한다.
    await openCustomPanel(user);
    expect(!!screen.queryByRole('radiogroup', { name: '한줄평 폰트' })).toBe(false);
    expect(!!screen.queryByRole('radiogroup', { name: '서명 폰트' })).toBe(true);

    await user.click(screen.getByRole('radio', { name: '고딕' }));
    expect(screen.getByTestId('signature-font').textContent).toBe('gothic');
    // quoteFont는 이 무드에 컨트롤이 없으니 기본값 그대로.
    expect(screen.getByTestId('quote-font').textContent).toBe('auto');
  });

  test('4택 각각이 텍스트 스팬 무드(Minimal)의 서명 fontFamily로 반영된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    await user.click(screen.getByRole('radio', { name: '손글씨' }));
    expect(renderedSignatureFont(EN_SIGNATURE)).toContain('--font-quote-kr');

    await user.click(screen.getByRole('radio', { name: '고딕' }));
    expect(renderedSignatureFont(EN_SIGNATURE)).toContain('Pretendard');

    await user.click(screen.getByRole('radio', { name: '세리프' }));
    expect(renderedSignatureFont(EN_SIGNATURE)).toContain('--font-display');

    await user.click(screen.getByRole('radio', { name: '자동' }));
    expect(renderedSignatureFont(EN_SIGNATURE)).toContain('--font-display');
  });

  test('35mm 크레딧 컷(FilmCreditCut)의 Collected by 행도 같은 배선을 탄다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '35mm로 전환' }));
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    await user.click(screen.getByRole('radio', { name: '손글씨' }));
    expect(renderedSignatureFont(EN_SIGNATURE)).toContain('--font-quote-kr');
  });

  test('한글 서명이면 세리프 칩은 disabled + 사유 문구 — quote 세리프와 독립 판정', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '한글 서명 입력' }));
    await openCustomPanel(user);

    const serif = () => screen.getByRole('radio', { name: '세리프' }) as HTMLButtonElement;
    expect(serif().disabled).toBe(true);
    expect(!!screen.queryByText(/세리프는 한글 글리프가 없어 한글 서명에는/)).toBe(true);
  });

  test('서명 이미지가 있으면 4택 전부 disabled + 사유 문구', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '영문 서명 입력' }));
    await openCustomPanel(user);

    // 이미지 첨부 전엔 전부 눌린다.
    expect((screen.getByRole('radio', { name: '고딕' }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: '서명 이미지 첨부' }));
    for (const label of ['자동', '손글씨', '고딕', '세리프']) {
      expect((screen.getByRole('radio', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(!!screen.queryByText(/서명 이미지가 있으면 폰트가 적용되지 않아요/)).toBe(true);
  });
});
