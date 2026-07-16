/**
 * buildShareMessage(#277)는 navigator.share·클립보드 폴백 두 공유 경로의
 * 단일 소스라, 여기서 한 번만 검증하면 두 경로 모두 같은 문구를 받는다는 게 보장된다
 * (호출부는 ResultPanel.tsx에서 두 경로 모두 이 함수를 그대로 통과시킴, 별도 가공 없음).
 */
import { describe, expect, test } from 'bun:test';
import { buildShareMessage, toNativeSharePayload } from '@/utils/shareMessage';
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

describe('toNativeSharePayload (#394 — navigator.share 카톡 자동 개행 방지)', () => {
  test('url이 있으면 text 끝에 공백으로 흡수하고, 별도 url 필드는 만들지 않는다', () => {
    const msg = buildShareMessage(
      { ...base, title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06' },
      'https://filme.app/t/abc',
    );
    const payload = toNativeSharePayload(msg);
    expect(payload).toEqual({
      title: '인터스텔라 포토티켓',
      text: '《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME. https://filme.app/t/abc',
    });
    expect('url' in payload).toBe(false);
  });

  test('url이 없으면 text를 그대로 둔다(끝에 공백 붙이지 않음)', () => {
    const msg = buildShareMessage({ ...base, title: '제목뿐' });
    const payload = toNativeSharePayload(msg);
    expect(payload.text).toBe('《제목뿐》 포토티켓 — made with FILME.');
  });
});
