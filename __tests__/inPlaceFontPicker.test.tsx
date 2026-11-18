/**
 * #437 → #826 S2 — 인플레이스 필드 에디터의 글꼴 드롭다운(한줄평·서명 9택).
 *
 * 옛 폰트 패널(CustomPanel)의 상호작용 계약을 그대로 옮겼다: 드롭다운은 한줄평·서명에서만 뜨고,
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
const listbox = (field: string) => screen.getByRole('listbox', { name: `${field} 글꼴` });
const hasButton = (re: RegExp) => !!screen.queryByRole('button', { name: re });

async function openField(label: string, criterion = false) {
  render(<Harness />);
  fireEvent.click(screen.getByTestId('landing-skip-poster')); // 상단 줄(실행 취소)은 랜딩을 떠난 뒤에 선다(#826 S2)
  fireEvent.click(screen.getByText('seed'));
  if (criterion) fireEvent.click(screen.getByText('criterion'));
  fireEvent.click(await screen.findByRole('button', { name: `${label} 편집` }));
  await screen.findByRole('toolbar', { name: '필드 편집 도구' });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('인플레이스 글꼴 드롭다운 — 노출', () => {
  test('한줄평·서명에서만 뜨고 다른 필드엔 없다', async () => {
    await openField('극장');
    expect(hasButton(/글꼴/)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

    fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
    expect(hasButton(/^서명 글꼴/)).toBe(true);
  });

  test('버튼은 현재 글꼴 이름을 그 글꼴로 그리고, 목록은 닫혀 있다', async () => {
    await openField('서명');
    const btn = fontButton('서명');
    expect(btn.textContent).toBe('자동');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(!!screen.queryByRole('listbox')).toBe(false);
  });

  test('서명 이미지가 있으면 서명 글꼴 드롭다운이 숨는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('sig-image'));
    fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
    await screen.findByRole('toolbar', { name: '필드 편집 도구' });
    expect(hasButton(/글꼴/)).toBe(false);
  });
});

describe('인플레이스 글꼴 드롭다운 — 9택 (#437)', () => {
  test('목록은 자동 + 8종 = 9개, 순서 고정, 현재값만 aria-selected', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));

    const opts = within(listbox('서명')).getAllByRole('option');
    expect(opts.map((o) => o.textContent)).toEqual(ALL_FONT_LABELS);
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
      // 선택하면 목록이 닫히고 버튼이 새 이름을 보여 준다.
      expect(!!screen.queryByRole('listbox')).toBe(false);
      expect(fontButton('서명').textContent).toBe(chip.label);
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

describe('인플레이스 글꼴 드롭다운 — 키보드 (APG listbox)', () => {
  test('열면 현재 옵션이 활성이고 ↓↑ Home End로 움직이며 Enter가 선택한다', async () => {
    const user = userEvent.setup();
    await openField('서명');
    await user.click(fontButton('서명'));

    const lb = listbox('서명');
    expect(document.activeElement === lb).toBe(true);
    const activeLabel = () =>
      document.getElementById(lb.getAttribute('aria-activedescendant') ?? '')?.textContent;
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
    expect(!!screen.queryByRole('toolbar', { name: '필드 편집 도구' })).toBe(true);
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
