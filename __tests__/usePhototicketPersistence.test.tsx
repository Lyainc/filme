/**
 * #310 — 입력값 자동 영속 → 명시적 임시저장/초기화 전환.
 *
 * 이전(#178)엔 movieInfo/components/fieldVisibility 변경마다 400ms 디바운스로 무조건
 * localStorage에 썼다. saveDraft()/clearDraft() 명시적 함수로 대체되며:
 *  - 쓰기는 saveDraft() 호출 시에만, 디바운스 없이 즉시 일어난다.
 *  - clearDraft()가 저장 키를 지우고 상태를 INITIAL_STATE로 되돌리는, 이전엔 없던 진입점을 제공한다.
 * 마운트 시 자동 복원(loadPersisted)은 이 이슈의 스코프 밖 — 그대로 유지되고 아래 테스트도 이를 검증한다.
 */
import { afterEach, describe, expect, test, mock, jest } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { usePhototicket } from '../src/hooks/usePhototicket';
import { defaultIntensityForTexture, LEGACY_TEXTURE_MIGRATION } from '../src/utils/textureRecipes';

const KEY = 'filme:phototicket:v1';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // 아래 fake-timer 테스트가 실패해도 다음 테스트로 새는 걸 막는다 — 다른 파일 컨벤션과 통일(#190 nit).
  jest.useRealTimers();
});

describe('#310 usePhototicket saveDraft/clearDraft', () => {
  test('saveDraft()는 디바운스 없이 즉시 movieInfo/components/fieldVisibility를 저장한다(포스터 제외)', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '기생충' });
      result.current.updateComponents({ themeColor: '#8E4E69' });
    });
    // 업데이트 직후엔 saveDraft를 부르기 전이라 아직 아무것도 안 쓰여 있어야 한다.
    expect(window.localStorage.getItem(KEY)).toBeNull();

    act(() => {
      result.current.saveDraft();
    });
    // 디바운스가 없으므로 waitFor 없이 동기로 즉시 읽힌다.
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    expect(saved.movieInfo?.title).toBe('기생충');
    expect(saved.components?.themeColor).toBe('#8E4E69');
    // 포스터(croppedImageUrl)·recommendedColors는 직렬화 대상이 아니다.
    expect(saved.croppedImageUrl).toBeUndefined();
    expect(saved.recommendedColors).toBeUndefined();
  });

  test('saveDraft()를 부르지 않으면 상태 변경만으로는 아무것도 저장되지 않는다(자동저장 폐지)', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '기생충' });
    });
    // 옛 디바운스(400ms)가 있었다면 걸릴 시간을 넉넉히 흘려도 여전히 비어 있어야 한다 — 지금은
    // 그 타이머 자체가 없으므로 fake timer 전진만으로 실시간 대기 없이 같은 조건을 검증한다.
    jest.useFakeTimers();
    act(() => jest.advanceTimersByTime(500));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  test('마운트 시 저장분을 복원한다(자동 복원은 이번 스코프 밖 — 그대로 유지)', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      movieInfo: { title: '복원된제목' },
      components: { texture: 'vintage' },
      fieldVisibility: { actors: true },
    }));
    const { result } = renderHook(() => usePhototicket());
    await waitFor(() => {
      // 얕은 병합 — 저장에 없는 필드는 INITIAL 기본값 유지. 레거시 단일 texture는 {material,
      // coating}로 매핑돼 복원된다(#475 c4).
      expect(result.current.state.movieInfo.title).toBe('복원된제목');
      expect(result.current.state.components.material).toBe('vintage');
      expect(result.current.state.components.coating).toBe('none');
      expect(result.current.state.components.layout).toBe('minimal');
      expect(result.current.state.fieldVisibility.actors).toBe(true);
    });
  });

  test('#475 c4 — 레거시 단일 texture 8종이 저장분 복원 시 migration_map대로 {material, coating}에 매핑된다', async () => {
    for (const [legacyTexture, mapped] of Object.entries(LEGACY_TEXTURE_MIGRATION)) {
      window.localStorage.clear();
      window.localStorage.setItem(KEY, JSON.stringify({
        movieInfo: {},
        components: { texture: legacyTexture, textureIntensity: 0.42 },
        fieldVisibility: {},
      }));
      const { result, unmount } = renderHook(() => usePhototicket());
      await waitFor(() => {
        expect(result.current.state.components.material).toBe(mapped.material);
        expect(result.current.state.components.coating).toBe(mapped.coating);
      });
      // 강도는 코팅형 레거시 값이면 coatingIntensity로, 재질형이면 materialIntensity로 실린다.
      const onCoating = ['none', 'hologram', 'metal', 'scodix'].includes(legacyTexture);
      if (onCoating) {
        expect(result.current.state.components.coatingIntensity).toBe(0.42);
      } else {
        expect(result.current.state.components.materialIntensity).toBe(0.42);
      }
      unmount();
    }
  });

  test('saveDraft()는 업로드 로고 blob: URL을 비운다(chain·format 둘 다)', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateComponents({
        chain: 'blob:abc', chainLabel: 'CGV',
        format: 'blob:def', formatLabel: 'IMAX',
      });
    });
    // saveDraft는 별도 act로 — 같은 act 안에서 부르면 위 setState가 아직 반영 안 된
    // result.current 클로저(구 state)를 읽어버린다(renderHook 재렌더 경계 유의).
    act(() => {
      result.current.saveDraft();
    });
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    expect(saved.components?.chain).toBe('');
    expect(saved.components?.format).toBe('');
    expect(saved.components?.chainLabel).toBe('CGV'); // 라벨은 유지
    expect(saved.components?.formatLabel).toBe('IMAX');
  });

  test('손상된 저장 데이터는 무시하고 INITIAL로 시작', () => {
    window.localStorage.setItem(KEY, 'not-json{');
    const { result } = renderHook(() => usePhototicket());
    // throw 없이 기본값으로 마운트.
    expect(result.current.state.movieInfo.title).toBe('');
  });

  test('clearDraft()는 저장 키를 지우고 상태를 INITIAL_STATE로 되돌린다', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      movieInfo: { title: '기생충' },
      components: { texture: 'vintage' },
      fieldVisibility: { actors: true },
    }));
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '또 다른 제목', seat: 'H12' });
      result.current.updateFieldVisibility({ actors: true });
    });
    expect(result.current.state.movieInfo.title).toBe('또 다른 제목');

    act(() => {
      result.current.clearDraft();
    });

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.state.movieInfo.title).toBe('');
    expect(result.current.state.movieInfo.seat).toBe('');
    expect(result.current.state.components.material).toBe('original');
    expect(result.current.state.components.coating).toBe('gloss');
    expect(result.current.state.croppedImageUrl).toBeNull();
  });

  test('clearDraft() 후 coating 전환 시 그 coating 기본 강도가 적용된다 — 강도 touchedRef도 리셋(#434 PR #472 P1, #475 축분리)', () => {
    const { result } = renderHook(() => usePhototicket());
    // 강도 슬라이더 직접 조작 → coatingIntensityTouchedRef=true
    act(() => {
      result.current.updateComponents({ coating: 'hologram', coatingIntensity: 0.3 });
    });
    expect(result.current.state.components.coatingIntensity).toBe(0.3);

    // 초기화 — 강도 touched도 리셋되어야 한다(밝기와 대칭)
    act(() => {
      result.current.clearDraft();
    });

    // 초기화 후 coating 전환 → 그 coating 기본 강도 적용. touched가 리셋 안 됐으면 이 분기가 스킵돼
    // 리셋 후 값(INITIAL 1.0)이 남는다 — 그게 버그였다.
    act(() => {
      result.current.updateComponents({ coating: 'metal' });
    });
    expect(result.current.state.components.coatingIntensity).toBe(defaultIntensityForTexture('metal'));
  });

  test('clearDraft()는 남아있던 croppedImageUrl을 revoke한다(handleImageUpload와 동일 패턴)', () => {
    const revoked: string[] = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = mock((u: string) => revoked.push(u));

    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.handleImageUpload('blob:mock/poster');
    });
    expect(result.current.state.croppedImageUrl).toBe('blob:mock/poster');

    act(() => {
      result.current.clearDraft();
    });
    expect(revoked).toEqual(['blob:mock/poster']);
    expect(result.current.state.croppedImageUrl).toBeNull();

    URL.revokeObjectURL = origRevoke;
  });

  test('clearDraft()는 chain·format 로고 blob: URL도 revoke한다(poster와 동일 취급)', () => {
    const revoked: string[] = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = mock((u: string) => revoked.push(u));

    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateComponents({ chain: 'blob:mock/chain', format: 'blob:mock/format' });
    });

    act(() => {
      result.current.clearDraft();
    });

    expect(revoked.sort()).toEqual(['blob:mock/chain', 'blob:mock/format']);
    expect(result.current.state.components.chain).toBe('');
    expect(result.current.state.components.format).toBe('');

    URL.revokeObjectURL = origRevoke;
  });
});
