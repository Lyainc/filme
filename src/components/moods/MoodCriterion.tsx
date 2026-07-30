import { CSSProperties, memo } from 'react';
import {
  CRITERION_PAPER,
  CRITERION_YELLOW,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  MoodProps,
  MoodWordmark,
  Poster,
  WORDMARK_ACCENT,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  posterTapProps,
  resolveTicketData,
  showFieldGhost,
  SignatureStamp,
  StampRow,
  measureTextWidth,
  truncateActorsToWidth,
  userTextFont,
  useFontsReady,
} from './_shared';

// 한줄평 폴백 2단계(#391) — 유저 입력이 없으면 평점(0.5 단위)별 프리셋, 평점도 없으면 기본 quote.
// 전문가 패널 결론: 프리셋·기본값은 항상 영문(무드 보이스 통일, 콘텐츠 비용은 Criterion 1세트로 절감).
// 톤: 카이에 뒤 시네마급까진 아니어도 "영화평론가의 한 줄 아포리즘" — 비유·위트를 섞어 평이한
// 감상평이 아니라 포스터 뒷면 인용구처럼 읽히게 한다(오빠 피드백, #391 재작업).
const RATING_QUOTES: Record<string, string> = {
  '0.5': 'two hours of my life, respectfully declined',
  '1': 'a film with the courage of no convictions',
  '1.5': 'the credits were the best part',
  '2': 'all style, no pulse',
  '2.5': 'watchable. forgettable. in that order',
  '3': 'competent — and that is the whole review',
  '3.5': 'sharper than its trailer let on',
  '4': 'the kind of film you quote at dinner',
  '4.5': 'nearly perfect, and knows it',
  '5': 'the film every other film will be measured against',
};
const DEFAULT_QUOTE = 'the paying customer is the last honest critic';

// 시안 색 하드코딩(#524 c8) — themeColor 파생을 버린다. 흰 종이 위 검정 잉크가 5c의 정체성이라
// 사용자 색이 끼면 무드가 성립하지 않는다. 죽은 ColorPicker는 TONE_FIXED_MOODS가 비활성화한다.
// 옐로(CRITERION_YELLOW)는 시안이 정확히 5곳(헤더 스퀘어·상단 룰·★·따옴표 쌍·콜로폰 짧은 룰)에만
// 쓴다. 잉크 계열은 LayoutPicker가 안 읽어 토큰으로 올리지 않고 여기 남는다.
const INK = '#14120f';
const INK_SOFT = 'rgba(20,18,15,.84)';
const INK_RULE = 'rgba(20,18,15,.4)';
const PLATE_BG = '#efeee9';
// 종이 그레인 — 시안은 `opacity:.6` 레이어 + rgba(...,.022)지만, 불투명 종이 위 단일 레이어라
// 알파를 곱해(.022×.6) 루트 배경에 합치면 픽셀은 같고 캔버스 전면 합성 레이어 하나가 준다.
const PAPER_GRAIN = `repeating-linear-gradient(0deg, rgba(20,18,15,.0132) 0 1px, transparent 1px 4px), ${CRITERION_PAPER}`;

const PAD = 84;
// 도판(플레이트) — 500×750 = 0.667(#525 룰 5). contain이라 표준 크롭에서 레터박스가 0으로 선다.
const PLATE_LEFT = 230;
const PLATE_TOP = 262;
const PLATE_W = 500;
const PLATE_H = 750;
// 도판 양감(#524 c7) — 4단 드롭 그림자. 무드 기본이라 항상 적용된다(#509의 유저 후가공과 별개).
// inset 헤어라인은 여기 있으면 안 된다(#576) — `box-shadow: inset`은 요소 background 위·**자식
// 콘텐츠 아래**에 깔리는데, 이 박스의 자식 `Poster`가 inset:0에 자기 background까지 칠해서
// 링을 통째로 덮었다(코드엔 있고 화면엔 없는 상태). PLATE_EDGE_RING으로 오버레이 형제에 올렸다.
const PLATE_SHADOW =
  '0 2px 3px rgba(20,18,15,.3), 0 14px 22px rgba(20,18,15,.26), 0 34px 54px rgba(20,18,15,.24), 0 70px 100px rgba(20,18,15,.16)';
/** 도판 헤어라인(#576) — 시안 값 그대로. 오버레이라 박스 크기를 안 건드려 0.667이 유지된다(#525 룰 5). */
const PLATE_EDGE_RING = 'inset 0 0 0 1px rgba(20,18,15,.22)';
const PLATE_GLOSS =
  'linear-gradient(116deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,.14) 13%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 74%, rgba(255,255,255,.14) 92%, rgba(255,255,255,.3) 100%)';

/**
 * 한줄평 장식 따옴표 크기(#577, 104 → 125). 좌상·우하 한 쌍이 같은 값을 읽어야 하므로 상수다.
 * 실측(브라우저, 자연px): `"` 한 글자의 span 박스는 fontSize의 0.317배 폭이라 125에서 39.6px —
 * 텍스트 인셋 96px 안에 들어간다(104에서 33px). 바꿀 땐 아래 한줄평 블록 주석의 예산을 다시 잰다.
 */
const QUOTE_MARK_SIZE = 125;

/**
 * 헤더·평점 메타 조판(#575) — `UNE SÉANCE`, 관람일, `/5`가 이 하나를 읽는다.
 * 서체가 Pretendard(FONT_KR)인 건 무드 루트와 같은 값으로 맞춘 의도적 결정이다(#575) —
 * 본문이 이미 시안의 세리프를 뒤집고 Pretendard로 갔는데(아래 "의도적 차이 2") 메타만 등폭이라
 * 반쪽만 이동한 상태였다. `#114`/`#129`의 "티켓 렌더 폰트는 디자인 의도라 유지" 정책에 대한
 * 무드 단위 예외이므로, 등폭으로 되돌릴 땐 그 정책이 아니라 이 결정을 근거로 다툴 것.
 */
const headerMeta: CSSProperties = { fontFamily: FONT_KR, fontSize: 13, fontWeight: 600, letterSpacing: 3 };
const colophonLine: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
/**
 * 콜로폰 조판(#566) — 배우 폭 예산(`castAvailW`)이 이 폰트로 측정하므로 스타일과 측정이 같은
 * 상수를 읽어야 한다. 리터럴을 렌더에 따로 심으면 한쪽만 바뀌어 조용히 틀린다(#572와 같은 부류).
 */
const COLOPHON_FONT = { fontFamily: FONT_KR, fontWeight: 600, fontSize: 17.5, letterSpacing: 0.9 };
const COLOPHON_SEP = ' · ';
/** 콜로폰 행 가용폭 — 렌더가 `left:PAD, right:PAD`로 잡는 그 폭(캔버스 TARGET_WIDTH 960). */
const COLOPHON_W = 960 - PAD * 2; // 792
/**
 * 콜로폰 폰트 하한(#566). 13은 이 무드가 헤더(headerMeta)에서 이미 쓰는 크기라 판권면에서
 * 이물감이 없는 선이다. #575로 헤더도 Pretendard가 되면서 이 근거는 **약해지지 않고 정확해졌다**
 * — 전엔 "등폭 13"과 "비례폭 13"을 견주는 거라 기준점이 실은 어긋나 있었는데, 이제 두 자리가
 * 같은 서체·같은 크기라 그대로 비교된다.
 * 2줄 × lineHeight 1.72라 줄어드는 방향으로는 푸터(≈top 1438)와 겹칠 일이 없다.
 *
 * 실측 갱신(`bun scripts/measure-actors-fit.mjs` 8케이스, Pretendard 기준): 8케이스 중 축소가
 * 걸리는 건 **긴 한글 2명 + 재개봉 ON 하나뿐이고 16에서 멎는다**(나머지 criterion 3케이스는
 * 17.5 그대로). 하한 13까지 세 단 남아 여유가 있다. 등폭 시절 근거였던 "최악 903px → 13/17.5배
 * = 671px" 수치는 서체가 바뀌어 더 이상 유효하지 않다 — 다시 잴 땐 px이 아니라 이 하네스가
 * 내는 fontSize를 기준으로 볼 것.
 *
 * **이 16이 `fitFontSizeToWidth`의 무한루프를 깨웠다**(#575). maxSize 17.5는 소수라 답이 정확히
 * 16(=floor(17.5))일 때 정수 mid가 lo에 갇혀 while이 안 끝났다. 등폭 시절엔 같은 케이스가 14로
 * 떨어져 우연히 비껴갔던 것뿐이다 — 근본 수정은 `_shared.tsx`의 `mid === lo` 탈출에 있고,
 * 여기서 maxSize를 소수로 유지하는 이상 그 가드에 의존한다.
 *
 * 축소는 2행(CAST가 서는 줄)의 폭으로 정하지만 **컨테이너에 걸어 1행까지 같이 줄인다** — 판권면
 * 조판에서 두 행의 크기가 갈리는 게 둘 다 작은 것보다 어색하다. 1행은 줄어드는 방향이라 자기
 * 예산을 새로 넘길 일이 없다.
 */
const COLOPHON_MIN_SIZE = 13;

/**
 * v5(Revue) — 시안 `Mood Redesign v5.dc.html` 5c 재설계(에픽 #524). 이전 v6(#497)의
 * "포스터 풀블리드 + 전면 스크림 + 더블룰 타이틀 블록 + 하단 caps 메타 그리드"를 통째로 버리고,
 * **흰 종이(#fdfdfc) 위에 도판을 한 장 올린 인쇄물**로 갈아엎는다.
 *
 * - 종이 그레인 베이스 + 잉크 #14120f 하드코딩(c8) — themeColor 파생·isInkDark 반전 전량 제거
 * - 헤더: 옐로 13×13 스퀘어 + UNE SÉANCE / 우측 관람일, 아래 옐로 3px 룰
 * - 마스트헤드: 제목 46/700 + 원제(Instrument Serif) / 우측 ★ 평점 50/700
 * - 도판: 500×750(0.667, #525 룰 5) + 4단 그림자·116deg 사선 글로스에 얹은 헤어라인(#576)·하단 5px 두께 엣지(c7)
 * - 한줄평: top1064 height190 **고정 블록** — 문구 길이가 변해도 따옴표(QUOTE_MARK_SIZE 125px, #577)는 좌상·우하에 고정
 * - 콜로폰: Pretendard 17.5 2줄(#575 — 시안·v5 초기값은 모노). 병합 줄은 fieldPieces로 분해해 필드별 탭 타깃·ghost 유지(c3)
 * - 푸터: 체인·포맷 스탬프(c5와 같은 자리) + made with FILME
 *
 * 시안과의 의도적 차이 2건:
 * (1) 콜로폰 1행 끝의 "70MM"은 푸터 포맷 스탬프와 같은 값이라 뺐다. 포맷은 로고 이미지가
 *     우선하는 스탬프라, 사용자가 로고를 올리면 푸터는 이미지·콜로폰은 텍스트로 갈린다.
 *     (관람일이 헤더·콜로폰에 두 번 찍히는 건 시안 그대로 둔다 — 양쪽 다 순수 텍스트라
 *     갈릴 표현이 없고, 인쇄물이 날짜를 머리와 판권면에 함께 찍는 건 자연스럽다.)
 * (2) 본문 서체는 시안의 Noto Serif KR 대신 Pretendard(FONT_KR)다 — c13 실측 결과는 커밋 메시지에.
 */
export const MoodCriterion = memo(function MoodCriterion({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 타이틀 폭 맞춤(#318) — 시안 46/700이 maxSize. 마스트헤드는 좌측 제목 블록과 우측 평점 블록이
  // 한 줄에 서므로 가용폭은 (960 - 84*2) - 평점 블록(약 180) - gap 24 ≈ 588. 2줄 클램프라
  // 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 축소한다.
  const fontsReady = useFontsReady();
  const titleSize = fitFontSizeToWidth(titleVal, 588 * 2, { fontFamily: FONT_KR, fontWeight: 700, minSize: 28, maxSize: 46 }, fontsReady);

  // 한줄평(#391) — 유저 입력 → 평점 구간(0.5 단위) 프리셋 → 기본 quote 순 폴백. 폰트는 서명과
  // 같은 userTextFont 분기(프리셋·기본값은 항상 영문이라 FONT_DISPLAY로 떨어진다)이되, #558부터
  // components.quoteFont가 그 자동분기를 덮을 수 있다(미설정=auto=기존 동작).
  const userQuoteVal = gate(fv?.quote, d.quote);
  const ratingQuoteKey = d.rating > 0 ? String(Math.round(d.rating * 2) / 2) : '';
  const quoteText = userQuoteVal || RATING_QUOTES[ratingQuoteKey] || DEFAULT_QUOTE;

  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating > 0, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);

  // 콜로폰 2줄 분해(c3) — 시안은 한 줄에 이어붙인 텍스트지만, 조각마다 제 FieldTap과 ghost를
  // 달아야 편집이 산다. 1행은 장소 · 관람일시(날짜+시간은 시안대로 공백으로 묶인 한 덩어리),
  // 2행은 러닝타임 · RELEASED 개봉일 · RE-RELEASED 재개봉일 · 출연.
  const venue = fieldPieces(
    [
      { field: 'theater', value: gate(fv?.theater, d.theater), ghost: showFieldGhost(fv?.theater, d.theater, ghost), label: 'THEATER' },
      { field: 'screen', value: gate(fv?.screen, d.screen), ghost: showFieldGhost(fv?.screen, d.screen, ghost), label: 'SCREEN' },
      { field: 'seat', value: gate(fv?.seat, d.seat), ghost: showFieldGhost(fv?.seat, d.seat, ghost), label: 'SEAT' },
    ],
    onField,
    { surface: 'paper' }
  );
  const screened = fieldPieces(
    [
      { field: 'watchDate', value: watchDateVal, ghost: gWatchDate, label: 'DATE' },
      { field: 'watchTime', value: gate(fv?.watchTime, d.watchTime), ghost: showFieldGhost(fv?.watchTime, d.watchTime, ghost), label: 'TIME' },
    ],
    onField,
    { sep: ' ', surface: 'paper' }
  );
  const reissueVal = gate(fv?.reissue, reissueClean);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  // 재개봉 편집 자리는 releaseDate 시트 안(reissue는 FIELD_SHEET_TYPE에 없어 단독 타깃이면 빈 시트).
  const releasedPiece = releaseDateVal && `RELEASED ${releaseDateVal}`;
  // 재개봉은 값이 있을 때만 자리를 얻는다(c6) — ghost를 안 주면 fieldPieces가 빈 값을 알아서 뺀다.
  const reissuePiece = reissueVal && `RE-RELEASED ${reissueVal}`;
  // 배우 폭 맞춤(#566) — CAST는 콜로폰 2행 **끝**에 서므로 예산은 행 폭에서 앞 조각들과 구분자를
  // 뺀 나머지다(앞 조각 개수가 재개봉 유무로 조건부라 상수로는 안 나온다). 자간 0.9는 양수라
  // COLOPHON_FONT로 측정에 함께 넘긴다(근거는 MeasureFontOptions.letterSpacing).
  // 앞 조각이 ghost면 텍스트가 아니라 점선 박스라 이 예산이 실제와 어긋나지만, 그 경우 행이
  // whiteSpace:normal로 줄바꿈하므로(아래 hasGhost 분기) 이름이 중간에서 잘릴 일 자체가 없다.
  const castPrefix = [runtimeVal, releasedPiece, reissuePiece].filter(Boolean).join(COLOPHON_SEP);
  const castAvailW = COLOPHON_W - measureTextWidth(castPrefix && castPrefix + COLOPHON_SEP, COLOPHON_FONT);
  const actorsVal = truncateActorsToWidth(gate(fv?.actors, d.actors), castAvailW, COLOPHON_FONT, fontsReady);
  // 2단계 — 좌석 폭 맞춤(#381)·라벨 폭 맞춤(#590)과 같은 순서다. 1단계의 하한(첫 이름 + `외 N명`)
  // 조차 안 들어가는 조합이 있다: 재개봉 ON이면 앞 조각이 627px을 먹어 CAST 몫이 165px뿐이라
  // 긴 라틴 이름 한 개가 실측 111px 넘쳤다(`bun scripts/measure-actors-fit.mjs`). 그때는 이름을
  // ellipsis로 자르는 대신 콜로폰 폰트를 줄여 행 전체를 예산 안에 넣는다.
  //
  // 축약이 끝난 문자열로 재므로 순서가 뒤집히면 안 된다 — 폰트를 먼저 줄이면 예산이 넓어져
  // 1단계가 더 많은 이름을 남기고, 그 결과로 다시 축소가 필요해지는 순환이 된다. 반대로 이
  // 순서는 1단계가 base 17.5 기준의 보수적인 개수를 고른 뒤 축소만 얹어 항상 수렴한다.
  const filmLineText = [castPrefix, actorsVal].filter(Boolean).join(COLOPHON_SEP);
  const colophonSize = fitFontSizeToWidth(
    filmLineText,
    // 자간 0.9는 양수라 예산에서 글자수만큼 먼저 뺀다(#590과 같은 규약).
    COLOPHON_W - COLOPHON_FONT.letterSpacing * filmLineText.length,
    { fontFamily: COLOPHON_FONT.fontFamily, fontWeight: COLOPHON_FONT.fontWeight, minSize: COLOPHON_MIN_SIZE, maxSize: COLOPHON_FONT.fontSize },
    fontsReady,
  );
  // 자간도 축소분만큼 비례로 줄인다(#590) — base 기준 트래킹을 작은 크기에 그대로 두면 예산을
  // 다시 넘긴다. 예산을 축소 전 자간으로 잡았으니 이 비례 축소는 항상 상한 안쪽으로만 움직인다.
  const colophonLetterSpacing = COLOPHON_FONT.letterSpacing * (colophonSize / COLOPHON_FONT.fontSize);
  const film = fieldPieces(
    [
      { field: 'runtime', value: runtimeVal, ghost: showFieldGhost(fv?.runtime, d.runtime, ghost), label: 'RUNTIME' },
      { field: 'releaseDate', value: releasedPiece, ghost: showFieldGhost(fv?.releaseDate, releaseClean, ghost), label: 'RELEASED' },
      { field: 'releaseDate', value: reissuePiece, label: 'RE-RELEASED' },
      { field: 'actors', value: actorsVal, ghost: showFieldGhost(fv?.actors, d.actors, ghost), label: 'CAST' },
    ],
    onField,
    { sep: COLOPHON_SEP, surface: 'paper' }
  );

  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER_GRAIN, color: INK, fontFamily: FONT_KR, overflow: 'hidden' }}>
      {/* 도판 — Mood35mm의 컷과 같은 계약. 컷이 정확히 0.667이라 표준 크롭(#525 룰 1)에서 레터박스가
          0이고, 사용자가 자연비 크롭을 골라 어긋나면 남는 자리를 blur 포스터 배경이 덮는다.
          componentOpacity 래퍼 **밖** — 포스터 축과 크롬 축은 독립(#219). */}
      <div style={{ position: 'absolute', left: PLATE_LEFT, top: PLATE_TOP, width: PLATE_W, height: PLATE_H, background: PLATE_BG, boxShadow: PLATE_SHADOW, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        <Poster
          src={croppedImageUrl}
          fit="contain"
          background={PLATE_BG}
          material={components.material}
          coating={components.coating}
          materialIntensity={components.materialIntensity}
          coatingIntensity={components.coatingIntensity}
          posterOpacity={components.posterOpacity}
        />
        {/* 글로스 + 헤어라인 — Poster **다음 형제**라 포스터 위에 선다(#576). data-poster-root
            바깥이라 저장 경로가 포스터 서브트리를 재합성해도(#439) 링이 사라지지 않는다. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: PLATE_GLOSS, boxShadow: PLATE_EDGE_RING }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(255,255,255,.22), rgba(20,18,15,.35))' }} />
      </div>

      {/* #219 componentOpacity: 포스터를 뺀 조판 전체를 함께 페이드. */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
        {/* 헤더 — 옐로 스퀘어 + UNE SÉANCE / 관람일 */}
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ width: 13, height: 13, background: CRITERION_YELLOW, display: 'block', flexShrink: 0 }} />
            <span style={{ ...headerMeta, fontWeight: 700, letterSpacing: 4.4, textTransform: 'uppercase' }}>une séance</span>
          </div>
          {watchDateVal ? (
            <FieldTap field="watchDate" onField={onField}>
              <span style={{ ...headerMeta, opacity: 0.6 }}>{watchDateVal}</span>
            </FieldTap>
          ) : gWatchDate ? (
            <FieldTap field="watchDate" onField={onField}>
              <FieldGhost text="WATCHED" width={150} height={20} surface="paper" state={gWatchDate} />
            </FieldTap>
          ) : null}
        </div>
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 94, height: 3, background: CRITERION_YELLOW }} />

        {/* 마스트헤드 — 제목/원제 + ★ 평점 */}
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 118, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            {titleVal ? (
              <FieldTap field="title" onField={onField}>
                <div style={{ fontWeight: 700, fontSize: titleSize, lineHeight: 1.1, letterSpacing: -1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleVal}</div>
              </FieldTap>
            ) : gTitle ? (
              <FieldTap field="title" onField={onField}>
                <FieldGhost text="TITLE" width={420} height={52} size={2} surface="paper" state={gTitle} />
              </FieldTap>
            ) : null}
            {titleOgVal ? (
              <FieldTap field="titleOg" onField={onField}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, letterSpacing: 4.5, textTransform: 'uppercase', opacity: 0.55, marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOgVal}</div>
              </FieldTap>
            ) : gTitleOg ? (
              <FieldTap field="titleOg" onField={onField}>
                <div style={{ marginTop: 8 }}>
                  <FieldGhost text="ORIGINAL TITLE" width={260} height={24} surface="paper" state={gTitleOg} />
                </div>
              </FieldTap>
            ) : null}
          </div>
          {ratingVisible ? (
            <FieldTap field="rating" onField={onField}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexShrink: 0 }}>
                <span style={{ fontSize: 26, lineHeight: 1, color: CRITERION_YELLOW }}>★</span>
                <span style={{ fontWeight: 700, fontSize: 50, lineHeight: 1, letterSpacing: -1.5 }}>{d.rating.toFixed(1)}</span>
                <span style={{ ...headerMeta, letterSpacing: 1.4, opacity: 0.5 }}>/5</span>
              </div>
            </FieldTap>
          ) : gRating ? (
            <FieldTap field="rating" onField={onField}>
              <FieldGhost text="RATING" width={130} height={44} surface="paper" state={gRating} />
            </FieldTap>
          ) : null}
        </div>

        {/* 한줄평 — 190px 고정 블록. 따옴표는 문구 길이와 무관하게 좌상·우하에 고정된다.
            안전 마진(v5 #524 기준으로 재산정 — 옛 675/696px 근거는 pull-quote 레이아웃과 함께
            사라졌다): 텍스트 폭 = 960 − PAD 84×2 − 인셋 96×2 = 600px, 50px/1.28이라 한 줄 64px →
            2줄 128px로 190 안에 62px 남는다. 3줄이면 192px라 넘친다.

            #558로 폰트가 4택이 됐지만 **줄 높이는 폰트와 무관하다** — lineHeight가 배수라 넷 다
            64px다. 갈리는 건 한 줄에 몇 자가 들어가느냐뿐이라, 폰트별로 다시 잰 건 무줄바꿈 폭이다
            (브라우저 실측, 600px 폭, 2026-07-27):
              · 프리셋 최장(영문 49자): 세리프 880 · 손글씨 820 · **고딕 1101px**
              · 기본 quote(영문 44자): 766 / 705 / 979px
              · 사용자 입력 최악(QUOTE_MAX_LENGTH 22자 — 한글 반복·M/W 반복): 셋 다 2줄에서 멈춤
            최악이 고딕 프리셋 1101px(=1.84줄)이라 3줄이 되려면 1200px를 넘겨야 한다(여유 9%).
            실제로 넘는 조합이 없어 클램프는 안 넣었다. 프리셋 문구를 늘리거나 fontSize·인셋·폰트
            후보를 건드리면 여기부터 다시 잰다 — **고딕(Pretendard)이 가장 넓어 기준선이다**.

            따옴표 104 → QUOTE_MARK_SIZE 125 재실측(브라우저, 자연px, 6조합):
              · 따옴표 span 박스 40×125 — 텍스트 인셋 96 안이라 인셋을 키울 필요가 없었다(104에선 33×104)
              · 줄 수는 전 조합 2줄 이하, 텍스트 잉크 폭 최대 596(기본 quote 고딕) ≤ 슬롯 600
              · 따옴표 잉크 ↔ 문구 잉크 겹침 0 — 좌상·우하에 그대로 앉는다
            위 표의 "22자는 셋 다 2줄에서 멈춤"은 **틀렸다**: 무공백 라틴(`W`×22)은 줄바꿈 기회가
            없어 1줄 1006.5px로 슬롯을 넘고 따옴표와 140px 겹쳤다(따옴표 크기와 무관한 기존 결함).
            아래 `overflowWrap: 'anywhere'`가 단어 안에서 끊어 2줄 594.8px·겹침 0으로 가둔다. */}
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 1064, height: 190 }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, fontFamily: FONT_DISPLAY, fontSize: QUOTE_MARK_SIZE, lineHeight: 1, color: CRITERION_YELLOW }}>&ldquo;</span>
          <span aria-hidden style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: FONT_DISPLAY, fontSize: QUOTE_MARK_SIZE, lineHeight: 1, color: CRITERION_YELLOW, transform: 'rotate(180deg)' }}>&ldquo;</span>
          {/* 실측 텍스트만 FieldTap 안에 남긴다(#417/#268) — InPlaceFieldEditor의 measureField가
              tap.firstElementChild 전체 박스를 재므로 장식 따옴표는 형제로 뺀다. */}
          <FieldTap field="quote" onField={onField}>
            <div
              style={{
                position: 'absolute',
                left: 96,
                right: 96,
                top: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                ...userTextFont(quoteText, components.quoteFont),
                fontSize: 50,
                lineHeight: 1.28,
                // 무공백 라틴 22자(`W`×22 등)는 줄바꿈 기회가 없어 슬롯 600을 넘고 따옴표와
                // 겹쳤다(실측 1006.5px, 겹침 140px). 단어 안에서도 끊어 예산 안에 가둔다(#577).
                overflowWrap: 'anywhere',
              }}
            >
              {quoteText}
            </div>
          </FieldTap>
        </div>

        {/* 서명 */}
        <div style={{ position: 'absolute', right: PAD, top: 1272, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 70, height: 1, background: INK_RULE, flexShrink: 0 }} />
          {components.signatureImage ? (
            <FieldTap field="signature" onField={onField}>
              <SignatureStamp image={components.signatureImage} height={48} scale={components.signatureScale ?? 1} surface="paper" />
            </FieldTap>
          ) : signatureVal ? (
            <FieldTap field="signature" onField={onField}>
              <span style={{ ...userTextFont(signatureVal), fontSize: 56, lineHeight: 1 }}>{signatureVal}</span>
            </FieldTap>
          ) : gSignature ? (
            <FieldTap field="signature" onField={onField}>
              <FieldGhost text="SIGNATURE" width={200} height={48} surface="paper" state={gSignature} />
            </FieldTap>
          ) : null}
        </div>

        {/* 콜로폰 */}
        <div style={{ position: 'absolute', left: PAD, top: 1358, width: 64, height: 3, background: CRITERION_YELLOW }} />
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 1370, ...COLOPHON_FONT, fontSize: colophonSize, letterSpacing: colophonLetterSpacing, lineHeight: 1.72, color: INK_SOFT }}>
          <div style={{ ...colophonLine, ...(venue.hasGhost || screened.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>
            {venue.node}
            {venue.hasAny && screened.hasAny ? ' · ' : null}
            {screened.node}
          </div>
          <div style={{ ...colophonLine, ...(film.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{film.node}</div>
        </div>

        {/* 푸터 — 체인·포맷 스탬프(c5와 같은 자리) + made with FILME */}
        <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <StampRow
              chain={components.chain}
              chainLabel={components.chainLabel}
              chainVisible={components.chainVisible}
              chainHeight={50}
              chainScale={components.chainScale ?? 1}
              format={components.format}
              formatLabel={components.formatLabel}
              formatVisible={components.formatVisible}
              formatSize={50 / 64}
              formatScale={components.formatScale ?? 1}
              surface="paper"
              ghost={ghost}
              onField={onField}
              dividerColor={INK}
              dividerOpacity={0.4}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, opacity: 0.8, flexShrink: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 23 }}>made with</span>
            {/* accent — 시안 5c의 `<dc-import name="Wordmark" ... accent="#B0423F">`를 그대로 반영(c1).
                흰 종이 위 워드마크만 BI 포인트 컬러("me")를 살리고, 35mm·35mm Wide는 시안 자체가
                accent 없이 크림 잉크 단색이라 의도된 무드별 차이다. */}
            <MoodWordmark size={23} color={INK} accent={WORDMARK_ACCENT} />
          </div>
        </div>
      </div>
    </div>
  );
});
