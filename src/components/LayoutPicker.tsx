import { memo } from 'react';
import { LAYOUTS } from '@/utils/layouts';
import type { LayoutId } from '@/types';
// 무드 실루엣을 흉내 내는 자리라 색은 무드와 같은 토큰을 쓴다 — 리터럴로 두면 무드 색을
// 고칠 때 썸네일만 조용히 옛 색으로 남는다(#524).
import { CRITERION_PAPER, CRITERION_YELLOW, FILM_BASE } from './moods/_shared';

interface LayoutPickerProps {
  value: LayoutId;
  onChange: (id: LayoutId) => void;
}

// 무드 칩 배경(#367) — 티켓 미니어처 대신 무드의 핵심 색면 2~3개만 남긴 추상 칩.
// 46px에선 텍스트 라인·퍼포레이션 재현이 노이즈라 과함(이슈 결정).
// 무드가 색 토큰을 내보내면 그걸 쓰고(파일 상단 import 주석), 없으면 리터럴로 근사한다.
const MOOD_CHIP_BG: Record<LayoutId, string> = {
  minimal: 'linear-gradient(180deg, #b9b3a8 0%, #b9b3a8 62%, #17150f 62%)',
  // v5 Revue 재설계(#524): 어두운 좌우 분할이 아니라 **흰 종이 + 옐로 룰 + 가운데 도판**이 실루엣이다.
  criterion: `linear-gradient(#23201c, #23201c) 50% 42% / 52% 49% no-repeat, linear-gradient(180deg, ${CRITERION_PAPER} 0 13%, ${CRITERION_YELLOW} 13% 17%, ${CRITERION_PAPER} 17%)`,
  // v5 재설계(#524): 35mm은 가로 밴드가 아니라 **세로 레일**(좌우 어두운 띠 + 가운데 포스터 컷),
  // 35mm Wide는 좌우 분할이 아니라 **가로 밴드 + 넓은 컷 / 좁은 크레딧 컷**이 실루엣이다.
  '35mm': `linear-gradient(90deg, ${FILM_BASE} 0 21%, #8a8175 21% 79%, ${FILM_BASE} 79%)`,
  editorial: 'linear-gradient(90deg, #6e675e 0 40%, #A8312A 40% 44%, #f4ede0 44%)',
  stub: 'linear-gradient(180deg, #8a8175 0 41.7%, #c9baf7 41.7% 46%, #f2ede2 46%)',
  '35mm-landscape':
    `linear-gradient(180deg, ${FILM_BASE} 0 18%, rgba(0,0,0,0) 18% 82%, ${FILM_BASE} 82%), linear-gradient(90deg, ${FILM_BASE} 0 5%, #8a8175 5% 66%, #14120f 66% 95%, ${FILM_BASE} 95%)`,
};

// 모바일 무드 스트립(#262 갭2, #212 섹션 D) — 가로 scroll-snap. 데스크톱 캐러셀(LayoutPicker)은
// #607에서 마지막 소비자(DesktopDesignPanel)가 사라지며 #620에서 THUMBNAIL_RENDERERS와 함께
// 삭제됐다 — 셸이 하나로 통합돼(#603→#607, CLAUDE.md "셸은 한 벌이다") 데스크톱도 이 스트립을 쓴다.
// #367에서 rail 상세패널 공통 문법(46px 칩 + 이중 링 + 하단 라벨, ColorPicker·TexturePicker와
// 동일)으로 축소 — 캡션·카드 프레임 제거로 패널이 낮아져 fit 스테이지(#370)의 티켓이 커진다.
export const LayoutStrip = memo(function LayoutStrip({ value, onChange }: LayoutPickerProps) {
  return (
    <div
      // py-1.5(#565): TexturePicker와 같은 링(4px) + scale(1.05)이라 5.15px가 필요한데
      // pt-1(4px)이라 1.15px 모자랐다. 전역 :focus-visible(3px + offset 2px)까지 덮는다.
      className="flex gap-3 overflow-x-auto px-1 py-1.5 snap-x no-scrollbar"
      role="radiogroup"
      aria-label="Mood designs"
    >
      {LAYOUTS.map((layout) => {
        const active = value === layout.id;
        return (
          <button
            key={layout.id}
            type="button"
            role="radio"
            aria-checked={active}
            // 라벨은 칩 하단(짧은 label)만 노출 — 접근명엔 캡션까지 넣어 SR·테스트가 무드를
            // 한국어명으로도 특정할 수 있게 유지한다(designRail.test의 /크라이테리언/ 쿼리).
            aria-label={`${layout.label} · ${layout.caption}`}
            title={layout.caption}
            onClick={() => onChange(layout.id)}
            data-touch="44"
            className="flex shrink-0 snap-start flex-col items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className="block h-[46px] w-[46px] rounded-[12px] border transition-transform"
              style={{
                background: MOOD_CHIP_BG[layout.id],
                borderColor: active ? 'transparent' : 'var(--glass-border)',
                boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
                transform: active ? 'scale(1.05)' : undefined,
              }}
            />
            <span
              className={`text-micro font-medium transition-colors ${active ? 'text-accent' : 'text-fg-muted'}`}
            >
              {layout.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});
