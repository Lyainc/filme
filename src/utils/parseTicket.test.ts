import { describe, it, expect } from 'vitest';
import { parseTicket } from './parseTicket';

// U-1: watchDate 정규화
describe('parseTicket — watchDate 정규화', () => {
  it('점 구분자 (2026.5.12)', () => {
    const out = parseTicket('CGV 강남\n2026.5.12\n14:00');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('점 구분자 0-패딩 (2026.05.12)', () => {
    const out = parseTicket('2026.05.12');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('한글 (2026년 5월 12일)', () => {
    const out = parseTicket('2026년 5월 12일');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('한글 공백 없음 (2026년5월12일)', () => {
    const out = parseTicket('2026년5월12일');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('하이픈 비패딩 (2026-5-12)', () => {
    const out = parseTicket('2026-5-12');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('슬래시 구분자 (2026/05/12)', () => {
    const out = parseTicket('2026/05/12');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('점+공백 구분자 (2026. 5. 12)', () => {
    const out = parseTicket('2026. 5. 12');
    expect(out.watchDate).toBe('2026-05-12');
  });

  it('2자리 연도 (26.5.12) → 거부', () => {
    const out = parseTicket('관람일 26.5.12');
    expect(Object.keys(out)).not.toContain('watchDate');
  });

  it('날짜 문자열에서 watchTime 오매칭 없음 (2026-05-12)', () => {
    const out = parseTicket('2026-05-12');
    expect(Object.keys(out)).not.toContain('watchTime');
  });

  it('파싱 불가 → watchDate 키 없음', () => {
    const out = parseTicket('인터스텔라\nCGV 용산\n어쩌구저쩌구');
    expect(Object.keys(out)).not.toContain('watchDate');
  });

  it('출력이 항상 /^\\d{4}-\\d{2}-\\d{2}$/ 또는 키 없음', () => {
    const cases = ['2026.5.12', '2026년 3월 7일', '2026-1-1', 'no date here'];
    for (const raw of cases) {
      const out = parseTicket(raw);
      if ('watchDate' in out) {
        expect(out.watchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

// U-2: watchTime 정규화
describe('parseTicket — watchTime 정규화', () => {
  it('오후 7:30 → 19:30', () => {
    expect(parseTicket('오후 7:30').watchTime).toBe('19:30');
  });

  it('오전 10:00 → 10:00', () => {
    expect(parseTicket('오전 10:00').watchTime).toBe('10:00');
  });

  it('오후 12:00 → 12:00 (정오)', () => {
    expect(parseTicket('오후 12:00').watchTime).toBe('12:00');
  });

  it('오전 12:00 → 00:00 (자정)', () => {
    expect(parseTicket('오전 12:00').watchTime).toBe('00:00');
  });

  it('오전 12:30 → 00:30', () => {
    expect(parseTicket('오전 12:30').watchTime).toBe('00:30');
  });

  it('7:30 PM → 19:30', () => {
    expect(parseTicket('7:30 PM').watchTime).toBe('19:30');
  });

  it('7:30 pm (소문자) → 19:30', () => {
    expect(parseTicket('7:30 pm').watchTime).toBe('19:30');
  });

  it('10:00 AM → 10:00', () => {
    expect(parseTicket('10:00 AM').watchTime).toBe('10:00');
  });

  it('24h 그대로 (19:30 → 19:30)', () => {
    expect(parseTicket('19:30').watchTime).toBe('19:30');
  });

  it('파싱 불가 → watchTime 키 없음', () => {
    const out = parseTicket('인터스텔라\n2026.5.12\nCGV 강남');
    expect(Object.keys(out)).not.toContain('watchTime');
  });

  it('출력이 항상 /^\\d{2}:\\d{2}$/ 또는 키 없음', () => {
    const cases = ['오후 7:30', '10:00 AM', '19:30', '오전 12:00', 'no time'];
    for (const raw of cases) {
      const out = parseTicket(raw);
      if ('watchTime' in out) {
        expect(out.watchTime).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });
});

// U-3: 구조적 제외 (보안 단언)
describe('parseTicket — seat/bookingNumber 구조적 제외', () => {
  it('raw에 좌석 정보가 있어도 seat 키 없음', () => {
    const out = parseTicket('인터스텔라\nCGV 강남\nG14, G15\n좌석 G14');
    expect(Object.keys(out)).not.toContain('seat');
  });

  it('raw에 예매번호가 있어도 bookingNumber 키 없음', () => {
    const out = parseTicket('인터스텔라\nT-20260510-0014\n예매번호 1234567890');
    expect(Object.keys(out)).not.toContain('bookingNumber');
  });

  it('복합 티켓 raw에서 5필드 외 키 없음', () => {
    const raw = [
      '인터스텔라',
      'CGV 용산아이파크몰',
      '2026.05.10 (토)',
      '14:00',
      'IMAX관',
      'A10, A11',
      'T-20260510-0099',
    ].join('\n');
    const out = parseTicket(raw);
    expect(Object.keys(out)).not.toContain('seat');
    expect(Object.keys(out)).not.toContain('bookingNumber');
    const allowed = new Set(['title', 'theater', 'screen', 'watchDate', 'watchTime']);
    for (const key of Object.keys(out)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});
