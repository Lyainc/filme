import {
  Barcode,
  ChainStamp,
  EditionMark,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FONT_SERIF,
  FormatStamp,
  MoodProps,
  PerforationStrip,
  Poster,
  pickTitleSize,
  resolveBookingNo,
  resolveSerialNo,
} from './_shared';
import { formatDate } from '@/utils/dateFormat';

const PAPER = '#f4ede0';
const PAPER_DEEP = '#1a1612';
const PAPER_DIM = '#8a7e63';

const POSTER_W = 640;

export function MoodEditorial({ movieInfo: d, components, croppedImageUrl }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : themeColor;
  const titleSize = pickTitleSize(d.title.length, [124, 102, 80, 60]);
  const bookingNo = resolveBookingNo(d);
  const serialNo = resolveSerialNo(d);
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
        background: PAPER,
        color: PAPER_DEEP,
        fontFamily: FONT_SANS,
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {/* Left — full-bleed poster */}
      <div
        style={{
          flex: `0 0 ${POSTER_W}px`,
          position: 'relative',
          background: '#0a0a0a',
          overflow: 'hidden',
        }}
      >
        <Poster
          src={croppedImageUrl}
          texture={components.texture}
          posterOpacity={components.posterOpacity}
        />
      </div>

      {/* Perforation strip */}
      <div style={{ position: 'relative', flex: '0 0 14px', background: PAPER }}>
        <PerforationStrip vertical count={42} color={PAPER_DEEP} />
      </div>

      {/* Right — editorial paper */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: PAPER,
          color: PAPER_DEEP,
          minWidth: 0,
          padding: '44px 52px 36px',
        }}
      >
        {/* Hairline accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 44,
            bottom: 36,
            width: 3,
            background: accent,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            paddingBottom: 22,
            borderBottom: `1px solid ${PAPER_DEEP}`,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
            <ChainStamp chain={components.chain} size={1.0} />
            {components.format && (
              <>
                <span style={{ width: 1, height: 26, background: PAPER_DIM }} />
                <FormatStamp format={components.format} size={0.85} />
              </>
            )}
          </div>
          {d.runtime && (
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                fontFamily: FONT_MONO,
                letterSpacing: 3,
                color: PAPER_DIM,
                textTransform: 'uppercase',
              }}
            >
              {d.runtime}
            </div>
          )}
        </div>

        {/* Title block */}
        <div style={{ paddingTop: 30, paddingBottom: 28 }}>
          <div
            style={{
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 22,
              fontFamily: FONT_SERIF,
              color: accent,
              marginBottom: 14,
              letterSpacing: 0.3,
            }}
          >
            une présentation cinématographique
          </div>
          {d.title && (
            <div
              style={{
                fontWeight: 900,
                fontSize: titleSize,
                fontFamily: FONT_KR,
                lineHeight: 0.95,
                letterSpacing: -1.5,
              }}
            >
              {d.title}
            </div>
          )}
          {d.titleOg && (
            <div
              style={{
                marginTop: 14,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 32,
                fontFamily: FONT_SERIF,
                color: PAPER_DEEP,
                opacity: 0.7,
                letterSpacing: 0.3,
              }}
            >
              {d.titleOg}
            </div>
          )}
        </div>

        {/* Meta grid */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 36,
            rowGap: 24,
            alignContent: 'start',
            paddingTop: 26,
            paddingBottom: 26,
            borderTop: `1px solid ${PAPER_DEEP}`,
            borderBottom: `1px solid ${PAPER_DEEP}`,
          }}
        >
          {d.theater && <MetaCell label="Théâtre" value={d.theater} sub={d.screen} />}
          {watchDateClean && (
            <MetaCell label="Séance" value={watchDateClean} sub={d.watchTime} mono />
          )}
          {d.seat && <MetaCell label="Place" value={d.seat} mono />}
          {releaseClean && <MetaCell label="Sortie" value={releaseClean} mono />}
          {reissueClean && <MetaCell label="Reprise" value={reissueClean} mono />}
          {d.actors && (
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <div
                style={{
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 16,
                  fontFamily: FONT_SERIF,
                  color: accent,
                  marginBottom: 6,
                  letterSpacing: 0.3,
                }}
              >
                avec
              </div>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 26,
                  fontFamily: FONT_KR,
                  letterSpacing: -0.2,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {d.actors}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: 22,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 28,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 13,
                fontFamily: FONT_SERIF,
                color: PAPER_DIM,
                letterSpacing: 0.3,
                marginBottom: 2,
              }}
            >
              No.
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 22,
                fontFamily: FONT_MONO,
                letterSpacing: 1,
                color: PAPER_DEEP,
              }}
            >
              {bookingNo}
            </div>
            <div style={{ marginTop: 7 }}>
              <EditionMark
                serialNo={serialNo}
                collectionNo={d.collectionNo}
                surface="paper"
                ink={PAPER_DIM}
                size={11}
              />
            </div>
          </div>
          <div
            style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 15,
              fontFamily: FONT_SERIF,
              color: PAPER_DIM,
              letterSpacing: 0.3,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            non-transférable · 양도 또는 재판매 불가
          </div>
          <Barcode value={bookingNo} color={PAPER_DEEP} width={200} height={42} textSize={10} />
        </div>

        {d.showRating && d.rating > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 52,
              top: 44,
              fontWeight: 800,
              fontSize: 16,
              fontFamily: FONT_MONO,
              letterSpacing: 1,
              color: accent,
            }}
          >
            ★ {d.rating.toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 17,
          fontFamily: FONT_SERIF,
          color: PAPER_DIM,
          letterSpacing: 0.3,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 30,
          fontFamily: mono ? FONT_MONO : FONT_SANS,
          letterSpacing: mono ? 0.5 : -0.4,
          lineHeight: 1.05,
          color: PAPER_DEEP,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 4,
            fontWeight: 600,
            fontSize: 16,
            fontFamily: FONT_MONO,
            letterSpacing: 1.5,
            color: PAPER_DIM,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
