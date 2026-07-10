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
  Poster,
  fitFontSizeToWidth,
  gate,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
} from './_shared';

/**
 * Editorial — 영화제 공식 티켓(마스터 Ticket Design Master.dc.html v2 · 2026-07-08 resync, 에픽 #281).
 * 4열 재구조: 포스터 516 | 골드포일 세로 스트립 42(장식) | 메인 flex | 절취 스텁 224(accent 배경).
 * 메인: 킥커(En Reprise) → 타이틀 72/900 → avec → Séance + 도착시간(시계) → 메타 그리드(Théâtre/Durée/
 * Note/Sortie 37/800) → 프랑스어 고지문 → 푸터(réalisé avec FILME / par). 좌석·바코드·체인/포맷·le billet은
 * 스텁(회전 -90°) 5그룹으로 이동. reissue는 마스터 메타 그리드에 슬롯이 없어(킥커 En Reprise는 장식) 미렌더.
 */
const PAPER = '#f4ede0';
const INK = '#1a1612';
const BROWN = '#6f6347';
const CREAM = '#f7ece2';

const POSTER_W = 516;
const FOIL_W = 42;
const STUB_W = 224;

export const MoodEditorial = memo(function MoodEditorial({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : resolveInk(themeColor, '#a8312a');
  const { bookingNo, watchDateClean, releaseClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 메인 열 가용폭(1477 - poster516 - foil42 - stub224 - padding52*2).
  // 2줄 클램프라 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
  const titleFontSize = fitFontSizeToWidth(titleVal, 591 * 2, { fontFamily: FONT_KR, fontWeight: 900, minSize: 44, maxSize: 72 });
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const seatVal = gate(fv?.seat, d.seat);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseVal = gate(fv?.releaseDate, releaseClean);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors));
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
  const gRating = showFieldGhost(fv?.rating, d.rating, ghost);
  const gRelease = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);

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
  const stubStampOn =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  // 단일 값 메타 셀(Durée/Note/Sortie) — 값 있으면 값, 비었고 ghost면 라벨 점선.
  const metaCell = (label: string, value: string, field: 'runtime' | 'rating' | 'releaseDate', ghostOn: boolean, ghostLabel: string, valueColor = INK) =>
    value || ghostOn ? (
      <div key={field}>
        <div style={metaLabel()}>{label}</div>
        {value ? (
          <FieldTap field={field} onField={onField}><div style={metaValue(valueColor)}>{value}</div></FieldTap>
        ) : (
          <FieldTap field={field} onField={onField}><FieldGhost text={ghostLabel} width={150} height={40} surface="paper" /></FieldTap>
        )}
      </div>
    ) : null;

  const ratingCell = (ratingVisible || gRating) ? (
    <div key="rating">
      <div style={metaLabel()}>Note</div>
      {ratingVisible ? (
        <FieldTap field="rating" onField={onField}><div style={metaValue(accent)}>★ {d.rating.toFixed(1)}</div></FieldTap>
      ) : (
        <FieldTap field="rating" onField={onField}><FieldGhost text="★" width={90} height={40} surface="paper" /></FieldTap>
      )}
    </div>
  ) : null;

  const theaterCell = (theaterVal || screenVal || gTheater || gScreen) ? (
    <div key="theater">
      <div style={metaLabel()}>Théâtre</div>
      {theaterVal ? (
        <FieldTap field="theater" onField={onField}><div style={metaValue()}>{theaterVal}</div></FieldTap>
      ) : gTheater ? (
        <FieldTap field="theater" onField={onField}><FieldGhost text="THEATER" width={200} height={40} surface="paper" /></FieldTap>
      ) : null}
      {screenVal ? (
        <FieldTap field="screen" onField={onField}>
          <div style={{ marginTop: 5, fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, letterSpacing: -0.2, color: BROWN, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{screenVal}</div>
        </FieldTap>
      ) : gScreen ? (
        <FieldTap field="screen" onField={onField}><div style={{ marginTop: 5 }}><FieldGhost text="SCREEN" width={140} height={30} surface="paper" /></div></FieldTap>
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
  if (fv?.bookingNo ?? true)
    stubGroups.push(
      <FieldTap key="booking" field="bookingNo" onField={onField}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
          <Barcode value={bookingNo} color={CREAM} orientation="horizontal" width={132} height={70} showText={false} />
          <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15, letterSpacing: 1.4 }}>No. {bookingNo}</span>
        </div>
      </FieldTap>
    );
  if (stubStampOn)
    stubGroups.push(
      <div key="stamp" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <FieldTap field="chain" onField={onField}>
          <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={48} surface="paper" ghost={ghost} />
        </FieldTap>
        <FieldTap field="format" onField={onField}>
          <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.55} surface="paper" ghost={ghost} />
        </FieldTap>
      </div>
    );
  if (seatVal || gSeat)
    stubGroups.push(
      <div key="seat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <span style={{ ...italic(CREAM, 24), opacity: 0.9, lineHeight: 1 }}>place</span>
        {seatVal ? (
          <FieldTap field="seat" onField={onField}><span style={{ fontWeight: 900, fontSize: 56, fontFamily: FONT_SANS, letterSpacing: -2, lineHeight: 0.85 }}>{seatVal}</span></FieldTap>
        ) : (
          <FieldTap field="seat" onField={onField}><FieldGhost text="SEAT" width={100} height={50} surface="dark" /></FieldTap>
        )}
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, letterSpacing: 2.5, opacity: 0.72 }}>SIÈGE · SEAT</span>
      </div>
    );
  stubGroups.push(
    <div key="admis" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <span style={{ ...italic(CREAM, 44), lineHeight: 0.9 }}>admis</span>
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, letterSpacing: 4, opacity: 0.82 }}>ADMIT ONE</span>
      <span style={{ ...italic(CREAM, 16), opacity: 0.72, marginTop: 1 }}>non-transférable</span>
    </div>
  );
  stubGroups.push(
    <div key="billet" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ ...italic(CREAM, 36), lineHeight: 0.9 }}>le billet</span>
      <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 }}>Édition Spéciale</span>
    </div>
  );
  const stubDivider = <span style={{ width: 1, height: 112, background: CREAM, opacity: 0.32, flexShrink: 0 }} />;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: INK, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex' }}>
      {/* A: Poster — 포스터 컬럼에만 탭(#259). editorial은 다열이라 root가 아닌 이 열에. */}
      <div style={{ flex: `0 0 ${POSTER_W}px`, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150, background: 'linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0))' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, background: 'linear-gradient(0deg,rgba(0,0,0,.6),rgba(0,0,0,0))' }} />
      </div>

      {/* B: Gold foil strip — 순수 장식 크롬. 세로 홀로그램 골드 + 프랑스어 큐레이션 텍스트. 편집 필드 아님 → aria-hidden. */}
      <div aria-hidden="true" style={{ flex: `0 0 ${FOIL_W}px`, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#7a5a24 0%,#c99a3e 12%,#f4de95 26%,#b8842f 40%,#ecc86b 55%,#9c7226 70%,#f2d888 84%,#8a641f 100%)', boxShadow: 'inset 1px 0 rgba(0,0,0,.3), inset -1px 0 rgba(0,0,0,.3)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.45) 0 2px, rgba(255,255,255,0) 2px 8px)', mixBlendMode: 'screen' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(62deg, rgba(0,0,0,.16) 0 1px, rgba(0,0,0,0) 1px 7px)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ writingMode: 'vertical-rl', fontFamily: FONT_MONO, fontWeight: 700, fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', color: 'rgba(74,52,14,.78)', textShadow: '0 1px 0 rgba(255,255,255,.45)', whiteSpace: 'nowrap' }}>FILME · SÉLECTION 2024 · ÉDITION SPÉCIALE · FILME · SÉLECTION 2024</div>
        </div>
      </div>

      {/* C: Main */}
      <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative', background: PAPER, color: INK, display: 'flex', flexDirection: 'column', padding: '44px 52px 36px', boxSizing: 'border-box', opacity: componentOpacity }}>
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
          <FieldTap field="title" onField={onField}><FieldGhost text="TITLE" width="60%" height={72} size={2} surface="paper" /></FieldTap>
        ) : null}

        {titleOgVal ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ marginTop: 12, ...italic(INK, 30), opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOgVal}</div>
          </FieldTap>
        ) : gTitleOg ? (
          <FieldTap field="titleOg" onField={onField}><div style={{ marginTop: 12 }}><FieldGhost text="ORIGINAL TITLE" width={280} height={32} surface="paper" /></div></FieldTap>
        ) : null}

        {/* avec — cast */}
        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ ...italic(accent, 26), flexShrink: 0 }}>avec</span>
              <span style={{ fontWeight: 600, fontSize: 33, fontFamily: FONT_KR, letterSpacing: -0.3, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actorsVal}</span>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...italic(accent, 26) }}>avec</span>
              <FieldGhost text="CAST" width={280} height={40} surface="paper" />
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
                  <FieldTap field="watchDate" onField={onField}><FieldGhost text="DATE" width={220} height={40} surface="paper" /></FieldTap>
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
                  <FieldTap field="watchTime" onField={onField}><FieldGhost text="TIME" width={140} height={48} surface="paper" /></FieldTap>
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

        {/* 프랑스어 고지문(장식 법적 문구) */}
        <div style={{ marginTop: 20, fontWeight: 500, fontSize: 14, fontFamily: FONT_SANS, lineHeight: 1.5, color: BROWN, maxWidth: 540 }}>
          Place garantie jusqu&apos;à 25min avant le début de la séance.<br />
          <span style={{ opacity: 0.72 }}>Seat guaranteed up to 25min before the beginning of the screening.</span>
        </div>

        {/* Footer — réalisé avec FILME / par 서명 */}
        <div style={{ marginTop: 16, paddingTop: 15, borderTop: `1px solid ${INK}`, opacity: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: 0.6 }}>
            <span style={{ ...italic(BROWN, 22) }}>réalisé avec</span>
            <span style={{ fontWeight: 800, fontSize: 22, fontFamily: FONT_SANS, letterSpacing: 3, color: INK }}>FILME</span>
          </div>
          {signatureVal ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                <span style={{ ...italic(accent, 26), flexShrink: 0 }}>par</span>
                <span style={{ fontWeight: 600, fontSize: 30, fontFamily: FONT_KR, letterSpacing: -0.3, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>{signatureVal}</span>
              </div>
            </FieldTap>
          ) : showFieldGhost(fv?.signature, d.signature, ghost) ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...italic(accent, 26), flexShrink: 0 }}>par</span>
                <FieldGhost text="SIGNATURE" width={200} height={36} surface="paper" />
              </div>
            </FieldTap>
          ) : null}
        </div>

        {/* 크로스헤어(우상단 장식) */}
        <div aria-hidden="true" style={{ position: 'absolute', right: 22, top: 22, width: 22, height: 22, pointerEvents: 'none', opacity: 0.32 }}>
          <span style={{ position: 'absolute', right: 0, top: 10, width: 22, height: 1, background: INK }} />
          <span style={{ position: 'absolute', right: 10, top: 0, width: 1, height: 22, background: INK }} />
          <span style={{ position: 'absolute', right: 6, top: 6, width: 9, height: 9, border: `1px solid ${INK}`, borderRadius: '50%' }} />
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
          <div style={{ transform: 'rotate(-90deg)', display: 'flex', alignItems: 'center', gap: 20, padding: '0 22px', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>
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
