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
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  posterFitProps,
  posterTapProps,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
  useFontsReady,
} from './_shared';

/**
 * v05 — 티켓 스텁(마스터 Ticket Design Master.dc.html v2 · 2026-07-08 resync, 에픽 #281).
 * 재구조: 포스터 760(텍스트 없음) → 절취 16(3px dashed, 반원 노치 없음) → 페이퍼 스텁 flex:1.
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
// 본문 좌우 패딩(#446 톤업, 40→56) — 패딩·티커 풀블리드 음수마진·타이틀 가용폭 세 곳이 공유하는 단일 소스.
const PAD_X = 56;

const POSTER_H = 760;
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

export const MoodStub = memo(function MoodStub({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const { bookingNo, watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 페이퍼 스텁 가용폭(960 - PAD_X*2). 2줄 클램프라 가용폭×2를
  // maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고). PAD_X는 패딩·
  // 티커 음수마진과 공유하는 단일 소스(#446).
  const fontsReady = useFontsReady();
  const titleFontSize = fitFontSizeToWidth(titleVal, (960 - PAD_X * 2) * 2, { fontFamily: FONT_KR, fontWeight: 700, minSize: 26, maxSize: 42 }, fontsReady);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors), 5);
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
  const bothStamps = chainOn && formatOn;

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

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: INK, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 포스터 — 텍스트 없음. 분할 레이아웃이라 root가 아닌 이 영역에만 포스터 탭(#259).
          배경은 Poster의 letterboxBg가 칠하므로 래퍼 자체엔 안 둔다(nit poster-letterbox-bg, #440 —
          editorial과 동일하게 죽은 스타일이던 래퍼 background 제거). */}
      <div style={{ flex: `0 0 ${POSTER_H}px`, position: 'relative', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        {/* 가로 밴드(1.263)라 세로 포스터를 contain하면 좌우로 크게 벌어진다 — 다른 5무드와 같은
            posterFitProps 공통 정책을 태워 그 여백을 blur 포스터 배경으로 채운다(#440 레터박스
            정교화). 자연 간극이 이미 커 frameInsetY 최소 노출 보장은 불필요(editorial/35mm-landscape와
            동일 패턴). */}
        <Poster src={croppedImageUrl} {...posterFitProps(components.posterFit, { letterboxBg: POSTER_LETTERBOX_BG })} texture={components.texture} textureIntensity={components.textureIntensity} posterOpacity={components.posterOpacity} />
      </div>

      {/* 절취선(점선) — 크림 밴드에 3px dashed, 반원 노치 없음(마스터 재동기화 #281). */}
      <div aria-hidden="true" style={{ height: 16, flexShrink: 0, background: PAPER, display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1, borderTop: `3px dashed rgba(26,22,18,.85)` }} />
      </div>

      {/* 하단 페이퍼 스텁 */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', background: PAPER, padding: `22px ${PAD_X}px 26px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', opacity: componentOpacity }}>
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
              <FieldTap field="chain" onField={onField}>
                <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={39} surface="paper" ghost={ghost} />
              </FieldTap>
              {bothStamps && <span style={{ width: 1, height: 24, background: INK, opacity: 0.35, flexShrink: 0 }} />}
              <FieldTap field="format" onField={onField}>
                <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.6} surface="paper" ghost={ghost} />
              </FieldTap>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                      <FieldTap field="actors" onField={onField}><span style={{ ...rowValue(20), flexShrink: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actorsVal}</span></FieldTap>
                    ) : (
                      <FieldTap field="actors" onField={onField}><FieldGhost text="CAST" width={200} height={30} surface="paper" state={gActors} /></FieldTap>
                    )}
                  </Row>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* 푸터 — made with FILME · collected by 서명 + 스텁 바코드(300×40, 텍스트 없음) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 32, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN }}>made with</span>
              <MoodWordmark size={22} color={INK} accent={WORDMARK_ACCENT} />
            </div>
            {signatureVal ? (
              <>
                <span style={{ width: 1, height: 24, background: INK, opacity: 0.18, flexShrink: 0 }} />
                <FieldTap field="signature" onField={onField}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, minWidth: 0 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 22, color: BROWN, flexShrink: 0 }}>collected by</span>
                    <span style={{ fontWeight: 600, fontSize: 24, letterSpacing: -0.3, fontFamily: FONT_KR, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</span>
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
