import { useRef, useState, type ReactNode } from 'react';
import { RAIL_ITEMS, type RailItemId } from './designRailItems';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 모바일 디자인 레일(#217+): 무드·컬러·후보정·투명도·크기 편집 콘텐츠를 인라인 폼 밖으로 빼
// 가로 원형 아이콘 + 단일 공용 확장 패널로 호스팅한다. 항목 정의(아이콘·라벨·eyebrow·본문)는
// #523에서 ./designRailItems.tsx 공용 목록으로 이관 — 이 파일은 배치(아이콘 행 + 토글 패널)만.

const PANEL_ID = 'design-rail-panel';

function RailIconButton({
  icon,
  label,
  selected,
  ringColor,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  ringColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      aria-controls={PANEL_ID}
      data-touch="44"
      // outline-none 제거(#357) — 전역 :focus-visible 링이 dock 탭에도 걸리게 한다(키보드
      // 포커스에만 뜨므로 터치/마우스 시각 변화 없음).
      className="flex flex-col items-center gap-1.5"
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

export function DesignRail({ photo }: { photo: ReturnType<typeof usePhototicket> }) {
  const [pop, setPop] = useState<RailItemId | null>(null);
  const { themeColor } = photo.state.components;

  // 접히는 중에도 콘텐츠를 마운트한 채 높이만 줄여 부드럽게 닫는다(패널이 비면 점프한다).
  // 마지막 활성 섹션을 기억 — pop이 null이 돼도 애니메이션 동안 직전 섹션이 남는다.
  const lastPopRef = useRef<RailItemId>('mood');
  if (pop) lastPopRef.current = pop;
  const active = lastPopRef.current;
  // #523 c5 — id로 배열을 조회해 항목을 찾는다. 매칭 안 되는 id(이론상 Pop 유니온 밖)가 와도
  // 조용히 마지막 항목을 렌더하던 예전 삼항 체인 final-else 대신, 못 찾으면 아무것도 안 그린다.
  const activeItem = RAIL_ITEMS.find((it) => it.id === active);
  const eyebrow = activeItem?.eyebrow ?? '';

  const ringColor = themeColor || 'var(--accent)';
  const toggle = (id: RailItemId) => setPop((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-6">
        {RAIL_ITEMS.map((it) => (
          <RailIconButton
            key={it.id}
            icon={it.icon}
            label={it.label}
            selected={pop === it.id}
            ringColor={ringColor}
            onClick={() => toggle(it.id)}
          />
        ))}
      </div>

      <RailExpandPanel open={pop !== null} eyebrow={eyebrow}>
        {activeItem ? activeItem.render(photo, 'mobile') : null}
      </RailExpandPanel>
    </div>
  );
}
