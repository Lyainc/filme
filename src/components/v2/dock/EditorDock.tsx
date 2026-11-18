import { useState } from 'react';
import { missingExportFields } from '@/hooks/useExportReady';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketField } from '@/types';
import type { SheetTarget } from '@/constants/fields';
import type { DesignToolId } from '../designRailItems';
import { DesignPane } from './DesignPane';
import { InfoPane } from './InfoPane';
import { PhotoPane } from './PhotoPane';
import { TabBar } from './TabBar';

type Photo = ReturnType<typeof usePhototicket>;

export type DockMode = 'photo' | 'info' | 'design';

/**
 * 도크 높이는 모드 · 도구와 상관없이 하나다(마스터 C-DOCK, Seed constraint-4): 본문 196 + 모드 바 52 + 아래
 * 안전 영역. 본문이 넘치면 안에서 세로로 스크롤하고 모드 전환은 본문만 바꾼다 — 도크가 움직이면 본문(flex-1)이
 * 밀려 fit 스테이지의 cqh가 바뀌고 티켓이 흔들린다(#563이 옛 레일에서 같은 이유로 슬롯을 고정했다).
 * scripts/measure-chrome.mjs의 dock 기준선이 이 두 값에 물린다(__tests__/measureChromeBaselineCoupling.test.ts).
 */
export const DOCK_BODY_PX = 196;
export const DOCK_MODEBAR_PX = 52;

const MODES: { key: DockMode; label: string }[] = [
  { key: 'photo', label: '사진' },
  { key: 'info', label: '정보' },
  { key: 'design', label: '디자인' },
];

const DOCK_PANEL_ID = 'dock-panel';

/**
 * 편집 도크(#826 S2 E-01) — 사진 · 정보 · 디자인 세 모드를 한 곳에 둔 하단 고정 영역.
 * 모드 바(사진 · 정보 · 디자인)는 APG tabs이고 선택은 위쪽 2px 강조색 막대다. 정보 탭에는 필수(제목 · 개봉일)가
 * 비었을 때 앰버 점이 선다(접근명엔 sr-only '필수 미입력').
 *
 * 숨김(max 보기 · 랜딩)은 호출부가 hidden으로 CSS만 건다 — 조건부 unmount면 도구 선택 같은 로컬 state가 왕복마다
 * 리셋된다(#297 P1과 같은 패턴).
 */
export function EditorDock({
  photo,
  mode,
  onModeChange,
  hidden,
  onField,
  onMissingField,
  onOcrOpen,
  ocrBusy,
  onPosterPick,
  onPosterRecrop,
}: {
  photo: Photo;
  mode: DockMode;
  onModeChange: (next: DockMode) => void;
  hidden: boolean;
  /** 필드·로고 인플레이스 편집 진입 — 셸의 handleField. */
  onField: (target: SheetTarget) => void;
  /** 필수 누락 행 진입(#776) — 셸의 openMissingField. */
  onMissingField: (target: TicketField) => void;
  onOcrOpen: () => void;
  ocrBusy: boolean;
  onPosterPick: () => void;
  /** 포스터 원본이 있을 때만 — 없으면 자르기 버튼이 비활성이다. */
  onPosterRecrop?: () => void;
}) {
  const [tool, setTool] = useState<DesignToolId>('mood');
  const infoMissing = missingExportFields(photo.state.movieInfo).length > 0;
  return (
    <div
      data-testid="editor-dock"
      className={`relative shrink-0 rounded-t-[12px] border-t border-hair-strong bg-s1${hidden ? ' hidden' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        id={DOCK_PANEL_ID}
        role="tabpanel"
        aria-labelledby={`dock-mode-tab-${mode}`}
        data-testid="dock-body"
        className="flex flex-col overflow-hidden px-4 pt-1"
        style={{ height: DOCK_BODY_PX }}
      >
        {mode === 'photo' && (
          <PhotoPane photo={photo} onPosterPick={onPosterPick} onPosterRecrop={onPosterRecrop} onEditField={onField} />
        )}
        {mode === 'info' && (
          <InfoPane photo={photo} onField={onField} onMissingField={onMissingField} onOcrOpen={onOcrOpen} ocrBusy={ocrBusy} />
        )}
        {mode === 'design' && (
          <DesignPane photo={photo} tool={tool} onToolChange={setTool} onEditField={onField} />
        )}
      </div>
      <TabBar
        items={MODES.map((m) => ({
          key: m.key,
          label: m.label,
          badge:
            m.key === 'info' && infoMissing ? (
              <>
                <span aria-hidden="true" data-testid="info-missing-dot" className="ml-1 inline-block h-1.5 w-1.5 -translate-y-1 rounded-full bg-warn align-middle" />
                <span className="sr-only">필수 미입력</span>
              </>
            ) : undefined,
        }))}
        value={mode}
        onChange={onModeChange}
        ariaLabel="편집 모드"
        idPrefix="dock-mode"
        panelId={DOCK_PANEL_ID}
        className="grid grid-cols-3 border-t border-hair"
        style={{ height: DOCK_MODEBAR_PX }}
        tabClassName={(selected) =>
          `relative h-full text-body transition-colors before:absolute before:inset-x-[24%] before:top-0 before:h-0.5 ${
            selected ? 'font-semibold text-ink before:bg-accent' : 'font-medium text-ink-2 hover:text-ink'
          }`
        }
      />
    </div>
  );
}
