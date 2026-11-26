"""#826 S8 acceptance-12 iOS: 랜딩 걷힘 240ms(OVERLAY_EXIT_MS) 동안의 탭이 아래 편집 화면으로 통과하는가.

측정 절차(Seed): '직접 입력'(landing-skip-poster) 탭 직후 50 · 120 · 200ms에 아래 편집 화면의 자리 — 제목 필드
([data-field-tap=title]) · 도크 '디자인' 탭(#dock-mode-tab-design) — 를 XCTest로 탭하고, 걷힘 뒤 포커스된 입력 · 선택된 도크 탭
(기본은 정보) · 열린 패널이 없으면 PASS.

이 하네스(Appium XCUITest 12.19.1, iOS 27.0 Simulator)로는 그 시각에 두 번째 탭을 넣을 수 없다(2026-11-27 실측):
- 탭을 따로 보내면 첫 click → 두 번째 touchstart가 최소 약 340ms라 240ms 창 밖이다(아래 1단계가 매번 잰다).
- 한 손가락 액션 묶음에 누름을 두 번 넣으면 XCUITest가 중간의 손 떼기를 무시해 드래그 하나가 된다.
- 손가락 둘을 시간 오프셋으로 넣으면 iOS가 핀치로 받아 화면이 확대된다(scale 1.8~3.9).
그래서 판정은 BLOCKED이고, 판정이 아닌 구조 증거로 2단계가 '직접 입력' click 뒤 0~400ms의 elementFromPoint와 랜딩 pointer-events를
기록한다. 창 안에 탭을 넣을 수 있는 하네스가 생기면 1단계 간격이 240ms 아래로 내려오고, 그때 3단계에 실제 탭 판정을 붙인다.

iOS Simulator 결과, 실기기 아님. 사용: python3 run826s12.py   출력: $FILME_SIM_DIR/ev/826s12-*.png, 826s12-ios.json
"""
import json, sys, time
import sim
from sim import *

WINDOW_MS = 240
TARGETS = {
    'field': 'document.querySelector("[data-field-tap=title]")',
    'dockTab': 'document.getElementById("dock-mode-tab-design")',
}
STATE = '''const a=document.activeElement, t=document.querySelector('[role=tab][aria-selected=true][id^="dock-mode-tab-"]');
const l=document.querySelector("[data-testid=landing]");
return {focusedInput:!!a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)?(a.getAttribute("aria-label")||a.tagName):null,
 panel:document.querySelector("[data-field-panel]")?.getAttribute("data-field-panel")??null,
 dockTab:t&&t.id, landingShown:!!l&&getComputedStyle(l).display!=="none"&&l.getBoundingClientRect().height>0, zoom:visualViewport.scale}'''
LOG = '''window.__E=[];const t0=performance.now();for(const k of ["touchstart","click"])document.addEventListener(k,e=>{
window.__E.push([Math.round(performance.now()-t0),k,e.target.closest&&e.target.closest("[data-testid=landing-skip-poster]")?"skip":"other"])},true)'''


def open_landing():
    ctx('WEB'); req('POST', 'url', {'url': f'{URL}?l={int(time.time() * 1000)}'})
    time.sleep(2.5)
    sim._ctx[0] = None; sim._web[0] = None
    for _ in range(4):  # 새 탐색이 Safari 확대를 풀지 않을 때가 있다 — 핀치로 1배로 되돌린다.
        if js('return visualViewport.scale') <= 1.01:
            break
        pinch_in_pt(d0=180, d1=10); time.sleep(1.0)
    for _ in range(30):
        try:
            r = rect_of('document.querySelector("[data-testid=landing-skip-poster]")')
            if r and r['h'] > 0 and js(STATE)['landingShown']:
                return r
        except Exception:
            sim._web[0] = None
        time.sleep(0.5)
    raise RuntimeError('landing did not show')


def center(r):
    return r['x'] + r['w'] / 2, r['y'] + r['h'] / 2


def measure_targets():
    """랜딩이 떠 있는 동안 편집 화면은 display:none이라 자리를 잴 수 없다 — '직접 입력'으로 한 번 들어가 걷힘 뒤 잰다."""
    tap_css(*center(open_landing())); time.sleep(1.5)
    return {k: rect_of(e) for k, e in TARGETS.items()}


out = {'note': 'iOS Simulator 결과, 실기기 아님', 'windowMs': WINDOW_MS}
rects = measure_targets()
out['targets'] = rects

# 1단계: 따로 보낸 XCTest 탭 두 번의 실제 간격(첫 click → 두 번째 touchstart, 페이지 시계)과 그 탭의 결과(양성 대조).
gaps = []
for k in TARGETS:
    a = to_pt(*center(open_landing())); b = to_pt(*center(rects[k]))
    js(LOG)
    tap_pt(*a, hold_ms=40); tap_pt(*b, hold_ms=40); time.sleep(1.5)
    ev = js('return window.__E')
    clicks = [e[0] for e in ev if e[1] == 'click' and e[2] == 'skip']
    starts = [e[0] for e in ev if e[1] == 'touchstart' and e[2] == 'other']
    gap = starts[0] - clicks[0] if clicks and starts else None
    st = js(STATE); shot(f'826s12-control-{k}')
    gaps.append(gap)
    out.setdefault('control', []).append({'target': k, 'gapMs': gap, 'events': ev, 'after': st})
    print('control', k, 'gap', gap, json.dumps(st, ensure_ascii=False), flush=True)
    js('[...document.querySelectorAll("[data-field-panel] button")].find(b=>b.textContent.trim()==="닫기")?.click()')

# 2단계(구조 증거, 판정 아님): '직접 입력' click 뒤 시점별 그 자리의 hit-test와 랜딩 pointer-events · 불투명도.
a = to_pt(*center(open_landing()))
pts = [[k, *center(r)] for k, r in rects.items()]
js('''const P=arguments[0]; window.__H=[]; const b=document.querySelector("[data-testid=landing-skip-poster]");
b.addEventListener("click",()=>{const t0=performance.now(); for(const ms of [0,50,120,200,260,400]) setTimeout(()=>{
const l=document.querySelector("[data-testid=landing]"); const row={ms, real:Math.round(performance.now()-t0), landingPE:l&&getComputedStyle(l).pointerEvents, landingOpacity:+(l?getComputedStyle(l).opacity:0)};
for(const [k,x,y] of P){const e=document.elementFromPoint(x,y); row[k]=!e?null:e.closest("[data-field-tap]")?"field:"+e.closest("[data-field-tap]").dataset.fieldTap:
e.closest("#dock-mode-tab-design")?"dockTab:design":e.closest("[data-testid=landing]")?"landing":e.tagName}
window.__H.push(row)},ms)},{capture:true,once:true});''', pts)
tap_pt(*a); time.sleep(1.5)
out['hitTest'] = js('return window.__H')
for row in out['hitTest']:
    print('hit', json.dumps(row, ensure_ascii=False), flush=True)

# 3단계: 판정. 창 안에 탭을 넣지 못했으면 BLOCKED(통과로 세지 않는다).
reach = [g for g in gaps if g is not None]
if not reach or min(reach) >= WINDOW_MS:
    out['verdict'] = 'BLOCKED'
    out['reason'] = f'XCTest 두 번째 탭의 최소 간격 {min(reach) if reach else None}ms ≥ 걷힘 {WINDOW_MS}ms — 창 안 탭을 보낼 수 없음'
else:
    out['verdict'] = 'UNJUDGED'
    out['reason'] = '창 안 탭이 가능해졌다 — 50·120·200ms 판정 단계를 이 자리에 붙일 것'
json.dump(out, open(f'{S}/ev/826s12-ios.json', 'w'), ensure_ascii=False, indent=1)
print('overall', out['verdict'], out['reason'])
sys.exit(2)
