/**
 * Editorial 스텁 길이축 예산 측정 하네스 (#572 · #573).
 *
 *   bun scripts/measure-editorial-stub.mjs --label before
 *
 * 스텁은 rotate(-90deg)라 **행의 layout 폭(offsetWidth)이 회전 후 세로 길이축**이고, 예산은
 * 캔버스 높이 960이다. offsetWidth는 transform 이전 박스라 프리뷰 scale()에 안 흔들린다
 * (getBoundingClientRect는 흔들린다 — 회전까지 얹혀서 폭/높이가 뒤집힌다).
 *
 * 최악 케이스(#573 코멘트)를 localStorage로 심는다: 5그룹 전부(바코드 + 체인/포맷 스탬프 +
 * 좌석) × CGV 16자리 예매번호 × 좌석 4석. 이 조합이 997px의 출처다.
 *
 * 출력은 stdout JSON. 길이축 합이 960을 넘으면 exit 1.
 * 함정 목록은 네이티브 메모리 e2e-browser-verification-setup 참고.
 */
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const LABEL = arg('label', 'run');
const URL = arg('url', 'http://localhost:3000/');
const SHOT = arg('shot', null);
const BUDGET = 960; // 캔버스 높이 = 스텁 길이축 예산
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 최악 케이스 시드. chainLabel/formatLabel은 로고 없이 stampWillRender를 통과시키는 경로다.
const SEED = {
  movieInfo: {
    title: '거미집',
    titleOg: 'Cobweb',
    actors: '송강호, 임수정, 오정세, 전여빈',
    releaseDate: '2023-09-27',
    releaseDateGranularity: 'date',
    releaseDateFormat: 'kr-compact',
    watchDate: '2024-03-15',
    watchDateFormat: 'kr-compact',
    watchTime: '19:30',
    theater: 'CGV 용산아이파크몰',
    screen: '4관 IMAX',
    seat: 'H12,H13,H14,H15',
    rating: 4.5,
    runtime: '132분',
    bookingNumber: '1234567890123456', // CGV 16자리
    signature: '',
    quote: '',
  },
  components: { layout: 'editorial', chainLabel: 'CGV', formatLabel: 'IMAX' },
  // 전 필드 ON. hadPoster:true가 없으면 아래 포스터 주입이 "첫 업로드"로 오판돼
  // usePhototicket이 fieldVisibility를 DEFAULT_VISIBILITY_ON_UPLOAD로 갈아끼우고,
  // bookingNo가 false로 떨어져 **바코드 그룹이 통째로 사라진 채 스크립트는 조용히 성공한다**.
  hadPoster: true,
  fieldVisibility: {
    title: true, titleOg: true, actors: true, watchDate: true, watchTime: true,
    theater: true, screen: true, seat: true, runtime: true, rating: true,
    releaseDate: true, reissue: true, bookingNo: true, signature: true, quote: true,
  },
};

/**
 * 프리뷰 게이트는 포스터다("포스터를 먼저 추가해주세요") — 캔버스로 만든 JPEG을 DataTransfer로
 * 주입하고 크롭 모달을 통과시킨다. '적용' 버튼은 뜬 직후 클릭하면 아무 일도 안 한다
 * (completedCrop이 onComplete로 늦게 서고 disabled는 false라 단서가 없다) — 그래서 대기 후 클릭.
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

// --title: 메인 열 가용폭 변경(#572 524→535)의 가장 눈에 안 띄는 파급이 타이틀 자동 축소라,
// 2줄 클램프가 걸리는 긴 제목으로 titleFontSize를 확인하는 경로를 열어둔다.
SEED.movieInfo.title = arg('title', SEED.movieInfo.title);

// --empty: 반대쪽 극단(값 없음 + ghost 자리표시자). 조건부 그룹 구성이 달라져 최악 케이스만
// 재면 놓치는 조합이다(#573 대조 세트).
if (argv.includes('--empty')) {
  for (const k of Object.keys(SEED.movieInfo))
    if (typeof SEED.movieInfo[k] === 'string') SEED.movieInfo[k] = '';
  SEED.movieInfo.rating = 0;
  SEED.components.chainLabel = '';
  SEED.components.formatLabel = '';
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

try {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.setViewport({ width: 1600, height: 1000 });
  await page.evaluateOnNewDocument((seed) => {
    localStorage.setItem('filme:phototicket:v1', JSON.stringify(seed));
    localStorage.setItem('phototicket:theme', 'light');
  }, SEED);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[type=file]', { timeout: 30000 });
  await addPoster(page);
  await page.waitForSelector('[style*="rotate(-90deg)"]', { timeout: 30000 });
  // fitFontSizeToWidth는 fontsReady 전후로 결과가 다르다(#573 코멘트 4) — 폰트 로드 후 재측정.
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    const px = (n) => Math.round(n * 10) / 10;
    // 프리뷰가 여럿이면(썸네일 등) 가장 넓은 회전 행이 실제 티켓이다.
    const row = [...document.querySelectorAll('[style*="rotate(-90deg)"]')].sort(
      (a, b) => b.offsetWidth - a.offsetWidth
    )[0];
    if (!row) throw new Error('스텁 회전 행을 못 찾음 — editorial이 안 떴다');
    const stub = row.parentElement.parentElement;
    const main = stub.previousElementSibling;
    const cs = getComputedStyle(row);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap) || 0;

    // 5그룹이 다 서지 않으면 최악 케이스가 아니다 — 조용히 성공하지 않게 여기서 던진다.
    if (!row.querySelector('svg')) throw new Error('바코드 그룹이 없다 — fieldVisibility.bookingNo 확인');
    const name = (el) => {
      if (el.offsetWidth <= 2) return 'divider';
      if (el.querySelector('svg')) return 'barcode';
      const t = (el.textContent || '').trim();
      if (t.startsWith('place')) return 'seat';
      if (t.startsWith('admis')) return 'admis';
      if (t.startsWith('le billet')) return 'le billet';
      return 'stamp';
    };
    // 그룹은 column flex라 **길이축 기여 = 가장 넓은 자식**이다(자식 높이 합이 아니다).
    // 그래서 admis 44 같은 큰 글자를 줄여도 그게 최광폭 자식이 아니면 1px도 안 준다.
    const items = [...row.children].map((el) => ({
      key: name(el),
      tag: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
      w: px(el.offsetWidth),
      parts:
        el.offsetWidth <= 2
          ? undefined
          : [...el.children].map((c) => ({
              t: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20) || c.tagName,
              w: px(c.offsetWidth),
              fs: parseFloat(getComputedStyle(c).fontSize),
            })),
    }));
    const content = items.reduce((s, i) => s + i.w, 0);
    const gaps = px(gap * Math.max(0, row.children.length - 1));

    const seatEl = [...row.querySelectorAll('span')].find(
      (s) => s.style.fontSize && s.textContent.includes('H12')
    );
    const titleEl = main.querySelector('[style*="-webkit-line-clamp"]');

    return {
      lengthAxis: { total: px(row.offsetWidth), content: px(content), gaps, padX: px(padX) },
      items,
      thickness: { stubW: px(stub.offsetWidth), rowH: px(row.offsetHeight) },
      mainColW: px(main.offsetWidth),
      titleFontSize: titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) : null,
      seatFontSize: seatEl ? parseFloat(getComputedStyle(seatEl).fontSize) : null,
    };
  });

  // 티켓만 잘라 찍는다. 프리뷰는 scale()로 줄여 보여주므로 그대로 찍으면 A/B 대조에 못 쓸 만큼
  // 작다 — 스케일 래퍼를 걷어내는 대신 deviceScaleFactor를 올려 해상도를 번다(래퍼를 지우면
  // 앱 레이아웃의 다른 transform까지 같이 죽어 티켓이 화면 밖으로 나간다).
  if (SHOT) {
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 3 });
    await new Promise((r) => setTimeout(r, 800));
    const ticket = await page.evaluateHandle(() => {
      const row = [...document.querySelectorAll('[style*="rotate(-90deg)"]')].sort(
        (a, b) => b.offsetWidth - a.offsetWidth
      )[0];
      return row.parentElement.parentElement.parentElement;
    });
    await ticket.asElement().screenshot({ path: SHOT });
  }
  const over = result.lengthAxis.total - BUDGET;
  // 두께축도 같이 판정한다 — 회전 행의 높이가 STUB_W를 넘으면 스텁 좌우로 삐져나온다(#572).
  const overThick = result.thickness.rowH - result.thickness.stubW;
  console.log(
    JSON.stringify(
      { label: LABEL, budget: BUDGET, over: Math.round(over * 10) / 10, overThick: Math.round(overThick * 10) / 10, ...result },
      null,
      2
    )
  );
  if (over > 0 || overThick > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
