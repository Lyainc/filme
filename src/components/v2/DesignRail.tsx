import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RAIL_ITEMS, filterItemsForMood, type RailItem, type RailItemId } from './designRailItems';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 모바일 디자인 레일(#217+): 무드·컬러·후보정·투명도·크기 편집 콘텐츠를 인라인 폼 밖으로 빼
// 가로 원형 아이콘 + 단일 공용 확장 패널로 호스팅한다. 항목 정의(아이콘·라벨·eyebrow·본문)는
// #523에서 ./designRailItems.tsx 공용 목록으로 이관 — 이 파일은 배치(아이콘 행 + 토글 패널)만.
// #523 AC4 — 아이콘 행은 filterItemsForMood를 통과한 항목만 그린다(appliesTo 없는 실사용
// 항목 5개는 전부 통과, 실제 숨김 0건). items prop은 기본값 RAIL_ITEMS를 쓰되, 합성 항목으로
// 무드 전환→숨김→패널 자동 닫힘→값 보존을 검증하는 테스트가 주입할 수 있게 열어둔다.
// #502 — 아이콘 행을 iOS 사진편집형 중앙정렬 캐러셀로 전환. 항목이 늘어도(#530 예고) 가로로
// 잘리지 않고 스크롤되며, 활성 항목이 항상 화면 중앙에 오게 한다. 데스크톱 DesktopDesignPanel은
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
      className="flex shrink-0 snap-center flex-col items-center gap-1.5"
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          selected ? 'bg-accent-soft text-accent' : 'border-line bg-surface-elevated text-fg-muted'
        }`}
        // 선택 시 유저의 티켓 잉크색(themeColor) 링. 미설정이면 accent로 폴백.
        style={selected ? { borderColor: 'transparent', boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      >
        {icon}
      </span>
      <span
        className={`text-[11px] font-medium transition-colors ${selected ? 'text-accent' : 'text-fg-muted'}`}
      >
        {label}
      </span>
    </button>
  );
}

function RailExpandPanel({
  open,
  eyebrow,
  children,
}: {
  open: boolean;
  eyebrow: string;
  children: ReactNode;
}) {
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
        <div id={PANEL_ID} role="region" aria-label={eyebrow} className="py-3">
          {/* 닫기(x) 버튼 제거(#322) — 레일 아이콘 재클릭으로 이미 토글 닫힘이라 기능 중복.
              패널 자체 헤더도 없음(#367에서 LayoutStrip "Mood" 헤더 제거 — rail 탭 라벨과 중복),
              접근성 이름은 region aria-label(eyebrow)이 유지. */}
          {children}
        </div>
      </div>
    </div>
  );
}

export function DesignRail({
  photo,
  items = RAIL_ITEMS,
}: {
  photo: ReturnType<typeof usePhototicket>;
  items?: readonly RailItem[];
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
  const eyebrow = activeItem?.eyebrow ?? '';

  const ringColor = themeColor || 'var(--accent)';
  const toggle = (id: RailItemId) => setPop((cur) => (cur === id ? null : id));

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
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pop === null) return;
    itemRefs.current.get(pop)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pop]);

  // 스와이프/스크롤만으로도 모듈이 전환되게(#502) — 정지 대기 없이 매 스크롤 이벤트에서 중앙에
  // 가장 가까운 아이콘을 바로 활성화한다. 항목이 몇 개뿐이라 이벤트마다 재계산해도 가볍고,
  // nearestId가 현재 pop과 같으면 setState가 no-op이라 별도 스로틀은 필요 없다.
  // ponytail: 네이티브 scroll-snap 관성이 자리를 잡는 동안 이 프로그램적 리센터가 살짝 겹쳐
  // 보일 수 있음 — 실제로 어색하게 보이면 그때 정지 감지(디바운스/scrollend)로 바꿀 것.
  const onRailScroll = () => {
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
  };

  return (
    <div className="space-y-3">
      <div
        ref={railRef}
        onScroll={onRailScroll}
        // 50%-28px: 아이콘 원(44px) 절반을 근사한 패딩 — 양끝 항목도 중앙까지 스크롤될 여유를 준다.
        className="flex items-start gap-6 overflow-x-auto snap-x snap-mandatory px-[calc(50%-28px)] pb-1 [scrollbar-width:thin]"
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

      <RailExpandPanel open={pop !== null} eyebrow={eyebrow}>
        {activeItem ? activeItem.render(photo, 'mobile') : null}
      </RailExpandPanel>
    </div>
  );
}
