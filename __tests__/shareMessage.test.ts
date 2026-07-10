/**
 * buildShareMessage(#277)는 navigator.share·클립보드 폴백 두 공유 경로의
 * 단일 소스라, 여기서 한 번만 검증하면 두 경로 모두 같은 문구를 받는다는 게 보장된다
 * (호출부는 ResultPanel.tsx에서 두 경로 모두 이 함수를 그대로 통과시킴, 별도 가공 없음).
 */
import { describe, expect, test } from 'bun:test';
import { buildShareMessage } from '@/utils/shareMessage';
import type { MovieInfo } from '@/types';

const base: MovieInfo = { title: '', titleOg: '', rating: 0 };

describe('buildShareMessage (#277 앵커형: made with FILME)', () => {
  test('제목 + 원제(다름) + 연도 → 《제목》(원제, 연도) 포토티켓 — made with FILME.', () => {
    const msg = buildShareMessage(
      { ...base, title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06' },
      'https://filme.app/t/abc',
    );
    expect(msg.text).toBe('《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME.');
    expect(msg.title).toBe('인터스텔라 포토티켓');
    expect(msg.url).toBe('https://filme.app/t/abc');
  });

  test('원제가 한글 제목과 같으면 괄호에서 생략된다', () => {
    const msg = buildShareMessage({ ...base, title: '동일제목', titleOg: '동일제목', releaseDate: '2020' });
    expect(msg.text).toBe('《동일제목》(2020) 포토티켓 — made with FILME.');
  });

  test('제목만 있고 원제·연도 없으면 괄호 없이', () => {
    const msg = buildShareMessage({ ...base, title: '제목뿐' });
    expect(msg.text).toBe('《제목뿐》 포토티켓 — made with FILME.');
  });

  test('제목 없으면 폴백 — 포토티켓 — made with FILME.', () => {
    const msg = buildShareMessage(base);
    expect(msg.text).toBe('포토티켓 — made with FILME.');
    expect(msg.title).toBe('FILME 포토티켓');
    expect(msg.url).toBe('');
  });
});
