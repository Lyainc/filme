import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RAIL_ITEMS, filterItemsForMood, type RailItem, type RailItemId } from './designRailItems';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 모바일 디자인 레일(#217+): 무드·컬러·후보정·투명도·크기 편집 콘텐츠를 인라인 폼 밖으로 빼
// 가로 원형 아이콘 + 단일 공용 확장 패널로 호스팅한다. 항목 정의(아이콘·라벨·본문)는
// #523에서 ./designRailItems.tsx 공용 목록으로 이관 — 이 파일은 배치(아이콘 행 + 토글 패널)만.
// #523 AC4 — 아이콘 행은 filterItemsForMood를 통과한 항목만 그린다(appliesTo 없는 실사용
// 항목 5개는 전부 통과, 실제 숨김 0건). items prop은 기본값 RAIL_ITEMS를 쓰되, 합성 항목으로
// 무드 전환→숨김→패널 자동 닫힘→값 보존을 검증하는 테스트가 주입할 수 있게 열어둔다.
// #502 — 아이콘 행을 iOS 사진편집형 중앙정렬 캐러셀로 전환. 항목이 늘어도(#530 예고) 가로로
// 잘리지 않고 스크롤되며, 활성 항목이 항상 화면 중앙에 오게 한다. 구 DesktopDesignPanel(#607 삭제)은
// 세로 스택 상시노출이 존재 이유 자체가 "한 번에 하나만 펼치는 rail의 공간 낭비 회피"(#228)라
// 캐러셀(단일 활성 중심)을 얹으면 그 설계와 충돌한다 — 캐러셀은 모바일 rail 전용, 데스크톱은
// 그대로 둔다. 토글(open/close/exclusive) 로직 자체는 안 건드림 — 캐러셀은 입력 경로(스와이프로도
// 전환 가능)를 하나 더 얹을 뿐, 클릭 시맨틱은 기존과 동일.

const PANEL_ID = 'design-rail-panel';

function RailIconButton({
  id,
  icon,
  label,
  selected,
  ringColor,
  onClick,
  onRef,
}: {
  id: RailItemId;
  icon: ReactNode;
  label: string;
  selected: boolean;
  ringColor: string;
  onClick: () => void;
  onRef: (id: RailItemId, el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      data-rail-id={id}
      ref={(el) => onRef(id, el)}
      onClick={onClick}
      aria-expanded={selected}
      aria-controls={PANEL_ID}
      data-touch="44"
      // outline-none 제거(#357) — 전역 :focus-visible 링이 dock 탭에도 걸리게 한다(키보드
      // 포커스에만 뜨므로 터치/마우스 시각 변화 없음).
      className="flex shrink-0 snap-center flex-col items-center gap-1.5 active:scale-[0.97]"
    >
      <span
        aria-hidden="true"
        className={`flex h-touch w-touch items-center justify-center rounded-full border transition-colors ${
          selected ? 'bg-accent-soft text-accent' : 'border-line bg-surface-elevated text-fg-muted'
        }`}
        // 선택 시 유저의 티켓 잉크색(themeColor) 링. 미설정이면 accent로 폴백.
        style={selected ? { borderColor: 'transparent', boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      >
        {icon}
      </span>
      <span
        className={`text-micro font-medium transition-colors ${selected ? 'text-accent' : 'text-fg-muted'}`}
      >
        {label}
      </span>
    </button>
  );
}

function RailExpandPanel({
  open,
  activeId,
  regionLabel,
  children,
}: {
  open: boolean;
  /** 지금 그려지는 항목. 슬롯이 스크롤 컨테이너라 항목이 갈리면 스크롤을 위로 되돌린다. */
  activeId: RailItemId;
  regionLabel: string;
  children: ReactNode;
}) {
  // 고정 슬롯은 같은 DOM 노드에 콘텐츠만 갈아끼우므로 scrollTop이 그대로 넘어간다 — 실측(400×675):
  // 컬러를 바닥(40)까지 내리고 후보정으로 옮기면 33이 남아 새 항목이 중간부터 보인다. 짧은 항목은
  // 브라우저가 0으로 클램프해 저절로 맞지만 넘치는 항목끼리는 안 맞아서, 항목이 갈릴 때 되돌린다.
  const slotRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (slotRef.current) slotRef.current.scrollTop = 0;
  }, [activeId]);

  return (
    // collapse = grid-rows 0fr↔1fr + overflow-hidden(필수) + 접힘 시 inert(포커스/Tab/SR 차단).
    // reduced-motion은 전역 가드 + motion-reduce:transition-none로 이중 차단(MobileEditorShell 패턴).
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden" inert={!open || undefined}>
        {/* v8 언박스(#357) — 패널의 배경·보더·라운드·그림자 전부 제거. 상세는 앰비언트 배경 위
            느슨한 컨트롤로 얹히고, 가독성은 앰비언트의 어두움 + 각 피커 자체 대비로 확보한다.
            과거 박스형 룩(rounded-card border bg-surface-elevated) 복원 금지 — 언박스가 최종. */}
        {/* py: range thumb(globals.css, height 18px margin-top:-8px)이 트랙 아래로 8px
            튀어나와 overflow-hidden 바닥에서 잘림(#385) — 하단 패딩으로 여유 확보. */}
        {/* 고정 슬롯(#563) — 항목마다 콘텐츠 높이가 89~205px로 갈려서(400×675 실측) 탭을 옮길
            때마다 dock이 자라고 줄었고, dock이 움직이면 본문(flex-1)이 밀려 fit 스테이지의 cqh가
            바뀌어 프리뷰 티켓까지 같이 커졌다 작아졌다. 높이를 하나로 못박고 넘치는 항목만 안에서
            스크롤시키면 dock은 탭 전환에 무관해진다 — 이슈가 고른 후보 (b)고, 대가는 세로
            스크롤이다. dvh가 아니라 svh인 이유는 브라우저 툴바가 접힐 때 슬롯이 따라 움직이면
            그것도 출렁임이기 때문.
            값(#682): 214px는 그 세로를 실기기가 절대 못 주는(214/0.26=823px) 죽은 상한 — 실기기는
            항상 svh 쪽이 이긴다. 17.5svh(393×659에서 115px)는 "6항목 중 4개가 들어간다"고 적어
            뒀었지만 #527(포스터 채우기)·#554(축 세그먼트)가 크기 패널을, #524가 컬러 패널을 키운
            뒤로는 실측이 안 맞았다(무드 115·투명도 115만 들어가고 컬러 minimal 126·35mm 154·크기
            199·형압 203은 넘침, #682 실측). 26svh(393×659에서 171px)로 올려 컬러(둘 다)까지
            들어오게 한다.
            크기·형압 콘텐츠 다이어트(#682 후속)로 두 패널의 정상 상태(형압: 편집 중이 아닐 때,
            크기: 축 전환 직후)는 171px 이하로 들어왔다 — 남는 건 사용자 손이 캔버스 위 브러시
            레이어에 있어 이 패널을 안 보고 있을 확률이 높은 두 잔여 상태뿐이다: 형압을 실제로
            칠하는 동안(177px, +6px)과 재크롭 직후 채우기 칩까지 겹치는 순간(179px, +8px). 항목
            콘텐츠를 더 키우면 이 상한도 같이 올릴 것 — 안 올리면 조용히 스크롤이 돌아온다.
            #735(하이라이트·형압 마스크 분리)가 형압 패널에 "효과" 선택 행을 상시 추가하며 위
            171px 이하 전제가 한때 형압에서 깨졌었다(정상 상태 199/176, +23px, 2026-08-18 1차
            실측) — 그 행을 ChipRadio(자체 라벨)에서 SizePanel·TexturePanel과 같은 축-전환
            문법인 AxisSegment(라벨 없음)로 바꾸고 감쌈도 SizePanel처럼 space-y-field로 좁혀
            해소했다(designRailItems.tsx의 EmbossPanel 주석 참고). 재실측(`measure-chrome.mjs
            --rail highlight --url :3010`): 정상 상태 176/176(넘침 0, 393×659 171/171)로
            복귀, 편집 중 브러시(마스크 有)는 223/176(+47px)로 위 두 잔여 상태와 같은 카테고리에
            남는다. railSlot은 게이트가 아니라 관측값(CLAUDE.md "📏 크롬 측정 하네스" 절)이라
            exit code는 원래부터 이 값에 안 실린다. */}
        <div
          ref={slotRef}
          id={PANEL_ID}
          role="region"
          aria-label={regionLabel}
          className="h-[min(214px,26svh)] overflow-y-auto py-3"
          // 스크롤 어포던스(#682 방향 3) — 넘칠 때만 위/아래 가장자리에 옅은 그림자가 뜨는
          // CSS 전용 기법(JS 없이 background-attachment local/scroll의 스크롤 동기화 차이를
          // 이용). 안 넘치면(스크롤 불가) 그림자 레이어가 커버 레이어에 항상 가려져 안 보인다 —
          // 크기·형압이 위 다이어트 뒤에도 여전히 살짝 넘치는 잔여 상태(형압 편집 중 +6px,
          // 크기 채우기 노출 +8px)에서 "더 있다"는 단서를 최소 침습으로 남긴다.
          // 그림자 색은 고정 rgba(0,0,0,…) 대신 --fg-faint(아이콘/장식 3:1 하한, 라이트
          // #818C99 / 다크 #6B7280)를 쓴다 — 다크 앰비언트(#0E1012 근방)에 검정 반투명을
          // 얹으면 대비가 거의 0이라 정작 남아 있는 넘침(크기·형압)을 다크 테마에서만 못
          // 알아채는 회귀가 났다(fresh-context 리뷰 발견).
          style={{
            background: `
              linear-gradient(var(--bg) 30%, rgba(0,0,0,0)),
              linear-gradient(rgba(0,0,0,0), var(--bg) 70%) 0 100%,
              radial-gradient(farthest-side at 50% 0, color-mix(in srgb, var(--fg-faint) 55%, transparent), rgba(0,0,0,0)),
              radial-gradient(farthest-side at 50% 100%, color-mix(in srgb, var(--fg-faint) 55%, transparent), rgba(0,0,0,0)) 0 100%
            `,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 32px, 100% 32px, 100% 12px, 100% 12px',
            backgroundAttachment: 'local, local, scroll, scroll',
          }}
        >
          {/* 닫기(x) 버튼 제거(#322) — 레일 아이콘 재클릭으로 이미 토글 닫힘이라 기능 중복.
              패널 자체 헤더도 없음(#367에서 LayoutStrip "Mood" 헤더 제거 — rail 탭 라벨과 중복),
              접근성 이름은 region aria-label(활성 항목의 label)이 유지. 예전엔 RailItem에
              영문 전용 eyebrow 필드를 따로 뒀는데(#367이 label만 한국어로 바꾸며 갈라짐 —
              #701에서 발견) label과 내용이 완전히 같아 중복이었다, 그래서 제거하고 label을
              그대로 쓴다. */}
          {children}
        </div>
      </div>
    </div>
  );
}

export function DesignRail({
  photo,
  items = RAIL_ITEMS,
  onRecropPoster,
}: {
  photo: ReturnType<typeof usePhototicket>;
  items?: readonly RailItem[];
  /** 포스터 재크롭 진입(#492) — 셸이 크롭 파이프라인을 소유하므로 항목엔 콜백만 흘려준다. */
  onRecropPoster?: () => void;
}) {
  const [pop, setPop] = useState<RailItemId | null>(null);
  const { themeColor, layout } = photo.state.components;
  const visibleItems = filterItemsForMood(items, layout);

  // #523 hard 제약 — 패널이 열린 채 무드가 바뀌어 활성 항목이 숨겨지면 패널을 닫는다(pop→null).
  // 숨겨진 항목의 값 자체는 photo.state.components에 그대로 남아있어 무드 복귀 시 복원된다 —
  // 여기서 지우는 건 UI 열림 상태뿐. useEffect가 아니라 렌더 중 조정(React의 "adjusting state
  // when a prop changes" 패턴, 아래 lastPopRef도 같은 렌더 중 갱신 관용구) — 커밋 후 effect를
  // 기다리면 아이콘은 이미 사라진 프레임에 패널만 열린 채로 한 번 더 그려진다(/simplify F1).
  if (pop !== null && !visibleItems.some((it) => it.id === pop)) {
    setPop(null);
  }

  // 접히는 중에도 콘텐츠를 마운트한 채 높이만 줄여 부드럽게 닫는다(패널이 비면 점프한다).
  // 마지막 활성 섹션을 기억 — pop이 null이 돼도 애니메이션 동안 직전 섹션이 남는다.
  const lastPopRef = useRef<RailItemId>('mood');
  if (pop) lastPopRef.current = pop;
  const active = lastPopRef.current;
  // #523 c5 — id로 배열을 조회해 항목을 찾는다. 매칭 안 되는 id(이론상 Pop 유니온 밖)가 와도
  // 조용히 마지막 항목을 렌더하던 예전 삼항 체인 final-else 대신, 못 찾으면 아무것도 안 그린다.
  const activeItem = items.find((it) => it.id === active);
  const regionLabel = activeItem?.label ?? '';

  const ringColor = themeColor || 'var(--accent)';
  // 클릭으로 연 항목은 아래 effect가 smooth 스크롤로 중앙에 당기는데, 그 애니메이션이 만드는
  // 중간 scroll 이벤트를 onRailScroll이 사용자 스와이프로 착각해 지나가던 아이콘을 활성화하면
  // 목적지가 가로채인다(claude-review P1). 클릭 직후 이 구간 동안은 scroll 추적을 쉰다 —
  // 스크롤로 연 항목은 이미 중앙 근처라 리센터 이동이 거의 없어 가드가 필요 없다(스와이프
  // 연속 전환을 막지 않으려면 여기서만 걸어야 한다).
  // ponytail: 600ms는 짧은 레일의 smooth 스크롤을 덮는 경험값 — scrollend가 전 브라우저에
  // 깔리면 그 이벤트로 갈아탈 것.
  const clickRecenterUntil = useRef(0);
  const toggle = (id: RailItemId) => {
    if (pop !== id) clickRecenterUntil.current = Date.now() + 600;
    setPop((cur) => (cur === id ? null : id));
  };

  // id→버튼 엘리먼트 단일 소스(/simplify 재사용 지적) — TexturePicker.tsx의 activeRef 패턴과
  // 같은 취지를 다중 항목에 맞게 Map으로 확장. querySelector 문자열 조회 없이 아래 effect와
  // onRailScroll이 이 Map 하나만 본다.
  const itemRefs = useRef(new Map<RailItemId, HTMLButtonElement>());
  const setItemRef = (id: RailItemId, el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };

  // 패널이 열릴 때(클릭이든 스크롤 감지든)만 그 아이콘을 화면 중앙으로 당긴다 — pop이 null인
  // 동안(마운트 직후 포함)은 건드리지 않는다. 안 그러면 마운트 시 이 effect가 첫 항목을
  // scrollIntoView로 밀고, 그 스크롤이 아래 onRailScroll을 발화시켜 열려있지도 않은 패널을
  // 시작하자마자 스스로 열어버리는 순환이 생긴다.
  // visibleItems.length도 의존성에 든다(#558 열린 질문 → #564). **오늘은 이걸 빼도 안 깨진다** —
  // 실측(400×675: criterion 6개에서 '크기'를 연 뒤 undo로 minimal 5개로): 어긋남 0px. appliesTo가
  // 붙은 항목이 커스텀 하나뿐이고 그게 목록 끝이라, 붙고 빠져도 앞 아이콘들의 좌표가 안 변하고
  // 줄어든 최대 스크롤은 브라우저가 클램프하기 때문이다. 그래도 의존성에 두는 건 이 effect의
  // 일이 "활성 아이콘을 중앙에 유지"이고 그 입력에 항목 목록이 들어가서다 — 가운데 항목에
  // appliesTo가 붙는 순간(#530이 커스텀 항목을 넓히면 그 앞에 새 항목이 설 수 있다) 뒤 항목이
  // 통째로 밀리고, 그땐 scrollLeft가 그대로라 조용히 어긋난다.
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pop === null) return;
    itemRefs.current.get(pop)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pop, visibleItems.length]);

  // 형압이 아닌 항목으로 옮기면 형압 편집 모드를 끈다(#722). 안 끄면 EmbossBrushLayer(z-45)가
  // 포스터 rect를 계속 덮어, 크기·투명도를 조절하러 들어와 포스터를 누른 사용자에게 형압이 찍힌다.
  // 레일 선택이 바뀌는 경로 셋(아이콘 클릭 toggle · 스와이프 정착 · 무드 전환으로 항목이 숨겨짐)이
  // 전부 pop으로 합류하므로 여기 한 곳이면 된다 — 호출부마다 가드를 넣는 것보다 작다.
  //
  // `pop !== null`을 함께 보는 이유: 형압 아이콘 재탭으로 **패널만 접는 건** pop=null이고, 그때까지
  // 모드를 끄면 "패널 접고 넓은 화면에서 칠하기"가 막힌다. 보고된 명제("다른 메뉴를 선택하면")만
  // 정확히 덮는 게 이 조건이다.
  //
  // 위 175행처럼 렌더 중 조정으로는 못 쓴다 — setEmbossEditMode는 부모(MobileEditorShell)가 소유한
  // state라 렌더 중 호출하면 React가 경고한다. 같은 값으로의 set은 React가 bail out하므로
  // embossEditMode를 의존성에 넣지 않아도 여분 렌더가 생기지 않는다.
  useEffect(() => {
    if (pop !== null && pop !== 'highlight') photo.setEmbossEditMode(false);
  }, [pop, photo.setEmbossEditMode]);

  // 스와이프/스크롤만으로도 모듈이 전환되게(#502). 예전엔 매 scroll 이벤트에서 바로 활성화했는데,
  // 그러면 지나가는 아이콘마다 setPop이 돌고 그때마다 위 effect가 리센터를 걸어 스크롤이 스스로
  // 되먹임하며 흔들렸다(#564) — 이 파일의 ponytail 노트가 예고한 업그레이드 경로대로 **정지 감지**로
  // 바꾼다. scrollend 이벤트가 아직 전 브라우저에 안 깔려서 타이머 디바운스로 같은 걸 얻는다:
  // snap-mandatory가 자리를 잡은 뒤 한 번만 판정하므로 관성 구간의 중간 값이 활성화되지 않는다.
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const onRailScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (Date.now() < clickRecenterUntil.current) return;
      const rail = railRef.current;
      if (!rail) return;
      const railRect = rail.getBoundingClientRect();
      const center = railRect.left + railRect.width / 2;
      let nearestId: RailItemId | null = null;
      let nearestDist = Infinity;
      itemRefs.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.left + r.width / 2 - center);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = id;
        }
      });
      if (nearestId) setPop(nearestId);
    }, 120);
  };

  return (
    <div className="space-y-3">
      <div
        ref={railRef}
        onScroll={onRailScroll}
        // 50%-22px: 아이콘 원(44px) 절반 = 양끝 항목도 정확히 중앙에 서는 패딩. #502는 28px였는데
        // 그건 반지름보다 6px 커서 첫·마지막 아이콘이 scrollLeft 0/최대에서 6px 어긋난 채 멈췄다
        // (400×675 실측: 가운데 4항목 0px, 양끝 ±6px). appliesTo가 마지막 항목을 갈아끼우므로
        // (커스텀은 criterion에서만) 그 어긋남이 무드마다 자리를 옮겨 다닌다 — #558 열린 질문과
        // 같은 뿌리라 여기서 같이 맞춘다. 값을 키우면 어긋남이 그만큼 돌아온다.
        // py-1.5(#565): overflow-x:auto는 overflow-y를 visible로 둘 수 없어(CSS 스펙상 한 축이
        // visible이 아니면 다른 축도 auto로 계산) 이 컨테이너가 세로 클리핑 박스가 된다. 선택 링
        // (box-shadow 2px)과 전역 :focus-visible(outline 3px + offset 2px = 5px)이 버튼 밖으로
        // 나가므로 위아래 6px씩 확보한다 — #385(패널 바닥에서 range thumb가 잘림)와 같은 함정의
        // 미방어 지점이었다. no-scrollbar(#564): 스와이프 캐러셀이라 스크롤바가 정보를 안 준다.
        className="flex items-start gap-6 overflow-x-auto snap-x snap-mandatory px-[calc(50%-22px)] py-1.5 no-scrollbar"
      >
        {visibleItems.map((it) => (
          <RailIconButton
            key={it.id}
            id={it.id}
            icon={it.icon}
            label={it.label}
            selected={pop === it.id}
            ringColor={ringColor}
            onClick={() => toggle(it.id)}
            onRef={setItemRef}
          />
        ))}
      </div>

      <RailExpandPanel open={pop !== null} activeId={active} regionLabel={regionLabel}>
        {activeItem ? activeItem.render(photo, { onRecropPoster }) : null}
      </RailExpandPanel>
    </div>
  );
}
