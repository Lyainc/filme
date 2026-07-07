import { CSSProperties, ReactNode } from 'react';
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
  HorizontalSprockets,
  MoodProps,
  Poster,
  fieldPieces,
  gate,
  pickTitleSize,
  posterTapProps,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
} from './_shared';

/**
 * v07 — 35mm 가로 필름(#210). 세로 35mm의 가로 변형. 상·하 필름 스프로킷 스트립(amber edge print) +
 * 포스터/정보패널 좌우 분할. 좌: 포스터 + 스크림 위 체인·포맷 / now showing / 타이틀 / 원제.
 * 우 패널(#070707): SINGLE FRAME + amber 평점, Exhibited/Screened/Runtime/Released/Starring 스택,
 * footer made with FILME + 일련번호. 데이터=Pretendard, 코드=Mono. 분할 레이아웃이라 포스터 컬럼에만 탭(#259).
 */
const FS_BASE = '#070707';
const FS_HOLE = '#f6f1e4';
const FS_INK = '#f4ede0';
const FS_DIM = 'rgba(244,237,224,0.6)';
const FS_DIVIDER = 'rgba(244,237,224,0.24)';
const AMBER = '#e0a44e';

const STRIP_H = 82;
const PANEL_W = 540;

const cellLabel: CSSProperties = {
  color: FS_DIM,
  fontWeight: 700,
  fontSize: 17,
  fontFamily: FONT_MONO,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
  marginBottom: 7,
};
const cellValue: CSSProperties = {
  color: FS_INK,
  fontWeight: 600,
  fontSize: 30,
  fontFamily: FONT_SANS,
  letterSpacing: -0.2,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// 병합 셀(node)이면 분해 조각을, 아니면 단일 값/ghost를 렌더하는 공통 메타 셀 형태(#266 PR-C).
type MetaCell = { label: string; field: SheetTarget; value?: string; cast?: boolean; ghost?: boolean; node?: ReactNode; hasGhost?: boolean };

/** amber latent-image edge print — 스프로킷 스트립 위 필름 가장자리 인쇄 문구. */
function EdgePrint({ text }: { text: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <span style={{ fontWeight: 700, fontSize: 20, fontFamily: FONT_MONO, letterSpacing: 6, color: AMBER, opacity: 0.85, textTransform: 'uppercase' }}>{text}</span>
    </div>
  );
}

export function Mood35mmLandscape({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const titleSize = pickTitleSize(d.title.length, [92, 74, 60, 48]);
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

  const ghostOn = ghost === true;
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);

  // 우 패널 라벨 스택(#210). 병합 셀(Exhibited=극장+상영관+좌석, Screened=관람일+시간)은 fieldPieces로
  // 필드별 독립 조각(값→텍스트, 빈+ghost→라벨 점선)으로 분해한다(#266 PR-C) — 조각이 각자 제 시트를 열고,
  // 데스크톱(onField=undefined)은 FieldTap이 통과해 분해 전과 바이트 동일. Released 재개봉은 releaseDate로(#215).
  const cells: MetaCell[] = [];
  const exhibited = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
      { field: 'seat', value: seatVal, ghost: gSeat, label: 'SEAT' },
    ],
    onField,
    { surface: 'dark' }
  );
  if (exhibited.hasAny) cells.push({ label: 'Exhibited', node: exhibited.node, hasGhost: exhibited.hasGhost, field: 'theater' });
  const screened = fieldPieces(
    [
      { field: 'watchDate', value: watchDateVal, ghost: gWatchDate, label: 'DATE' },
      { field: 'watchTime', value: watchTimeVal, ghost: gWatchTime, label: 'TIME' },
    ],
    onField,
    { surface: 'dark' }
  );
  if (screened.hasAny) cells.push({ label: 'Screened', node: screened.node, hasGhost: screened.hasGhost, field: 'watchDate' });
  if (runtimeVal) cells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (ghostOn && fv?.runtime !== false) cells.push({ label: 'Runtime', ghost: true, field: 'runtime' });
  const released = [releaseDateVal, reissueVal && `재개봉 ${reissueVal}`].filter(Boolean).join(' · ');
  if (released) cells.push({ label: 'Released', value: released, field: 'releaseDate' });
  else if (ghostOn && (fv?.releaseDate !== false || (!!d.isReissue && fv?.reissue !== false))) cells.push({ label: 'Released', ghost: true, field: 'releaseDate' });
  if (actorsVal) cells.push({ label: 'Starring', value: actorsVal, cast: true, field: 'actors' });
  else if (ghostOn && fv?.actors !== false) cells.push({ label: 'Starring', cast: true, ghost: true, field: 'actors' });

  const hasStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const bothStamps =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) &&
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  const captionScrim =
    'linear-gradient(180deg, rgba(7,7,7,0) 0%, rgba(7,7,7,0.55) 30%, rgba(7,7,7,0.94) 100%)';
  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: FS_BASE, color: FS_INK, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top film strip */}
      <div style={{ position: 'relative', height: STRIP_H, flexShrink: 0 }}>
        <HorizontalSprockets count={20} height={STRIP_H} base={FS_BASE} hole={FS_HOLE} />
        <EdgePrint text="FILME · 35MM" />
      </div>

      {/* Middle — poster | panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: poster column — 분할 레이아웃이라 이 컬럼에만 포스터 탭(#259) */}
        <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden', minWidth: 0 }} {...posterTapProps(onPosterTap)}>
          <Poster src={croppedImageUrl} fit="cover" background="#0a0a0a" texture={components.texture} posterOpacity={components.posterOpacity} />

          {/* #219 componentOpacity: 포스터 뺀 캡션·스탬프 페이드. inset:0 래퍼라 opacity 1에서 no-op. */}
          <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
            {/* Chain + format, top-left */}
            {hasStamp && (
              <div style={{ position: 'absolute', left: 36, top: 32, display: 'flex', alignItems: 'center', gap: 18 }}>
                <FieldTap field="chain" onField={onField}>
                  <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={48} surface="dark" ghost={ghost} />
                </FieldTap>
                {bothStamps && <span style={{ width: 1, height: 32, background: FS_INK, opacity: 0.5 }} />}
                <FieldTap field="format" onField={onField}>
                  <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.8} surface="dark" ghost={ghost} />
                </FieldTap>
              </div>
            )}

            {/* Bottom caption */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 130, background: captionScrim }}>
              <div style={{ padding: '0 44px 40px', color: FS_INK }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 28, opacity: 0.78, marginBottom: 10, letterSpacing: 0.3 }}>now showing</div>
                {titleVal ? (
                  <FieldTap field="title" onField={onField}>
                    <div style={{ fontWeight: 800, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.04, letterSpacing: -1, marginBottom: 12, textShadow: '0 2px 14px rgba(0,0,0,0.55)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {titleVal}
                    </div>
                  </FieldTap>
                ) : gTitle ? (
                  <FieldTap field="title" onField={onField}>
                    <div style={{ marginBottom: 12 }}><FieldGhost text="TITLE" width="60%" height={64} size={2} surface="dark" /></div>
                  </FieldTap>
                ) : null}
                {titleOgVal ? (
                  <FieldTap field="titleOg" onField={onField}>
                    <div style={{ fontWeight: 700, fontSize: 20, fontFamily: FONT_MONO, letterSpacing: 2.5, textTransform: 'uppercase', color: FS_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {titleOgVal}
                    </div>
                  </FieldTap>
                ) : gTitleOg ? (
                  <FieldTap field="titleOg" onField={onField}>
                    <div><FieldGhost text="ORIGINAL TITLE" width={260} height={26} surface="dark" /></div>
                  </FieldTap>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Right: info panel */}
        <div style={{ flex: `0 0 ${PANEL_W}px`, background: FS_BASE, borderLeft: `1px solid ${FS_DIVIDER}`, padding: '40px 44px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', opacity: componentOpacity }}>
          {/* SINGLE FRAME + amber rating */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 24, borderBottom: `1px solid ${FS_DIVIDER}` }}>
            <span style={{ fontWeight: 700, fontSize: 18, fontFamily: FONT_MONO, letterSpacing: 3, color: FS_DIM }}>SINGLE FRAME</span>
            {ratingVisible && (
              <FieldTap field="rating" onField={onField}>
                <span style={{ fontWeight: 800, fontSize: 34, fontFamily: FONT_SANS, color: AMBER }}>★ {d.rating.toFixed(1)}</span>
              </FieldTap>
            )}
          </div>

          {/* Label stack */}
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {cells.map((c, i) => c.node !== undefined ? (
              <div key={i} style={{ minWidth: 0 }}>
                <div style={cellLabel}>{c.label}</div>
                <div style={{ ...cellValue, ...(c.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{c.node}</div>
              </div>
            ) : (
              <FieldTap key={i} field={c.field} onField={onField}>
                <div style={{ minWidth: 0 }}>
                  <div style={cellLabel}>{c.label}</div>
                  {c.ghost ? (
                    <FieldGhost width={260} height={38} surface="dark" />
                  ) : (
                    <div style={{ ...cellValue, ...(c.cast ? { fontFamily: FONT_KR, fontWeight: 500, whiteSpace: 'normal' } : {}) }}>{c.value}</div>
                  )}
                </div>
              </FieldTap>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Footer — made with FILME + serial + barcode */}
          <div style={{ paddingTop: 22, borderTop: `1px solid ${FS_DIVIDER}` }}>
            {signatureVal && (
              <FieldTap field="signature" onField={onField}>
                <div style={{ marginBottom: 18, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: FS_DIM, marginBottom: 5 }}>COLLECTED BY</div>
                  <div style={{ fontWeight: 500, fontSize: 26, fontFamily: FONT_KR, color: FS_INK, maxWidth: PANEL_W - 88, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signatureVal}</div>
                </div>
              </FieldTap>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, opacity: 0.6 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 20, color: FS_INK }}>made with</span>
                <span style={{ fontWeight: 800, fontSize: 20, fontFamily: FONT_SANS, letterSpacing: 3, color: FS_INK }}>FILME</span>
              </div>
              {(fv?.bookingNo ?? true) && (
                <FieldTap field="bookingNo" onField={onField}>
                  <Barcode value={bookingNo} color={FS_INK} width={230} height={52} textSize={17} />
                </FieldTap>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom film strip */}
      <div style={{ position: 'relative', height: STRIP_H, flexShrink: 0 }}>
        <HorizontalSprockets count={20} height={STRIP_H} base={FS_BASE} hole={FS_HOLE} />
        <EdgePrint text="SINGLE FRAME · FILME" />
      </div>
    </div>
  );
}
