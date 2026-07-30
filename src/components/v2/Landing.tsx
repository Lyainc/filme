import type { ReactNode } from 'react';
import { AppFooter } from './AppFooter';
import { PrimaryCta } from './PrimaryCta';
import { Wordmark } from './Wordmark';

/**
 * 랜딩 오버레이(#614) — 편집 셸 위를 덮는 `fixed` 레이어. 새 라우트가 아니라 오버레이인 이유는
 * CTA가 파일 다이얼로그를 여는 데 있다: 라우트를 갈면 사용자 제스처 컨텍스트가 끊겨 `input.click()`이
 * 무시되는 브라우저가 있고, 오버레이면 셸이 이미 마운트돼 있어 걷는 순간 지연 0으로 드러난다.
 *
 * **셸 안에서 렌더된다** — 이슈 #614의 구조도는 `index.tsx`의 형제로 그렸지만, 그러면 랜딩의 OCR
 * 진입점이 셸의 `OcrUploadCard`와 다른 인스턴스가 된다. 그 컴포넌트는 랜딩·업로드 후에 걸쳐 같은
 * 트리 위치의 단일 인스턴스로 남아야 in-flight KOBIS 보강이 유실되지 않으므로(#363 / PR #372 리뷰
 * P1), 셸이 쥔 그 인스턴스를 이 컴포넌트의 children으로 받아 자리만 빌려준다. 이 컴포넌트가 항상
 * 마운트되고 `hidden`으로만 숨는 것도 같은 이유다(조건부 unmount = 그 레이스 부활).
 *
 * `fixed`의 컨테이닝 블록은 뷰포트가 아니라 `PhoneFrame`이다(contain:paint, #607) — 데스크톱
 * 1440 뷰포트에서도 오버레이가 400px 프레임 안에 선다. `measure-chrome.mjs`의 frameFit 축이
 * 이걸 판정한다.
 */
export function Landing({
  hidden,
  onCta,
  dropProps,
  dragOver,
  children,
}: {
  hidden: boolean;
  /** CTA 탭 — 셸의 숨은 포스터 input을 그 자리에서 click()한다(같은 제스처, 라우트 전환 0). */
  onCta: () => void;
  /** 셸의 포스터 드롭 핸들러(#607) — 점선 드롭존이 이 오버레이에 흡수되며 같이 넘어왔다. */
  dropProps: Record<string, unknown>;
  dragOver: boolean;
  /** OCR 진입점 슬롯 — 셸이 소유한 단일 OcrUploadCard 인스턴스가 들어온다. */
  children: ReactNode;
}) {
  return (
    <div
      data-testid="landing"
      {...dropProps}
      // 숨김은 unmount가 아니라 display:none이다(위 주석의 OcrUploadCard 단일 인스턴스 제약).
      // 'hidden'과 'flex'를 동시에 얹으면 Tailwind 유틸 순서에 판정이 걸리므로 배타로 쓴다.
      className={
        hidden
          ? 'hidden'
          : `fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg ${
              dragOver ? 'outline outline-2 -outline-offset-2 outline-accent' : ''
            }`
      }
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* 셸 헤더가 오버레이에 가리므로 브랜드를 여기서도 세운다. 셸 헤더의 워드마크가 h1이라
          기본 span으로 둔다(h1 중복 방지 — 셸은 뒤에 계속 마운트돼 있다). */}
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
        <Wordmark />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        <h1 className="text-[26px] font-bold leading-[1.25] tracking-tight text-fg break-keep">
          포스터 한 장이,
          <br />내 굿즈가 돼요
        </h1>
        <p className="max-w-[300px] text-[14px] leading-relaxed text-fg-muted break-keep">
          사진 한 장이면 6가지 티켓. 저장해서 영화관 포토티켓 기계에서 그대로 뽑을 수 있어요.
        </p>

        <div className="mt-2 w-full max-w-[280px]">
          <PrimaryCta
            label="포스터 올리기"
            onClick={onCta}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M8 8l4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            }
          />
          {/* KOBIS는 포스터 이미지를 안 준다 — CTA를 "포스터"로 잠그면 포스터를 조달 못 한
              대부분이 여기서 끝난다. 실제로 받는 건 임의 이미지이므로 그 벽을 한 줄로 없앤다(#614). */}
          <p className="mt-2 text-[12px] leading-snug text-fg-faint break-keep">
            영화 스틸컷이나 직접 찍은 사진도 돼요.
          </p>
        </div>

        {/* OCR 보조 진입점 — 포스터 CTA가 주연이고 이건 직하 보조다(#142 위계). */}
        {children}
      </div>

      {/* 미인증 티켓 고지는 법적 성격이라 랜딩에서 사라지면 안 된다(#614) — AppFooter가 소유.
          여기만 조건부 unmount다: 항상 마운트가 필요한 건 상태를 든 OcrUploadCard뿐이고, 고지가
          숨은 채로 DOM에 남으면 "편집 화면엔 고지가 없다"(#327/#363)를 DOM 부재로 재는 회귀
          테스트가 헛돈다. 숨김 상태에선 어차피 display:none이라 화면상 차이는 없다. */}
      {!hidden && <AppFooter ambient />}
    </div>
  );
}
