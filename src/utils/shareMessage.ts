import type { MovieInfo } from '@/types';

export interface ShareMessage {
  /** OS 공유 시트·플랫폼 제목 슬롯에 들어갈 짧은 제목. */
  title: string;
  /** 공유 본문 — permalink 유무와 무관하게 항상 생성한다. */
  text: string;
  /** 호출부가 발급한 permalink. 없으면 빈 문자열. */
  url: string;
}

/**
 * releaseDate는 가변 길이 ISO('1994' | '1994-11' | '1994-11-06')라 앞 4자리만 연도로 뽑는다.
 * 원작 식별엔 개봉 연도가 더 유효해 releaseDate를 우선하고, 없으면 재개봉일로 떨어진다.
 */
function extractYear(movieInfo: MovieInfo): string {
  const source = movieInfo.releaseDate || movieInfo.reissueDate || '';
  const match = /^(\d{4})/.exec(source);
  return match ? match[1] : '';
}

/**
 * X 인텐트·navigator.share·클립보드 폴백이 공유하는 단일 소스 공유 문구.
 *
 * 제목·원제(제목과 다를 때만)·연도를 묶어 한 문장으로 만든다. permalink는 인자로 받아
 * url에 그대로 싣고, 없으면 빈 문자열 — 링크 발급은 호출부 책임이다(문구 자체는 항상 생성).
 *
 * 예) buildShareMessage({ title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06', ... }, 'https://filme.app/t/abc')
 *  → { title: '인터스텔라 포토티켓',
 *      text: '《인터스텔라》(Interstellar, 2014), FILME로 만든 포토티켓이에요.',
 *      url: 'https://filme.app/t/abc' }
 */
export function buildShareMessage(
  movieInfo: MovieInfo,
  permalink?: string | null
): ShareMessage {
  const movieTitle = movieInfo.title?.trim() ?? '';
  const og = movieInfo.titleOg?.trim() ?? '';
  const year = extractYear(movieInfo);

  let text: string;
  if (movieTitle) {
    // 원제는 한글 제목과 다를 때만, 연도와 함께 괄호로 묶는다.
    const meta = [og && og !== movieTitle ? og : '', year].filter(Boolean).join(', ');
    const labeled = meta ? `《${movieTitle}》(${meta})` : `《${movieTitle}》`;
    text = `${labeled}, FILME로 만든 포토티켓이에요.`;
  } else {
    text = 'FILME로 만든 포토티켓이에요.';
  }

  const title = movieTitle ? `${movieTitle} 포토티켓` : 'FILME 포토티켓';

  return { title, text, url: permalink ?? '' };
}
