import { CSSProperties } from 'react';
import type { SheetTarget } from '@/constants/fields';
import {
  Barcode,
  ChainStamp,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  gate,
  isInkDark,
  pickTitleSize,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
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

export function MoodMinimal({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
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

  // 빈 항목 미리보기(#216) — 아톰 슬롯용 판정. 셀은 아래에서 개별 게이팅.
  const ghostOn = ghost === true;
  const gTitle     = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg   = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors    = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);

  // 메타 청킹(#리뷰): 관람(Screening/Venue/Seat) vs 영화(Runtime/Rated/Released)를 분리.
  // 값 폰트는 전부 Pretendard로 통일(숫자·날짜 포함) — 모노는 바코드/일련번호 같은 코드에만.
  // ghost 셀은 값이 비었고 기여 필드 중 하나라도 visible일 때만(ghostOn), value 없이 push한다.
  // 합쳐진 셀(Screening=관람일+시간, Venue=극장+상영관)은 대표 필드로 탭 매핑한다(#259) — 2차 필드
  // (watchTime/screen)는 FieldLauncher/시트에서 닿는다. field가 붙은 셀만 FieldTap으로 감싼다.
  const screeningCells: { label: string; value?: string; ghost?: boolean; field: SheetTarget }[] = [];
  const screening = [watchDateVal, watchTimeVal].filter(Boolean).join('  ');
  if (screening) screeningCells.push({ label: 'Screening', value: screening, field: 'watchDate' });
  else if (ghostOn && (fv?.watchDate !== false || fv?.watchTime !== false)) screeningCells.push({ label: 'Screening', ghost: true, field: 'watchDate' });
  const venue = [theaterVal, screenVal].filter(Boolean).join(' · ');
  if (venue) screeningCells.push({ label: 'Venue', value: venue, field: 'theater' });
  else if (ghostOn && (fv?.theater !== false || fv?.screen !== false)) screeningCells.push({ label: 'Venue', ghost: true, field: 'theater' });
  if (seatVal) screeningCells.push({ label: 'Seat', value: seatVal, field: 'seat' });
  else if (ghostOn && fv?.seat !== false) screeningCells.push({ label: 'Seat', ghost: true, field: 'seat' });

  // Re-released 셀은 releaseDate로 매핑 — 재개봉일 편집 UI가 releaseDate 시트(재개봉 토글) 안에만
  // 있고 reissue는 FIELD_SHEET_TYPE에 없어 단독 타깃이면 빈 시트가 열린다(35mm/Editorial과 정렬).
  const filmCells: { label: string; value?: string; ghost?: boolean; field: SheetTarget }[] = [];
  if (runtimeVal) filmCells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (ghostOn && fv?.runtime !== false) filmCells.push({ label: 'Runtime', ghost: true, field: 'runtime' });
  if (ratingVisible) filmCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)}`, field: 'rating' });
  else if (ghostOn && fv?.rating !== false) filmCells.push({ label: 'Rated', ghost: true, field: 'rating' });
  if (releaseDateVal) filmCells.push({ label: 'Released', value: releaseDateVal, field: 'releaseDate' });
  else if (ghostOn && fv?.releaseDate !== false) filmCells.push({ label: 'Released', ghost: true, field: 'releaseDate' });
  if (reissueVal) filmCells.push({ label: 'Re-released', value: reissueVal, field: 'releaseDate' });
  else if (ghostOn && d.isReissue && fv?.reissue !== false) filmCells.push({ label: 'Re-released', ghost: true, field: 'releaseDate' });

  // 스탬프가 실제로 뭔가(이미지/라벨/고스트 placeholder)를 렌더할 때만 상단 스크림+스탬프 블록을
  // 낸다. visible 토글만 보면 로고 미업로드+ghost=false에서 빈 스크림만 남는다(#216 리뷰 P1).
  // ghost=undefined면 stampWillRender가 visible!==false로 붕괴 → 원래 조건과 동일(데스크톱 무손상).
  const hasTopStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, color: ink, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 포스터를 뺀 모든 오버레이를 함께 페이드. 자식이 전부 position:absolute라
          inset:0 래퍼가 루트를 그대로 채워 opacity 1에서 좌표·페인트 순서가 동일(no-op). */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      <RegistrationMarks color={ink} />

      {/* Top — chain + format paired (같은 위상이라 인접 배치) */}
      {hasTopStamp && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 180, background: topScrim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', gap: 22 }}>
            <FieldTap field="chain" onField={onField}>
              <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={54} surface={stampSurface} ghost={ghost} />
            </FieldTap>
            {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 38, background: ink, opacity: 0.5 }} />}
            <FieldTap field="format" onField={onField}>
              <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.9} surface={stampSurface} ghost={ghost} />
            </FieldTap>
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

        {titleVal ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ fontWeight: titleLen > 12 ? 400 : 300, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.06, letterSpacing: -1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {titleVal}
            </div>
          </FieldTap>
        ) : gTitle ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ marginBottom: 16 }}>
              <FieldGhost text="TITLE" width="66%" height={84} size={2} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}
        {titleOgVal ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.66, marginBottom: 28, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleOgVal}
            </div>
          </FieldTap>
        ) : gTitleOg ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ marginBottom: 28 }}>
              <FieldGhost text="ORIGINAL TITLE" width={280} height={30} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}

        <div style={{ height: 1, background: ink, opacity: 0.38, marginBottom: 26 }} />

        {/* Meta — 관람/영화 청킹, 두 행 사이 헤어라인. 값은 Pretendard로 통일 */}
        {(screeningCells.length > 0 || filmCells.length > 0) && (
          <div style={{ marginBottom: 28 }}>
            {screeningCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 56px' }}>
                {screeningCells.map((c, i) => (
                  <FieldTap key={i} field={c.field} onField={onField}>
                    <div style={{ minWidth: 0 }}>
                      <div style={labelSerif(ink)}>{c.label}</div>
                      {c.ghost ? (
                        <FieldGhost width={200} height={46} surface={stampSurface} />
                      ) : (
                        <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                      )}
                    </div>
                  </FieldTap>
                ))}
              </div>
            )}
            {screeningCells.length > 0 && filmCells.length > 0 && (
              <div style={{ height: 1, background: ink, opacity: 0.18, margin: '22px 0' }} />
            )}
            {filmCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 56px' }}>
                {filmCells.map((c, i) => (
                  <FieldTap key={i} field={c.field} onField={onField}>
                    <div style={{ minWidth: 0 }}>
                      <div style={labelSerif(ink)}>{c.label}</div>
                      {c.ghost ? (
                        <FieldGhost width={200} height={46} surface={stampSurface} />
                      ) : (
                        <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                      )}
                    </div>
                  </FieldTap>
                ))}
              </div>
            )}
          </div>
        )}

        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 30, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 30, opacity: 0.7, marginRight: 14 }}>with</span>
              <span style={{ fontWeight: 500, fontSize: 32, fontFamily: FONT_KR, opacity: 0.86, letterSpacing: -0.2 }}>{actorsVal}</span>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 30, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 30, opacity: 0.7 }}>with</span>
              <FieldGhost text="CAST" width={260} height={36} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}

        {/* Footer — FILME 락업(컨텍스트) / 바코드 + 서명(라벨) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.55, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 20, color: ink }}>made with</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_SANS, letterSpacing: 3, color: ink }}>FILME</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14, minWidth: 0 }}>
            {(fv?.bookingNo ?? true) && (
              <FieldTap field="bookingNo" onField={onField}>
                <Barcode value={bookingNo} color={ink} width={268} height={54} textSize={19} />
              </FieldTap>
            )}
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ textAlign: 'right', maxWidth: 440, minWidth: 0 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 23, opacity: 0.6, color: ink, marginRight: 10 }}>collected by</span>
                  <span style={{ fontWeight: 500, fontSize: 30, fontFamily: FONT_KR, color: ink, letterSpacing: -0.2 }}>{signatureVal}</span>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 23, opacity: 0.6, color: ink }}>collected by</span>
                  <FieldGhost text="SIGNATURE" width={200} height={34} surface={stampSurface} />
                </div>
              </FieldTap>
            ) : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
