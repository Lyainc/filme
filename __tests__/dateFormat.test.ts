import { describe, expect, test } from 'bun:test';
import { formatDate } from '../src/utils/dateFormat';
import type { DateFormatToken } from '../src/types';

describe('formatDate — padded ISO baseline', () => {
  test('iso / date', () => {
    expect(formatDate('2014-11-06', 'iso', 'date')).toBe('2014-11-06');
  });
  test('kr-compact / date', () => {
    expect(formatDate('2014-11-06', 'kr-compact', 'date')).toBe('2014.11.06');
  });
  test('cinema-mono / date', () => {
    expect(formatDate('2014-11-06', 'cinema-mono', 'date')).toBe('06·NOV·2014');
  });
  test('en-long / date', () => {
    expect(formatDate('2014-11-06', 'en-long', 'date')).toBe('November 6, 2014');
  });
  test('cinema-mono / year-month', () => {
    expect(formatDate('2014-11', 'cinema-mono', 'year-month')).toBe('NOV 2014');
  });
  test('en-long / year', () => {
    expect(formatDate('2014', 'en-long', 'year')).toBe('2014');
  });
});

describe('formatDate — HIGH-8: non-padded ISO normalization', () => {
  test('single-digit month and day, iso', () => {
    expect(formatDate('2014-1-6', 'iso', 'date')).toBe('2014-01-06');
  });
  test('single-digit month and day, kr-compact', () => {
    expect(formatDate('2014-1-6', 'kr-compact', 'date')).toBe('2014.01.06');
  });
  test('single-digit month and day, cinema-mono', () => {
    expect(formatDate('2014-1-6', 'cinema-mono', 'date')).toBe('06·JAN·2014');
  });
  test('single-digit month, year-month, kr-compact', () => {
    expect(formatDate('2014-3', 'kr-compact', 'year-month')).toBe('2014.03');
  });
  test('single-digit month, year-month, cinema-mono', () => {
    expect(formatDate('2014-3', 'cinema-mono', 'year-month')).toBe('MAR 2014');
  });
  test('en-long strips leading zero from day', () => {
    expect(formatDate('2014-1-6', 'en-long', 'date')).toBe('January 6, 2014');
  });
});

describe('formatDate — HIGH-8: graceful degradation', () => {
  test('year-only value at date granularity falls back to year', () => {
    expect(formatDate('1994', 'iso', 'date')).toBe('1994');
  });
  test('year-month value at date granularity falls back to year-month', () => {
    expect(formatDate('2014-11', 'iso', 'date')).toBe('2014-11');
  });
  test('full ISO at year granularity yields year only', () => {
    expect(formatDate('2014-11-06', 'kr-compact', 'year')).toBe('2014');
  });
});

describe('formatDate — HIGH-8: invalid input returns empty string', () => {
  test('undefined', () => {
    expect(formatDate(undefined, 'iso', 'date')).toBe('');
  });
  test('empty string', () => {
    expect(formatDate('', 'iso', 'date')).toBe('');
  });
  test('non-ISO garbage', () => {
    expect(formatDate('not-a-date', 'iso', 'date')).toBe('');
  });
  test('too few year digits', () => {
    expect(formatDate('14-11-06', 'iso', 'date')).toBe('');
  });
  test('trailing dash', () => {
    expect(formatDate('2014-', 'iso', 'date')).toBe('');
  });
});

describe('formatDate — HIGH-8: unknown token falls back to iso behavior', () => {
  const BAD = 'bogus-token' as DateFormatToken;
  test('date granularity → iso-like output', () => {
    expect(formatDate('2014-11-06', BAD, 'date')).toBe('2014-11-06');
  });
  test('year-month granularity → iso-like output', () => {
    expect(formatDate('2014-11', BAD, 'year-month')).toBe('2014-11');
  });
});
