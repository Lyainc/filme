/**
 * #492 회귀 테스트 — DESIGN '크기' 섹션의 포스터 크롭·채우기.
 *
 * (a) 크기 섹션의 "포스터 다시 크롭"이 셸의 재크롭 진입점(onRecropPoster)에 배선된다 —
 *     모바일 rail·데스크톱 패널 두 화면 모두. 크롭 파이프라인 자체는 셸이 소유하므로
 *     여기서 검증할 건 "그 진입점이 실제로 불리는가" 하나뿐이다.
 * (b) 셸이 진입점을 안 넘기면(원본 없음) 버튼이 아예 안 뜬다 — 죽은 컨트롤 방지.
 *     POSTER_FILL_MOODS 게이트와 같은 규칙이라 같은 파일에서 같이 못 박는다.
 * (c) 크기 섹션 토글로 켠 posterFit='cover'가 **무드 마크업까지** 직접 prop 경로와 같다.
 *     posterFitMoodRender.test.tsx는 prop을 직접 넣어 렌더만 검증하고,
 *     desktopDesignPanel.test.tsx(f)는 state 반영만 검증한다 — 그 사이(UI 조작이 만든 상태가
 *     실제 티켓 픽셀로 같은 결과를 내는가)가 이 테스트다. UI 경로가 posterFit 말고 다른
 *     필드까지 건드리면 마크업이 갈리며 여기서 잡힌다.
 *
 * 셋업은 designRail.test.tsx / desktopDesignPanel.test.tsx 미러 — 실제 usePhototicket을
 * 쓰고 모듈 mock은 없다(전역 누수 회피). localStorage 디바운스 저장 때문에 매번 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { DesktopDesignPanel } from '@/components/v2/DesktopDesignPanel';
import { MoodMinimal } from '@/components/moods/MoodMinimal';
import type { MovieInfo, TicketComponents } from '@/types';

const RECROP_LABEL = '포스터 다시 크롭';

const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
};

// 하네스 밖에서 마지막 렌더의 components를 집어온다 — (c)가 "UI가 만든 상태"를 그대로
// 무드에 먹여야 하므로 DOM probe(문자열)로는 부족하다.
let latestComponents: TicketComponents | null = null;

function Harness({
  surface,
  onRecropPoster,
}: {
  surface: 'mobile' | 'desktop';
  onRecropPoster?: () => void;
}) {
  const photo = usePhototicket();
  latestComponents = photo.state.components;
  return surface === 'mobile' ? (
    <DesignRail photo={photo} onRecropPoster={onRecropPoster} />
  ) : (
    <DesktopDesignPanel photo={photo} onRecropPoster={onRecropPoster} />
  );
}

// 모바일 rail은 한 번에 한 섹션만 펼치므로 '크기' 아이콘을 먼저 눌러야 본문이 살아난다
// (접힘 패널은 inert라 클릭이 안 먹는다). 데스크톱은 상시 스택이라 열 게 없다.
async function openSize(user: ReturnType<typeof userEvent.setup>, surface: 'mobile' | 'desktop') {
  if (surface === 'mobile') await user.click(screen.getByRole('button', { name: '크기' }));
}

beforeEach(() => {
  window.localStorage.clear();
  latestComponents = null;
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe.each([['mobile'], ['desktop']] as const)('크기 섹션 포스터 크롭 (%s, #492)', (surface) => {
  test('(a) "포스터 다시 크롭" 클릭 → 셸의 재크롭 진입점이 1회 호출된다', async () => {
    const user = userEvent.setup();
    let calls = 0;
    render(<Harness surface={surface} onRecropPoster={() => { calls++; }} />);
    await openSize(user, surface);

    await user.click(screen.getByRole('button', { name: RECROP_LABEL }));
    expect(calls).toBe(1);
  });

  test('(b) 셸이 진입점을 안 넘기면(원본 없음) 버튼 자체가 없다', async () => {
    const user = userEvent.setup();
    render(<Harness surface={surface} />);
    await openSize(user, surface);

    expect(screen.queryByRole('button', { name: RECROP_LABEL })).toBeNull();
  });
});

describe('크기 섹션 포스터 채우기 (#492/#527)', () => {
  test('(c) 토글로 켠 cover가 posterFit을 직접 넣은 경로와 무드 마크업까지 같다', async () => {
    const user = userEvent.setup();
    render(<Harness surface="desktop" />);

    // 토글 전 상태 = 직접 경로의 베이스. minimal이 기본 무드라 POSTER_FILL_MOODS 안이다.
    const before = latestComponents!;
    expect(before.layout).toBe('minimal');
    expect(before.posterFit ?? 'contain').toBe('contain');

    await user.click(screen.getByRole('radio', { name: '꽉 채우기' }));

    const after = latestComponents!;
    // ① 상태 층 — UI가 건드린 필드는 posterFit 하나뿐이어야 한다(무드가 안 읽는 필드를
    //    같이 건드려도 여기서 잡힌다. 아래 마크업 비교만으론 그게 통과한다).
    expect(after).toEqual({ ...before, posterFit: 'cover' });

    const draw = (components: TicketComponents) =>
      renderToStaticMarkup(
        <MoodMinimal movieInfo={MOVIE} components={components} croppedImageUrl="blob:test" />,
      );
    // ② 렌더 층 — UI가 만든 상태 ≡ posterFit을 직접 얹은 상태(크롭 모달 시절의 경로).
    expect(draw(after)).toBe(draw({ ...before, posterFit: 'cover' }));
    // ③ 그 비교가 공허하지 않다는 확인 — cover와 contain은 실제로 다른 마크업이어야 한다.
    //    MoodMinimal이 posterFit 소비를 그만두면 ②가 조용히 통과하는 걸 여기서 막는다.
    expect(draw(after)).not.toBe(draw({ ...before, posterFit: 'contain' }));
  });
});
