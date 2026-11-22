/**
 * #826 S3 — 필드 입력 패널(D12 · D13 · D14) 상호작용 잠금.
 *
 * Seed docs/specs/826-s3-info-field-input.yaml의 acceptance-2 · 3 · 4(셸) · 7 · 8 · 17 · 19 · 20과 추적표 S3 행을 여기서
 * 잡는다. 글꼴 줄(d_fonts · acceptance-6)은 inPlaceFontPicker, 누락 행 재숨김(acceptance-18 앞쪽)은 doneFailureInfoMode,
 * 숨긴 필드 직접 탭 재표시(acceptance-18 뒤쪽)와 목록 눈 유지(f_visibility)는 mobileEditorShellFieldCoverage가 맡는다.
 *
 * happy-dom은 레이아웃이 없어 rect가 전부 0이다 — 위치가 아니라 역할 · 이름 · 값 · 클래스를 본다. 지오메트리
 * (넘침 0px · 교차 면적 0)는 헤드리스 크롬 표본이 잰다(acceptance-12).
 */
import { describe, expect, test, afterEach, beforeEach, jest } from 'bun:test';
import { act, useState } from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { InPlaceFieldEditor } from '@/components/v2/InPlaceFieldEditor';
import BrightnessSlider from '@/components/v2/pickers/BrightnessSlider';
import { FIELD_LABELS, STAMP_LABELS, isStampTarget, type SheetTarget } from '@/constants/fields';
import { mobileShellProps } from './shellHarness';
import { targetPx } from './tapTargets';

function Harness({ layout }: { layout?: 'stub' | 'criterion' } = {}) {
  const photo = usePhototicket();
  const { movieInfo: m, components: c, fieldVisibility: v } = photo.state;
  return (
    <>
      <div data-testid="probe" data-runtime={m.runtime} data-rating={String(m.rating)} data-watch-format={m.watchDateFormat ?? ''}
        data-gran={m.releaseDateGranularity ?? ''} data-release-format={m.releaseDateFormat ?? ''} data-reissue={String(!!m.isReissue)} data-vis-seat={String(v.seat)}
        data-vis-reissue={String(v.reissue)} data-chain-image={String(c.chain ?? '')} data-actors={m.actors} />
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({
            title: 'TITLE0', theater: 'CGV0', seat: 'H12', runtime: '128', releaseDate: '2024-05-01',
            actors: '배우하나, 배우둘, 배우셋, 배우넷, 배우다섯', quote: '파도 소리',
          });
          if (layout) photo.updateComponents({ layout });
        }}
      >
        seed
      </button>
      <button type="button" onClick={() => photo.updateComponents({ chain: 'blob:chain', chainVisible: true })}>
        chain-image
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

const infoList = () => screen.getByTestId('dock-body');
const labelOf = (f: SheetTarget) => (isStampTarget(f) ? STAMP_LABELS[f] : FIELD_LABELS[f]);
const panel = (label?: string) => screen.getByRole('group', { name: label ? `${label} 입력` : / 입력$/ });
const openRow = async (label: string) => {
  fireEvent.click(within(infoList()).getByRole('button', { name: new RegExp(`^${label} (?!티켓에 표시)`) }));
  return screen.findByRole('group', { name: `${label} 입력` });
};
const probe = (k: string) => screen.getByTestId('probe').getAttribute(`data-${k}`);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('f_tap · f_inplace — 두 진입 경로가 같은 패널을 연다 (acceptance-2)', () => {
  test('티켓 필드 탭과 정보 목록 행 탭이 같은 패널을 열고, 첫 줄은 이전 항목 · 입력 · 다음 항목 · 닫기 순이다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    // 티켓 필드 탭(f_tap)
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    const fromTicket = await screen.findByRole('group', { name: '극장 입력' });
    const order = Array.from(fromTicket.querySelectorAll('button, input')).slice(0, 4)
      .map((el) => el.getAttribute('aria-label') ?? el.textContent);
    expect(order).toEqual(['이전 항목', '극장', '다음 항목', '닫기']);
    fireEvent.click(within(fromTicket).getByRole('button', { name: '닫기' }));

    // 정보 목록 행 탭 — 같은 패널(같은 이름 · 같은 입력)
    const fromList = await openRow('극장');
    expect(within(fromList).getByRole('textbox', { name: '극장' })).toBeTruthy();
    expect(fromList.getAttribute('data-field-panel')).toBe('theater');
  });

  test('티켓 위 투명 입력과 떠 있는 "필드 편집 도구"가 없고, 티켓에는 선택 표시만 캡처 대상 밖에 선다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('group', { name: '극장 입력' });

    expect(screen.queryAllByRole('toolbar', { name: '필드 편집 도구' }).length).toBe(0);
    // 입력은 전부 패널 안에 있다(티켓 래퍼 안에 input이 없다).
    for (const input of Array.from(document.querySelectorAll('input:not([type="file"])'))) {
      expect(!!input.closest('[data-field-panel]')).toBe(true);
    }
    const marks = document.querySelector('[data-field-selection]');
    expect(marks === null).toBe(false);
    // 선택 표시는 티켓 div의 형제(래퍼 직속)라 TicketRenderer 캡처 트리 밖이다.
    const ticketBox = marks!.parentElement!.firstElementChild!;
    expect(ticketBox.contains(marks)).toBe(false);
    expect(!!ticketBox.querySelector('[data-field-tap]')).toBe(true);
    // 이름표 없음(D12 · 결정 3-A) — L자 넷뿐이다.
    expect(marks!.textContent).toBe('');
    expect(marks!.children.length).toBe(4);
  });

  test('c_toolbar — 편집 중에도 떠 있는 툴바가 없다(배치 · 드래그 · 숨김 저장도 없다)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('group', { name: '극장 입력' });
    expect(screen.queryAllByRole('toolbar', { name: /툴바|필드 편집/ }).length).toBe(0);
    expect(window.localStorage.getItem('filme:toolbar:v1')).toBeNull();
  });
});

describe('요구 5 복구 — ‹ › · Return · 정보 목록 (acceptance-3)', () => {
  test('Return은 다음 항목이고 표시를 바꾸지 않으며, 마지막 필드의 Return은 완료다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    const title = await screen.findByRole('textbox', { name: '제목' });
    expect(title.getAttribute('enterkeyhint')).toBe('next');
    const visBefore = probe('vis-seat');

    // ‹ 한 번 = 순회 목록의 마지막 필드. 거기서 Return은 완료(enterkeyhint=done).
    fireEvent.click(within(panel('제목')).getByRole('button', { name: '이전 항목' }));
    const last = panel();
    const lastInput = last.querySelector('input:not([type="file"])');
    if (lastInput) {
      expect(lastInput.getAttribute('enterkeyhint')).toBe('done');
      fireEvent.keyDown(lastInput, { key: 'Enter' });
      expect(screen.queryAllByRole('group', { name: / 입력$/ }).length).toBe(0);
    }

    // 다시 제목에서 Return → 다음 항목(제목이 아닌 패널).
    fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
    fireEvent.keyDown(await screen.findByRole('textbox', { name: '제목' }), { key: 'Enter' });
    expect(panel().getAttribute('data-field-panel')).not.toBe('title');
    expect(probe('vis-seat')).toBe(visBefore);
  });

  test('한글 조합 중 Return은 다음 항목으로 넘기지 않는다(글자 확정)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    const input = await screen.findByRole('textbox', { name: '극장' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(panel().getAttribute('data-field-panel')).toBe('theater');
  });

  test('엉뚱한 필드가 열렸을 때 정보 목록 행으로 원하는 필드에 간다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('group', { name: '극장 입력' });
    // 패널이 떠 있어도 도크 정보 목록은 그 아래에 있다 — 행 탭으로 바로 옮긴다.
    const seat = await openRow('좌석');
    expect(within(seat).getByRole('textbox', { name: '좌석' })).toBeTruthy();
    expect(screen.queryAllByRole('group', { name: / 입력$/ }).length).toBe(1);
  });
});

describe('hit 44 — 셸 탭 처리 (acceptance-4)', () => {
  test('글자 상자 밖이지만 44 안을 누르면 그 필드가, 어느 44에도 안 들면 포스터 추가가 열린다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('landing-skip-poster')); // 포스터 없는 문서 — 빈 곳 탭이 '포스터 추가'다
    const anchor = (await screen.findAllByRole('button', { name: / 편집$/ }))[0];
    const field = anchor.getAttribute('data-field-tap') as SheetTarget;
    anchor.getBoundingClientRect = () => ({ left: 100, top: 200, width: 12, height: 8, right: 112, bottom: 208, x: 100, y: 200, toJSON() {} }) as DOMRect;

    const posterInput = document.querySelector('input[type="file"][accept^="image/jpeg"]') as HTMLInputElement;
    let posterPicks = 0;
    posterInput.addEventListener('click', (e) => {
      e.preventDefault();
      posterPicks++;
    });
    const posterTap = document.querySelector('[data-poster-tap]') as HTMLElement;

    // 중심 (106, 204)에서 오른쪽 18 · 아래 15 — 글자 상자 밖, 44 안.
    fireEvent.click(posterTap, { clientX: 124, clientY: 219 });
    expect(posterPicks).toBe(0);
    // 패널은 dynamic(ssr:false)라 첫 열림은 모듈 로드를 기다린다 — 단독 실행에서도 서게 findBy로 잡는다.
    const opened = await screen.findByRole('group', { name: `${labelOf(field)} 입력` });
    expect(opened.getAttribute('data-field-panel')).toBe(field);
    fireEvent.click(within(opened).getByRole('button', { name: '닫기' }));

    // 44 밖 — 필드가 열리지 않고 원래 받던 '포스터 추가'로 간다.
    fireEvent.click(posterTap, { clientX: 300, clientY: 400 });
    expect(posterPicks).toBe(1);
    expect(screen.queryAllByRole('group', { name: / 입력$/ }).length).toBe(0);
  });
});

describe('f_dates · f_rating — 칩 · 별 (acceptance-7 · 19)', () => {
  test('관람일: 표기 칩이 toolbar 안 radiogroup이고 값을 바꾼다 · 칩은 pill이 아니다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const p = await openRow('관람일');
    const bar = within(p).getByRole('toolbar', { name: '관람일 옵션' });
    const group = within(bar).getByRole('radiogroup', { name: '관람일 표기' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    fireEvent.click(radios[2]);
    expect(probe('watch-format')).toBe('cinema-mono');
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    for (const r of radios) {
      expect(r.className).not.toMatch(/rounded-chip|rounded-full/);
      expect(r.className).toContain('h-touch');
    }
    expect(within(p).getByLabelText('관람일').getAttribute('type')).toBe('date');
  });

  test('개봉일(D16 3-A): 옵션 한 줄 = 정밀도 세그먼트 radiogroup · 표기 미리보기 · 재개봉 토글, select 없음, 재개봉을 켜면 재개봉일 줄이 생긴다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const p = await openRow('개봉일');
    expect(p.querySelectorAll('select').length).toBe(0);
    // 옵션 줄은 하나다(개봉일 옵션 toolbar 한 개). 정밀도 · 표기 · 재개봉이 다 그 안에 있다.
    const bars = within(p).getAllByRole('toolbar');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['개봉일 옵션']);
    const gran = within(bars[0]).getByRole('radiogroup', { name: '개봉일 정밀도' });
    expect(within(gran).getAllByRole('radio').map((r) => r.textContent)).toEqual(['연', '연·월', '연·월·일']);
    for (const r of within(gran).getAllByRole('radio')) expect(r.className).toContain('h-touch');
    fireEvent.click(within(gran).getByRole('radio', { name: '연' }));
    expect(probe('gran')).toBe('year');
    expect(within(bars[0]).getByRole('button', { name: /^개봉일 표기, 지금 / }).getAttribute('aria-haspopup')).toBe('listbox');
    expect(within(p).queryAllByRole('radiogroup', { name: '개봉일 표기' }).length).toBe(0);

    // 재개봉은 라디오 밖 독립 토글(aria-pressed). 켜기 전엔 패널에 표시 토글이 하나도 없다.
    const reissue = within(p).getByRole('button', { name: '재개봉' });
    expect(reissue.getAttribute('aria-pressed')).toBe('false');
    expect(reissue.closest('[role="radiogroup"]') === null).toBe(true);
    expect(within(p).queryAllByRole('switch').length).toBe(0);
    fireEvent.click(reissue);
    expect(probe('reissue')).toBe('true');
    expect(within(p).getByLabelText('재개봉일')).toBeTruthy();
    const vis = within(p).getAllByRole('switch');
    expect(vis.map((s) => s.getAttribute('aria-label'))).toEqual(['재개봉일 티켓에 표시']);
    const before = probe('vis-reissue');
    fireEvent.click(vis[0]);
    expect(probe('vis-reissue')).toBe(String(before !== 'true'));
  });

  test('개봉일 표기(D16 3-A): 미리보기 버튼이 지금 표기로 쓴 날짜이고, 누르면 표기 4종 listbox — 고른 값이 저장되고 Escape는 목록만 닫는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed')); // 개봉일 2024-05-01
    const p = await openRow('개봉일');
    const btn = within(p).getByRole('button', { name: /^개봉일 표기, 지금 / });
    expect(btn.textContent).toBe('2024.05.01.');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    const lb = within(p).getByRole('listbox', { name: '개봉일 표기' });
    const opts = within(lb).getAllByRole('option');
    expect(opts.length).toBe(4);
    // 항목 미리보기도 이름이 아니라 실제 날짜다.
    expect(opts.map((o) => o.textContent?.startsWith(['2024.05.01.', '2024-05-01', '01·MAY·2024', 'May 1, 2024'][opts.indexOf(o)]))).toEqual([true, true, true, true]);
    expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    fireEvent.click(opts[1]);
    expect(probe('release-format')).toBe('iso');
    expect(within(p).queryAllByRole('listbox').length).toBe(0);
    expect(within(p).getByRole('button', { name: /^개봉일 표기, 지금 / }).textContent).toBe('2024-05-01');

    fireEvent.click(within(p).getByRole('button', { name: /^개봉일 표기, 지금 / }));
    fireEvent.keyDown(within(p).getByRole('listbox', { name: '개봉일 표기' }), { key: 'Escape' });
    expect(within(p).queryAllByRole('listbox').length).toBe(0);
    expect(!!screen.queryByRole('group', { name: '개봉일 입력' })).toBe(true);
    expect(probe('release-format')).toBe('iso');
  });

  test('평점: 키보드 없는 별 radiogroup(44) + 숫자를 누르면 소수 입력(decimal) — 4.3이 저장된다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const p = await openRow('평점');
    expect(within(p).queryAllByRole('textbox').length).toBe(0);
    const stars = within(p).getByRole('radiogroup', { name: '별점' });
    for (const s of within(stars).getAllByRole('radio')) expect(s.getAttribute('data-touch')).toBe('44');
    fireEvent.click(within(stars).getByRole('radio', { name: '4점' }), { detail: 0 });

    fireEvent.click(within(p).getByRole('button', { name: '평점 소수 입력 토글' }));
    const dec = within(p).getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    expect(dec.getAttribute('inputmode')).toBe('decimal');
    expect(dec.getAttribute('step')).toBe('0.1');
    fireEvent.change(dec, { target: { value: '4.3' } });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(probe('rating')).toBe('4.3');
    // 패널엔 평점 표시 토글이 없다(정보 목록 눈 몫).
    expect(within(p).queryAllByRole('switch').length).toBe(0);
  });

  test('평점(D16 4-A): 첫 줄 [− 숫자 +] 스테퍼가 0.1씩 0~5 안에서 바꾸고, 별 다섯이 패널 폭을 나눠 가진다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const p = await openRow('평점');
    const row1 = within(p).getByRole('button', { name: '이전 항목' }).parentElement!;
    const minus = within(row1).getByRole('button', { name: '평점 0.1 내리기' });
    const plus = within(row1).getByRole('button', { name: '평점 0.1 올리기' });
    const num = within(row1).getByRole('button', { name: '평점 소수 입력 토글' });
    // 첫 줄 순서: 이전 항목 · − · 숫자 · + · 다음 항목 · 닫기
    expect(Array.from(row1.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(
      ['이전 항목', '평점 0.1 내리기', '평점 소수 입력 토글', '평점 0.1 올리기', '다음 항목', '닫기']
    );
    for (const b of [minus, plus]) expect(targetPx(b, b.getAttribute('aria-label') ?? '')).toEqual({ w: 44, h: 44 });

    // 키보드 클릭(detail 0) 한 번 = 0.1. 0에서 − 는 0에 멈춘다.
    fireEvent.click(minus, { detail: 0 });
    fireEvent.click(plus, { detail: 0 });
    fireEvent.click(plus, { detail: 0 });
    fireEvent.click(plus, { detail: 0 });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(probe('rating')).toBe('0.3');
    expect(num.textContent).toBe('0.3');

    // 누르고 있으면 반복한다(400ms 뒤부터 80ms마다) — 떼면 멈춘다.
    fireEvent.pointerDown(plus);
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    fireEvent.pointerUp(plus);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const held = Number(probe('rating'));
    expect(held).toBeGreaterThanOrEqual(0.6);
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(Number(probe('rating'))).toBe(held);

    // 별 줄은 패널 폭을 나눠 가진다(별 하나 flex-1).
    const stars = within(p).getByRole('radiogroup', { name: '별점' });
    expect(stars.className).toContain('w-full');
    for (const s of within(stars).getAllByRole('radio')) expect(s.className).toContain('flex-1');
  });
});

describe('필드별 패널 내용 · 16px · 표시 토글 없음 (acceptance-8 · 17 · 20)', () => {
  const ALL_ROWS = ['제목', '개봉일', '원제', '출연', '러닝타임', '관람일', '관람 시간', '극장', '상영관', '좌석', '예매 번호', '평점', '서명'];

  test('어느 필드의 패널에도 표시 토글이 없고, 모든 입력이 16px(text-title) 이상이다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    for (const label of ALL_ROWS) {
      const row = within(infoList()).queryByRole('button', { name: new RegExp(`^${label} (?!티켓에 표시)`) });
      if (row === null) continue; // 무드가 안 그리는 필드는 목록에 없다
      const p = await openRow(label);
      expect(within(p).queryAllByRole('switch').length).toBe(0);
      expect(within(p).queryAllByRole('button', { name: /티켓 노출|티켓에 표시/ }).length).toBe(0);
      for (const input of Array.from(p.querySelectorAll('input:not([type="file"])'))) {
        expect(`${label}: ${input.className}`).toContain('text-title');
      }
      fireEvent.click(within(p).getByRole('button', { name: '닫기' }));
    }
  });

  test('러닝타임은 숫자일 때 numeric, 관람 시간은 time, 출연은 잘리지 않은 원문이다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    let p = await openRow('러닝타임');
    expect(within(p).getByRole('textbox', { name: '러닝타임' }).getAttribute('inputmode')).toBe('numeric');
    fireEvent.change(within(p).getByRole('textbox', { name: '러닝타임' }), { target: { value: '128 MIN' } });
    expect(within(p).getByRole('textbox', { name: '러닝타임' }).getAttribute('inputmode')).toBeNull();

    p = await openRow('관람 시간');
    expect(within(p).getByLabelText('관람 시간').getAttribute('type')).toBe('time');

    p = await openRow('출연');
    expect((within(p).getByRole('textbox', { name: '출연' }) as HTMLInputElement).value).toBe('배우하나, 배우둘, 배우셋, 배우넷, 배우다섯');
    // 티켓 위 투명 입력 없이 패널 입력 하나이고(#447), 타이핑이 그대로 저장된다.
    expect(screen.getAllByRole('textbox', { name: '출연' }).length).toBe(1);
    fireEvent.change(within(p).getByRole('textbox', { name: '출연' }), { target: { value: '배우A, 배우B' } });
    expect(probe('actors')).toBe('배우A, 배우B');
  });

  test('f_logos · f_image_remove — 로고는 글자 입력 + "이미지로", 이미지가 있으면 이미지 행(제거 · 교체), 제거하면 글자 입력이 돌아온다', async () => {
    render(<Harness layout="stub" />);
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(screen.getByText('chain-image'));
    fireEvent.click(await screen.findByRole('button', { name: `${STAMP_LABELS.chain} 편집` }));
    const p = await screen.findByRole('group', { name: `${STAMP_LABELS.chain} 입력` });
    expect(within(p).queryAllByRole('textbox').length).toBe(0);
    expect(within(p).getByAltText(`${STAMP_LABELS.chain} 이미지`)).toBeTruthy();
    expect(within(p).getByRole('button', { name: '교체' })).toBeTruthy();
    fireEvent.click(within(p).getByRole('button', { name: '제거' }));
    expect(probe('chain-image')).toBe('');
    expect(within(p).getByRole('textbox', { name: STAMP_LABELS.chain })).toBeTruthy();
    expect(within(p).getByRole('button', { name: '이미지로' })).toBeTruthy();
    // 이미지로 · 교체는 숨은 파일 입력을 연다(자유 비율 크롭으로 이어진다, C-02).
    expect(!!document.querySelector(`input[type="file"][aria-label="${STAMP_LABELS.chain} 이미지 파일"]`)).toBe(true);
  });

  test('슬라이더 트랙 hit 32(h-8)는 줄지 않는다', () => {
    render(<BrightnessSlider label="밝기" value={50} onChange={() => {}} min={0} max={100} />);
    expect(screen.getByRole('slider').className).toContain('h-8');
  });
});

describe('f_drawer · c_ghost — 정보 목록이 옛 드로어를 대신한다', () => {
  test('정보 모드 목록의 행이 패널을 열고, 편집 중엔 빈 항목이 탭 타깃으로 남는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const p = await openRow('상영관');
    expect(within(p).getByRole('textbox', { name: '상영관' })).toBeTruthy();
    // 빈 필드(상영관)도 편집 중 ghost로 티켓 탭 타깃이 있다.
    expect(!!screen.queryByRole('button', { name: '상영관 편집' })).toBe(true);
  });
});

// ── f_kobis(acceptance-20 앞쪽) — 패널 단독 하네스(fetch 스왑 + 가짜 시계, inPlaceKobisResultRow와 같은 패턴) ──
const MOVIES = ['하나', '둘', '셋', '넷'].map((n, i) => ({
  movieCd: `M${i}`, movieNm: `먼 바다 ${n}`, movieNmEn: `FAR SEA ${i}`, openDt: '20240501',
  genreAlt: '드라마', nationAlt: '한국', prdtYear: '2024', typeNm: '장편', prdtStatNm: '개봉', directors: [{ peopleNm: '감독' }],
}));
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const originalFetch = globalThis.fetch;

function TitleHarness() {
  const photo = usePhototicket();
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [ticketEl, setTicketEl] = useState<HTMLDivElement | null>(null);
  const m = photo.state.movieInfo;
  return (
    <div>
      <div data-testid="kprobe" data-title={m.title} data-release={m.releaseDate} data-actors={m.actors} />
      <div ref={setWrapperEl}>
        <div ref={setTicketEl}>
          <span data-field-tap="title">제목</span>
        </div>
      </div>
      {wrapperEl && ticketEl && (
        <InPlaceFieldEditor photo={photo} field="title" wrapperEl={wrapperEl} ticketEl={ticketEl} onField={() => {}} onClose={() => {}} onLift={() => {}} />
      )}
    </div>
  );
}

describe('f_kobis — 제목 KOBIS 목록 (acceptance-20 · constraint-12 문구)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });
  const kp = (k: string) => screen.getByTestId('kprobe').getAttribute(`data-${k}`);

  test('검색 중… → 결과 목록(보이는 높이 3행, 넘치면 목록 안 스크롤) → 고르면 제목 · 개봉일 · 출연이 채워지고 목록이 닫힌다', async () => {
    let resolveSearch: (r: Response) => void = () => {};
    globalThis.fetch = ((req: RequestInfo | URL) => {
      const url = String(req);
      if (url.startsWith('/api/kobis/search')) return new Promise<Response>((r) => { resolveSearch = r; });
      if (url.startsWith('/api/kobis/detail')) {
        return Promise.resolve(json({ movieInfoResult: { movieInfo: { nations: [{ nationNm: '한국' }], actors: [{ peopleNm: '배우가' }, { peopleNm: '배우나' }], showTm: '110' } } }));
      }
      return Promise.reject(new Error(url));
    }) as typeof fetch;

    render(<TitleHarness />);
    fireEvent.change(screen.getByRole('textbox', { name: '제목' }), { target: { value: '먼 바다' } });
    await act(async () => { jest.advanceTimersByTime(310); });
    expect(screen.getByRole('status').textContent).toBe('검색 중…');

    await act(async () => { resolveSearch(json({ movieListResult: { movieList: MOVIES } })); });
    const list = screen.getByRole('listbox', { name: '검색 결과' });
    expect(list.className).toContain('max-h-[248px]');
    expect(list.className).toContain('overflow-y-auto');
    expect(within(list).getAllByRole('option').length).toBe(4);

    await act(async () => { fireEvent.click(within(list).getByText('먼 바다 둘')); });
    await act(async () => { await Promise.resolve(); });
    expect(kp('title')).toBe('먼 바다 둘');
    expect(kp('release')).toBe('2024-05-01');
    expect(kp('actors')).toBe('배우가, 배우나');
    expect(screen.queryAllByRole('listbox').length).toBe(0);
  });

  test('무매칭은 "검색 결과가 없어요", 실패는 "검색에 실패했어요" + [다시 검색]', async () => {
    let fail = true;
    globalThis.fetch = ((req: RequestInfo | URL) => {
      const url = String(req);
      if (url.includes('movieNm=%EC%97%86%EC%9D%8C')) return Promise.resolve(json({ movieListResult: { movieList: [] } }));
      if (fail) return Promise.resolve(new Response('x', { status: 500 }));
      return Promise.resolve(json({ movieListResult: { movieList: MOVIES.slice(0, 1) } }));
    }) as typeof fetch;
    const errSpy = console.error;
    console.error = () => {};
    try {
      render(<TitleHarness />);
      const input = screen.getByRole('textbox', { name: '제목' });
      fireEvent.change(input, { target: { value: '없음' } });
      await act(async () => { jest.advanceTimersByTime(310); });
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('status').textContent).toBe('검색 결과가 없어요');

      fireEvent.change(input, { target: { value: '먼 바다' } });
      await act(async () => { jest.advanceTimersByTime(310); });
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole('alert').textContent).toBe('검색에 실패했어요');
      fail = false;
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: '다시 검색' })); });
      await act(async () => { await Promise.resolve(); });
      expect(screen.getAllByRole('option').length).toBe(1);
    } finally {
      console.error = errSpy;
    }
  });
});

// ── /code-review medium 지적 잠금 — 편집기는 필드가 바뀌어도 살아 있으니, 필드별 일시 상태가 다음 필드로 새지 않아야 한다 ──
function StepHarness({ start }: { start: SheetTarget }) {
  const photo = usePhototicket();
  const [field, setField] = useState<SheetTarget>(start);
  const [closed, setClosed] = useState(false);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [ticketEl, setTicketEl] = useState<HTMLDivElement | null>(null);
  return (
    <div>
      <div data-testid="field">{closed ? 'closed' : field}</div>
      <div ref={setWrapperEl}>
        {/* 순회 목록 = 제목 · 원제 · 개봉일 · 평점(EDIT_ORDER 순). 좌석은 그리지 않는다(무드가 안 그린 필드). */}
        <div ref={setTicketEl}>
          {(['title', 'titleOg', 'releaseDate', 'rating'] as const).map((f) => <span key={f} data-field-tap={f}>{f}</span>)}
        </div>
      </div>
      {wrapperEl && ticketEl && (
        <InPlaceFieldEditor photo={photo} field={field} wrapperEl={wrapperEl} ticketEl={ticketEl} onField={setField} onClose={() => setClosed(true)} onLift={() => {}} />
      )}
    </div>
  );
}
const cur = () => screen.getByTestId('field').textContent;
const navBtn = (name: '이전 항목' | '다음 항목') => fireEvent.click(screen.getByRole('button', { name }));

describe('필드가 바뀔 때 일시 상태 · 순회 경계', () => {
  test('순회 목록에 없는 필드에서 ›는 처음, ‹는 끝으로 간다', () => {
    render(<StepHarness start="seat" />);
    navBtn('다음 항목');
    expect(cur()).toBe('title');
    cleanup();
    render(<StepHarness start="seat" />);
    navBtn('이전 항목');
    expect(cur()).toBe('rating');
  });

  test('개봉일 입력의 Return도 다음 항목으로 간다', () => {
    render(<StepHarness start="releaseDate" />);
    const input = screen.getByLabelText('개봉일');
    expect(input.getAttribute('enterkeyhint')).toBe('next');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(cur()).toBe('rating');
  });

  test('평점 소수 입력의 Return도 이어진다 — 평점이 마지막 필드라 완료다', () => {
    render(<StepHarness start="rating" />);
    fireEvent.click(screen.getByRole('button', { name: '평점 소수 입력 토글' }));
    const dec = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    expect(dec.getAttribute('enterkeyhint')).toBe('done');
    fireEvent.keyDown(dec, { key: 'Enter' });
    expect(cur()).toBe('closed');
  });

  test('평점 숫자를 누르면 그 자리에 소수 입력이 포커스를 받고, Escape · 포커스 잃음이면 숫자로 접힌다', () => {
    render(<StepHarness start="rating" />);
    fireEvent.click(screen.getByRole('button', { name: '평점 소수 입력 토글' }));
    const dec = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    expect(document.activeElement === dec).toBe(true);
    fireEvent.keyDown(dec, { key: 'Escape' });
    expect(screen.queryAllByRole('spinbutton').length).toBe(0);
    expect(cur()).toBe('rating'); // Escape는 입력만 접고 필드는 그대로
    fireEvent.click(screen.getByRole('button', { name: '평점 소수 입력 토글' }));
    fireEvent.blur(screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' }));
    expect(screen.queryAllByRole('spinbutton').length).toBe(0);
  });

  test('스테퍼: 주 버튼 누름 + 뒤따르는 click은 한 칸이고, 오른쪽 클릭은 올리지도 반복하지도 않는다', async () => {
    render(<StepHarness start="rating" />);
    const plus = screen.getByRole('button', { name: '평점 0.1 올리기' });
    const num = () => screen.getByRole('button', { name: '평점 소수 입력 토글' }).textContent;
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent.pointerUp(plus, { button: 0 });
    fireEvent.click(plus);
    expect(num()).toBe('0.1');
    fireEvent.pointerDown(plus, { button: 2 });
    fireEvent.contextMenu(plus);
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(num()).toBe('0.1');
    // 누른 채 버튼 밖으로 끌고 나가 떼면 click이 안 온다 — 다음 키보드 click은 그대로 한 칸이어야 한다(PR #842 리뷰).
    fireEvent.pointerDown(plus, { button: 0 });
    fireEvent.pointerLeave(plus);
    expect(num()).toBe('0.2');
    fireEvent.click(plus);
    expect(num()).toBe('0.3');
  });

  test('목록을 연 채로 다른 필드에 갔다 돌아오면 목록은 닫혀 있다', () => {
    render(<StepHarness start="releaseDate" />);
    fireEvent.click(screen.getByRole('button', { name: /^개봉일 표기, 지금 / }));
    expect(screen.queryAllByRole('listbox').length).toBe(1);
    navBtn('다음 항목');
    navBtn('이전 항목');
    expect(cur()).toBe('releaseDate');
    expect(screen.queryAllByRole('listbox').length).toBe(0);
  });

  test('정밀도가 연이면 네 표기가 같은 연도라 표기 버튼이 꺼진다', () => {
    render(<StepHarness start="releaseDate" />);
    fireEvent.click(screen.getByRole('radio', { name: '연' }));
    const btn = screen.getByRole('button', { name: /^개봉일 표기, 지금 / }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '연·월' }));
    expect((screen.getByRole('button', { name: /^개봉일 표기, 지금 / }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('평점 소수 입력은 다른 필드에 다녀오면 접혀 있다', () => {
    render(<StepHarness start="rating" />);
    fireEvent.click(screen.getByRole('button', { name: '평점 소수 입력 토글' }));
    expect(screen.queryAllByRole('spinbutton').length).toBe(1);
    navBtn('이전 항목');
    navBtn('다음 항목');
    expect(cur()).toBe('rating');
    expect(screen.queryAllByRole('spinbutton').length).toBe(0);
  });

  describe('KOBIS', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
      globalThis.fetch = originalFetch;
      jest.useRealTimers();
    });

    test('제목을 떠났다 돌아오면 지난 검색 목록이 다시 뜨지 않는다', async () => {
      globalThis.fetch = ((_req: RequestInfo | URL) => Promise.resolve(json({ movieListResult: { movieList: MOVIES } }))) as typeof fetch;
      render(<StepHarness start="title" />);
      fireEvent.change(screen.getByRole('textbox', { name: '제목' }), { target: { value: '먼 바다' } });
      await act(async () => { jest.advanceTimersByTime(310); });
      await act(async () => { await Promise.resolve(); });
      expect(screen.queryAllByRole('listbox').length).toBe(1);
      navBtn('다음 항목');
      navBtn('이전 항목');
      expect(cur()).toBe('title');
      expect(screen.queryAllByRole('listbox').length).toBe(0);
    });

    test('실패 뒤 제목을 비우면 [다시 검색]이 사라진다(눌러도 아무 일 없는 버튼을 남기지 않는다)', async () => {
      globalThis.fetch = ((_req: RequestInfo | URL) => Promise.resolve(new Response('x', { status: 500 }))) as typeof fetch;
      const errSpy = console.error;
      console.error = () => {};
      try {
        render(<StepHarness start="title" />);
        const input = screen.getByRole('textbox', { name: '제목' });
        fireEvent.change(input, { target: { value: '먼 바다' } });
        await act(async () => { jest.advanceTimersByTime(310); });
        await act(async () => { await Promise.resolve(); });
        expect(screen.getAllByRole('button', { name: '다시 검색' }).length).toBe(1);
        fireEvent.change(input, { target: { value: '' } });
        expect(screen.queryAllByRole('button', { name: '다시 검색' }).length).toBe(0);
      } finally {
        console.error = errSpy;
      }
    });
  });
});
