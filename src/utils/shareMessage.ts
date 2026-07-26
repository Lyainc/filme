import type { MovieInfo } from '@/types';

/** buildShareMessage가 실제로 읽는 필드만 — /t/[id] 랜딩처럼 meta JSON(title/titleOg/releaseDate만
 * 있음)만 갖고도 재사용할 수 있게 전체 MovieInfo 대신 좁힌 타입을 받는다(#438). */
type ShareMovieInfo = Pick<MovieInfo, 'title' | 'titleOg' | 'releaseDate' | 'reissueDate'>;

export interface ShareMessage {
  /** 공유 본문 — permalink 유무와 무관하게 항상 생성한다. */
  text: string;
  /** 호출부가 발급한 permalink. 없으면 빈 문자열. */
  url: string;
}

/**
 * releaseDate는 가변 길이 ISO('1994' | '1994-11' | '1994-11-06')라 앞 4자리만 연도로 뽑는다.
 * 원작 식별엔 개봉 연도가 더 유효해 releaseDate를 우선하고, 없으면 재개봉일로 떨어진다.
 */
function extractYear(movieInfo: ShareMovieInfo): string {
  const source = movieInfo.releaseDate || movieInfo.reissueDate || '';
  const match = /^(\d{4})/.exec(source);
  return match ? match[1] : '';
}

/**
 * navigator.share·클립보드 폴백이 공유하는 단일 소스 공유 문구.
 *
 * 제목·원제(제목과 다를 때만)·연도를 묶고, 티켓 푸터 서명 문구 'made with FILME'를 앵커로
 * 붙인다(#277) — 라벨형·서술형 후보 대신 앵커형을 채택한 건 티켓 실물의 푸터 서명과 공유
 * 문구가 같은 꼬리표로 끝나야 티켓↔공유 브랜드가 한 목소리로 읽히기 때문. 후킹은 링크
 * 프리뷰 이미지(티켓 자체)에 맡기고 문구는 담백하게 유지한다. permalink는 인자로 받아
 * url에 그대로 싣고, 없으면 빈 문자열 — 링크 발급은 호출부 책임이다(문구 자체는 항상 생성).
 *
 * 예) buildShareMessage({ title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06', ... }, 'https://filme.app/t/abc')
 *  → { text: '《인터스텔라》(Interstellar, 2014) 포토티켓 — made with FILME.',
 *      url: 'https://filme.app/t/abc' }
 */
export function buildShareMessage(
  movieInfo: ShareMovieInfo,
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
    text = `${labeled} 포토티켓 — made with FILME.`;
  } else {
    text = '포토티켓 — made with FILME.';
  }

  return { text, url: permalink ?? '' };
}

/**
 * `navigator.share()`에 넘길 payload — **필드가 하나뿐이어야 한다.**
 *
 * 개행의 원인은 특정 필드가 아니라 텍스트로 이어질 필드가 둘 이상이라는 것 자체다: 플랫폼이
 * `title`/`text`/`url`을 수신 앱에 넘길 때 `\n`으로 이어 붙인다(파일 공유 경로처럼 `text`가
 * 아예 없으면 이을 게 없어 무관하다 — `shareTicketAsJpeg`). #394는 Android Chrome이 `text`+`url`을 합치는 걸
 * 보고 `url`만 `text`에 흡수시켰는데, `title`이 두 번째 필드로 남아 있어 iOS에서 같은 방식으로
 * 개행이 재발했다(#504). 그래서 `title`은 payload에서도, `ShareMessage`에서도 없앴다 —
 * 필드를 되살릴 수 없게 만드는 게 이 회귀를 못 쓰게 만드는 유일한 방법이다. 제목 정보는
 * 이미 `text`의 《제목》에 들어 있고, 링크 프리뷰 카드는 /t/[id]의 og 태그가 만든다.
 *
 * 반환 타입에 `text` 외의 키를 추가하지 말 것 — 그게 곧 #394/#504의 재발이다.
 */
export function toNativeSharePayload(message: ShareMessage): { text: string } {
  return { text: message.url ? `${message.text} ${message.url}` : message.text };
}
