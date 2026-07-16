import { describe, expect, test } from 'bun:test';
import { resolveTicketData } from '../src/components/moods/_shared';
import { FULL_MOVIE } from './fixtures';
import type { MovieInfo } from '../src/types';

// #379 — bookingNumber 없을 때의 바코드 fallback이 movieCd+watchDate 조합인지, bookingNumber가
// 있을 때 기존 동작이 그대로 유지되는지 검증.
describe('resolveTicketData — bookingNo fallback (#379)', () => {
  test('bookingNumber 있으면 movieCd/watchDate와 무관하게 그대로 사용(기존 동작 유지)', () => {
    const d: MovieInfo = { ...FULL_MOVIE, movieCd: '20123456', watchDate: '2024-03-15' };
    expect(resolveTicketData(d).bookingNo).toBe(FULL_MOVIE.bookingNumber);
  });

  test('bookingNumber 없고 movieCd+watchDate 있으면 movieCd(8)+watchDate(8)=16자리', () => {
    const d: MovieInfo = { ...FULL_MOVIE, bookingNumber: undefined, movieCd: '20123456', watchDate: '2024-03-15' };
    const bookingNo = resolveTicketData(d).bookingNo;
    expect(bookingNo).toBe('2012345620240315');
    expect(bookingNo).toHaveLength(16);
  });

  test('bookingNumber 없고 movieCd만 있으면(watchDate 빈값) movieCd 8자리만 유지', () => {
    const d: MovieInfo = { ...FULL_MOVIE, bookingNumber: undefined, movieCd: '20123456', watchDate: undefined };
    const bookingNo = resolveTicketData(d).bookingNo;
    expect(bookingNo).toBe('20123456');
    expect(bookingNo).toHaveLength(8);
  });

  test('bookingNumber도 movieCd도 없으면 기존 title 해시 fallback(PT-YYYY-NNNN) 유지', () => {
    const d: MovieInfo = { ...FULL_MOVIE, bookingNumber: undefined, movieCd: undefined };
    const bookingNo = resolveTicketData(d).bookingNo;
    expect(bookingNo).toMatch(/^PT-\d{4}-\d{4}$/);
  });
});
