import { CSSProperties } from 'react';
import type { SheetTarget } from '@/constants/fields';
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
  gate,
  pickTitleSize,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
} from './_shared';

/**
 * v05 — 티켓 스텁. 상단 포스터 풀블리드 + 점선 절취선(양옆 반원 노치) + 하단 크림 스텁(#210).
 * 상단: 체인·포맷 스탬프 + ADMIT ONE, 하단 스크림 위 now showing / 타이틀 / 원제.
 * 스텁: ADMIT ONE 워드마크 + 일련번호, boxed 그리드(SEAT 대형 + DATE/TIME/SCREEN), COLLECTED BY + 바코드.
 * 데이터=Pretendard, 장식 라벨=Instrument Serif italic, 코드=Mono. 분할 레이아웃이라 포스터 영역에만 탭(#259).
 */
const PAPER = '#f4ede0';
const PAPER_DEEP = '#1a1612';
const PAPER_DIM = '#8a7e63';
const NOTCH = '#000000'; // captureToImage backgroundColor와 일치 — 절취선 노치를 배경색으로 도려냄(Editorial 노치 정렬)

const POSTER_H = 858;
const NOTCH_R = 30;

const cellLabel: CSSProperties = {
  color: PAPER_DIM,
  fontWeight: 700,
  fontSize: 17,
  fontFamily: FONT_MONO,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
  marginBottom: 8,
};
const cellValue: CSSProperties = {
  color: PAPER_DEEP,
  fontWeight: 700,
  fontSize: 34,
  fontFamily: FONT_SANS,
  letterSpacing: -0.4,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export function MoodStub({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : resolveInk(themeColor, '#a8312a');
  const titleSize = pickTitleSize(d.title.length, [116, 96, 78, 62]);
  const { bookingNo, watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors));
  const seatVal = gate(fv?.seat, d.seat);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal = gate(fv?.reissue, reissueClean);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  const ghostOn = ghost === true;
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);

  const hasTopStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const bothStamps =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) &&
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  // SCREEN 셀 분해(#266 PR-B) — theater·screen을 시각은 ·로 붙이되 각각 독립 FieldTap + 개별 ghost.
  // 값이 있으면 텍스트만 두어 데스크톱(onField=undefined)에선 FieldTap이 통과, 분해 전과 마크업 동일.
  // 비었고 ghost 모드면 라벨 점선(FieldGhost)으로 재노출 어포던스를 준다.
  const theaterPiece = theaterVal ? (
    <FieldTap field="theater" onField={onField}>{theaterVal}</FieldTap>
  ) : gTheater ? (
    <FieldTap field="theater" onField={onField}><FieldGhost text="THEATER" width={130} height={30} surface="paper" /></FieldTap>
  ) : null;
  const screenPiece = screenVal ? (
    <FieldTap field="screen" onField={onField}>{screenVal}</FieldTap>
  ) : gScreen ? (
    <FieldTap field="screen" onField={onField}><FieldGhost text="SCREEN" width={130} height={30} surface="paper" /></FieldTap>
  ) : null;

  const scrimGrad =
    'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.55) 40%, rgba(10,10,10,0.94) 100%)';
  const topScrim = 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)';
  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: PAPER_DEEP, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      {/* 상단 포스터 영역 — 분할 레이아웃이라 root가 아닌 이 영역에만 포스터 탭(#259) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: POSTER_H, background: '#0a0a0a', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />

        {/* #219 componentOpacity: 포스터 뺀 오버레이 전체 페이드. inset:0 래퍼라 opacity 1에서 no-op. */}
        <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
          {/* Top — ADMIT ONE + chain/format */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 200, background: topScrim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 48, right: 48, top: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            {hasTopStamp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <FieldTap field="chain" onField={onField}>
                  <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface="dark" ghost={ghost} />
                </FieldTap>
                {bothStamps && <span style={{ width: 1, height: 34, background: '#f4ede0', opacity: 0.5 }} />}
                <FieldTap field="format" onField={onField}>
                  <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.82} surface="dark" ghost={ghost} />
                </FieldTap>
              </div>
            ) : <span />}
            <span style={{ fontWeight: 800, fontSize: 22, fontFamily: FONT_SANS, letterSpacing: 5, color: '#f4ede0', textShadow: '0 2px 8px rgba(0,0,0,0.85)', whiteSpace: 'nowrap' }}>ADMIT ONE</span>
          </div>

          {/* Rating chip (top-right, below ADMIT ONE) */}
          {ratingVisible && (
            <FieldTap field="rating" onField={onField}>
              <div style={{ position: 'absolute', right: 48, top: 104, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 34, fontFamily: FONT_SANS, color: '#f4ede0', textShadow: '0 2px 8px rgba(0,0,0,0.85)' }}>★ {d.rating.toFixed(1)}</span>
              </div>
            </FieldTap>
          )}

          {/* Bottom scrim caption */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 460, background: scrimGrad, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 48, right: 48, bottom: 46, color: '#f4ede0' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 32, opacity: 0.78, marginBottom: 12, letterSpacing: 0.3 }}>now showing</div>
            {titleVal ? (
              <FieldTap field="title" onField={onField}>
                <div style={{ fontWeight: 300, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.04, letterSpacing: -1.5, marginBottom: 14, textShadow: '0 2px 14px rgba(0,0,0,0.55)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {titleVal}
                </div>
              </FieldTap>
            ) : gTitle ? (
              <FieldTap field="title" onField={onField}>
                <div style={{ marginBottom: 14 }}><FieldGhost text="TITLE" width="66%" height={78} size={2} surface="dark" /></div>
              </FieldTap>
            ) : null}
            {titleOgVal ? (
              <FieldTap field="titleOg" onField={onField}>
                <div style={{ fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {titleOgVal}
                </div>
              </FieldTap>
            ) : gTitleOg ? (
              <FieldTap field="titleOg" onField={onField}>
                <div><FieldGhost text="ORIGINAL TITLE" width={280} height={28} surface="dark" /></div>
              </FieldTap>
            ) : null}
            {actorsVal ? (
              <FieldTap field="actors" onField={onField}>
                <div style={{ marginTop: 16, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 26, opacity: 0.72, marginRight: 12 }}>with</span>
                  <span style={{ fontWeight: 500, fontSize: 28, fontFamily: FONT_KR, opacity: 0.9, letterSpacing: -0.2 }}>{actorsVal}</span>
                </div>
              </FieldTap>
            ) : gActors ? (
              <FieldTap field="actors" onField={onField}>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 26, opacity: 0.72 }}>with</span>
                  <FieldGhost text="CAST" width={240} height={32} surface="dark" />
                </div>
              </FieldTap>
            ) : null}
          </div>
        </div>
      </div>

      {/* 절취선(점선) + 양옆 반원 노치 */}
      <div style={{ position: 'absolute', left: 24, right: 24, top: POSTER_H, borderTop: `3px dashed ${PAPER_DEEP}`, opacity: 0.55 }} />
      <div style={{ position: 'absolute', left: -NOTCH_R, top: POSTER_H - NOTCH_R, width: NOTCH_R * 2, height: NOTCH_R * 2, borderRadius: '50%', background: NOTCH }} />
      <div style={{ position: 'absolute', right: -NOTCH_R, top: POSTER_H - NOTCH_R, width: NOTCH_R * 2, height: NOTCH_R * 2, borderRadius: '50%', background: NOTCH }} />

      {/* 하단 스텁 */}
      <div style={{ position: 'absolute', top: POSTER_H, left: 0, right: 0, bottom: 0, padding: '48px 48px 44px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', opacity: componentOpacity }}>
        {/* ADMIT ONE 워드마크 + 일련번호 */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, marginBottom: 30 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 40, color: accent }}>admit one</span>
          {(fv?.bookingNo ?? true) && (
            <FieldTap field="bookingNo" onField={onField}>
              <span style={{ fontWeight: 700, fontSize: 22, fontFamily: FONT_MONO, letterSpacing: 2, color: PAPER_DIM }}>No. {bookingNo}</span>
            </FieldTap>
          )}
        </div>

        {/* Boxed 그리드 — SEAT 대형 + DATE/TIME/SCREEN */}
        <div style={{ display: 'flex', border: `2px solid ${PAPER_DEEP}`, marginBottom: 30 }}>
          <FieldTap field="seat" onField={onField}>
            <div style={{ flex: '0 0 42%', padding: '26px 30px', borderRight: `2px solid ${PAPER_DEEP}`, minWidth: 0 }}>
              <div style={cellLabel}>Seat</div>
              {seatVal ? (
                <div style={{ ...cellValue, fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>{seatVal}</div>
              ) : ghostOn && fv?.seat !== false ? (
                <FieldGhost width={160} height={64} size={2} surface="paper" />
              ) : (
                <div style={{ ...cellValue, fontSize: 72, fontWeight: 800, color: PAPER_DIM, opacity: 0.4 }}>—</div>
              )}
            </div>
          </FieldTap>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <FieldTap field="watchDate" onField={onField}>
              <div style={{ padding: '18px 26px', borderBottom: `2px solid ${PAPER_DEEP}`, minWidth: 0 }}>
                <div style={cellLabel}>Date</div>
                <div style={cellValue}>{watchDateVal || '—'}</div>
              </div>
            </FieldTap>
            <FieldTap field="watchTime" onField={onField}>
              <div style={{ padding: '18px 26px', borderBottom: `2px solid ${PAPER_DEEP}`, minWidth: 0 }}>
                <div style={cellLabel}>Time</div>
                <div style={cellValue}>{watchTimeVal || '—'}</div>
              </div>
            </FieldTap>
            {/* 셀 전체를 감싸던 바깥 FieldTap 제거 — 조각별 FieldTap이 형제로 붙어 이중 중첩(stopPropagation 삼킴) 없음(#266 [중] 리스크). */}
            <div style={{ padding: '18px 26px', minWidth: 0 }}>
              <div style={cellLabel}>Screen</div>
              <div style={{ ...cellValue, fontSize: 26 }}>
                {theaterPiece || screenPiece ? (
                  <>
                    {theaterPiece}
                    {theaterVal && screenVal ? ' · ' : null}
                    {screenPiece}
                  </>
                ) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Runtime / Released 보조 라인 */}
        {(runtimeVal || releaseDateVal || reissueVal) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 44px', marginBottom: 26 }}>
            {runtimeVal && (
              <FieldTap field="runtime" onField={onField}>
                <div><span style={cellLabel}>Runtime </span><span style={{ fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, color: PAPER_DEEP }}>{runtimeVal}</span></div>
              </FieldTap>
            )}
            {(releaseDateVal || reissueVal) && (
              <FieldTap field="releaseDate" onField={onField}>
                <div><span style={cellLabel}>Released </span><span style={{ fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, color: PAPER_DEEP }}>{[releaseDateVal, reissueVal && `재개봉 ${reissueVal}`].filter(Boolean).join(' · ')}</span></div>
              </FieldTap>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* COLLECTED BY + 바코드 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: PAPER_DIM, marginBottom: 5 }}>COLLECTED BY</div>
                  <div style={{ fontWeight: 500, fontSize: 30, fontFamily: FONT_KR, color: PAPER_DEEP, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</div>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: PAPER_DIM, marginBottom: 5 }}>COLLECTED BY</div>
                  <FieldGhost text="SIGNATURE" width={200} height={32} surface="paper" />
                </div>
              </FieldTap>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.55 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: PAPER_DEEP }}>made with</span>
                <span style={{ fontWeight: 800, fontSize: 22, fontFamily: FONT_SANS, letterSpacing: 3, color: PAPER_DEEP }}>FILME</span>
              </div>
            )}
          </div>
          {(fv?.bookingNo ?? true) && (
            <FieldTap field="bookingNo" onField={onField}>
              <Barcode value={bookingNo} color={PAPER_DEEP} width={288} height={58} textSize={19} />
            </FieldTap>
          )}
        </div>
      </div>
    </div>
  );
}
