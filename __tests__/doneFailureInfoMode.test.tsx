import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Home from '@/pages/index';
import { missingExportFields } from '@/hooks/useExportReady';

/**
 * #776 → #826 S2 constraint-16 — 미완료에서 완료를 누르면 사유 토스트와 함께 도크가 정보 모드로 바뀌고,
 * 빈 필수 행(제목·개봉일)이 앰버 점 · '필수'로 강조된다(E-03). 키보드는 자동으로 올리지 않는다. 누락 행 탭은
 * openMissingField를 타서 숨겨 둔 필드를 편집이 끝날 때 다시 숨긴다. 옛 필드 드로어의 누락 안내 카드와 바로가기
 * 버튼('제목 입력' · '개봉연도 입력')은 사라졌다 — 행 자체가 바로가기다.
 * 실제 Home 배선(useExportReady → canExport → 셸 handleDone)을 거친다.
 */

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (value: object) =>
  window.localStorage.setItem('filme:phototicket:v1', JSON.stringify(value));

const infoList = () => screen.getByTestId('dock-body');
const row = (field: string) => infoList().querySelector(`[data-field-row="${field}"]`) as HTMLElement;
const isMissing = (field: string) => row(field).getAttribute('data-missing') === 'true';
const modeSelected = (name: RegExp) => screen.getByRole('tab', { name }).getAttribute('aria-selected');

test('missingExportFields — 표시 여부와 무관하게 빈 제목·4자 미만 개봉일을 순서대로 낸다', () => {
  expect(missingExportFields({ title: ' ', titleOg: '', releaseDate: undefined })).toEqual(['title', 'releaseDate']);
  expect(missingExportFields({ title: '영화', titleOg: '', releaseDate: '202' })).toEqual(['releaseDate']);
  expect(missingExportFields({ title: '', titleOg: '', releaseDate: '2026' })).toEqual(['title']);
  expect(missingExportFields({ title: '영화', titleOg: '', releaseDate: '2026' })).toEqual([]);
});

test('#826 S2 — 디자인 모드에서 미완료 완료 탭은 정보 모드로 바꾸고 빈 필수 행을 앰버로 강조하며 키보드를 올리지 않는다', async () => {
  draft({ movieInfo: { title: '', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(screen.getByRole('tab', { name: '디자인' }));
  expect(modeSelected(/^디자인/)).toBe('true');

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  expect(!!screen.queryByLabelText('편집으로 돌아가기')).toBe(false); // 결과로 안 간다
  expect(modeSelected(/^정보/)).toBe('true');
  // 필수 두 행 모두 앰버(점 + '필수'), 정보 탭에도 sr-only '필수 미입력'이 붙은 점이 있다.
  expect(isMissing('title')).toBe(true);
  expect(isMissing('releaseDate')).toBe(true);
  expect(within(row('title')).getByTestId('missing-dot')).not.toBeNull();
  expect(row('title').textContent).toContain('필수');
  expect(screen.getByRole('tab', { name: /^정보 필수 미입력$/ })).not.toBeNull();
  // 키보드는 자동으로 올리지 않는다 — 입력(인플레이스 편집기)이 열려 있지 않다.
  expect(!!screen.queryByRole('textbox', { name: '제목' })).toBe(false);
  expect(!!screen.queryByRole('toolbar', { name: '필드 편집 도구' })).toBe(false);
  // 사유 토스트 한 줄.
  expect(screen.getByTestId('global-toast').textContent).toBeTruthy();
});

test('#826 S2 — 사진 모드에서 미완료 완료 탭도 정보 모드로 간다', async () => {
  draft({ movieInfo: { title: '영화', releaseDate: '' } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(screen.getByRole('tab', { name: '사진' }));

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  expect(modeSelected(/^정보/)).toBe('true');
  // 개봉일만 비었다 — 제목 행은 강조되지 않는다.
  expect(isMissing('title')).toBe(false);
  expect(isMissing('releaseDate')).toBe(true);
});

test('#776 — 누락 행을 탭해 채우면 그 행의 앰버가 걷히고, 다 채워지면 정보 탭 점도 사라진다', async () => {
  draft({ movieInfo: { title: '', releaseDate: '2026' } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(infoList()).getByRole('button', { name: /^제목 (?!티켓에 표시)/ }));
  fireEvent.change(await screen.findByRole('textbox', { name: '제목' }), { target: { value: '새 영화' } });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

  expect(isMissing('title')).toBe(false);
  expect(row('title').textContent).toContain('새 영화');
  expect(!!screen.queryByTestId('info-missing-dot')).toBe(false);
  expect(screen.queryByRole('tab', { name: /필수 미입력/ }) === null).toBe(true);
});

test('#776 — 숨긴 개봉일은 누락 행으로 연도를 넣는 동안만 보이고, 편집이 끝나면 다시 숨는다', async () => {
  // 개봉일은 티켓에서 숨겨도 저장엔 연도가 필요하다 — 누락 행 탭이 표시 선택을 덮어쓰면 안 된다.
  draft({ movieInfo: { title: '영화', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(infoList()).getByRole('button', { name: /^개봉일 (?!티켓에 표시)/ }));
  // 인플레이스 편집기는 티켓 위 앵커가 있어야 뜨므로 편집 중엔 잠깐 보인다.
  expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

  expect(within(infoList()).getByRole('button', { name: '개봉일 티켓에 표시' }).getAttribute('aria-pressed')).toBe('false');
});

const releaseShown = () =>
  within(infoList()).getByRole('button', { name: '개봉일 티켓에 표시' }).getAttribute('aria-pressed');

test('#776 — 같은 누락 행을 두 번 눌러도, 다른 누락 필드로 옮겨도 숨긴 개봉일은 다시 숨는다', async () => {
  draft({ movieInfo: { title: '', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });

  // 같은 행 두 번 — 두 번째 탭 땐 이미 켜져 있어도 복원 대상을 잊으면 안 된다.
  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    fireEvent.click(within(infoList()).getByRole('button', { name: /^개봉일 (?!티켓에 표시)/ }));
    expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);
  }
  // 그 상태에서 다른 누락 필드(제목)로 옮기면 떠나는 개봉일은 숨는다.
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(infoList()).getByRole('button', { name: /^제목 (?!티켓에 표시)/ }));
  expect(!!(await screen.findByRole('textbox', { name: '제목' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(releaseShown()).toBe('false');
});

test('#776 — 누락 행 편집 중 초기화하면 재숨김이 새 문서로 넘어가지 않는다', async () => {
  draft({ movieInfo: { title: '영화', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  fireEvent.click(within(infoList()).getByRole('button', { name: /^개봉일 (?!티켓에 표시)/ }));
  expect(!!(await screen.findByRole('toolbar', { name: '필드 편집 도구' }))).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }));
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  fireEvent.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

  // 새 문서로 들어가 다른 필드를 연다 — 개봉일은 기본값(표시)이어야 한다.
  fireEvent.click(await screen.findByRole('button', { name: '포스터 없이 직접 입력' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(within(infoList()).getByRole('button', { name: /^제목 (?!티켓에 표시)/ }));
  expect(!!(await screen.findByRole('textbox', { name: '제목' }))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(releaseShown()).toBe('true');
});

test('#776 — 필수 입력이 다 차 있으면 앰버 표시가 없고 완료는 결과로 간다', async () => {
  draft({ movieInfo: { title: '영화', releaseDate: '2026' } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));

  expect(isMissing('title')).toBe(false);
  expect(isMissing('releaseDate')).toBe(false);
  expect(!!screen.queryByTestId('info-missing-dot')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  expect(!!(await screen.findByLabelText('편집으로 돌아가기'))).toBe(true);
});
