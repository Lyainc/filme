import {
  Barcode,
  BrandMark,
  ChainStamp,
  DATE_LABELS,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  Poster,
  SignatureMark,
  gate,
  isInkDark,
  pickTitleSize,
  resolveTicketData,
  truncateActors,
} from './_shared';

export function MoodCriterion({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const inkIsDark = isInkDark(themeColor);
  const ink = inkIsDark ? '#0d0c0a' : themeColor;
  const titleLen = d.title.length;
  const titleSize = pickTitleSize(titleLen, [108, 88, 68, 52]);

  const globalScrim = inkIsDark
    ? 'linear-gradient(180deg, rgba(245,240,232,0.7) 0%, rgba(245,240,232,0.35) 30%, rgba(245,240,232,0.5) 60%, rgba(245,240,232,0.95) 100%)'
    : 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.92) 100%)';
  const spineBg = inkIsDark ? 'rgba(245,240,232,0.95)' : 'rgba(0,0,0,0.7)';
  const spineDivider = inkIsDark ? '#0d0c0a' : ink;

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
  const signatureVal   = gate(fv?.signature, d.signature);

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
        {/* 브랜드 cue — 스파인 세로 워드마크(#138 T1). 기존 'Made by FILME' 텍스트를 공통 BrandMark로 표준화. */}
        <div style={{ marginTop: 16 }}>
          <BrandMark orientation="vertical" color={ink} size={0.95} letterSpacing={4} opacity={0.6} />
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
        <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} size={1.05} />
        {components.chainVisible && components.formatVisible && (
          <span style={{ width: 1, height: 26, background: ink, opacity: 0.6 }} />
        )}
        <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={1.0} />
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
              fontSize: 24,
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
            fontSize: 18,
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
            watchDateVal && `${DATE_LABELS.watched} ${watchDateVal}`,
            releaseDateVal && `${DATE_LABELS.released} ${releaseDateVal}`,
            reissueVal && `${DATE_LABELS.reissued} ${reissueVal}`,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
        {signatureVal && (
          <div style={{ marginTop: 20 }}>
            <SignatureMark
              value={signatureVal}
              color={ink}
              label="SIGNED"
              fontFamily={FONT_KR}
              italic
              maxWidth={520}
              size={0.95}
              opacity={0.85}
            />
          </div>
        )}
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
