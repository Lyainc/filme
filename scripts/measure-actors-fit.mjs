/**
 * Editorial `avec` · Criterion 콜로폰 `CAST` 배우 줄 폭 측정 하네스 (#566).
 *
 *   bun scripts/measure-actors-fit.mjs [--url http://localhost:3000/]
 *
 * 판정은 두 가지다:
 *   1. `scrollWidth <= clientWidth` — CSS ellipsis가 안 걸렸다(이름 중간이 안 잘렸다).
 *   2. 렌더 텍스트가 전체 목록이거나 `외 N명`으로 끝난다 — 축약이 의도된 표기로만 일어났다.
 *
 * **잘림을 잡는 건 1번뿐이다.** CSS ellipsis는 textContent를 안 건드리므로 2번은 잘린 행에서도
 * 참이 된다(수정 전 실측: 8케이스 중 5개가 92~325px 넘쳤는데 intact는 전부 true였다). 2번은
 * "폭은 맞췄는데 `외 N명` 대신 이름을 깎아 맞추는" 반대쪽 회귀를 막는 짝이다.
 * 둘 중 하나라도 깨지면 exit 1. 케이스는 아래 CASES가 전부고, 재개봉 유무로 콜로폰 앞 조각
 * 길이가 갈리는 조합(Criterion 예산의 조건부 항)을 일부러 포함한다.
 *
 * 함정 목록은 네이티브 메모리 e2e-browser-verification-setup 참고.
 *
 * ponytail: addPoster가 `measure-editorial-stub.mjs`·`measure-chrome.mjs`에 이은 **3번째 복사본**
 * 이다(프리뷰 게이트가 포스터라 하네스마다 필요하다). 천장은 "크롭 '적용'의 late-completedCrop
 * 함정을 한 곳에서만 고칠 수 없다" — 그 대기 로직이 바뀌면 세 파일을 같이 손봐야 한다. 업그레이드
 * 경로는 `scripts/lib/preview-seed.mjs`로 추출(−56줄). 지금 안 하는 건 도는 하네스 둘을 #566
 * 범위에서 건드리는 값이 없어서고, **4번째 복사본이 생기면 그때는 추출할 것.**
 */
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const URL = arg('url', 'http://localhost:3000/');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** 두 이름만으로도 슬롯을 넘기는 제보 케이스(#566 본문 스크린샷)와, 4명·초장문 조합. */
const TWO_LONG_LATIN = 'Timothee Chalamet, Gwyneth Paltrow';
const FOUR_KR = '송강호, 임수정, 오정세, 전여빈';
const TWO_LONG_KR = '가나다라마바사아자차카타파하, 나다라마바사아자차카타파하가';
/** Criterion 콜로폰의 조각 구분자 = MoodCriterion.COLOPHON_SEP. CAST 몫을 떼어낼 때 쓴다. */
const COLOPHON_SEP = ' · ';

const CASES = [
  { mood: 'editorial', actors: TWO_LONG_LATIN },
  { mood: 'editorial', actors: FOUR_KR },
  { mood: 'editorial', actors: TWO_LONG_KR },
  // Criterion은 CAST 앞에 RUNTIME · RELEASED (· RE-RELEASED)가 서므로 재개봉 유무로 예산이 갈린다.
  // 재개봉 ON이 앞 조각이 가장 긴 최악이고, 그때 CAST 몫은 792에서 570 남짓이 빠진 나머지다.
  { mood: 'criterion', actors: TWO_LONG_LATIN, reissue: '' },
  { mood: 'criterion', actors: FOUR_KR, reissue: '' },
  { mood: 'criterion', actors: TWO_LONG_LATIN, reissue: '2024-01-01' },
  { mood: 'criterion', actors: FOUR_KR, reissue: '2024-01-01' },
  { mood: 'criterion', actors: TWO_LONG_KR, reissue: '2024-01-01' },
];

const seedFor = ({ mood, actors, reissue = '' }) => ({
  movieInfo: {
    title: '거미집',
    titleOg: 'Cobweb',
    actors,
    releaseDate: '2023-09-27',
    releaseDateGranularity: 'date',
    releaseDateFormat: 'kr-compact',
    // reissueClean은 `isReissue && reissueDate`에서만 나온다 — 필드명을 `reissue`로 잘못 심으면
    // RE-RELEASED 조각이 조용히 사라져 "앞 조각이 가장 긴" 케이스를 재지 못한다.
    isReissue: !!reissue,
    reissueDate: reissue,
    watchDate: '2024-03-15',
    watchDateFormat: 'kr-compact',
    watchTime: '19:30',
    theater: 'CGV 용산아이파크몰',
    screen: '4관 IMAX',
    seat: 'H12,H13,H14,H15',
    rating: 4.5,
    runtime: '132분',
    bookingNumber: '1234567890123456',
    signature: '',
    quote: '',
  },
  components: { layout: mood, chainLabel: 'CGV', formatLabel: 'IMAX' },
  // hadPoster:true가 없으면 아래 포스터 주입이 "첫 업로드"로 오판돼 fieldVisibility가
  // DEFAULT_VISIBILITY_ON_UPLOAD로 갈아끼워진다 — 그럼 배우 줄이 사라진 채 조용히 통과한다.
  hadPoster: true,
  fieldVisibility: {
    title: true, titleOg: true, actors: true, watchDate: true, watchTime: true,
    theater: true, screen: true, seat: true, runtime: true, rating: true,
    releaseDate: true, reissue: true, bookingNo: true, signature: true, quote: true,
  },
});

/**
 * 프리뷰 게이트는 포스터다("포스터를 먼저 추가해주세요"). '적용' 버튼은 뜬 직후 클릭하면
 * 아무 일도 안 한다(completedCrop이 onComplete로 늦게 서고 disabled는 false라 단서가 없다).
 */
async function addPoster(page) {
  await page.evaluate(async () => {
    const el = [...document.querySelectorAll('input[type=file]')].find((i) =>
      (i.accept || '').includes('image/jpeg')
    );
    if (!el) throw new Error('포스터 input을 못 찾음(accept image/jpeg)');
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 1200;
    const g = c.getContext('2d');
    g.fillStyle = '#3355aa';
    g.fillRect(0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '적용'),
    { timeout: 30000 }
  );
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '적용').click()
  );
}

/**
 * 배우 줄 엘리먼트를 무드별로 집어 폭을 잰다. 못 찾으면 던진다 — 무드가 안 떴는데 조용히
 * 통과하는 게 이 하네스의 유일한 실패 모드다.
 */
function measureInPage(mood) {
  const px = (n) => Math.round(n * 10) / 10;
  let el;
  let labelW = null;
  if (mood === 'editorial') {
    // 라벨은 정확히 'avec'인 span(푸터의 'réalisé avec'은 textContent가 달라 안 걸린다).
    const label = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'avec');
    if (!label) throw new Error('avec 라벨을 못 찾음 — editorial이 안 떴다');
    labelW = px(label.offsetWidth);
    el = label.nextElementSibling;
    if (!el) throw new Error('avec 라벨 옆 배우 span이 없다');
  } else {
    // 콜로폰 컨테이너는 top:1370px를 인라인으로 쓰는 유일한 노드다. fontSize로 찾으면 안 된다 —
    // 폰트가 예산에 맞춰 줄어드는 슬롯이라(#566 2단계) 값이 고정이 아니다.
    const box = [...document.querySelectorAll('div')].find((d) => d.style.top === '1370px');
    if (!box) throw new Error('콜로폰 컨테이너를 못 찾음 — criterion이 안 떴다');
    el = box.children[1];
    if (!el) throw new Error('콜로폰 2행이 없다');
  }
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    labelW,
    text,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    fontSize: px(parseFloat(getComputedStyle(el).fontSize)),
    letterSpacing: getComputedStyle(el).letterSpacing,
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

const results = [];
try {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.setViewport({ width: 1600, height: 1000 });

  for (const c of CASES) {
    await page.evaluateOnNewDocument((seed) => {
      localStorage.setItem('filme:phototicket:v1', JSON.stringify(seed));
      localStorage.setItem('phototicket:theme', 'light');
    }, seedFor(c));
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('input[type=file]', { timeout: 30000 });
    await addPoster(page);
    // 폰트 로드 전엔 measureText가 폴백 메트릭으로 재 결과가 다르다(#573 코멘트 4).
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1500));

    const m = await page.evaluate(measureInPage, c.mood);
    // Criterion은 한 행에 앞 조각들이 함께 서므로 마지막 ' · ' 뒤가 CAST 몫이다(이름엔 ' · '가
    // 안 들어간다). Editorial은 span 자체가 배우 줄이라 그대로 쓴다.
    const castText = c.mood === 'criterion' ? m.text.split(COLOPHON_SEP).pop() : m.text;
    // 축약이 의도된 표기로만 일어났는지 — 전체 목록 그대로거나 '외 N명'으로 끝나야 한다.
    const names = c.actors.split(',').map((s) => s.trim()).filter(Boolean);
    const intact = castText === names.join(', ') || /외 \d+명$/.test(castText);
    const overflow = m.scrollWidth - m.clientWidth;
    results.push({ ...c, ...m, castText, overflow, intact, ok: overflow <= 0 && intact });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
