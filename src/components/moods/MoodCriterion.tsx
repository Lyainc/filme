import {
  Barcode,
  ChainStamp,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FONT_SERIF,
  FormatStamp,
  MoodProps,
  Poster,
  compactDate,
  isInkLight,
  pickTitleSize,
  resolveBookingNo,
} from './_shared';

export function MoodCriterion({ movieInfo: d, components, croppedImageUrl }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const isLight = isInkLight(themeColor);
  const ink = isLight ? '#0d0c0a' : themeColor;
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [120, 96, 72, 56]);

  const globalScrim = isLight
    ? 'linear-gradient(180deg, rgba(245,240,232,0.7) 0%, rgba(245,240,232,0.35) 30%, rgba(245,240,232,0.5) 60%, rgba(245,240,232,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.92) 100%)';
  const spineBg = isLight ? 'rgba(245,240,232,0.95)' : 'rgba(0,0,0,0.7)';
  const spineDivider = isLight ? '#0d0c0a' : ink;

  const bookingNo = resolveBookingNo(d);
  const bookingTail = bookingNo.split('-').pop() || '0000';
  const watchYear = (d.watchDate.match(/\d{4}/) || [String(new Date().getFullYear())])[0];

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
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: globalScrim,
          pointerEvents: 'none',
        }}
      />

      {/* Spine band — full height left edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 86,
          background: spineBg,
          borderRight: `2px solid ${spineDivider}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 0',
          color: ink,
        }}
      >
        <div
          style={{
            font: `800 16px ${FONT_MONO}`,
            letterSpacing: 3,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          PHOTOTICKET · No.{bookingTail}
        </div>
        <div style={{ flex: 1 }} />
        <Barcode
          value={bookingNo}
          color={ink}
          orientation="vertical"
          width={40}
          height={500}
          showText={false}
        />
        <div style={{ flex: 1 }} />
        <div
          style={{
            font: `900 22px ${FONT_SANS}`,
            letterSpacing: 3,
            writingMode: 'vertical-rl',
          }}
        >
          {watchYear}
        </div>
      </div>

      {/* Top-right paired stamps */}
      <div
        style={{
          position: 'absolute',
          right: 48,
          top: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background: spineBg,
          padding: '10px 16px',
        }}
      >
        <ChainStamp chain={components.chain} size={1.05} />
        {components.format && (
          <>
            <span style={{ width: 1, height: 26, background: ink, opacity: 0.6 }} />
            <FormatStamp format={components.format} color={ink} size={0.78} framed />
          </>
        )}
      </div>

      {/* Tag top-left */}
      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 56,
          font: `700 15px ${FONT_MONO}`,
          letterSpacing: 3,
          opacity: 0.85,
        }}
      >
        — A FILM RECORD {d.audienceCert ? `/ ${d.audienceCert}+` : ''}
      </div>

      {/* Title block */}
      <div
        style={{
          position: 'absolute',
          left: 116,
          right: 56,
          top: '40%',
          transform: 'translateY(-40%)',
        }}
      >
        <div style={{ height: 2, background: ink, opacity: 0.6, marginBottom: 28 }} />

        {d.titleOg && (
          <div
            style={{
              font: `italic 400 36px ${FONT_SERIF}`,
              letterSpacing: 1,
              opacity: 0.92,
              marginBottom: 16,
            }}
          >
            {d.titleOg}
          </div>
        )}

        {d.title && (
          <div
            style={{
              font: `800 ${titleSize}px ${FONT_KR}`,
              lineHeight: 1.0,
              letterSpacing: titleLen > 8 ? -1.5 : 1,
              marginBottom: 28,
            }}
          >
            {d.title}
          </div>
        )}

        {d.actors && (
          <div
            style={{
              font: `italic 500 22px ${FONT_SERIF}`,
              opacity: 0.85,
              marginBottom: 24,
              lineHeight: 1.4,
            }}
          >
            with {d.actors}
          </div>
        )}

        <div style={{ height: 2, background: ink, opacity: 0.6 }} />
      </div>

      {/* Bottom caps row */}
      <div style={{ position: 'absolute', left: 116, right: 200, bottom: 56 }}>
        {d.showRating && d.rating > 0 && (
          <div
            style={{
              font: `800 22px ${FONT_MONO}`,
              letterSpacing: 2.5,
              marginBottom: 18,
            }}
          >
            ★ {d.rating.toFixed(1)} / 5.0
          </div>
        )}
        <div
          style={{
            font: `700 17px ${FONT_MONO}`,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            opacity: 0.95,
            lineHeight: 1.7,
          }}
        >
          {[
            d.theater,
            d.screen,
            d.seat && `SEAT ${d.seat}`,
            compactDate(d.watchDate),
            d.releaseDate && `REL ${compactDate(d.releaseDate)}`,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      </div>

      {/* ADMIT ONE medallion bottom-right */}
      <div
        style={{
          position: 'absolute',
          right: 48,
          bottom: 48,
          width: 140,
          height: 140,
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <path
              id="rim-criterion"
              d="M 70 70 m -56 0 a 56 56 0 1 1 112 0 a 56 56 0 1 1 -112 0"
              fill="none"
            />
          </defs>
          <circle cx="70" cy="70" r="64" fill="none" stroke={ink} strokeWidth="1.5" opacity="0.85" />
          <circle cx="70" cy="70" r="56" fill="none" stroke={ink} strokeWidth="1" opacity="0.55" />
          <circle
            cx="70"
            cy="70"
            r="40"
            fill="none"
            stroke={ink}
            strokeWidth="1"
            opacity="0.55"
            strokeDasharray="2 4"
          />
          <text
            style={{
              font: `700 9px ${FONT_MONO}`,
              letterSpacing: 4,
              fill: ink,
              opacity: 0.85,
            }}
          >
            <textPath href="#rim-criterion" startOffset="0">
              · ADMIT ONE · NON-TRANSFERABLE · {bookingNo} · CRITERION IMPRINT
            </textPath>
          </text>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: ink,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              font: `600 9px ${FONT_MONO}`,
              letterSpacing: 2,
              opacity: 0.7,
            }}
          >
            No.
          </div>
          <div
            style={{
              font: `900 26px ${FONT_SANS}`,
              letterSpacing: -0.5,
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {bookingTail}
          </div>
          <div
            style={{
              font: `italic 400 13px ${FONT_SERIF}`,
              opacity: 0.85,
              marginTop: 4,
            }}
          >
            imprint
          </div>
        </div>
      </div>

      {/* Pt monogram top-left */}
      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 110,
          width: 38,
          height: 38,
          border: `1.5px solid ${ink}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: `italic 900 16px ${FONT_SERIF}`,
          color: ink,
          opacity: 0.85,
          letterSpacing: -0.5,
        }}
      >
        Pt
      </div>
    </div>
  );
}
