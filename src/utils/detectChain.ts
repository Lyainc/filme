export type ChainId = 'cgv' | 'lotte' | 'megabox' | 'cineq';

/**
 * Distinctive keyword sets per chain. Weighted by how uniquely each token
 * identifies the chain — e.g. CGV uses '판매번호' where others use '예매번호',
 * and '리필적립' is CGV-only boilerplate.
 *
 * Tokens are matched against the raw OCR text (noise-tolerant: substring test).
 */
const CHAIN_SIGNALS: Record<ChainId, { token: RegExp; weight: number }[]> = {
  cgv: [
    { token: /CGV/i, weight: 3 },
    { token: /판매번호/, weight: 3 },
    { token: /리필적립/, weight: 3 },
    { token: /캡쳐화면/, weight: 2 },
    { token: /입장\s*지연/, weight: 2 },
    { token: /아트하우스/, weight: 1 },
    { token: /골드클래스|씨네드쉐프|템퍼\s*시네마/, weight: 2 },
  ],
  lotte: [
    { token: /롯데/, weight: 3 },
    { token: /상영영화/, weight: 2 },
    { token: /상영관/, weight: 2 },
    { token: /상영일/, weight: 1 },
    { token: /주차\s*안내/, weight: 2 },
    { token: /샤롯데|수퍼플렉스|아르떼|컬러리움/, weight: 2 },
  ],
  megabox: [
    { token: /메가박스|MEGABOX/i, weight: 3 },
    { token: /모바일오더/, weight: 3 },
    { token: /포토카드/, weight: 2 },
    { token: /티켓북/, weight: 2 },
    { token: /모바일\s*티켓/, weight: 1 },
    { token: /돌비관|MX4D|더\s*부티크|디즈니시네마/, weight: 2 },
  ],
  cineq: [
    { token: /씨네\s*Q|CINE\s*Q/i, weight: 4 },
  ],
};

/**
 * Detect the cinema chain from raw OCR text.
 *
 * Scores each chain by summing the weights of matched signal tokens and
 * returns the highest scorer. Returns null when no signal fires (score 0)
 * so the parser can fall back to chain-agnostic extraction.
 */
export function detectChain(raw: string): ChainId | null {
  let best: ChainId | null = null;
  let bestScore = 0;

  for (const chain of Object.keys(CHAIN_SIGNALS) as ChainId[]) {
    let score = 0;
    for (const { token, weight } of CHAIN_SIGNALS[chain]) {
      if (token.test(raw)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = chain;
    }
  }

  return best;
}
