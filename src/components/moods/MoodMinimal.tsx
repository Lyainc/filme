import { CSSProperties } from 'react';
import {
  Barcode,
  ChainStamp,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  compactDate,
  isInkLight,
  pickTitleSize,
  resolveBookingNo,
} from './_shared';

const metaLabelStyle = (ink: string): CSSProperties => ({
  font: `700 13px ${FONT_MONO}`,
  letterSpacing: 2.8,
  textTransform: 'uppercase',
  color: ink,
  opacity: 0.55,
  whiteSpace: 'nowrap',
});

const metaValueStyle = (ink: string): CSSProperties => ({
  fontWeight: 700,
  fontSize: 22,
  fontFamily: FONT_SANS,
  letterSpacing: -0.2,
  color: ink,
  lineHeight: 1.25,
});

export function MoodMinimal({ movieInfo: d, components, croppedImageUrl }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const isLight = isInkLight(themeColor);
  const ink = isLight ? '#0d0c0a' : themeColor;
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [110, 88, 70, 58]);

  const scrimGrad = isLight
    ? 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,240,232,0.85) 35%, rgba(245,240,232,0.98) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 35%, rgba(0,0,0,0.92) 100%)';
  const topPanelBg = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.55)';

  const bookingNo = resolveBookingNo(d);
  const watchDateClean = compactDate(d.watchDate);

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
        <ChainStamp chain={components.chain} size={1.25} />
        <div
          style={{
            font: `700 22px ${FONT_MONO}`,
            letterSpacing: 2.5,
            color: ink,
            textAlign: 'right',
          }}
        >
          {watchDateClean}
          {d.watchTime && (
            <>
              <br />
              <span style={{ opacity: 0.6, fontSize: 18 }}>{d.watchTime}</span>
            </>
          )}
        </div>
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
        {d.titleOg && (
          <div
            style={{
              font: `700 24px ${FONT_SANS}`,
              letterSpacing: 4,
              textTransform: 'uppercase',
              opacity: 0.78,
              marginBottom: 18,
            }}
          >
            {d.titleOg}
          </div>
        )}

        {d.title && (
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
            {d.title}
          </div>
        )}

        <div style={{ height: 2, background: ink, opacity: 0.45, marginBottom: 22 }} />

        {d.actors && (
          <div
            style={{
              fontWeight: 500,
              fontSize: 22,
              fontFamily: FONT_KR,
              opacity: 0.78,
              marginBottom: 16,
              letterSpacing: 0.2,
              lineHeight: 1.35,
            }}
          >
            <span
              style={{
                font: `700 14px ${FONT_SANS}`,
                letterSpacing: 2.5,
                opacity: 0.55,
                marginRight: 12,
                verticalAlign: '1px',
              }}
            >
              CAST
            </span>
            {d.actors}
          </div>
        )}

        {d.releaseDate && (
          <div
            style={{
              font: `600 16px ${FONT_MONO}`,
              letterSpacing: 2,
              opacity: 0.55,
              marginBottom: 30,
            }}
          >
            RELEASED · {d.releaseDate}
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
            <div style={metaLabelStyle(ink)}>관람일</div>
            <div style={metaValueStyle(ink)}>
              {watchDateClean}{' '}
              {d.watchTime && <span style={{ opacity: 0.6 }}>{d.watchTime}</span>}
            </div>
            <div style={metaLabelStyle(ink)}>상영관</div>
            <div style={metaValueStyle(ink)}>
              {d.theater}
              {d.screen ? ` · ${d.screen}` : ''}
            </div>

            {d.seat && (
              <>
                <div style={metaLabelStyle(ink)}>좌석</div>
                <div style={metaValueStyle(ink)}>{d.seat}</div>
              </>
            )}
            {d.runtime && (
              <>
                <div style={metaLabelStyle(ink)}>러닝타임</div>
                <div style={metaValueStyle(ink)}>
                  {d.runtime}
                  {d.audienceCert ? `  ·  ${d.audienceCert}+` : ''}
                </div>
              </>
            )}

            {d.showRating && d.rating > 0 && (
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
            {components.format && <FormatStamp format={components.format} size={0.9} />}
            <Barcode value={bookingNo} color={ink} width={180} height={34} textSize={10} />
          </div>
        </div>
      </div>
    </div>
  );
}
