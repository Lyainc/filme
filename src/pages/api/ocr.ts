import type { NextApiRequest, NextApiResponse } from 'next';
import { generateObject } from 'ai';
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
 * GPT-4o mini vision으로 추출할 7필드 + chain.
 *
 * 모든 필드를 `.nullable()`로 둔다(`.optional()` 아님). OpenAI structured output은
 * optional 필드에서 NoObjectGeneratedError를 던질 수 있어 nullable이 안전하다.
 * 없는 값은 모델이 null로 채우고, 서버가 null/빈 문자열을 걸러 채워진 필드만 반환한다.
 *
 * chain 값은 에셋 슬러그와 1:1(public/assets/chains_transparent/<value>_*.png).
 * cineq 에셋이 존재하므로 4종 enum을 유지한다 — 씨네Q 티켓도 로고가 자동선택된다.
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
});

/** 연도는 호출 시점 기준으로 주입 — 티켓에 연도가 빠진 MM.DD 표기를 보정하기 위함. */
function buildSystemPrompt(year: number): string {
  return `당신은 한국 영화관 예매 티켓/스크린샷에서 정보를 추출하는 OCR 어시스턴트입니다.
이미지를 분석해 아래 필드를 추출하세요. 이미지에 없거나 판독 불가한 필드만 null로 두세요(임의 추측 금지).

- title: 영화 제목. 한글 제목을 우선하고, [굿즈증정] 같은 대괄호 배지와 (자막/러닝타임) 같은 괄호 부가정보는 제거하세요. 제목이 길어도 잘라내지 말고 전체를 그대로 넣으세요.
- theater: 극장 지점명"만". 다음은 절대 theater에 넣지 마세요 — 체인명(CGV/롯데시네마/메가박스/씨네Q), 상영관 번호(예: "1관"·"6관"처럼 숫자+"관"), 층(예: "10층"), 상영 포맷(IMAX/4DX/Laser/LASER/아이맥스 등). 예: "용산", "강남", "코엑스". 표기가 "광교 1관"이면 theater는 "광교"만. 단, 지점명 자체가 "관"으로 끝나면(예: "전도연관") 그건 상영관 번호가 아니라 지점명이니 "전도연관" 그대로 두세요.
- screen: 상영관 식별자(상영관 번호·이름·층). 예: "1관", "IMAX관", "디즈니시네마 11관", "10층", "스크린A". theater의 지점명을 screen에 반복해 넣지 마세요. theater와 screen은 서로 겹치지 않는 별개 정보입니다.
- watchDate: 관람 날짜를 YYYY-MM-DD 형식으로. 연도가 티켓에 없으면 ${year}년으로 간주하세요.
- watchTime: 관람 시작 시각을 HH:MM 24시간 형식으로. "오후 7:30"은 "19:30". 상영 시간 범위(예: 14:20~16:36)면 시작 시각만.
- seat: 좌석. 예: "G14", 여러 개면 "H2, H3".
- bookingNumber: 예매번호 또는 판매번호를 화면에 보이는 자릿수·구분자 그대로(한 자리도 더하거나 빼지 마세요).
- chain: 영화관 체인(cgv / lotte / megabox / cineq 중 하나). 로고·브랜드 색·체인명 텍스트·앱 화면 등 단서가 하나라도 있으면 반드시 그 체인을 고르세요. 지점명이 특정 체인 전용이면 그것도 단서입니다. cineq(씨네Q)는 "씨네Q"/"CINE Q" 브랜딩이 분명히 보일 때만 고르세요(드묾) — 애매하면 cineq로 찍지 마세요. 정말 아무 단서도 없을 때만 null.`;
}

/**
 * 티켓 스크린샷(base64) → GPT-4o mini vision → 구조화 JSON.
 *
 * AI Gateway 경유(`model: 'openai/gpt-4o-mini'`). 공통 가드(method·입력·rate limit·
 * 인증)는 validateOcrRequest로 일원화 — 통과 시 정제된 base64/mimeType을 받고,
 * 실패 시 res에 status+{error}가 쓰여 있으므로 그대로 반환한다. 절대 throw하지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const valid = await validateOcrRequest(req, res);
  if (!valid) return;
  const { base64, mimeType } = valid;

  try {
    const { object } = await generateObject({
      model: 'openai/gpt-4o-mini',
      schema: TicketSchema,
      system: buildSystemPrompt(new Date().getFullYear()),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 영화 티켓에서 정보를 추출해줘.' },
            {
              type: 'file',
              mediaType: mimeType,
              data: base64,
              // detail=high 명시(#111): auto에 맡기지 않고 타일링을 고정한다. 전처리 폭
              // 512(ocrPreprocess)와 합쳐 ~14.7k 토큰/요청 — 폭768 auto(=high, ~37k) 대비
              // ~2.5배 절감하면서 예매번호·좌석 같은 작은 글씨 정확도를 보장한다.
              // detail=low(~3.4k, 11배 절감)는 작은 숫자를 자릿수 단위로 오인식해 기각.
              providerOptions: { openai: { imageDetail: 'high' } },
            },
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
