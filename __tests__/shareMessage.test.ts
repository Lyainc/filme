/**
 * buildShareMessage(#277)는 navigator.share·클립보드 폴백 두 공유 경로의
 * 단일 소스라, 여기서 한 번만 검증하면 두 경로 모두 같은 문구를 받는다는 게 보장된다
 * (호출부는 ResultPanel.tsx에서 두 경로 모두 이 함수를 그대로 통과시킴, 별도 가공 없음).
 *
 * 파일 하단의 '실제 조립 경로' describe는 #504가 왜 났는지를 남긴다 — #394의 고침이
 * 헬퍼 반환값만 검증했고 **navigator.share에 실제로 도달하는 객체의 필드 수**를 아무도
 * 안 봤기 때문에, `title`이 두 번째 필드로 남은 채 통과했다. 그래서 아래 테스트는
 * 문자열이 아니라 **키 집합**을 고정한다.
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildShareMessage, toNativeSharePayload } from '@/utils/shareMessage';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const base: MovieInfo = { title: '', titleOg: '', rating: 0 };

describe('buildShareMessage (#277 앵커형: made with FILME)', () => {
  test('제목 + 원제(다름) + 연도 → 《제목》(원제, 연도) 포토티켓 — made with FILME.', () => {
    const msg = buildShareMessage(
      { ...base, title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06' },
      'https://filme.app/t/abc',
    );
    expect(msg.text).toBe('《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME.');
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
    expect(msg.url).toBe('');
  });
});

describe('toNativeSharePayload (#394·#504 — navigator.share 개행 방지)', () => {
  test('url이 있으면 text 끝에 공백으로 흡수하고, 필드는 text 하나뿐이다', () => {
    const msg = buildShareMessage(
      { ...base, title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06' },
      'https://filme.app/t/abc',
    );
    const payload = toNativeSharePayload(msg);
    // 키 집합 고정이 이 테스트의 핵심 — 문자열이 맞아도 필드가 둘이면 플랫폼이 개행으로 합친다.
    expect(Object.keys(payload)).toEqual(['text']);
    expect(payload.text).toBe(
      '《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME. https://filme.app/t/abc',
    );
  });

  test('url이 없으면 text를 그대로 둔다(끝에 공백 붙이지 않음)', () => {
    const msg = buildShareMessage({ ...base, title: '제목뿐' });
    const payload = toNativeSharePayload(msg);
    expect(Object.keys(payload)).toEqual(['text']);
    expect(payload.text).toBe('《제목뿐》 포토티켓 — made with FILME.');
  });
});

/* ── 실제 조립 경로 (#504) ────────────────────────────────────────────────────
 * 위 유닛 테스트만으로는 #394가 무너진 이유를 못 잡는다 — 헬퍼가 옳아도 호출부가 필드를
 * 하나 더 얹으면 개행은 그대로 재발한다. 그래서 ResultPanel의 '공유' 버튼을 실제로 눌러
 * navigator.share가 **받은 객체 자체**를 붙잡고 키 집합을 검사한다.
 *
 * TicketRenderer만 스텁(ResizeObserver·무드 DOM 회피)이고 캡처 모듈은 건드리지 않는다 —
 * `captureNodeToJpeg`를 mock.module로 덮으면 bun의 파일 간 누수로 captureOpaqueBackdrop 등
 * 실제 캡처 테스트가 같이 무너진다(resultPanelShareGating.test.tsx가 같은 이유로 그 함수만
 * 실제 구현을 남겨둔다). 그래서 happy-dom에선 발급이 실패해 payload에 링크가 안 실린다 —
 * 링크 흡수 문자열은 위 유닛 테스트가 보고, 여기서 볼 건 **필드가 몇 개냐**다.
 */
const React = require('react') as typeof import('react');

let ResultPanel: typeof import('@/components/v2/ResultPanel').ResultPanel;
let realTicketRenderer: typeof import('@/components/TicketRenderer');

beforeAll(() => {
  // 스프레드 스냅샷 — 살아있는 네임스페이스를 붙들면 mock.module이 그 객체를 제자리에서 갈아끼워
  // afterAll 복원이 no-op이 된다(#611, resultPanelShareGating.test.tsx에 같은 주석).
  realTicketRenderer = { ...require('@/components/TicketRenderer') };
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
  ResultPanel = require('@/components/v2/ResultPanel').ResultPanel;
});

// navigator.share는 happy-dom 글로벌이라 스텁을 남기면 뒤에 도는 파일이 클립보드 폴백 대신
// share 분기를 타게 된다(mock.module과 같은 누수 계열) — 원래 서술자로 되돌린다.
const originalShareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');

afterEach(() => cleanup());
afterAll(() => {
  mock.module('@/components/TicketRenderer', () => realTicketRenderer);
  if (originalShareDescriptor) Object.defineProperty(navigator, 'share', originalShareDescriptor);
  else delete (navigator as { share?: unknown }).share;
});

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature', 'quote',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;

const MOVIE: MovieInfo = {
  ...base,
  title: '인터스텔라',
  titleOg: 'Interstellar',
  releaseDate: '2014-11-06',
};
const COMPONENTS: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1,
  posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, chainScale: 1, formatScale: 1,
};

describe('ResultPanel → navigator.share 실제 조립 경로 (#504: #394가 무너진 지점)', () => {
  test("'공유' 클릭 시 navigator.share가 받는 객체는 text 단일 필드이고 개행이 없다", async () => {
    const calls: Record<string, unknown>[] = [];
    Object.defineProperty(navigator, 'share', {
      value: (data: Record<string, unknown>) => {
        calls.push(data);
        return Promise.resolve();
      },
      configurable: true,
      writable: true,
    });

    const user = userEvent.setup();
    render(
      React.createElement(ResultPanel, {
        croppedImageUrl: 'blob:fake',
        movieInfo: MOVIE,
        components: COMPONENTS,
        fieldVisibility: ALL_ON,
      }),
    );

    await user.click(await screen.findByRole('button', { name: '공유' }));
    await waitFor(() => expect(calls.length).toBe(1));

    const payload = calls[0];
    // #394는 url을 지웠지만 title이 남아 필드가 둘이었고, iOS가 그 둘을 개행으로 합쳤다(#504).
    // 필드가 하나라는 것 자체가 불변 조건 — title/url을 다시 얹으면 여기서 깨진다.
    expect(Object.keys(payload)).toEqual(['text']);
    // happy-dom에선 캡처가 실패해 링크 발급이 안 되므로 문구만 실린다(파일 상단 주석) —
    // 그래도 "한 문자열, 개행 없음, 꼬리 공백 없음"은 여기서 그대로 확인된다.
    expect(payload.text).toBe('《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME.');
    expect(String(payload.text)).not.toContain('\n');
  });
});
