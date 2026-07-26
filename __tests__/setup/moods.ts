/**
 * 무드 6종 표 공용 픽스처(#543) — 10개 테스트 파일이 각자 들고 있던 무드 표. 무드를 추가·개명하면
 * 그 10곳을 다 고쳐야 했고, 빠뜨린 파일은 새 무드를 조용히 검증에서 뺐다.
 *
 * 9곳은 `const MOODS = [['minimal', MoodMinimal], …] as const` 배열이었고, launcherFieldGating만
 * 이미 `Record<LayoutId, …>`였다 — 아래 결론은 새 발상이 아니라 그 한 곳이 먼저 쓰던 것이다.
 * `Record<LayoutId, …>`가 단일 소스인 게 핵심이다 — 배열이면 무드가 빠져도 컴파일이 통과하지만,
 * Record는 LayoutId 유니온과 키가 어긋나는 순간(추가·개명·삭제) 여기서 컴파일이 깨진다.
 * 표는 `ALL_MOODS`로 파생시키니 test.each에 그대로 넘길 수 있다.
 *
 * 서브셋(특정 무드를 뺀 목록)은 여기 두지 않는다 — 왜 뺐는지가 그 테스트의 논거라 테스트 파일이
 * 소유해야 한다. 대신 `ALL_MOODS.filter(([id]) => id !== 'editorial')`처럼 파생시켜야 개명 감지가
 * 서브셋에도 그대로 걸린다(하드코딩 재나열은 그 보증을 잃는다).
 */
import type { ComponentType } from 'react';
import { MoodMinimal } from '../../src/components/moods/MoodMinimal';
import { MoodCriterion } from '../../src/components/moods/MoodCriterion';
import { Mood35mm } from '../../src/components/moods/Mood35mm';
import { MoodEditorial } from '../../src/components/moods/MoodEditorial';
import { MoodStub } from '../../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../../src/components/moods/Mood35mmLandscape';
import type { MoodProps } from '../../src/components/moods/_shared';
import type { LayoutId } from '../../src/types';

/** 무드 id → 컴포넌트. LayoutId 전수 매핑이라 무드 추가·개명이 여기서 컴파일 에러로 잡힌다. */
export const MOOD_COMPONENTS: Record<LayoutId, ComponentType<MoodProps>> = {
  minimal: MoodMinimal,
  criterion: MoodCriterion,
  '35mm': Mood35mm,
  editorial: MoodEditorial,
  stub: MoodStub,
  '35mm-landscape': Mood35mmLandscape,
};

/** `test.each`용 [id, 컴포넌트] 표 — MOOD_COMPONENTS 선언 순서 그대로. */
export const ALL_MOODS = Object.entries(MOOD_COMPONENTS) as [LayoutId, ComponentType<MoodProps>][];
