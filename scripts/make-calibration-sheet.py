# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "fonttools", "brotli"]
# ///
"""실물 인쇄 캘리브레이션 도안(v3)을 JPEG로 직접 렌더한다 — #510 → #521 → #591.

    uv run scripts/make-calibration-sheet.py
    uv run scripts/make-calibration-sheet.py --out /tmp/cal.jpg --scale 2

왜 파이썬 + headless Chrome인가
    v1·v2는 Next 페이지(`src/pages/calibration.tsx`)였다. 도안 한 장 뽑으려고 dev 서버를 띄우고
    브라우저에서 버튼을 눌러야 했는데, 이건 디버그 도구치고 무겁다. 그래서 스크립트로 옮겼다.
    단 PIL로 직접 그리지는 않는다 — 이 도안의 계측기 중 **폰트 격자만 래스터라이저에 의존**하고,
    PIL(FreeType)과 Chrome은 힌팅·안티에일리어싱이 달라서 그러면 프로덕트가 실제로 인쇄되는
    모습과 어긋난 것을 재게 된다. HTML을 만들어 Chrome으로 찍으면 래스터라이저·레이아웃 엔진이
    프로덕트와 같고, 레이아웃 코드도 CSS가 대신해 준다.

export 동일성
    프로덕트 `captureToImage`는 콘텐츠 960×1534 바깥에 `EXPORT_MARGIN_PX=10` 재단여유를 흰색으로
    두르고 pixelRatio 2로 캡처해 1960×3108 JPEG q0.95를 만든다. 이 스크립트도 같다 —
    980×1554 CSS px 페이지(= 콘텐츠 + 여백)를 device-scale-factor 2로 찍어 JPEG q95로 저장한다.

v3 계측기와 그 근거(메가박스 1차 인쇄 실측, #591)
 1. **비풀블리드는 자르지 않는다.** 전체를 카드의 86.1%로 축소해 가운데 앉힌다(크롭 0,
    0.0474mm/px). 콘텐츠 안쪽에 그었던 SAFE-A/B(45/90px)는 측정 대상이 없어져 삭제했다.
 2. **`EXPORT_MARGIN_PX=10`은 장식이 아니라 재단 여유다** — CGV 공식앱 인쇄에서 상하좌우가
    실제로 조금 잘려 나오는 것을 관찰해 둔 값(#382→#449)인데, 잘리는 양 C 자체는 실측된 적이
    없다. v3의 1순위 산출물이 이 값이라, 네 변을 깊이별 재단 띠(0-5-10-15-20px, 적·먹 교대)로
    채웠다. 균일하게 사라지면 직선 크롭, 코너에서 곡선으로 휘면 카드 코너 반지름이라 두 원인이
    모양으로 구분된다.
 3. **코너 반지름을 실측했다** — 사진의 카드 우하단 호에 접선 구속 원을 피팅해(182점, 잔차
    median 0.23px) 2.94mm를 얻었다. ISO/IEC 7810 ID-1 규격 3.18mm보다 7.5% 타이트해 규격을
    그대로 믿으면 안 된다. 무드는 라운딩 없이 사각으로 그리므로 풀블리드에서 이 호가 콘텐츠를
    직접 잘라낸다(콘텐츠 좌표 52.3px → 대각 최심 15.3px, 각 변 52px 구간). 코너마다 파란 호
    3겹(44/52/60px)과 변 양끝 8px 눈금으로 CGV 카드에서 확정한다.
 4. **1px은 선이 아니다.** 1 티켓px = 0.56 프린터 dot(300dpi, 메가박스 배율)이라 1px INK 실선이
    풀잉크 대비 밀도 14~32%로만 찍혔다. 1px 부눈금은 삭제(안 찍힘), 주눈금 3px, accent 프레임
    2px→4px(2px는 밀도 26%에 색까지 잃었다). 무드의 `1px × opacity .18~.34` 구분선은 곱셈으로
    추론만 됐던 부분이라 선폭 × 불투명도 매트릭스를 새로 넣었다.
 5. **weight가 size보다 싸게 밀도를 회복한다.** KR 16px/500(87.6%)이 24px/400(82.0%)보다 진했다.
    16px에서만 weight를 훑었던 사다리를 크기 × weight 격자로 바꿨다.
 6. 색은 **일반 플라스틱 전사 인쇄기 가정의 일반 캘리브레이션까지만** 한다 — 기기·잉크 상태마다
    재현이 갈려 특정 hex 사전보정은 근거가 못 된다. WB 기준 3종 + 프라이머리 6종 + 프로덕션
    팔레트 실물만 둔다. 팔레트 행이 답할 건 "우리 값이 살아남나" 하나다.
 7. 코너 fiducial(v2)은 TL·BL이 헤더·푸터와 겹쳐 실제 정렬에 못 썼다. 삭제하고 accent 프레임을
    계측 기준으로 승격했다 — 프레임 선 중심 간 888 × 1462px이 배율 기준이다.
"""

from __future__ import annotations

import argparse
import glob
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# ── 프로덕트 상수(src/utils/constants.ts · captureToImage.ts와 일치해야 한다) ──────────
NATURAL_W, NATURAL_H = 960, 1534
EXPORT_MARGIN_PX = 10

# ── 도안 기하 ─────────────────────────────────────────────────────────────────────
RULER = 34  # 눈금자 밴드 폭 — 재단 띠 + 눈금·라벨 구역
FRAME_INSET, FRAME_W = RULER, 4
INK, FAINT, ACCENT = "#111111", "#9AA1AC", "#B0423F"
ARC_COLOR = "#2A6FDB"  # 코너 호 — 재단 띠(적·먹)와 겹쳐도 보이는 제3의 색
BLEED_STEP, BLEED_COUNT = 5, 4
BLEED_DEPTH = BLEED_STEP * BLEED_COUNT  # 20
LABEL_DEPTH = BLEED_DEPTH + 1
TICK_LEN = 12
CORNER_ARC_RADII = (44, 52, 60)
ARC_STROKE = 3
FINE_PITCH, FINE_SPAN = 8, 80
CONTENT_INSET = RULER + 6  # 40
CONTENT_W = NATURAL_W - CONTENT_INSET * 2  # 880
GRID_GAP, GRID_LABEL_W = 8, 58
# 라벨열 + 4열 = 자식 5개 → gap 4개. 3개로 세면 8px 넘친다(v3 첫 판에서 브라우저 실측).
GRID_CELL = (CONTENT_W - GRID_LABEL_W - GRID_GAP * 4) / 4

# ── 실측·예측 배율(mm per 티켓px) ────────────────────────────────────────────────
MEGABOX_MM_PER_PX = 0.0474  # #591 실측(비풀블리드, 카드의 86.1%)
FULLBLEED_MM_PER_PX = 54 / NATURAL_W  # 재단량 C=10px(현 여백)일 때 = 0.05625
MEASURED_CORNER_MM = 2.94  # #591 실측(사진 원 피팅) — 규격 3.18mm보다 타이트
DOT_MM = 25.4 / 300  # 300dpi 프린터 dot

FRAME_SPAN_W = NATURAL_W - (FRAME_INSET + FRAME_W / 2) * 2  # 888
FRAME_SPAN_H = NATURAL_H - (FRAME_INSET + FRAME_W / 2) * 2  # 1462

KR_SAMPLE = "다람쥐 025"
MIX_SAMPLE = "가나 A025"
GRAYS = (0, 1, 3, 5, 8, 12, 25, 50, 75, 88, 92, 95, 97, 99, 100)
LINE_WIDTHS = (1, 2, 3, 4)
LINE_OPACITIES = (1, 0.5, 0.34, 0.18)  # 34% = MoodMinimal · 18% = MoodStub/Editorial 실제 값
WB_PRIMARIES = (
    ("#FFFFFF", "WB white"), ("#808080", "WB gray"), ("#000000", "WB black"),
    ("#FF0000", "R"), ("#00FF00", "G"), ("#0000FF", "B"),
    ("#00FFFF", "C"), ("#FF00FF", "M"), ("#FFFF00", "Y"),
)
# 프로덕션 팔레트 실물 — 보정 후보가 아니라 실제 사용 값이다.
APP_PALETTE = (
    ("#F4EDE0", "Stub/Edi 종이"), ("#F7ECE2", "Edi CREAM"), ("#1A1612", "Stub/Edi 잉크"),
    ("#14120F", "Criterion 잉크"), ("#14171A", "app fg"), ("#B0423F", "app accent"),
)
BC_VALUE = "0123456789"
# 286 = 현 Editorial 폭 · 372 = 풀블리드에서 Code128 절대 하한 0.19mm · 489 = 권장 0.25mm
BC_WIDTHS = (286, 372, 489)
# 높이 108px = 풀블리드 6.1mm. Code128 권장 높이(6.35mm)에 근접시켜 높이가 스캔 실패의 원인이
# 되지 않게 한다 — 폭만 변수로 남긴다.
BC_HEIGHT = 108


# ── Code 128 — src/components/moods/_shared.tsx 이식 ─────────────────────────────
# 값 0~106의 bar/space 폭 패턴(6요소, 폭 합 11모듈). 104=Start-B, 105=Start-C, 106=Stop(7요소).
# 도안의 바코드가 프로덕트가 렌더하는 것과 모듈 단위로 같아야 X-dim 실측이 성립하므로,
# 별 라이브러리를 쓰지 않고 앱의 인코더를 그대로 옮긴다.
CODE128_PATTERNS = (
    "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 "
    "112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 "
    "311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 "
    "112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 "
    "313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 "
    "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 "
    "122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 "
    "124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 "
    "114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112"
).split()
CODE128_START_C, CODE128_CODE_B, CODE128_STOP = 105, 100, 106
BARCODE_FALLBACK_DIGITS = "0000000000"
BARCODE_QUIET = 10  # Code128 표준 quiet zone >= 10 모듈


def code128c_bars(value: str) -> list[tuple[bool, int]]:
    """숫자 문자열 → [(ink, 모듈폭)] — buildBarcodeWidths128C + symbolsToBars 이식."""
    digits = "".join(c for c in value if c.isdigit()) or BARCODE_FALLBACK_DIGITS
    symbols = [CODE128_START_C]
    pair_end = len(digits) - len(digits) % 2
    for i in range(0, pair_end, 2):
        symbols.append(int(digits[i : i + 2]))
    if len(digits) % 2:
        symbols += [CODE128_CODE_B, ord(digits[-1]) - 32]
    checksum = CODE128_START_C + sum(v * (i + 1) for i, v in enumerate(symbols[1:]))
    seq = "".join(CODE128_PATTERNS[s] for s in [*symbols, checksum % 103, CODE128_STOP])
    return [(i % 2 == 0, int(ch)) for i, ch in enumerate(seq)]


def barcode_svg(value: str, width: int, height: int, color: str) -> str:
    """Barcode 프리미티브와 같은 폭 배분(unit = width / (모듈합 + quiet×2))으로 SVG를 만든다."""
    bars = code128c_bars(value)
    total = sum(w for _, w in bars)
    unit = width / (total + BARCODE_QUIET * 2)
    x = BARCODE_QUIET * unit
    rects = []
    for ink, w in bars:
        if ink:
            rects.append(f'<rect x="{x:.4f}" y="0" width="{max(w * unit, 0.5):.4f}" height="{height}" fill="{color}"/>')
        x += w * unit
    return (
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'shape-rendering="crispEdges" style="display:block">{"".join(rects)}</svg>'
    )


def barcode_unit(value: str, width: int) -> float:
    bars = code128c_bars(value)
    return width / (sum(w for _, w in bars) + BARCODE_QUIET * 2)


def barcode_modules(value: str) -> int:
    return sum(w for _, w in code128c_bars(value)) + BARCODE_QUIET * 2


# ── 폰트 해석 ─────────────────────────────────────────────────────────────────────
# 프로덕트가 쓰는 실물 폰트만 쓴다. 못 찾으면 조용히 대체하지 않고 던진다 — 다른 폰트로 찍힌
# 도안은 폰트 격자를 무의미하게 만들고, 그걸 모르고 인쇄하면 한 판을 버린다.
WANTED_FONTS = ("Pretendard Variable", "JetBrains Mono")


def resolve_fonts() -> dict[str, Path]:
    found: dict[str, Path] = {}
    pretendard = REPO / "public/fonts/PretendardVariable.woff2"
    if pretendard.exists():
        found["Pretendard Variable"] = pretendard

    # JetBrains Mono는 next/font/google이 빌드 때 받아 .next/static/media에 해시 이름으로 둔다.
    # 파일명으로는 못 찾으니 name 테이블의 family로 찾는다. 필요한 family만 담는다 — 전부 담으면
    # 안 쓰는 폰트(Nunito·Instrument Serif 등)까지 @font-face로 실려 렌더가 느려진다.
    if not set(WANTED_FONTS) <= found.keys():
        try:
            from fontTools.ttLib import TTFont
        except ImportError:  # pragma: no cover
            TTFont = None
        if TTFont is not None:
            for p in sorted(glob.glob(str(REPO / ".next/static/media/*.woff2"))):
                try:
                    f = TTFont(p, lazy=True)
                    fam = f["name"].getDebugName(16) or f["name"].getDebugName(1)
                except Exception:
                    continue
                if fam in WANTED_FONTS and fam not in found:
                    found[fam] = Path(p)

    missing = [f for f in WANTED_FONTS if f not in found]
    if missing:
        raise SystemExit(
            f"필요한 폰트를 못 찾았어요: {', '.join(missing)}\n"
            "  Pretendard  → public/fonts/PretendardVariable.woff2 (레포에 있어야 함)\n"
            "  JetBrains   → .next/static/media/*.woff2 (next/font/google이 빌드 때 받는다)\n"
            "  .next가 없으면 `bun run build` 또는 `bun dev`를 한 번 돌려 폰트를 받아주세요."
        )
    return found


# ── HTML ──────────────────────────────────────────────────────────────────────────
def css_px(v: float) -> str:
    return f"{v:g}px"


def blend_on_white(hex_color: str, opacity: float) -> str:
    """CSS opacity를 흰 배경 위 합성색으로 미리 계산 — 알파 레이어 없이 같은 결과."""
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    return "#" + "".join(f"{round(255 - (255 - c) * opacity):02x}" for c in (r, g, b))


def perimeter_rings() -> str:
    """재단 띠 + accent 프레임 — inset+border로 두르면 네 변이 한 링이라 코너가 저절로 이어지고,
    코너에서 잘린 모양이 그대로 카드 코너 반지름을 드러낸다."""
    out = []
    for i in range(BLEED_COUNT):
        color = ACCENT if i % 2 == 0 else INK
        out.append(
            f'<div class="ring" style="inset:{css_px(i * BLEED_STEP)};'
            f'border:{css_px(BLEED_STEP)} solid {color}"></div>'
        )
    out.append(f'<div class="ring" style="inset:{css_px(FRAME_INSET)};border:{css_px(FRAME_W)} solid {ACCENT}"></div>')
    return "".join(out)


def corner_arcs() -> str:
    """캔버스 모서리를 원점으로 하는 사분원 3겹. 호는 원점 쪽으로 볼록해 min(x,y) < 40 영역만
    지나므로 콘텐츠(40px 인셋)와는 절대 겹치지 않는다."""
    box = max(CORNER_ARC_RADII)
    out = []
    for vy in ("top", "bottom"):
        for vx in ("left", "right"):
            rings = "".join(
                f'<div style="position:absolute;{vy}:{css_px(-r)};{vx}:{css_px(-r)};'
                f"width:{css_px(r * 2)};height:{css_px(r * 2)};border-radius:50%;"
                f'border:{css_px(ARC_STROKE)} solid {ARC_COLOR};box-sizing:border-box"></div>'
                for r in CORNER_ARC_RADII
            )
            out.append(
                f'<div style="position:absolute;{vy}:0;{vx}:0;width:{css_px(box)};'
                f'height:{css_px(box)};overflow:hidden">{rings}</div>'
            )
    return "".join(out)


def ruler(orientation: str, length: int, align: str) -> str:
    """100px 주눈금/라벨 + 변 양끝 80px의 8px 정밀 눈금. 1px 부눈금은 밀도 14~32%로 안 찍혀 삭제.
    세로 라벨은 clear 구역이 13px뿐이라 writing-mode로 길이축에 눕힌다."""
    pin = align
    out = []

    def bar(at: float, depth: float, ln: float, w: float) -> str:
        if orientation == "h":
            geo = f"left:{css_px(at)};{pin}:{css_px(depth)};width:{css_px(w)};height:{css_px(ln)}"
        else:
            geo = f"top:{css_px(at)};{pin}:{css_px(depth)};height:{css_px(w)};width:{css_px(ln)}"
        return f'<div style="position:absolute;{geo};background:{INK}"></div>'

    fines: list[int] = []
    for p in range(FINE_PITCH, FINE_SPAN + 1, FINE_PITCH):
        fines += [p, length - p]
    for p in fines:
        long = p % (FINE_PITCH * 5) == 0 or (length - p) % (FINE_PITCH * 5) == 0
        ln = 14 if long else 8
        out.append(bar(p, RULER - ln, ln, 3))

    for p in range(100, length, 100):
        out.append(bar(p, RULER - TICK_LEN, TICK_LEN, 3))
        if orientation == "h":
            geo = f"left:{css_px(p + 5)};{pin}:{css_px(LABEL_DEPTH)}"
            extra = ""
        else:
            geo = f"top:{css_px(p + 5)};{pin}:{css_px(LABEL_DEPTH)}"
            extra = "writing-mode:vertical-rl;"
        out.append(
            f'<div style="position:absolute;{geo};{extra}font-family:var(--mono);'
            f'font-weight:800;font-size:12px;color:{INK};line-height:1">{p}</div>'
        )
    return "".join(out)


def section(title: str, body: str, note: str = "") -> str:
    note_html = f'<div class="note">{note}</div>' if note else ""
    return f'<div class="sec"><div class="sectitle">{title}</div>{body}{note_html}</div>'


def type_grid(sizes: list[int], cols: list[tuple[str, str, int]], sample: str, row_label) -> str:
    """크기 × weight 격자 — 라벨(의도값)과 렌더(실제값)를 한 프레임에서 대조한다. 폰트 크기는
    절대 안 줄인다(라벨 px = 실제 렌더 px라야 물리크기 역산이 성립). 넘치면 ellipsis."""
    head = f'<div class="grow" style="margin-bottom:2px"><div class="glabel"></div>' + "".join(
        f'<div class="glabel" style="width:{css_px(GRID_CELL)};color:{INK}">{c[0]}</div>' for c in cols
    ) + "</div>"
    rows = []
    for s in sizes:
        cells = "".join(
            f'<div class="gcell" style="width:{css_px(GRID_CELL)};font-family:{fam};'
            f'font-weight:{wt};font-size:{s}px">{sample}</div>'
            for _, fam, wt in cols
        )
        rows.append(
            f'<div class="grow" style="align-items:baseline;margin-bottom:2px">'
            f'<div class="glabel">{row_label(s)}</div>{cells}</div>'
        )
    return head + "".join(rows)


def line_matrix() -> str:
    head = '<div class="grow" style="margin-bottom:3px"><div class="glabel"></div>' + "".join(
        f'<div class="glabel" style="width:{css_px(GRID_CELL)};color:{INK}">{round(o * 100)}%</div>'
        for o in LINE_OPACITIES
    ) + "</div>"
    rows = []
    for w in LINE_WIDTHS:
        cells = []
        for o in LINE_OPACITIES:
            c = blend_on_white(INK, o)
            cells.append(
                f'<div style="width:{css_px(GRID_CELL)};flex-shrink:0;display:flex;'
                f"align-items:center;gap:10px\">"
                f'<div style="width:96px;height:{css_px(w)};background:{c}"></div>'
                f'<div style="width:{css_px(w)};height:20px;background:{c}"></div></div>'
            )
        rows.append(
            f'<div class="grow" style="align-items:center;height:26px">'
            f'<div class="glabel">{w}px</div>{"".join(cells)}</div>'
        )
    return head + "".join(rows)


def swatches(items, w: float, h: float, gap: float) -> str:
    cells = "".join(
        f'<div style="width:{css_px(w)};flex-shrink:0">'
        # border-box로 둬야 2px 테두리가 폭 안에 들어가 flex gap이 균일해진다.
        f'<div style="width:{css_px(w)};height:{css_px(h)};background:{c};border:2px solid {INK};'
        f'box-sizing:border-box"></div>'
        f'<div class="swlabel">{label}<br><span style="color:{FAINT}">{c}</span></div></div>'
        for c, label in items
    )
    return f'<div style="display:flex;gap:{css_px(gap)}">{cells}</div>'


def build_html(fonts: dict[str, Path]) -> str:
    def face(family: str, path: Path) -> str:
        return (
            f"@font-face{{font-family:'{family}';src:url('file://{path}') format('woff2');"
            "font-weight:1 1000;font-display:block}"
        )

    faces = "".join(face(f, p) for f, p in fonts.items())
    corner_px = MEASURED_CORNER_MM / FULLBLEED_MM_PER_PX

    header = f"""
    <div class="sec">
      <div class="h1">FILME · PRINT CALIBRATION v3</div>
      <div class="hbody">
        natural {NATURAL_W}×{NATURAL_H} px · export = product (+{EXPORT_MARGIN_PX}px 재단여유 ×2 →
        {(NATURAL_W + EXPORT_MARGIN_PX * 2) * 2}×{(NATURAL_H + EXPORT_MARGIN_PX * 2) * 2} JPEG q0.95) · #510 #521 #591
        <br><span style="color:{ACCENT}">적 {FRAME_W}px 프레임</span> = 콘텐츠 edge에서 {FRAME_INSET}px 안쪽(0점 아님)
        · 선 중심 간 {FRAME_SPAN_W:g}×{FRAME_SPAN_H:g}px · 배율 = 실측 프레임폭(mm) ÷ {FRAME_SPAN_W:g}
        <br><b>재단 띠</b>(가장자리 0-5-10-15-20px, <span style="color:{ACCENT}">적</span>·먹 교대 4겹) = 잘림량 C 실측
        — <b>남은 겹수 4/3/2/1/0 → C≈0/5/10/15/≥20</b>
        <br><b><span style="color:{ARC_COLOR}">파란 호 3겹</span></b> = 코너 반지름
        {"/".join(map(str, CORNER_ARC_RADII))}px 브래킷(메가박스 실측 {MEASURED_CORNER_MM}mm = 풀블리드
        {corner_px:.1f}px, 규격 3.18mm보다 타이트) · 변 양끝 {FINE_SPAN}px에 {FINE_PITCH}px 눈금
        <br>메가박스 실측(비풀블리드): 크롭 0, 카드의 86.1%로 축소, {MEGABOX_MM_PER_PX}mm/px · 1px=
        {MEGABOX_MM_PER_PX / DOT_MM:.2f}dot@300dpi
        <br>풀블리드 예측: C={EXPORT_MARGIN_PX}이면 {FULLBLEED_MM_PER_PX:.5f}mm/px · 1px=
        {FULLBLEED_MM_PER_PX / DOT_MM:.3f}dot — <b>이 인쇄로 C와 코너 반지름을 확정한다</b>
      </div>
    </div>"""

    kr_grid = section(
        "Font grid — FONT_KR (Pretendard Variable) · size × weight",
        type_grid([10, 12, 14, 18, 24], [(f"w{w}", "var(--kr)", w) for w in (400, 500, 700, 900)],
                  KR_SAMPLE, lambda s: f"KR {s}px"),
        "메가박스 실측 밀도: 10px 58.7% / 12px 61.3% / 14px 71.0% / 18px 75.7% / 24px 82.0% · "
        "16px는 w300 77.7% → w500 87.6% → w900 89.2% — weight가 size보다 싸게 밀도를 회복하는지 소형 대역에서 확인",
    )
    mono_grid = section(
        "Font grid — FONT_SANS vs FONT_MONO, 소형 대역 (#575)",
        type_grid([10, 12, 14], [("SANS 500", "var(--sans)", 500), ("MONO 500", "var(--mono)", 500),
                                 ("SANS 700", "var(--sans)", 700), ("MONO 700", "var(--mono)", 700)],
                  MIX_SAMPLE, lambda s: f"{s}px"),
        "등폭은 스템이 균일해 소형에서 밀도 손실이 클 것으로 예상 — Criterion 메타데이터 폰트 교체(#575) 판정용. "
        "MONO 열의 한글은 JetBrains Mono에 글리프가 없어 폴백되며, 그게 프로덕트의 실제 렌더다.",
    )
    lines = section(
        "Line width × opacity — 무드 구분선 판정",
        line_matrix(),
        "34% = MoodMinimal · 18% = MoodStub/Editorial 구분선 실제 값. 1px INK 실선 실측 밀도 14~32%, "
        "2px accent 26%(색 소실). 셀 왼쪽=가로선 · 오른쪽=세로선.",
    )
    ramp_cells = "".join(
        f'<div style="flex:1"><div style="height:46px;background:#{round(g / 100 * 255):02x}'
        f'{round(g / 100 * 255):02x}{round(g / 100 * 255):02x}"></div>'
        f'<div class="rampnum">{g}</div></div>'
        for g in GRAYS
    )
    ramp = section(
        "Grayscale ramp — 양 끝 붕괴 임계값",
        f'<div style="display:flex">{ramp_cells}</div>',
        "라벨 = % · 메가박스 실측: 0 vs 1·3 구분 불가, 97~100 동일, solid 블랙 Dmax≈1.9 — 붕괴가 시작하는 단을 "
        "좁힌다. 형압(#509)·근접톤 후가공의 설계 한계가 여기서 나온다.",
    )
    color = section(
        "Color — WB 기준 · 프라이머리 · 프로덕션 팔레트",
        swatches(WB_PRIMARIES, 91, 42, 7)
        + f'<div style="margin-top:6px">{swatches(APP_PALETTE, 91, 42, 7)}</div>',
        "일반 플라스틱 전사 인쇄기 가정의 일반 캘리브레이션 — 기기·잉크 상태마다 재현이 갈려 특정 hex 사전보정은 "
        "하지 않는다. WB 3종은 사진 화이트밸런스 기준(종이 대비 채널비로 읽으면 WB가 상쇄된다). 아랫줄은 실제 "
        f"프로덕션 값 — {APP_PALETTE[0][0]}은 톤 93%로 하이라이트 붕괴 경계라 크림으로 남나 흰색이 되나가 핵심.",
    )
    bc_rows = []
    for w in BC_WIDTHS:
        unit = barcode_unit(BC_VALUE, w)
        bc_rows.append(
            f'<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:5px">'
            f"{barcode_svg(BC_VALUE, w, BC_HEIGHT, INK)}"
            f'<div class="bclabel">W={w}px · 1모듈 {unit:.2f}px<br>'
            f'<span style="color:{FAINT}">X-dim 풀블리드 {unit * FULLBLEED_MM_PER_PX:.3f}mm · '
            f"메가박스 {unit * MEGABOX_MM_PER_PX:.3f}mm</span></div></div>"
        )
    barcode = section(
        "Barcode X-dimension — 스캔 임계값",
        "".join(bc_rows),
        f"{BC_WIDTHS[0]} = 현 Editorial 폭 · {BC_WIDTHS[1]} = 풀블리드 Code128 절대 하한 0.19mm · "
        f"{BC_WIDTHS[2]} = 권장 0.25mm. 인쇄물을 스캐너 앱으로 읽어 {BC_VALUE}가 디코드되는 최소 폭을 "
        f"기록한다(128C, quiet zone 포함 {barcode_modules(BC_VALUE)}모듈).",
    )

    rulers = "".join([
        ruler("h", NATURAL_W, "top"),
        ruler("v", NATURAL_H, "left"),
        ruler("h", NATURAL_W, "bottom"),
        ruler("v", NATURAL_H, "right"),
    ])

    return f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
{faces}
:root {{
  --kr: 'Pretendard Variable', sans-serif;
  --sans: 'Pretendard Variable', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}}
* {{ box-sizing: content-box; }}
html, body {{ margin: 0; padding: 0; background: #fff; }}
/* 페이지 = 콘텐츠 + 재단여유. 프로덕트 export가 캡처 노드 바깥에 흰 여백을 두르는 것과 같다.
   content-box라 width/height는 콘텐츠 크기이고 padding이 재단여유가 된다 → 총 {NATURAL_W + EXPORT_MARGIN_PX * 2}×{NATURAL_H + EXPORT_MARGIN_PX * 2}. */
.page {{ width: {NATURAL_W}px; height: {NATURAL_H}px; padding: {EXPORT_MARGIN_PX}px; background: #fff; }}
.sheet {{ position: relative; width: {NATURAL_W}px; height: {NATURAL_H}px; background: #fff; overflow: hidden; }}
.ring {{ position: absolute; }}
.flow {{ position: absolute; inset: {CONTENT_INSET}px; display: flex; flex-direction: column; gap: 12px; }}
.h1 {{ font-family: var(--mono); font-weight: 700; font-size: 21px; letter-spacing: 2px; color: {INK}; }}
.hbody {{ font-family: var(--mono); font-weight: 600; font-size: 12px; color: {INK};
  margin-top: 5px; line-height: 1.48; }}
.sectitle {{ font-family: var(--mono); font-weight: 700; font-size: 13px; letter-spacing: 1px;
  color: {INK}; border-bottom: 2px solid {INK}; padding-bottom: 3px; margin-bottom: 6px;
  text-transform: uppercase; }}
.note {{ font-family: var(--mono); font-weight: 500; font-size: 10.5px; color: {FAINT};
  margin-top: 3px; line-height: 1.3; }}
.grow {{ display: flex; gap: {GRID_GAP}px; }}
.glabel {{ font-family: var(--mono); font-weight: 700; font-size: 11px; color: {FAINT};
  width: {GRID_LABEL_W}px; flex-shrink: 0; white-space: nowrap; }}
.gcell {{ flex-shrink: 0; color: {INK}; line-height: 1.15; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; }}
.rampnum {{ font-family: var(--mono); font-weight: 600; font-size: 10px; color: {INK};
  text-align: center; margin-top: 2px; }}
.swlabel {{ font-family: var(--mono); font-weight: 600; font-size: 10px; color: {INK};
  margin-top: 2px; line-height: 1.2; }}
.bclabel {{ font-family: var(--mono); font-weight: 600; font-size: 11px; color: {INK}; line-height: 1.4; }}
.footer {{ margin-top: auto; font-family: var(--mono); font-weight: 600; font-size: 10.5px; color: {FAINT}; }}
</style></head>
<body><div class="page"><div class="sheet">
{perimeter_rings()}
{rulers}
{corner_arcs()}
<div class="flow">
{header}
{kr_grid}
{mono_grid}
{lines}
{ramp}
{color}
{barcode}
<div class="footer">made with FILME · calibration v3 · #510 #521 #591 · 인쇄는 100% 실제크기, 페이지맞춤 끄기</div>
</div>
</div></div></body></html>"""


# ── 렌더 ──────────────────────────────────────────────────────────────────────────
def find_chrome() -> str:
    for c in (
        os.environ.get("CHROME_PATH"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ):
        if c and Path(c).exists():
            return c
    raise SystemExit("Chrome을 못 찾았어요. CHROME_PATH 환경변수로 지정해주세요.")


def render(html: str, scale: int, quality: int, out: Path) -> tuple[int, int]:
    from PIL import Image

    page_w = NATURAL_W + EXPORT_MARGIN_PX * 2
    page_h = NATURAL_H + EXPORT_MARGIN_PX * 2
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "sheet.html"
        src.write_text(html, encoding="utf-8")
        png = Path(td) / "sheet.png"
        subprocess.run(
            [
                find_chrome(),
                "--headless=new",
                "--no-sandbox",
                "--hide-scrollbars",
                "--disable-lcd-text",  # 서브픽셀 안티에일리어싱 끔 — 인쇄용은 그레이스케일 AA가 맞다
                "--default-background-color=FFFFFFFF",
                "--allow-file-access-from-files",
                f"--force-device-scale-factor={scale}",
                f"--window-size={page_w},{page_h}",
                f"--screenshot={png}",
                f"file://{src}",
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        im = Image.open(png).convert("RGB")
        if im.size != (page_w * scale, page_h * scale):
            raise SystemExit(f"캡처 크기가 어긋났어요: {im.size} != {(page_w * scale, page_h * scale)}")
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, "JPEG", quality=quality, subsampling=0)
        return im.size


def verify(path: Path, scale: int) -> list[str]:
    """산출물이 스스로를 검증한다 — 기하가 어긋난 도안을 모르고 인쇄하면 한 판을 버린다.

    재단 띠·프레임 깊이와 코너 호 반지름은 이 도안의 모든 판독이 기대는 기준이라, 값이 밀리면
    실측 전체가 무의미해진다. 그래서 생성할 때마다 픽셀에서 되읽어 대조한다.
    """
    from PIL import Image

    a = Image.open(path).convert("RGB")
    problems: list[str] = []
    exp = ((NATURAL_W + EXPORT_MARGIN_PX * 2) * scale, (NATURAL_H + EXPORT_MARGIN_PX * 2) * scale)
    if a.size != exp:
        problems.append(f"크기 {a.size} != {exp}")
        return problems

    def hexrgb(h: str) -> tuple[int, int, int]:
        return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]

    def near(px: tuple[int, ...], want: tuple[int, int, int], tol: int = 26) -> bool:
        return all(abs(p - w) <= tol for p, w in zip(px, want))

    # 티켓좌표(콘텐츠 edge 기준) → 이미지 픽셀
    def at(x: float, y: float) -> tuple[int, ...]:
        return a.getpixel((round((x + EXPORT_MARGIN_PX) * scale), round((y + EXPORT_MARGIN_PX) * scale)))

    # 네 변 중앙에서 깊이 방향 단면: 재단 띠 4겹(적·먹 교대) → clear → 프레임 4px
    #  550/850은 100px 주눈금(과 양끝 80px 정밀눈금)과 안 겹치는 지점 — 900을 쓰면 주눈금을 밟는다.
    bands = [(i * BLEED_STEP + BLEED_STEP / 2, ACCENT if i % 2 == 0 else INK) for i in range(BLEED_COUNT)]
    probes = [
        ("top", lambda d: (550, d)),
        ("bottom", lambda d: (550, NATURAL_H - d)),
        ("left", lambda d: (d, 850)),
        ("right", lambda d: (NATURAL_W - d, 850)),
    ]
    for name, pos in probes:
        for depth, color in bands:
            px = at(*pos(depth))
            if not near(px, hexrgb(color)):
                problems.append(f"{name} 재단 띠 깊이 {depth:g}px: {px} != {color}")
        px = at(*pos(BLEED_DEPTH + (RULER - BLEED_DEPTH) / 2))
        if not near(px, (255, 255, 255)):
            problems.append(f"{name} clear 구역: {px} != 흰색")
        px = at(*pos(FRAME_INSET + FRAME_W / 2))
        if not near(px, hexrgb(ACCENT)):
            problems.append(f"{name} accent 프레임: {px} != {ACCENT}")

    # 코너 호 — 45° 대각선을 따라 반지름 r은 거리 r/√2에 나타난다.
    diag = 2**-0.5
    for r in CORNER_ARC_RADII:
        d = r * diag
        hit = any(near(at(d + k * 0.5, d + k * 0.5), hexrgb(ARC_COLOR), 40) for k in (-2, -1, 0, 1, 2))
        if not hit:
            problems.append(f"좌상 코너 호 r={r} (대각 {d:.1f}px)에 {ARC_COLOR} 없음")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description="인쇄 캘리브레이션 도안 v3 → JPEG (#591)")
    ap.add_argument("--out", type=Path, default=REPO / "calibration-v3.jpg")
    ap.add_argument("--scale", type=int, default=2, help="pixelRatio (프로덕트 export와 동일한 2)")
    ap.add_argument("--quality", type=int, default=95, help="JPEG 품질 (프로덕트 q0.95)")
    ap.add_argument("--html", type=Path, default=None, help="디버그: HTML도 이 경로에 저장")
    args = ap.parse_args()

    fonts = resolve_fonts()
    html = build_html(fonts)
    if args.html:
        args.html.write_text(html, encoding="utf-8")
    w, h = render(html, args.scale, args.quality, args.out)

    problems = verify(args.out, args.scale)
    print(f"{args.out}  {w}×{h} JPEG q{args.quality}")
    if problems:
        print("  검증 실패 — 이 도안으로 인쇄하지 마세요:")
        for p in problems:
            print(f"    ✗ {p}")
    else:
        print("  검증 OK — 재단 띠·프레임 깊이(네 변) · 코너 호 반지름 · 여백·크기 일치")
    for fam, p in fonts.items():
        print(f"  font  {fam:20s} {p.relative_to(REPO) if REPO in p.parents else p}")
    print(f"  배율   메가박스 실측 {MEGABOX_MM_PER_PX}mm/px · 풀블리드 예측 {FULLBLEED_MM_PER_PX:.5f}mm/px "
          f"(C={EXPORT_MARGIN_PX})")
    print(f"  코너   실측 {MEASURED_CORNER_MM}mm = 풀블리드 {MEASURED_CORNER_MM / FULLBLEED_MM_PER_PX:.1f}px "
          f"· 호 브래킷 {CORNER_ARC_RADII}")
    for bw in BC_WIDTHS:
        u = barcode_unit(BC_VALUE, bw)
        print(f"  바코드 W={bw:3d} 1모듈 {u:.2f}px → X-dim 풀블리드 {u * FULLBLEED_MM_PER_PX:.3f}mm")
    print("  인쇄: 100% 실제크기, 페이지맞춤 끄기")


if __name__ == "__main__":
    main()
