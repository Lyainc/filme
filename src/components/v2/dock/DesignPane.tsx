import type { usePhototicket } from '@/hooks/usePhototicket';
import type { SheetTarget } from '@/constants/fields';
import { DESIGN_TOOLS, type DesignToolId } from '../designRailItems';
import { TabBar } from './TabBar';

type Photo = ReturnType<typeof usePhototicket>;

const DESIGN_PANEL_ID = 'dock-design-panel';

/**
 * 디자인 모드(D-01~D-05) — 위에 도구 줄(무드 · 색상 · 재질 · 코팅 · 투명도 · 크기, 선택은 600 + 2px 잉크 밑줄,
 * 넘치면 가로 스크롤), 아래에 그 도구의 컨트롤. 컨트롤이 넘치면 그 영역 안에서 세로로 스크롤해 도크 높이는
 * 도구와 상관없이 그대로다.
 */
export function DesignPane({
  photo,
  tool,
  onToolChange,
  onEditField,
}: {
  photo: Photo;
  tool: DesignToolId;
  onToolChange: (next: DesignToolId) => void;
  onEditField: (target: SheetTarget) => void;
}) {
  const active = DESIGN_TOOLS.find((t) => t.id === tool) ?? DESIGN_TOOLS[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TabBar
        items={DESIGN_TOOLS.map((t) => ({ key: t.id, label: t.label }))}
        value={active.id}
        onChange={onToolChange}
        ariaLabel="디자인 도구"
        idPrefix="design-tool"
        panelId={DESIGN_PANEL_ID}
        className="no-scrollbar -mx-4 flex h-touch shrink-0 overflow-x-auto px-2 shadow-[inset_0_-1px_0_var(--pr-hair)]"
        tabClassName={(selected) =>
          `h-touch shrink-0 whitespace-nowrap border-b-2 px-3 text-body transition-colors ${
            selected ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'
          }`
        }
      />
      <div
        key={active.id}
        id={DESIGN_PANEL_ID}
        role="tabpanel"
        aria-labelledby={`design-tool-tab-${active.id}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
      >
        {active.render(photo, { onEditField })}
      </div>
    </div>
  );
}
