import { describe, it, expect } from 'vitest';
import { parseTicket } from './parseTicket';
import { detectChain } from './detectChain';

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

// U-2b: watchDate — MM.DD 단축 형식
describe('parseTicket — watchDate MM.DD 단축 형식', () => {
  const year = new Date().getFullYear();

  it('06.07(일) → 현재연도-06-07', () => {
    expect(parseTicket('06.07(일)').watchDate).toBe(`${year}-06-07`);
  });

  it('06.03(수) → 현재연도-06-03', () => {
    expect(parseTicket('06.03(수)').watchDate).toBe(`${year}-06-03`);
  });

  it('06.06 (토) → 현재연도-06-06', () => {
    expect(parseTicket('06.06 (토)').watchDate).toBe(`${year}-06-06`);
  });

  it('06/02 → 현재연도-06-02', () => {
    expect(parseTicket('06/02').watchDate).toBe(`${year}-06-02`);
  });

  it('2026년이 있으면 연도 포함 파싱 우선 (2026.6.7)', () => {
    expect(parseTicket('2026.6.7').watchDate).toBe('2026-06-07');
  });

  it('26.5.12 (2자리 연도) → 연도 패턴 실패, MM.DD는 26월로 거부 → 키 없음', () => {
    expect(Object.keys(parseTicket('관람일 26.5.12'))).not.toContain('watchDate');
  });
});

// U-2c: watchTime — 범위 및 우선순위
describe('parseTicket — watchTime 범위/우선순위', () => {
  it('HH:MM ~ HH:MM 범위에서 시작 시간 추출', () => {
    expect(parseTicket('14:20 ~ 16:36').watchTime).toBe('14:20');
  });

  it('HH:MM - HH:MM 범위에서 시작 시간 추출 (대시)', () => {
    expect(parseTicket('11:35 -13:58').watchTime).toBe('11:35');
  });

  it('HH:MM~HH:MM 붙어있는 형식', () => {
    expect(parseTicket('08:25~10:27').watchTime).toBe('08:25');
  });

  it('오전/오후 가 범위보다 우선', () => {
    expect(parseTicket('오후 7:30\n14:20 ~ 16:36').watchTime).toBe('19:30');
  });
});

// U-2d: extractTitle 노이즈 필터
describe('parseTicket — title 노이즈 필터', () => {
  it('"오후"가 포함된 영화 제목은 스킵 안 함', () => {
    const out = parseTicket('고독의 오후');
    expect(out.title).toBe('고독의 오후');
  });

  it('상태바 연속 공백 줄은 title로 안 잡힘', () => {
    const raw = '1:54      8                     | 수\n고독의 오후\n06.03(수)';
    expect(parseTicket(raw).title).toBe('고독의 오후');
  });

  it('판매번호 줄은 title로 안 잡힘', () => {
    const raw = '판매번호 2026-0602-0429-6649\n인터스텔라';
    expect(parseTicket(raw).title).toBe('인터스텔라');
  });
});

// U-3: 출력 필드 화이트리스트 (7필드)
const ALLOWED = new Set([
  'title',
  'theater',
  'screen',
  'watchDate',
  'watchTime',
  'seat',
  'bookingNumber',
]);

describe('parseTicket — 출력 필드 화이트리스트', () => {
  it('허용된 7필드 외의 키는 절대 없음', () => {
    const raw = [
      '판매번호 2026-0510-0099-1234',
      '인터스텔라',
      '12세이상관람가',
      '2026.05.10 (토) 오후 2:00',
      '용산',
      'IMAX관',
      '일반 1',
      'G14',
    ].join('\n');
    const out = parseTicket(raw);
    for (const key of Object.keys(out)) {
      expect(ALLOWED.has(key)).toBe(true);
    }
  });
});

// U-4: 체인 감지
describe('detectChain', () => {
  it('판매번호/리필적립 → cgv', () => {
    expect(detectChain('판매번호 2026-0510\n리필적립')).toBe('cgv');
  });
  it('상영영화/상영관 → lotte', () => {
    expect(detectChain('상영영화\n상영관\n주차 안내사항')).toBe('lotte');
  });
  it('모바일오더/포토카드 → megabox', () => {
    expect(detectChain('모바일오더 포토카드 티켓북')).toBe('megabox');
  });
  it('신호 없음 → null', () => {
    expect(detectChain('인터스텔라\n2026.05.10')).toBeNull();
  });
});

// U-5: 체인별 필드 추출 (앵커 기반)
describe('parseTicket — CGV 추출', () => {
  const out = parseTicket(
    [
      '판매번호 2026-0510-0099-1234',
      '인터스텔라',
      '12세이상관람가',
      '2026.05.10 (토) 오후 2:00',
      '용산',
      'IMAX관',
      '일반 1',
      'G14',
    ].join('\n')
  );
  it('bookingNumber (판매번호 앵커)', () => expect(out.bookingNumber).toBe('2026-0510-0099-1234'));
  it('title (판매번호~rating 사이)', () => expect(out.title).toBe('인터스텔라'));
  it('theater = 지점', () => expect(out.theater).toBe('용산'));
  it('screen', () => expect(out.screen).toBe('IMAX관'));
  it('seat (문자+숫자)', () => expect(out.seat).toBe('G14'));
  it('watchDate', () => expect(out.watchDate).toBe('2026-05-10'));
  it('watchTime (오후 2:00 → 14:00)', () => expect(out.watchTime).toBe('14:00'));

  it('판매번호 그룹 길이 초과는 4자리로 정규화 (20264 → 2026)', () => {
    const o = parseTicket('판매번호 20264-0602-0429-6649\n리필적립');
    expect(o.bookingNumber).toBe('2026-0602-0429-6649');
  });

  it("'전도연관'처럼 한글 상영관도 screen으로 인식", () => {
    const o = parseTicket(
      ['판매번호 2026-0510-0099-1234', '영화', '12세이상관람가', '06.02 (수)', '강변', '전도연관[아트하우스]'].join('\n')
    );
    expect(o.screen).toContain('전도연관');
  });
});

describe('parseTicket — 롯데 추출', () => {
  const out = parseTicket(
    [
      '예매번호 1234-5678',
      '상영일 상영시간',
      '2026.05.12 (화) 14:20 ~ 16:36',
      '상영영화',
      '고독의 오후',
      '상영관',
      '광교 1관 [경기인디시네마] 관/아르떼',
      '좌석',
      'H2, H3',
      '성인 2',
    ].join('\n')
  );
  it('bookingNumber (예매번호 앵커)', () => expect(out.bookingNumber).toBe('1234-5678'));
  it('title (상영영화 다음 줄)', () => expect(out.title).toBe('고독의 오후'));
  it('theater = 지점만', () => expect(out.theater).toBe('광교'));
  it('screen = 관 상세', () => expect(out.screen).toBe('1관 [경기인디시네마] 관/아르떼'));
  it('seat (상영관/좌석 라벨 앵커)', () => expect(out.seat).toBe('H2, H3'));
  it('watchTime = 범위 시작 (14:20)', () => expect(out.watchTime).toBe('14:20'));
});

describe('parseTicket — 메가박스 추출', () => {
  const out = parseTicket(
    [
      '9964-035-29364',
      '[굿즈증정] 콜럼버스',
      '입장 08',
      '코엑스',
      '디즈니시네마 11관(르 리클라이너)',
      '상영일 상영시간',
      '2026.05.06 (수) 11:00 ~ 13:00',
      '좌석',
      'E12',
      '성인 1',
      '모바일오더 포토카드 티켓북',
    ].join('\n')
  );
  it('bookingNumber (4-3-5 패턴)', () => expect(out.bookingNumber).toBe('9964-035-29364'));
  it('title ([배지] 제거)', () => expect(out.title).toBe('콜럼버스'));
  it('theater = 지점', () => expect(out.theater).toBe('코엑스'));
  it('screen (N관 포함)', () => expect(out.screen).toBe('디즈니시네마 11관(르 리클라이너)'));
  it('seat', () => expect(out.seat).toBe('E12'));
  it('watchTime = 범위 시작 (11:00)', () => expect(out.watchTime).toBe('11:00'));
});

describe('parseTicket — seat 보수적 게이트', () => {
  it('숫자만(문자 없음)인 좌석은 버림', () => {
    const raw = ['예매번호 1', '상영영화', '영화', '상영관', '광교 1관', '좌석', '12 13', '성인 2'].join('\n');
    expect(Object.keys(parseTicket(raw))).not.toContain('seat');
  });
});
