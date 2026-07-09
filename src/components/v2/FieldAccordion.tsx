import { useState, type ReactNode } from 'react';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketComponents } from '@/types';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { Eyebrow } from './Eyebrow';
import { FieldEditorBody } from './FieldEditorBody';
import {
  FIELD_LABELS,
  launcherGroupsFor,
  STAMP_TARGETS,
  STAMP_KEYS,
  STAMP_LABELS,
  fieldPreview,
  stampPreview,
  type SheetTarget,
} from '@/constants/fields';
import { isRequiredField } from '@/constants/fieldVisibility';

type Photo = ReturnType<typeof usePhototicket>;

/**
 * 데스크톱 INFO 탭 필드 인라인 아코디언(#226). 상시 노출되는 380px 인스펙터라 모바일처럼 시트로
 * 덮지 않고, 필드 행을 클릭하면 그 자리에서 에디터가 확장된다. 본문은 FieldEditorBody(vaul-free)에
 * 위임 — 이 컴포넌트가 항상 마운트돼도 vaul이 메인 번들로 딸려오지 않는다(모바일 FieldEditSheet만 vaul).
 *
 * 표시/숨김 눈 토글은 각 행에 유지하되 rating과 필수 필드(#260 title)는 생략한다 — rating은 본문
 * (RatingPicker)이 자체 눈 토글을 렌더해 이중 eye가 되므로, 필수 필드는 숨기면 제목 없는 티켓이
 * 되므로(FieldEditSheet 헤더·모바일 전체해제와 동일 규칙).
 */
export function FieldAccordion({ photo }: { photo: Photo }) {
  const [expanded, setExpanded] = useState<SheetTarget | null>(null);
  const { movieInfo, fieldVisibility, components } = photo.state;
  const toggle = (t: SheetTarget) => setExpanded((cur) => (cur === t ? null : t));

  return (
    <div className="space-y-group">
      {launcherGroupsFor(components.layout).map((group) => (
        <section key={group.title} className="space-y-2">
          <Eyebrow className="px-1">{group.title}</Eyebrow>
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-elevated">
            {group.fields.map((field) => (
              <AccordionRow
                key={field}
                target={field}
                label={FIELD_LABELS[field]}
                preview={fieldPreview(field, movieInfo)}
                expanded={expanded === field}
                onToggle={() => toggle(field)}
                photo={photo}
                eye={
                  field === 'rating' || isRequiredField(field) ? null : (
                    <VisibilityCheckbox
                      checked={fieldVisibility[field]}
                      onChange={(v) => photo.updateFieldVisibility({ [field]: v })}
                      label={FIELD_LABELS[field]}
                    />
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}

      {/* 스탬프(로고) — chain/format은 TicketComponents에 살아 TicketField 그룹과 별도(모바일 온-티켓 스탬프 탭과 동형). */}
      <section className="space-y-2">
        <Eyebrow className="px-1">Logos</Eyebrow>
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-elevated">
          {STAMP_TARGETS.map((target) => (
            <AccordionRow
              key={target}
              target={target}
              label={STAMP_LABELS[target]}
              preview={stampPreview(target, components)}
              expanded={expanded === target}
              onToggle={() => toggle(target)}
              photo={photo}
              eye={
                <VisibilityCheckbox
                  checked={!!components[STAMP_KEYS[target].visible]}
                  onChange={(v) =>
                    photo.updateComponents({ [STAMP_KEYS[target].visible]: v } as Partial<TicketComponents>)
                  }
                  label={STAMP_LABELS[target]}
                />
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AccordionRow({
  target,
  label,
  preview,
  expanded,
  onToggle,
  eye,
  photo,
}: {
  target: SheetTarget;
  label: string;
  preview: string;
  expanded: boolean;
  onToggle: () => void;
  eye: ReactNode;
  photo: Photo;
}) {
  const panelId = `field-acc-${target}`;
  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${label} 편집`}
          className="flex min-h-touch min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-soft"
        >
          <span className="shrink-0 text-[14px] font-medium text-fg">{label}</span>
          <span
            className={`ml-auto min-w-0 truncate text-right text-[13px] ${preview ? 'text-fg-muted' : 'text-fg-faint'}`}
          >
            {preview || '비어 있음'}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 text-fg-faint transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {eye && <span className="shrink-0 pl-1 pr-3">{eye}</span>}
      </div>

      {/* 확장 본문 — grid-rows 0fr↔1fr 애니메이션(DesignRail/MobileEditorShell 패턴). 접힘 시 inert로
          포커스/Tab/SR 차단. 본문은 확장 시에만 마운트 — autoFocus가 열린 필드에만 걸리고, 모든 필드의
          KOBIS/크롭 훅을 동시 마운트하지 않는다. ponytail: 여는 애니메이션만 부드럽고 닫힘은 즉시(본문
          언마운트) — 클릭으로 닫는 맥락이라 충분. 양방향 부드럽게가 필요하면 last-expanded 잔류 렌더로. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden" inert={!expanded || undefined}>
          <div id={panelId} className="px-4 pb-4 pt-1">
            {expanded && <FieldEditorBody target={target} photo={photo} />}
          </div>
        </div>
      </div>
    </div>
  );
}
