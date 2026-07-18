import { CSSProperties, memo } from 'react';
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
 * v08 — 마스터 시안 Ticket Design Master.dc.html v2(2026-07-08 resync) 06 35MM WIDE 재동기화(에픽 #281).
 * 35mm 가로 필름(1534×960 · dark #070707 · amber accent · 바코드 없음). 마스터 델타:
 * - 상/하단 스프로킷을 92px 풀 필름 스트립(FilmStripBand, 03=35mm 세로와 동일 헬퍼)으로 승격.
 * - 우 패널을 "From the Archive" 아카이브 카드로 재구조화 — collected by(서명) · made with FILME
 *   헤더(ACCESSION No. 더미 장식 문구는 #393에서 제거), amber 더블룰, Exhibited/Screened,
 *   2열 그리드(Runtime·Rated·Released·Re-released), Starring.
 * - "SINGLE FRAME" 헤더 + 인라인 평점 제거 → 평점을 Rated 셀로 이동. Released/Re-released 셀 분리.
 * - 푸터 바코드 제거 → bookingNo 미렌더(MOOD_EXCLUDED_FIELDS['35mm-landscape']).
 * - 타이틀 고정 60/800(pickTitleSize 폐기), 필드 라벨16/값27(Starring 25), amber 악센트 시스템(themeColor 파생).
 * 분할 레이아웃이라 포스터 컬럼에만 탭(#259). FieldTap/ghost·componentOpacity gate 배선 보존.
 */
const FS_BASE = '#070707';
const FS_INK = '#f4ede0';
const FS_DIM = 'rgba(244,237,224,0.6)';
const FS_DIVIDER = 'rgba(244,237,224,0.22)';
const PANEL_W = 600;
const STRIP_H = 92;

const cellLabel: CSSProperties = {
  fontFamily: FONT_MONO,
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
  color: FS_DIM,
  marginBottom: 5,
};
const cellValue: CSSProperties = {
  color: FS_INK,
  fontWeight: 600,
  fontSize: 27,
  fontFamily: FONT_SANS,
  letterSpacing: -0.2,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// 단일 값/ghost 셀(그리드·Starring). 병합 셀(Exhibited/Screened)은 fieldPieces node로 별도 렌더.
type MetaCell = { label: string; field: SheetTarget; value?: string; cast?: boolean; ghost?: FieldGhostState };

export const Mood35mmLandscape = memo(function Mood35mmLandscape({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const amber = themeColor.toLowerCase() === '#ffffff' ? '#C2802F' : resolveInk(themeColor, '#C2802F');

  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 포스터 열 캡션 가용폭(1534 - PANEL_W600 - padding46*2, #450 폭 1534 재조정). 2줄
  // 클램프라 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
  const fontsReady = useFontsReady();
  const titleFontSize = fitFontSizeToWidth(titleVal, 842 * 2, { fontFamily: FONT_KR, fontWeight: 800, minSize: 37, maxSize: 60 }, fontsReady);
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

  // 빈 항목 미리보기 — 노출 off도 dim placeholder로 남는다(#369).
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

  // Exhibited(극장+상영관+좌석) / Screened(관람일+시간) 병합 셀 → fieldPieces로 필드별 독립 조각 분해(#266 PR-C).
  const exhibited = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
      { field: 'seat', value: seatVal, ghost: gSeat, label: 'SEAT' },
    ],
    onField,
    { surface: 'dark' }
  );
  const screened = fieldPieces(
    [
      { field: 'watchDate', value: watchDateVal, ghost: gWatchDate, label: 'DATE' },
      { field: 'watchTime', value: watchTimeVal, ghost: gWatchTime, label: 'TIME' },
    ],
    onField,
    { surface: 'dark' }
  );

  // 2열 그리드 순서(마스터): Runtime · Rated · Released · Re-released. 평점은 인라인 헤더 → Rated 셀로 이동.
  const gridCells: MetaCell[] = [];
  if (runtimeVal) gridCells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (gRuntime) gridCells.push({ label: 'Runtime', ghost: gRuntime, field: 'runtime' });
  if (ratingVisible) gridCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)} / 5.0`, field: 'rating' });
  else if (gRating) gridCells.push({ label: 'Rated', ghost: gRating, field: 'rating' });
  if (releaseDateVal) gridCells.push({ label: 'Released', value: releaseDateVal, field: 'releaseDate' });
  else if (gReleaseDate) gridCells.push({ label: 'Released', ghost: gReleaseDate, field: 'releaseDate' });
  // Re-released 표시만 별도 셀 — 편집 자리는 releaseDate 시트(reissue는 그 안에서). 탭 타깃 releaseDate로 빈 시트 dead-end 방지.
  if (reissueVal) gridCells.push({ label: 'Re-released', value: reissueVal, field: 'releaseDate' });
  else if (!!d.isReissue && gReissue) gridCells.push({ label: 'Re-released', ghost: gReissue, field: 'releaseDate' });

  const starring: MetaCell | null = actorsVal
    ? { label: 'Starring', value: actorsVal, cast: true, field: 'actors' }
    : gActors
    ? { label: 'Starring', cast: true, ghost: gActors, field: 'actors' }
    : null;

  // 필름 스트립 엣지 스크롤 코드(장식 크롬 — 편집 불가, 시안 페이싱용 복제).
  // 스프로킷은 원어 표기가 필름 원판 느낌에 맞아 원제(titleOgVal)를 쓰고, 없으면 제목으로 폴백(35mm 세로와 동일, #423).
  const edgeCodes = buildEdgeCodes({ titleVal: titleOgVal || titleVal, releaseDateVal, ratingVisible, rating: d.rating, signatureVal });

  const hasStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const bothStamps =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) &&
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  const captionScrim =
    'linear-gradient(180deg, rgba(7,7,7,0) 0%, rgba(7,7,7,0.55) 42%, rgba(7,7,7,0.95) 100%)';
  const componentOpacity = components.componentOpacity ?? 1;

  const cellEl = (c: MetaCell, key: number) => (
    <FieldTap key={key} field={c.field} onField={onField}>
      <div style={{ minWidth: 0 }}>
        <div style={cellLabel}>{c.label}</div>
        {c.ghost ? (
          <FieldGhost width={c.cast ? 300 : 200} height={34} surface="dark" state={c.ghost} />
        ) : (
          <div style={{ ...cellValue, ...(c.cast ? { fontFamily: FONT_KR, fontWeight: 500, fontSize: 25, whiteSpace: 'normal' } : null) }}>{c.value}</div>
        )}
      </div>
    </FieldTap>
  );

  const dotDivider = (
    // gap:12 — gap:10px는 병합 셀 분해 flex 컨테이너의 유일 시그니처(ghostMode #266 PR-C 불변식)라 여긴 12로 회피(35mm 세로와 동일).
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
      <span style={{ flex: 1, height: 1, background: amber, opacity: 0.35 }} />
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: amber, opacity: 0.75, flexShrink: 0 }} />
      <span style={{ flex: 1, height: 1, background: amber, opacity: 0.35 }} />
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: FS_BASE, color: FS_INK, fontFamily: FONT_SANS, overflow: 'hidden' }}>
      {/* Middle — poster | archive panel (마스터 top:92 bottom:92) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: STRIP_H, bottom: STRIP_H, display: 'flex' }}>
        {/* Left: poster column — 분할 레이아웃이라 이 컬럼에만 포스터 탭(#259) */}
        <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden', minWidth: 0 }} {...posterTapProps(onPosterTap)}>
          <Poster src={croppedImageUrl} {...posterFitProps(components.posterFit, { letterboxBg: '#0a0a0a' })} texture={components.texture} posterOpacity={components.posterOpacity} />

          {/* #219 componentOpacity: 포스터 뺀 캡션·스탬프·그라디언트 페이드. inset:0 래퍼라 opacity 1에서 no-op. */}
          <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 130, background: 'linear-gradient(180deg, rgba(10,10,10,0.85), rgba(10,10,10,0))' }} />

            {/* Chain + format, top-left (마스터 left:46 top:34) */}
            {hasStamp && (
              <div style={{ position: 'absolute', left: 46, top: 34, display: 'flex', alignItems: 'center', gap: 28 }}>
                <FieldTap field="chain" onField={onField}>
                  <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface="dark" ghost={ghost} />
                </FieldTap>
                {bothStamps && <span style={{ width: 1, height: 30, background: FS_INK, opacity: 0.5 }} />}
                <FieldTap field="format" onField={onField}>
                  <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.85} surface="dark" ghost={ghost} />
                </FieldTap>
              </div>
            )}

            {/* Bottom caption (마스터 left:46 right:46 bottom:44) */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 130, background: captionScrim }}>
              <div style={{ padding: '0 46px 44px', color: FS_INK }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 31, opacity: 0.85, marginBottom: 10 }}>now showing</div>
                {titleVal ? (
                  <FieldTap field="title" onField={onField}>
                    <div style={{ fontWeight: 800, fontSize: titleFontSize, fontFamily: FONT_KR, lineHeight: 1.02, letterSpacing: -1, marginBottom: 14, textShadow: '0 2px 14px rgba(0,0,0,0.55)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {titleVal}
                    </div>
                  </FieldTap>
                ) : gTitle ? (
                  <FieldTap field="title" onField={onField}>
                    <div style={{ marginBottom: 14 }}><FieldGhost text="TITLE" width="60%" height={66} size={2} surface="dark" state={gTitle} /></div>
                  </FieldTap>
                ) : null}
                {titleOgVal ? (
                  <FieldTap field="titleOg" onField={onField}>
                    <div style={{ fontWeight: 700, fontSize: 18, fontFamily: FONT_MONO, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.78, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {titleOgVal}
                    </div>
                  </FieldTap>
                ) : gTitleOg ? (
                  <FieldTap field="titleOg" onField={onField}>
                    <div><FieldGhost text="ORIGINAL TITLE" width={280} height={24} surface="dark" state={gTitleOg} /></div>
                  </FieldTap>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Right: archive panel (마스터 flex 0 0 600, justify center) */}
        <div style={{ flex: `0 0 ${PANEL_W}px`, background: FS_BASE, borderLeft: `1px solid ${FS_DIVIDER}`, padding: '46px 46px 38px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: componentOpacity }}>
          {/* From the Archive 헤더 블록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, paddingBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 28, height: 2, background: amber, opacity: 0.7, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, letterSpacing: 3, textTransform: 'uppercase', color: amber }}>From the Archive</span>
            </div>
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 21, opacity: 0.72 }}>collected by</span>
                  <span style={{ fontWeight: 800, fontSize: 34, fontFamily: FONT_KR, letterSpacing: -0.5, lineHeight: 1, color: FS_INK, maxWidth: PANEL_W - 92, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</span>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 21, opacity: 0.72 }}>collected by</span>
                  <FieldGhost text="SIGNATURE" width={180} height={30} surface="dark" state={gSignature} />
                </div>
              </FieldTap>
            ) : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 18, opacity: 0.6 }}>made with</span>
                <MoodWordmark size={17} color={FS_INK} />
              </div>
            </div>
          </div>

          {/* amber 더블룰 (카드 시작) */}
          <div style={{ marginTop: 44 }}>
            <div style={{ height: 2, background: amber, opacity: 0.55, marginBottom: 3 }} />
            <div style={{ height: 1, background: amber, opacity: 0.3 }} />
          </div>

          {/* 라벨 스택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 20 }}>
            {exhibited.hasAny && (
              <div style={{ minWidth: 0 }}>
                <div style={cellLabel}>Exhibited</div>
                <div style={{ ...cellValue, ...(exhibited.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{exhibited.node}</div>
              </div>
            )}
            {screened.hasAny && (
              <div style={{ minWidth: 0 }}>
                <div style={cellLabel}>Screened</div>
                <div style={{ ...cellValue, ...(screened.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{screened.node}</div>
              </div>
            )}
            {(exhibited.hasAny || screened.hasAny) && gridCells.length > 0 && dotDivider}
            {gridCells.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
                {gridCells.map((c, i) => cellEl(c, i))}
              </div>
            )}
            {starring && cellEl(starring, 0)}
          </div>

          {/* amber 더블룰 (카드 끝) */}
          <div style={{ marginTop: 22 }}>
            <div style={{ height: 1, background: amber, opacity: 0.3, marginBottom: 3 }} />
            <div style={{ height: 2, background: amber, opacity: 0.55 }} />
          </div>
        </div>
      </div>

      {/* Top/bottom 92px 필름 스트립 — 크롬이라 componentOpacity와 함께 페이드(#219) */}
      <div style={{ opacity: componentOpacity }}>
        <FilmStripBand pos="top" accent={amber} codes={edgeCodes} base={FS_BASE} />
        <FilmStripBand pos="bottom" accent={amber} codes={edgeCodes} base={FS_BASE} />
      </div>
    </div>
  );
});
