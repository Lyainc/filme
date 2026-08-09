/**
 * #646 회귀 — 코드 정독 진단(2026-08-04)의 접근성 3항목.
 *
 * 1. FieldTap 키보드 접근 — display:contents 래퍼는 tabIndex를 줘도 포커스를 못 받았다(CSS 스펙).
 *    #646부터 FieldTap이 role/tabIndex/onKeyDown을 children 자신(실제 박스가 있는 노드)에
 *    cloneElement로 얹는다 — 실제 Tab 순회로 도달 가능한지, Enter로 활성화되는지를 잰다.
 * 2. sr-only file input 3곳의 aria-hidden 제거(FieldDrawer.tsx:297 판단 재적용) — tabbable인데
 *    aria-hidden이면 axe aria-hidden-focus 위반이라, 이제 aria-hidden이 없고 aria-label이 있다.
 * 3. 랜딩 이탈경로 2종 + OcrUndoBanner 버튼의 WCAG 2.5.8 최소 24×24 미달을 min-h-touch(44px)로
 *    채웠다 — 이 레포는 jest-dom·Tailwind가 테스트에 안 실려 getComputedStyle이 클래스를 반영하지
 *    않으므로(landingOverlay.test.tsx 컨벤션과 동일) className으로 잰다.
 */
import { useState } from 'react';
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoodStub } from '@/components/moods/MoodStub';
import { OcrUploadCard } from '@/components/v2/OcrUploadCard';
import { InPlaceFieldEditor } from '@/components/v2/InPlaceFieldEditor';
import { OcrUndoBanner } from '@/components/v2/OcrUndoBanner';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import type { SheetTarget } from '@/constants/fields';
import { mobileShellProps } from './shellHarness';
import { FULL_MOVIE } from './fixtures';

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;
const BASE: TicketComponents = {
  layout: 'stub', chain: '', format: '', chainLabel: '', formatLabel: '',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, chainScale: 1, formatScale: 1,
};

afterEach(cleanup);

describe('FieldTap 키보드 접근 (#646 항목1)', () => {
  test('실제 Tab 순회로 필드에 도달 + Enter로 onField 활성화', async () => {
    const user = userEvent.setup();
    const calls: SheetTarget[] = [];
    render(
      <MoodStub
        movieInfo={FULL_MOVIE}
        components={BASE}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    const target = screen.getByRole('button', { name: '제목 편집' });
    expect(target.tabIndex).toBe(0);

    // display:contents 시절엔 이 래퍼가 영원히 activeElement가 될 수 없었다 — 상한을 넉넉히 잡고
    // 실제로 도달하는지만 본다(순서 자체는 이 테스트의 관심사가 아니다).
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await user.tab();
      if (document.activeElement === target) reached = true;
    }
    expect(reached).toBe(true);

    await user.keyboard('{Enter}');
    expect(calls).toEqual(['title']);
  });

  test('스탬프(ChainStamp→TextStamp) 경로도 Tab 순회로 도달 + Enter로 활성화 (claude-review P1)', async () => {
    // 위 테스트는 MoodStub의 title(순수 <div>)만 잰다 — 이 PR이 cloneElement 포워딩 배선을 가장 많이
    // 추가한 대상은 StampRow가 감싸는 ChainStamp/FormatStamp의 3-branch 분기(이미지/텍스트라벨/
    // placeholder)라, 그중 텍스트 라벨 분기(TextStamp, _shared.tsx)가 실제로 role/tabIndex를 받아
    // Tab으로 도달 가능한지를 별도로 잰다.
    const user = userEvent.setup();
    const calls: SheetTarget[] = [];
    render(
      <MoodStub
        movieInfo={FULL_MOVIE}
        components={{ ...BASE, chainVisible: true, chainLabel: 'CGV' }}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    const target = screen.getByRole('button', { name: '극장 로고 편집' });
    expect(target.tabIndex).toBe(0);

    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await user.tab();
      if (document.activeElement === target) reached = true;
    }
    expect(reached).toBe(true);

    await user.keyboard('{Enter}');
    expect(calls).toEqual(['chain']);
  });

  test('순수 텍스트 조각(fieldPieces) 경로도 Tab 순회로 도달 + Enter로 활성화 (claude-review round 2 P1)', async () => {
    // FieldTap의 세 번째 분기 — children이 유효한 엘리먼트가 아니라 raw string일 때 FieldTap 자신이
    // <span {...interactiveProps}>로 새로 감싼다(cloneElement 재사용이 아니라 신규 노드 생성). 앞의 두
    // 테스트는 전부 isValidElement(cloneElement) 분기만 태우는데, 이 span 분기는 fieldPieces()(극장·
    // 상영관·좌석 등 값 있는 필드의 실제 텍스트)를 거치는 가장 흔한 FieldTap 호출 경로다 — theater
    // 필드(FULL_MOVIE.theater='메가박스 코엑스')로 실제로 검증한다.
    const user = userEvent.setup();
    const calls: SheetTarget[] = [];
    render(
      <MoodStub
        movieInfo={FULL_MOVIE}
        components={BASE}
        croppedImageUrl="blob:x"
        fieldVisibility={ALL_ON}
        onField={(f) => calls.push(f)}
      />
    );
    const target = screen.getByRole('button', { name: '극장 편집' });
    expect(target.tagName).toBe('SPAN');
    expect(target.tabIndex).toBe(0);

    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await user.tab();
      if (document.activeElement === target) reached = true;
    }
    expect(reached).toBe(true);

    await user.keyboard('{Enter}');
    expect(calls).toEqual(['theater']);
  });
});

describe('sr-only file input aria-hidden 제거 (#646 항목2)', () => {
  test('MobileEditorShell 기본 상태의 file input들 — aria-hidden 없음 + aria-label 있음', () => {
    function Harness() {
      const photo = usePhototicket();
      return <MobileEditorShell {...mobileShellProps(photo)} />;
    }
    render(<Harness />);
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.hasAttribute('aria-hidden')).toBe(false);
      expect(input.getAttribute('aria-label')).toBeTruthy();
    }
  });

  test('InPlaceFieldEditor 로고 업로드 input — aria-hidden 없음 + aria-label 있음', () => {
    function Harness() {
      const photo = usePhototicket();
      const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
      const [ticketEl, setTicketEl] = useState<HTMLDivElement | null>(null);
      return (
        <div>
          <div ref={setWrapperEl}>
            <div ref={setTicketEl}>
              <span data-field-tap="signature"><span>서명</span></span>
            </div>
          </div>
          {wrapperEl && ticketEl && (
            <InPlaceFieldEditor
              photo={photo}
              field="signature"
              wrapperEl={wrapperEl}
              ticketEl={ticketEl}
              onField={() => {}}
              onClose={() => {}}
              onLift={() => {}}
            />
          )}
        </div>
      );
    }
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.hasAttribute('aria-hidden')).toBe(false);
    expect(input.getAttribute('aria-label')).toBeTruthy();
  });

  test('OcrUploadCard input — aria-hidden 없음 + aria-label 있음', () => {
    render(
      <OcrUploadCard
        setInfo={() => {}}
        currentInfo={{} as Partial<MovieInfo>}
        onOcrApply={() => {}}
        ocrEpochRef={{ current: 0 }}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.hasAttribute('aria-hidden')).toBe(false);
    expect(input.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('탭 타깃 44px 미달 채움 (#646 항목3)', () => {
  test('랜딩 이탈경로 2종 — min-h-touch(44px)', () => {
    function Harness() {
      const photo = usePhototicket();
      return <MobileEditorShell {...mobileShellProps(photo)} />;
    }
    render(<Harness />);
    for (const name of ['포스터 있으면 올리기', '포스터 없이 직접 입력']) {
      expect(screen.getByRole('button', { name }).className).toContain('min-h-touch');
    }
  });

  test('OcrUndoBanner 되돌리기·확인 — min-h-touch(44px), 파괴적인 되돌리기가 더 작지 않다', () => {
    render(
      <OcrUndoBanner
        snapshot={{}}
        filledFields={new Set()}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    const cancelBtn = screen.getByRole('button', { name: '되돌리기' });
    const confirmBtn = screen.getByRole('button', { name: '확인' });
    expect(cancelBtn.className).toContain('min-h-touch');
    expect(confirmBtn.className).toContain('min-h-touch');
  });
});
