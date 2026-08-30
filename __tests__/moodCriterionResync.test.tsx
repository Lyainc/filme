import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { CRITERION_PAPER, CRITERION_YELLOW } from '../src/components/moods/_shared';
import { QUOTE_MAX_LENGTH } from '../src/constants/fields';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// v5(Revue) 시안 `Mood Redesign v5.dc.html` 5c 재동기화 회귀(#524). 이전 v6(#497)의 포스터
// 풀블리드 + 전면 스크림 + 더블룰 타이틀 블록 + 하단 caps 메타 그리드가 통째로 폐기되고,
// 흰 종이 위 도판 한 장 구조가 된다. stale로 되돌아오면 여기서 잡는다.

const BASE = makeMoodBase('criterion');

const markup = () =>
  renderToStaticMarkup(
    <MoodCriterion movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('MoodCriterion v5 Revue 재설계 (#524)', () => {
  test('종이 베이스 — 흰 바탕 + 잉크 하드코딩, 풀블리드 스크림 폐기', () => {
    const html = markup();
    expect(html).toContain(CRITERION_PAPER);
    expect(html).toContain('color:#14120f');
    // 구 globalScrim(전면 그라디언트 오버레이)의 시그니처가 남아 있으면 스테일.
    expect(html).not.toContain('rgba(245,240,232,0.45)');
  });

  test('헤더 — 옐로 스퀘어 + UNE SÉANCE / 관람일, 옐로 3px 룰', () => {
    const html = markup();
    expect(html).toContain('une séance');
    expect(html).toContain('top:56px');
    expect(html).toContain(`top:94px;height:3px;background:${CRITERION_YELLOW}`);
  });

  test('마스트헤드 — 제목 46/700 + ★ 평점 50/700', () => {
    const html = markup();
    expect(html).toContain('top:118px');
    expect(html).toContain('font-size:46px');
    expect(html).toContain('font-size:50px;line-height:1;letter-spacing:-1.5px');
    expect(html).toContain('4.5');
    // 분모 재추가 회귀 방어(#752) — criterion만 "/5"를 그려 나머지 5무드(★ N.N)와 표기가
    // 어긋났던 문제. 별+숫자만 남는 게 맞고, /5가 되살아나면 이 단언이 잡는다.
    expect(html).not.toContain('/5</span>');
  });

  test('도판 — left230 top262 500×750(0.667) + 4단 그림자 · 사선 글로스 · 하단 두께 엣지', () => {
    const html = markup();
    expect(html).toContain('left:230px;top:262px;width:500px;height:750px');
    expect(html).toContain('0 70px 100px rgba(20,18,15,.16)'); // 4단 그림자 마지막 단
    expect(html).toContain('linear-gradient(116deg'); // 사선 글로스
    // 헤어라인은 플레이트 박스가 아니라 **글로스 오버레이**에 실려야 한다(#576) — 플레이트에 두면
    // inset이 자식 Poster 아래에 깔려 화면에서 사라진다. 같은 style 속성 안에 둘이 함께 있는지로
    // 판정한다(문자열 존재만 보면 플레이트로 되돌아가도 통과한다).
    expect(html).toMatch(/linear-gradient\(116deg[^"]*box-shadow:inset 0 0 0 1px rgba\(20,18,15,\.22\)/);
    expect(html).not.toMatch(/box-shadow:0 2px 3px[^"]*inset 0 0 0 1px/); // 플레이트 그림자엔 없다
    expect(html).toContain('height:5px'); // 하단 두께 엣지
  });

  test('한줄평 — top1064 height190 고정 블록 + 125px 옐로 따옴표 좌상·우하 (#577)', () => {
    const html = markup();
    expect(html).toContain('top:1064px;height:190px');
    expect(html).toMatch(new RegExp(`left:0;top:0;font-family:var\\(--font-display\\)[^"]*font-size:125px;line-height:1;color:${CRITERION_YELLOW}`));
    expect(html).toMatch(/right:0;bottom:0;font-family:var\(--font-display\)[^"]*font-size:125px/);
    expect(html).toContain('rotate(180deg)');
    // 무공백 라틴 입력이 슬롯을 넘어 따옴표와 겹치던 회귀 방어(#577 실측 1006.5px → 594.8px).
    expect(html).toContain('overflow-wrap:anywhere');
  });

  // 상한 재도출 + 하드 캡(#754) — 22자 시절 우연히 2줄에 걸리던 무공백 최악 입력이 31자에서도
  // 3줄로 새는 걸 line-clamp가 막는다. 값·CSS 둘 다 되돌아가면 여기서 잡는다.
  test('한줄평 — 상한 31자(#754) + 2줄 하드 캡(WebkitLineClamp)', () => {
    expect(QUOTE_MAX_LENGTH).toBe(31);
    const html = markup();
    expect(html).toContain('display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden');
  });

  test('서명 56px + 콜로폰 룰(top1358) · 모노 17.5 2줄(top1370)', () => {
    const html = markup();
    expect(html).toContain('font-size:56px');
    expect(html).toContain(`top:1358px;width:64px;height:3px;background:${CRITERION_YELLOW}`);
    expect(html).toContain('top:1370px');
    expect(html).toContain('font-size:17.5px');
    expect(html).toContain('영화수집가');
  });

  test('콜로폰 2줄이 fieldPieces로 분해 — 필드별 탭 타깃 (#524 c3)', () => {
    const html = markup();
    // 1행: 극장 · 상영관 · 좌석 · 관람일 관람시간 (조각별 FieldTap이라 결합 텍스트 보존은
    // onField 없는 캡처 경로에서 검증한다 — onTicketFieldTap.test의 "· 결합 텍스트 보존").
    expect(html).toContain('메가박스 코엑스');
    expect(html).toContain('Dolby Cinema');
    expect(html).toContain('G14');
    expect(html).toContain('극장 편집');
    expect(html).toContain('상영관 편집');
    expect(html).toContain('좌석 편집');
    expect(html).toContain('관람 시간 편집'); // v5에서 watchTime 렌더 복귀
    // 2행: 러닝타임 · RELEASED 개봉일 · RE-RELEASED 재개봉일 · 출연
    expect(html).toContain('99분');
    expect(html).toContain('RELEASED');
    expect(html).toContain('RE-RELEASED');
    expect(html).toContain('러닝타임 편집');
    expect(html).toContain('출연 편집');
  });

  test('푸터 — 체인·포맷 스탬프 + made with FILME(BI v2 워드마크)', () => {
    const html = markup();
    expect(html).toContain('bottom:48px');
    expect(html).toContain('MEGABOX');
    expect(html).toContain('DOLBY');
    expect(html).toMatch(/made with<\/span><span aria-label="FILME"/);
  });

  test('옐로 액센트는 정확히 5곳 — 스퀘어 · 상단 룰 · ★ · 따옴표 쌍 · 콜로폰 룰', () => {
    const hits = markup().split(CRITERION_YELLOW).length - 1;
    // 따옴표는 좌상·우하 2개 엘리먼트가 한 자리(쌍)를 이룬다 → 엘리먼트 수는 6.
    expect(hits).toBe(6);
  });

  test('v6(#497) 구조 잔재 없음 — 더블룰 타이틀 블록 · caps 메타 그리드 · 스파인', () => {
    const html = markup();
    expect(html).not.toContain('left:64px'); // 구 타이틀/하단 블록 좌표
    expect(html).not.toContain('VENUE'); // 구 caps 메타 라벨
    expect(html).not.toContain('WATCHED');
    expect(html).not.toContain('collected by'); // 구 서명 라벨(시안엔 룰만)
    expect(html).not.toContain('writing-mode:vertical-rl'); // 스파인 세로 바코드
    expect(html).not.toContain('예매 번호 편집'); // bookingNo 미렌더 유지
  });
});
