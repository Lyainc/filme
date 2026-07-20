import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodStub } from '../src/components/moods/MoodStub';
import { FIELD_LABELS, LAUNCHER_GROUPS, launcherGroupsFor } from '../src/constants/fields';
import { ALL_FIELDS_ON } from '../src/constants/fieldVisibility';
import type { MoodProps } from '../src/components/moods/_shared';
import type { LayoutId, MovieInfo, TicketComponents, TicketField } from '../src/types';

// layout-aware 필드 런처 게이팅(#287, 에픽 #281). 무드 재동기화로 어떤 무드는 마스터 규격상 특정 필드를
// 렌더하지 않기 시작한다(첫 사례: #286에서 Minimal이 푸터 바코드=bookingNo 제거). 런처(FieldAccordion)가
// layout 구분 없이 전 무드 공용이면 그런 무드에 '죽은 컨트롤'(입력해도 티켓에 안 뜨는 편집 행)이 남는다.
// launcherGroupsFor(layout)가 그 무드가 실제 렌더하는 필드와 정확히 일치하는지를 무드 마크업 대조로 검증한다.

const FULL_MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈, 토니 레볼로리 외 3명', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2023-09-15', isReissue: true,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

const baseComponents = (layout: LayoutId): TicketComponents => ({
  layout, chain: '', format: '', chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  texture: 'none', textureIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, posterFit: 'cover',
});

const MOODS: Record<LayoutId, ComponentType<MoodProps>> = {
  minimal: MoodMinimal,
  criterion: MoodCriterion,
  '35mm': Mood35mm,
  editorial: MoodEditorial,
  stub: MoodStub,
  '35mm-landscape': Mood35mmLandscape,
};

// 런처가 다루는 전체 필드(적용성 판정 도메인) — LAUNCHER_GROUPS의 합집합.
const ELIGIBLE: TicketField[] = LAUNCHER_GROUPS.flatMap((g) => g.fields);

// 무드를 온-티켓 탭 모드(onField 있음)로 렌더하면 각 필드 FieldTap이 aria-label="{라벨} 편집"을 emit한다.
// 그 aria-label 존재 여부가 '무드가 이 필드를 실제 렌더하는가'의 ground-truth.
function renderedFields(layout: LayoutId): TicketField[] {
  const Mood = MOODS[layout];
  const markup = renderToStaticMarkup(
    <Mood
      movieInfo={FULL_MOVIE}
      components={baseComponents(layout)}
      croppedImageUrl="blob:x"
      fieldVisibility={ALL_FIELDS_ON}
      onField={() => {}}
    />
  );
  return ELIGIBLE.filter((f) => markup.includes(`aria-label="${FIELD_LABELS[f]} 편집"`));
}

const launcherFields = (layout: LayoutId): TicketField[] =>
  launcherGroupsFor(layout).flatMap((g) => g.fields);

describe('launcherGroupsFor 게이팅 로직 (#287)', () => {
  test('Minimal·35mm·35mm Wide는 bookingNo를 런처에서 제외한다', () => {
    expect(launcherFields('minimal')).not.toContain('bookingNo');
    expect(launcherFields('35mm')).not.toContain('bookingNo'); // #281 마스터 재동기화 — 푸터 바코드 제거
    expect(launcherFields('35mm-landscape')).not.toContain('bookingNo'); // #281 마스터 재동기화 — 바코드 없음
  });

  test('quote(한줄평)는 Criterion 전용 — 나머지 5무드는 런처에서 제외한다(#391)', () => {
    for (const layout of ['minimal', '35mm', 'editorial', 'stub', '35mm-landscape'] as LayoutId[]) {
      expect(launcherFields(layout)).not.toContain('quote');
    }
    expect(launcherFields('criterion')).toContain('quote');
  });

  test('제외해도 빈 그룹만 사라지고 남는 필드는 순서 보존', () => {
    // Minimal(bookingNo만 제외)·Criterion(watchTime만 제외) 모두 두 그룹이 다 남는다.
    expect(launcherGroupsFor('minimal').map((g) => g.title)).toEqual(['Film', 'Optional']);
    expect(launcherFields('criterion')).not.toContain('watchTime');
    expect(launcherFields('criterion')).toContain('runtime'); // #281 재동기화 — RUNTIME 셀 추가로 제외 해제
    expect(launcherFields('criterion')).toContain('seat'); // 나머지 Optional 필드는 보존
  });
});

describe('6무드 죽은 컨트롤 0건 — 런처 필드 = 무드 렌더 필드 (#287)', () => {
  for (const layout of Object.keys(MOODS) as LayoutId[]) {
    test(`${layout}: 런처가 노출하는 필드 = 무드가 실제 렌더하는 필드`, () => {
      expect(renderedFields(layout).sort()).toEqual(launcherFields(layout).sort());
    });
  }
});
