import { CSSProperties } from 'react';
import {
  Barcode,
  ChainStamp,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  PerforationStrip,
  Poster,
  gate,
  pickTitleSize,
  resolveInk,
  resolveTicketData,
  truncateActors,
} from './_shared';

/**
 * v7 — 영화제 공식 티켓. 좌 포스터 | 중앙 정보 | 우 절취 스텁(노치/천공).
 * 리뷰 반영: 영화 메타(제목·캐스트·러닝·개봉)와 관람 메타(상영관·세앙스·좌석)를 헤어라인으로 청킹,
 * 메타 '값'은 전부 Pretendard로 통일(모노는 스텁 일련번호에만), 헤더(le billet·평점)·꼬릿말·Sortie·
 * Séance 시간 폰트 확대. 스텁은 세로형 tear-off: 영화관(먼저)·포맷·바코드·티켓번호로 공간을 채움.
 */
const PAPER = '#f4ede0';
const PAPER_DEEP = '#1a1612';
const PAPER_DIM = '#8a7e63';

const POSTER_W = 452;
const PERF_W = 14;
const MAIN_W = 813;
const STUB_W = 212;

export function MoodEditorial({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : resolveInk(themeColor, '#a8312a');
  const titleSize = pickTitleSize(d.title.length, [116, 100, 82, 66]);
  const { bookingNo, watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const seatVal = gate(fv?.seat, d.seat);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal = gate(fv?.reissue, reissueClean);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors));
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  const italicLabel = (color: string, size: number): CSSProperties => ({
    fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: size, color, letterSpacing: 0.3,
  });

  // 관람(screening) 메타 셀 — 값은 Pretendard로 통일.
  const cells: { label: string; value: string; sub?: string }[] = [];
  const theaterValue = theaterVal || screenVal;
  if (theaterValue) cells.push({ label: theaterVal ? 'Théâtre' : 'Salle', value: theaterValue, sub: theaterVal ? screenVal : '' });
  const sessionValue = watchDateVal || watchTimeVal;
  if (sessionValue) cells.push({ label: watchDateVal ? 'Séance' : 'Heure', value: sessionValue, sub: watchDateVal ? watchTimeVal : '' });
  if (seatVal) cells.push({ label: 'Place', value: seatVal });

  const releaseLine = [
    releaseDateVal && `Sortie ${releaseDateVal}`,
    reissueVal && `Reprise ${reissueVal}`,
  ].filter(Boolean).join('      ·      ');

  const filmSummary = runtimeVal;
  const stubHasStamp = components.chainVisible || components.formatVisible;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: PAPER_DEEP, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex' }}>
      {/* A: Poster */}
      <div style={{ flex: `0 0 ${POSTER_W}px`, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>
        <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER} background="transparent" />
        </div>
      </div>

      {/* B: Main */}
      <div style={{ flex: `0 0 ${MAIN_W}px`, position: 'relative', background: PAPER, color: PAPER_DEEP, display: 'flex', flexDirection: 'column', padding: '36px 48px 34px', boxSizing: 'border-box' }}>
        {/* Header — le billet + 영화 요약(러닝·평점) (크기 확대) */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 18, paddingBottom: 18 }}>
          <div style={{ ...italicLabel(accent, 36) }}>le billet</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            {filmSummary && <span style={{ fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, color: PAPER_DIM, letterSpacing: -0.2 }}>{filmSummary}</span>}
            {ratingVisible && <span style={{ fontWeight: 800, fontSize: 34, fontFamily: FONT_SANS, letterSpacing: 0.5, color: accent }}>★ {d.rating.toFixed(1)}</span>}
          </div>
        </div>

        <div style={{ height: 2, background: PAPER_DEEP, marginBottom: 6 }} />
        <div style={{ height: 1, background: PAPER_DEEP, opacity: 0.5 }} />

        {/* Film chunk — title, original title, cast, release */}
        <div style={{ marginTop: 24 }}>
          {titleVal && (
            <div style={{ fontWeight: 900, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.0, letterSpacing: -1.5, paddingBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {titleVal}
            </div>
          )}
          {titleOgVal && (
            <div style={{ marginTop: 12, ...italicLabel(PAPER_DEEP, 30), opacity: 0.62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleOgVal}
            </div>
          )}
        </div>

        {actorsVal && (
          <div style={{ marginTop: 20 }}>
            <span style={{ ...italicLabel(accent, 26), marginRight: 12 }}>avec</span>
            <span style={{ fontWeight: 500, fontSize: 34, fontFamily: FONT_KR, letterSpacing: -0.2, lineHeight: 1.25 }}>{actorsVal}</span>
          </div>
        )}

        {releaseLine && (
          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, color: PAPER_DIM }}>
            {releaseLine}
          </div>
        )}

        {/* Chunk divider — film ↕ screening */}
        <div style={{ height: 1, background: PAPER_DEEP, opacity: 0.22, margin: '26px 0' }} />

        {/* Screening chunk — Théâtre / Séance / Place (값 Pretendard) */}
        {cells.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px 52px' }}>
            {cells.map((c, i) => (
              <div key={i} style={{ minWidth: 0, flex: '0 1 auto' }}>
                <div style={{ ...italicLabel(PAPER_DIM, 28), marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontWeight: 800, fontSize: 42, fontFamily: FONT_SANS, letterSpacing: -0.5, lineHeight: 1.05, color: PAPER_DEEP, maxWidth: 440, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.value}
                </div>
                {c.sub && (
                  <div style={{ marginTop: 6, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, color: PAPER_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Footer (꼬릿말, 크기 확대) — made with FILME / 서명. 티켓번호는 스텁에만. */}
        <div style={{ paddingTop: 20, borderTop: `1px solid ${PAPER_DEEP}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: 0.6 }}>
            <span style={{ ...italicLabel(PAPER_DIM, 24) }}>made with</span>
            <span style={{ fontWeight: 800, fontSize: 24, fontFamily: FONT_SANS, letterSpacing: 3, color: PAPER_DEEP }}>FILME</span>
          </div>
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            {signatureVal && (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12, marginBottom: 5 }}>
                <span style={{ ...italicLabel(accent, 28), flexShrink: 0 }}>par</span>
                <span style={{ fontWeight: 500, fontSize: 34, fontFamily: FONT_KR, color: PAPER_DEEP, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                  {signatureVal}
                </span>
              </div>
            )}
            <div style={{ ...italicLabel(PAPER_DIM, 26) }}>non-transférable</div>
          </div>
        </div>

        {/* Notch (#000 matches captureToImage backgroundColor) */}
        <div style={{ position: 'absolute', right: -28, top: 960 / 2 - 28, width: 56, height: 56, borderRadius: '50%', background: '#000000', zIndex: 10 }} />
      </div>

      {/* C: Stub — 세로형 tear-off. 가로 행 하나를 -90° 회전 → admis·영화관(먼저)·포맷·바코드·티켓번호가
          strip 방향으로 선다. 컴포넌트 크기를 맞추고 바코드를 길게 빼 공간을 채운다. */}
      <div style={{ flex: `0 0 ${STUB_W}px`, position: 'relative', background: PAPER, borderLeft: `1px solid ${PAPER_DEEP}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER_DEEP} background="transparent" />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* DOM 좌→우 = 회전 후 아래→위. 맨 오른쪽(admis)이 위, 맨 왼쪽(티켓번호)이 아래.
              영화관(체인)이 포맷보다 위(=먼저)에 오도록 그룹 내 순서는 format→chain. */}
          <div style={{ transform: 'rotate(-90deg)', display: 'flex', alignItems: 'center', gap: 34, whiteSpace: 'nowrap' }}>
            {(fv?.bookingNo ?? true) && (
              <span style={{ fontWeight: 700, fontSize: 22, fontFamily: FONT_MONO, letterSpacing: 2, color: PAPER_DEEP }}>No. {bookingNo}</span>
            )}
            {(fv?.bookingNo ?? true) && (
              <Barcode value={bookingNo} color={PAPER_DEEP} orientation="horizontal" width={336} height={58} showText={false} />
            )}
            {stubHasStamp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.75} />
                {components.chainVisible && components.formatVisible && <span style={{ width: 1, height: 34, background: PAPER_DEEP, opacity: 0.3 }} />}
                <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={48} />
              </div>
            )}
            <span style={{ ...italicLabel(accent, 40) }}>admis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
