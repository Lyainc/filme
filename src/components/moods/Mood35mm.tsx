import { memo, useMemo } from 'react';
import {
  buildEdgeCodes,
  CutFrameLabel,
  CUT_SHADOW,
  FilmCreditCut,
  FilmCutEdges,
  FilmGrain,
  FilmRail,
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
  const { movieInfo: d, components, croppedImageUrl, fieldVisibility: fv, onPosterTap, embossStamps, embossPaths, embossIntensity } = props;
  const { releaseClean } = resolveTicketData(d);

  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  // 레일 엣지 프린트(장식 크롬 — 편집 불가). 원어 표기가 필름 원판 느낌에 맞아 원제를 쓰고,
  // 없으면 제목으로 폴백(#423). useMemo — 새 배열이 매 렌더 나가면 FilmRail의 memo가 매번 빗나간다.
  const releaseDateVal = gate(fv?.releaseDate, releaseClean);
  const edgeCodes = useMemo(
    () => buildEdgeCodes({ titleVal: titleOgVal || titleVal, releaseDateVal, ratingVisible, rating: d.rating, signatureVal }),
    [titleOgVal, titleVal, releaseDateVal, ratingVisible, d.rating, signatureVal]
  );

  const componentOpacity = components.componentOpacity ?? 1;

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
        <FilmGrain axis="vertical" />

        {/* #219 componentOpacity: 레일·프레임 라벨 등 크롬을 함께 페이드. */}
        <div style={{ position: 'absolute', inset: 0, opacity: componentOpacity }}>
          <FilmRail side="left" accent={FILM_AMBER} codes={edgeCodes} />
          <FilmRail side="right" accent={FILM_AMBER} />
          <CutFrameLabel text="FRAME 119" ruleWidth={130} style={{ left: CUT_LEFT, top: POSTER_CUT_TOP - 40 }} />
          <CutFrameLabel text="FRAME 120" ruleWidth={130} style={{ left: CUT_LEFT, top: CREDIT_CUT_TOP - 34 }} />
        </div>

        {/* 포스터 컷 — 분할 레이아웃이라 이 컷에만 포스터 탭(#259). */}
        <div style={{ position: 'absolute', left: CUT_LEFT, width: CUT_W, top: POSTER_CUT_TOP, height: POSTER_CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }} {...posterTapProps(onPosterTap)}>
          {/* 컷이 정확히 0.667이라 표준 크롭(#525 룰 1)은 레터박스 0으로 딱 맞는다. 사용자가 자연비
              크롭을 골라 비율이 어긋나면 남는 자리를 blur 포스터 배경이 덮는다(contain 단일 정책 동일).
              posterFitProps를 안 태우는 건 정책 이탈이 아니라 그 헬퍼가 **풀블리드 슬롯** 계약이기
              때문이다 — frameInsetY(강제 블러 띠)·letterboxBg 같은 옵션이 고정 비율 컷엔 의미가 없고,
              frameInsetY를 실으면 그게 곧 레터박스 0을 깨뜨린다. fit 자체는 헬퍼와 같은 contain. */}
          <Poster
            src={croppedImageUrl}
            fit="contain"
            background="#000"
            material={components.material}
            coating={components.coating}
            materialIntensity={components.materialIntensity}
            coatingIntensity={components.coatingIntensity}
            posterOpacity={components.posterOpacity}
            embossStamps={embossStamps}
            embossPaths={embossPaths}
            embossIntensity={embossIntensity}
          />
        </div>

        {/* 크레딧 컷 — 같은 포스터의 다음 프레임 */}
        <div style={{ position: 'absolute', left: CUT_LEFT, width: CUT_W, top: CREDIT_CUT_TOP, height: CREDIT_CUT_H, background: '#000', boxShadow: CUT_SHADOW, overflow: 'hidden' }}>
          <FilmCreditCut {...props} cutWidth={CUT_W} />
        </div>
      </div>

      <FilmCutEdges axis="vertical" inset={STRIP_INSET} />
    </div>
  );
});
