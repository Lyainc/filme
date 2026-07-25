import { memo } from 'react';
import {
  buildEdgeCodes,
  buildRailPrint,
  CUT_SHADOW,
  FilmCreditCut,
  FilmRail,
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
 * v5 — 시안 `Mood Redesign v5.dc.html` 5a 재설계(에픽 #524). 이전(v4, #281 마스터)의
 * "포스터 풀블리드 + 상/하 92px 가로 스트립 + 하단 캡션 카드"를 버리고, **스트립을 90° 돌려
 * 세로 레일로 바꾸고 포스터를 프레임 컷 안에 가둔다.**
 *
 * - 좌우 세로 레일 100px(FilmRail) — 좌측에만 엣지 프린트(실물도 편측 인쇄)
 * - 상하 15px에서 스트립 절단, 바깥은 암부 + 절단면 22px 그라디언트
 * - 컷 2개: 포스터 560×840(#525 룰 5의 0.667) / 크레딧 420 높이, 각 컷 머리에 FRAME 119·120
 * - 크레딧 컷 = 같은 포스터의 다음 프레임(상단정렬 + brightness .34) 위 엔딩 크레딧, 구분선 0개
 * - 더블룰·닷 디바이더 전량 삭제, 체인·포맷 스탬프는 크레딧 컷 하단 푸터로 이동(c5)
 * - amber는 시안 색 하드코딩(c8) — themeColor 파생 제거
 */
const STRIP_INSET = 15;
const CUT_LEFT = 200;
const CUT_W = 560;
const POSTER_CUT_TOP = 96;
const POSTER_CUT_H = 840; // 560×840 = 0.667 (#525 룰 5)
const CREDIT_CUT_TOP = 988;
const CREDIT_CUT_H = 420;

export const Mood35mm = memo(function Mood35mm(props: MoodProps) {
  const { movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, onPosterTap } = props;
  const { releaseClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 레일 엣지 프린트(장식 크롬 — 편집 불가). 원어 표기가 필름 원판 느낌에 맞아 원제를 쓰고,
  // 없으면 제목으로 폴백(#423). 코드 런을 4회 반복해 레일 전 구간을 채운다.
  const edgeCodes = buildEdgeCodes({
    titleVal: titleOgVal || titleVal,
    releaseDateVal: gate(fv?.releaseDate, releaseClean),
    ratingVisible,
    rating: d.rating,
    signatureVal,
  });
  const railPrint = buildRailPrint(edgeCodes);

  const componentOpacity = components.componentOpacity ?? 1;
  const frameLabel = (top: number, text: string) => (
    <div aria-hidden="true" style={{ position: 'absolute', left: CUT_LEFT, top, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontFamily: FONT_LCD, fontSize: 13, letterSpacing: 2.6, color: FILM_AMBER }}>{text}</span>
      <span style={{ width: 130, height: 1, background: 'rgba(169,116,51,.3)' }} />
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: FILM_DARK, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: STRIP_INSET,
          bottom: STRIP_INSET,
          background: FILM_BASE,
          color: FILM_INK,
          fontFamily: FONT_SANS,
          overflow: 'hidden',
          boxShadow: '0 -7px 18px rgba(0,0,0,.9), 0 7px 18px rgba(0,0,0,.9)',
        }}
      >
        {/* 세로 그레인 */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.016) 0 1px, rgba(0,0,0,.06) 1px 3px)' }} />

        {/* #219 componentOpacity: 레일·프레임 라벨 등 크롬을 함께 페이드. */}
        <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
          <FilmRail side="left" accent={FILM_AMBER} print={railPrint} />
          <FilmRail side="right" accent={FILM_AMBER} />
          {frameLabel(56, 'FRAME 119')}
          {frameLabel(CREDIT_CUT_TOP - 34, 'FRAME 120')}
        </div>

        {/* 포스터 컷 — 분할 레이아웃이라 이 컷에만 포스터 탭(#259). */}
        <div style={{ position: 'absolute', left: CUT_LEFT, width: CUT_W, top: POSTER_CUT_TOP, height: POSTER_CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
          {/* 컷이 정확히 0.667이라 표준 크롭(#525 룰 1)은 레터박스 0으로 딱 맞는다. 사용자가 자연비
              크롭을 골라 비율이 어긋나면 남는 자리를 blur 포스터 배경이 덮는다(contain 단일 정책).
              posterFitProps를 안 쓰는 이유: 그 헬퍼는 풀블리드 슬롯용 frameInsetY(강제 레터박스 띠)를
              같이 실어 보내는 자리라, 고정 비율 컷에선 그게 곧 레터박스 0을 깨뜨린다. */}
          <Poster
            src={croppedImageUrl}
            fit="contain"
            background="#000"
            material={components.material}
            coating={components.coating}
            materialIntensity={components.materialIntensity}
            coatingIntensity={components.coatingIntensity}
            posterOpacity={components.posterOpacity}
          />
        </div>

        {/* 크레딧 컷 — 같은 포스터의 다음 프레임 */}
        <div style={{ position: 'absolute', left: CUT_LEFT, width: CUT_W, top: CREDIT_CUT_TOP, height: CREDIT_CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }}>
          <FilmCreditCut {...props} innerWidth={CUT_W - 72} />
        </div>
      </div>

      {/* 절단면 그라디언트 */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: STRIP_INSET, height: 22, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,.72), rgba(0,0,0,0))' }} />
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: STRIP_INSET, height: 22, pointerEvents: 'none', background: 'linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,0))' }} />
    </div>
  );
});
