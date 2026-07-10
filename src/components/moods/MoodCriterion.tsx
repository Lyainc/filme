import { CSSProperties, memo } from 'react';
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
  Poster,
  fieldPieces,
  fitFontSizeToWidth,
  gate,
  isInkDark,
  posterTapProps,
  resolveInk,
  resolveTicketData,
  showFieldGhost,
  stampWillRender,
  truncateActors,
  useFontsReady,
} from './_shared';

// 하단 caps 메타 그리드(관람·영화 청킹)의 라벨/값 스타일. 인라인 리터럴에서 추출해 VENUE 분해 셀·
// screeningRows·filmRows가 한 소스를 공유한다 — 값 스타일이 어긋나면 데스크톱 바이트가 깨지므로 단일화.
const metaLabel: CSSProperties = { fontWeight: 700, fontSize: 20, fontFamily: FONT_MONO, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.74 };
const metaValue: CSSProperties = { fontWeight: 700, fontSize: 30, fontFamily: FONT_SANS, letterSpacing: -0.2, opacity: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/**
 * v5 — 마스터 시안 Ticket Design Master.dc.html v2(2026-07-08 resync) 재동기화(에픽 #281).
 * 마스터 델타: 스파인 폭 96→150·패딩 재조정·원제 34→40·바코드 46×430→66×440, 타이틀 pickTitleSize
 * 스케일 폐기→고정 58/lh1.14, 하단 필름 셀에 RUNTIME 추가(RATED·RUNTIME·RELEASED·RE-RELEASED),
 * 메타 라벨/값·푸터 타이포 리스케일. watchTime은 마스터에 독립 TIME 셀이 없어 미렌더 유지.
 *
 * v4 — 컬렉션 임프린트. 좌측 스파인 + 중앙 카탈로그 제목 블록.
 * 리뷰 반영: 가짜 넘버링(No.0315) 전면 제거(앱에 넘버링 기능 없음), 어색한 "THE FILME COLLECTION"
 * 대신 스파인을 원제(titleOg)·연도의 진짜 DVD 스파인처럼 구성, 중앙 eyebrow는 "from a film diary"로
 * 교체, 서명에 'collected by' 라벨, FILME에 phototicket 컨텍스트. 데이터=Pretendard, 장식=Instrument Serif.
 */
export const MoodCriterion = memo(function MoodCriterion({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, ghost, onField, onPosterTap }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const inkIsDark = isInkDark(themeColor);
  const ink = resolveInk(themeColor, inkIsDark ? '#0d0c0a' : '#FFFFFF');

  const globalScrim = inkIsDark
    ? 'linear-gradient(180deg, rgba(245,240,232,0.7) 0%, rgba(245,240,232,0.34) 30%, rgba(245,240,232,0.5) 60%, rgba(245,240,232,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.46) 60%, rgba(0,0,0,0.93) 100%)';
  const spineBg = inkIsDark ? 'rgba(245,240,232,0.95)' : 'rgba(0,0,0,0.74)';
  const spineDivider = inkIsDark ? '#0d0c0a' : ink;
  const stampSurface = inkIsDark ? 'paper' : 'dark';

  const { bookingNo, watchDateClean, releaseClean, reissueClean, watchYear } = resolveTicketData(d);

  const titleVal       = gate(fv?.title, d.title);
  // 타이틀 폭 맞춤(#318) — 마스터 v2 기본값 58/800·lh1.14·ls-1.5는 maxSize로 유지하고, 제목
  // 블록 가용폭(960 - left200 - right64)을 넘는 긴 제목만 이진탐색으로 축소한다. 3줄 클램프라
  // 가용폭×3을 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소한다(_shared.tsx 참고).
  const fontsReady     = useFontsReady();
  const titleSize      = fitFontSizeToWidth(titleVal, 696 * 3, { fontFamily: FONT_KR, fontWeight: 800, minSize: 36, maxSize: 58 }, fontsReady);
  const titleOgVal     = gate(fv?.titleOg, d.titleOg);
  const actorsVal      = truncateActors(gate(fv?.actors, d.actors));
  const watchDateVal   = gate(fv?.watchDate, watchDateClean);
  const theaterVal     = gate(fv?.theater, d.theater);
  const screenVal      = gate(fv?.screen, d.screen);
  const seatVal        = gate(fv?.seat, d.seat);
  const runtimeVal     = gate(fv?.runtime, d.runtime);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal     = gate(fv?.reissue, reissueClean);
  const signatureVal   = gate(fv?.signature, d.signature);
  const ratingVisible  = (fv?.rating ?? true) && d.rating > 0;

  // 빈 항목 미리보기(#216) — 아톰 슬롯 판정. 셀 행은 아래에서 개별 게이팅.
  const ghostOn = ghost === true;
  const gTitle     = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg   = showFieldGhost(fv?.titleOg, d.titleOg, ghost);
  const gActors    = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTheater   = showFieldGhost(fv?.theater, d.theater, ghost);
  const gScreen    = showFieldGhost(fv?.screen, d.screen, ghost);
  const gSeat      = showFieldGhost(fv?.seat, d.seat, ghost);

  // 스파인 임프린트 — 넘버링 없이 원제(없으면 제목)로 진짜 카탈로그 스파인처럼.
  const spineText = titleOgVal || titleVal;

  // mono 캡스 메타 — 값이 있거나 ghost 행일 때만. ghost 행은 값이 비었고 기여 필드가 visible일 때.
  const ratingText = ratingVisible ? `★ ${d.rating.toFixed(1)} / 5.0` : '';
  // VENUE 셀 분해(#266 PR-D) — 극장·상영관·좌석을 시각은 Criterion 고유 sep('  ·  ')로 붙이되 각각
  // 독립 FieldTap + 개별 ghost. sep·stampSurface를 조각에 물려 픽셀 보존, 바깥 셀 FieldTap을 없애
  // 조각을 형제로 배치(이중 중첩 stopPropagation 삼킴 회피).
  const venueCell = fieldPieces(
    [
      { field: 'theater', value: theaterVal, ghost: gTheater, label: 'THEATER' },
      { field: 'screen', value: screenVal, ghost: gScreen, label: 'SCREEN' },
      { field: 'seat', value: seatVal, ghost: gSeat, label: 'SEAT' },
    ],
    onField,
    { sep: '  ·  ', surface: stampSurface }
  );
  type Row = { label: string; value?: string; ghost?: boolean; field: SheetTarget };
  const screeningRows = ([
    { label: 'WATCHED', value: watchDateVal, ghost: ghostOn && !watchDateVal && fv?.watchDate !== false, field: 'watchDate' },
  ] as Row[]).filter(r => r.value || r.ghost);
  const hasScreening = venueCell.hasAny || screeningRows.length > 0;
  // 마스터 v2 필름 셀 순서: RATED · RUNTIME · RELEASED · RE-RELEASED.
  const filmRows = ([
    { label: 'RATED', value: ratingText, ghost: ghostOn && !ratingText && fv?.rating !== false, field: 'rating' },
    { label: 'RUNTIME', value: runtimeVal, ghost: ghostOn && !runtimeVal && fv?.runtime !== false, field: 'runtime' },
    { label: 'RELEASED', value: releaseDateVal, ghost: ghostOn && !releaseDateVal && fv?.releaseDate !== false, field: 'releaseDate' },
    // RE-RELEASED는 releaseDate로 매핑 — reissue는 FIELD_SHEET_TYPE에 없어 단독 타깃이면 빈 시트가 열린다
    // (재개봉일 편집은 releaseDate 시트의 재개봉 토글 안, 35mm/Editorial과 정렬).
    { label: 'RE-RELEASED', value: reissueVal, ghost: ghostOn && !reissueVal && !!d.isReissue && fv?.reissue !== false, field: 'releaseDate' },
  ] as Row[]).filter(r => r.value || r.ghost);

  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, color: ink, fontFamily: FONT_SANS, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
      <Poster src={croppedImageUrl} texture={components.texture} posterOpacity={components.posterOpacity} />

      {/* #219 componentOpacity: 포스터를 뺀 오버레이 전체를 함께 페이드. 자식이 전부 position:absolute라
          inset:0 래퍼가 루트를 채워 opacity 1에서 좌표·페인트 순서 동일(no-op). */}
      <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
      <div style={{ position: 'absolute', inset: 0, background: globalScrim, pointerEvents: 'none' }} />

      {/* Spine band — DVD 스파인 임프린트(원제 + 연도), 넘버링 제거 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 150, background: spineBg, borderRight: `1px solid ${spineDivider}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0 52px', color: ink }}>
        {spineText && (
          // 원제(라틴)면 디스플레이 세리프, 원제 없어 한글 제목이 올라오면 FONT_KR로 — FONT_DISPLAY는
          // 한글 글리프가 없어 시스템 세리프로 어긋난다(_shared FONT_DISPLAY 경고, #205 리뷰 P1).
          <FieldTap field={titleOgVal ? 'titleOg' : 'title'} onField={onField}>
            <div style={{ fontFamily: titleOgVal ? FONT_DISPLAY : FONT_KR, fontStyle: 'italic', fontWeight: 400, fontSize: 40, letterSpacing: 0.5, writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', maxHeight: 600, overflow: 'hidden' }}>
              {spineText}
            </div>
          </FieldTap>
        )}
        <div style={{ flex: 1 }} />
        {(fv?.bookingNo ?? true) && (
          <FieldTap field="bookingNo" onField={onField}>
            <Barcode value={bookingNo} color={ink} orientation="vertical" width={66} height={440} showText={false} />
          </FieldTap>
        )}
        <div style={{ flex: 1 }} />
        {(fv?.watchDate ?? true) && watchYear && (
          <FieldTap field="watchDate" onField={onField}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 66, letterSpacing: 1, writingMode: 'vertical-rl', lineHeight: 1 }}>
              {watchYear}
            </div>
          </FieldTap>
        )}
      </div>

      {/* Top-right paired stamps */}
      <div style={{ position: 'absolute', right: 52, top: 48, display: 'flex', alignItems: 'center', gap: 28 }}>
        <FieldTap field="chain" onField={onField}>
          <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} height={50} surface={stampSurface} ghost={ghost} />
        </FieldTap>
        {stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) && stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost) && <span style={{ width: 1, height: 30, background: ink, opacity: 0.55 }} />}
        <FieldTap field="format" onField={onField}>
          <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={0.9} surface={stampSurface} ghost={ghost} />
        </FieldTap>
      </div>

      {/* Title block — catalog double-rule frame */}
      <div style={{ position: 'absolute', left: 200, right: 64, top: '42%', transform: 'translateY(-42%)' }}>
        <div style={{ height: 1, background: ink, opacity: 0.6, marginBottom: 4 }} />
        <div style={{ height: 3, background: ink, opacity: 0.6, marginBottom: 22 }} />

        <div style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 32, opacity: 0.8, marginBottom: 18, letterSpacing: 0.3 }}>
          from a film diary
        </div>

        {titleVal ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ fontWeight: 800, fontSize: titleSize, fontFamily: FONT_KR, lineHeight: 1.14, letterSpacing: -1.5, marginBottom: 18, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {titleVal}
            </div>
          </FieldTap>
        ) : gTitle ? (
          <FieldTap field="title" onField={onField}>
            <div style={{ marginBottom: 18 }}>
              <FieldGhost text="TITLE" width="66%" height={72} size={2} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}
        {titleOgVal ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ fontWeight: 500, fontSize: 29, fontFamily: FONT_SANS, letterSpacing: 1, opacity: 0.82, marginBottom: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleOgVal}
            </div>
          </FieldTap>
        ) : gTitleOg ? (
          <FieldTap field="titleOg" onField={onField}>
            <div style={{ marginBottom: 18 }}>
              <FieldGhost text="ORIGINAL TITLE" width={280} height={32} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}
        {actorsVal ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 22, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 29, opacity: 0.85, marginRight: 12 }}>featuring</span>
              <span style={{ fontWeight: 500, fontSize: 31, fontFamily: FONT_KR, opacity: 0.95 }}>{actorsVal}</span>
            </div>
          </FieldTap>
        ) : gActors ? (
          <FieldTap field="actors" onField={onField}>
            <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 29, opacity: 0.85 }}>featuring</span>
              <FieldGhost text="CAST" width={260} height={36} surface={stampSurface} />
            </div>
          </FieldTap>
        ) : null}

        <div style={{ height: 3, background: ink, opacity: 0.6, marginBottom: 4 }} />
        <div style={{ height: 1, background: ink, opacity: 0.6 }} />
      </div>

      {/* Bottom caps block — 관람/영화 청킹, 값은 Pretendard로 통일 */}
      <div style={{ position: 'absolute', left: 200, right: 64, bottom: 52 }}>
        {hasScreening && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 26, rowGap: 14, alignItems: 'baseline' }}>
            {venueCell.hasAny && (
              <>
                {/* VENUE 라벨은 비인터랙티브(바깥 FieldTap 제거) — 값의 theater·screen·seat 조각이 각자
                    제 FieldTap을 달아 탭 타깃을 연다. 실값+ghost 혼합 시에만 flex로 한 줄 정렬(#268 P1). */}
                <div style={metaLabel}>VENUE</div>
                <div style={{ ...metaValue, ...(venueCell.hasGhost ? { display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'normal' } : null) }}>
                  {venueCell.node}
                </div>
              </>
            )}
            {screeningRows.map((r, i) => (
              <FieldTap key={i} field={r.field} onField={onField}>
                <div style={metaLabel}>{r.label}</div>
                {r.ghost
                  ? <FieldGhost width={180} height={32} surface={stampSurface} />
                  : <div style={metaValue}>{r.value}</div>}
              </FieldTap>
            ))}
          </div>
        )}
        {hasScreening && filmRows.length > 0 && (
          <div style={{ height: 1, background: ink, opacity: 0.2, margin: '16px 0' }} />
        )}
        {filmRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 26, rowGap: 14, alignItems: 'baseline' }}>
            {filmRows.map((r, i) => (
              <FieldTap key={i} field={r.field} onField={onField}>
                <div style={metaLabel}>{r.label}</div>
                {r.ghost
                  ? <FieldGhost width={180} height={32} surface={stampSurface} />
                  : <div style={metaValue}>{r.value}</div>}
              </FieldTap>
            ))}
          </div>
        )}
        {/* 서명(라벨) + 작은 워터마크(made with FILME) */}
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, opacity: 0.72 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: ink }}>made with</span>
            <span style={{ fontWeight: 800, fontSize: 22, fontFamily: FONT_SANS, letterSpacing: 3, color: ink }}>FILME</span>
          </div>
          {signatureVal ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ textAlign: 'right', maxWidth: 560, minWidth: 0 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 25, opacity: 0.78, color: ink, marginRight: 10 }}>collected by</span>
                <span style={{ fontWeight: 600, fontSize: 32, fontFamily: FONT_KR, color: ink, letterSpacing: -0.2 }}>{signatureVal}</span>
              </div>
            </FieldTap>
          ) : gSignature ? (
            <FieldTap field="signature" onField={onField}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: 25, opacity: 0.78, color: ink }}>collected by</span>
                <FieldGhost text="SIGNATURE" width={200} height={34} surface={stampSurface} />
              </div>
            </FieldTap>
          ) : null}
        </div>
      </div>
      </div>
    </div>
  );
});
