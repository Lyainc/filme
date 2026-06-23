import {
  Barcode,
  BrandMark,
  ChainStamp,
  FONT_KR,
  FONT_MONO,
  FONT_SANS,
  FormatStamp,
  MoodProps,
  PerforationStrip,
  Poster,
  SignatureMark,
  gate,
  pickTitleSize,
  resolveTicketData,
  truncateActors,
} from './_shared';

const PAPER = '#f4ede0';
const PAPER_DEEP = '#1a1612';
const PAPER_DIM = '#8a7e63';

const POSTER_W = 460;
const PERF_W = 14;
const MAIN_W = 805;
// Perf strips are absolute overlays (no layout width), so the three flex
// sections must sum to the full 1477 natural width: 460 + 805 + 212 = 1477.
const STUB_W = 212;

export function MoodEditorial({ movieInfo: d, components, croppedImageUrl, fieldVisibility: fv }: MoodProps) {
  const themeColor = components.themeColor || '#FFFFFF';
  const accent = themeColor.toLowerCase() === '#ffffff' ? '#a8312a' : themeColor;
  const titleSize = pickTitleSize(d.title.length, [112, 94, 76, 56]);
  const { bookingNo, watchDateClean, releaseClean, reissueClean, watchYear } = resolveTicketData(d);
  // gate는 순수 함수 — 필드당 1회만 호출해 상단에서 파생 (Minimal/Criterion/35mm 패턴 정렬)
  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const theaterVal = gate(fv?.theater, d.theater);
  const screenVal = gate(fv?.screen, d.screen);
  const seatVal = gate(fv?.seat, d.seat);
  const watchDateVal = gate(fv?.watchDate, watchDateClean);
  const watchTimeVal = gate(fv?.watchTime, d.watchTime);
  const runtimeVal = gate(fv?.runtime, d.runtime);
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const reissueVal = gate(fv?.reissue, reissueClean);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors));
  const signatureVal = gate(fv?.signature, d.signature);

  const theaterValue = theaterVal || screenVal;
  const theaterSub = theaterVal ? screenVal : '';
  const sessionValue = watchDateVal || watchTimeVal;
  const sessionSub = watchDateVal ? watchTimeVal : '';

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
      {/* A: Poster block */}
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
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER} background="transparent" />
        </div>
      </div>

      {/* B: Main info block */}
      <div
        style={{
          flex: `0 0 ${MAIN_W}px`,
          position: 'relative',
          background: PAPER,
          color: PAPER_DEEP,
          display: 'flex',
          flexDirection: 'column',
          padding: '36px 48px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            paddingBottom: 20,
            borderBottom: `1px solid ${PAPER_DEEP}`,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
            <ChainStamp chain={components.chain} label={components.chainLabel} visible={components.chainVisible} size={1.0} />
            {components.chainVisible && components.formatVisible && (
              <span
                style={{
                  display: 'inline-block',
                  width: 1,
                  height: 26,
                  background: PAPER_DIM,
                  flexShrink: 0,
                }}
              />
            )}
            <FormatStamp format={components.format} label={components.formatLabel} visible={components.formatVisible} size={1.2} />
          </div>
          {runtimeVal && (
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
              {runtimeVal}
            </div>
          )}
        </div>

        {/* Subtitle label */}
        <div
          style={{
            marginTop: 22,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 20,
            fontFamily: FONT_SANS,
            color: accent,
            letterSpacing: 0.3,
            marginBottom: 14,
          }}
        >
          une présentation cinématographique
        </div>

        {/* Title block */}
        <div style={{ marginBottom: 24 }}>
          {titleVal && (
            <div
              style={{
                fontWeight: 900,
                fontSize: titleSize,
                fontFamily: FONT_KR,
                lineHeight: 0.95,
                letterSpacing: -1.5,
              }}
            >
              {titleVal}
            </div>
          )}
          {titleOgVal && (
            <div
              style={{
                marginTop: 12,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 28,
                fontFamily: FONT_SANS,
                color: PAPER_DEEP,
                opacity: 0.65,
                letterSpacing: 0.3,
              }}
            >
              {titleOgVal}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: PAPER_DEEP, opacity: 0.25, marginBottom: 22 }} />

        {/* Meta grid */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 36,
            rowGap: 20,
            alignContent: 'start',
            paddingBottom: 20,
            borderBottom: `1px solid ${PAPER_DEEP}`,
          }}
        >
          {theaterValue && (
            <MetaCell
              label={theaterVal ? 'Théâtre' : 'Salle'}
              value={theaterValue}
              sub={theaterSub || undefined}
            />
          )}
          {sessionValue && (
            <MetaCell
              label={watchDateVal ? 'Séance' : 'Heure'}
              value={sessionValue}
              sub={sessionSub || undefined}
              mono
            />
          )}
          {seatVal && (
            <MetaCell label="Place" value={seatVal} mono />
          )}
          {releaseDateVal && (
            <MetaCell label="Sortie" value={releaseDateVal} mono />
          )}
          {reissueVal && (
            <MetaCell label="Reprise" value={reissueVal} mono />
          )}
          {actorsVal && (
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <div
                style={{
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 16,
                  fontFamily: FONT_SANS,
                  color: accent,
                  marginBottom: 5,
                  letterSpacing: 0.3,
                }}
              >
                avec
              </div>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 28,
                  fontFamily: FONT_KR,
                  letterSpacing: -0.2,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {actorsVal}
              </div>
            </div>
          )}
        </div>

        {/* Signature — 프랑스풍 'par {서명}' 라인. 브랜드 cue(스텁 FILME)와 시각적으로 분리. */}
        {signatureVal && (
          <div
            style={{
              paddingTop: 16,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'flex-end',
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 16,
                fontFamily: FONT_SANS,
                color: accent,
                letterSpacing: 0.3,
                flexShrink: 0,
              }}
            >
              par
            </span>
            <span
              style={{
                fontWeight: 500,
                fontSize: 22,
                fontFamily: FONT_KR,
                color: PAPER_DEEP,
                letterSpacing: -0.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 460,
              }}
            >
              {signatureVal}
            </span>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            paddingTop: 20,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div>
            {(fv?.bookingNo ?? true) && (
              <>
                <div
                  style={{
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: 12,
                    fontFamily: FONT_SANS,
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
                    fontSize: 20,
                    fontFamily: FONT_MONO,
                    letterSpacing: 1,
                    color: PAPER_DEEP,
                  }}
                >
                  {bookingNo}
                </div>
              </>
            )}
          </div>
          <div
            style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 13,
              fontFamily: FONT_SANS,
              color: PAPER_DIM,
              letterSpacing: 0.3,
              lineHeight: 1.5,
              textAlign: 'center',
            }}
          >
            non-transférable · 양도 또는 재판매 불가
          </div>
          {(fv?.bookingNo ?? true) ? (
            <Barcode value={bookingNo} color={PAPER_DEEP} width={200} height={42} textSize={10} />
          ) : (
            <div />
          )}
        </div>

        {/* Rating — absolute top-right */}
        {(fv?.rating ?? true) && d.rating > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 48,
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

        {/* Notch (DD5): #000 circle at Main/Stub boundary — matches captureToImage backgroundColor:'#000000' */}
        <div
          style={{
            position: 'absolute',
            right: -28,
            top: 960 / 2 - 28,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#000000',
            zIndex: 10,
          }}
        />
      </div>

      {/* C: Stub block */}
      <div
        style={{
          flex: `0 0 ${STUB_W}px`,
          position: 'relative',
          background: PAPER,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 16px',
          boxSizing: 'border-box',
          borderLeft: `1px solid ${PAPER_DEEP}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: PERF_W }}>
          <PerforationStrip vertical count={42} color={PAPER_DEEP} background="transparent" />
        </div>

        {(fv?.watchDate ?? true) && watchYear && (
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              fontFamily: FONT_MONO,
              letterSpacing: 3,
              color: PAPER_DIM,
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            {watchYear}
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {(fv?.bookingNo ?? true) && (
            <Barcode
              value={bookingNo}
              color={PAPER_DEEP}
              orientation="vertical"
              width={40}
              height={200}
              showText={false}
            />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
          }}
        >
          {/* 브랜드 cue — 스텁 하단 워드마크(#138 T1) */}
          <BrandMark color={PAPER_DEEP} size={0.9} letterSpacing={4} opacity={0.9} />
          <div
            style={{
              fontWeight: 700,
              fontSize: 11,
              fontFamily: FONT_MONO,
              letterSpacing: 3,
              color: PAPER_DIM,
              textTransform: 'uppercase',
            }}
          >
            ADMIT ONE
          </div>
          {(fv?.rating ?? true) && d.rating > 0 && (
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
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
          fontSize: 16,
          fontFamily: FONT_SANS,
          color: PAPER_DIM,
          letterSpacing: 0.3,
          marginBottom: 5,
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
            marginTop: 3,
            fontWeight: 600,
            fontSize: 15,
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
