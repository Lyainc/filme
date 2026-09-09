/**
 * `MoodStub.tsx`의 배경 스탬프 박스가 리터럴 좌표(#530→#728→#753→#761)에서 실측 앵커링(#768)으로
 * 바뀌면서, `moodStubPatternBoxCoupling.test.ts`(리터럴 해시 잠금)의 전제 자체가 사라졌다 — 박스는
 * 더 이상 "페이퍼 스텁 소스가 그때 그대로인가"가 아니라 "스페이서의 실제 렌더 rect에서 옳게
 * 유도되는가"로 검증해야 한다. 이 파일이 그 새 불변식이고, 두 축을 나눠 잠근다.
 *
 * ① `anchorStampBox`는 순수 함수라(부작용 없음, 입력 rect만으로 출력 결정) DOM 렌더·
 * ResizeObserver·happy-dom의 getBoundingClientRect 제약(항상 {0,0,0,0}, floatingToolbar.test.tsx
 * 선례와 동일 — 그래서 이 함수를 MoodStub 밖으로 안 빼고 export만 해서 직접 부른다) 없이 계산
 * 자체를 검증한다.
 *
 * ② 계산이 옳아도 **엉뚱한 스페이서에 배선**되면 소용없다 — admissionOn&&filmOn일 때 가운데
 * (Admission-Film 사이), 그 외엔 트레일링(콘텐츠 뒤, 항상 렌더) 중 실제로 비어 있는 쪽에
 * `spacerRef`가 걸리는지는
 * happy-dom에서 ①처럼 rect로 못 잰다(root/spacer 폭이 항상 0이라 `anchorStampBox`가 항상 null을
 * 반환해 FALLBACK_STAMP_BOX로 항상 통과 — 두 ref 조건문이 통째로 삭제되거나 뒤집혀도 안 걸린다,
 * requirement-gap 리뷰 지적). 그래서 지오메트리가 아니라 **DOM 구조**로 잰다 — 두 spacer div에
 * 걸어둔 `data-pattern-spacer="true"` 마커(ref와 같은 조건)가 admissionOn/filmOn 네 조합 각각에서
 * 정확히 하나만 서고, "Admission"/"The Film" 텍스트와의 문서 순서가 기대한 자리(둘 다 켜졌을 때는
 * 그 사이, 아니면 콘텐츠 뒤)인지 `renderToStaticMarkup` 문자열 순서로 확인한다.
 */
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { anchorStampBox, MoodStub } from '@/components/moods/MoodStub';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

describe('anchorStampBox — 스페이서 실측 → 스탬프 박스 환산 (#768)', () => {
  test('스페이서가 스탬프보다 크면 우측 정렬·세로 중앙에 앉는다', () => {
    const root = { left: 0, top: 0, width: 960 };
    const spacer = { left: 56, top: 1000, width: 848, height: 190 };
    expect(anchorStampBox(root, spacer)).toEqual({ left: 604, top: 1074, width: 300, height: 42 });
  });

  test('프리뷰 배율과 무관하다 — root/spacer가 같은 배율로 축소돼도 자연좌표 결과는 같다', () => {
    const natural = anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 848, height: 190 })!;
    const scale = 0.4;
    const scaled = anchorStampBox(
      { left: 100, top: 50, width: 960 * scale },
      { left: 100 + 56 * scale, top: 50 + 1000 * scale, width: 848 * scale, height: 190 * scale }
    )!;
    // 부동소수점 배율 나눗셈이라 비트 단위 동일은 안 보장된다 — 자리수로 충분.
    expect(scaled.left).toBeCloseTo(natural.left, 9);
    expect(scaled.top).toBeCloseTo(natural.top, 9);
    expect(scaled.width).toBeCloseTo(natural.width, 9);
    expect(scaled.height).toBeCloseTo(natural.height, 9);
  });

  test('스탬프가 스페이서보다 크면 스페이서 크기로 줄어든다 — 절대 못 넘친다', () => {
    const root = { left: 0, top: 0, width: 960 };
    const spacer = { left: 700, top: 1200, width: 100, height: 10 };
    expect(anchorStampBox(root, spacer)).toEqual({ left: 700, top: 1200, width: 100, height: 10 });
  });

  test('root/spacer 폭·높이가 0이면(happy-dom) null — 호출부가 FALLBACK_STAMP_BOX를 유지한다', () => {
    expect(anchorStampBox({ left: 0, top: 0, width: 0 }, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
    expect(anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 0, height: 190 })).toBeNull();
    expect(anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 848, height: 0 })).toBeNull();
  });
});

describe('spacerRef 배선 — 실제로 비어 있는 스페이서 하나에만 걸린다 (#768)', () => {
  const BASE = makeMoodBase('stub');
  // 스탬프 이미지가 없으면 BackgroundPatternLayer 자체가 null이라 마커 유무 확인엔 영향 없다 —
  // 여기서 보는 건 스페이서 마커지 스탬프 레이어가 아니다.
  const admissionOff = { seat: false, watchDate: false, watchTime: false, screen: false, theater: false } as const;
  const filmOff = { runtime: false, rating: false, releaseDate: false, reissue: false, actors: false } as const;

  function render(fieldVisibility?: Record<string, boolean>) {
    return renderToStaticMarkup(
      <MoodStub movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl={null} fieldVisibility={fieldVisibility as never} />
    );
  }

  test('Admission·Film 둘 다 켜지면 마커가 그 사이(가운데 spacer)에 정확히 하나 선다', () => {
    const html = render();
    const admissionIdx = html.indexOf('Admission');
    const markerIdx = html.indexOf('data-pattern-spacer');
    const filmIdx = html.indexOf('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(admissionIdx).toBeGreaterThan(-1);
    expect(filmIdx).toBeGreaterThan(-1);
    expect(admissionIdx).toBeLessThan(markerIdx);
    expect(markerIdx).toBeLessThan(filmIdx);
  });

  test('Admission만 꺼지면 마커가 Film 콘텐츠 뒤(트레일링 spacer)에 선다', () => {
    const html = render(admissionOff);
    const filmIdx = html.indexOf('The Film');
    const markerIdx = html.indexOf('data-pattern-spacer');
    expect(html).not.toContain('Admission');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(filmIdx).toBeGreaterThan(-1);
    expect(filmIdx).toBeLessThan(markerIdx);
  });

  test('Film만 꺼지면 마커가 Admission 콘텐츠 뒤(트레일링 spacer)에 선다', () => {
    const html = render(filmOff);
    const admissionIdx = html.indexOf('Admission');
    const markerIdx = html.indexOf('data-pattern-spacer');
    expect(html).not.toContain('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(admissionIdx).toBeGreaterThan(-1);
    expect(admissionIdx).toBeLessThan(markerIdx);
  });

  test('둘 다 꺼지면 마커 하나만 선다(Admission·Film 텍스트는 없음)', () => {
    const html = render({ ...admissionOff, ...filmOff });
    expect(html).not.toContain('Admission');
    expect(html).not.toContain('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
  });
});
