import { Fragment } from 'react';
import {
  Barcode,
  ChainStamp,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
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
 * v4 — 컬렉션 임프린트. 좌측 스파인 + 중앙 카탈로그 제목 블록.
 * 리뷰 반영: 가짜 넘버링(No.0315) 전면 제거(앱에 넘버링 기능 없음), 어색한 "THE FILME COLLECTION"
 * 대신 스파인을 원제(titleOg)·연도의 진짜 DVD 스파인처럼 구성, 중앙 eyebrow는 "from a film diary"로
 * 교체, 서명에 'collected by' 라벨, FILME에 phototicket 컨텍스트. 데이터=Pretendard, 장식=Instrument Serif.
 */
export function MoodCriterion({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const inkIsDark = isInkDark(themeColor);
  const ink = resolveInk(themeColor, inkIsDark ? '#0d0c0a' : '#FFFFFF');
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [132, 112, 92, 76]);

  const globalScrim = inkIsDark
    ? 'linear-gradient(180deg, rgba(245,240,232,0.7) 0%, rgba(245,240,232,0.34) 30%, rgba(245,240,232,0.5) 60%, rgba(245,240,232,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.46) 60%, rgba(0,0,0,0.93) 100%)';
  const spineBg = inkIsDark ? 'rgba(245,240,232,0.95)' : 'rgba(0,0,0,0.74)';
  const spineDivider = inkIsDark ? '#0d0c0a' : ink;
  const stampSurface = inkIsDark ? 'paper' : 'dark';

  const { bookingNo, watchDateClean, releaseClean, reissueClean, watchYear } = resolveTicketData(d);

  const titleVal       = gate(fv?.title, d.title);
  const titleOgVal     = gate(fv?.titleOg, d.titleOg);
  const actorsVal      = truncateActors(gate(fv?.actors, d.actors));
  const watchDateVal   = gate(fv?.watchDate, watchDateClean);
  const theaterVal     = gate(fv?.theater, d.theater);
  const screenVal      = gate(fv?.screen, d.screen);
  const seatVal        = gate(fv?.seat, d.seat);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal     = gate(fv?.reissue, reissueClean);
  const signatureVal   = gate(fv?.signature, d.signature);
  const ratingVisible  = (fv?.rating ?? true) && d.rating > 0;

  // 스파인 임프린트 — 넘버링 없이 원제(없으면 제목)로 진짜 카탈로그 스파인처럼.
  const spineText = titleOgVal || titleVal;

  // mono 캡스 메타 — 존재하는 행만.
  const venueLine = [theaterVal, screenVal, seatVal].filter(Boolean).join('  ·  ');
  const screeningRows = [
    { label: 'VENUE', value: venueLine },
    { label: 'WATCHED', value: watchDateVal },
  ].filter(r => r.value);
  const filmRows = [
    { label: 'RATED', value: ratingVisible ? `★ ${d.rating.toFixed(1)} / 5.0` : '' },
    { label: 'RELEASED', value: releaseDateVal },
    { label: 'RE-REL.', value: reissueVal },
  ].filter(r => r.value);

  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, color: ink, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 포스터를 뺀 오버레이 전체를 함께 페이드. 자식이 전부 position:absolute라
          inset:0 래퍼가 루트를 채워 opacity 1에서 좌표·페인트 순서 동일(no-op). */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      <div style={{ position: 'absolute', inset: 0, background: globalScrim, pointerEvents: 'none' }} />

      {/* Spine band — DVD 스파인 임프린트(원제 + 연도), 넘버링 제거 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 96, background: spineBg, borderRight: `1px solid ${spineDivider}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 0', color: ink }}>
        {spineText && (
          // 원제(라틴)면 디스플레이 세리프, 원제 없어 한글 제목이 올라오면 FONT_KR로 — FONT_DISPLAY는
          // 한글 글리프가 없어 시스템 세리프로 어긋난다(_shared FONT_DISPLAY 경고, #205 리뷰 P1).
          <div style={{ fontFamily: titleOgVal ? FONT_DISPLAY : FONT_KR, fontStyle: 'italic', fontWeight: 400, fontSize: 34, letterSpacing: 0.5, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', maxHeight: 560, overflow: 'hidden' }}>
            {spineText}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {(fv?.bookingNo ?? true) && <Barcode value={bookingNo} color={ink} orientation="vertical" width={46} height={430} showText={false} />}
        <div style={{ flex: 1 }} />
        {(fv?.watchDate ?? true) && watchYear && (
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 66, letterSpacing: 1, writingMode: 'vertical-rl', lineHeight: 1 }}>
            {watchYear}
          </div>
        )}
      </div>

      {/* Top-right paired stamps */}
      <div style={{ position: 'absolute', right: 44, top: 40, display: 'flex', alignItems: 'center', gap: 16 }}>
        <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface={stampSurface} />
        {components.chainVisible && components.formatVisible && <span style={{ width: 1, height: 30, background: ink, opacity: 0.55 }} />}
        <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.9} surface={stampSurface} />
      </div>

      {/* Title block — catalog double-rule frame */}
      <div style={{ position: 'absolute', left: 144, right: 56, top: '42%', transform: 'translateY(-42%)' }}>
        <div style={{ height: 1, background: ink, opacity: 0.6, marginBottom: 4 }} />
        <div style={{ height: 3, background: ink, opacity: 0.6, marginBottom: 22 }} />

        <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 32, opacity: 0.8, marginBottom: 18, letterSpacing: 0.3 }}>
          from a film diary
        </div>

        {titleVal && (
          <div style={{ fontWeight: 800, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.05, letterSpacing: titleLen > 8 ? -1.5 : 1, marginBottom: 18, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {titleVal}
          </div>
        )}
        {titleOgVal && (
          <div style={{ fontWeight: 500, fontSize: 28, fontFamily: FONT_SANS, letterSpacing: 1, opacity: 0.7, marginBottom: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titleOgVal}
          </div>
        )}
        {actorsVal && (
          <div style={{ marginBottom: 22, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 28, opacity: 0.75, marginRight: 12 }}>featuring</span>
            <span style={{ fontWeight: 500, fontSize: 30, fontFamily: FONT_KR, opacity: 0.85 }}>{actorsVal}</span>
          </div>
        )}

        <div style={{ height: 3, background: ink, opacity: 0.6, marginBottom: 4 }} />
        <div style={{ height: 1, background: ink, opacity: 0.6 }} />
      </div>

      {/* Bottom caps block — 관람/영화 청킹, 값은 Pretendard로 통일 */}
      <div style={{ position: 'absolute', left: 144, right: 56, bottom: 52 }}>
        {screeningRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 26, rowGap: 11, alignItems: 'baseline' }}>
            {screeningRows.map((r, i) => (
              <Fragment key={i}>
                <div style={{ fontWeight: 700, fontSize: 19, fontFamily: FONT_MONO, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.55 }}>{r.label}</div>
                <div style={{ fontWeight: 700, fontSize: 28, fontFamily: FONT_SANS, letterSpacing: -0.2, opacity: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</div>
              </Fragment>
            ))}
          </div>
        )}
        {screeningRows.length > 0 && filmRows.length > 0 && (
          <div style={{ height: 1, background: ink, opacity: 0.2, margin: '16px 0' }} />
        )}
        {filmRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 26, rowGap: 11, alignItems: 'baseline' }}>
            {filmRows.map((r, i) => (
              <Fragment key={i}>
                <div style={{ fontWeight: 700, fontSize: 19, fontFamily: FONT_MONO, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.55 }}>{r.label}</div>
                <div style={{ fontWeight: 700, fontSize: 28, fontFamily: FONT_SANS, letterSpacing: -0.2, opacity: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</div>
              </Fragment>
            ))}
          </div>
        )}
        {/* 서명(라벨) + 작은 워터마크(made with FILME) */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.55 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 20, color: ink }}>made with</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_SANS, letterSpacing: 3, color: ink }}>FILME</span>
          </div>
          {signatureVal && (
            <div style={{ textAlign: 'right', maxWidth: 560, minWidth: 0 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 23, opacity: 0.6, color: ink, marginRight: 10 }}>collected by</span>
              <span style={{ fontWeight: 500, fontStyle: 'italic', fontSize: 30, fontFamily: FONT_KR, color: ink, letterSpacing: -0.2 }}>{signatureVal}</span>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
