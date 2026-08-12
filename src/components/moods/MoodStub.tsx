import { CSSProperties, Fragment, ReactNode, memo } from 'react';
import {
  Barcode,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  MoodProps,
  MoodWordmark,
  Poster,
  POSTER_LETTERBOX_BG,
  WORDMARK_ACCENT,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  posterFitProps,
  posterTapProps,
  resolveTicketData,
  showFieldGhost,
  SignatureStamp,
  StampRow,
  stampWillRender,
  truncateActorsToWidth,
  userTextFont,
  useFontsReady,
} from './_shared';
import { backgroundPatternStyle } from '@/utils/backgroundPatterns';
import { TARGET_HEIGHT, TARGET_WIDTH } from '@/utils/constants';

/**
 * v05 — 티켓 스텁(마스터 Ticket Design Master.dc.html v2 · 2026-07-08 resync, 에픽 #281).
 * 재구조: 포스터 640(가로 3:2 밴드, 텍스트 없음) → 절취 16(3px dashed, 반원 노치 없음) → 페이퍼 스텁 flex:1.
 * 제목이 포스터 오버레이에서 페이퍼 스텁으로 이동(42/700 2줄). 페이퍼: 홀로그램 티커(장식) → 워드마크
 * + 제목/원제 → Admission(SEAT 칩 + DATE/TIME/HALL 점선) → The Film(RUNTIME/RATED/RELEASED/
 * RE-RELEASED 2열 + STARRING) → 푸터(made with FILME · collected by · 스텁 바코드 300×40 텍스트 없음).
 * ink #1A1612 고정 · ACCENT monochrome(themeColor 틴트 없음) · 데이터=Pretendard, 장식=Instrument
 * Serif italic, 코드/라벨=Mono. 분할 레이아웃이라 포스터 영역에만 탭(#259). 스텁은 바코드를 유지하므로
 * bookingNo 포함 13 eligible 필드 전부 렌더 → MOOD_EXCLUDED_FIELDS stub 항목 불필요.
 */
const PAPER = '#f4ede0';
const INK = '#1a1612';
const BROWN = '#6f6347';
const CREAM = '#f4ede0';
const DOT = 'rgba(26,22,18,.4)';
/** 바코드 SVG 폭(px) — Code128C(#444) 기준 모듈당 2px 확보용 300. 테스트가 이 값을 직접 import. */
export const BARCODE_WIDTH = 300;
// 좌석 폭 예산(#381) — fitFontSizeToWidth의 maxWidth이자 seat span 자체의 하드 캡. 쉼표 없는
// 단일 토큰은 개수 캡을 안 타므로(#381 리뷰 P1), minSize까지 줄여도 못 들어가면 span에 걸린
// overflow:hidden + ellipsis가 최종 방어선이 된다.
const SEAT_MAX_WIDTH = 520;
// STARRING 값 가용폭(#493) — Row(라벨+점선필러+값) 실측 기준. 컨테이너 848(960-PAD_X*2)에서
// 라벨 "STARRING"(78.4px) + gap*2(24) + 점선필러 최소폭(12)을 빼면 실제 상한은 ≈733.6px
// (headless Chrome 실측) — 여유를 두고 700으로 고정.
const STARRING_MAX_WIDTH = 700;
// 본문 좌우 패딩(#446 톤업, 40→56) — 패딩·티커 풀블리드 음수마진·타이틀 가용폭 세 곳이 공유하는 단일 소스.
const PAD_X = 56;

/**
 * 상단 포스터 밴드 높이 — **가로 포스터 슬롯**이다(#527 오너 확정). 밴드 폭이 캔버스 960으로
 * 잠겨 있으므로, 가로 포스터 표준 3:2(= 세로 0.667의 가로 판, #525 룰 1)를 유지하면서 가장 큰
 * 밴드는 960×640 하나뿐이다 — 그래서 이 값은 자유 변수가 아니라 960 / 1.5의 결과다.
 * 밴드 자체가 3:2라 가로 크롭(LayoutSpec.posterOrientation='landscape'가 주는 프리셋)은
 * contain으로도 레터박스 0인 풀블리드로 들어가고, 룰 5의 판정 대상인 포스터 프레임이 곧 밴드다.
 * 다른 무드에서 세로로 크롭한 뒤 넘어오면(크롭은 무드 전환에도 유지 — #529 결정 2) 프레임이
 * 427×640으로 서고 남는 좌우를 blur 배경이 덮는다(#440).
 *
 * #493이 세로 포스터 기준으로 밀어올렸던 900은 폐기됐다 — 그때의 상한 근거(하단 스텁이 넘치지
 * 않는 실측 최대 ≈924px)는 지금 값이 그보다 한참 낮아 더는 구속하지 않는다.
 */
const POSTER_H = 640;

/**
 * 배경 패턴(#530) 클립 — 캔버스 전면에서 **포스터 밴드 사각형만 구멍으로 판다**(evenodd, Criterion
 * PATTERN_CLIP과 같은 계약). 미리보기에선 밴드가 어차피 위에서 덮으니 픽셀이 같지만, **저장물에선
 * 이게 없으면 패턴이 포스터 위에 인쇄된다**: `captureToImage`가 포스터를 raw canvas로 먼저 깔고 base
 * PNG를 그 위에 얹는데(z-order `배경 → 포스터 → CSS 레이어`), 포스터 조상의 불투명 배경은 포스터를
 * 가리지 않도록 base에서 빠져 나가 있다(#490/#495 `collectOpaquePosterBackdrops`). 그래서 밴드 자리의
 * base는 투명이고, 그 아래 깔린 패턴이 그대로 비쳐 포스터를 덮는다.
 *
 * 좌표를 POSTER_H에서 뽑는 게 핵심 — 밴드 높이가 바뀌면 클립이 같이 따라가서 조용히 어긋나지 않는다.
 */
const PATTERN_CLIP =
  `path(evenodd, "M0 0H${TARGET_WIDTH}V${TARGET_HEIGHT}H0Z` +
  ` M0 0H${TARGET_WIDTH}V${POSTER_H}H0Z")`;

// 홀로그램 티커 무지개 그라디언트(마스터 1:1) — 절취 정보 스트립 배경.
const HOLO = 'linear-gradient(100deg,#9ff0df 0%,#f6c4e4 14%,#c9baf7 30%,#b7e3f8 47%,#f7e2b3 64%,#b6f7c6 81%,#9ff0df 100%)';

const rowLabel: CSSProperties = { fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 2, color: BROWN, flexShrink: 0 };
const dottedFill: CSSProperties = { flex: 1, minWidth: 12, borderBottom: `1px dotted ${DOT}` };
const rowValue = (size = 24): CSSProperties => ({ fontWeight: 700, fontSize: size, letterSpacing: -0.3, flexShrink: 0 });
const sectionLabel: CSSProperties = { fontFamily: FONT_MONO, fontWeight: 800, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' };

/** label + 점선 필러 + 값 한 줄(DATE/TIME/HALL/RUNTIME/RATED/…). 값 노드는 호출부가 FieldTap로 감싼다. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={rowLabel}>{label}</span>
      <span style={dottedFill} />
      {children}
    </div>
  );
}

/** 섹션 헤더 — bar + 라벨 + 하프라인(Admission / The Film). */
function SectionHead({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
      <span style={{ width: 22, height: 2, background: INK, flexShrink: 0 }} />
      <span style={sectionLabel}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(26,22,18,.18)' }} />
    </div>
  );
}

export const MoodStub = memo(function MoodStub({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap, embossStamps, embossPaths, embossIntensity }: MoodProps) {
  const { bookingNo, watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 페이퍼 스텁 가용폭(960 - PAD_X*2). 2줄 클램프라 가용폭×2를
  // maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고). PAD_X는 패딩·
  // 티커 음수마진과 공유하는 단일 소스(#446).
  const fontsReady = useFontsReady();
  const titleFontSize = fitFontSizeToWidth(titleVal, (960 - PAD_X * 2) * 2, { fontFamily: FONT_KR, fontWeight: 700, minSize: 26, maxSize: 42 }, fontsReady);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  // 배우 폭 인식 truncate(#493) — 고정 5명 캡 대신 STARRING 값 가용폭 기준으로 "외 N명" 결정.
  const actorsVal = truncateActorsToWidth(gate(fv?.actors, d.actors), STARRING_MAX_WIDTH, { fontFamily: FONT_SANS, fontWeight: 700, fontSize: 20 }, fontsReady);
  const seatVal = gate(fv?.seat, d.seat);
  // 좌석 폭 맞춤(#381) — SEAT 칩은 flex:0 0 auto라 길어지면 그대로 커져 옆 DATE/TIME/HALL
  // 컬럼을 짓누른다. SEAT_MAX_WIDTH는 실측(4석 "J101, J102, J103, J104" 스타일도 485px로
  // 안전권) 기준 예산 — DATE/TIME/HALL이 최소 ~280px는 유지하도록 여유를 둔 값.
  const seatFontSize = fitFontSizeToWidth(seatVal, SEAT_MAX_WIDTH, { fontFamily: FONT_SANS, fontWeight: 900, minSize: 24, maxSize: 48 }, fontsReady);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal = gate(fv?.reissue, reissueClean);
  const signatureVal = gate(fv?.signature, d.signature);
  const bookingVisible = fv?.bookingNo ?? true;
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gRuntime = showFieldGhost(fv?.runtime, d.runtime, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating > 0, ghost);
  const gRelease = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);

  const chainOn = stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost);
  const formatOn = stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  // HALL 셀 분해(#266 PR-B) — theater·screen을 · 로 붙이되 각각 독립 FieldTap + 개별 ghost(surface paper).
  const screenCell = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
    ],
    onField,
    { surface: 'paper' }
  );

  // 홀로그램 티커 스크롤 텍스트 — 순수 장식(aria-hidden). gate된 값으로 조립해 필드 숨김 시 자동으로 빠진다.
  const tickerItems = [
    titleVal,
    bookingVisible && bookingNo ? `No. ${bookingNo}` : '',
    [watchDateVal, watchTimeVal].filter(Boolean).join(' · '),
    seatVal ? `Seat ${seatVal}` : '',
    screenVal,
    ratingVisible ? `★ ${d.rating.toFixed(1)}` : '',
    'Admit One',
    runtimeVal,
  ].filter(Boolean);

  const admissionOn =
    seatVal || gSeat || watchDateVal || gWatchDate || watchTimeVal || gWatchTime || screenCell.hasAny;
  const filmOn =
    runtimeVal || gRuntime || ratingVisible || gRating || releaseVal || gRelease || reissueVal || actorsVal || gActors;

  const componentOpacity = components.componentOpacity ?? 1;
  const backgroundPattern = components.backgroundPattern ?? 'none';

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: INK, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 배경 패턴(#530) — 종이(PAPER) 바로 위에 깔리고, 포스터 밴드 자리는 PATTERN_CLIP이 구멍으로
          파낸다(그 주석의 저장물 z-order 참고). componentOpacity 밖(종이에 이미 인쇄된 바탕)인 건
          Editorial·Criterion과 같은 계약이고, 색은 이 무드의 INK 하드코딩.

          **덮고 덮이는 건 트리 순서가 아니라 포지셔닝이 정한다.** 이 레이어는 absolute라, 뒤에 오는
          포스터 밴드·페이퍼 스텁(둘 다 relative)만 위에 오고 static인 절취선은 **아래**로 간다 —
          절취선의 점선 위엔 패턴이 얹힌다(6~12% 잉크라 무해, 미리보기=저장물). 그래서 페이퍼 스텁이
          PAPER를 다시 칠하면 패턴이 종이 어디에도 안 보여, 그 중복 배경은 루트 하나로 합쳤다.
          여기에 불투명한 장식을 새로 넣어 패턴을 가리려면 순서가 아니라 position을 줘야 한다. */}
      {backgroundPattern !== 'none' && (
        <div data-bg-pattern="true" aria-hidden="true" style={{ position: 'absolute', inset: 0, clipPath: PATTERN_CLIP, ...backgroundPatternStyle(backgroundPattern, INK) }} />
      )}
      {/* 상단 포스터 — 텍스트 없음. 분할 레이아웃이라 root가 아닌 이 영역에만 포스터 탭(#259).
          배경은 Poster의 letterboxBg가 칠하므로 래퍼 자체엔 안 둔다(nit poster-letterbox-bg, #440 —
          editorial과 동일하게 죽은 스타일이던 래퍼 background 제거). */}
      <div style={{ flex: `0 0 ${POSTER_H}px`, position: 'relative', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        {/* 가로 포스터 밴드 960×640(3:2) — 가로 크롭이면 contain으로도 레터박스 0인 풀블리드고,
            세로 크롭이 넘어오면 프레임 427×640 + 좌우 blur다(#440). frameInsetY는 안 쓴다 —
            풀블리드 케이스에서 강제 띠가 곧 레터박스 0을 깨뜨린다(editorial/35mm-landscape와 동일). */}
        <Poster src={croppedImageUrl} {...posterFitProps({ letterboxBg: POSTER_LETTERBOX_BG })} material={components.material} coating={components.coating} materialIntensity={components.materialIntensity} coatingIntensity={components.coatingIntensity} posterOpacity={components.posterOpacity} embossStamps={embossStamps} embossPaths={embossPaths} embossIntensity={embossIntensity} />
      </div>

      {/* 절취선(점선) — 크림 밴드에 3px dashed, 반원 노치 없음(마스터 재동기화 #281). */}
      <div aria-hidden="true" style={{ height: 16, flexShrink: 0, background: PAPER, display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1, borderTop: `3px dashed rgba(26,22,18,.85)` }} />
      </div>

      {/* 하단 페이퍼 스텁 — 배경은 루트의 PAPER가 그대로 비친다(#530). 여기서 다시 칠하면 그게
          포지셔닝된 형제로서 배경 패턴 레이어를 통째로 덮어 패턴이 안 보인다. 저장물도 같다 —
          루트 PAPER는 포스터 조상이라 base에서 빠져 캔버스에 먼저 칠해지므로(#490/#495) 이 자리의
          종이색은 유지된다. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: `22px ${PAD_X}px 26px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', opacity: componentOpacity }}>
        {/* 홀로그램 티커 — 풀블리드 장식 스트립. 필드값을 복제하므로 aria-hidden(스크린리더 중복 읽기 방지, #289). */}
        <div aria-hidden="true" style={{ position: 'relative', height: 42, overflow: 'hidden', margin: `-22px -${PAD_X}px 22px`, boxShadow: 'inset 0 1px 0 rgba(26,22,18,.22), inset 0 -1px 0 rgba(26,22,18,.22)', background: HOLO }}>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(114deg, rgba(255,255,255,.65) 0 2px, rgba(255,255,255,0) 2px 9px)', mixBlendMode: 'screen' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(68deg, rgba(255,255,255,0) 0 13px, rgba(255,255,255,.34) 13px 15px)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingLeft: 16, whiteSpace: 'nowrap', fontFamily: FONT_MONO, fontWeight: 800, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(26,22,18,.62)', textShadow: '0 1px 0 rgba(255,255,255,.55)' }}>
              {/* 필드 적으면 우측이 비므로 4회 반복해 채운다(FilmStripBand 엣지 cells 패턴 이식, #446). */}
              {Array.from({ length: 4 }, (_, r) =>
                tickerItems.map((t, i) => (
                  <Fragment key={`${r}-${i}`}>
                    <span>{t}</span>
                    <span style={{ opacity: 0.4 }}>✦</span>
                  </Fragment>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 워드마크(체인·포맷) + 제목 + 원제 */}
        <div style={{ marginTop: 6 }}>
          {(chainOn || formatOn) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
              <StampRow
                chain={components.chain}
                chainLabel={components.chainLabel}
                chainVisible={components.chainVisible}
                chainHeight={39}
                chainScale={components.chainScale ?? 1}
                format={components.format}
                formatLabel={components.formatLabel}
                formatVisible={components.formatVisible}
                formatSize={0.6}
                formatScale={components.formatScale ?? 1}
                surface="paper"
                ghost={ghost}
                onField={onField}
                dividerColor={INK}
                dividerOpacity={0.35}
              />
            </div>
          )}
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontWeight: 700, fontSize: titleFontSize, fontFamily: FONT_KR, lineHeight: 1.06, letterSpacing: -1.2, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleVal}</div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}><div style={{ marginBottom: 8 }}><FieldGhost text="TITLE" width="66%" height={46} size={2} surface="paper" state={gTitle} /></div></FieldTap>
          ) : null}
          {titleOgVal ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: 2, textTransform: 'uppercase', color: BROWN, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOgVal}</div>
            </FieldTap>
          ) : gTitleOg ? (
            <FieldTap field="titleOg" onField={onField}><FieldGhost text="ORIGINAL TITLE" width={280} height={26} surface="paper" state={gTitleOg} /></FieldTap>
          ) : null}
        </div>

        <div style={{ height: 1, background: 'rgba(26,22,18,.2)', margin: '24px 0' }} />

        {/* 섹션 영역이 하단 스텁의 남는 세로를 직접 나눠 갖는다(#536) — 밴드가 900→640(#527)으로
            내려가며 생긴 여유를 예전엔 푸터 앞 단일 flex:1 스페이서가 통으로 먹어 STARRING과 푸터
            사이에만 구멍이 났다(브라우저 실측 234.5px = 페이퍼 스텁 878px의 26.7%). space-evenly면
            섹션 위·사이·아래 세 자리로 갈리고, 필드를 많이 켜 여유가 0이 되면 예전과 같은 배치로
            수렴한다(오버플로 회귀 없음). */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', gap: 20 }}>
          {/* Admission — SEAT 칩 + DATE/TIME/HALL */}
          {admissionOn && (
            <div>
              <SectionHead label="Admission" />
              <div style={{ display: 'flex', gap: 22, alignItems: 'stretch' }}>
                {(seatVal || gSeat) && (
                  <FieldTap field="seat" onField={onField}>
                    <div style={{ flex: '0 0 auto', background: INK, color: CREAM, borderRadius: 6, padding: '14px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 13, letterSpacing: 3, color: 'rgba(244,237,224,.6)', marginBottom: 6 }}>SEAT</span>
                      {seatVal ? (
                        <span style={{ fontWeight: 900, fontSize: seatFontSize, letterSpacing: -1, lineHeight: 0.85, display: 'inline-block', maxWidth: SEAT_MAX_WIDTH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seatVal}</span>
                      ) : (
                        <FieldGhost text="SEAT" width={100} height={48} size={2} surface="dark" state={gSeat} />
                      )}
                    </div>
                  </FieldTap>
                )}
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                  {(watchDateVal || gWatchDate) && (
                    <Row label="DATE">
                      {watchDateVal ? (
                        <FieldTap field="watchDate" onField={onField}><span style={rowValue()}>{watchDateVal}</span></FieldTap>
                      ) : (
                        <FieldTap field="watchDate" onField={onField}><FieldGhost text="DATE" width={160} height={30} surface="paper" state={gWatchDate} /></FieldTap>
                      )}
                    </Row>
                  )}
                  {(watchTimeVal || gWatchTime) && (
                    <Row label="TIME">
                      {watchTimeVal ? (
                        <FieldTap field="watchTime" onField={onField}><span style={rowValue()}>{watchTimeVal}</span></FieldTap>
                      ) : (
                        <FieldTap field="watchTime" onField={onField}><FieldGhost text="TIME" width={120} height={30} surface="paper" state={gWatchTime} /></FieldTap>
                      )}
                    </Row>
                  )}
                  {screenCell.hasAny && (
                    <Row label="HALL">
                      <span style={{ ...rowValue(20), flexShrink: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(screenCell.hasGhost ? { display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'normal' } : null) }}>
                        {screenCell.node}
                      </span>
                    </Row>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* The Film — RUNTIME / RATED / RELEASED / RE-RELEASED 2열 + STARRING */}
          {filmOn && (
            <div>
              <SectionHead label="The Film" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40, rowGap: 12 }}>
                {(runtimeVal || gRuntime) && (
                  <Row label="RUNTIME">
                    {runtimeVal ? (
                      <FieldTap field="runtime" onField={onField}><span style={rowValue()}>{runtimeVal}</span></FieldTap>
                    ) : (
                      <FieldTap field="runtime" onField={onField}><FieldGhost text="RUNTIME" width={120} height={30} surface="paper" state={gRuntime} /></FieldTap>
                    )}
                  </Row>
                )}
                {(ratingVisible || gRating) && (
                  <Row label="RATED">
                    {ratingVisible ? (
                      <FieldTap field="rating" onField={onField}><span style={rowValue()}>★ {d.rating.toFixed(1)}</span></FieldTap>
                    ) : (
                      <FieldTap field="rating" onField={onField}><FieldGhost text="★" width={90} height={30} surface="paper" state={gRating} /></FieldTap>
                    )}
                  </Row>
                )}
                {(releaseVal || gRelease) && (
                  <Row label="RELEASED">
                    {releaseVal ? (
                      <FieldTap field="releaseDate" onField={onField}><span style={rowValue()}>{releaseVal}</span></FieldTap>
                    ) : (
                      <FieldTap field="releaseDate" onField={onField}><FieldGhost text="RELEASE" width={140} height={30} surface="paper" state={gRelease} /></FieldTap>
                    )}
                  </Row>
                )}
                {reissueVal && (
                  // 재개봉일은 releaseDate 시트에서 편집하는 파생값 — 독립 FieldTap 없이 값만 렌더(reissue는 런처 eligible 아님).
                  <Row label="RE-RELEASED"><span style={rowValue()}>{reissueVal}</span></Row>
                )}
              </div>
              {(actorsVal || gActors) && (
                <div style={{ marginTop: 12 }}>
                  <Row label="STARRING">
                    {actorsVal ? (
                      <FieldTap field="actors" onField={onField}><span style={{ ...rowValue(20), flexShrink: 1, minWidth: 0, maxWidth: STARRING_MAX_WIDTH, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actorsVal}</span></FieldTap>
                    ) : (
                      <FieldTap field="actors" onField={onField}><FieldGhost text="CAST" width={200} height={30} surface="paper" state={gActors} /></FieldTap>
                    )}
                  </Row>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 — made with FILME · collected by 서명 + 스텁 바코드(300×40, 텍스트 없음) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 32, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN }}>made with</span>
              <MoodWordmark size={22} color={INK} accent={WORDMARK_ACCENT} />
            </div>
            {components.signatureImage ? (
              <>
                <span style={{ width: 1, height: 24, background: INK, opacity: 0.18, flexShrink: 0 }} />
                <FieldTap field="signature" onField={onField}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, minWidth: 0 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN, flexShrink: 0 }}>collected by</span>
                    <SignatureStamp image={components.signatureImage} height={30} scale={components.signatureScale ?? 1} surface="paper" />
                  </div>
                </FieldTap>
              </>
            ) : signatureVal ? (
              <>
                <span style={{ width: 1, height: 24, background: INK, opacity: 0.18, flexShrink: 0 }} />
                <FieldTap field="signature" onField={onField}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, minWidth: 0 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN, flexShrink: 0 }}>collected by</span>
                    <span style={{ ...userTextFont(signatureVal), fontSize: 24, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</span>
                  </div>
                </FieldTap>
              </>
            ) : gSignature ? (
              <>
                <span style={{ width: 1, height: 24, background: INK, opacity: 0.18, flexShrink: 0 }} />
                <FieldTap field="signature" onField={onField}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN, flexShrink: 0 }}>collected by</span>
                    <FieldGhost text="SIGNATURE" width={200} height={30} surface="paper" state={gSignature} />
                  </div>
                </FieldTap>
              </>
            ) : null}
          </div>
          {bookingVisible && (
            <FieldTap field="bookingNo" onField={onField}>
              <Barcode value={bookingNo} color={INK} width={BARCODE_WIDTH} height={40} showText={false} encoding="code128c" />
            </FieldTap>
          )}
        </div>
      </div>
    </div>
  );
});
