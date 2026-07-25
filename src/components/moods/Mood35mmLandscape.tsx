import { memo } from 'react';
import {
  buildEdgeCodes,
  buildFilmKeycode,
  CUT_SHADOW,
  FilmCreditCut,
  FilmStripBand,
  FILM_AMBER,
  FILM_BASE,
  FILM_DARK,
  FILM_INK,
  FONT_LCD,
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

export const Mood35mmLandscape = memo(function Mood35mmLandscape(props: MoodProps) {
  const { movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, onPosterTap } = props;
  const { releaseClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 엣지 스크롤 코드(장식 크롬 — 편집 불가). 원어 표기가 필름 원판 느낌에 맞아 원제 우선(#423).
  const edgeCodes = buildEdgeCodes({
    titleVal: titleOgVal || titleVal,
    releaseDateVal: gate(fv?.releaseDate, releaseClean),
    ratingVisible,
    rating: d.rating,
    signatureVal,
  });
  const keycode = buildFilmKeycode(titleOgVal || titleVal);

  const componentOpacity = components.componentOpacity ?? 1;
  const frameLabel = (left: number, ruleW: number, text: string) => (
    // gap:12 — 시안은 10이지만 gap:10px는 병합 셀 분해 flex 컨테이너의 유일 시그니처라(ghostMode
    // #266 PR-C 불변식) 다른 무드처럼 12로 회피한다.
    <div aria-hidden="true" style={{ position: 'absolute', left, top: 127, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontFamily: FONT_LCD, fontSize: 13, letterSpacing: 2.5, color: FILM_AMBER }}>{text}</span>
      <span style={{ width: ruleW, height: 1, background: 'rgba(169,116,51,.3)' }} />
    </div>
  );

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
        {/* 가로 그레인 */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.016) 0 1px, rgba(0,0,0,.06) 1px 3px)' }} />

        {/* #219 componentOpacity: 밴드·프레임 라벨 등 크롬을 함께 페이드. */}
        <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
          {frameLabel(BASE_X, 140, 'FRAME 119')}
          {frameLabel(CREDIT_CUT_X, 70, 'FRAME 120')}
          <FilmStripBand pos="top" accent={FILM_AMBER} codes={edgeCodes} base={FILM_BASE} keycode={keycode} holeW={51} holeH={36} holeR={9} count={18} bleed={34} />
          <FilmStripBand pos="bottom" accent={FILM_AMBER} codes={edgeCodes} base={FILM_BASE} holeW={51} holeH={36} holeR={9} count={18} bleed={34} edgePrint={false} />
        </div>

        {/* 포스터 컷 — 분할 레이아웃이라 이 컷에만 포스터 탭(#259). */}
        <div style={{ position: 'absolute', left: BASE_X, width: POSTER_CUT_W, top: CUT_TOP, height: CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
          {/* 가로 컷은 포스터 표준의 가로 판(3:2, #525 룰 1)이라 컷 자체가 룰 5를 만족한다. 세로
              크롭(2:3)을 여기 contain으로 넣으면 폭의 절반이 레터박스가 되므로 시안대로 cover로
              채운다 — 폐지된 components.posterFit('cover' opt-in)과는 다른 얘기다. 그건 사용자가
              0.667로 잡은 프레임을 **비-포스터 비율** 슬롯(0.626 캔버스·밴드)에 맞춰 다시 잘라
              크롭 화면과 결과가 어긋난 경우였고, 여기 목적지는 포스터 비율 그 자체다. */}
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
          <FilmCreditCut {...props} compact innerWidth={CREDIT_CUT_W - 60} />
        </div>
      </div>

      {/* 절단면 그라디언트 */}
      <div aria-hidden="true" style={{ position: 'absolute', left: STRIP_INSET, top: 0, bottom: 0, width: 22, pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,0))' }} />
      <div aria-hidden="true" style={{ position: 'absolute', right: STRIP_INSET, top: 0, bottom: 0, width: 22, pointerEvents: 'none', background: 'linear-gradient(270deg, rgba(0,0,0,.72), rgba(0,0,0,0))' }} />
    </div>
  );
});
