import { CSSProperties } from 'react';
import {
  Barcode,
  ChainStamp,
  EditionMark,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  gate,
  isInkLight,
  pickTitleSize,
  resolveBookingNo,
  resolveSerialNo,
  truncateActors,
} from './_shared';
import { formatDate } from '@/utils/dateFormat';

const metaLabelStyle = (ink: string): CSSProperties => ({
  fontWeight: 700,
  fontSize: 13,
  fontFamily: FONT_MONO,
  letterSpacing: 2.8,
  textTransform: 'uppercase',
  color: ink,
  opacity: 0.55,
  whiteSpace: 'nowrap',
});

const metaValueStyle = (ink: string): CSSProperties => ({
  fontWeight: 700,
  fontSize: 23,
  fontFamily: FONT_SANS,
  letterSpacing: -0.2,
  color: ink,
  lineHeight: 1.25,
});

export function MoodMinimal({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const isLight = isInkLight(themeColor);
  const ink = isLight ? '#0d0c0a' : themeColor;
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [96, 78, 62, 50]);

  const scrimGrad = isLight
    ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,240,232,0.85) 35%, rgba(245,240,232,0.98) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 35%, rgba(0,0,0,0.92) 100%)';
  const topPanelBg = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.55)';

  const bookingNo = resolveBookingNo(d);
  const serialNo = resolveSerialNo(d);
  const watchToken = d.watchDateFormat || 'kr-compact';
  const releaseToken = d.releaseDateFormat || 'kr-compact';
  const releaseGran = d.releaseDateGranularity || 'date';
  const watchDateClean = formatDate(d.watchDate, watchToken, 'date');
  const releaseClean = formatDate(d.releaseDate, releaseToken, releaseGran);
  const reissueClean = d.isReissue ? formatDate(d.reissueDate, releaseToken, releaseGran) : '';

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

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        color: ink,
        fontFamily: FONT_SANS,
        overflow: 'hidden',
      }}
    >
      <Poster
        src={croppedImageUrl}
        texture={components.texture}
        posterOpacity={components.posterOpacity}
      />

      {/* Top stamp bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          background: topPanelBg,
          padding: '30px 56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <ChainStamp chain={components.chain} visible={components.chainVisible} size={1.25} />
        {(watchDateVal || watchTimeVal) && (
          <div
            style={{
              fontWeight: 700,
              fontSize: 22,
              fontFamily: FONT_MONO,
              letterSpacing: 2.5,
              color: ink,
              textAlign: 'right',
            }}
          >
            {watchDateVal}
            {watchTimeVal && (
              <>
                {watchDateVal && <br />}
                <span style={{ opacity: 0.6, fontSize: 18 }}>{watchTimeVal}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom scrim */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 760,
          background: scrimGrad,
          pointerEvents: 'none',
        }}
      />

      {/* Bottom block */}
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 56 }}>
        {titleOgVal && (
          <div
            style={{
              fontWeight: 700,
              fontSize: 24,
              fontFamily: FONT_SANS,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.78,
              marginBottom: 18,
            }}
          >
            {titleOgVal}
          </div>
        )}

        {titleVal && (
          <div
            style={{
              fontWeight: titleLen > 12 ? 400 : 300,
              fontSize: titleSize,
              fontFamily: FONT_KR,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              marginBottom: 36,
            }}
          >
            {titleVal}
          </div>
        )}

        <div style={{ height: 2, background: ink, opacity: 0.45, marginBottom: 22 }} />

        {actorsVal && (
          <div
            style={{
              fontWeight: 500,
              fontSize: 22,
              fontFamily: FONT_KR,
              opacity: 0.78,
              marginBottom: 16,
              letterSpacing: 0.2,
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                fontFamily: FONT_SANS,
                letterSpacing: 2.5,
                opacity: 0.55,
                marginRight: 12,
                verticalAlign: '1px',
              }}
            >
              CAST
            </span>
            {actorsVal}
          </div>
        )}

        {(releaseDateVal || reissueVal) && (
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              fontFamily: FONT_MONO,
              letterSpacing: 2,
              opacity: 0.55,
              marginBottom: 30,
            }}
          >
            {releaseDateVal && <>RELEASED · {releaseDateVal}</>}
            {releaseDateVal && reissueVal && <>{'  ·  '}</>}
            {reissueVal && <>RE-RELEASED · {reissueVal}</>}
          </div>
        )}

        {/* Bottom row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            columnGap: 32,
            alignItems: 'end',
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto 1fr',
              columnGap: 24,
              rowGap: 14,
              alignItems: 'baseline',
            }}
          >
            {(watchDateVal || watchTimeVal) && (
              <>
                <div style={metaLabelStyle(ink)}>관람일</div>
                <div style={metaValueStyle(ink)}>
                  {watchDateVal}
                  {watchDateVal && watchTimeVal && ' '}
                  {watchTimeVal && <span style={{ opacity: 0.6 }}>{watchTimeVal}</span>}
                </div>
              </>
            )}
            {(theaterVal || screenVal) && (
              <>
                <div style={metaLabelStyle(ink)}>상영관</div>
                <div style={metaValueStyle(ink)}>
                  {theaterVal}
                  {theaterVal && screenVal ? ` · ${screenVal}` : screenVal || ''}
                </div>
              </>
            )}

            {seatVal && (
              <>
                <div style={metaLabelStyle(ink)}>좌석</div>
                <div style={metaValueStyle(ink)}>{seatVal}</div>
              </>
            )}
            {runtimeVal && (
              <>
                <div style={metaLabelStyle(ink)}>러닝타임</div>
                <div style={metaValueStyle(ink)}>{runtimeVal}</div>
              </>
            )}

            {(fv?.rating ?? true) && d.rating > 0 && (
              <>
                <div style={metaLabelStyle(ink)}>평점</div>
                <div style={{ ...metaValueStyle(ink), gridColumn: 'span 3' }}>
                  ★ {d.rating.toFixed(1)} / 5.0
                </div>
              </>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 14,
            }}
          >
            {components.format && <FormatStamp format={components.format} visible={components.formatVisible} size={1.4} />}
            {(fv?.bookingNo ?? true) && (
              <Barcode value={bookingNo} color={ink} width={180} height={34} textSize={10} />
            )}
            {(fv?.edition ?? true) && (
              <EditionMark
                serialNo={serialNo}
                collectionNo={d.collectionNo}
                surface={isLight ? 'paper' : 'dark'}
                ink={ink}
                size={11}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
