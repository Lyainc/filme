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
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(true);
  });

  test('pendingFetch=true blocks regardless of other conditions', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: true })).toBe(false);
  });

  test('no poster → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('empty title → false', () => {
    expect(canExport({ hasPoster: POSTER, title: NO_TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('whitespace-only title → false', () => {
    expect(canExport({ hasPoster: POSTER, title: '   ', titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('empty titleOg → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: NO_TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('releaseDate 3 chars → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_SHORT, pendingFetch: false })).toBe(false);
  });

  test('releaseDate undefined → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: undefined, pendingFetch: false })).toBe(false);
  });

  test('releaseDate empty string → false', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_EMPTY, pendingFetch: false })).toBe(false);
  });

  test('releaseDate exactly 4 chars → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014', pendingFetch: false })).toBe(true);
  });

  test('releaseDate year-month → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11', pendingFetch: false })).toBe(true);
  });

  test('releaseDate full date → true', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: '2014-11-06', pendingFetch: false })).toBe(true);
  });

  test('no poster + no title → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: NO_TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('no poster + no titleOg → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: NO_TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: false })).toBe(false);
  });

  test('no poster + short release → false', () => {
    expect(canExport({ hasPoster: NO_POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_SHORT, pendingFetch: false })).toBe(false);
  });

  test('poster + title + titleOg but pendingFetch → false (race guard)', () => {
    expect(canExport({ hasPoster: POSTER, title: TITLE, titleOg: TITLE_OG, releaseDate: RELEASE_OK, pendingFetch: true })).toBe(false);
  });
});
