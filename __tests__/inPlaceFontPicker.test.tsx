/**
 * #437 → #826 S2 → S3 — 입력 패널의 글꼴 줄(한줄평·서명 9택, D13-1 A + D14-2 A: [‹ 이전 글꼴][미리보기][› 다음 글꼴]).
 *
 * 옛 폰트 패널(CustomPanel)의 상호작용 계약을 그대로 옮겼다: 글꼴 줄은 한줄평·서명에서만 뜨고,
 * 고른 값이 components.quoteFont/signatureFont에 저장돼 **티켓이 그 fontFamily + 보정 fontSize로**
 * 그려지는지를 끝까지 본다(피커 state만 보면 배선이 끊겨도 통과한다). 기대표는 프로덕션 코드에서
 * 끌어오지 않고 userTextFontOptions.ts에 손으로 적어 둔다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { ALL_FONT_LABELS, FONT_CHIPS, expectedFontSize } from './userTextFontOptions';

const KR = '인생 영화였다';
const SIG = '김필름';
/** MoodCriterion 한줄평 base fontSize · MoodMinimal 서명 base fontSize. */
const QUOTE_BASE = 50;
const SIGNATURE_BASE = 32;

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="quote-font">{photo.state.components.quoteFont ?? '(미설정)'}</div>
      <div data-testid="signature-font">{photo.state.components.signatureFont ?? '(미설정)'}</div>
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0', quote: KR, signature: SIG });
        }}
      >
        seed
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'criterion' })}>
        criterion
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: 'blob:sig' })}>
        sig-image
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        themePreference="light"
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

/** 티켓에 그려진 텍스트(오버레이 input은 value라 getByText에 안 걸린다)의 inline style. */
// 같은 문구가 정보 도크 행에도 있어(스타일 없는 span) 티켓 쪽만 inline fontFamily로 가려낸다.
const ticketStyle = (text: string) =>
  (screen.getAllByText(text) as HTMLElement[]).find((el) => el.style.fontFamily !== '')!.style;
const fontButton = (field: string) => screen.getByRole('button', { name: new RegExp(`^${field} 글꼴`) });
/** 목록 항목의 접근 이름(= 글꼴 이름, D14-2 A). 보이는 글은 같은 견본이라 이름으로 가린다. */
const optName = (o: Element | null | undefined) => o?.getAttribute('aria-label');
const listbox = (field: string) => screen.getByRole('listbox', { name: `${field} 글꼴` });
const hasButton = (re: RegExp) => !!screen.queryByRole('button', { name: re });

async function openField(label: string, criterion = false) {
  render(<Harness />);
  fireEvent.click(screen.getByTestId('landing-skip-poster')); // 상단 줄(실행 취소)은 랜딩을 떠난 뒤에 선다(#826 S2)
  fireEvent.click(screen.getByText('seed'));
  if (criterion) fireEvent.click(screen.getByText('criterion'));
  fireEvent.click(await screen.findByRole('button', { name: `${label} 편집` }));
  await screen.findByRole('group', { name: `${label} 입력` });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('입력 패널 글꼴 줄 — 노출', () => {
  test('한줄평·서명에서만 뜨고 다른 필드엔 없다', async () => {
    await openField('극장');
    expect(hasButton(/글꼴/)).toBe(false);
    fireEvent.click(within(screen.getByRole('group', { name: '극장 입력' })).getByRole('button', { name: '닫기' }));

    fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
    expect(hasButton(/^서명 글꼴/)).toBe(true);
  });

  test('미리보기는 글꼴 이름이 아니라 입력한 글을 그 서체로 쓰고, 이름은 접근 이름에만 있다 · 목록은 닫혀 있다', async () => {
    await openField('서명');
    const btn = fontButton('서명');
    expect(btn.textContent).toBe(SIG);
    expect(btn.getAttribute('aria-label')).toBe('서명 글꼴, 지금 자동');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(!!screen.queryByRole('listbox')).toBe(false);
  });

  test('입력이 비면 미리보기가 견본 "영화의 순간 Film"이다', async () => {
    await openField('서명');
    fireEvent.change(screen.getByRole('textbox', { name: '서명' }), { target: { value: '' } });
    expect(fontButton('서명').textContent).toBe('영화의 순간 Film');
  });

  test('‹ ›가 9종을 순서대로 바꾸고 끝에서 처음으로 돈다', async () => {
    await openField('서명');
    const seen: string[] = [];
    for (let i = 0; i < ALL_FONT_LABELS.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: '다음 글꼴' }));
      seen.push((fontButton('서명').getAttribute('aria-label') ?? '').replace('서명 글꼴, 지금 ', ''));
    }
    expect(seen).toEqual([...ALL_FONT_LABELS.slice(1), ALL_FONT_LABELS[0]]);
    fireEvent.click(screen.getByRole('button', { name: '이전 글꼴' }));
    expect(fontButton('서명').getAttribute('aria-label')).toBe(`서명 글꼴, 지금 ${ALL_FONT_LABELS[ALL_FONT_LABELS.length - 1]}`);
    expect(screen.getByTestId('signature-font').textContent).toBe(FONT_CHIPS[FONT_CHIPS.length - 1].value);
  });

  test('서명 이미지가 있으면 서명 글꼴 줄이 없다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('sig-image'));
    fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
    await screen.findByRole('group', { name: '서명 입력' });
    expect(hasButton(/글꼴/)).toBe(false);
  });
});

describe('입력 패널 글꼴 목록 — 9택 (#437)', () => {
  test('목록은 자동 + 8종 = 9개, 순서 고정, 현재값만 aria-selected', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));

    const opts = within(listbox('서명')).getAllByRole('option');
    expect(opts.map(optName)).toEqual(ALL_FONT_LABELS);
    // 항목마다 같은 글(입력한 서명)을 그 서체로 + 오른쪽에 작은 이름(D14-2 A).
    opts.forEach((o, i) => expect(o.textContent?.startsWith(SIG + ALL_FONT_LABELS[i])).toBe(true));
    expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(
      ALL_FONT_LABELS.map((l) => String(l === '자동'))
    );
    expect(fontButton('서명').getAttribute('aria-expanded')).toBe('true');
  });

  test('서명: 9택 각각이 저장되고 티켓 fontFamily + 보정 fontSize로 반영된다 (한글)', async () => {
    const user = userEvent.setup();
    await openField('서명');

    for (const chip of FONT_CHIPS) {
      await user.click(fontButton('서명'));
      await user.click(within(listbox('서명')).getByRole('option', { name: chip.label }));
      expect(screen.getByTestId('signature-font').textContent).toBe(chip.value);
      expect(screen.getByTestId('quote-font').textContent).toBe('auto'); // 독립 축
      expect(ticketStyle(SIG).fontFamily).toContain(chip.family);
      expect(ticketStyle(SIG).fontSize).toBe(expectedFontSize(SIGNATURE_BASE, chip.hangul));
      // 선택하면 목록이 닫히고 버튼의 접근 이름이 새 글꼴을 읽는다.
      expect(!!screen.queryByRole('listbox')).toBe(false);
      expect(fontButton('서명').getAttribute('aria-label')).toBe(`서명 글꼴, 지금 ${chip.label}`);
    }
  });

  test('한줄평(Criterion): 선택이 quoteFont로 저장되고 티켓에 반영된다', async () => {
    const user = userEvent.setup();
    await openField('한줄평', true);
    for (const chip of FONT_CHIPS) {
      await user.click(fontButton('한줄평'));
      await user.click(within(listbox('한줄평')).getByRole('option', { name: chip.label }));
      expect(screen.getByTestId('quote-font').textContent).toBe(chip.value);
      expect(screen.getByTestId('signature-font').textContent).toBe('auto');
      expect(ticketStyle(KR).fontFamily).toContain(chip.family);
      expect(ticketStyle(KR).fontSize).toBe(expectedFontSize(QUOTE_BASE, chip.hangul));
    }
  });

  test('실행 취소가 이전 글꼴을 복원한다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    // useEditHistory는 350ms 디바운스로 스텝을 쌓는다 — 시드가 먼저 한 스텝으로 굳게 기다린다.
    await new Promise((r) => setTimeout(r, 450));
    await user.click(fontButton('서명'));
    await user.click(within(listbox('서명')).getByRole('option', { name: '바탕' }));
    expect(screen.getByTestId('signature-font').textContent).toBe('batang');

    const undo = screen.getByRole('button', { name: '실행 취소' }) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
    fireEvent.click(undo);
    await waitFor(() => expect(screen.getByTestId('signature-font').textContent).toBe('auto'));
  });
});

describe('입력 패널 글꼴 목록 — 키보드 (APG listbox)', () => {
  test('열면 현재 옵션이 활성이고 ↓↑ Home End로 움직이며 Enter가 선택한다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));

    const lb = listbox('서명');
    expect(document.activeElement === lb).toBe(true);
    const activeLabel = () => optName(document.getElementById(lb.getAttribute('aria-activedescendant') ?? ''));
    expect(activeLabel()).toBe('자동');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeLabel()).toBe('바탕');
    await user.keyboard('{ArrowUp}');
    expect(activeLabel()).toBe('고딕');
    await user.keyboard('{End}');
    expect(activeLabel()).toBe('꽃길');
    await user.keyboard('{ArrowDown}'); // 끝에서 멈춘다
    expect(activeLabel()).toBe('꽃길');
    await user.keyboard('{Home}');
    expect(activeLabel()).toBe('자동');

    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByTestId('signature-font').textContent).toBe('hand');
    expect(!!screen.queryByRole('listbox')).toBe(false);
  });

  test('Escape는 목록만 닫고 편집기는 남긴다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));
    await user.keyboard('{Escape}');
    expect(!!screen.queryByRole('listbox')).toBe(false);
    expect(!!screen.queryByRole('group', { name: '서명 입력' })).toBe(true);
    expect(screen.getByTestId('signature-font').textContent).toBe('auto');
  });

  test('포커스가 목록을 떠나면(blur) 닫힌다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));
    fireEvent.blur(listbox('서명'));
    expect(!!screen.queryByRole('listbox')).toBe(false);
  });

  // blur가 글꼴 버튼으로 옮겨 가는 거라면 목록을 닫지 않는다 — 곧이어 오는 버튼 click이 토글을 맡는다. 같이 닫아 버리면
  // 그 click이 방금 닫힌 목록을 도로 열어, 목록이 떠 있을 때 버튼을 눌러도 안 닫힌다.
  test('포커스가 글꼴 버튼으로 옮겨 가는 blur는 목록을 닫지 않고, 이어지는 버튼 탭이 목록을 닫는다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));
    expect(fontButton('서명').getAttribute('aria-expanded')).toBe('true');

    fireEvent.blur(listbox('서명'), { relatedTarget: fontButton('서명') });
    expect(!!screen.queryByRole('listbox')).toBe(true); // 버튼 쪽 blur는 무시

    await user.click(fontButton('서명'));
    expect(!!screen.queryByRole('listbox')).toBe(false);
    expect(fontButton('서명').getAttribute('aria-expanded')).toBe('false');
  });
});
