import {
  Barcode,
  ChainStamp,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  gate,
  isInkLight,
  pickTitleSize,
  resolveTicketData,
  truncateActors,
} from './_shared';

export function MoodCriterion({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const isLight = isInkLight(themeColor);
  const ink = isLight ? '#0d0c0a' : themeColor;
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [104, 84, 64, 50]);

  const globalScrim = isLight
    ? 'linear-gradient(180deg, rgba(245,240,232,0.7) 0%, rgba(245,240,232,0.35) 30%, rgba(245,240,232,0.5) 60%, rgba(245,240,232,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.92) 100%)';
  const spineBg = isLight ? 'rgba(245,240,232,0.95)' : 'rgba(0,0,0,0.7)';
  const spineDivider = isLight ? '#0d0c0a' : ink;

  const { bookingNo, watchDateClean, releaseClean, reissueClean, watchYear } = resolveTicketData(d);
  const bookingTail = bookingNo.split('-').pop() || '0000';

  const titleVal       = gate(fv?.title, d.title);
  const titleOgVal     = gate(fv?.titleOg, d.titleOg);
  const actorsVal      = truncateActors(gate(fv?.actors, d.actors));
  const watchDateVal   = gate(fv?.watchDate, watchDateClean);
  const theaterVal     = gate(fv?.theater, d.theater);
  const screenVal      = gate(fv?.screen, d.screen);
  const seatVal        = gate(fv?.seat, d.seat);
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
            fontWeight: 800,
            fontSize: 16,
            fontFamily: FONT_MONO,
            letterSpacing: 3,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
          }}
        >
          PHOTOTICKET{(fv?.bookingNo ?? true) ? ` · No.${bookingTail}` : ''}
        </div>
        <div style={{ flex: 1 }} />
        {(fv?.bookingNo ?? true) && (
          <Barcode
            value={bookingNo}
            color={ink}
            orientation="vertical"
            width={40}
            height={500}
            showText={false}
          />
        )}
        <div style={{ flex: 1 }} />
        {(fv?.watchDate ?? true) && watchYear && (
          <div
            style={{
              fontWeight: 900,
              fontSize: 22,
              fontFamily: FONT_SANS,
              letterSpacing: 3,
              writingMode: 'vertical-rl',
            }}
          >
            {watchYear}
          </div>
        )}
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
        <ChainStamp chain={components.chain} visible={components.chainVisible} size={1.05} />
        {components.chainVisible && components.formatVisible && (
          <span style={{ width: 1, height: 26, background: ink, opacity: 0.6 }} />
        )}
        <FormatStamp format={components.format} visible={components.formatVisible} size={1.0} />
      </div>

      {/* Tag top-left */}
      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 56,
          fontWeight: 700,
          fontSize: 15,
          fontFamily: FONT_MONO,
          letterSpacing: 3,
          opacity: 0.85,
        }}
      >
        — A FILM RECORD
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

        {titleOgVal && (
          <div
            style={{
              fontWeight: 400,
              fontSize: 36,
              fontFamily: FONT_SANS,
              letterSpacing: 1,
              opacity: 0.92,
              marginBottom: 16,
            }}
          >
            {titleOgVal}
          </div>
        )}

        {titleVal && (
          <div
            style={{
              fontWeight: 800,
              fontSize: titleSize,
              fontFamily: FONT_KR,
              lineHeight: 1.0,
              letterSpacing: titleLen > 8 ? -1.5 : 1,
              marginBottom: 28,
            }}
          >
            {titleVal}
          </div>
        )}

        {actorsVal && (
          <div
            style={{
              fontWeight: 500,
              fontSize: 22,
              fontFamily: FONT_KR,
              opacity: 0.85,
              marginBottom: 24,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            with {actorsVal}
          </div>
        )}

        <div style={{ height: 2, background: ink, opacity: 0.6 }} />
      </div>

      {/* Bottom caps row */}
      <div style={{ position: 'absolute', left: 116, right: 56, bottom: 56 }}>
        {(fv?.rating ?? true) && d.rating > 0 && (
          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
              fontFamily: FONT_MONO,
              letterSpacing: 2.5,
              marginBottom: 18,
            }}
          >
            ★ {d.rating.toFixed(1)} / 5.0
          </div>
        )}
        <div
          style={{
            fontWeight: 700,
            fontSize: 17,
            fontFamily: FONT_MONO,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            opacity: 0.95,
            lineHeight: 1.7,
          }}
        >
          {[
            theaterVal,
            screenVal,
            seatVal && `SEAT ${seatVal}`,
            watchDateVal,
            releaseDateVal && `REL ${releaseDateVal}`,
            reissueVal && `RE-REL ${reissueVal}`,
          ]
            .filter(Boolean)
            .join('  ·  ')}
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
          fontStyle: 'italic',
          fontWeight: 900,
          fontSize: 16,
          fontFamily: FONT_SANS,
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
