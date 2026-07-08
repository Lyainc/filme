import { describe, expect, test } from 'bun:test';
import { canExport } from '../src/hooks/useExportReady';

const POSTER = true;
const NO_POSTER = false;
const TITLE = 'Interstellar';
const NO_TITLE = '';
const TITLE_OG = 'Interstellar';
const NO_TITLE_OG = '';
const RELEASE_OK = '2014';
const RELEASE_SHORT = '201';
const RELEASE_EMPTY = '';

describe('canExport truth table', () => {
  test('all conditions met → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK})).toBe(true);
  });

  test('no poster → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('empty title → false', () => {
    expect(canExport({ hasPoster: POSTER, title: NO_TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('whitespace-only title → false', () => {
    expect(canExport({ hasPoster: POSTER, title: '   ', titleOg: TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('empty titleOg → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: NO_TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('releaseDate 3 chars → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_SHORT})).toBe(false);
  });

  test('releaseDate undefined → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: undefined})).toBe(false);
  });

  test('releaseDate empty string → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_EMPTY})).toBe(false);
  });

  test('releaseDate exactly 4 chars → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014'})).toBe(true);
  });

  test('releaseDate year-month → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11'})).toBe(true);
  });

  test('releaseDate full date → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11-06'})).toBe(true);
  });

  test('no poster + no title → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: NO_TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('no poster + no titleOg → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: NO_TITLE_OG, releaseDate: RELEASE_OK})).toBe(false);
  });

  test('no poster + short release → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_SHORT})).toBe(false);
  });
});
