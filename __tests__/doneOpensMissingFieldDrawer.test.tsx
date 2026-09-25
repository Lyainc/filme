import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Home from '@/pages/index';
import { missingExportFields } from '@/hooks/useExportReady';

/**
 * #776 — 미완료에서 완료를 누르면 사유 토스트와 함께 필드 드로어가 열리고, 드로어는 빠진 저장 필수
 * 입력(제목·개봉연도)만 바로가기로 보여준다. 다 채워지면 안내 카드가 사라진다.
 * 실제 Home 배선(useExportReady → canExport → 셸 handleDone)을 거친다.
 */

const NOTICE = '저장에는 제목과 개봉연도가 필요해요. 개봉일은 티켓에서 숨겨도 돼요.';

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (value: object) =>
  window.localStorage.setItem('filme:phototicket:v1', JSON.stringify(value));

test('missingExportFields — 표시 여부와 무관하게 빈 제목·4자 미만 개봉일을 순서대로 낸다', () => {
  expect(missingExportFields({ title: ' ', titleOg: '', releaseDate: undefined })).toEqual(['title', 'releaseDate']);
  expect(missingExportFields({ title: '영화', titleOg: '', releaseDate: '202' })).toEqual(['releaseDate']);
  expect(missingExportFields({ title: '', titleOg: '', releaseDate: '2026' })).toEqual(['title']);
  expect(missingExportFields({ title: '영화', titleOg: '', releaseDate: '2026' })).toEqual([]);
});

test('#776 — 미완료 완료 탭은 드로어를 열고, 바로가기는 그 필드 편집으로 간다', async () => {
  // 개봉일을 숨긴 상태 — 표시 토글이 꺼져 있어도 저장엔 연도가 필요하다는 게 안내의 요지다.
  draft({ movieInfo: { title: '', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  expect(!!screen.queryByLabelText('편집으로 돌아가기')).toBe(false);
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  expect(drawer.textContent).toContain(NOTICE);
  expect(within(drawer).getAllByRole('button', { name: /^(제목|개봉연도) 입력$/ }).map((b) => b.textContent))
    .toEqual(['제목 입력', '개봉연도 입력']);

  fireEvent.click(within(drawer).getByRole('button', { name: '제목 입력' }));
  expect(!!screen.queryByRole('dialog', { name: '티켓 항목' })).toBe(false);
  fireEvent.change(await screen.findByRole('textbox', { name: '제목' }), { target: { value: '새 영화' } });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

  // 제목을 채운 뒤엔 개봉연도 바로가기만 남는다.
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const again = await screen.findByRole('dialog', { name: '티켓 항목' });
  expect(within(again).getAllByRole('button', { name: /^(제목|개봉연도) 입력$/ }).map((b) => b.textContent))
    .toEqual(['개봉연도 입력']);
});

test('#776 — 숨긴 개봉일은 바로가기로 연도를 넣는 동안만 보이고, 편집이 끝나면 다시 숨는다', async () => {
  // 안내문이 "개봉일은 티켓에서 숨겨도 돼요"라고 말하므로, 바로가기가 표시 선택을 덮어쓰면 안 된다.
  draft({ movieInfo: { title: '영화', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  fireEvent.click(within(drawer).getByRole('button', { name: '개봉연도 입력' }));
  // 인플레이스 편집기는 티켓 위 앵커가 있어야 뜨므로 편집 중엔 잠깐 보인다.
  expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const after = await screen.findByRole('dialog', { name: '티켓 항목' });
  expect(within(after).getByRole('switch', { name: '개봉일 티켓에 표시' }).getAttribute('aria-checked')).toBe('false');
});

const releaseShown = async () => {
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const d = await screen.findByRole('dialog', { name: '티켓 항목' });
  const shown = within(d).getByRole('switch', { name: '개봉일 티켓에 표시' }).getAttribute('aria-checked');
  fireEvent.keyDown(d, { key: 'Escape' });
  return shown;
};

test('#776 — 같은 바로가기를 두 번 눌러도, 다른 누락 필드로 옮겨도 숨긴 개봉일은 다시 숨는다', async () => {
  draft({ movieInfo: { title: '', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  // 같은 바로가기 두 번 — 두 번째 탭 땐 이미 켜져 있어도 복원 대상을 잊으면 안 된다.
  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '티켓 항목' })).getByRole('button', { name: '개봉연도 입력' }));
    expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);
  }
  // 그 상태에서 다른 누락 필드(제목)로 옮기면 떠나는 개봉일은 숨는다.
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(await screen.findByRole('dialog', { name: '티켓 항목' })).getByRole('button', { name: '제목 입력' }));
  expect(!!(await screen.findByRole('textbox', { name: '제목' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(await releaseShown()).toBe('false');
});

test('#776 — 바로가기 편집 중 초기화하면 재숨김이 새 문서로 넘어가지 않는다', async () => {
  draft({ movieInfo: { title: '영화', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(await screen.findByRole('dialog', { name: '티켓 항목' })).getByRole('button', { name: '개봉연도 입력' }));
  expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  fireEvent.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

  // 새 문서로 들어가 다른 필드를 연다 — 개봉일은 기본값(표시)이어야 한다.
  fireEvent.click(await screen.findByRole('button', { name: '포스터 없이 직접 입력' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(await screen.findByRole('button', { name: '제목 편집' }));
  expect(!!(await screen.findByRole('textbox', { name: '제목' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(await releaseShown()).toBe('true');
});

test('#776 — 필수 입력이 다 차 있으면 드로어에 안내 카드가 없고 완료는 결과로 간다', async () => {
  draft({ movieInfo: { title: '영화', releaseDate: '2026' } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));

  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  expect(drawer.textContent?.includes(NOTICE)).toBe(false);
  expect(within(drawer).queryAllByRole('button', { name: /^(제목|개봉연도) 입력$/ }).length).toBe(0);
  fireEvent.keyDown(drawer, { key: 'Escape' });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  expect(!!(await screen.findByLabelText('편집으로 돌아가기'))).toBe(true);
});
