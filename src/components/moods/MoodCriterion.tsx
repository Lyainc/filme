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
  isInkLight,
  pickTitleSize,
  resolveBookingNo,
  resolveSerialNo,
} from './_shared';
import { formatDate } from '@/utils/dateFormat';

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
  const serialNo = resolveSerialNo(d);
  const bookingTail = bookingNo.split('-').pop() || '0000';
  const watchYear = d.watchDate ? (d.watchDate.match(/\d{4}/) || [''])[0] : '';
  const watchToken = d.watchDateFormat || 'kr-compact';
  const releaseToken = d.releaseDateFormat || 'kr-compact';
  const releaseGran = d.releaseDateGranularity || 'date';
  const watchDateClean = formatDate(d.watchDate, watchToken, 'date');
  const releaseClean = formatDate(d.releaseDate, releaseToken, releaseGran);
  const reissueClean = d.isReissue ? formatDate(d.reissueDate, releaseToken, releaseGran) : '';

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
        {watchYear && (
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
        <ChainStamp chain={components.chain} size={1.05} />
        {components.format && (
          <>
            <span style={{ width: 1, height: 26, background: ink, opacity: 0.6 }} />
            <FormatStamp format={components.format} size={0.78} />
          </>
        )}
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

        {d.titleOg && (
          <div
            style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 36,
              fontFamily: FONT_SANS,
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
              fontWeight: 800,
              fontSize: titleSize,
              fontFamily: FONT_KR,
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
              fontStyle: 'italic',
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
            with {d.actors}
          </div>
        )}

        <div style={{ height: 2, background: ink, opacity: 0.6 }} />
      </div>

      {/* Bottom caps row */}
      <div style={{ position: 'absolute', left: 116, right: 56, bottom: 56 }}>
        {d.showRating && d.rating > 0 && (
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
            d.theater,
            d.screen,
            d.seat && `SEAT ${d.seat}`,
            watchDateClean,
            releaseClean && `REL ${releaseClean}`,
            reissueClean && `RE-REL ${reissueClean}`,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
        <div style={{ marginTop: 16, opacity: 0.85 }}>
          <EditionMark
            serialNo={serialNo}
            collectionNo={d.collectionNo}
            surface={isLight ? 'paper' : 'dark'}
            ink={ink}
            size={14}
            letterSpacing={3}
          />
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
