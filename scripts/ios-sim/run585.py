"""#585 iOS(#841 재작성, #826 S8 acceptance-6): 도크 디자인 도구의 % 입력 전부 × 종료 경로(키보드 '완료' / 바깥 탭)
와 정보 모드 필드 입력 전부의 포커스 뒤 확대 여부 · 입력 글꼴. XCTest 터치, 소프트웨어 키보드. iOS Simulator 결과, 실기기 아님.

경로: #dock-mode-tab-design → #design-tool-tab-<id> → (재질 · 코팅은 레시피 옵션 선택) → '<이름> 퍼센트 입력' 버튼
→ 키보드에 붙는 % 패널([data-percent-panel], 입력 aria-label '<이름> 퍼센트', #826 S4 K-03).
필드: #dock-mode-tab-info → 정보 행 '제목' → 입력 패널([data-field-panel])의 '다음 항목'으로 한 바퀴 순회(평점은 소수 입력을 열어 잰다).

사용: python3 run585.py [0-7 ...] [fields]   (인자 없으면 전부)
출력: $FILME_SIM_DIR/ev/585-*.png, 585-ios.json. PASS = 모든 포커스 상태에서 visualViewport.scale == 1 · font-size >= 16px,
% 입력은 친 값이 슬라이더에 커밋되고 종료 뒤 도크 · 프리뷰 rect가 그대로."""
import json, sys, time
from sim import *

# (도구 id, 재질/코팅 옵션 라디오 그룹 aria-label 또는 None, 슬라이더 라벨, 경로 a 값, 경로 b 값)
SLIDERS = [
    ('opacity', None, '포스터', '37', '42'),
    ('opacity', None, '컴포넌트', '37', '42'),
    ('material', '재질', '재질 강도', '37', '42'),
    ('coating', '코팅', '코팅 강도', '37', '42'),
    ('size', None, '극장 로고 크기', '80', '90'),
    ('size', None, '포맷 로고 크기', '80', '90'),
]

SLIDER = r'''
const lab=[...document.querySelectorAll("label")].find(l=>l.textContent.trim()===arguments[0]);
const rng=lab&&document.getElementById(lab.htmlFor);
const btn=document.querySelector(`[aria-label="${arguments[0]} 퍼센트 입력"]`);
const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
return {range:rng&&rng.value, rangeRect:r(rng), button:r(btn), buttonText:btn&&btn.textContent.trim(),
 dock:r(document.querySelector('[data-testid="editor-dock"]')), preview:r(document.querySelector("div.relative.mx-auto.block.rounded-card"))};
'''

# 포커스 상태 측정: 확대(scale) · 포커스 입력의 computed font-size · 보이는 영역 안 비율.
FOCUS = r'''
const v=visualViewport, top=v.pageTop-scrollY, bot=top+v.height, a=document.activeElement;
const p=document.querySelector("[data-percent-panel],[data-field-panel]");
const frac=e=>{if(!e)return null;const b=e.getBoundingClientRect();if(!b.height)return 0;return +(Math.max(0,Math.min(b.bottom,bot)-Math.max(b.top,top))/b.height).toFixed(3)};
const isInput=a&&/^(INPUT|TEXTAREA)$/.test(a.tagName);
return {zoom:+v.scale.toFixed(3), vvH:+v.height.toFixed(1), active:a&&(a.getAttribute("aria-label")||a.tagName), activeType:a&&a.type,
 isInput, font:isInput?getComputedStyle(a).fontSize:null, value:isInput?a.value:null,
 panel:p&&(p.getAttribute("data-field-panel")||"percent"), scrollY:Math.round(scrollY), inputVisible:isInput?frac(a):null, panelVisible:frac(p)};
'''


def px(font):
    return float(font[:-2]) if font and font.endswith('px') else 0


def tap_id(i):
    tap_el(f'document.getElementById({json.dumps(i)})'); time.sleep(0.8)


def wait(cond_js, n=30, dt=0.3):
    for _ in range(n):
        if js(cond_js):
            return True
        time.sleep(dt)
    return False


def open_tool(tool, group, label):
    reset_editor()
    tap_id('dock-mode-tab-design')
    js(f'document.getElementById("design-tool-tab-{tool}").scrollIntoView({{inline:"center",block:"nearest"}})'); time.sleep(0.8)
    tap_id(f'design-tool-tab-{tool}')
    if group:  # 강도 슬라이더는 레시피 옵션에서만 뜬다 — 두 번째 라디오(미술용지 · 유광)를 고른다.
        expr = f'document.querySelectorAll(\'[role=radiogroup][aria-label="{group}"] [role=radio]\')[1]'
        js(f'{expr}.scrollIntoView({{inline:"center",block:"nearest"}})'); time.sleep(0.8)
        tap_el(expr); time.sleep(0.8)
    s = js(SLIDER, label)
    if not s['button']:
        shot('585-notfound-' + label)
        raise RuntimeError('percent button not reachable: ' + label)
    js(f'document.querySelector(\'[aria-label="{label} 퍼센트 입력"]\').scrollIntoView({{block:"center"}})'); time.sleep(0.8)
    return js(SLIDER, label)


def clear_and_type(value):
    for _ in range(4):
        if not native_tap('삭제') and not native_tap('delete') and not native_tap('Delete'):
            break
        time.sleep(0.08)
    type_keys(value)
    time.sleep(0.4)


def run_pct(tool, group, label, value, exit_path, tag):
    before = open_tool(tool, group, label)
    b = before['button']
    tap_css(b['x'] + b['w'] / 2, b['y'] + b['h'] / 2)
    if not wait('return !!document.querySelector("[data-percent-panel]")'):
        raise RuntimeError('percent panel did not open')
    time.sleep(1.0)
    kb = keyboard_rect()
    during = js(FOCUS)
    shot(f'{tag}-during')
    if not during['isInput']:
        raise RuntimeError('percent input not focused after tap (refusing to type)')
    clear_and_type(value)
    typed = js(FOCUS)
    shot(f'{tag}-typed')
    if exit_path == 'done':
        how = '키보드 완료' if (native_tap('완료') or native_tap('Done')) else None
    else:  # 바깥 탭: 패널 막(fixed inset-0 z-40)이 받는 화면 위쪽 점
        pt = js('''const bd=[...document.querySelectorAll("div.fixed")].find(e=>e.getAttribute("aria-hidden")==="true"&&e.className.includes("z-40"));
if(!bd)return null; for(let y=4;y<300;y+=6){for(const x of [8,200,390]){if(document.elementFromPoint(x,y)===bd)return {x,y}}} return null''')
        how = None
        if pt:
            tap_css(pt['x'], pt['y']); how = f'바깥 탭 css ({pt["x"]},{pt["y"]})'
    time.sleep(1.2)
    after = js(SLIDER, label)
    closed = not js('return !!document.querySelector("[data-percent-panel]")')
    shot(f'{tag}-after')
    want = str(int(value))
    checks = {'noZoom': during['zoom'] == 1 and typed['zoom'] == 1, 'font16': px(during['font']) >= 16,
              'inputVisible': (during['inputVisible'] or 0) >= 0.99, 'keyboard': bool(kb), 'exitFound': bool(how),
              'closed': closed, 'committed': after['buttonText'] == want,
              'dockSame': after['dock'] == before['dock'], 'previewSame': after['preview'] == before['preview']}
    return {'label': label, 'tool': tool, 'exit': exit_path, 'how': how, 'value': value, 'keyboard': kb,
            'before': before, 'during': during, 'typed': typed, 'after': after, 'checks': checks,
            'verdict': 'PASS' if all(checks.values()) else 'FAIL'}


def run_fields():
    reset_editor()
    tap_id('dock-mode-tab-info')
    r = rect_of('[...document.querySelector(\'[data-testid="editor-dock"]\').querySelectorAll("button")].find(e=>e.textContent.trim().startsWith("제목"))')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    if not wait('return !!document.querySelector("[data-field-panel]")'):
        raise RuntimeError('field panel did not open')
    time.sleep(1.2)
    steps, seen = [], set()
    for i in range(40):
        f = js(FOCUS)
        f['keyboard'] = bool(keyboard_rect())
        if f['panel'] == 'rating' and not f['isInput']:
            # 평점은 숫자 버튼을 눌러야 소수 입력이 열린다(D16 4-A) — 열어서 그 입력도 잰다.
            tap_el('document.querySelector(\'[data-field-panel] [aria-label="평점 소수 입력 토글"]\')'); time.sleep(1.2)
            f = js(FOCUS); f['keyboard'] = bool(keyboard_rect()); f['openedDecimal'] = True
        steps.append(f)
        shot(f'585-field-{i:02d}-{f["panel"]}')
        seen.add(f['panel'])
        nxt = rect_of('document.querySelector(\'[data-field-panel] [aria-label="다음 항목"]\')')
        if not nxt or nxt['w'] == 0 or js('return document.querySelector(\'[data-field-panel] [aria-label="다음 항목"]\').disabled'):
            break
        prev, cur = f['panel'], f['panel']
        # 날짜 입력은 iOS가 달력 팝오버를 띄우고 그동안 첫 탭은 팝오버 닫기로 쓰인다 — 그대로면 한 번 더 누르고 기록한다.
        for attempt in range(2):
            tap_css(nxt['x'] + nxt['w'] / 2, nxt['y'] + nxt['h'] / 2)
            for _ in range(10):
                time.sleep(0.25)
                cur = js('return document.querySelector("[data-field-panel]")?.getAttribute("data-field-panel")')
                if cur != prev:
                    break
            if cur != prev:
                break
            f['nextTapsNeeded'] = 2
        if cur is None or cur == prev or cur in seen:  # 닫힘 · 안 넘어감 · 한 바퀴(순회는 끝에서 처음으로 돈다)
            f['stepEnd'] = cur
            break
        time.sleep(0.8)
    js('[...document.querySelectorAll("[data-field-panel] button")].find(e=>e.textContent.trim()==="닫기")?.click()')
    inputs = [s for s in steps if s['isInput']]
    checks = {'allNoZoom': all(s['zoom'] == 1 for s in steps), 'allFont16': all(px(s['font']) >= 16 for s in inputs),
              # 패널이 보이는 영역 안에 있고 문서가 스크롤되지 않았다(‹ › 전환 때 iOS가 문서를 밀어 패널이 키보드 뒤로 가던 것, #826 S8).
              'allPanelVisible': all((s['panelVisible'] or 0) >= 0.99 for s in steps), 'noDocScroll': all(s['scrollY'] == 0 for s in steps),
              'wrapped': steps[-1].get('stepEnd') == steps[0]['panel'], 'inputsSeen': len(inputs)}
    return {'steps': steps, 'fields': [s['panel'] for s in steps], 'checks': checks,
            'verdict': 'PASS' if inputs and all(v for k, v in checks.items() if k != 'inputsSeen') else 'FAIL'}


out = {'note': 'iOS Simulator 결과, 실기기 아님', 'percent': [], 'fields': None}
only = sys.argv[1:]
for i, (tool, group, label, v1, v2) in enumerate(SLIDERS):
    if only and str(i) not in only:
        continue
    for v, ex, t in ((v1, 'done', 'a'), (v2, 'outside', 'b')):
        try:
            r = run_pct(tool, group, label, v, ex, f'585-{i}{t}')
        except Exception as e:
            r = {'label': label, 'exit': ex, 'verdict': 'ERROR', 'error': str(e)[:300]}
            shot(f'585-{i}{t}-err')
        out['percent'].append(r)
        print(json.dumps({k: r.get(k) for k in ('label', 'exit', 'verdict', 'how', 'checks', 'error')}, ensure_ascii=False), flush=True)
        print('  during', {k: (r.get('during') or {}).get(k) for k in ('zoom', 'font', 'vvH', 'inputVisible')}, flush=True)
if not only or 'fields' in only:
    try:
        out['fields'] = run_fields()
    except Exception as e:
        out['fields'] = {'verdict': 'ERROR', 'error': str(e)[:300]}
    fr = out['fields']
    print('fields', fr.get('verdict'), fr.get('checks'), fr.get('fields'), fr.get('error'), flush=True)
    for s in fr.get('steps', []):
        print('  ', s['panel'], s['active'], s['activeType'], s['font'], 'zoom', s['zoom'], 'kb', s['keyboard'], 'scrollY', s['scrollY'], 'panelVis', s['panelVisible'], 'taps', s.get('nextTapsNeeded', 1), flush=True)
ran = out['percent'] + ([out['fields']] if out['fields'] else [])
out['verdict'] = 'PASS' if ran and all(r.get('verdict') == 'PASS' for r in ran) else 'FAIL'
json.dump(out, open(f'{S}/ev/585-ios.json', 'w'), ensure_ascii=False, indent=1)
print('overall', out['verdict'])
sys.exit(0 if out['verdict'] == 'PASS' else 1)
