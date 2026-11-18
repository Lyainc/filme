import { useState } from 'react';
import type { TicketField } from '@/types';
import type { SheetTarget } from '@/constants/fields';
import { usePhototicket } from '@/hooks/usePhototicket';
import { EditorDock, type DockMode } from '@/components/v2/dock/EditorDock';

type Photo = ReturnType<typeof usePhototicket>;

/** 마지막 렌더의 photo — 상태(문자열 probe로 못 담는 객체)를 테스트가 직접 읽는다. */
export const dockProbe: { photo: Photo | null; field: SheetTarget[]; missing: TicketField[]; picks: number; recrops: number; ocr: number } = {
  photo: null,
  field: [],
  missing: [],
  picks: 0,
  recrops: 0,
  ocr: 0,
};

export function resetDockProbe() {
  dockProbe.photo = null;
  dockProbe.field = [];
  dockProbe.missing = [];
  dockProbe.picks = 0;
  dockProbe.recrops = 0;
  dockProbe.ocr = 0;
}

/**
 * EditorDock 단독 하네스 — 셸 없이 도크만 실제 usePhototicket에 물려 연다. 셸이 쥐는 통로(인플레이스 편집·OCR 열기·
 * 포스터 선택)는 호출 기록만 남기고, 상태는 dockProbe로 읽는다. 모듈 mock 없음(전역 누수 회피).
 */
export function DockHarness({
  mode = 'design',
  withOriginal = false,
  ocrBusy = false,
}: {
  mode?: DockMode;
  withOriginal?: boolean;
  ocrBusy?: boolean;
}) {
  const photo = usePhototicket();
  dockProbe.photo = photo;
  const [m, setM] = useState<DockMode>(mode);
  return (
    <EditorDock
      photo={photo}
      mode={m}
      onModeChange={setM}
      hidden={false}
      onField={(t) => dockProbe.field.push(t)}
      onMissingField={(t) => dockProbe.missing.push(t)}
      onOcrOpen={() => {
        dockProbe.ocr++;
      }}
      ocrBusy={ocrBusy}
      onPosterPick={() => {
        dockProbe.picks++;
      }}
      onPosterRecrop={
        withOriginal
          ? () => {
              dockProbe.recrops++;
            }
          : undefined
      }
    />
  );
}
