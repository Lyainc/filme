import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import type { MoodProps } from '@/components/moods/_shared';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { SAMPLE_TICKETS } from '@/constants/sampleTickets';
import { getLayout } from '@/utils/layouts';
import type { LayoutId } from '@/types';

/**
 * 예시 티켓 스크린샷 하네스 — `scripts/capture-samples.mjs`가 읽는다.
 *
 * 무드를 **자연 픽셀 크기 그대로** 그린다(TicketRenderer의 스케일 래퍼를 안 태운다) — 폰트
 * 자동 축소·자간·말줄임이 실제 저장물과 같은 좌표에서 걸려야 스크린샷이 검토 자료로 쓸모가
 * 있기 때문이다. 스케일이 끼면 그 판정이 축소된 폭에서 나서 무엇이 넘쳤는지 못 본다.
 *
 * 프로덕션에선 404 — 배포에 실리면 안 되는 진단 페이지다.
 *
 * **`ssr: false`는 TicketRenderer를 따라한 게 아니라 필수다.** 무드를 정적 import로 넣으면
 * 서버가 한 번 그리는데, `truncateActorsToWidth`·`fitFontSizeToWidth`가 canvas `measureText`로
 * 폭을 재므로 서버엔 그 답이 없다 — 배우 4명짜리 표본에서 서버는 원문을, 클라이언트는
 * "외 1명"으로 줄인 문자열을 그려 hydration이 깨진다(dev 오버레이가 티켓을 덮는다).
 */
const MOODS: Record<LayoutId, React.ComponentType<MoodProps>> = {
  minimal: dynamic(() => import('@/components/moods/MoodMinimal').then((m) => m.MoodMinimal), { ssr: false }),
  criterion: dynamic(() => import('@/components/moods/MoodCriterion').then((m) => m.MoodCriterion), { ssr: false }),
  '35mm': dynamic(() => import('@/components/moods/Mood35mm').then((m) => m.Mood35mm), { ssr: false }),
  editorial: dynamic(() => import('@/components/moods/MoodEditorial').then((m) => m.MoodEditorial), { ssr: false }),
  stub: dynamic(() => import('@/components/moods/MoodStub').then((m) => m.MoodStub), { ssr: false }),
  '35mm-landscape': dynamic(() => import('@/components/moods/Mood35mmLandscape').then((m) => m.Mood35mmLandscape), { ssr: false }),
};

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} };

export default function SampleSheet() {
  return (
    <main style={{ background: '#8a8a8a', padding: 40, display: 'flex', flexDirection: 'column', gap: 40 }}>
      {SAMPLE_TICKETS.map((s) => {
        const layout = getLayout(s.components.layout);
        const Mood = MOODS[s.components.layout];
        return (
          <div
            key={s.id}
            data-sample={s.id}
            style={{ position: 'relative', width: layout.width, height: layout.height, overflow: 'hidden' }}
          >
            <Mood
              movieInfo={s.movieInfo}
              components={s.components}
              croppedImageUrl={s.posterSrc}
              fieldVisibility={ALL_FIELDS_ON}
              ghost={false}
            />
          </div>
        );
      })}
    </main>
  );
}
