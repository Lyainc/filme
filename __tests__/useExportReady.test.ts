import { describe, expect, test } from 'bun:test';
import { canExport } from '../src/hooks/useExportReady';

const TITLE = 'Interstellar';
const NO_TITLE = '';
const TITLE_OG = 'Interstellar';
const NO_TITLE_OG = '';
const RELEASE_OK = '2014';
const RELEASE_SHORT = '201';
const RELEASE_EMPTY = '';

describe('canExport truth table', () => {
  // 포스터는 완료 조건이 아니다(#631 D3) — 제목·개봉연도만 있으면 포스터 없이도 준비완료.
  test('all conditions met → true', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK })).toBe(true);
  });

  test('empty title → false', () => {
    expect(canExport({ title: NO_TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK })).toBe(false);
  });

  test('whitespace-only title → false', () => {
    expect(canExport({ title: '   ', titleOg: TITLE_OG, releaseDate: RELEASE_OK })).toBe(false);
  });

  test('empty titleOg → true (titleOg no longer required, #445)', () => {
    expect(canExport({ title: TITLE, titleOg: NO_TITLE_OG, releaseDate: RELEASE_OK })).toBe(true);
  });

  test('releaseDate 3 chars → false', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_SHORT })).toBe(false);
  });

  test('releaseDate undefined → false', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: undefined })).toBe(false);
  });

  test('releaseDate empty string → false', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_EMPTY })).toBe(false);
  });

  test('releaseDate exactly 4 chars → true', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: '2014' })).toBe(true);
  });

  test('releaseDate year-month → true', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11' })).toBe(true);
  });

  test('releaseDate full date → true', () => {
    expect(canExport({ title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11-06' })).toBe(true);
  });
});
