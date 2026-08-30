import type { LayoutId, MovieInfo, TicketComponents } from '@/types';

/**
 * 예시 티켓 6종 — 랜딩·전시용 데이터의 단일 소스.
 *
 * **영화 정보는 전부 창작이고, 극장 정보만 실재한다.** 실제 영화 포스터는 배급사에 저작권이
 * 있어 상용 서비스 예시로 못 쓰므로(포스터도 직접 생성한 이미지다), 제목·배우·평점은 지어냈다.
 * 반대로 극장·상영관은 실재하는 조합만 쓴다 — 없는 지점에 없는 특별관을 적으면 "실제"라는
 * 전제가 그 자리에서 깨진다.
 *
 * **로고는 라벨을 비우는 게 아니라 토글로 끈다.** CGV·롯데시네마·메가박스 로고는 상표라 넣지
 * 않는데, `chainLabel`만 비우면 나중에 값이 채워지는 경로가 생겼을 때 스탬프가 되살아난다.
 * `chainVisible`/`formatVisible`을 false로 두면 렌더 경로 자체가 없다. 극장 정보는 스탬프가
 * 아니라 `theater`/`screen` 텍스트 필드가 나른다.
 *
 * 동시에 **레이아웃 스트레스 테스트**를 겸한다 — 제목 2~17자, 배우 1~4명(외국 이름 포함),
 * 극장명 6~18자, 날짜 포맷 4종 전부, `quote` 상한(22자) 정확히, `truncateActors` 발동(4명)이
 * 표본 안에 다 들어 있다. 값을 고칠 때 이 폭을 좁히지 말 것 — 좁히면 자동 축소·말줄임이
 * 안 걸리는 데이터만 남아 회귀를 못 잡는다.
 */
export interface SampleTicket {
  id: string;
  /** 이 표본이 겨냥하는 레이아웃 부하 — 값을 바꿀 때 무엇이 깨지는지 알려준다. */
  stress: string;
  posterSrc: string;
  movieInfo: MovieInfo;
  components: TicketComponents;
}

/** 6종 공통 — 로고 OFF가 여기 산다. 무드별로 갈리는 건 layout과 posterOpacity뿐. */
const BASE: Omit<TicketComponents, 'layout' | 'posterOpacity'> = {
  chain: '',
  format: '',
  chainLabel: '',
  formatLabel: '',
  material: 'original',
  coating: 'gloss',
  materialIntensity: 1,
  coatingIntensity: 1,
  componentOpacity: 1,
  themeColor: '#FFFFFF',
  chainVisible: false,
  formatVisible: false,
  chainScale: 1,
  formatScale: 1,
  signatureImage: '',
  signatureScale: 1,
  quoteFont: 'auto',
};

function components(layout: LayoutId, posterOpacity: number): TicketComponents {
  return { ...BASE, layout, posterOpacity };
}

export const SAMPLE_TICKETS: readonly SampleTicket[] = [
  {
    id: 'minimal',
    stress: '짧은 제목(3자) + 긴 하이픈 외국 이름 + 재개봉으로 날짜 3개',
    posterSrc: '/assets/posters/sample-pier.jpg',
    // 풀블리드라 하단 31%를 스크림이 덮는다 — 포스터를 낮춰야 제목이 읽힌다(앱 기본값도 0.5).
    components: components('minimal', 0.55),
    movieInfo: {
      title: '먼 바다',
      titleOg: 'THE FAR SEA',
      actors: '윤재이, Élodie Marchand-Vasseur',
      releaseDate: '2025-01-30',
      releaseDateGranularity: 'date',
      releaseDateFormat: 'kr-compact',
      reissueDate: '2026-02-06',
      isReissue: true,
      watchDate: '2026-02-14',
      watchDateFormat: 'kr-compact',
      watchTime: '19:40',
      theater: '메가박스 코엑스',
      screen: 'Dolby Cinema관',
      seat: 'H열 12번',
      runtime: '118분',
      rating: 4.5,
      signature: '지운',
    },
  },
  {
    id: 'criterion',
    stress: 'quote 상한 정확히 22자 + 원제 32자 + 배우 3명(truncate 직전)',
    posterSrc: '/assets/posters/sample-kitchen.jpg',
    components: components('criterion', 1),
    movieInfo: {
      title: '빈 방의 오후',
      titleOg: 'AN EMPTY AFTERNOON IN LATE AUTUMN',
      actors: '오해린, Jonas Lindqvist, 강도협',
      quote: '남은 온기가 더 오래 아프다는 걸 알았다',
      releaseDate: '2025-11-07',
      releaseDateGranularity: 'date',
      releaseDateFormat: 'en-long',
      watchDate: '2025-12-24',
      watchDateFormat: 'cinema-mono',
      watchTime: '14:20',
      theater: 'CGV 인천',
      screen: '아트하우스관',
      seat: 'C열 7번',
      runtime: '94분',
      rating: 4.0,
      signature: '해든',
    },
  },
  {
    id: '35mm',
    stress: '최장 제목(17자) + 배우 1명(최소) + 긴 서명(7자)',
    posterSrc: '/assets/posters/sample-bus.jpg',
    components: components('35mm', 1),
    movieInfo: {
      title: '여름의 끝에서 우리가 나눈 이야기',
      titleOg: 'WHAT WE SHARED AT THE END OF SUMMER',
      actors: '정소우',
      releaseDate: '2026-07-24',
      releaseDateGranularity: 'date',
      releaseDateFormat: 'iso',
      watchDate: '2026-08-02',
      watchDateFormat: 'iso',
      watchTime: '16:10',
      theater: '롯데시네마 월드타워',
      screen: '수퍼플렉스',
      seat: 'F열 9번',
      runtime: '127분',
      rating: 5.0,
      signature: '소나기 오던 날',
    },
  },
  {
    id: 'editorial',
    stress: '최단 제목(2자) + 배우 4명 → truncateActors "외 1명" 발동 + 긴 예매번호',
    posterSrc: '/assets/posters/sample-splash.jpg',
    components: components('editorial', 1),
    movieInfo: {
      title: '범람',
      titleOg: 'OVERFLOW',
      actors: '서은결, Nadia Okonkwo, 노태린, Rafael Ortiz-Beltrán',
      releaseDate: '2026-04-17',
      releaseDateGranularity: 'date',
      releaseDateFormat: 'cinema-mono',
      watchDate: '2026-05-09',
      watchDateFormat: 'kr-compact',
      watchTime: '21:00',
      theater: 'CGV 왕십리',
      screen: 'IMAX관',
      seat: 'J열 15번',
      runtime: '106분',
      rating: 4.5,
      bookingNumber: '2026-0509-2100-J15',
      signature: 'EUNGYEOL',
    },
  },
  {
    id: 'stub',
    stress: '북유럽 특수문자(ø) + en-long 관람일(가장 긴 날짜 표기)',
    posterSrc: '/assets/posters/sample-crossing.jpg',
    components: components('stub', 1),
    movieInfo: {
      title: '야간 횡단',
      titleOg: 'NIGHT CROSSING',
      actors: '하도윤, Mikkel Sørensen, 임세라',
      releaseDate: '2025-06-18',
      releaseDateGranularity: 'date',
      releaseDateFormat: 'kr-compact',
      watchDate: '2025-07-05',
      watchDateFormat: 'en-long',
      watchTime: '22:30',
      theater: 'CGV 인천',
      screen: 'ScreenX관',
      seat: 'D열 4번',
      runtime: '133분',
      rating: 3.5,
      bookingNumber: '20250705-0442',
      signature: '세라',
    },
  },
  {
    id: '35mm-landscape',
    stress: '최장 극장명(18자, 2줄 접힘) + year-month 개봉일 + 재개봉으로 날짜 3개',
    posterSrc: '/assets/posters/sample-highway.jpg',
    components: components('35mm-landscape', 1),
    movieInfo: {
      title: '지평선',
      titleOg: 'HORIZON LINE',
      actors: '문태오, Aurélie Deschamps',
      releaseDate: '2025-09',
      releaseDateGranularity: 'year-month',
      releaseDateFormat: 'cinema-mono',
      reissueDate: '2026-09-18',
      isReissue: true,
      watchDate: '2026-10-03',
      watchDateFormat: 'cinema-mono',
      watchTime: '13:50',
      theater: '메가박스 대전신세계 아트앤사이언스',
      screen: 'Dolby Cinema관',
      seat: 'E열 11번',
      runtime: '141분',
      rating: 4.0,
      signature: 'T.M',
    },
  },
];
