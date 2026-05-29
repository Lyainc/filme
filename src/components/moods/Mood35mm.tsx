import { CSSProperties } from 'react';
import {
  Barcode,
  ChainStamp,
  EditionMark,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  HorizontalSprockets,
  MoodProps,
  Poster,
  gate,
  pickTitleSize,
  resolveBookingNo,
  resolveSerialNo,
} from './_shared';
import { formatDate } from '@/utils/dateFormat';

const FS_BASE = '#0a0a0a';
const FS_HOLE = '#f6f1e4';
const FS_INK = '#f4ede0';
const FS_DIM = 'rgba(244,237,224,0.62)';
const FS_DIVIDER = 'rgba(244,237,224,0.32)';

const cellLabelStyle: CSSProperties = {
  color: FS_DIM,
  fontWeight: 700,
  fontSize: 11,
  fontFamily: FONT_MONO,
  letterSpacing: 2.5,
  textTransform: 'uppercase',
};
const cellValueSans: CSSProperties = {
  color: FS_INK,
  fontWeight: 700,
  fontSize: 18,
  fontFamily: FONT_SANS,
  letterSpacing: -0.2,
};
const cellValueMono: CSSProperties = {
  color: FS_INK,
  fontWeight: 700,
  fontSize: 17,
  fontFamily: FONT_MONO,
  letterSpacing: 0.5,
};

export function Mood35mm({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const titleSize = pickTitleSize(d.title.length, [76, 60, 48, 38]);

  const captionScrim =
    'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.55) 18%, rgba(10,10,10,0.92) 60%, rgba(10,10,10,0.98) 100%)';

  const bookingNo = resolveBookingNo(d);
  const serialNo = resolveSerialNo(d);
  const watchToken = d.watchDateFormat || 'kr-compact';
  const releaseToken = d.releaseDateFormat || 'kr-compact';
  const releaseGran = d.releaseDateGranularity || 'date';
  const watchDateClean = formatDate(d.watchDate, watchToken, 'date');
  const releaseClean = formatDate(d.releaseDate, releaseToken, releaseGran);
  const reissueClean = d.isReissue ? formatDate(d.reissueDate, releaseToken, releaseGran) : '';
  const exhibitedText = [gate(fv?.theater, d.theater), gate(fv?.screen, d.screen), gate(fv?.seat, d.seat)].filter(Boolean).join(' · ');
  const screenedText = [gate(fv?.watchDate, watchDateClean), gate(fv?.watchTime, d.watchTime)].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        color: FS_INK,
        background: FS_BASE,
        fontFamily: FONT_SANS,
        overflow: 'hidden',
      }}
    >
      <Poster
        src={croppedImageUrl}
        fit="contain"
        background={FS_BASE}
        texture={components.texture}
        posterOpacity={components.posterOpacity}
      />

      {/* Top sprocket band — fixed B/W, ignores themeColor */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        <HorizontalSprockets count={14} height={64} base={FS_BASE} hole={FS_HOLE} />
      </div>

      {/* Edge-code strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 64,
          background: FS_BASE,
          padding: '10px 32px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontWeight: 700,
          fontSize: 14,
          fontFamily: FONT_MONO,
          letterSpacing: 2.8,
          color: FS_DIM,
          borderBottom: `1px dashed ${FS_DIVIDER}`,
        }}
      >
        <span>KODAK 5219 · 65MM</span>
        <span style={{ color: FS_INK, letterSpacing: 1.5 }}>{bookingNo}</span>
        <span>FRAME 14 / 24 →</span>
      </div>

      {/* Stamps — chain top-left, format top-right rotated */}
      {components.chain && (
        <div style={{ position: 'absolute', left: 28, top: 132 }}>
          <ChainStamp chain={components.chain} size={1.0} surface="dark" height={48} />
        </div>
      )}

      {components.format && (
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 132,
            transform: 'rotate(-3deg)',
          }}
        >
          <FormatStamp format={components.format} size={0.8} surface="dark" />
        </div>
      )}

      {/* Metadata caption above bottom sprockets */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 64,
          paddingTop: 100,
          background: captionScrim,
        }}
      >
        <div
          style={{
            padding: '0 32px 20px',
            borderTop: `1px dashed ${FS_DIVIDER}`,
            paddingTop: 18,
            margin: '0 12px',
          }}
        >
          {gate(fv?.titleOg, d.titleOg) && (
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                fontFamily: FONT_MONO,
                letterSpacing: 3.5,
                textTransform: 'uppercase',
                color: FS_DIM,
                marginBottom: 8,
              }}
            >
              CAPTION · {gate(fv?.titleOg, d.titleOg)}
            </div>
          )}
          {gate(fv?.title, d.title) && (
            <div
              style={{
                fontWeight: 800,
                fontSize: titleSize,
                fontFamily: FONT_KR,
                lineHeight: 1.0,
                letterSpacing: -0.5,
                marginBottom: 18,
                color: FS_INK,
              }}
            >
              {gate(fv?.title, d.title)}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto 1fr',
              columnGap: 16,
              rowGap: 10,
              alignItems: 'baseline',
              marginBottom: 14,
            }}
          >
            {exhibitedText && (
              <>
                <span style={cellLabelStyle}>EXHIBITED</span>
                <span style={cellValueSans}>{exhibitedText}</span>
              </>
            )}
            {screenedText && (
              <>
                <span style={cellLabelStyle}>SCREENED</span>
                <span style={cellValueMono}>{screenedText}</span>
              </>
            )}
            {gate(fv?.actors, d.actors) && (
              <>
                <span style={cellLabelStyle}>STARRING</span>
                <span
                  style={{
                    color: FS_INK,
                    fontWeight: 500,
                    fontSize: 16,
                    fontFamily: FONT_KR,
                    letterSpacing: -0.1,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {gate(fv?.actors, d.actors)}
                </span>
              </>
            )}
            {gate(fv?.runtime, d.runtime) && (
              <>
                <span style={cellLabelStyle}>RUNTIME</span>
                <span style={cellValueMono}>{gate(fv?.runtime, d.runtime)}</span>
              </>
            )}
            {(fv?.rating ?? true) && d.rating > 0 && (
              <>
                <span style={cellLabelStyle}>RATING</span>
                <span
                  style={{
                    color: FS_INK,
                    fontWeight: 800,
                    fontSize: 17,
                    fontFamily: FONT_SANS,
                    gridColumn: 'span 3',
                  }}
                >
                  ★ {d.rating.toFixed(1)} / 5.0
                </span>
              </>
            )}
          </div>

          {(fv?.edition ?? true) && (
            <div style={{ marginBottom: 14 }}>
              <EditionMark
                serialNo={serialNo}
                collectionNo={d.collectionNo}
                surface="dark"
                ink={FS_INK}
                size={12}
              />
            </div>
          )}

          <div
            style={{
              paddingTop: 12,
              borderTop: `1px dashed ${FS_DIVIDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                fontFamily: FONT_MONO,
                color: FS_INK,
                letterSpacing: 2.5,
              }}
            >
              {[
                gate(fv?.watchDate, watchDateClean) && `← EXP ${gate(fv?.watchDate, watchDateClean)}`,
                gate(fv?.releaseDate, releaseClean) && `REL ${gate(fv?.releaseDate, releaseClean)}`,
                gate(fv?.reissue, reissueClean) && `RE-REL ${gate(fv?.reissue, reissueClean)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {(fv?.bookingNo ?? true) && (
              <Barcode value={bookingNo} color={FS_INK} width={180} height={28} textSize={10} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom sprocket band */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <HorizontalSprockets count={14} height={64} base={FS_BASE} hole={FS_HOLE} />
      </div>
    </div>
  );
}
