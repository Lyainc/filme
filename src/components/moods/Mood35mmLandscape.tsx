import { memo, useMemo } from 'react';
import {
  buildEdgeCodes,
  buildFilmKeycode,
  CutFrameLabel,
  CUT_SHADOW,
  FilmCreditCut,
  FilmCutEdges,
  FilmGrain,
  FilmStripBand,
  FILM_AMBER,
  FILM_BASE,
  FILM_DARK,
  FILM_INK,
  FONT_SANS,
  gate,
  MoodProps,
  Poster,
  posterTapProps,
  resolveTicketData,
} from './_shared';

/**
 * v5 — 시안 `Mood Redesign v5.dc.html` 5b 재설계(에픽 #524). 우측 600px "From the Archive"
 * 아카이브 패널이 통째로 사라지고(#499 흡수), 35mm 세로와 같은 "컷 + 크레딧 컷" 구조가 된다.
 *
 * - 좌우 15px에서 스트립 절단, 바깥은 암부 + 절단면 22px 그라디언트
 * - 상/하 92px FilmStripBand — 홀 51×36 ×18, bleed 34로 절단면에서 구멍이 반쯤 잘린다(#498 흡수).
 *   하단 밴드는 edgePrint=false(프레임번호만) — 상·하 스펙 통일
 * - 컷 2개: 포스터 926×617(3:2 = #525 룰 5의 가로 판) / 크레딧 411×617(2:3). 컷 갭 45px
 * - amber는 시안 색 하드코딩(c8) — themeColor 파생 제거
 */
const STRIP_INSET = 15;
const STRIP_W = 1504;
const BASE_X = 61;
const POSTER_CUT_W = 926;
const CREDIT_CUT_X = 1032;
const CREDIT_CUT_W = 411;
const CUT_TOP = 171;
const CUT_H = 617; // 926×617 = 1.5 (3:2), 411×617 = 0.666 (2:3)
/** 밴드 천공 규격(#498 확정) — 상/하 밴드가 같은 값을 쓴다. bleed 34로 절단면에서 반쯤 잘린다. */
const WIDE_BAND = { holeW: 51, holeH: 36, holeR: 9, count: 18, bleed: 34 } as const;

export const Mood35mmLandscape = memo(function Mood35mmLandscape(props: MoodProps) {
  const { movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, onPosterTap } = props;
  const { releaseClean, bookingNo } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 엣지 스크롤 코드(장식 크롬 — 편집 불가). 원어 표기가 필름 원판 느낌에 맞아 원제 우선(#423).
  // useMemo — 새 배열이 매 렌더 나가면 밴드 2개의 memo가 매번 빗나가 홀·프레임번호까지 다시 만든다.
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const edgeCodes = useMemo(
    () => buildEdgeCodes({ titleVal: titleOgVal || titleVal, releaseDateVal, ratingVisible, rating: d.rating, signatureVal }),
    [titleOgVal, titleVal, releaseDateVal, ratingVisible, d.rating, signatureVal]
  );
  // 시드는 bookingNo — 레포가 이미 쓰는 "티켓 1개 식별자"(#379)라 제목 노출을 꺼도, 제목을 고쳐도
  // 키코드가 안 흔들린다. 제목을 시드로 쓰면 편집할 때마다 필름 롤 번호가 바뀐다.
  const keycode = buildFilmKeycode(bookingNo);

  const componentOpacity = components.componentOpacity ?? 1;

  return (
    <div style={{ position: 'absolute', inset: 0, background: FILM_DARK, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: STRIP_INSET,
          width: STRIP_W,
          top: 0,
          bottom: 0,
          background: FILM_BASE,
          color: FILM_INK,
          fontFamily: FONT_SANS,
          overflow: 'hidden',
          boxShadow: '-7px 0 18px rgba(0,0,0,.9), 7px 0 18px rgba(0,0,0,.9)',
        }}
      >
        <FilmGrain axis="horizontal" />

        {/* #219 componentOpacity: 밴드·프레임 라벨 등 크롬을 함께 페이드. */}
        <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
          <CutFrameLabel text="FRAME 119" ruleWidth={140} style={{ left: BASE_X, top: 127 }} />
          <CutFrameLabel text="FRAME 120" ruleWidth={70} style={{ left: CREDIT_CUT_X, top: 127 }} />
          <FilmStripBand pos="top" accent={FILM_AMBER} codes={edgeCodes} base={FILM_BASE} keycode={keycode} {...WIDE_BAND} />
          <FilmStripBand pos="bottom" accent={FILM_AMBER} base={FILM_BASE} edgePrint={false} {...WIDE_BAND} />
        </div>

        {/* 포스터 컷 — 분할 레이아웃이라 이 컷에만 포스터 탭(#259). */}
        <div style={{ position: 'absolute', left: BASE_X, width: POSTER_CUT_W, top: CUT_TOP, height: CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
          {/* 컷은 포스터 표준의 가로 판(3:2, #525 룰 1)이라 컷 자체는 룰 5를 만족한다. 다만 표준
              크롭은 세로 2:3이라 여기 넣으면 방향이 어긋나는데, contain이면 폭의 절반이 레터박스가
              되고 cover면 세로가 잘린다. v5 시안이 cover를 골랐고(#524 c1: 시안 충실이 기본선)
              이 무드의 완료 조건도 "레터박스 0"이라 cover로 간다 — 대가는 분명히 있다: 세로
              포스터를 넣으면 사용자가 잡은 프레임의 위아래가 잘린다(#525가 posterFit 'cover'를
              폐지하며 지목한 그 잘림과 같은 종류다). 근본 해소는 #499(A)가 남긴 "가로 무드엔
              가로 크롭 프리셋" — 크롭 파이프라인 쪽 일이라 이 슬라이스 밖이다. */}
          <Poster
            src={croppedImageUrl}
            fit="cover"
            background="#000"
            material={components.material}
            coating={components.coating}
            materialIntensity={components.materialIntensity}
            coatingIntensity={components.coatingIntensity}
            posterOpacity={components.posterOpacity}
          />
        </div>

        {/* 크레딧 컷 — 같은 포스터의 다음 프레임 */}
        <div style={{ position: 'absolute', left: CREDIT_CUT_X, width: CREDIT_CUT_W, top: CUT_TOP, height: CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }}>
          <FilmCreditCut {...props} compact cutWidth={CREDIT_CUT_W} />
        </div>
      </div>

      <FilmCutEdges axis="horizontal" inset={STRIP_INSET} />
    </div>
  );
});
