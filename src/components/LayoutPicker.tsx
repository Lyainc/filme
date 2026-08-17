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

// 필름 퍼포레이션 점열 한 줄(#676) — 위치와 반복축만 갈라 35mm(세로 줄)·35mm Wide(가로 줄)가
// 공유한다. 점 색은 CRITERION_PAPER(거의 흰색)로 고정 — 어두운 필름 레일 위에 뚫린 구멍으로
// 빛이 새어 나오는 것처럼 보이게 하는 게 목적이라 무드 색과 무관하게 항상 같다.
function perfDots(position: string, repeat: 'repeat-x' | 'repeat-y') {
  return `repeating-radial-gradient(circle at 3px 3px, ${CRITERION_PAPER} 0 1.2px, transparent 1.2px 100%) ${position} / 7px 7px ${repeat}`;
}

// 무드 칩 배경(#367 → #676) — 티켓 미니어처 대신 무드의 핵심 색면 2~3개만 남긴 추상 칩에,
// 색만으로 안 갈리던 쌍(35mm↔35mm Wide, editorial↔stub)에 한해 구조 표식을 얹는다(#676).
// 무드가 색 토큰을 내보내면 그걸 쓰고(파일 상단 import 주석), 없으면 리터럴로 근사한다.
//
// export: 예전엔 Landing.tsx의 배경 타일 그리드(#615)도 이 값을 그대로 재사용했지만, 그쪽은
// "안 읽히는 색면"이 요건(D5 원본 포스터 식별 불가)이라 이번 구조 표식(퍼포레이션·노치)과
// 의도가 정반대다 — 소비처를 MOOD_BACKDROP_BG로 갈랐다(아래). 칩을 계속 손볼수록 배경이 조용히
// 따라 바뀌는 걸 막는 게 분리의 목적이라, 값이 우연히 같아 보여도 두 상수는 합치지 않는다.
export const MOOD_CHIP_BG: Record<LayoutId, string> = {
  minimal: 'linear-gradient(180deg, #b9b3a8 0%, #b9b3a8 62%, #17150f 62%)',
  // v5 Revue 재설계(#524): 어두운 좌우 분할이 아니라 **흰 종이 + 옐로 룰 + 가운데 도판**이 실루엣이다.
  criterion: `linear-gradient(#23201c, #23201c) 50% 42% / 52% 49% no-repeat, linear-gradient(180deg, ${CRITERION_PAPER} 0 13%, ${CRITERION_YELLOW} 13% 17%, ${CRITERION_PAPER} 17%)`,
  // v5 재설계(#524) + #676 퍼포레이션: 35mm은 **세로 레일**(좌우 어두운 띠 + 가운데 포스터 컷)에
  // 좌우 가장자리를 따라 세로로 도는 퍼포레이션 점열을 얹는다 — 35mm Wide와 색 구성이 가장
  // 비슷했던 쌍이라, 점열의 방향(세로 vs 가로)이 둘을 가르는 1차 단서가 되게 한다.
  '35mm': `${perfDots('left 4px top 3px', 'repeat-y')}, ${perfDots('right 4px top 3px', 'repeat-y')}, linear-gradient(90deg, ${FILM_BASE} 0 21%, #8a8175 21% 79%, ${FILM_BASE} 79%)`,
  // 색 구성은 그대로(좌우 두 갈래 + 얇은 레드 룰) — stub이 노치를 얻어 갈라진 뒤로는 editorial과
  // 더는 안 겹친다(아래 stub 주석).
  editorial: 'linear-gradient(90deg, #6e675e 0 40%, #A8312A 40% 44%, #f4ede0 44%)',
  // #676: editorial과 "두 갈래 + 얇은 색 룰"이라는 같은 문법을 공유해 색만으로 갈리던 쌍이라,
  // 티켓 스텁 특유의 절취선 펀치를 상단 가장자리에 실제로 파낸 노치로 얹는다. var(--bg)로 채워
  // 뒤 배경과 합성되므로 테마가 바뀌어도 "구멍"처럼 보인다.
  stub: `radial-gradient(circle 3px at 50% 0%, var(--bg) 99%, transparent 100%), linear-gradient(180deg, #8a8175 0 41.7%, #c9baf7 41.7% 46%, #f2ede2 46%)`,
  // 35mm과 같은 퍼포레이션 문법이지만 가로 필름이라 위아래 가장자리를 따라 가로로 돈다 —
  // 점열 방향이 35mm(세로)와 정반대라 그 자체로 "같은 필름 계열, 다른 판형"을 지시한다.
  '35mm-landscape':
    `${perfDots('top 3px left 4px', 'repeat-x')}, ${perfDots('bottom 3px left 4px', 'repeat-x')}, linear-gradient(180deg, ${FILM_BASE} 0 18%, rgba(0,0,0,0) 18% 82%, ${FILM_BASE} 82%), linear-gradient(90deg, ${FILM_BASE} 0 5%, #8a8175 5% 66%, #14120f 66% 95%, ${FILM_BASE} 95%)`,
};

// 배경 타일 그리드(#615) 전용 — MOOD_CHIP_BG가 #676 이전에 쓰던 값을 그대로 얼려 둔 사본이다.
// Landing.tsx는 이 값을 opacity-[0.09]로 타일링해 "안 읽히는 색면"을 만드는데, 그 요건은 칩의
// "식별 가능해야 한다"와 정반대라 칩을 더 손봐도 이쪽은 절대 따라 바뀌면 안 된다.
export const MOOD_BACKDROP_BG: Record<LayoutId, string> = {
  minimal: 'linear-gradient(180deg, #b9b3a8 0%, #b9b3a8 62%, #17150f 62%)',
  criterion: `linear-gradient(#23201c, #23201c) 50% 42% / 52% 49% no-repeat, linear-gradient(180deg, ${CRITERION_PAPER} 0 13%, ${CRITERION_YELLOW} 13% 17%, ${CRITERION_PAPER} 17%)`,
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
      aria-label="무드 목록"
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
            className="flex shrink-0 snap-start flex-col items-center gap-1.5 active:scale-[0.97]"
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
