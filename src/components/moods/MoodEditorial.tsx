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
  PerforationStrip,
  Poster,
  fieldPieces,
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

export function MoodEditorial({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
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

  // 빈 항목 미리보기(#216) — 아톰/헤더 슬롯 판정. 셀·릴리즈라인은 아래에서 개별 게이팅.
  const ghostOn = ghost === true;
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);
  const gRuntime = showFieldGhost(fv?.runtime, d.runtime, ghost);
  const gRating = showFieldGhost(fv?.rating, d.rating, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen = showFieldGhost(fv?.screen, d.screen, ghost);
  const gWatchDate = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime = showFieldGhost(fv?.watchTime, d.watchTime, ghost);
  const gRelease = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gReissue = ghostOn && !reissueVal && !!d.isReissue && fv?.reissue !== false;

  // 관람(screening) 메타 셀 분해(#266) — 병합 셀(Théâtre=극장+상영관, Séance=관람일+시간)을 조각별
  // 독립 FieldTap + 개별 ghost로. 단 Editorial은 sep-join이 아니라 value(42px)+sub(26px) 2줄·라벨
  // 스위칭 구조라 fieldPieces(inline sep-join)가 안 맞아 셀 내부에서 각 줄을 FieldTap으로 감싼다.
  // 라벨 스위칭(극장 없으면 상영관이 value로 승격)을 그대로 유지해 데스크톱 픽셀을 보존한다.
  type Cell = {
    label: string;
    value?: string; valueField: SheetTarget; valueGhost?: boolean; valueGhostLabel?: string;
    sub?: string; subField?: SheetTarget; subGhost?: boolean; subGhostLabel?: string;
  };
  const cells: Cell[] = [];
  if (theaterVal) {
    cells.push({ label: 'Théâtre', value: theaterVal, valueField: 'theater', sub: screenVal, subField: 'screen', subGhost: gScreen, subGhostLabel: 'SCREEN' });
  } else if (screenVal) {
    cells.push({ label: 'Salle', value: screenVal, valueField: 'screen', subField: 'theater', subGhost: gTheater, subGhostLabel: 'THEATER' });
  } else if (ghostOn && (fv?.theater !== false || fv?.screen !== false)) {
    cells.push({ label: 'Théâtre', valueField: 'theater', valueGhost: gTheater, valueGhostLabel: 'THEATER', subField: 'screen', subGhost: gScreen, subGhostLabel: 'SCREEN' });
  }
  if (watchDateVal) {
    cells.push({ label: 'Séance', value: watchDateVal, valueField: 'watchDate', sub: watchTimeVal, subField: 'watchTime', subGhost: gWatchTime, subGhostLabel: 'TIME' });
  } else if (watchTimeVal) {
    cells.push({ label: 'Heure', value: watchTimeVal, valueField: 'watchTime', subField: 'watchDate', subGhost: gWatchDate, subGhostLabel: 'DATE' });
  } else if (ghostOn && (fv?.watchDate !== false || fv?.watchTime !== false)) {
    cells.push({ label: 'Séance', valueField: 'watchDate', valueGhost: gWatchDate, valueGhostLabel: 'DATE', subField: 'watchTime', subGhost: gWatchTime, subGhostLabel: 'TIME' });
  }
  if (seatVal) cells.push({ label: 'Place', value: seatVal, valueField: 'seat' });
  else if (ghostOn && fv?.seat !== false) cells.push({ label: 'Place', valueField: 'seat', valueGhost: true, valueGhostLabel: 'SEAT' });

  // 릴리즈 병합선 분해(#266) — Sortie·Reprise를 Editorial 고유 sep('      ·      ')로 붙이던 한 줄을
  // 조각별 독립 FieldTap + 개별 ghost로. 이건 실제 sep-join이라 fieldPieces가 그대로 맞는다. reissue는
  // FIELD_SHEET_TYPE에 없어 releaseDate 시트로 매핑(Criterion/Minimal RE-REL.과 정렬).
  const release = fieldPieces(
    [
      { field: 'releaseDate', value: releaseDateVal && `Sortie ${releaseDateVal}`, ghost: gRelease, label: 'RELEASE' },
      { field: 'releaseDate', value: reissueVal && `Reprise ${reissueVal}`, ghost: gReissue, label: 'REISSUE' },
    ],
    onField,
    { sep: '      ·      ', surface: 'paper' }
  );

  const filmSummary = runtimeVal;
  const stubHasStamp = components.chainVisible || components.formatVisible;
  // #219 componentOpacity: 3열 flex라 inset:0 래퍼로 감싸면 flex 컨텍스트가 깨진다. 대신 포스터가 아닌
  // 두 열(B: Main, C: Stub)의 기존 스타일에 opacity를 직접 얹는다 — opacity는 레이아웃에 무관하고
  // opacity 1은 기본값이라 데스크톱은 픽셀 동일. 포스터 열 A는 손대지 않아 축 독립 유지.
  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: PAPER, color: PAPER_DEEP, fontFamily: FONT_SANS, overflow: 'hidden', display: 'flex' }}>
      {/* A: Poster — 포스터 컬럼에만 탭(#259). 풀블리드 무드와 달리 editorial은 3열이라 root가 아닌 이 열에. */}
      <div style={{ flex: `0 0 ${POSTER_W}px`, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
        <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER} background="transparent" />
        </div>
      </div>

      {/* B: Main */}
      <div style={{ flex: `0 0 ${MAIN_W}px`, position: 'relative', background: PAPER, color: PAPER_DEEP, display: 'flex', flexDirection: 'column', padding: '36px 48px 34px', boxSizing: 'border-box', opacity: componentOpacity }}>
        {/* Header — le billet + 영화 요약(러닝·평점) (크기 확대) */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 18, paddingBottom: 18 }}>
          <div style={{ ...italicLabel(accent, 36) }}>le billet</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            {filmSummary && (
              <FieldTap field="runtime" onField={onField}>
                <span style={{ fontWeight: 600, fontSize: 24, fontFamily: FONT_SANS, color: PAPER_DIM, letterSpacing: -0.2 }}>{filmSummary}</span>
              </FieldTap>
            )}
            {!filmSummary && gRuntime && (
              <FieldTap field="runtime" onField={onField}>
                <FieldGhost text="RUNTIME" width={110} height={30} surface="paper" />
              </FieldTap>
            )}
            {ratingVisible && (
              <FieldTap field="rating" onField={onField}>
                <span style={{ fontWeight: 800, fontSize: 34, fontFamily: FONT_SANS, letterSpacing: 0.5, color: accent }}>★ {d.rating.toFixed(1)}</span>
              </FieldTap>
            )}
            {!ratingVisible && gRating && (
              <FieldTap field="rating" onField={onField}>
                <FieldGhost text="★" width={64} height={38} surface="paper" />
              </FieldTap>
            )}
          </div>
        </div>

        <div style={{ height: 2, background: PAPER_DEEP, marginBottom: 6 }} />
        <div style={{ height: 1, background: PAPER_DEEP, opacity: 0.5 }} />

        {/* Film chunk — title, original title, cast, release */}
        <div style={{ marginTop: 24 }}>
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontWeight: 900, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.0, letterSpacing: -1.5, paddingBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {titleVal}
              </div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}>
              <FieldGhost text="TITLE" width="60%" height={72} size={2} surface="paper" />
            </FieldTap>
          ) : null}
          {titleOgVal ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ marginTop: 12, ...italicLabel(PAPER_DEEP, 30), opacity: 0.62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {titleOgVal}
              </div>
            </FieldTap>
          ) : gTitleOg ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ marginTop: 12 }}>
                <FieldGhost text="ORIGINAL TITLE" width={280} height={32} surface="paper" />
              </div>
            </FieldTap>
          ) : null}
        </div>

        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20 }}>
              <span style={{ ...italicLabel(accent, 26), marginRight: 12 }}>avec</span>
              <span style={{ fontWeight: 500, fontSize: 34, fontFamily: FONT_KR, letterSpacing: -0.2, lineHeight: 1.25 }}>{actorsVal}</span>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...italicLabel(accent, 26) }}>avec</span>
              <FieldGhost text="CAST" width={280} height={40} surface="paper" />
            </div>
          </FieldTap>
        ) : null}

        {release.hasAny && (
          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, color: PAPER_DIM, ...(release.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10 } : null) }}>
            {release.node}
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
                {c.value ? (
                  <FieldTap field={c.valueField} onField={onField}>
                    <div style={{ fontWeight: 800, fontSize: 42, fontFamily: FONT_SANS, letterSpacing: -0.5, lineHeight: 1.05, color: PAPER_DEEP, maxWidth: 440, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.value}
                    </div>
                  </FieldTap>
                ) : c.valueGhost ? (
                  <FieldTap field={c.valueField} onField={onField}>
                    <FieldGhost text={c.valueGhostLabel} width={220} height={46} surface="paper" />
                  </FieldTap>
                ) : null}
                {c.sub ? (
                  <FieldTap field={c.subField!} onField={onField}>
                    <div style={{ marginTop: 6, fontWeight: 600, fontSize: 26, fontFamily: FONT_SANS, letterSpacing: -0.2, color: PAPER_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.sub}
                    </div>
                  </FieldTap>
                ) : c.subGhost ? (
                  <FieldTap field={c.subField!} onField={onField}>
                    <div style={{ marginTop: 6 }}>
                      <FieldGhost text={c.subGhostLabel} width={130} height={30} surface="paper" />
                    </div>
                  </FieldTap>
                ) : null}
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
            {signatureVal ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12, marginBottom: 5 }}>
                  <span style={{ ...italicLabel(accent, 28), flexShrink: 0 }}>par</span>
                  <span style={{ fontWeight: 500, fontSize: 34, fontFamily: FONT_KR, color: PAPER_DEEP, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                    {signatureVal}
                  </span>
                </div>
              </FieldTap>
            ) : gSignature ? (
              <FieldTap field="signature" onField={onField}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 5 }}>
                  <span style={{ ...italicLabel(accent, 28), flexShrink: 0 }}>par</span>
                  <FieldGhost text="SIGNATURE" width={200} height={36} surface="paper" />
                </div>
              </FieldTap>
            ) : null}
            <div style={{ ...italicLabel(PAPER_DIM, 26) }}>non-transférable</div>
          </div>
        </div>

        {/* Notch (#000 matches captureToImage backgroundColor) */}
        <div style={{ position: 'absolute', right: -28, top: 960 / 2 - 28, width: 56, height: 56, borderRadius: '50%', background: '#000000', zIndex: 10 }} />
      </div>

      {/* C: Stub — 세로형 tear-off. 가로 행 하나를 -90° 회전 → admis·영화관(먼저)·포맷·바코드·티켓번호가
          strip 방향으로 선다. 컴포넌트 크기를 맞추고 바코드를 길게 빼 공간을 채운다. */}
      <div style={{ flex: `0 0 ${STUB_W}px`, position: 'relative', background: PAPER, borderLeft: `1px solid ${PAPER_DEEP}`, overflow: 'hidden', opacity: componentOpacity }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER_DEEP} background="transparent" />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* DOM 좌→우 = 회전 후 아래→위. 맨 오른쪽(admis)이 위, 맨 왼쪽(티켓번호)이 아래.
              영화관(체인)이 포맷보다 위(=먼저)에 오도록 그룹 내 순서는 format→chain. */}
          <div style={{ transform: 'rotate(-90deg)', display: 'flex', alignItems: 'center', gap: 34, whiteSpace: 'nowrap' }}>
            {(fv?.bookingNo ?? true) && (
              <FieldTap field="bookingNo" onField={onField}>
                <span style={{ fontWeight: 700, fontSize: 22, fontFamily: FONT_MONO, letterSpacing: 2, color: PAPER_DEEP }}>No. {bookingNo}</span>
              </FieldTap>
            )}
            {(fv?.bookingNo ?? true) && (
              <FieldTap field="bookingNo" onField={onField}>
                <Barcode value={bookingNo} color={PAPER_DEEP} orientation="horizontal" width={336} height={58} showText={false} />
              </FieldTap>
            )}
            {stubHasStamp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <FieldTap field="format" onField={onField}>
                  <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.75} ghost={ghost} />
                </FieldTap>
                {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 34, background: PAPER_DEEP, opacity: 0.3 }} />}
                <FieldTap field="chain" onField={onField}>
                  <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={48} ghost={ghost} />
                </FieldTap>
              </div>
            )}
            <span style={{ ...italicLabel(accent, 40) }}>admis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
