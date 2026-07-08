/**
 * #259 회귀 테스트 — 온-티켓 필드 탭 진입.
 *
 * 두 축을 4무드 전부에서 검증한다:
 * 1. onField 있음(모바일 default 줌): 제목을 탭하면 onField('title')이 불린다 — FieldTap 배선.
 * 2. onField/onPosterTap 없음(데스크톱/캡처 파이프라인): 무드 마크업에 role="button" 필드 래퍼도,
 *    data-poster-tap도 전혀 없다 — FieldTap이 순수 통과하므로 캡처 산출물에 탭 UI가 샐 수 없다는
 *    구조적 불변식(이슈 완료조건 "html-to-image 산출물에 포커스링 등이 새면 안 됨"의 코드 레벨 보증).
 * 3. 포스터 탭: onPosterTap이 있으면 풀블리드 무드는 root, editorial은 포스터 컬럼에 data-poster-tap이
 *    달리고 클릭 시 onPosterTap이 불린다.
 */
import React from 'react';
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodStub } from '../src/components/moods/MoodStub';
import type { MovieInfo, TicketComponents, TicketField } from '../src/types';
import { FIELD_SHEET_TYPE, isStampTarget, type SheetTarget } from '../src/constants/fields';

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;

const FULL_MOVIE: MovieInfo = {
  title: 'TITLEDATA', titleOg: 'ORIGINALDATA', actors: 'ActorData', rating: 4.5,
  releaseDate: '2026-05-01', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2026-05-02', isReissue: true,
  watchDate: '2026-05-03', watchDateFormat: 'kr-compact', watchTime: '20:30',
  theater: 'CGVDATA', screen: 'IMAXDATA', seat: 'G14', runtime: '150 MIN',
  bookingNumber: 'BOOK-1234', signature: 'SIGDATA',
};

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false,
};

type MoodFn = (props: {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
  fieldVisibility?: Record<TicketField, boolean>;
  ghost?: boolean;
  onField?: (f: SheetTarget) => void;
  onPosterTap?: () => void;
}) => React.ReactElement;

const MOODS: [string, MoodFn][] = [
  ['minimal', MoodMinimal],
  ['35mm', Mood35mm],
  ['criterion', MoodCriterion],
  ['editorial', MoodEditorial],
  ['stub', MoodStub],
  ['35mm-landscape', Mood35mmLandscape],
];

afterEach(cleanup);

describe('온-티켓 필드 탭 (#259)', () => {
  for (const [id, Mood] of MOODS) {
    test(`${id}: 제목 탭 → onField('title')`, () => {
      const calls: SheetTarget[] = [];
      render(
        <Mood
          movieInfo={FULL_MOVIE}
          components={{ ...BASE, layout: id as TicketComponents['layout'] }}
          croppedImageUrl="blob:x"
          fieldVisibility={ALL_ON}
          onField={(f) => calls.push(f)}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: '제목 편집' }));
      expect(calls).toEqual(['title']);
    });

    test(`${id}: 모든 필드 탭이 시트 있는 타깃으로 매핑 (빈 시트 dead-end 방지)`, () => {
      // 회귀: reissue처럼 FIELD_SHEET_TYPE에 없는 필드로 매핑하면 FieldEditorBody가 빈 시트를 연다.
      // 각 필드 탭을 눌러 onField가 넘기는 타깃이 전부 스탬프거나 시트 타입이 있는지 검증한다.
      const calls: SheetTarget[] = [];
      const { container } = render(
        <Mood
          movieInfo={FULL_MOVIE}
          components={{ ...BASE, layout: id as TicketComponents['layout'], chainVisible: true, formatVisible: true, chainLabel: 'CGV', formatLabel: 'IMAX' }}
          croppedImageUrl="blob:x"
          fieldVisibility={ALL_ON}
          onField={(f) => calls.push(f)}
        />
      );
      const taps = container.querySelectorAll('[role="button"][aria-label$="편집"]');
      expect(taps.length).toBeGreaterThan(0);
      taps.forEach((t) => fireEvent.click(t));
      const deadEnds = calls.filter((t) => !isStampTarget(t) && FIELD_SHEET_TYPE[t] == null);
      expect(deadEnds).toEqual([]);
    });

    test(`${id}: onField 없으면 필드 role=button·data-poster-tap 0건 (캡처 안전)`, () => {
      const html = renderToStaticMarkup(
        <Mood
          movieInfo={FULL_MOVIE}
          components={{ ...BASE, layout: id as TicketComponents['layout'] }}
          croppedImageUrl="blob:x"
          fieldVisibility={ALL_ON}
        />
      );
      expect(html).not.toContain('role="button"');
      expect(html).not.toContain('data-poster-tap');
    });
  }

  test('minimal(풀블리드): 포스터 root 탭 → onPosterTap', () => {
    let tapped = 0;
    const { container } = render(
      <MoodMinimal
        movieInfo={FULL_MOVIE}
        components={BASE}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onPosterTap={() => { tapped++; }}
      />
    );
    const poster = container.querySelector('[data-poster-tap]') as HTMLElement;
    expect(poster).toBeTruthy();
    fireEvent.click(poster);
    expect(tapped).toBe(1);
  });

  test('editorial(4열): 포스터 컬럼 탭 → onPosterTap', () => {
    let tapped = 0;
    const { container } = render(
      <MoodEditorial
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'editorial' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onPosterTap={() => { tapped++; }}
      />
    );
    const poster = container.querySelector('[data-poster-tap]') as HTMLElement;
    expect(poster).toBeTruthy();
    fireEvent.click(poster);
    expect(tapped).toBe(1);
  });
});

describe('MoodStub SCREEN 셀 분해 (#266 PR-B)', () => {
  // 분해 전 theater 하나의 FieldTap이 극장·상영관을 함께 삼켰다. 이제 조각별 FieldTap이라
  // theater 탭과 screen 탭이 각자 제 시트 타깃을 연다.
  test('theater 탭·screen 탭이 각자 제 시트 타깃을 연다', () => {
    const calls: SheetTarget[] = [];
    render(
      <MoodStub
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'stub' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '상영관 편집' }));
    expect(calls).toEqual(['theater', 'screen']);
  });

  // 캡처 파이프라인 유출 불변식(:104-115) — 분해 후에도 onField 없으면 탭 UI 0건이고,
  // theater·screen은 · 결합 텍스트로 그대로 렌더돼 산출물 픽셀이 보존된다.
  test('onField 없으면 role=button 0건 + · 결합 텍스트 보존(캡처 안전)', () => {
    const html = renderToStaticMarkup(
      <MoodStub
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'stub' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
      />
    );
    expect(html).not.toContain('role="button"');
    expect(html).toContain('CGVDATA · IMAXDATA');
  });
});

describe('중간 무드 병합 셀 분해 (#266 PR-C)', () => {
  // MoodStub PR-B 패턴을 Minimal·35mm·35mmLandscape에 복제. 장소(venue/exhibited)·시간
  // (screening/screened) 병합 셀이 필드별 독립 조각이라 각 필드 탭이 제 시트 타깃을 연다.
  const MID_MOODS: [string, MoodFn][] = [
    ['minimal', MoodMinimal],
    ['35mm', Mood35mm],
    ['35mm-landscape', Mood35mmLandscape],
  ];

  for (const [id, Mood] of MID_MOODS) {
    test(`${id}: 극장·상영관·좌석·관람일·시각 탭이 각자 제 시트 타깃을 연다`, () => {
      const calls: SheetTarget[] = [];
      render(
        <Mood
          movieInfo={FULL_MOVIE}
          components={{ ...BASE, layout: id as TicketComponents['layout'] }}
          croppedImageUrl="blob:x"
          fieldVisibility={ALL_ON}
          onField={(f) => calls.push(f)}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
      fireEvent.click(screen.getByRole('button', { name: '상영관 편집' }));
      fireEvent.click(screen.getByRole('button', { name: '좌석 편집' }));
      fireEvent.click(screen.getByRole('button', { name: '관람일 편집' }));
      fireEvent.click(screen.getByRole('button', { name: '관람 시간 편집' }));
      expect(calls).toEqual(['theater', 'screen', 'seat', 'watchDate', 'watchTime']);
    });

    // 캡처 유출 불변식(:104-115) — 분해 후에도 onField 없으면 탭 UI 0건이고, 조각이 · 결합 텍스트로
    // 그대로 렌더돼 산출물 픽셀이 보존된다(데스크톱 바이트 동일 근사).
    test(`${id}: onField 없으면 role=button 0건 + · 결합 텍스트 보존(캡처 안전)`, () => {
      const html = renderToStaticMarkup(
        <Mood
          movieInfo={FULL_MOVIE}
          components={{ ...BASE, layout: id as TicketComponents['layout'] }}
          croppedImageUrl="blob:x"
          fieldVisibility={ALL_ON}
        />
      );
      expect(html).not.toContain('role="button"');
      expect(html).toContain('CGVDATA · IMAXDATA'); // 극장·상영관 결합 텍스트 보존
    });
  }
});

describe('MoodCriterion VENUE 셀 분해 (#266 PR-D)', () => {
  // 분해 전 theater 하나의 FieldTap이 VENUE 셀(극장·상영관·좌석)을 통째로 삼켰다. 이제 조각별
  // FieldTap이라 세 필드 탭이 각자 제 시트 타깃을 연다. Criterion은 seat까지 셋을 병합하던 유일 무드.
  test('극장·상영관·좌석 탭이 각자 제 시트 타깃을 연다', () => {
    const calls: SheetTarget[] = [];
    render(
      <MoodCriterion
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'criterion' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '상영관 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '좌석 편집' }));
    expect(calls).toEqual(['theater', 'screen', 'seat']);
  });

  // 캡처 유출 불변식(:104-115) — onField 없으면 탭 UI 0건이고, 세 필드가 Criterion 고유 sep('  ·  ',
  // 양쪽 공백 2칸)로 결합돼 산출물 픽셀이 보존된다(MoodStub의 단일 공백 ·와 구별).
  test("onField 없으면 role=button 0건 + '  ·  ' 결합 텍스트 보존(캡처 안전)", () => {
    const html = renderToStaticMarkup(
      <MoodCriterion
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'criterion' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
      />
    );
    expect(html).not.toContain('role="button"');
    expect(html).toContain('CGVDATA  ·  IMAXDATA  ·  G14'); // 극장·상영관·좌석 2칸 sep 결합 보존
  });
});

describe('MoodEditorial 필드 탭 (#266, 마스터 재동기화 #281)', () => {
  // 마스터 4열 재구조 후에도 각 필드가 독립 FieldTap을 유지한다. theater=Théâtre 값, screen=그 sub,
  // watchDate=Séance 값, watchTime=도착시간(19:30), seat=스텁 place. 각 탭이 제 시트 타깃을 연다.
  test('극장·상영관·좌석·관람일·관람 시간 탭이 각자 제 시트 타깃을 연다', () => {
    const calls: SheetTarget[] = [];
    render(
      <MoodEditorial
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'editorial' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '상영관 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '좌석 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '관람일 편집' }));
    fireEvent.click(screen.getByRole('button', { name: '관람 시간 편집' }));
    expect(calls).toEqual(['theater', 'screen', 'seat', 'watchDate', 'watchTime']);
  });

  // 캡처 유출 불변식(:104-115) — onField 없으면 탭 UI 0건. Théâtre 셀은 극장(value)·상영관(sub) 각 줄에
  // 보존된다. 마스터 재동기화로 릴리즈 Reprise 병합선은 제거(메타 그리드 Sortie는 개봉일만).
  test('onField 없으면 role=button 0건 + Théâtre 극장·상영관 값 보존(캡처 안전)', () => {
    const html = renderToStaticMarkup(
      <MoodEditorial
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, layout: 'editorial' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
      />
    );
    expect(html).not.toContain('role="button"');
    expect(html).toContain('CGVDATA'); // 극장 value 줄 보존
    expect(html).toContain('IMAXDATA'); // 상영관 sub 줄 보존
  });
});
