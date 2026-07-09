import { CSSProperties, ReactNode, memo } from 'react';
import type { SheetTarget } from '@/constants/fields';
import {
  ChainStamp,
  FieldGhost,
  FieldTap,
  FilmStripBand,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  fieldPieces,
  gate,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
} from './_shared';

/**
 * v5 — 마스터 시안 Ticket Design Master.dc.html v2(2026-07-08 resync) 재동기화(에픽 #281).
 * 마스터 델타: 상/하단 스프로킷을 92px 풀 필름 스트립(프레임번호·KEYKODE·엣지 스크롤·그레인, FilmStripBand)으로
 * 승격, 상단 시리얼 스트립("35MM · SINGLE FRAME") 제거, 원형 평점 스탬프 제거 → 평점을 Rated 필드 셀로 이동,
 * 타이틀 리스케일(43/800), amber 악센트 시스템(themeColor 파생)으로 더블룰·닷 디바이더, Released/Re-released
 * 셀 분리, 푸터 바코드 제거(bookingNo 미렌더 → MOOD_EXCLUDED_FIELDS). MADE WITH FILME + 서명 푸터는 유지.
 */
const FS_BASE = '#0a0a0a';
const FS_INK = '#f4ede0';
const FS_DIM = 'rgba(244,237,224,0.6)';
const FS_LABEL = 'rgba(244,237,224,0.72)';
const FS_DIVIDER = 'rgba(244,237,224,0.28)';

const cellLabel: CSSProperties = {
  color: FS_LABEL,
  fontWeight: 700,
  fontSize: 16,
  fontFamily: FONT_MONO,
  letterSpacing: 2.3,
  textTransform: 'uppercase',
  marginBottom: 7,
};

// 병합 셀(node)이면 분해 조각을, 아니면 단일 값/ghost를 렌더하는 공통 메타 셀 형태(#266 PR-C).
type MetaCell = { label: string; field: SheetTarget; value?: string; cast?: boolean; full?: boolean; ghost?: boolean; node?: ReactNode; hasGhost?: boolean };

export const Mood35mm = memo(function Mood35mm({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const amber = themeColor.toLowerCase() === '#ffffff' ? '#C2802F' : resolveInk(themeColor, '#C2802F');

  const captionScrim =
    'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.58) 24%, rgba(10,10,10,0.95) 70%)';

  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

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

  // 빈 항목 미리보기(#216) — 아톰 슬롯 판정. 셀은 아래에서 개별 게이팅.
  const ghostOn = ghost === true;
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);

  // 청킹: 관람(Exhibited/Screened) vs 영화(Runtime/Rated/Released/Re-released/Starring). 값은 Pretendard로 통일.
  // 병합 셀(Exhibited=극장+상영관+좌석, Screened=관람일+시간)은 fieldPieces로 필드별 독립 조각으로 분해(#266 PR-C).
  const screeningCells: MetaCell[] = [];
  const exhibited = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
      { field: 'seat', value: seatVal, ghost: gSeat, label: 'SEAT' },
    ],
    onField,
    { surface: 'dark' }
  );
  if (exhibited.hasAny) screeningCells.push({ label: 'Exhibited', node: exhibited.node, hasGhost: exhibited.hasGhost, field: 'theater' });
  const screened = fieldPieces(
    [
      { field: 'watchDate', value: watchDateVal, ghost: gWatchDate, label: 'DATE' },
      { field: 'watchTime', value: watchTimeVal, ghost: gWatchTime, label: 'TIME' },
    ],
    onField,
    { surface: 'dark' }
  );
  if (screened.hasAny) screeningCells.push({ label: 'Screened', node: screened.node, hasGhost: screened.hasGhost, field: 'watchDate' });

  // 마스터 필름 셀 순서: Runtime · Rated · Released · Re-released · Starring. 평점은 원형 스탬프에서 셀로 이동.
  const filmCells: MetaCell[] = [];
  if (runtimeVal) filmCells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (ghostOn && fv?.runtime !== false) filmCells.push({ label: 'Runtime', ghost: true, field: 'runtime' });
  if (ratingVisible) filmCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)} / 5.0`, field: 'rating' });
  else if (ghostOn && fv?.rating !== false) filmCells.push({ label: 'Rated', ghost: true, field: 'rating' });
  if (releaseDateVal) filmCells.push({ label: 'Released', value: releaseDateVal, field: 'releaseDate' });
  else if (ghostOn && fv?.releaseDate !== false) filmCells.push({ label: 'Released', ghost: true, field: 'releaseDate' });
  // Re-released는 표시만 별도 셀, 편집 자리는 releaseDate 시트(reissue는 그 안에서) — 탭 타깃을 releaseDate로 둔다(빈 시트 dead-end 방지, onTicketFieldTap 회귀).
  if (reissueVal) filmCells.push({ label: 'Re-released', value: reissueVal, field: 'releaseDate' });
  else if (ghostOn && !!d.isReissue && fv?.reissue !== false) filmCells.push({ label: 'Re-released', ghost: true, field: 'releaseDate' });
  if (actorsVal) filmCells.push({ label: 'Starring', value: actorsVal, cast: true, full: true, field: 'actors' });
  else if (ghostOn && fv?.actors !== false) filmCells.push({ label: 'Starring', full: true, ghost: true, field: 'actors' });

  // 필름 스트립 엣지 스크롤 코드(장식 크롬 — 편집 불가). 서명의 편집 자리는 아래 푸터, 여긴 시안 페이싱용 복제.
  const edgeCodes = [
    titleVal,
    'SAFETY FILM',
    'MADE WITH FILME · 35MM',
    releaseDateVal && `PT · ${releaseDateVal}`,
    ratingVisible && `★ ${d.rating.toFixed(1)}`,
    signatureVal && `COLLECTED BY ${signatureVal}`,
  ].filter(Boolean) as string[];

  const componentOpacity = components.componentOpacity ?? 1;

  const doubleRuleTop = (
    <div style={{ marginBottom: 4 }}>
      <div style={{ height: 2, background: amber, opacity: 0.55, marginBottom: 3 }} />
      <div style={{ height: 1, background: amber, opacity: 0.3 }} />
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, color: FS_INK, background: FS_BASE, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      <Poster src={croppedImageUrl} fit="contain" background={FS_BASE} texture={components.texture} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 필름 스트립·스탬프·캡션 등 크롬 전체를 함께 페이드. */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      {/* Top film-strip band (마스터 92px 풀 스트립) */}
      <FilmStripBand pos="top" accent={amber} codes={edgeCodes} base={FS_BASE} />

      {/* Chain + format paired, top-left (마스터 left:50 top:130) */}
      {(components.chainVisible || components.formatVisible) && (
        <div style={{ position: 'absolute', left: 50, top: 130, display: 'flex', alignItems: 'center', gap: 32 }}>
          <FieldTap field="chain" onField={onField}>
            <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface="dark" ghost={ghost} />
          </FieldTap>
          {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 40, background: FS_INK, opacity: 0.5 }} />}
          <FieldTap field="format" onField={onField}>
            <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.85} surface="dark" ghost={ghost} />
          </FieldTap>
        </div>
      )}

      {/* Caption above bottom film-strip band (마스터 bottom:92 · paddingTop:66) */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 92, paddingTop: 66, background: captionScrim }}>
        <div style={{ margin: '0 22px', padding: '15px 38px 16px', borderTop: `1px solid ${FS_DIVIDER}` }}>
          {titleOgVal ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ fontWeight: 700, fontSize: 18, fontFamily: FONT_MONO, letterSpacing: 2.3, textTransform: 'uppercase', color: FS_INK, opacity: 0.78, marginBottom: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {titleOgVal}
              </div>
            </FieldTap>
          ) : gTitleOg ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ marginBottom: 9 }}>
                <FieldGhost text="ORIGINAL TITLE" width={280} height={24} surface="dark" />
              </div>
            </FieldTap>
          ) : null}
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontWeight: 800, fontSize: 43, fontFamily: FONT_KR, lineHeight: 1.08, letterSpacing: -0.4, marginBottom: 15, color: FS_INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {titleVal}
              </div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ marginBottom: 15 }}>
                <FieldGhost text="TITLE" width="60%" height={48} size={2} surface="dark" />
              </div>
            </FieldTap>
          ) : null}

          {(screeningCells.length > 0 || filmCells.length > 0) && (
            <>
              {doubleRuleTop}
              <div style={{ marginBottom: 13, paddingTop: 13 }}>
                {screeningCells.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 40px' }}>
                    {screeningCells.map((c, i) => c.node !== undefined ? (
                      <div key={i} style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                        <div style={cellLabel}>{c.label}</div>
                        <div style={{ color: FS_INK, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(c.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{c.node}</div>
                      </div>
                    ) : (
                      <FieldTap key={i} field={c.field} onField={onField}>
                        <div style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                          <div style={cellLabel}>{c.label}</div>
                          {c.ghost ? (
                            <FieldGhost width={220} height={34} surface="dark" />
                          ) : (
                            <div style={{ color: FS_INK, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                          )}
                        </div>
                      </FieldTap>
                    ))}
                  </div>
                )}
                {screeningCells.length > 0 && filmCells.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '15px 0' }}>
                    <span style={{ flex: 1, height: 1, background: amber, opacity: 0.35 }} />
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: amber, opacity: 0.75, flexShrink: 0 }} />
                    <span style={{ flex: 1, height: 1, background: amber, opacity: 0.35 }} />
                  </div>
                )}
                {filmCells.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px' }}>
                    {filmCells.map((c, i) => (
                      <FieldTap key={i} field={c.field} onField={onField}>
                        <div style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                          <div style={cellLabel}>{c.label}</div>
                          {c.ghost ? (
                            <FieldGhost width={c.full ? 300 : 220} height={34} surface="dark" />
                          ) : (
                            <div style={{ color: FS_INK, fontWeight: 600, fontSize: c.cast ? 24 : 26, fontFamily: FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                          )}
                        </div>
                      </FieldTap>
                    ))}
                  </div>
                )}
                {/* 하단 amber 더블룰 (마스터 카드 끝) */}
                <div style={{ marginTop: 15 }}>
                  <div style={{ height: 1, background: amber, opacity: 0.3, marginBottom: 3 }} />
                  <div style={{ height: 2, background: amber, opacity: 0.55 }} />
                </div>
              </div>
            </>
          )}

          {/* 푸터 — 바코드 제거(마스터), MADE WITH FILME + 서명은 유지(Q1) */}
          <div style={{ paddingTop: 14, display: 'flex', alignItems: 'flex-end', gap: 22, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 15, fontFamily: FONT_MONO, letterSpacing: 3, color: FS_DIM }}>MADE WITH FILME</span>
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: FS_DIM, marginBottom: 4 }}>COLLECTED BY</div>
                  <div style={{ fontWeight: 500, fontSize: 26, fontFamily: FONT_KR, color: FS_INK, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</div>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: FS_DIM, marginBottom: 4 }}>COLLECTED BY</div>
                  <FieldGhost text="SIGNATURE" width={200} height={30} surface="dark" />
                </div>
              </FieldTap>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bottom film-strip band */}
      <FilmStripBand pos="bottom" accent={amber} codes={edgeCodes} base={FS_BASE} />
      </div>
    </div>
  );
});
