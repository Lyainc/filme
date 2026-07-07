import { CSSProperties, ReactNode } from 'react';
import type { SheetTarget } from '@/constants/fields';
import {
  Barcode,
  ChainStamp,
  FieldGhost,
  FieldTap,
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
 * v4 — 필름 프레임 굿즈. 상하 스프로킷 + contain 포스터. 순수 모노/산세리프 인더스트리얼(세리프 배제).
 * 리뷰 반영: 엣지 문구 교체(35MM · SINGLE FRAME), 원형 평점 스탬프 기울기 제거, 포맷(DOLBY)을
 * 극장체인(MEGABOX) 옆으로 통일, Screened/Watched 중복 제거 + 날짜를 메타값 크기로 승격(Released 셀화,
 * 작은 푸터 날짜줄 삭제), 서명/FILME에 컨텍스트 라벨, 바코드 확대.
 */
const FS_BASE = '#0a0a0a';
const FS_HOLE = '#f6f1e4';
const FS_INK = '#f4ede0';
const FS_DIM = 'rgba(244,237,224,0.6)';
const FS_DIVIDER = 'rgba(244,237,224,0.28)';

const cellLabel: CSSProperties = {
  color: FS_DIM,
  fontWeight: 700,
  fontSize: 18,
  fontFamily: FONT_MONO,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
  marginBottom: 6,
};

// 병합 셀(node)이면 분해 조각을, 아니면 단일 값/ghost를 렌더하는 공통 메타 셀 형태(#266 PR-C).
type MetaCell = { label: string; field: SheetTarget; value?: string; cast?: boolean; full?: boolean; ghost?: boolean; node?: ReactNode; hasGhost?: boolean };

export function Mood35mm({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const titleSize = pickTitleSize(d.title.length, [104, 84, 66, 54]);

  const captionScrim =
    'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.55) 18%, rgba(10,10,10,0.92) 60%, rgba(10,10,10,0.98) 100%)';

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

  // 빈 항목 미리보기(#216) — 아톰 슬롯 판정. 셀은 아래에서 개별 게이팅.
  const ghostOn = ghost === true;
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gSeat = showFieldGhost(fv?.seat, d.seat, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);

  // 청킹: 관람(Exhibited/Screened) vs 영화(Runtime/Released/Starring). 값은 Pretendard로 통일
  // (한글이 모노 스택에서 깨지던 문제 해소). 모노는 스프로킷·일련번호·원형 스탬프 등 필름 크롬에만.
  // 병합 셀(Exhibited=극장+상영관+좌석, Screened=관람일+시간)은 fieldPieces로 필드별 독립 조각(값→
  // 텍스트, 빈+ghost→라벨 점선)으로 분해한다(#266 PR-C) — 조각이 각자 제 시트를 열고, 데스크톱
  // (onField=undefined)은 FieldTap이 통과해 분해 전과 바이트 동일.
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

  const filmCells: MetaCell[] = [];
  if (runtimeVal) filmCells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (ghostOn && fv?.runtime !== false) filmCells.push({ label: 'Runtime', ghost: true, field: 'runtime' });
  const released = [releaseDateVal, reissueVal && `재개봉 ${reissueVal}`].filter(Boolean).join(' · ');
  if (released) filmCells.push({ label: 'Released', value: released, field: 'releaseDate' });
  else if (ghostOn && (fv?.releaseDate !== false || (!!d.isReissue && fv?.reissue !== false))) filmCells.push({ label: 'Released', ghost: true, field: 'releaseDate' });
  if (actorsVal) filmCells.push({ label: 'Starring', value: actorsVal, cast: true, full: true, field: 'actors' });
  else if (ghostOn && fv?.actors !== false) filmCells.push({ label: 'Starring', full: true, ghost: true, field: 'actors' });

  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, color: FS_INK, background: FS_BASE, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      <Poster src={croppedImageUrl} fit="contain" background={FS_BASE} texture={components.texture} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 스프로킷·일련번호·스탬프·캡션 등 필름 크롬 전체를 함께 페이드.
          자식이 전부 position:absolute라 inset:0 래퍼가 루트를 채워 opacity 1에서 no-op. */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      {/* Top sprocket band */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        <HorizontalSprockets count={14} height={56} base={FS_BASE} hole={FS_HOLE} />
      </div>

      {/* Slim serial strip */}
      {(fv?.bookingNo ?? true) && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 56, background: FS_BASE, padding: '10px 32px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontWeight: 700, fontSize: 19, fontFamily: FONT_MONO, letterSpacing: 2.5, color: FS_INK, borderBottom: `1px solid ${FS_DIVIDER}` }}>
          <span style={{ color: FS_DIM }}>35MM · SINGLE FRAME</span>
        </div>
      )}

      {/* Chain + format paired (같은 위상이라 인접 배치), top-left */}
      {(components.chainVisible || components.formatVisible) && (
        <div style={{ position: 'absolute', left: 28, top: 150, display: 'flex', alignItems: 'center', gap: 18 }}>
          <FieldTap field="chain" onField={onField}>
            <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface="dark" ghost={ghost} />
          </FieldTap>
          {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 34, background: FS_INK, opacity: 0.5 }} />}
          <FieldTap field="format" onField={onField}>
            <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.85} surface="dark" ghost={ghost} />
          </FieldTap>
        </div>
      )}

      {/* Circular rating stamp — 기울기 제거(정방향) */}
      {ratingVisible && (
        <FieldTap field="rating" onField={onField}>
          <div style={{ position: 'absolute', right: 36, top: 150, width: 138, height: 138, borderRadius: '50%', border: `2px solid ${FS_INK}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.42)', boxShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            <span style={{ fontWeight: 800, fontSize: 46, fontFamily: FONT_MONO, lineHeight: 1, color: FS_INK }}>{d.rating.toFixed(1)}</span>
            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: FS_DIM, marginTop: 4 }}>RATED ★</span>
          </div>
        </FieldTap>
      )}

      {/* 빈 항목 미리보기(#216): 평점 원형 스탬프 자리표시자(점선 원). ratingVisible과 상호배타. */}
      {gRating && (
        <FieldTap field="rating" onField={onField}>
          <div data-hide-on-export="true" style={{ position: 'absolute', right: 36, top: 150, width: 138, height: 138, borderRadius: '50%', border: `2px dashed ${FS_INK}`, opacity: 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT_MONO, letterSpacing: 2, color: FS_INK }}>RATED ★</span>
          </div>
        </FieldTap>
      )}

      {/* Caption above bottom sprockets */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, paddingTop: 110, background: captionScrim }}>
        <div style={{ padding: '18px 36px 18px', borderTop: `1px solid ${FS_DIVIDER}`, margin: '0 16px' }}>
          {titleOgVal ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ fontWeight: 700, fontSize: 21, fontFamily: FONT_MONO, letterSpacing: 2.5, textTransform: 'uppercase', color: FS_DIM, marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {titleOgVal}
              </div>
            </FieldTap>
          ) : gTitleOg ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ marginBottom: 12 }}>
                <FieldGhost text="ORIGINAL TITLE" width={280} height={26} surface="dark" />
              </div>
            </FieldTap>
          ) : null}
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontWeight: 800, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.05, letterSpacing: -0.5, marginBottom: 22, color: FS_INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {titleVal}
              </div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ marginBottom: 22 }}>
                <FieldGhost text="TITLE" width="60%" height={62} size={2} surface="dark" />
              </div>
            </FieldTap>
          ) : null}

          {(screeningCells.length > 0 || filmCells.length > 0) && (
            <div style={{ marginBottom: 18 }}>
              {screeningCells.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 48px' }}>
                  {screeningCells.map((c, i) => c.node !== undefined ? (
                    <div key={i} style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                      <div style={cellLabel}>{c.label}</div>
                      <div style={{ color: FS_INK, fontWeight: 600, fontSize: 32, fontFamily: FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(c.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{c.node}</div>
                    </div>
                  ) : (
                    <FieldTap key={i} field={c.field} onField={onField}>
                      <div style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                        <div style={cellLabel}>{c.label}</div>
                        {c.ghost ? (
                          <FieldGhost width={220} height={38} surface="dark" />
                        ) : (
                          <div style={{ color: FS_INK, fontWeight: 600, fontSize: 32, fontFamily: FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                        )}
                      </div>
                    </FieldTap>
                  ))}
                </div>
              )}
              {screeningCells.length > 0 && filmCells.length > 0 && (
                <div style={{ height: 1, background: FS_DIVIDER, margin: '16px 0' }} />
              )}
              {filmCells.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 48px' }}>
                  {filmCells.map((c, i) => (
                    <FieldTap key={i} field={c.field} onField={onField}>
                      <div style={{ minWidth: 0, flex: c.full ? '1 1 100%' : '0 1 auto' }}>
                        <div style={cellLabel}>{c.label}</div>
                        {c.ghost ? (
                          <FieldGhost width={c.full ? 300 : 220} height={38} surface="dark" />
                        ) : (
                          <div style={{ color: FS_INK, fontWeight: c.cast ? 500 : 600, fontSize: c.cast ? 30 : 32, fontFamily: c.cast ? FONT_KR : FONT_SANS, letterSpacing: -0.2, lineHeight: 1.2, maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                        )}
                      </div>
                    </FieldTap>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ paddingTop: 14, borderTop: `1px solid ${FS_DIVIDER}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, minWidth: 0 }}>
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
            {(fv?.bookingNo ?? true) && (
              <FieldTap field="bookingNo" onField={onField}>
                <Barcode value={bookingNo} color={FS_INK} width={244} height={50} textSize={19} />
              </FieldTap>
            )}
          </div>
        </div>
      </div>

      {/* Bottom sprocket band */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <HorizontalSprockets count={14} height={56} base={FS_BASE} hole={FS_HOLE} />
      </div>
      </div>
    </div>
  );
}
