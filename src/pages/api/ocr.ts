import type { NextApiRequest, NextApiResponse } from 'next';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { validateOcrRequest } from '@/utils/ocrRoute';

/**
 * 클라이언트가 base64 JSON으로 이미지를 보낸다(multipart 대신). Pages Router 기본
 * bodyParser는 multipart/form-data를 안 주므로 formidable 같은 의존성이 필요한데,
 * 전처리 후 이미지가 우리 코드(ocrPreprocess)에서 나오는 Blob이라 표준 multipart일
 * 이유가 없다. base64는 원본보다 ~33% 크지만 512px JPEG이면 보통 100~250KB라
 * 기본 1mb 한도를 넘을 수 있어 여유 있게 상향한다.
 */
export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
};

/**
 * Gemini 3.1 Flash Lite vision으로 추출할 7필드 + chain + format.
 *
 * 모든 필드를 `.nullable()`로 둔다(`.optional()` 아님). structured output은 optional
 * 필드에서 NoObjectGeneratedError를 던질 수 있어 nullable이 안전하다. 없는 값은 모델이
 * null로 채우고, 서버가 null/빈 문자열을 걸러 채워진 필드만 반환한다.
 *
 * chain은 enum — 값이 에셋 슬러그와 1:1이고(chains_transparent/<value>_*.png) 4종으로 닫혀 있다.
 * format은 반대로 자유 문자열이다(#348): 포맷 브랜드는 체인마다 계속 늘어나는데(IMAX·4DX·
 * SCREENX·DOLBY·MEGA LED·SUPER PLEX·LASER…) 목적지인 formatLabel이 이미 자유 텍스트라
 * (#316/#317), enum으로 닫으면 브랜드가 하나 생길 때마다 코드를 고쳐야 한다. 대신 표준 토큰은
 * 프롬프트에서 좁힌다 — 스키마가 아니라 지시문이 어휘를 쥔다.
 */
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

/**
 * 지시문은 영어, 예시는 한국어(티켓 텍스트가 한국어라 그대로 대조돼야 한다). 같은 규칙을
 * 한국어로 쓴 판본 대비 입력 ~9% 절감이면서 STRICT 정확도 동일 100%(#125 A/B, 15장).
 *
 * 규칙 하나하나가 실측으로 들어온 것들이다 — theater/screen 분리(CGV 앱은 지점명 줄과
 * 상영관 줄이 붙어 있어 "전도연관"을 지점명으로 오인함), 지점명 축약 금지, 로고 없는 CGV
 * 티켓의 chain 판별(번호 라벨·형식이 유일한 단서), 심야 상영 25:00 표기 보존.
 * 연도는 호출 시점 기준으로 주입 — 티켓에 연도가 빠진 MM.DD 표기를 보정하기 위함.
 *
 * format 규칙도 실측(#348, 같은 15장)에서 나왔다 — 포맷은 상영관 줄 안에 섞여 찍히고
 * (`IMAX관`·`6관 (Laser)`·`MEGA | LED 3관`), CGV 앱은 IMAX/4DX만 제목 옆 배지로 따로 보여주며
 * Laser관은 배지가 `2D`라 배지만 보면 놓친다. 특별관·좌석등급 브랜드(전도연관·[CGV아트하우스]·
 * 디즈니시네마·르 리클라이너·경기인디시네마·광음시네마)는 상영 포맷이 아니라 제외 — 스탬프
 * 어휘를 영사/음향 포맷으로 좁혀야 채점이 결정적이고, 나머지는 사용자가 직접 입력한다.
 */
function buildSystemPrompt(year: number): string {
  return `Extract booking info from a Korean cinema ticket screenshot. Set a field to null ONLY if it is absent or unreadable. Never guess.

- title: Movie title (prefer Korean). Strip bracket badges like [굿즈증정] and parenthetical notes like (자막/러닝타임). Keep the full title, never truncate.
- theater: Branch name ONLY, exactly as printed, never shortened ("스타필드시티위례" must not become "위례"). NEVER put in theater: the chain name (CGV/롯데시네마/메가박스/씨네Q); an auditorium label (digits+"관", and also named special halls like "전도연관"/"이병헌관" — those are auditoriums, not branches); special-hall brands ([CGV아트하우스], 디즈니시네마, 르 리클라이너); a floor ("10층"); a format (IMAX/4DX/Laser/DOLBY). In the CGV app the branch line (small text) sits directly above the auditorium line (bold text): "강변" + "전도연관[CGV아트하우스](Laser) 10층" → theater is "강변".
- screen: Auditorium label as printed, including bracket/paren annotations, but drop the floor ("10층"). e.g. "전도연관[CGV아트하우스](Laser)", "6관 (Laser)", "디즈니시네마 11관(르 리클라이너)", "스크린A". Never repeat the branch name here. theater and screen never overlap.
- watchDate: YYYY-MM-DD. If the ticket omits the year, assume ${year}.
- watchTime: Start time as HH:MM, 24-hour. "오후 7:30" → "19:30". For a range (14:20~16:36) take the start only. Late-night shows are printed past 24:00 (e.g. "25:00", "26:30") — keep them verbatim, do NOT wrap to 01:00.
- seat: e.g. "G14"; multiple → "H2, H3".
- bookingNumber: The 예매번호/판매번호 exactly as shown — same digit count, same separators, nothing added or dropped.
- chain: One of cgv / lotte / megabox / cineq. 롯데시네마 and 메가박스 tickets usually carry a logo ("LOTTE CINEMA" / "MEGABOX") — trust it. A CGV app ticket may show NO CGV logo at all; do not pick another chain just because the logo is missing. Identify by the number label and format instead: CGV = label "판매번호", number like "2026-0101-1234-5678" (year-monthday-4digits-4digits); 롯데시네마 = label "예매번호", number like "10000000" (8 digits); 메가박스 = number like "9000-000-10000" (4-3-5 digits). A branch name unique to one chain is also a cue. Pick cineq only when "씨네Q"/"CINE Q" branding is clearly visible (rare) — never guess it. Return null only when neither logo nor number format gives a cue.
- format: The screening format brand, if the ticket carries one. Recognized: IMAX, 4DX, ULTRA 4DX, SCREENX, DOLBY, MEGA LED, SUPER PLEX, LASER. It is printed inside the auditorium line ("IMAX관", "6관 (Laser)", "MEGA | LED 3관", "DOLBY VISION+ATMOS", "월드타워 15관 LASER", "6관 [이병헌관] LASER/광음시네마"), and CGV also badges it beside the title ("IMAX · 15세이상관람가") — but only for IMAX/4DX, so read the auditorium line too. Output ONE brand, uppercase, dropping "관"/"2D"/"3D" and any trailing words: "IMAX관" → "IMAX", "6관 (Laser)" → "LASER", "MEGA | LED 3관" → "MEGA LED", "DOLBY VISION+ATMOS" → "DOLBY". If a premium brand and LASER both appear, return the premium brand. A special/themed hall or a seat grade is NOT a format — return null when the auditorium carries only those: a plain numbered hall ("15관", "4관", "스크린A"), a seat grade (컴포트석, 르 리클라이너), a named or branded hall (전도연관, 이병헌관, [CGV아트하우스], 디즈니시네마, 경기인디시네마, 광음시네마).`;
}

/**
 * 티켓 스크린샷(base64) → Gemini 3.1 Flash Lite vision → 구조화 JSON.
 *
 * Google AI Studio 직결(`@ai-sdk/google`, env `GOOGLE_GENERATIVE_AI_API_KEY`) — AI Gateway를
 * 거치지 않는다. Gateway free tier의 모델별 요청 한도가 실사용에서 자주 걸렸고(무료 크레딧
 * 잔액과 무관하게 paid credits 구매 여부로 게이팅), 직결은 그 한도를 안 탄다. 대가로 Gateway의
 * provider fallback·통합 비용 관측·OIDC 무키 인증은 포기한다(#125·#299).
 *
 * gpt-4o-mini 대비 STRICT 정확도 100% vs 95.6%, 요청당 입력 토큰 1.9k vs 15.3k,
 * 1000요청 $0.64 vs $2.34 (#125 A/B, 실 티켓 15장). imageDetail은 OpenAI 전용이라 없다 —
 * Gemini는 이미지를 자체 타일링하므로 전처리 폭 512(ocrPreprocess)만으로 충분하다.
 *
 * 공통 가드(method·입력·rate limit·인증)는 validateOcrRequest로 일원화 — 통과 시 정제된
 * base64/mimeType을 받고, 실패 시 res에 status+{error}가 쓰여 있으므로 그대로 반환한다.
 * 절대 throw하지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const valid = await validateOcrRequest(req, res);
  if (!valid) return;
  const { base64, mimeType } = valid;

  try {
    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite'),
      schema: TicketSchema,
      system: buildSystemPrompt(new Date().getFullYear()),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 영화 티켓에서 정보를 추출해줘.' },
            { type: 'file', mediaType: mimeType, data: base64 },
          ],
        },
      ],
    });

    // null/빈 문자열은 제거 — 클라는 실제로 채워진 필드만 받는다.
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(object)) {
      if (typeof value === 'string' && value.trim() !== '') cleaned[key] = value;
    }

    return res.status(200).json(cleaned);
  } catch (err) {
    console.error('[api/ocr] generateObject failed:', err);
    return res.status(502).json({ error: 'OCR extraction failed' });
  }
}
