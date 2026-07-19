interface CaptureOptions {
  width: number;
  height: number;
  filename: string;
  quality?: number;
  pixelRatio?: number;
}

// #439 실기기 진단 로그 게이트 — ?debug=1일 때만 켠다. DebugConsole(컴포넌트)이 콘솔을 패치해
// 화면에 보여주는 쪽이라면, 이건 애초에 로그를 만들지 말지를 정하는 발신 쪽 게이트다(claude-review
// PR #458 P1 — 이게 없으면 일반 사용자의 모든 캡처마다 내부 파이프라인 정보가 콘솔에 찍힌다).
function isCaptureDebugEnabled(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
}

// 인쇄 기계가 여백 없는 이미지의 가장자리를 잘라내는 문제 때문에, export 결과물에만 상하좌우
// 흰 여백을 둔다(#382). 프리뷰는 이 함수를 거치지 않는 별도 렌더 경로(TicketRenderer)라
// 자동으로 영향 밖이다. 10px(#449) — 캔버스 자체가 960×1534로 커지면서 여백 포함 신용카드
// 종횡비(0.631)를 맞추려면 20px로는 넘쳐 축소했다.
const EXPORT_MARGIN_PX = 10;

export function buildJpegOptions(
  width: number,
  height: number,
  quality = 0.95,
  pixelRatio = 2
) {
  const marginedWidth = width + EXPORT_MARGIN_PX * 2;
  const marginedHeight = height + EXPORT_MARGIN_PX * 2;
  return {
    quality,
    pixelRatio,
    // width/height는 SVG 캔버스(여백 포함) 크기 — html-to-image가 캡처 노드 자체의 CSS
    // width/height에도 강제로 씌우는 값이라, 노드 실크기는 아래 style.width/height로 되돌린다.
    width: marginedWidth,
    height: marginedHeight,
    canvasWidth: marginedWidth * pixelRatio,
    canvasHeight: marginedHeight * pixelRatio,
    // 캔버스 전체 배경(투명 픽셀 채움 + 여백 프레임 색). 캡처 대상 루트 노드는 배경이 없는
    // 투명 wrapper이고 티켓 배경(무드별 색)은 그 자식이 따로 그리므로, 이 흰색은 여백에만
    // 보이고 티켓 배경은 건드리지 않는다.
    backgroundColor: '#FFFFFF',
    cacheBust: false,
    skipFonts: false,
    style: {
      transform: 'none',
      transformOrigin: '0 0',
      // options.width/height(여백 포함)가 먼저 적용된 뒤 style이 나중에 적용되는 순서를 이용해
      // 노드 실크기를 원본으로 되돌리고, margin으로 여백만큼 오프셋을 준다.
      width: `${width}px`,
      height: `${height}px`,
      margin: `${EXPORT_MARGIN_PX}px`,
    },
    filter: (node: unknown) => {
      if (node instanceof Element && node.hasAttribute('data-hide-on-export')) {
        return false;
      }
      return true;
    },
  };
}

/**
 * 한 이미지가 디코드까지 끝났음을 보장한다. `img.decode()`는 로드+디코드가 모두
 * 끝나야 resolve하고, 실패(로드 에러·디코드 실패) 시 reject한다 — 단순 `complete`
 * 체크나 load 이벤트와 달리 "픽셀을 그릴 준비"까지 기다리므로, blob 포스터가 디코드되기
 * 전에 html-to-image가 캡처해 포스터가 빠지는 콜드 미스를 막는다(#138 항목3).
 *
 * 일시적 디코드 레이스를 흡수하려 1회 재시도하고, 그래도 실패하면 throw해 캡처를
 * 중단한다 — 포스터 없는 티켓을 조용히 내보내는 것보다 명시적 실패가 낫다.
 */
async function decodeImage(img: HTMLImageElement): Promise<void> {
  // 로드가 끝났는데(complete) 픽셀이 0인 이미지는 깨진 것(404·디코드 실패)이라 재시도해도
  // 회복 불가다. 무한·무의미 재시도를 막는 가드 — 이 상태면 즉시 throw해 캡처를 중단한다.
  const isBroken = img.complete && img.naturalWidth === 0;

  // decode() 미지원(구형 브라우저) 폴백 — load/error 이벤트로 settle만 보장.
  if (typeof img.decode !== 'function') {
    // 이미 깨진 채 complete면 조용히 통과하지 말고 throw한다(깨진 이미지 무음 캡처 방지).
    if (isBroken) throw new Error('image failed to load');
    if (img.complete) return;
    await new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => reject(new Error('image failed to load')), { once: true });
    });
    return;
  }
  // 이미 깨진 게 확정된 이미지는 decode()를 두 번 돌릴 이유가 없다 — 곧장 실패.
  if (isBroken) throw new Error('image failed to load');
  try {
    await img.decode();
  } catch {
    // 디코드 실패가 깨짐으로 확정됐으면 재시도 없이 throw(무한 재시도 방지). 아니면 일시적
    // 레이스로 보고 1회만 재시도하고, 그래도 실패하면 reject가 그대로 throw돼 캡처를 멈춘다.
    if (img.complete && img.naturalWidth === 0) throw new Error('image failed to load');
    await img.decode();
  }
}

/** data URL을 디코드 완료된 <img>로 로드한다(합성 base PNG를 canvas에 그리기 전 단계). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => resolve(img)).catch(() => resolve(img));
    img.onerror = () => reject(new Error('composite base image failed to load'));
    img.src = src;
  });
}

// CSS filter 문자열의 모든 px 길이를 pixelRatio로 스케일한다. 인라인 style은 자연(CSS) px 기준인데
// 합성 캔버스는 device px(자연×pixelRatio)라, blur(28px)·drop-shadow 오프셋을 같은 배율로 키워야
// 네이티브와 체감이 같다. saturate·contrast·brightness 등 단위 없는 함수는 그대로 통과한다.
function scaleFilterPx(filter: string, pixelRatio: number): string {
  return filter.replace(/([\d.]+)px/g, (_m, n) => `${parseFloat(n) * pixelRatio}px`);
}

/** object-position('x% y%')을 0..1 분율로. 미지정/파싱 실패는 중앙(0.5, 0.5). */
function parseObjectPosition(pos: string): [number, number] {
  const m = pos.match(/([\d.]+)%\s+([\d.]+)%/);
  return m ? [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100] : [0.5, 0.5];
}

// raster <img> 하나를, 브라우저가 자기 박스 안에 그리는 그대로(object-fit·object-position·
// transform:scale·filter 반영) 합성 캔버스에 직접 그린다. 이게 이번 수정의 핵심 — html-to-image의
// foreignObject→SVG→drawImage 경로는 iOS Safari에서 큰 raster를 조용히 떨어뜨리는데(#439, blob/
// data/canvas 세 방식 모두 clone-node.ts가 결국 data:URL <img>로 되돌려 같은 함정으로 수렴),
// 순수 Canvas 2D drawImage는 그 경로를 안 타 iOS에서도 확실히 그려진다.
interface DeviceRect { x: number; y: number; w: number; h: number }

function compositeRaster(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  nodeRect: DOMRect,
  width: number,
  height: number,
  pixelRatio: number,
  ticketRect: DeviceRect,
  debug: boolean,
): void {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) return;

  // 캡처 노드는 프리뷰 배율(TicketRenderer의 transform: scale)이 걸려 있어 getBoundingClientRect가
  // 축소된 좌표를 준다. 노드 대비 '분율'로 환산하면 배율이 상쇄돼 자연(layout width/height) 좌표로
  // 되돌아온다. 거기에 export 여백(10px)을 더하고 pixelRatio를 곱해 캔버스 device px 박스를 얻는다.
  const r = img.getBoundingClientRect();
  const fx = (r.left - nodeRect.left) / nodeRect.width;
  const fy = (r.top - nodeRect.top) / nodeRect.height;
  const bx = (EXPORT_MARGIN_PX + fx * width) * pixelRatio;
  const by = (EXPORT_MARGIN_PX + fy * height) * pixelRatio;
  const bw = (r.width / nodeRect.width) * width * pixelRatio;
  const bh = (r.height / nodeRect.height) * height * pixelRatio;

  const fit = img.style.objectFit || 'fill';
  let dw: number;
  let dh: number;
  if (fit === 'contain' || fit === 'cover') {
    // getBoundingClientRect은 CSS transform(예: 블러 배경의 scale(1.2))이 이미 반영된 최종 렌더
    // 박스(bw/bh)를 준다 — 그 박스에 object-fit 배율을 맞추면 transform 확대가 자동으로 흡수되므로,
    // scale을 따로 파싱해 또 곱하면 이중 적용이 된다(claude-review PR #458 P1). 그래서 곱하지 않는다.
    const s = fit === 'contain' ? Math.min(bw / sw, bh / sh) : Math.max(bw / sw, bh / sh);
    dw = sw * s;
    dh = sh * s;
  } else {
    dw = bw;
    dh = bh;
  }
  const [px, py] = parseObjectPosition(img.style.objectPosition || '');
  const dx = bx + (bw - dw) * px;
  const dy = by + (bh - dh) * py;

  // 클립은 raster 박스 ∩ 티켓 내용 영역. blur 배경(transform: scale(1.2))의 렌더 박스가 티켓을
  // 넘어 흰 여백으로 새지 않게 티켓 영역으로 잘라낸다(원본은 poster-root의 overflow:hidden이 담당).
  const cx = Math.max(bx, ticketRect.x);
  const cy = Math.max(by, ticketRect.y);
  const cw = Math.min(bx + bw, ticketRect.x + ticketRect.w) - cx;
  const ch = Math.min(by + bh, ticketRect.y + ticketRect.h) - cy;

  if (debug) {
    console.log(`[capture:composite] role=${img.dataset.role ?? '(none)'} fit=${fit} pos=${img.style.objectPosition || '(none)'} nat=${sw}x${sh} box=${Math.round(bx)},${Math.round(by)},${Math.round(bw)}x${Math.round(bh)} draw=${Math.round(dx)},${Math.round(dy)},${Math.round(dw)}x${Math.round(dh)} filter=${img.style.filter || 'none'}`);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, cw, ch);
  ctx.clip();
  ctx.filter = img.style.filter ? scaleFilterPx(img.style.filter, pixelRatio) : 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export async function captureNodeToJpeg(
  node: HTMLElement,
  options: CaptureOptions
): Promise<string> {
  const { width, height, quality = 0.95, pixelRatio = 2 } = options;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  const images = Array.from(node.querySelectorAll('img'));
  // #439 진단 로그(DebugConsole, ?debug=1) — decodeImage 자체의 throw 여부·타이밍을 이미지별로
  // 남긴다. isCaptureDebugEnabled()로 게이트해 일반 사용자 콘솔·캡처 경로엔 영향 없다(claude-review
  // PR #458 P1).
  const debug = isCaptureDebugEnabled();
  await Promise.all(images.map(async (img) => {
    try {
      await decodeImage(img);
      if (debug) console.log(`[capture:decode] ok role=${img.dataset.role ?? '(none)'} natural=${img.naturalWidth}x${img.naturalHeight} src=${img.src.slice(0, 24)}…`);
    } catch (err) {
      if (debug) console.error(`[capture:decode] FAILED role=${img.dataset.role ?? '(none)'} src=${img.src.slice(0, 24)}…`, err);
      throw err;
    }
  }));

  // raster <img>(blob:)는 html-to-image의 foreignObject 경로에서 iOS Safari가 조용히 떨어뜨린다
  // (#439 — blob/data/canvas 치환을 세 라운드 시도했으나 clone-node.ts cloneCanvasElement가 canvas
  // 조차 data:URL <img>로 되돌려 셋 다 같은 함정으로 수렴, 실기기에서 매번 동일 실패). 그래서
  // html-to-image엔 포스터 서브트리(data-poster-root)와 로고 <img>를 '제외'하고 나머지(텍스트·
  // 그라데이션·바코드 = 전부 CSS라 안전)만 투명 배경 PNG로 뽑은 뒤, 이미지는 canvas 2D drawImage로
  // 직접 합성한다(compositeRaster). z-order: 포스터(뒤) → CSS 레이어(base) → 로고 스탬프(앞).
  const rasters = images.filter((img) => img.src.startsWith('blob:'));
  const posters = rasters.filter((img) => img.dataset.role === 'poster');
  const stamps = rasters.filter((img) => img.dataset.role !== 'poster');

  // base(CSS 레이어)는 여백 없이 티켓 자연 크기로 뽑는다 — 여백(흰 프레임)은 아래에서 최종 캔버스에
  // 직접 소유한다. html-to-image의 margin+backgroundColor 프레임에 기대면(#382 방식) base를 투명으로
  // 뽑을 때 여백이 조용히 사라져(실기기 확인), 티켓을 여백 안쪽에 배치하고 여백은 흰 fill로 채운다.
  const { toPng } = await import('html-to-image');
  const basePngUrl = await toPng(node, {
    quality,
    pixelRatio,
    width,
    height,
    canvasWidth: width * pixelRatio,
    canvasHeight: height * pixelRatio,
    // 포스터/로고 자리를 투명 구멍으로 남겨야 합성한 raster가 비쳐 보인다.
    backgroundColor: undefined,
    cacheBust: false,
    skipFonts: false,
    style: { transform: 'none', transformOrigin: '0 0' },
    filter: (n: unknown) => {
      if (n instanceof Element && n.hasAttribute('data-hide-on-export')) return false; // 대시 placeholder
      if (n instanceof Element && n.hasAttribute('data-poster-root')) return false; // 포스터 서브트리(배경색 포함)
      if (n instanceof HTMLImageElement && n.src.startsWith('blob:')) return false; // 로고 스탬프 — 직접 합성
      return true;
    },
  });

  const marginDev = EXPORT_MARGIN_PX * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = (width + EXPORT_MARGIN_PX * 2) * pixelRatio;
  canvas.height = (height + EXPORT_MARGIN_PX * 2) * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  // JPEG는 알파가 없으니 전체를 흰색으로 채운다 — 이게 곧 export 여백(#382·#449) 흰 프레임이 된다.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 티켓 내용 영역(여백 안쪽) — 모든 raster·base를 여기 맞춰 그린다.
  const ticketRect: DeviceRect = { x: marginDev, y: marginDev, w: width * pixelRatio, h: height * pixelRatio };
  const nodeRect = node.getBoundingClientRect();
  // z-order: 포스터(뒤) → CSS 레이어(base) → 로고 스탬프(앞).
  for (const img of posters) compositeRaster(ctx, img, nodeRect, width, height, pixelRatio, ticketRect, debug);
  const baseImg = await loadImage(basePngUrl);
  ctx.drawImage(baseImg, ticketRect.x, ticketRect.y, ticketRect.w, ticketRect.h);
  for (const img of stamps) compositeRaster(ctx, img, nodeRect, width, height, pixelRatio, ticketRect, debug);

  const result = canvas.toDataURL('image/jpeg', quality);
  if (debug) {
    console.log(`[capture:main] posters=${posters.length} stamps=${stamps.length} base=${basePngUrl.length} out=${result.length}`);
    window.dispatchEvent(new CustomEvent('capture-debug-result', { detail: result }));
  }
  return result;
}

// CSP-safe: decode base64 directly without fetch() — Vercel CSP `connect-src` blocks fetch(data:).
export function dataUrlToJpegBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Capture returned empty data URL');
  }
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** Web Share API Level 2(파일 공유) 지원 여부. SSR에서는 항상 false. */
export function canShareTicketFile(): boolean {
  if (typeof navigator === 'undefined' || typeof File === 'undefined') return false;
  if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Uint8Array(1)], 'phototicket.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * 티켓 노드를 캡처해 OS 공유 시트로 보낸다.
 * 사용자가 공유 시트를 닫으면(AbortError) 에러가 아니라 'cancelled'로 돌려준다.
 */
export async function shareTicketAsJpeg(
  node: HTMLElement,
  options: CaptureOptions & { shareTitle?: string }
): Promise<'shared' | 'cancelled'> {
  const dataUrl = await captureNodeToJpeg(node, options);
  const blob = dataUrlToJpegBlob(dataUrl);
  const file = new File([blob], options.filename, { type: 'image/jpeg' });
  try {
    await navigator.share({ files: [file], title: options.shareTitle ?? options.filename });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export async function downloadTicketAsJpeg(
  node: HTMLElement,
  options: CaptureOptions
): Promise<void> {
  const dataUrl = await captureNodeToJpeg(node, options);
  // Go through Blob + ObjectURL: Chrome rejects very large `data:` hrefs on <a download>
  // and Safari sometimes ignores the download attribute on data URLs.
  const blob = dataUrlToJpegBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = options.filename;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
