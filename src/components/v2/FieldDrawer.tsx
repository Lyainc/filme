import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { TicketComponents, TicketField } from '@/types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';
import { Eyebrow } from './Eyebrow';
import {
  FIELD_LABELS,
  launcherGroupsFor,
  STAMP_TARGETS,
  STAMP_KEYS,
  STAMP_LABELS,
  fieldPreview,
  stampPreview,
  type SheetTarget,
  type StampTarget,
} from '@/constants/fields';
import { ALL_FIELDS_ON, ALL_FIELDS_OFF_KEEP_REQUIRED, isRequiredField } from '@/constants/fieldVisibility';

// 표시 항목 일괄 스위치의 도메인 필드 집합(#261) — ALL_FIELDS_ON 키가 곧 전체 티켓 필드.
const ALL_FIELDS = Object.keys(ALL_FIELDS_ON) as TicketField[];

// 로고 크롭 모달 — StampSheet와 동일하게 dynamic(ssr:false)로 react-image-crop을 분리.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

type Photo = ReturnType<typeof usePhototicket>;

interface FieldDrawerProps {
  photo: Photo;
  /** 행 본문 탭 → 셸이 드로어를 닫고 인플레이스 편집(#354)을 연다. */
  onField: (target: SheetTarget) => void;
  onClose: () => void;
  /** 드로어 상단 슬롯 — 셸이 OcrUploadCard(티켓 자동입력)를 꽂는다. 업로드 후 유일한 OCR
      진입점(#388 — 본문 카드는 업로드 후 CSS hidden으로 드로어에 일원화). */
  children?: ReactNode;
}

/**
 * 모바일 필드 목록 우측 드로어(#355, v8 시안 §6). 마운트 = 열림 — 닫힘은 언마운트로 즉시
 * (FieldAccordion과 동일한 ponytail 판단: 여는 애니메이션만 CSS로 부드럽게).
 *
 * 유리(blur+알파 틴트)는 패널에만 쓰고 행은 불투명 카드(bg-surface-elevated)에 얹는다 —
 * 시안값(패널 알파 .36~.40 위 직접 텍스트)은 포스터에 따라 대비가 4.5:1 밑으로 깨진다(이슈 표).
 * 행 사이 여백과 패널 가장자리로 티켓이 비쳐 "뒤가 보인다"는 목적은 유지된다.
 * 셸은 포스터가 있을 때만 드로어를 열므로(.chrome-dark 확정) 유리 틴트는 다크 하나로 고정한다.
 *
 * 닫기 경로: 스와이프 →(드래그) + 백드롭 탭·Escape(비드래그 대체 경로, WCAG 2.2 SC 2.5.7).
 */
export function FieldDrawer({ photo, onField, onClose, children }: FieldDrawerProps) {
  const { movieInfo, fieldVisibility, components } = photo.state;
  useBodyScrollLock(true);
  // 표시 항목 일괄 단일 스위치(#261, #260 연계, #424에서 편집 메뉴→필드 목록 자리로 이전) — 전체
  // 켜짐 여부. 끄기는 필수 필드(title)를 켠 채 유지한다.
  const allVisOn = ALL_FIELDS.every((f) => fieldVisibility[f]);

  // 로고 크롭 모달(body 포털)이 떠 있는 동안엔 포커스 유지·Escape를 모달에 양보한다 —
  // 안 그러면 keepFocus가 모달 포커스를 계속 뺏고 Escape 한 번에 드로어까지 닫힌다(#355 리뷰 P1).
  const [cropOpen, setCropOpen] = useState(false);

  // 초기 포커스 + 간이 포커스 유지 — 패널 밖으로 새면 패널로 되돌린다(vaul이 하던 최소한만).
  // cropOpen이 풀리면 재실행돼 포커스가 드로어로 복귀한다.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cropOpen) return;
    panelRef.current?.focus();
    const keepFocus = (e: FocusEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        panelRef.current.focus();
      }
    };
    document.addEventListener('focusin', keepFocus);
    return () => document.removeEventListener('focusin', keepFocus);
  }, [cropOpen]);

  useEffect(() => {
    if (cropOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, cropOpen]);

  // 스와이프 →로 닫기 — 수평 이동이 우세하고 60px를 넘으면 닫는다.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy)) onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* 백드롭 탭 닫기 — 스와이프의 비드래그 대체 경로(WCAG 2.2 SC 2.5.7). */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="티켓 항목"
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="drawer-slide-in absolute inset-y-0 right-0 flex w-[min(78vw,320px)] flex-col outline-none"
        style={{
          background: 'rgba(18, 22, 24, 0.40)',
          backdropFilter: 'blur(13px)',
          WebkitBackdropFilter: 'blur(13px)',
          borderLeft: '1px solid rgba(255,255,255,0.10)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        }}
      >
        {/* 불투명 카드(bg-surface-elevated)에 얹는다 — 아래 행들과 동일 근거(위 주석): 패널 알파
            글래스 위 직접 텍스트는 라이트 테마에서 대비가 깨진다(#447, OcrUploadCard 슬롯 한정 발견). */}
        {children && (
          <div className="shrink-0 px-4 pb-3">
            <div className="rounded-card bg-surface-elevated p-3">{children}</div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-group overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
          {/* 전체 표시(#424) — 필드 목록과 한 자리에. 패널 위 직접 텍스트는 대비가 깨지므로(위 주석)
              다른 행과 동일하게 불투명 카드(bg-surface-elevated)에 얹는다. */}
          <button
            type="button"
            role="switch"
            aria-checked={allVisOn}
            onClick={() =>
              photo.updateFieldVisibility(allVisOn ? ALL_FIELDS_OFF_KEEP_REQUIRED : ALL_FIELDS_ON)
            }
            className="flex h-11 w-full items-center justify-between rounded-card bg-surface-elevated px-3 text-[11px] font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <span>전체 표시</span>
            <EyeIcon open={allVisOn} size={18} />
          </button>

          {launcherGroupsFor(components.layout).map((group) => (
            <section key={group.title} className="space-y-1.5">
              <Eyebrow className="px-1">{group.title}</Eyebrow>
              {group.fields.map((field) => (
                <DrawerRow
                  key={field}
                  label={FIELD_LABELS[field]}
                  preview={fieldPreview(field, movieInfo, components)}
                  locked={isRequiredField(field)}
                  checked={fieldVisibility[field]}
                  onToggle={(v) => photo.updateFieldVisibility({ [field]: v })}
                  onOpen={() => onField(field)}
                />
              ))}
            </section>
          ))}

          <section className="space-y-1.5">
            <Eyebrow className="px-1">Logos</Eyebrow>
            {STAMP_TARGETS.map((target) => (
              <LogoRow
                key={target}
                target={target}
                photo={photo}
                onOpen={() => onField(target)}
                onCropOpenChange={setCropOpen}
              />
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * 드로어 행 — 불투명 카드(유리 패널 위 대비 안전 표면). 라벨 11px + 현재값 + 우측 컨트롤.
 * 필수 필드는 눈 대신 자물쇠(토글 불가), 로고 행은 extra로 업로드 버튼을 끼운다.
 */
function DrawerRow({
  label,
  preview,
  locked = false,
  checked,
  onToggle,
  onOpen,
  extra,
}: {
  label: string;
  preview: string;
  locked?: boolean;
  checked: boolean;
  onToggle: (next: boolean) => void;
  onOpen: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center rounded-card bg-surface-elevated pr-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label} 편집`}
        className="flex min-h-touch min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-1 text-left"
      >
        <span className="shrink-0 text-[11px] font-medium text-fg-muted">{label}</span>
        {/* 빈 값도 fg-muted — fg-faint(#6B7280)는 카드(#1E2326) 위 3.28:1로 4.5:1 미달(#355 완료 조건). */}
        <span className={`ml-auto min-w-0 truncate text-right text-[13px] ${preview ? 'text-fg' : 'text-fg-muted'}`}>
          {preview || '비어 있음'}
        </span>
      </button>
      {extra}
      {locked ? (
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-fg-muted"
          title="필수 항목 — 항상 표시돼요"
          aria-label={`${label} 필수 항목`}
          role="img"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${label} 티켓에 표시`}
          onClick={() => onToggle(!checked)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center transition-colors ${
            checked ? 'text-fg' : 'text-fg-muted'
          }`}
        >
          <EyeIcon open={checked} size={18} />
        </button>
      )}
    </div>
  );
}

/** 로고(극장/포맷) 행 — 업로드 버튼(44px)이 useLogoCrop 자유 크롭 흐름(#220)으로 이미지를 채운다. */
function LogoRow({
  target,
  photo,
  onOpen,
  onCropOpenChange,
}: {
  target: StampTarget;
  photo: Photo;
  onOpen: () => void;
  /** 크롭 모달(body 포털) 열림/닫힘 통지 — 드로어가 포커스·Escape를 양보하도록. */
  onCropOpenChange: (open: boolean) => void;
}) {
  const keys = STAMP_KEYS[target];
  const components = photo.state.components;
  const imageUrl = String(components[keys.image] ?? '');
  const setImage = (url: string) =>
    photo.updateComponents({ [keys.image]: url } as Partial<TicketComponents>);
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(setImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 두 로고 행이 콜백을 공유하지만 파일 다이얼로그는 한 번에 하나만 열리므로 boolean으로 충분.
  useEffect(() => {
    onCropOpenChange(rawSrc != null);
  }, [rawSrc, onCropOpenChange]);

  return (
    <>
      <DrawerRow
        label={STAMP_LABELS[target]}
        preview={stampPreview(target, components)}
        checked={!!components[keys.visible]}
        onToggle={(v) => photo.updateComponents({ [keys.visible]: v } as Partial<TicketComponents>)}
        onOpen={onOpen}
        extra={
          <button
            type="button"
            aria-label={`${STAMP_LABELS[target]} 이미지 업로드`}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-fg-muted transition-colors hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
        }
      />
      {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus) — StampSheet와 동일 패턴. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        aria-label={`${STAMP_LABELS[target]} 이미지 파일`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.type.startsWith('image/')) openFile(file);
          e.target.value = '';
        }}
        className="sr-only"
      />
      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          aspect={undefined}
          title="로고 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </>
  );
}
