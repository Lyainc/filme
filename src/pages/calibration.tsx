import { useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { downloadTicketAsJpeg } from '@/utils/captureToImage';
import { FONT_MONO, FONT_SANS, FONT_KR } from '@/components/moods/_shared';

// dev 전용(#510) — Pages Router는 파일 존재 = 공개 라우트라, 프로덕션·프리뷰 배포에선
// notFound로 닫는다(claude-review PR #511 P1). t/[id].tsx의 notFound 게이트와 같은 패턴.
export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV !== 'development') return { notFound: true };
  return { props: {} };
};

// ─────────────────────────────────────────────────────────────────────────────
// /calibration — 실물 인쇄 캘리브레이션 도안(dev 디버그 전용, #510).
//
// 목적: CGV 프리미엄 기준 파이프라인이 타 극장·타 사이즈 티켓에 얼마나 호환되는지,
//       그리고 인쇄물을 사진 찍어 Claude에 재입력했을 때 배율·여백·폰트·색을 스스로
//       읽어낼 수 있는지 검증한다. 무드 시스템(LayoutId/디스패처/피커)엔 안 엮인다 —
//       이 페이지는 프로덕트 export 유틸(captureToImage)만 재사용한다.
//
// export 동일성(중요): 다운로드는 프로덕트 프리미엄 세로 티켓과 동일한 downloadTicketAsJpeg
//       (width 960·height 1534 → 내부에서 10px 여백 +2배 pixelRatio → 1960×3108 JPEG q0.95).
//       즉 이 도안으로 인쇄한 결과가 실제 티켓 인쇄와 같은 크기·양식이라야 캘리브레이션이 성립한다.
//
// 스케일 자명성: 극장별 실제 인쇄 크기는 미상이므로 특정 mm를 하드코딩하지 않는다. 도안은
//       티켓 자연 px(960×1534) 그대로이고, 가장자리 눈금자를 자로 재서 "px당 몇 mm"를 역산한다.
//       폰트·이미지 크기가 px로 라벨링돼 있어 실측 배율만 알면 물리 크기가 전부 따라 나온다.
// ─────────────────────────────────────────────────────────────────────────────

const NATURAL_W = 960;
const NATURAL_H = 1534;
const RULER = 34; // 가장자리 눈금자 폭(px)
const INK = '#111111';
const FAINT = '#9AA1AC';

// 눈금자 — 티켓 콘텐츠 edge(px=0) 기준. export 10px 흰 여백은 이 바깥에 붙으므로 종이 물리
// 가장자리 ≠ 눈금 0점이다(콘텐츠 edge = 0점).
function Ruler({ orientation, length }: { orientation: 'h' | 'v'; length: number }) {
  const minor = 20;
  const ticks: number[] = [];
  for (let p = 0; p <= length; p += minor) ticks.push(p);
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: orientation === 'h' ? length : RULER,
        height: orientation === 'h' ? RULER : length,
        borderRight: orientation === 'v' ? `1px solid ${INK}` : undefined,
        borderBottom: orientation === 'h' ? `1px solid ${INK}` : undefined,
      }}
    >
      {ticks.map((p) => {
        const major = p % 100 === 0;
        const len = major ? 14 : p % 100 === 50 ? 9 : 5;
        return (
          <div key={p}>
            <div
              style={{
                position: 'absolute',
                ...(orientation === 'h'
                  ? { left: p, bottom: 0, width: 1, height: len }
                  : { top: p, right: 0, height: 1, width: len }),
                background: INK,
              }}
            />
            {major && (
              <div
                style={{
                  position: 'absolute',
                  ...(orientation === 'h'
                    ? { left: p + 2, top: 2 }
                    : { top: p + 1, left: 2 }),
                  fontFamily: FONT_MONO,
                  fontWeight: 500,
                  fontSize: 9,
                  color: INK,
                  lineHeight: 1,
                }}
              >
                {p}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 코너 fiducial — 3개는 동일 ㄱ자, 우하단 1개만 채운 사각(비대칭)이라 사진에서 회전·원근을
// 명확히 복원할 수 있다. 콘텐츠 영역(눈금자 안쪽) 모서리에 배치.
function Fiducials() {
  const S = 26;
  const T = 3;
  const inset = RULER + 2;
  const corner = (
    style: React.CSSProperties,
    variant: 'L' | 'block',
  ) => (
    <div style={{ position: 'absolute', width: S, height: S, ...style }}>
      {variant === 'block' ? (
        <div style={{ position: 'absolute', inset: 4, background: INK }} />
      ) : (
        <>
          <div style={{ position: 'absolute', top: 0, left: 0, width: S, height: T, background: INK }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: T, height: S, background: INK }} />
        </>
      )}
    </div>
  );
  return (
    <>
      {corner({ top: inset, left: inset }, 'L')}
      {corner({ top: inset, right: 8 }, 'L')}
      {corner({ bottom: 8, left: inset }, 'L')}
      {corner({ bottom: 8, right: 8 }, 'block')}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 1,
        color: INK,
        borderBottom: `1px solid ${INK}`,
        paddingBottom: 3,
        marginBottom: 8,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

const KR_SAMPLE = '다람쥐 헌 쳇바퀴에 타고파';
const LAT_SAMPLE = 'Sphinx of black quartz';
const NUM_SAMPLE = '0123456789 · O0 Il1';

// 폰트 견본 한 줄 — 실제 앱 폰트로 렌더 + family/px/weight 라벨. 사진에서 라벨(의도값)과
// 렌더(실제값)를 한 프레임에서 대조한다. px는 티켓 자연좌표라 실측 배율 곱하면 물리 크기.
function FontRow({
  fontFamily,
  familyLabel,
  size,
  weight,
  text,
}: {
  fontFamily: string;
  familyLabel: string;
  size: number;
  weight: number;
  text: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontWeight: 500,
          fontSize: 9,
          color: FAINT,
          width: 118,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {familyLabel} {size}px/{weight}
      </div>
      {/* 폭 초과 시 줄바꿈(→컬럼 높이 증가→하단 overflow 잘림) 대신 한 줄로 fit해 ellipsis로 자른다
          (PR #511 선택 스코프). 폰트 크기는 안 줄인다 — 라벨 px = 실제 렌더 px라야 물리크기 역산이 성립. */}
      <div
        style={{
          fontFamily,
          fontWeight: weight,
          fontSize: size,
          color: INK,
          lineHeight: 1.15,
          flex: '1 1 0',
          minWidth: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Swatch({ color, label, dark }: { color: string; label: string; dark?: boolean }) {
  return (
    <div style={{ width: 78 }}>
      <div style={{ width: 78, height: 42, background: color, border: `1px solid ${FAINT}` }} />
      <div
        style={{
          fontFamily: FONT_MONO,
          fontWeight: 500,
          fontSize: 8.5,
          color: INK,
          marginTop: 2,
          lineHeight: 1.15,
        }}
      >
        {label}
        <br />
        <span style={{ color: dark ? INK : FAINT }}>{color}</span>
      </div>
    </div>
  );
}

// 라인페어 — 흑백 교대 줄. 인쇄에서 몇 px부터 줄이 뭉개지는지(선명도 하한) 확인.
function LinePairs({ w, vertical }: { w: number; vertical: boolean }) {
  const bars = Array.from({ length: 8 });
  return (
    <div style={{ display: 'inline-block', textAlign: 'center', marginRight: 16 }}>
      <div style={{ display: 'flex', flexDirection: vertical ? 'row' : 'column' }}>
        {bars.map((_, i) => (
          <div
            key={i}
            style={{
              width: vertical ? w : 56,
              height: vertical ? 34 : w,
              background: i % 2 === 0 ? INK : '#FFFFFF',
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 8.5, color: INK, marginTop: 2 }}>
        {w}px {vertical ? '│' : '─'}
      </div>
    </div>
  );
}

export default function CalibrationPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // 중복 실행 가드는 ref로(연타 레이스) — setBusy는 비동기라 클로저의 busy를 읽으면
  // 리렌더 전 두 번째 클릭이 통과한다(claude-review PR #511 P1, ResultPanel #167 패턴).
  const capturingRef = useRef(false);

  async function handleDownload() {
    if (!ref.current || capturingRef.current) return;
    capturingRef.current = true;
    setBusy(true);
    try {
      await downloadTicketAsJpeg(ref.current, {
        width: NATURAL_W,
        height: NATURAL_H,
        filename: 'filme_calibration_960x1534.jpg',
      });
    } catch (err) {
      console.error('[calibration:download]', err);
    } finally {
      capturingRef.current = false;
      setBusy(false);
    }
  }

  const grays = [0, 2, 5, 10, 25, 50, 75, 90, 95, 98, 100];

  return (
    <div style={{ padding: 24, background: '#DADCE0', minHeight: '100dvh' }}>
      <div
        style={{
          maxWidth: NATURAL_W,
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          fontFamily: FONT_SANS,
        }}
      >
        <button
          onClick={handleDownload}
          disabled={busy}
          style={{
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: 14,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: busy ? '#9AA1AC' : '#B0423F',
            color: '#FFFFFF',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? '내보내는 중…' : 'JPEG 다운로드 (프로덕트 동일 포맷)'}
        </button>
        <span style={{ fontSize: 12, color: '#14171A' }}>
          다운로드 = 1960×3108 JPEG(q0.95) · 인쇄는 100% 실제크기, 페이지맞춤 끄기. 인쇄물을 자로 재고 사진 찍어 재입력.
        </span>
      </div>

      {/* ── 캡처 대상: 자연 크기 960×1534. 이 노드가 그대로 downloadTicketAsJpeg에 넘어간다 ── */}
      <div
        ref={ref}
        style={{
          position: 'relative',
          width: NATURAL_W,
          height: NATURAL_H,
          background: '#FFFFFF',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        }}
      >
        <Ruler orientation="h" length={NATURAL_W} />
        <Ruler orientation="v" length={NATURAL_H} />
        <Fiducials />

        {/* 콘텐츠 영역 — 눈금자 안쪽 */}
        <div
          style={{
            position: 'absolute',
            left: RULER + 6,
            top: RULER + 6,
            right: 10,
            bottom: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Header / meta */}
          <div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: INK }}>
              FILME · PRINT CALIBRATION
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 10.5, color: INK, marginTop: 6, lineHeight: 1.5 }}>
              natural 960×1534 px · export = product (+10px margin ×2 → 1960×3108 JPEG q0.95) · v1 2026-07-24
              <br />
              눈금자 0점 = 티켓 콘텐츠 edge (10px 흰 여백은 이 바깥) · 눈금 100px 실측폭 ÷ 100 = mm/px 배율
              <br />
              모든 크기는 px = 티켓 자연좌표 · 물리 크기 = px × (측정한 mm/px)
            </div>
          </div>

          {/* Font matrix — 최우선 */}
          <div>
            <SectionTitle>Font matrix — FONT_KR (Pretendard Variable)</SectionTitle>
            {[10, 12, 14, 18, 24].map((s) => (
              <FontRow key={`kr-${s}`} fontFamily={FONT_KR} familyLabel="KR" size={s} weight={400} text={`${KR_SAMPLE} ${NUM_SAMPLE}`} />
            ))}
            <FontRow fontFamily={FONT_KR} familyLabel="KR" size={16} weight={300} text={`w300 ${KR_SAMPLE}`} />
            <FontRow fontFamily={FONT_KR} familyLabel="KR" size={16} weight={500} text={`w500 ${KR_SAMPLE}`} />
            <FontRow fontFamily={FONT_KR} familyLabel="KR" size={16} weight={700} text={`w700 ${KR_SAMPLE}`} />
            <FontRow fontFamily={FONT_KR} familyLabel="KR" size={16} weight={900} text={`w900 ${KR_SAMPLE}`} />
          </div>

          <div>
            <SectionTitle>Font matrix — FONT_SANS (Pretendard) · FONT_MONO (JetBrains Mono)</SectionTitle>
            {[9, 11, 13, 16, 20].map((s) => (
              <FontRow key={`sans-${s}`} fontFamily={FONT_SANS} familyLabel="SANS" size={s} weight={s <= 11 ? 500 : 400} text={`${LAT_SAMPLE} ${KR_SAMPLE} ${NUM_SAMPLE}`} />
            ))}
            {[10, 12, 14, 18].map((s) => (
              <FontRow key={`mono-${s}`} fontFamily={FONT_MONO} familyLabel="MONO" size={s} weight={s <= 12 ? 400 : 500} text={`${NUM_SAMPLE} ${LAT_SAMPLE}`} />
            ))}
          </div>

          {/* Grayscale ramp + gamma */}
          <div>
            <SectionTitle>Grayscale ramp + shadow/highlight clipping</SectionTitle>
            <div style={{ display: 'flex' }}>
              {grays.map((g) => {
                const v = Math.round((g / 100) * 255);
                const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
                return (
                  <div key={g} style={{ flex: 1 }}>
                    <div style={{ height: 40, background: hex }} />
                    <div style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 8.5, color: INK, textAlign: 'center', marginTop: 2 }}>
                      {g}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 8.5, color: FAINT, marginTop: 2 }}>
              2·5% 구분되면 암부 안 뭉갬 · 95·98% 구분되면 명부 안 날아감
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <SectionTitle>Color reproduction (sRGB) — RGB / CMY / neutral / app palette</SectionTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Swatch color="#FF0000" label="R" />
              <Swatch color="#00FF00" label="G" />
              <Swatch color="#0000FF" label="B" />
              <Swatch color="#00FFFF" label="C" />
              <Swatch color="#FF00FF" label="M" />
              <Swatch color="#FFFF00" label="Y" />
              <Swatch color="#FFFFFF" label="WB white" dark />
              <Swatch color="#808080" label="WB gray" />
              <Swatch color="#000000" label="WB black" />
              <Swatch color="#B0423F" label="app accent" />
              <Swatch color="#14171A" label="app fg" />
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 500, fontSize: 8.5, color: FAINT, marginTop: 4 }}>
              WB white·gray·black = 사진 화이트밸런스 보정 기준 · app accent(#B0423F)는 CMYK에서 시프트 관찰용
            </div>
          </div>

          {/* Resolution line pairs */}
          <div>
            <SectionTitle>Resolution line pairs (px @2× export)</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <LinePairs w={1} vertical />
              <LinePairs w={2} vertical />
              <LinePairs w={3} vertical />
              <LinePairs w={1} vertical={false} />
              <LinePairs w={2} vertical={false} />
              <LinePairs w={3} vertical={false} />
            </div>
          </div>

          {/* Card aspect + margin note */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 54 * 1.7,
                height: 85.6 * 1.7,
                border: `2px solid ${INK}`,
                borderRadius: 8,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT_MONO,
                fontWeight: 500,
                fontSize: 8.5,
                color: FAINT,
                textAlign: 'center',
                padding: 4,
              }}
            >
              ID-1
              <br />
              85.6×54mm
              <br />
              종횡비
            </div>
            <div style={{ fontFamily: FONT_SANS, fontWeight: 400, fontSize: 11, color: INK, lineHeight: 1.5 }}>
              왼쪽은 신용카드(ID-1) 세로 종횡비 참고. 물리 크기는 인쇄 배율에 따르니 눈금자로 측정.
              티켓 자연비 960:1534(≈0.626)는 카드 세로비 54:85.6(≈0.631)과 거의 같다.
              export 흰 여백 10px는 콘텐츠 바깥 → 실제 종이 재단선은 눈금 0점보다 10px 더 바깥.
            </div>
          </div>

          <div style={{ marginTop: 'auto', fontFamily: FONT_MONO, fontWeight: 500, fontSize: 9, color: FAINT }}>
            made with FILME · calibration mood · issue #510
          </div>
        </div>
      </div>
    </div>
  );
}
