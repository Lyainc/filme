import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import type { MovieInfo, TicketComponents, TicketField, LayoutId } from '../src/types';

const FIELDS: TicketField[] = [
  'title',
  'titleOg',
  'actors',
  'watchDate',
  'watchTime',
  'theater',
  'screen',
  'seat',
  'runtime',
  'rating',
  'releaseDate',
  'reissue',
  'bookingNo',
  'edition',
];

const ALL_OFF = Object.fromEntries(FIELDS.map((field) => [field, false])) as Record<
  TicketField,
  boolean
>;

const MOVIE: MovieInfo = {
  title: 'TITLE',
  titleOg: 'ORIGINAL',
  releaseDate: '2026-05-01',
  releaseDateGranularity: 'date',
  releaseDateFormat: 'kr-compact',
  reissueDate: '2026-05-02',
  isReissue: true,
  watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact',
  watchTime: '20:30',
  theater: 'CGV',
  screen: 'IMAX',
  seat: 'G14',
  actors: 'Actor',
  rating: 4.5,
  runtime: '150 MIN',
  bookingNumber: 'BOOK-1234',
  serialNo: '0007',
  collectionNo: '03/12',
};

const BASE_COMPONENTS: TicketComponents = {
  layout: 'minimal',
  chain: '',
  format: '',
  texture: 'none',
  posterOpacity: 0.5,
  themeColor: '#FFFFFF',
  chainVisible: false,
  formatVisible: false,
};

const MOODS = [
  ['minimal', MoodMinimal],
  ['35mm', Mood35mm],
  ['criterion', MoodCriterion],
  ['editorial', MoodEditorial],
] as const;

const DATA_TOKENS = [
  'TITLE',
  'ORIGINAL',
  'Actor',
  '2026',
  '20:30',
  'CGV',
  'IMAX',
  'G14',
  '150 MIN',
  'BOOK-1234',
  'No.1234',
  '0007',
  '03/12',
  '4.5',
];

function renderMood(
  Mood: (props: {
    movieInfo: MovieInfo;
    components: TicketComponents;
    croppedImageUrl: string;
    fieldVisibility?: Record<TicketField, boolean>;
  }) => React.ReactElement,
  layout: LayoutId,
  fieldVisibility: Record<TicketField, boolean>
) {
  const html = renderToStaticMarkup(
    <Mood
      movieInfo={MOVIE}
      components={{ ...BASE_COMPONENTS, layout }}
      croppedImageUrl="blob:test"
      fieldVisibility={fieldVisibility}
    />
  );
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('fieldVisibility mood rendering', () => {
  test.each(MOODS)('%s hides data fields when every field is off', (layout, Mood) => {
    const text = renderMood(Mood, layout, ALL_OFF);

    for (const token of DATA_TOKENS) {
      expect(text).not.toContain(token);
    }
  });

  test('editorial screen and watchTime toggles render independently', () => {
    const screenOnly = renderMood(MoodEditorial, 'editorial', {
      ...ALL_OFF,
      screen: true,
    });
    const timeOnly = renderMood(MoodEditorial, 'editorial', {
      ...ALL_OFF,
      watchTime: true,
    });

    expect(screenOnly).toContain('Salle');
    expect(screenOnly).toContain('IMAX');
    expect(screenOnly).not.toContain('CGV');

    expect(timeOnly).toContain('Heure');
    expect(timeOnly).toContain('20:30');
    expect(timeOnly).not.toContain('2026');
  });
});
