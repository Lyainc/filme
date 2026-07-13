/**
 * #125 — OCR 모델 A/B: gpt-4o-mini(baseline) vs gemini-2.5-flash-lite(후보).
 *
 * ab-ocr-512.ts의 전처리·채점 로직을 그대로 쓰되 모델을 파라미터화해, 동일 7장·동일 512px
 * 전처리·동일 structured output(generateObject) 경로로 두 모델을 돌려 STRICT 정확도와
 * 요청당 비용을 나란히 비교한다. ground truth = scripts/ab-ocr-groundtruth.json.
 *
 * 실행: bun run scripts/ab-ocr-model.ts
 */
import sharp from 'sharp';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { generateObject, type LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 8_000;
// AI Gateway free tier는 모델별 요청 한도가 낮다(무료 크레딧 잔액과 무관 — paid credits 구매
// 여부로 게이팅). baseline(gpt-4o-mini)이 5장쯤에서 429로 막히므로 백오프를 길게 잡는다.
const RETRY_WAITS = [60_000, 120_000, 300_000, 300_000, 300_000, 300_000];
const WIDTH_CAP = 512;

/** per-1M USD (Vercel AI Gateway /v1/models 실측, 2026-07-09 재확인). */
const RATES: Record<string, { in: number; out: number }> = {
  'openai/gpt-4o-mini': { in: 0.15, out: 0.6 },
  'google/gemini-2.5-flash-lite': { in: 0.1, out: 0.4 },
  // gpt-5-nano/nova-lite/gpt-4.1-nano/qwen3.5-flash/mistral-small 등 더 싼 vision 후보는
  // 전부 AI Gateway FREE tier에서 429(rate_limit_exceeded, 유료 크레딧 필요)로 차단됨(2026-07-09 실측).
  // free tier로 A/B 가능한 vision 모델은 gpt-4o-mini·gemini-2.5-flash-lite 둘뿐. 참고용으로만 기재.
  'openai/gpt-5-nano': { in: 0.05, out: 0.4 },
  // #299 후속 — AI Gateway 우회, Google AI Studio 직결(@ai-sdk/google). 가격은 ai.google.dev
  // 공식 리스트 기준(2026-07-12 확인)이라 Gateway 마진이 안 붙는다.
  'google-direct/gemini-3.1-flash-lite': { in: 0.25, out: 1.5 },
};

/**
 * env: 후보(`google-direct/*`)는 `GOOGLE_GENERATIVE_AI_API_KEY`, baseline(`openai/*`)은
 * `AI_GATEWAY_API_KEY` 또는 `VERCEL_OIDC_TOKEN`이 있어야 돈다. 프로덕션은 #125에서 Google
 * 직결로 넘어가면서 Gateway 키를 걷어냈으니(.env.example·README에서 제거), baseline과 다시
 * 비교하려면 Gateway 키를 `.env.local`에 직접 넣어야 한다. Gateway free tier는 모델별 요청
 * 한도가 낮아 baseline 15장이 429를 여러 번 탄다 — 무료 크레딧 잔액이 남아도 안 풀린다.
 */

/** 'google-direct/<model>'은 AI Gateway를 거치지 않고 @ai-sdk/google로 직결한다. */
function resolveModel(modelKey: string): LanguageModel {
  if (modelKey.startsWith('google-direct/')) {
    return google(modelKey.slice('google-direct/'.length));
  }
  return modelKey;
}
// AB_MODELS(콤마구분)로 이번 실행 대상 모델을 좁힐 수 있다. 미지정 시 RATES 전체.
const MODELS = (process.env.AB_MODELS?.split(',').map((s) => s.trim()).filter(Boolean)) ?? Object.keys(RATES);
// 결과 파일. 프롬프트 개정 전/후를 다른 파일에 남겨 비교 (AB_OUT로 오버라이드).
const OUT_PATH = process.env.AB_OUT ?? 'scripts/ab-ocr-model-result.json';

const TicketSchema = z.object({
  title: z.string().nullable(),
  theater: z.string().nullable(),
  screen: z.string().nullable(),
  watchDate: z.string().nullable(),
  watchTime: z.string().nullable(),
  seat: z.string().nullable(),
  bookingNumber: z.string().nullable(),
  chain: z.enum(['cgv', 'lotte', 'megabox', 'cineq']).nullable(),
  format: z.string().nullable(),
});
type Ticket = z.infer<typeof TicketSchema>;
const FIELDS: (keyof Ticket)[] = [
  'title', 'theater', 'screen', 'watchDate', 'watchTime', 'seat', 'bookingNumber', 'chain', 'format',
];
/**
 * 기존 6필드 = #125에서 100%(90/90)를 찍은 기준선. format(#348)은 여기 넣지 않고 따로 센다 —
 * STRICT에 합치면 분모가 105로 바뀌어 "기존 필드가 안 깨졌나"를 옛 수치와 대조할 수 없다.
 */
const STRICT: (keyof Ticket)[] = ['theater', 'watchDate', 'watchTime', 'seat', 'bookingNumber', 'chain'];

/** AB_PROMPT=en이면 영어 프롬프트(토큰 절감 실험). 티켓 텍스트가 한국어라 예시는 한국어 유지. */
function buildSystemPrompt(year: number): string {
  return process.env.AB_PROMPT === 'en' ? buildSystemPromptEn(year) : buildSystemPromptKo(year);
}

function buildSystemPromptEn(year: number): string {
  return `Extract booking info from a Korean cinema ticket screenshot. Set a field to null ONLY if it is absent or unreadable. Never guess.

- title: Movie title (prefer Korean). Strip bracket badges like [굿즈증정] and parenthetical notes like (자막/러닝타임). Keep the full title, never truncate.
- theater: Branch name ONLY, exactly as printed, never shortened ("스타필드시티위례" must not become "위례"). NEVER put in theater: the chain name (CGV/롯데시네마/메가박스/씨네Q); an auditorium label (digits+"관", and also named special halls like "전도연관"/"이병헌관" — those are auditoriums, not branches); special-hall brands ([CGV아트하우스], 디즈니시네마, 르 리클라이너); a floor ("10층"); a format (IMAX/4DX/Laser/DOLBY). In the CGV app the branch line (small text) sits directly above the auditorium line (bold text): "강변" + "전도연관[CGV아트하우스](Laser) 10층" → theater is "강변".
- screen: Auditorium label as printed, including bracket/paren annotations, but drop the floor ("10층"). e.g. "전도연관[CGV아트하우스](Laser)", "6관 (Laser)", "디즈니시네마 11관(르 리클라이너)", "스크린A". Never repeat the branch name here. theater and screen never overlap.
- watchDate: YYYY-MM-DD. If the ticket omits the year, assume ${year}.
- watchTime: Start time as HH:MM, 24-hour. "오후 7:30" → "19:30". For a range (14:20~16:36) take the start only. Late-night shows are printed past 24:00 (e.g. "25:00", "26:30") — keep them verbatim, do NOT wrap to 01:00.
- seat: e.g. "G14"; multiple → "H2, H3".
- bookingNumber: The 예매번호/판매번호 exactly as shown — same digit count, same separators, nothing added or dropped.
- chain: One of cgv / lotte / megabox / cineq. 롯데시네마 and 메가박스 tickets usually carry a logo ("LOTTE CINEMA" / "MEGABOX") — trust it. A CGV app ticket may show NO CGV logo at all; do not pick another chain just because the logo is missing. Identify by the number label and format instead: CGV = label "판매번호", number like "2026-0101-1234-5678" (year-monthday-4digits-4digits); 롯데시네마 = label "예매번호", number like "10000000" (8 digits); 메가박스 = number like "9000-000-10000" (4-3-5 digits). A branch name unique to one chain is also a cue. Pick cineq only when "씨네Q"/"CINE Q" branding is clearly visible (rare) — never guess it. Return null only when neither logo nor number format gives a cue.
- format: The screening format or premium-hall brand. Output EXACTLY ONE of these tokens, or null: IMAX, 4DX, ULTRA 4DX, SCREENX, DOLBY, MEGA LED, MX4D, SUPER PLEX, 아트하우스, 르 리클라이너, 광음시네마, 광음LED, 템퍼시네마, 샤롯데, 부티크, 스트레스리스 시네마. It is printed inside the auditorium line ("IMAX관", "MEGA | LED 3관", "DOLBY VISION+ATMOS", "전도연관[CGV아트하우스](Laser)", "6관 [이병헌관] LASER/광음시네마", "르 리클라이너 10관"), and CGV also badges IMAX/4DX beside the title ("IMAX · 15세이상관람가") — but only those two, so always read the auditorium line. Map what is printed onto the token: "IMAX관" → "IMAX", "MEGA | LED 3관" → "MEGA LED", "DOLBY VISION+ATMOS" → "DOLBY", "[CGV아트하우스]" → "아트하우스". LASER/Laser is NOT a format — ignore it entirely; it sits on nearly every CGV hall and carries no information. Anything outside the token list is NOT a format either: return null when the auditorium carries only a plain numbered hall ("15관", "4관", "스크린A"), a seat grade (컴포트석), a named hall (전도연관, 이병헌관), or an unlisted brand (디즈니시네마, 경기인디시네마, 아르떼). If a projection format and a hall brand both appear, return the projection format.`;
}

function buildSystemPromptKo(year: number): string {
  return `당신은 한국 영화관 예매 티켓/스크린샷에서 정보를 추출하는 OCR 어시스턴트입니다.
이미지를 분석해 아래 필드를 추출하세요. 이미지에 없거나 판독 불가한 필드만 null로 두세요(임의 추측 금지).

- title: 영화 제목. 한글 제목을 우선하고, [굿즈증정] 같은 대괄호 배지와 (자막/러닝타임) 같은 괄호 부가정보는 제거하세요. 제목이 길어도 잘라내지 말고 전체를 그대로 넣으세요.
- theater: 극장 지점명"만". 화면에 적힌 지점명을 통째로 그대로 넣으세요(임의로 줄이지 마세요 — "스타필드시티위례"를 "위례"로 줄이면 안 됩니다). 다음은 절대 theater에 넣지 마세요 — 체인명(CGV/롯데시네마/메가박스/씨네Q), 상영관 표기(숫자+"관", 그리고 "전도연관"·"이병헌관"처럼 이름+"관"인 특별관도 지점명이 아니라 상영관입니다), 특별관 브랜드([CGV아트하우스]·디즈니시네마·르 리클라이너 등), 층("10층"), 상영 포맷(IMAX/4DX/Laser/LASER/DOLBY 등). CGV 앱은 지점명 줄(작은 글씨)과 상영관 줄(굵은 글씨)이 위아래로 붙어 있으니 위가 theater, 아래는 screen입니다 — "강변" + "전도연관[CGV아트하우스](Laser) 10층"이면 theater는 "강변".
- screen: 상영관 표기를 화면에 적힌 대로(대괄호·괄호 부기 포함), 단 층("10층")은 빼세요. 예: "전도연관[CGV아트하우스](Laser)", "6관 (Laser)", "디즈니시네마 11관(르 리클라이너)", "스크린A". theater의 지점명을 screen에 반복해 넣지 마세요. theater와 screen은 서로 겹치지 않는 별개 정보입니다.
- watchDate: 관람 날짜를 YYYY-MM-DD 형식으로. 연도가 티켓에 없으면 ${year}년으로 간주하세요.
- watchTime: 관람 시작 시각을 HH:MM 24시간 형식으로. "오후 7:30"은 "19:30". 상영 시간 범위(예: 14:20~16:36)면 시작 시각만. 심야 상영은 "25:00"·"26:30"처럼 24시를 넘겨 표기되니 보이는 그대로 두세요(01:00으로 바꾸지 마세요).
- seat: 좌석. 예: "G14", 여러 개면 "H2, H3".
- bookingNumber: 예매번호 또는 판매번호를 화면에 보이는 자릿수·구분자 그대로(한 자리도 더하거나 빼지 마세요).
- chain: 영화관 체인(cgv / lotte / megabox / cineq 중 하나). 롯데시네마·메가박스 티켓엔 보통 로고("LOTTE CINEMA"·"MEGABOX")가 찍혀 있으니 그대로 따르세요. CGV 앱 티켓엔 CGV 로고가 아예 없을 수 있습니다 — 로고가 안 보인다고 다른 체인으로 찍지 말고 번호 라벨·형식으로 판별하세요: CGV는 라벨이 "판매번호"이고 번호가 "2026-0101-1234-5678"처럼 연도-월일-4자리-4자리, 롯데시네마는 라벨이 "예매번호"이고 번호가 "10000000"처럼 숫자 8자리, 메가박스는 번호가 "9000-000-10000"처럼 4자리-3자리-5자리입니다. 지점명이 특정 체인 전용이면 그것도 단서입니다. cineq(씨네Q)는 "씨네Q"/"CINE Q" 브랜딩이 분명히 보일 때만 고르세요(드묾) — 애매하면 cineq로 찍지 마세요. 로고도 번호 형식도 단서가 없을 때만 null.
- format: 상영 포맷 또는 특별관 브랜드. 아래 토큰 중 **정확히 하나만** 출력하거나 null: IMAX, 4DX, ULTRA 4DX, SCREENX, DOLBY, MEGA LED, MX4D, SUPER PLEX, 아트하우스, 르 리클라이너, 광음시네마, 광음LED, 템퍼시네마, 샤롯데, 부티크, 스트레스리스 시네마. 이 값은 상영관 줄 안에 섞여 찍힙니다("IMAX관", "MEGA | LED 3관", "DOLBY VISION+ATMOS", "전도연관[CGV아트하우스](Laser)", "6관 [이병헌관] LASER/광음시네마", "르 리클라이너 10관"). CGV는 제목 옆 배지로도 보여주지만 IMAX/4DX 둘뿐이라, 상영관 줄을 반드시 읽으세요. 화면에 적힌 것을 토큰으로 옮기세요: "IMAX관" → "IMAX", "MEGA | LED 3관" → "MEGA LED", "DOLBY VISION+ATMOS" → "DOLBY", "[CGV아트하우스]" → "아트하우스". **LASER/Laser는 포맷이 아닙니다** — 무시하세요. CGV 거의 모든 관에 붙어서 정보량이 없습니다. 토큰 목록 밖의 것도 포맷이 아닙니다 — 상영관에 이런 것만 있으면 null: 숫자만 붙은 일반관("15관", "4관", "스크린A"), 좌석등급(컴포트석), 이름관(전도연관, 이병헌관), 목록에 없는 브랜드(디즈니시네마, 경기인디시네마, 아르떼). 영사 포맷과 특별관 브랜드가 함께 보이면 영사 포맷을 고르세요.`;
}

/** ocrPreprocess.ts 파이프라인을 폭 512로 재현. */
async function preprocess(path: string): Promise<string> {
  const meta = await sharp(path).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const cropH = Math.round(H * 0.82);
  const scale = W > WIDTH_CAP ? WIDTH_CAP / W : 1;
  const outW = Math.round(W * scale);
  const outH = Math.round(cropH * scale);
  const buf = await sharp(path)
    .extract({ left: 0, top: 0, width: W, height: cropH })
    .resize(outW, outH)
    .jpeg({ quality: 92 })
    .toBuffer();
  return buf.toString('base64');
}

async function runOcr(
  model: string,
  base64: string,
): Promise<{ object: Ticket; inTok: number; outTok: number }> {
  // imageDetail은 OpenAI 전용. gemini엔 전달하지 않는다.
  const filePart =
    model.startsWith('openai/')
      ? { type: 'file' as const, mediaType: 'image/jpeg', data: base64, providerOptions: { openai: { imageDetail: 'high' } } }
      : { type: 'file' as const, mediaType: 'image/jpeg', data: base64 };
  for (let attempt = 0; ; attempt++) {
    try {
      const { object, usage } = await generateObject({
        model: resolveModel(model),
        schema: TicketSchema,
        system: buildSystemPrompt(2026),
        messages: [
          { role: 'user', content: [{ type: 'text', text: '이 영화 티켓에서 정보를 추출해줘.' }, filePart as never] },
        ],
      });
      return { object, inTok: usage.inputTokens ?? -1, outTok: usage.outputTokens ?? -1 };
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (!(msg.includes('rate') || msg.includes('429')) || attempt >= RETRY_WAITS.length) throw e;
      console.log(`    ⏳ 429(${model}) — ${RETRY_WAITS[attempt] / 1000}s 대기 후 재시도(${attempt + 1}/${RETRY_WAITS.length})`);
      await sleep(RETRY_WAITS[attempt]);
    }
  }
}

const norm = (v: string | null | undefined) => (v ?? '').trim();
const seatNorm = (v: string | null | undefined) => norm(v).replace(/\s+/g, '').toUpperCase();

type Stat = { strictCorrect: number; strictTotal: number; booking: number; format: number; inTok: number; outTok: number; cost: number; files: number; fails: string[]; formatFails: string[] };
type Rec = { file: string; models: Record<string, { inTok: number; outTok: number; fields: Record<string, { got: string; want: string }> }> };

async function main() {
  const dir = 'public/sample/moblieticket';
  // 정답지 키는 소문자 확장자(.png)인데 실제 파일은 .PNG가 섞여 있다 → 소문자로 정규화해 매칭.
  const gtRaw: Record<string, Ticket> = JSON.parse(readFileSync('scripts/ab-ocr-groundtruth.json', 'utf8'));
  const gt = new Map(Object.entries(gtRaw).map(([k, v]) => [k.toLowerCase(), v]));
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();

  // resume: 기존 결과가 있으면 로드해 (file, model) 이미 있는 조합은 스킵 (기존 데이터 보존).
  let existing: Rec[] = [];
  if (existsSync(OUT_PATH)) {
    try { existing = JSON.parse(readFileSync(OUT_PATH, 'utf8')); } catch { existing = []; }
  }
  const byFile = new Map<string, Rec>();
  for (const r of existing) byFile.set(r.file, r);

  console.log(`대상 모델: ${MODELS.join(', ')}`);
  console.log(`출력: ${OUT_PATH} (기존 ${existing.length}장 로드)\n`);

  for (const file of files) {
    const truth = gt.get(file.toLowerCase());
    if (!truth) { console.log(`━━━ ${file} — 정답지 없음, 스킵 ━━━`); continue; }
    const rec: Rec = byFile.get(file) ?? { file, models: {} };
    byFile.set(file, rec);
    const todo = MODELS.filter((m) => !rec.models[m]);
    if (todo.length === 0) { console.log(`━━━ ${file} — 전 모델 캐시됨, 스킵 ━━━`); continue; }

    const base64 = await preprocess(`${dir}/${file}`);
    console.log(`\n━━━ ${file} ━━━`);
    for (const model of todo) {
      const { object, inTok, outTok } = await runOcr(model, base64);
      await sleep(GAP_MS);
      const tag = model.split('/')[1];
      const fieldRec: Record<string, { got: string; want: string }> = {};
      for (const f of FIELDS) fieldRec[f] = { got: norm(object[f]), want: norm(truth[f]) };
      rec.models[model] = { inTok, outTok, fields: fieldRec };
      console.log(`  [${tag}] in${inTok}/out${outTok} 완료`);
      writeFileSync(OUT_PATH, JSON.stringify(files.map((f) => byFile.get(f)).filter(Boolean), null, 2));
    }
  }

  const all: Rec[] = files.map((f) => byFile.get(f)).filter(Boolean) as Rec[];
  writeFileSync(OUT_PATH, JSON.stringify(all, null, 2));

  // 채점: 결과 json 전체를 GT와 대조해 재계산 (resume 세션에서도 전체 반영).
  const stats: Record<string, Stat> = {};
  for (const rec of all) {
    const truth = gt.get(rec.file.toLowerCase())!;
    for (const [model, data] of Object.entries(rec.models)) {
      const s = (stats[model] ??= { strictCorrect: 0, strictTotal: 0, booking: 0, format: 0, inTok: 0, outTok: 0, cost: 0, files: 0, fails: [], formatFails: [] });
      s.files++;
      s.inTok += data.inTok;
      s.outTok += data.outTok;
      const r = RATES[model] ?? { in: 0, out: 0 };
      s.cost += (data.inTok * r.in + data.outTok * r.out) / 1_000_000;
      for (const f of STRICT) {
        const got = f === 'seat' ? seatNorm(data.fields[f]?.got) : norm(data.fields[f]?.got);
        const want = f === 'seat' ? seatNorm(truth[f]) : norm(truth[f]);
        const ok = got === want;
        s.strictTotal++;
        if (ok) s.strictCorrect++;
        else s.fails.push(`${rec.file}/${f}: "${norm(data.fields[f]?.got)}"≠"${norm(truth[f])}"`);
        if (f === 'bookingNumber' && ok) s.booking++;
      }
      // format(#348)은 STRICT 분모 밖에서 같은 방식(정규화 후 완전일치)으로 따로 센다.
      // 정답이 null인 티켓(포맷 표기 없음)은 빈 문자열로 정규화되므로 오탐도 여기서 잡힌다.
      const gotFmt = norm(data.fields.format?.got);
      const wantFmt = norm(truth.format);
      if (gotFmt === wantFmt) s.format++;
      else s.formatFails.push(`${rec.file}/format: "${gotFmt}"≠"${wantFmt}"`);
    }
  }

  console.log(`\n═══════════ 모델 A/B 종합 (${all.length}장) ═══════════`);
  for (const model of Object.keys(stats)) {
    const s = stats[model];
    const acc = (100 * s.strictCorrect / Math.max(s.strictTotal, 1)).toFixed(1);
    const per1k = (s.cost / Math.max(s.files, 1)) * 1000;
    console.log(`\n● ${model}`);
    const fmtAcc = (100 * s.format / Math.max(s.files, 1)).toFixed(1);
    console.log(`  STRICT 정확: ${s.strictCorrect}/${s.strictTotal} (${acc}%)   bookingNumber: ${s.booking}/${s.files}`);
    console.log(`  format STRICT: ${s.format}/${s.files} (${fmtAcc}%)`);
    console.log(`  토큰 평균: in ${Math.round(s.inTok / Math.max(s.files, 1))} / out ${Math.round(s.outTok / Math.max(s.files, 1))}`);
    console.log(`  비용: 합계 $${s.cost.toFixed(5)}  →  1000요청 $${per1k.toFixed(3)}`);
    if (s.fails.length) {
      console.log(`  ✗ 오답:`);
      for (const f of s.fails) console.log(`      ${f}`);
    }
    if (s.formatFails.length) {
      console.log(`  ✗ format 오답:`);
      for (const f of s.formatFails) console.log(`      ${f}`);
    }
  }
}

main().catch((e) => {
  console.error('모델 A/B 측정 실패:', e);
  process.exit(1);
});
