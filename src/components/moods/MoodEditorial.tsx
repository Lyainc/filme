import { CSSProperties, Fragment, ReactNode, memo } from 'react';
import {
  Barcode,
  ChainStamp,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  MoodWordmark,
  Poster,
  POSTER_LETTERBOX_BG,
  WORDMARK_ACCENT,
  fitFontSizeToWidth,
  gate,
  posterFitProps,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  SignatureStamp,
  stampWillRender,
  truncateActorsToWidth,
  userTextFont,
  useFontsReady,
  type FieldGhostState,
} from './_shared';
import { BackgroundPatternLayer } from '@/utils/backgroundPatterns';

/**
 * Editorial — 영화제 공식 티켓(마스터 Ticket Design Master.dc.html v2 · 2026-07-08 resync, 에픽 #281).
 * 4열 재구조: 포스터 640(#440 0.667 리사이즈, 구 516) | 골드포일 세로 스트립 42(장식) | 메인 flex | 절취 스텁 213(accent 배경, #572로 224에서 -5%).
 * 메인: 킥커(En Reprise) → 타이틀 72/900 → avec → Séance + 도착시간(시계) → 메타 그리드(Théâtre/Durée/
 * Note/Sortie 37/800) → 프랑스어 고지문 → 푸터(réalisé avec FILME / par). 좌석·바코드·체인/포맷·le billet은
 * 스텁(회전 -90°) 5그룹으로 이동. reissue는 마스터 메타 그리드에 슬롯이 없어(킥커 En Reprise는 장식) 미렌더.
 */
const PAPER = '#f4ede0';
const INK = '#1a1612';
const BROWN = '#6f6347';
const CREAM = '#f7ece2';

// 포스터 슬롯 폭(#440 잔여 스코프) — 캔버스 높이 960 × POSTER_RATIO(#525 룰 5)로 640. 6무드
// 중 유일하게 슬롯 자체가 0.667이라 레터박스가 0이다. 리터럴로 두는 건 2:3이 움직이지 않는
// 실물 규격이라서고, 바꿀 일이 생기면 이 주석의 POSTER_RATIO로 grep이 걸린다.
const POSTER_W = 640;
/** 바코드 SVG 폭(px) — Code128C(#444) 기준 모듈당 2px 확보용 286. 테스트가 이 값을 직접 import. */
export const BARCODE_WIDTH = 286;
const FOIL_W = 42;
/** 절취 스텁 폭 = 회전 콘텐츠의 두께축. 224 → 213(-4.9%, #572)로 그만큼 메인 열이 넓어진다. */
const STUB_W = 213;
const MAIN_PAD_X = 52;
// 메인 열 가용폭 — #572 전엔 524가 상수 없이 두 곳(타이틀 예산·고지문 maxWidth)에 매직넘버로
// 박혀 있어 STUB_W만 바꾸면 조용히 틀렸다. 캔버스 폭 1534는 가로 무드의 긴 변(TARGET_HEIGHT).
const MAIN_AVAIL_W = 1534 - POSTER_W - FOIL_W - STUB_W - MAIN_PAD_X * 2; // 535
// 고지문 폭. #440이 정한 "열 가용폭 대비 비율"(440/524 ≈ 0.84)을 그대로 유지하되, 리터럴 440이
// 아니라 열 폭에 연동해 둔다 — 440은 처음부터 파생값이었지 시안이 준 절대값이 아니다.
const NOTICE_MAX_W = Math.round(MAIN_AVAIL_W * 0.84); // 449
// 좌석 폭 예산(#381) — fitFontSizeToWidth의 maxWidth이자 seat span 자체의 하드 캡. 쉼표 없는
// 단일 토큰은 개수 캡을 안 타므로(#381 리뷰 P1), minSize까지 줄여도 못 들어가면 span에 걸린
// overflow:hidden + ellipsis가 최종 방어선이 된다.
// 260 → 220(#573): 최악(4석 16자)에서 스텁 길이축을 41px 회수한다. 이 아래로 더 내리면 4석이
// minSize 26에서도 안 들어가 ellipsis로 좌석 정보가 잘리기 시작한다 — 실측 하한이다.
const SEAT_MAX_WIDTH = 220;
// 스탬프 길이축 상한(#589) — 아래 예산표에서 스탬프를 뺀 나머지가 888px(최악: 바코드 286 + 좌석
// 184 + admis 96 + le billet 125 + 구분선 4 + gap 128 + padding 64)이라 스탬프 그룹 몫은 72px까지다.
// 64로 잡아 8px을 반올림·폰트 메트릭 드리프트 몫으로 남긴다 — 72는 최악에서 합계가 정확히 960에
// 앉아 여유가 0이고, 이 하네스는 CI가 아니라 수동이라 드리프트를 즉시 못 잡는다.
//
// **높이 기반 상한(STAMP_MAX_ASPECT)만으로는 안 막힌다**: 5:1 로고는 stampHeightDelta가 −16을
// 물려 h = (48−16)×scale이 되고, scale 상한 1.3에서 폭이 41.6×5 = 208px까지 자란다(실측
// `bun scripts/measure-editorial-stub.mjs --logo`). 스텁은 회전 -90°라 그 208이 **길이축**을
// 먹어 합계가 1096, 즉 예산을 136px 넘겨 바코드와 le billet이 캔버스 밖으로 잘렸다. 다른 무드는
// 스탬프가 티켓 폭(960·1477)을 쓰므로 이 상한이 필요 없다(__tests__/stampWidthCap.test.tsx).
// 이 값은 px 절대값이라 사용자 scale이 곱해지지 않는다 — 아스펙트 기반으로 두면 scale 1.3에서
// 다시 예산을 넘기기 때문. 로고는 objectFit:contain이라 잘리지 않고 축소된다.
export const STUB_STAMP_MAX_W = 64;

// `avec` 행 예산(#566) — 라벨은 flexShrink:0이라 배우 span이 쓸 수 있는 폭은 열 가용폭에서
// 라벨 폭과 gap을 뺀 나머지다. 라벨 폭이 리터럴인 건 라벨 폰트가 FONT_DISPLAY(`var(--font-display)`)
// 라서다 — canvas `font`에 var()가 들어가면 대입이 조용히 무시돼 measureTextWidth로는 못 잰다.
// 42px 실측(`bun scripts/measure-actors-fit.mjs`가 라벨 offsetWidth를 리포트한다) + 반올림 여유 1px.
// 예산을 크게 잡으면 ellipsis가 나므로 오차는 항상 이쪽(작게)으로 남긴다.
const AVEC_LABEL_W = 43;
const AVEC_GAP = 12;
const ACTORS_AVAIL_W = MAIN_AVAIL_W - AVEC_LABEL_W - AVEC_GAP; // 480 (실측 clientWidth 481)

export const MoodEditorial = memo(function MoodEditorial({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap, embossStamps, embossPaths, embossIntensity }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : resolveInk(themeColor, '#a8312a');
  const { bookingNo, watchDateClean, releaseClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 예산은 MAIN_AVAIL_W(#440 0.667 리사이즈로 648→524, #572로 535).
  // 2줄 클램프라 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
  const fontsReady = useFontsReady();
  const titleFontSize = fitFontSizeToWidth(titleVal, MAIN_AVAIL_W * 2, { fontFamily: FONT_KR, fontWeight: 900, minSize: 44, maxSize: 72 }, fontsReady);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const seatVal = gate(fv?.seat, d.seat);
  // 좌석 폭 맞춤(#381) — 스텁이 -90° 회전되므로 좌석 텍스트의 (회전 전) 가로 폭이 스텁 전체
  // 그룹 행의 (회전 후) 세로 길이를 늘려, 길어지면 반대편 그룹(바코드·le billet)이 캔버스
  // 세로(960) 밖으로 밀려 잘린다. 1~2석은 자연폭이 예산 안이라 56px 그대로고, 3~4석부터 축소된다
  // — 4석(H12,H13,H14,H15)은 #573 후 minSize 26px·렌더폭 184px로, 예산 하한에 정확히 앉는다
  // (근거는 아래 stubGroups의 길이축 예산표).
  const seatFontSize = fitFontSizeToWidth(seatVal, SEAT_MAX_WIDTH, { fontFamily: FONT_SANS, fontWeight: 900, minSize: 26, maxSize: 56 }, fontsReady);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseVal = gate(fv?.releaseDate, releaseClean);
  // 배우 폭 맞춤(#566) — 고정 3명 캡(truncateActors)은 폭을 몰라, 2명이어도 길면 CSS ellipsis가
  // 이름 중간을 잘랐다. 자간 -0.3은 음수라 측정에 안 넘긴다(근거는 MeasureFontOptions.letterSpacing).
  const actorsVal = truncateActorsToWidth(gate(fv?.actors, d.actors), ACTORS_AVAIL_W, { fontFamily: FONT_KR, fontWeight: 600, fontSize: 33 }, fontsReady);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // ghost 판정(#216) — 빈 슬롯을 ghost 모드에서만 라벨 점선으로.
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);
  const gRuntime = showFieldGhost(fv?.runtime, d.runtime, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating > 0, ghost);
  const gRelease = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);

  const italic = (color: string, size: number): CSSProperties => ({
    fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: size, color, letterSpacing: 0.2,
  });
  const metaLabel = (): CSSProperties => ({ ...italic(BROWN, 26), marginBottom: 5 });
  const metaValue = (color = INK): CSSProperties => ({ fontWeight: 800, fontSize: 37, fontFamily: FONT_SANS, letterSpacing: -0.5, lineHeight: 1, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });

  const seanceOn = !!watchDateVal || gWatchDate;
  const arrivalOn = !!watchTimeVal || gWatchTime;
  const componentOpacity = components.componentOpacity ?? 1;
  // 스텁 스탬프는 실제 렌더 조건(stampWillRender)으로 게이팅 — chainVisible=true여도 로고·라벨 없고
  // ghost=false면 null이라, 이 group을 안 그려야 허공 구분선/빈 컨테이너가 안 남는다(#216 P1.1).
  const stubChainOn = stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost);
  const stubFormatOn = stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const stubStampOn = stubChainOn || stubFormatOn;

  // 단일 값 메타 셀(Durée/Note/Sortie) — 값 있으면 값, 비었고 ghost면 라벨 점선.
  const metaCell = (label: string, value: string, field: 'runtime' | 'releaseDate', ghostOn: FieldGhostState, ghostLabel: string, valueColor = INK) =>
    value || ghostOn ? (
      <div key={field}>
        <div style={metaLabel()}>{label}</div>
        {value ? (
          <FieldTap field={field} onField={onField}><div style={metaValue(valueColor)}>{value}</div></FieldTap>
        ) : (
          <FieldTap field={field} onField={onField}><FieldGhost text={ghostLabel} width={150} height={40} surface="paper" state={ghostOn} /></FieldTap>
        )}
      </div>
    ) : null;

  const ratingCell = (ratingVisible || gRating) ? (
    <div key="rating">
      <div style={metaLabel()}>Note</div>
      {ratingVisible ? (
        <FieldTap field="rating" onField={onField}><div style={metaValue(accent)}>★ {d.rating.toFixed(1)}</div></FieldTap>
      ) : (
        <FieldTap field="rating" onField={onField}><FieldGhost text="★" width={90} height={40} surface="paper" state={gRating} /></FieldTap>
      )}
    </div>
  ) : null;

  const theaterCell = (theaterVal || screenVal || gTheater || gScreen) ? (
    <div key="theater">
      <div style={metaLabel()}>Théâtre</div>
      {theaterVal ? (
        <FieldTap field="theater" onField={onField}><div style={metaValue()}>{theaterVal}</div></FieldTap>
      ) : gTheater ? (
        <FieldTap field="theater" onField={onField}><FieldGhost text="THEATER" width={200} height={40} surface="paper" state={gTheater} /></FieldTap>
      ) : null}
      {screenVal ? (
        <FieldTap field="screen" onField={onField}>
          <div style={{ marginTop: 5, fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, letterSpacing: -0.2, color: BROWN, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{screenVal}</div>
        </FieldTap>
      ) : gScreen ? (
        <FieldTap field="screen" onField={onField}><div style={{ marginTop: 5 }}><FieldGhost text="SCREEN" width={140} height={30} surface="paper" state={gScreen} /></div></FieldTap>
      ) : null}
    </div>
  ) : null;

  const metaCells = [
    theaterCell,
    metaCell('Durée', runtimeVal, 'runtime', gRuntime, 'RUNTIME'),
    ratingCell,
    metaCell('Sortie', releaseVal, 'releaseDate', gRelease, 'RELEASE'),
  ].filter(Boolean);

  // 스텁 5그룹(회전 -90°) — DOM 좌→우 = 회전 후 아래→위. 존재하는 그룹만 담고 사이에만 구분선을 끼워
  // 허공 구분선을 원천 차단한다(#216 P1.1). admis·le billet은 장식이라 항상 렌더.
  const stubGroups: ReactNode[] = [];
  // 바코드 폭 216->286(#444) — Code128C(143유닛) 기준 모듈당 2px을 채우는 최소값. 스캐너 유효성
  // 하한이라 아래 길이축 예산에서 유일하게 못 줄이는 항목이고, 그래서 예산의 30%를 혼자 쓴다.
  //
  // ── 스텁 길이축 예산 (캔버스 높이 960) · 실측 `bun scripts/measure-editorial-stub.mjs` ──
  // 최악 케이스 = 5그룹 전부 + CGV 16자리 예매번호 + 좌석 4석(#573).
  // **그룹은 column flex라 길이축 기여 = 가장 넓은 자식**이다(높이 합이 아니다) — 그래서 큰 글자
  // (admis 44 · le billet 36)를 줄여도 안 줄고, 실제로 폭을 쥔 건 작은 모노 라벨이었다.
  //
  //   그룹        전(2026-07-29)  후    최광폭 자식(후)
  //   바코드        286          286   svg (#444 하한, 고정)
  //   스탬프         53           53   체인 텍스트 라벨
  //   좌석          226          184   좌석값 26px (SEAT_MAX_WIDTH 260→220)
  //   admis        112           96   non-transférable 15px (구: ADMIT ONE 14/ls4 = 112)
  //   le billet    155          125   Édition Spéciale 11/ls1.2 (구: 12/ls2.5 = 155)
  // admis 44→40은 회수에 5px 기여한다 — 44로 두면 그 글자(101)가 다시 최광폭이 돼 그룹이 101이
  // 된다. 반면 le billet 36→32(95→84)는 길이축 기여 0이고, 짝인 모노 라벨을 줄인 만큼 큰 글자도
  // 같이 줄여 그룹 안 비율을 유지하려는 시각 조정이다.
  //   구분선 4개      4            4
  //   gap ×8       160          128   gap 20→16 (분리는 두께가 아니라 대비로: opacity 0.32→0.6)
  //   padding 양끝    44           64   0 22px → 0 32px
  //   합계        1039          940   (예산 960 / 여유 −79 → +20)
  //
  // 전엔 39.5px씩 넘쳐 padding 22px을 다 먹고 실콘텐츠를 17.5px 잘라먹었다. 후에는 양끝 실여백이
  // 32 + 여유 20/2 = 42px.
  // 구 주석의 997px은 **값 없음 + ghost** 케이스였다(체인/포맷 자리표시자 120 · 좌석 ghost 116) —
  // 값이 채워진 쪽이 1039로 더 나빴다. `--empty`로 그 반대 극단도 재고, 후에는 둘 다 940이었다
  // (#589로 자리표시자에도 폭 상한이 걸려 `--empty`는 지금 884다 — 아래 로고 표 참고).
  // 두께축(#572 재확인 요청): 회전 행의 높이 132 ≤ STUB_W 213 — 바코드 height 70·구분선 112도
  // 그 안이라 224→213에 여유가 있다. 하네스가 매 실행 이 축도 대조한다.
  // 업로드 로고(#589) — 위 표의 스탬프 53px은 텍스트 라벨 기준이고, 로고는 그 자리를 이렇게 쓴다
  // (`--logo`: 5:1 로고 + scale 1.3, 나머지는 위와 같은 최악 케이스).
  //
  //   스탬프 그룹     전     후    비고
  //   체인 로고 img  208     64    STUB_STAMP_MAX_W (전: h 41.6 × STAMP_MAX_ASPECT 5)
  //   합계          1096    952    (예산 960 / 여유 −136 → +8)
  //
  // 로고는 contain이라 잘리지 않고 64×12.8로 축소된다. 같은 상한이 ghost placeholder에도 걸린다
  // — scale 1.3에서 폭이 120×1.56 = 187px이라 로고와 같은 방식으로 넘쳤다.
  //
  // 긴 텍스트 라벨(#590) — 로고와 같은 자리를 먹는 텍스트 경로. STAMP_LABEL_MAX(24자)를 채우고
  // scale 1.3인 최악(`--long-label`)이 이랬다. TextStamp가 nowrap에 폭 축소가 없어 그대로 자랐다.
  //
  //   스탬프 그룹     전     후    비고
  //   체인 라벨      496     64    폰트 29 → 11px (fitFontSizeToWidth, 상한은 STUB_STAMP_MAX_W)
  //   합계          1383    952    (예산 960 / 여유 −423 → +8)
  //
  // 폭 상한만 걸지 않은 이유는 TextStamp 주석에 있다 — 로고는 contain으로 축소되지만 텍스트는
  // 잘려서 브랜드명이 사라진다. 상한 안에 드는 라벨(기본 케이스 'CGV' 53px)은 폰트가 안 바뀌고,
  // 'MEGABOX'(#590이 지목한 실경로)는 11px·60px으로 잘림 없이 들어간다. 24자는 하한에서도 안
  // 들어가 ellipsis가 받는다 — 그 천장의 근거는 TEXT_STAMP_MIN_SIZE 주석.
  if (fv?.bookingNo ?? true)
    stubGroups.push(
      <FieldTap key="booking" field="bookingNo" onField={onField}>
        <Barcode value={bookingNo} color={CREAM} orientation="horizontal" width={BARCODE_WIDTH} height={70} showText={false} encoding="code128c" />
      </FieldTap>
    );
  if (stubStampOn)
    stubGroups.push(
      <div key="stamp" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <FieldTap field="chain" onField={onField}>
          <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={48} surface="paper" ghost={ghost} scale={components.chainScale ?? 1} maxWidth={STUB_STAMP_MAX_W} />
        </FieldTap>
        {/* 두 스탬프가 다 렌더될 때만 장식 점(35mm의 amber divider dot과 같은 패턴) */}
        {stubChainOn && stubFormatOn && <span style={{ width: 5, height: 5, borderRadius: '50%', background: CREAM, opacity: 0.55, flexShrink: 0 }} />}
        <FieldTap field="format" onField={onField}>
          <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.55} surface="paper" ghost={ghost} scale={components.formatScale ?? 1} maxWidth={STUB_STAMP_MAX_W} />
        </FieldTap>
      </div>
    );
  if (seatVal || gSeat)
    stubGroups.push(
      <div key="seat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <span style={{ ...italic(CREAM, 24), opacity: 0.9, lineHeight: 1 }}>place</span>
        {seatVal ? (
          <FieldTap field="seat" onField={onField}><span style={{ fontWeight: 900, fontSize: seatFontSize, fontFamily: FONT_SANS, letterSpacing: -2, lineHeight: 0.85, display: 'inline-block', maxWidth: SEAT_MAX_WIDTH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seatVal}</span></FieldTap>
        ) : (
          <FieldTap field="seat" onField={onField}><FieldGhost text="SEAT" width={100} height={50} surface="dark" state={gSeat} /></FieldTap>
        )}
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, letterSpacing: 2.5, opacity: 0.72 }}>SIÈGE · SEAT</span>
      </div>
    );
  stubGroups.push(
    <div key="admis" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <span style={{ ...italic(CREAM, 40), lineHeight: 0.9 }}>admis</span>
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2.4, opacity: 0.82 }}>ADMIT ONE</span>
      <span style={{ ...italic(CREAM, 15), opacity: 0.72, marginTop: 1 }}>non-transférable</span>
    </div>
  );
  stubGroups.push(
    <div key="billet" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ ...italic(CREAM, 32), lineHeight: 0.9 }}>le billet</span>
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>Édition Spéciale</span>
    </div>
  );
  // 구분선은 대비로만 강화한다(#573) — 두께나 높이를 키우면 방금 회수한 길이축 여백을 도로 먹는다.
  const stubDivider = <span style={{ width: 1, height: 112, background: CREAM, opacity: 0.6, flexShrink: 0 }} />;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: INK, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex' }}>
      {/* A: Poster — 포스터 컬럼에만 탭(#259). editorial은 다열이라 root가 아닌 이 열에.
          배경은 Poster의 letterboxBg가 칠하므로 래퍼 자체엔 안 둔다(nit poster-letterbox-bg, #440). */}
      <div style={{ flex: `0 0 ${POSTER_W}px`, position: 'relative', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        <Poster src={croppedImageUrl} {...posterFitProps({ letterboxBg: POSTER_LETTERBOX_BG })} material={components.material} coating={components.coating} materialIntensity={components.materialIntensity} coatingIntensity={components.coatingIntensity} posterOpacity={components.posterOpacity} embossStamps={embossStamps} embossPaths={embossPaths} embossIntensity={embossIntensity} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150, background: 'linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0))' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0))' }} />
      </div>

      {/* B: Gold foil strip — 순수 장식 크롬. 세로 홀로그램 골드 + 프랑스어 큐레이션 텍스트. 편집 필드 아님 → aria-hidden. */}
      <div aria-hidden="true" style={{ flex: `0 0 ${FOIL_W}px`, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#7a5a24 0%,#c99a3e 12%,#f4de95 26%,#b8842f 40%,#ecc86b 55%,#9c7226 70%,#f2d888 84%,#8a641f 100%)', boxShadow: 'inset 1px 0 rgba(0,0,0,.3), inset -1px 0 rgba(0,0,0,.3)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.45) 0 2px, rgba(255,255,255,0) 2px 8px)', mixBlendMode: 'screen' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(62deg, rgba(0,0,0,.16) 0 1px, rgba(0,0,0,0) 1px 7px)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* aria-hidden 장식 텍스처(대문자 강제) — 35mm 스프로켓 엣지 라벨과 같은 성격이라 BI v2
              워드마크 교체(#386) 스코프 밖. textTransform:uppercase라 소문자로 바꿔도 대문자로 나온다. */}
          <div style={{ writingMode: 'vertical-rl', fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(74,52,14,.78)', textShadow: '0 1px 0 rgba(255,255,255,.45)', whiteSpace: 'nowrap' }}>FILME · SÉLECTION 2024 · ÉDITION SPÉCIALE · FILME · SÉLECTION 2024</div>
        </div>
      </div>

      {/* C: Main — #530 형제 레이어 분할: 배경은 componentOpacity 밖(종이에 이미 인쇄된 바탕),
          콘텐츠만 안(오버레이). 두 레이어 다 outer의 position:relative 박스를 absolute inset:0으로
          꽉 채워 패딩·투명도 이관 전과 픽셀이 동일하다. */}
      <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative', background: PAPER }}>
        <BackgroundPatternLayer
          image={components.backgroundPatternImage}
          scale={components.backgroundPatternScale ?? 1}
        />
        <div style={{ position: 'absolute', inset: 0, color: INK, display: 'flex', flexDirection: 'column', padding: `44px ${MAIN_PAD_X}px 36px`, boxSizing: 'border-box', opacity: componentOpacity }}>
        {/* Kicker — 장식 큐레이션 라벨(bar + En Reprise) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <span style={{ width: 46, height: 2, background: accent, flexShrink: 0 }} />
          <span style={{ ...italic(accent, 29) }}>En Reprise · Longs Métrages</span>
        </div>

        {/* Title */}
        {titleVal ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ fontWeight: 900, fontSize: titleFontSize, fontFamily: FONT_KR, lineHeight: 0.98, letterSpacing: -2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleVal}</div>
          </FieldTap>
        ) : gTitle ? (
          <FieldTap field="title" onField={onField}><FieldGhost text="TITLE" width="60%" height={72} size={2} surface="paper" state={gTitle} /></FieldTap>
        ) : null}

        {titleOgVal ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ marginTop: 12, ...italic(INK, 30), opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOgVal}</div>
          </FieldTap>
        ) : gTitleOg ? (
          <FieldTap field="titleOg" onField={onField}><div style={{ marginTop: 12 }}><FieldGhost text="ORIGINAL TITLE" width={280} height={32} surface="paper" state={gTitleOg} /></div></FieldTap>
        ) : null}

        {/* avec — cast */}
        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: AVEC_GAP }}>
              <span style={{ ...italic(accent, 26), flexShrink: 0 }}>avec</span>
              <span style={{ fontWeight: 600, fontSize: 33, fontFamily: FONT_KR, letterSpacing: -0.3, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actorsVal}</span>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: AVEC_GAP }}>
              <span style={{ ...italic(accent, 26) }}>avec</span>
              <FieldGhost text="CAST" width={280} height={40} surface="paper" state={gActors} />
            </div>
          </FieldTap>
        ) : null}

        <div style={{ height: 1, background: INK, opacity: 0.2, margin: '26px 0' }} />

        {/* Séance + 도착시간 */}
        {(seanceOn || arrivalOn) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {seanceOn && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ ...italic(BROWN, 26), flexShrink: 0 }}>Séance</span>
                {watchDateVal ? (
                  <FieldTap field="watchDate" onField={onField}><span style={{ fontWeight: 800, fontSize: 38, fontFamily: FONT_SANS, letterSpacing: -0.5, lineHeight: 1 }}>{watchDateVal}</span></FieldTap>
                ) : (
                  <FieldTap field="watchDate" onField={onField}><FieldGhost text="DATE" width={220} height={40} surface="paper" state={gWatchDate} /></FieldTap>
                )}
              </div>
            )}
            {arrivalOn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, letterSpacing: 2, color: BROWN, lineHeight: 1.45 }}>SE PRÉSENTER À<br />PLEASE ARRIVE AT</div>
                <svg aria-hidden="true" width="42" height="42" viewBox="0 0 42 42" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="21" cy="21" r="18.5" stroke={INK} strokeWidth="2.5" />
                  <path d="M21 21V10" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M21 21L29 25" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                {watchTimeVal ? (
                  <FieldTap field="watchTime" onField={onField}><span style={{ fontWeight: 900, fontSize: 54, fontFamily: FONT_SANS, letterSpacing: -2, lineHeight: 0.85 }}>{watchTimeVal}</span></FieldTap>
                ) : (
                  <FieldTap field="watchTime" onField={onField}><FieldGhost text="TIME" width={140} height={48} surface="paper" state={gWatchTime} /></FieldTap>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, maxHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div style={{ height: 1, background: INK, opacity: 0.2 }} /></div>

        {/* Meta grid — Théâtre / Durée / Note / Sortie (좌석은 스텁으로 이동) */}
        {metaCells.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '22px 44px', alignItems: 'start' }}>{metaCells}</div>
        )}

        {/* 프랑스어 고지문(장식 법적 문구) — maxWidth는 메인 열 가용폭에 연동(#440 → #572 NOTICE_MAX_W). */}
        <div style={{ marginTop: 20, fontWeight: 500, fontSize: 14, fontFamily: FONT_SANS, lineHeight: 1.5, color: BROWN, maxWidth: NOTICE_MAX_W }}>
          Place garantie jusqu&apos;à 25min avant le début de la séance.<br />
          <span style={{ opacity: 0.72 }}>Seat guaranteed up to 25min before the beginning of the screening.</span>
        </div>

        {/* Footer — réalisé avec FILME / par 서명 */}
        <div style={{ marginTop: 16, paddingTop: 15, borderTop: `1px solid ${INK}`, opacity: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: 0.6 }}>
            <span style={{ ...italic(BROWN, 22) }}>réalisé avec</span>
            <MoodWordmark size={22} color={INK} accent={WORDMARK_ACCENT} />
          </div>
          {components.signatureImage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...italic(accent, 26), flexShrink: 0 }}>par</span>
              <FieldTap field="signature" onField={onField}>
                <SignatureStamp image={components.signatureImage} height={36} scale={components.signatureScale ?? 1} surface="paper" />
              </FieldTap>
            </div>
          ) : signatureVal ? (
            // 라벨은 FieldTap 밖(#417, Criterion과 동일 형제 버그) — measureField가 FieldTap의
            // 실제 자식을 재는데(#646) "par"까지 감싸면 캐럿이 값이 아니라 라벨 앞에 뜬다.
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
              <span style={{ ...italic(accent, 26), flexShrink: 0 }}>par</span>
              <FieldTap field="signature" onField={onField}>
                <span style={{ ...userTextFont(signatureVal), fontSize: 30, letterSpacing: -0.3, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{signatureVal}</span>
              </FieldTap>
            </div>
          ) : gSignature ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ ...italic(accent, 26), flexShrink: 0 }}>par</span>
              <FieldTap field="signature" onField={onField}>
                <FieldGhost text="SIGNATURE" width={200} height={36} surface="paper" state={gSignature} />
              </FieldTap>
            </div>
          ) : null}
        </div>

        {/* 크로스헤어(우상단 장식) */}
        <div aria-hidden="true" style={{ position: 'absolute', right: 22, top: 22, width: 22, height: 22, pointerEvents: 'none', opacity: 0.32 }}>
          <span style={{ position: 'absolute', right: 0, top: 10, width: 22, height: 1, background: INK }} />
          <span style={{ position: 'absolute', right: 10, top: 0, width: 1, height: 22, background: INK }} />
          <span style={{ position: 'absolute', right: 6, top: 6, width: 9, height: 9, border: `1px solid ${INK}`, borderRadius: '50%' }} />
        </div>
        </div>
      </div>

      {/* D: Stub — accent 배경, 크림 잉크. 회전 -90° 5그룹(바코드·체인/포맷·좌석·admis·le billet). */}
      <div style={{ flex: `0 0 ${STUB_W}px`, position: 'relative', background: accent, overflow: 'hidden', color: CREAM, opacity: componentOpacity }}>
        {/* 절취 천공 엣지(페이퍼색 구멍) + 점선 */}
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, backgroundImage: `radial-gradient(circle at left center, ${PAPER} 0 5.5px, rgba(244,237,224,0) 6px)`, backgroundSize: '12px 24px', backgroundRepeat: 'repeat-y', backgroundPosition: 'left top', zIndex: 2, filter: 'drop-shadow(1px 0 0 rgba(0,0,0,.22))' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 18, top: 14, bottom: 14, width: 0, borderLeft: '1.5px dashed rgba(247,236,226,.6)', zIndex: 2 }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg, rgba(0,0,0,.05) 0 2px, rgba(0,0,0,0) 2px 9px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* DOM 좌→우 = 회전 후 아래→위 */}
          <div style={{ transform: 'rotate(-90deg)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 32px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
            {stubGroups.map((g, i) => (
              <Fragment key={i}>
                {i > 0 ? stubDivider : null}
                {g}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
