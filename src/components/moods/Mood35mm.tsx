import { CSSProperties, ReactNode, memo } from 'react';
import type { SheetTarget } from '@/constants/fields';
import {
  ChainStamp,
  FieldGhost,
  FieldTap,
  FilmStripBand,
  FONT_DISPLAY,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  MoodWordmark,
  Poster,
  buildEdgeCodes,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  posterFitProps,
  POSTER_FRAME_INSET_Y,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
  useFontsReady,
  type FieldGhostState,
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
type MetaCell = { label: string; field: SheetTarget; value?: string; cast?: boolean; full?: boolean; ghost?: FieldGhostState; node?: ReactNode; hasGhost?: boolean };

export const Mood35mm = memo(function Mood35mm({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const amber = themeColor.toLowerCase() === '#ffffff' ? '#C2802F' : resolveInk(themeColor, '#C2802F');

  const captionScrim =
    'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.58) 24%, rgba(10,10,10,0.95) 70%)';

  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 캡션 가용폭(960 - margin22*2 - padding38*2). 2줄 클램프라
  // 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
  const fontsReady = useFontsReady();
  const titleFontSize = fitFontSizeToWidth(titleVal, 840 * 2, { fontFamily: FONT_KR, fontWeight: 800, minSize: 26, maxSize: 43 }, fontsReady);
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

  // 빈 항목 미리보기(#216) — 아톰 슬롯·셀 공통 판정. 노출 off도 dim placeholder로 남는다(#369).
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);
  const gRuntime = showFieldGhost(fv?.runtime, d.runtime, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating > 0, ghost);
  const gReleaseDate = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gReissue = showFieldGhost(fv?.reissue, reissueClean, ghost);
  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);

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
  else if (gRuntime) filmCells.push({ label: 'Runtime', ghost: gRuntime, field: 'runtime' });
  if (ratingVisible) filmCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)}`, field: 'rating' });
  else if (gRating) filmCells.push({ label: 'Rated', ghost: gRating, field: 'rating' });
  if (releaseDateVal) filmCells.push({ label: 'Released', value: releaseDateVal, field: 'releaseDate' });
  else if (gReleaseDate) filmCells.push({ label: 'Released', ghost: gReleaseDate, field: 'releaseDate' });
  // Re-released는 표시만 별도 셀, 편집 자리는 releaseDate 시트(reissue는 그 안에서) — 탭 타깃을 releaseDate로 둔다(빈 시트 dead-end 방지, onTicketFieldTap 회귀).
  if (reissueVal) filmCells.push({ label: 'Re-released', value: reissueVal, field: 'releaseDate' });
  else if (!!d.isReissue && gReissue) filmCells.push({ label: 'Re-released', ghost: gReissue, field: 'releaseDate' });
  if (actorsVal) filmCells.push({ label: 'Starring', value: actorsVal, cast: true, full: true, field: 'actors' });
  else if (gActors) filmCells.push({ label: 'Starring', full: true, ghost: gActors, field: 'actors' });

  // 필름 스트립 엣지 스크롤 코드(장식 크롬 — 편집 불가). 서명의 편집 자리는 아래 푸터, 여긴 시안 페이싱용 복제.
  // 스프로킷은 원어 표기가 필름 원판 느낌에 맞아 원제(titleOgVal)를 쓰고, 없으면 제목으로 폴백(#423).
  const edgeCodes = buildEdgeCodes({ titleVal: titleOgVal || titleVal, releaseDateVal, ratingVisible, rating: d.rating, signatureVal });

  const componentOpacity = components.componentOpacity ?? 1;

  const doubleRuleTop = (
    <div style={{ marginBottom: 4 }}>
      <div style={{ height: 2, background: amber, opacity: 0.55, marginBottom: 3 }} />
      <div style={{ height: 1, background: amber, opacity: 0.3 }} />
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, color: FS_INK, background: FS_BASE, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      {/* frameInsetY(#449) — 위/아래 블러 레터박스 노출을 20~25px 보장(중앙 정렬은 기존 기본값). */}
      <Poster src={croppedImageUrl} {...posterFitProps(components.posterFit, { letterboxBg: FS_BASE, frameInsetY: POSTER_FRAME_INSET_Y })} material={components.material} coating={components.coating} materialIntensity={components.materialIntensity} coatingIntensity={components.coatingIntensity} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 필름 스트립·스탬프·캡션 등 크롬 전체를 함께 페이드. */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      {/* Top film-strip band (마스터 92px 풀 스트립) */}
      <FilmStripBand pos="top" accent={amber} codes={edgeCodes} base={FS_BASE} />

      {/* Chain + format paired, top-left (마스터 left:50 top:130) */}
      {(stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
        stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost)) && (
        <div style={{ position: 'absolute', left: 50, top: 130, display: 'flex', alignItems: 'center', gap: 32 }}>
          <FieldTap field="chain" onField={onField}>
            <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface="dark" ghost={ghost} scale={components.chainScale ?? 1} />
          </FieldTap>
          {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 40, background: FS_INK, opacity: 0.5 }} />}
          <FieldTap field="format" onField={onField}>
            <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.85} surface="dark" ghost={ghost} scale={components.formatScale ?? 1} />
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
                <FieldGhost text="ORIGINAL TITLE" width={280} height={24} surface="dark" state={gTitleOg} />
              </div>
            </FieldTap>
          ) : null}
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontWeight: 800, fontSize: titleFontSize, fontFamily: FONT_KR, lineHeight: 1.08, letterSpacing: -0.4, marginBottom: 15, color: FS_INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {titleVal}
              </div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ marginBottom: 15 }}>
                <FieldGhost text="TITLE" width="60%" height={48} size={2} surface="dark" state={gTitle} />
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
                            <FieldGhost width={220} height={34} surface="dark" state={c.ghost} />
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
                            <FieldGhost width={c.full ? 300 : 220} height={34} surface="dark" state={c.ghost} />
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

          {/* 푸터 — 바코드 제거(마스터), MADE WITH FILME + 서명은 유지(Q1). 이탤릭 connector(made with/
              collected by) + 대문자 워드마크(FILME)는 Criterion·Stub·Editorial·35mm-landscape 4무드가
              공유하는 관례 — 이전엔 이 무드만 MONO 대문자로 갈라져 있었다(#321 방향 간 구조 통일). */}
          <div style={{ paddingTop: 14, display: 'flex', alignItems: 'baseline', gap: 22, minWidth: 0, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 15, opacity: 0.6, color: FS_INK }}>made with</span>
              <MoodWordmark size={14} color={FS_INK} />
            </div>
            {/* gap:12 — gap:10px는 병합 셀 분해 flex 컨테이너의 유일 시그니처(ghostMode #266 PR-C 불변식)라 여긴 12로 회피. */}
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 14, opacity: 0.72, color: FS_INK }}>collected by</span>
                  <span style={{ fontWeight: 500, fontSize: 26, fontFamily: FONT_KR, color: FS_INK, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</span>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 14, opacity: 0.72, color: FS_INK }}>collected by</span>
                  <FieldGhost text="SIGNATURE" width={200} height={30} surface="dark" state={gSignature} />
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
