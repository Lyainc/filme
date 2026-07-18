import { CSSProperties, ReactNode, memo } from 'react';
import type { SheetTarget } from '@/constants/fields';
import {
  ChainStamp,
  FieldGhost,
  FieldTap,
  FONT_DISPLAY,
  FONT_KR,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  MoodWordmark,
  Poster,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  isInkDark,
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
 * Minimal — 미니멀 시네마틱. 포스터 풀블리드 + 하단 스크림. 960×1477 portrait, dark, monochrome.
 * 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 규격에 재동기화(#281):
 * 푸터 바코드·코너 레지스트레이션 마크 제거, 타이포 리스케일, Cast를 "Cast" 라벨 스택 2줄 클램프로.
 * 데이터=Pretendard/Noto, 장식 라벨=Instrument Serif.
 */
const labelSerif = (color: string): CSSProperties => ({
  fontFamily: FONT_DISPLAY,
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 23,
  lineHeight: 1,
  color,
  opacity: 0.82,
  marginBottom: 2,
});

const metaValue: CSSProperties = {
  fontWeight: 600,
  fontSize: 30,
  fontFamily: FONT_SANS,
  letterSpacing: -0.4,
  lineHeight: 1.12,
};

// 병합 셀(node)이면 분해 조각을, 아니면 단일 값/ghost를 렌더하는 공통 메타 셀 형태(#266 PR-C).
type MetaCell = { label: string; field: SheetTarget; value?: string; ghost?: FieldGhostState; node?: ReactNode; hasGhost?: boolean };

// 타이틀 폭 맞춤(#318) — Bottom block 가용폭(960 - left70 - right70). 2줄 클램프라
// maxWidth로 가용폭×2를 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
const TITLE_AVAIL_WIDTH = 820;
const TITLE_CLAMP_LINES = 2;
const TITLE_MAX_SIZE = 62;
const TITLE_MIN_SIZE = 38;

export const MoodMinimal = memo(function MoodMinimal({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const inkIsDark = isInkDark(themeColor);
  const ink = resolveInk(themeColor, inkIsDark ? '#0d0c0a' : '#FFFFFF');
  // 밝은 테마(inkIsDark)에선 topScrim이 크림이라 stamp surface도 paper로 — 'dark' 고정이면
  // DashedPlaceholder가 흰색 테두리·텍스트라 크림 위에서 안 보인다(Criterion 패턴 정렬, #205 리뷰 P1).
  const stampSurface = inkIsDark ? 'paper' : 'dark';

  const scrimGrad = inkIsDark
    ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,240,232,0.82) 28%, rgba(245,240,232,0.97) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 28%, rgba(0,0,0,0.94) 100%)';
  const topScrim = inkIsDark
    ? 'linear-gradient(180deg, rgba(245,240,232,0.9) 0%, rgba(245,240,232,0) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0) 100%)';

  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);

  const titleVal       = gate(fv?.title, d.title);
  const fontsReady      = useFontsReady();
  const titleFontSize  = fitFontSizeToWidth(titleVal, TITLE_AVAIL_WIDTH * TITLE_CLAMP_LINES, { fontFamily: FONT_KR, fontWeight: 500, minSize: TITLE_MIN_SIZE, maxSize: TITLE_MAX_SIZE }, fontsReady);
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

  // 빈 항목 미리보기(#216) — 아톰 슬롯·셀 공통 판정. 노출 off도 dim placeholder로 남아
  // 탭→재노출이 되고 on/off가 시각으로 구분된다(#369) — 이전엔 셀 계열이 fv !== false 인라인
  // 조건이라 숨기면 통째로 사라져 매트릭스가 어긋났다.
  const gTitle       = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg     = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors      = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSignature   = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater     = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen      = showFieldGhost(fv?.screen, d.screen, ghost);
  const gWatchDate   = showFieldGhost(fv?.watchDate, watchDateClean, ghost);
  const gWatchTime   = showFieldGhost(fv?.watchTime, d.watchTime, ghost);
  const gSeat        = showFieldGhost(fv?.seat, d.seat, ghost);
  const gRuntime     = showFieldGhost(fv?.runtime, d.runtime, ghost);
  const gRating      = showFieldGhost(fv?.rating, d.rating > 0, ghost);
  const gReleaseDate = showFieldGhost(fv?.releaseDate, releaseClean, ghost);
  const gReissue     = showFieldGhost(fv?.reissue, reissueClean, ghost);

  // 메타 청킹(#리뷰): 관람(Screening/Venue/Seat) vs 영화(Runtime/Rated/Released)를 분리.
  // 값 폰트는 전부 Pretendard로 통일(숫자·날짜 포함).
  // 병합 셀(Screening=관람일+시간, Venue=극장+상영관)은 fieldPieces로 필드별 독립 조각(값→텍스트,
  // 빈+ghost→라벨 점선)으로 분해한다(#266 PR-C) — 조각이 각자 제 시트를 열고, 데스크톱(onField=undefined)은
  // FieldTap이 통과해 분해 전과 바이트 동일. seat은 단일 필드라 그대로 둔다.
  const screeningCells: MetaCell[] = [];
  const screening = fieldPieces(
    [
      { field: 'watchDate', value: watchDateVal, ghost: gWatchDate, label: 'DATE' },
      { field: 'watchTime', value: watchTimeVal, ghost: gWatchTime, label: 'TIME' },
    ],
    onField,
    { sep: '  ', surface: stampSurface }
  );
  if (screening.hasAny) screeningCells.push({ label: 'Screening', node: screening.node, hasGhost: screening.hasGhost, field: 'watchDate' });
  const venue = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
    ],
    onField,
    { surface: stampSurface }
  );
  if (venue.hasAny) screeningCells.push({ label: 'Venue', node: venue.node, hasGhost: venue.hasGhost, field: 'theater' });
  if (seatVal) screeningCells.push({ label: 'Seat', value: seatVal, field: 'seat' });
  else if (gSeat) screeningCells.push({ label: 'Seat', ghost: gSeat, field: 'seat' });

  // Re-released 셀은 releaseDate로 매핑 — 재개봉일 편집 UI가 releaseDate 시트(재개봉 토글) 안에만
  // 있고 reissue는 FIELD_SHEET_TYPE에 없어 단독 타깃이면 빈 시트가 열린다(35mm/Editorial과 정렬).
  const filmCells: MetaCell[] = [];
  if (runtimeVal) filmCells.push({ label: 'Runtime', value: runtimeVal, field: 'runtime' });
  else if (gRuntime) filmCells.push({ label: 'Runtime', ghost: gRuntime, field: 'runtime' });
  if (ratingVisible) filmCells.push({ label: 'Rated', value: `★ ${d.rating.toFixed(1)}`, field: 'rating' });
  else if (gRating) filmCells.push({ label: 'Rated', ghost: gRating, field: 'rating' });
  if (releaseDateVal) filmCells.push({ label: 'Released', value: releaseDateVal, field: 'releaseDate' });
  else if (gReleaseDate) filmCells.push({ label: 'Released', ghost: gReleaseDate, field: 'releaseDate' });
  if (reissueVal) filmCells.push({ label: 'Re-released', value: reissueVal, field: 'releaseDate' });
  else if (d.isReissue && gReissue) filmCells.push({ label: 'Re-released', ghost: gReissue, field: 'releaseDate' });

  // 스탬프가 실제로 뭔가(이미지/라벨/고스트 placeholder)를 렌더할 때만 상단 스크림+스탬프 블록을
  // 낸다. visible 토글만 보면 로고 미업로드+ghost=false에서 빈 스크림만 남는다(#216 리뷰 P1).
  // ghost=undefined면 stampWillRender가 visible!==false로 붕괴 → 원래 조건과 동일(데스크톱 무손상).
  const hasTopStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);
  const componentOpacity = components.componentOpacity ?? 1;

  // 포스터 fit 정책(#440) — 기본 무손실(contain)+중앙 정렬(#449, 구 top 정렬은 레터박스가
  // 전부 하단에 몰려 상단엔 절대 안 보였다). 배경을 스크림 끝 색조(테마별 크림/검정)와 맞춰
  // 이질감을 줄인다. frameInsetY로 위/아래 블러 레터박스 노출을 20~25px 보장(#449).
  const posterBg = inkIsDark ? '#f5f0e8' : '#0a0a0a';

  return (
    <div style={{ position: 'absolute', inset: 0, color: ink, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      <Poster
        src={croppedImageUrl}
        {...posterFitProps(components.posterFit, { letterboxBg: posterBg, frameInsetY: POSTER_FRAME_INSET_Y })}
        texture={components.texture}
        posterOpacity={components.posterOpacity}
      />

      {/* #219 componentOpacity: 포스터를 뺀 모든 오버레이를 함께 페이드. 자식이 전부 position:absolute라
          inset:0 래퍼가 루트를 그대로 채워 opacity 1에서 좌표·페인트 순서가 동일(no-op). */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>

      {/* Top — chain + format paired (같은 위상이라 인접 배치) */}
      {hasTopStamp && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 160, background: topScrim, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 60, top: 52, display: 'flex', alignItems: 'center', gap: 34 }}>
            <FieldTap field="chain" onField={onField}>
              <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={74} surface={stampSurface} ghost={ghost} />
            </FieldTap>
            {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 38, background: ink, opacity: 0.5 }} />}
            <FieldTap field="format" onField={onField}>
              <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={1.02} surface={stampSurface} ghost={ghost} />
            </FieldTap>
          </div>
        </>
      )}

      {/* Bottom scrim — 마스터 규격 470(v4의 770에서 축소, #281). 콘텐츠가 극단으로 꽉 차면
          상단 텍스트가 스크림 위로 올라올 수 있으나, 기본 포스터 밝기 0.5가 대비를 받쳐주고
          이 값은 마스터 디자인 의도라 유지한다. 스크림 높이 조정은 마스터 개정과 함께 가야 함. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 470, background: scrimGrad, pointerEvents: 'none' }} />

      {/* Bottom block */}
      <div style={{ position: 'absolute', left: 70, right: 70, bottom: 58 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 30, opacity: 0.82, marginBottom: 8, letterSpacing: 0.3 }}>
          now showing
        </div>

        {titleVal ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ fontWeight: 500, fontSize: titleFontSize, fontFamily: FONT_KR, lineHeight: 1.05, letterSpacing: -1.2, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {titleVal}
            </div>
          </FieldTap>
        ) : gTitle ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ marginBottom: 10 }}>
              <FieldGhost text="TITLE" width="66%" height={72} size={2} surface={stampSurface} state={gTitle} />
            </div>
          </FieldTap>
        ) : null}
        {titleOgVal ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ fontWeight: 600, fontSize: 22, fontFamily: FONT_SANS, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.8, marginBottom: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleOgVal}
            </div>
          </FieldTap>
        ) : gTitleOg ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ marginBottom: 20 }}>
              <FieldGhost text="ORIGINAL TITLE" width={280} height={26} surface={stampSurface} state={gTitleOg} />
            </div>
          </FieldTap>
        ) : null}

        <div style={{ height: 1, background: ink, opacity: 0.34, marginBottom: 18 }} />

        {/* Meta — 관람/영화 청킹, 두 행 사이 헤어라인. 값은 Pretendard로 통일 */}
        {(screeningCells.length > 0 || filmCells.length > 0) && (
          <div style={{ marginBottom: 18 }}>
            {screeningCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 44px' }}>
                {screeningCells.map((c, i) => c.node !== undefined ? (
                  <div key={i} style={{ minWidth: 0 }}>
                    <div style={labelSerif(ink)}>{c.label}</div>
                    <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(c.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>{c.node}</div>
                  </div>
                ) : (
                  <FieldTap key={i} field={c.field} onField={onField}>
                    <div style={{ minWidth: 0 }}>
                      <div style={labelSerif(ink)}>{c.label}</div>
                      {c.ghost ? (
                        <FieldGhost width={200} height={40} surface={stampSurface} state={c.ghost} />
                      ) : (
                        <div style={{ ...metaValue, maxWidth: 560, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
                      )}
                    </div>
                  </FieldTap>
                ))}
              </div>
            )}
            {screeningCells.length > 0 && filmCells.length > 0 && (
              <div style={{ height: 1, background: ink, opacity: 0.16, margin: '14px 0' }} />
            )}
            {filmCells.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 44px' }}>
                {filmCells.map((c, i) => (
                  <FieldTap key={i} field={c.field} onField={onField}>
                    <div style={{ minWidth: 0 }}>
                      <div style={labelSerif(ink)}>{c.label}</div>
                      {c.ghost ? (
                        <FieldGhost width={200} height={40} surface={stampSurface} state={c.ghost} />
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

        {/* Cast — "Cast" 라벨 스택 + 값 2줄 클램프(마스터 resync #281) */}
        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 20 }}>
              <div style={labelSerif(ink)}>Cast</div>
              <div style={{ fontWeight: 600, fontSize: 30, fontFamily: FONT_KR, letterSpacing: -0.4, lineHeight: 1.15, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {actorsVal}
              </div>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 20 }}>
              <div style={labelSerif(ink)}>Cast</div>
              <FieldGhost text="CAST" width={260} height={40} surface={stampSurface} state={gActors} />
            </div>
          </FieldTap>
        ) : null}

        {/* Footer — FILME 락업(컨텍스트) / 서명(라벨). 마스터 resync: 푸터 바코드 없음(#281) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.72, minWidth: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: ink }}>made with</span>
            <MoodWordmark size={22} color={ink} />
          </div>
          {signatureVal ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ textAlign: 'right', maxWidth: 440, minWidth: 0 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 25, opacity: 0.78, color: ink, marginRight: 10 }}>collected by</span>
                <span style={{ fontWeight: 600, fontSize: 32, fontFamily: FONT_KR, color: ink, letterSpacing: -0.2 }}>{signatureVal}</span>
              </div>
            </FieldTap>
          ) : gSignature ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 25, opacity: 0.78, color: ink }}>collected by</span>
                <FieldGhost text="SIGNATURE" width={200} height={34} surface={stampSurface} state={gSignature} />
              </div>
            </FieldTap>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
});
