import { CSSProperties, memo } from 'react';
import {
  CRITERION_PAPER,
  CRITERION_YELLOW,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
  FONT_QUOTE_KR,
  MoodProps,
  MoodWordmark,
  Poster,
  WORDMARK_ACCENT,
  containsHangul,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  posterTapProps,
  resolveTicketData,
  showFieldGhost,
  SignatureStamp,
  StampRow,
  truncateActors,
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
// 도판 양감(#524 c7) — 4단 그림자 + inset 엣지. 무드 기본이라 항상 적용된다(#509의 유저 후가공과 별개).
const PLATE_SHADOW =
  '0 2px 3px rgba(20,18,15,.3), 0 14px 22px rgba(20,18,15,.26), 0 34px 54px rgba(20,18,15,.24), 0 70px 100px rgba(20,18,15,.16), inset 0 0 0 1px rgba(20,18,15,.22)';
const PLATE_GLOSS =
  'linear-gradient(116deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,.14) 13%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 74%, rgba(255,255,255,.14) 92%, rgba(255,255,255,.3) 100%)';

const headerMeta: CSSProperties = { fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, letterSpacing: 3 };
const colophonLine: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/**
 * v5(Revue) — 시안 `Mood Redesign v5.dc.html` 5c 재설계(에픽 #524). 이전 v6(#497)의
 * "포스터 풀블리드 + 전면 스크림 + 더블룰 타이틀 블록 + 하단 caps 메타 그리드"를 통째로 버리고,
 * **흰 종이(#fdfdfc) 위에 도판을 한 장 올린 인쇄물**로 갈아엎는다.
 *
 * - 종이 그레인 베이스 + 잉크 #14120f 하드코딩(c8) — themeColor 파생·isInkDark 반전 전량 제거
 * - 헤더: 옐로 13×13 스퀘어 + UNE SÉANCE / 우측 관람일, 아래 옐로 3px 룰
 * - 마스트헤드: 제목 46/700 + 원제(Instrument Serif) / 우측 ★ 평점 50/700
 * - 도판: 500×750(0.667, #525 룰 5) + 4단 그림자·inset 엣지·116deg 사선 글로스·하단 5px 두께 엣지(c7)
 * - 한줄평: top1064 height190 **고정 블록** — 문구 길이가 변해도 따옴표(104px)는 좌상·우하에 고정
 * - 콜로폰: 모노 17.5 2줄. 병합 줄은 fieldPieces로 분해해 필드별 탭 타깃·ghost 유지(c3)
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
  const signatureIsKr = containsHangul(signatureVal);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 타이틀 폭 맞춤(#318) — 시안 46/700이 maxSize. 마스트헤드는 좌측 제목 블록과 우측 평점 블록이
  // 한 줄에 서므로 가용폭은 (960 - 84*2) - 평점 블록(약 180) - gap 24 ≈ 588. 2줄 클램프라
  // 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 축소한다.
  const fontsReady = useFontsReady();
  const titleSize = fitFontSizeToWidth(titleVal, 588 * 2, { fontFamily: FONT_KR, fontWeight: 700, minSize: 28, maxSize: 46 }, fontsReady);

  // 한줄평(#391) — 유저 입력 → 평점 구간(0.5 단위) 프리셋 → 기본 quote 순 폴백. 유저 입력에
  // 한글이 섞이면 FONT_QUOTE_KR(손글씨)로, 그 외(프리셋·기본값은 항상 영문)는 FONT_DISPLAY 그대로.
  const userQuoteVal = gate(fv?.quote, d.quote);
  const ratingQuoteKey = d.rating > 0 ? String(Math.round(d.rating * 2) / 2) : '';
  const quoteText = userQuoteVal || RATING_QUOTES[ratingQuoteKey] || DEFAULT_QUOTE;
  const quoteIsKr = containsHangul(quoteText);

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
  const film = fieldPieces(
    [
      { field: 'runtime', value: gate(fv?.runtime, d.runtime), ghost: showFieldGhost(fv?.runtime, d.runtime, ghost), label: 'RUNTIME' },
      // 재개봉 편집 자리는 releaseDate 시트 안(reissue는 FIELD_SHEET_TYPE에 없어 단독 타깃이면 빈 시트).
      { field: 'releaseDate', value: releaseDateVal && `RELEASED ${releaseDateVal}`, ghost: showFieldGhost(fv?.releaseDate, releaseClean, ghost), label: 'RELEASED' },
      // 재개봉은 값이 있을 때만 자리를 얻는다(c6) — ghost를 안 주면 fieldPieces가 빈 값을 알아서 뺀다.
      { field: 'releaseDate', value: reissueVal && `RE-RELEASED ${reissueVal}`, label: 'RE-RELEASED' },
      { field: 'actors', value: truncateActors(gate(fv?.actors, d.actors)), ghost: showFieldGhost(fv?.actors, d.actors, ghost), label: 'CAST' },
    ],
    onField,
    { surface: 'paper' }
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
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: PLATE_GLOSS }} />
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

        {/* 한줄평 — 190px 고정 블록. 따옴표는 문구 길이와 무관하게 좌상·우하에 고정된다. */}
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 1064, height: 190 }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, fontFamily: FONT_DISPLAY, fontSize: 104, lineHeight: 1, color: CRITERION_YELLOW }}>&ldquo;</span>
          <span aria-hidden style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: FONT_DISPLAY, fontSize: 104, lineHeight: 1, color: CRITERION_YELLOW, transform: 'rotate(180deg)' }}>&ldquo;</span>
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
                fontFamily: quoteIsKr ? FONT_QUOTE_KR : FONT_DISPLAY,
                fontStyle: quoteIsKr ? 'normal' : 'italic',
                fontSize: 50,
                lineHeight: 1.28,
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
              <span style={{ fontFamily: signatureIsKr ? FONT_QUOTE_KR : FONT_DISPLAY, fontStyle: signatureIsKr ? 'normal' : 'italic', fontSize: 56, lineHeight: 1 }}>{signatureVal}</span>
            </FieldTap>
          ) : gSignature ? (
            <FieldTap field="signature" onField={onField}>
              <FieldGhost text="SIGNATURE" width={200} height={48} surface="paper" state={gSignature} />
            </FieldTap>
          ) : null}
        </div>

        {/* 콜로폰 */}
        <div style={{ position: 'absolute', left: PAD, top: 1358, width: 64, height: 3, background: CRITERION_YELLOW }} />
        <div style={{ position: 'absolute', left: PAD, right: PAD, top: 1370, fontFamily: FONT_MONO, fontSize: 17.5, fontWeight: 600, letterSpacing: 0.9, lineHeight: 1.72, color: INK_SOFT }}>
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
