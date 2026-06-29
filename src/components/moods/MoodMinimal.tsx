import { CSSProperties } from 'react';
import {
  Barcode,
  ChainStamp,
  FONT_DISPLAY,
  FONT_KR,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  gate,
  isInkDark,
  pickTitleSize,
  resolveInk,
  resolveTicketData,
  truncateActors,
} from './_shared';

/**
 * v4 — 모던 갤러리 아트카드. 포스터 풀블리드 + 하단 스크림.
 * 리뷰 반영: 상단 중복 날짜 제거(메타 Screening으로 일원화), 포맷(DOLBY)을 극장체인 옆 상단으로
 * 통일, RELEASED를 다른 메타와 동급 셀로 승격, FILME에 'phototicket' 컨텍스트, 서명에 'collected by'
 * 라벨, 바코드 확대. 데이터=Pretendard, 장식 라벨=Instrument Serif, 코드=Mono.
 */
const labelSerif = (color: string): CSSProperties => ({
  fontFamily: FONT_DISPLAY,
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 30,
  lineHeight: 1,
  letterSpacing: 0.3,
  color,
  opacity: 0.72,
  marginBottom: 6,
});

const metaValue: CSSProperties = {
  fontWeight: 600,
  fontSize: 40,
  fontFamily: FONT_SANS,
  letterSpacing: -0.4,
  lineHeight: 1.12,
};

/** 아트프린트 코너 레지스트레이션 마크(과하지 않은 엣지) — 4모서리 L자 틱. */
function RegistrationMarks({ color }: { color: string }) {
  const L = 22;
  const W = 2;
  const inset = 24;
  const base: CSSProperties = { position: 'absolute', width: L, height: L, opacity: 0.45, pointerEvents: 'none' };
  return (
    <>
      <div style={{ ...base, top: inset, left: inset, borderTop: `${W}px solid ${color}`, borderLeft: `${W}px solid ${color}` }} />
      <div style={{ ...base, top: inset, right: inset, borderTop: `${W}px solid ${color}`, borderRight: `${W}px solid ${color}` }} />
      <div style={{ ...base, bottom: inset, left: inset, borderBottom: `${W}px solid ${color}`, borderLeft: `${W}px solid ${color}` }} />
      <div style={{ ...base, bottom: inset, right: inset, borderBottom: `${W}px solid ${color}`, borderRight: `${W}px solid ${color}` }} />
    </>
  );
}

export function MoodMinimal({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const inkIsDark = isInkDark(themeColor);
  const ink = resolveInk(themeColor, inkIsDark ? '#0d0c0a' : '#FFFFFF');
  // 밝은 테마(inkIsDark)에선 topScrim이 크림이라 stamp surface도 paper로 — 'dark' 고정이면
  // DashedPlaceholder가 흰색 테두리·텍스트라 크림 위에서 안 보인다(Criterion 패턴 정렬, #205 리뷰 P1).
  const stampSurface = inkIsDark ? 'paper' : 'dark';
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [136, 112, 92, 76]);

  const scrimGrad = inkIsDark
    ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,240,232,0.82) 36%, rgba(245,240,232,0.97) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 36%, rgba(0,0,0,0.93) 100%)';
  const topScrim = inkIsDark
    ? 'linear-gradient(180deg, rgba(245,240,232,0.9) 0%, rgba(245,240,232,0) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0) 100%)';

  const { bookingNo, watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal       = gate(fv?.title, d.title);
  const titleOgVal     = gate(fv?.titleOg, d.titleOg);
  const actorsVal      = truncateActors(gate(fv?.actors, d.actors));
  const watchDateVal   = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal   = gate(fv?.watchTime, d.watchTime);
  const theaterVal     = gate(fv?.theater, d.theater);
  const screenVal      = gate(fv?.screen, d.screen);
  const seatVal        = gate(fv?.seat, d.seat);
  const runtimeVal     = gate(fv?.runtime, d.runtime);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal     = gate(fv?.reissue, reissueClean);
  const signatureVal   = gate(fv?.signature, d.signature);
  const ratingVisible  = (fv?.rating ?? true) && d.rating > 0;

  // 메타 청킹(#리뷰): 관람(Screening/Venue/Seat) vs 영화(Runtime/Rated/Released)를 분리.
  // 값 폰트는 전부 Pretendard로 통일(숫자·날짜 포함) — 모노는 바코드/일련번호 같은 코드에만.
  const screeningCells: { label: string; value: string }[] = [];
  const screening = [watchDateVal, watchTimeVal].filter(Boolean).join('  ');
  if (screening) screeningCells.push({ label: 'Screening', value: screening });
  const venue = [theaterVal, screenVal].filter(Boolean).join(' · ');
  if (venue) screeningCells.push({ label: 'Venue', value: venue });
  if (seatVal) screeningCells.push({ label: 'Seat', value: seatVal });

  const filmCells: { label: string; value: string }[] = [];
  if (runtimeVal) filmCells.push({ label: 'Runtime', value: runtimeVal });
  if (ratingVisible) filmCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)}` });
  if (releaseDateVal) filmCells.push({ label: 'Released', value: releaseDateVal });
  if (reissueVal) filmCells.push({ label: 'Re-released', value: reissueVal });

  const hasTopStamp = components.chainVisible || components.formatVisible;

  return (
    <div style={{ position: 'absolute', inset: 0, color: ink, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />

      <RegistrationMarks color={ink} />

      {/* Top — chain + format paired (같은 위상이라 인접 배치) */}
      {hasTopStamp && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 180, background: topScrim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', gap: 22 }}>
            <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={54} surface={stampSurface} />
            {components.chainVisible && components.formatVisible && <span style={{ width: 1, height: 38, background: ink, opacity: 0.5 }} />}
            <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.9} surface={stampSurface} />
          </div>
        </>
      )}

      {/* Bottom scrim */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 770, background: scrimGrad, pointerEvents: 'none' }} />

      {/* Bottom block */}
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 52 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 34, opacity: 0.7, marginBottom: 12, letterSpacing: 0.3 }}>
          now showing
        </div>

        {titleVal && (
          <div style={{ fontWeight: titleLen > 12 ? 400 : 300, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.06, letterSpacing: -1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {titleVal}
          </div>
        )}
        {titleOgVal && (
          <div style={{ fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.66, marginBottom: 28, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleOgVal}
          </div>
        )}

        <div style={{ height: 1, background: ink, opacity: 0.38, marginBottom: 26 }} />

        {/* Meta — 관람/영화 청킹, 두 행 사이 헤어라인. 값은 Pretendard로 통일 */}
        {(screeningCells.length > 0 || filmCells.length > 0) && (
          <div style={{ marginBottom: 28 }}>
            {screeningCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 56px' }}>
                {screeningCells.map((c, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <div style={labelSerif(ink)}>{c.label}</div>
                    <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
            {screeningCells.length > 0 && filmCells.length > 0 && (
              <div style={{ height: 1, background: ink, opacity: 0.18, margin: '22px 0' }} />
            )}
            {filmCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 56px' }}>
                {filmCells.map((c, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <div style={labelSerif(ink)}>{c.label}</div>
                    <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {actorsVal && (
          <div style={{ marginBottom: 30, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 30, opacity: 0.7, marginRight: 14 }}>with</span>
            <span style={{ fontWeight: 500, fontSize: 32, fontFamily: FONT_KR, opacity: 0.86, letterSpacing: -0.2 }}>{actorsVal}</span>
          </div>
        )}

        {/* Footer — FILME 락업(컨텍스트) / 바코드 + 서명(라벨) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.55, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 20, color: ink }}>made with</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_SANS, letterSpacing: 3, color: ink }}>FILME</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, minWidth: 0 }}>
            {(fv?.bookingNo ?? true) && <Barcode value={bookingNo} color={ink} width={268} height={54} textSize={19} />}
            {signatureVal && (
              <div style={{ textAlign: 'right', maxWidth: 440, minWidth: 0 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 23, opacity: 0.6, color: ink, marginRight: 10 }}>collected by</span>
                <span style={{ fontWeight: 500, fontSize: 30, fontFamily: FONT_KR, color: ink, letterSpacing: -0.2 }}>{signatureVal}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
