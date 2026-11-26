"""#826 S4 iOS: 입력 패널 종료 경로 넷(닫기·키보드 내림·밖 탭·브라우저 뒤로) 각 1회.
iOS Simulator 결과, 실기기 아님. 사용: python3 run826s4.py [a-close b-keyboard c-outside d-back] | python3 run826s4.py back
출력: $FILME_SIM_DIR/ev/826s4-*.png, 826s4-ios.json (기본 FILME_SIM_DIR=/Users/Lyainc/.local/state/lh-hc/results/s4-iossim)."""
import os, json, sys, time
os.environ.setdefault('FILME_SIM_DIR', '/Users/Lyainc/.local/state/lh-hc/results/s4-iossim')
os.environ.setdefault('FILME_URL', 'http://localhost:3022/')
from sim import *
import sim

WRAP = '.crop-marks'
STATE = '''const w=document.querySelector(".crop-marks"); const t=w?getComputedStyle(w).transform:null;
const p=document.querySelector("[data-field-panel]"); const tab=document.querySelector('[role=tab][aria-selected=true]');
let ls=null; try{ls=JSON.parse(localStorage.getItem("filme:phototicket:v1")||"{}").movieInfo?.theater??null}catch(e){}
const inp=p&&p.querySelector("input,textarea");
const rr=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
return {dock:rr(document.querySelector('[data-testid="editor-dock"]')), preview:rr(document.querySelector("div.relative.mx-auto.block.rounded-card")), panelOpen:!!p, tab:tab&&tab.id, transform:t, histLen:history.length, histState:history.state, ls, inputValue:inp?inp.value:null,
 active:document.activeElement&&document.activeElement.tagName, vvScale:visualViewport.scale, url:location.href}'''
# 열린 상태의 가시성(acceptance-7): 보이는 영역 = visualViewport(클라이언트 좌표 pageTop - scrollY) 중 패널 위쪽.
# 입력 · 패널(이름 칸 포함)은 보이는 영역 안 비율, 프리뷰는 패널 위로 드러난 높이(px)와 비율.
VIS = r'''const v=visualViewport, top=v.pageTop-scrollY, bot=top+v.height;
const p=document.querySelector("[data-field-panel],[data-percent-panel]"); const inp=p&&p.querySelector("input,textarea");
const pv=document.querySelector("div.relative.mx-auto.block.rounded-card");
const frac=(e,lo,hi)=>{if(!e)return null;const b=e.getBoundingClientRect();if(!b.height)return 0;return +(Math.max(0,Math.min(b.bottom,hi)-Math.max(b.top,lo))/b.height).toFixed(3)};
const pt=p?p.getBoundingClientRect().top:bot; const b=pv&&pv.getBoundingClientRect();
const exposedPx=b?Math.max(0,Math.min(b.bottom,pt,bot)-Math.max(b.top,top)):0;
return {vv:{top:+top.toFixed(1),h:+v.height.toFixed(1),scale:v.scale}, input:frac(inp,top,bot), panel:frac(p,top,bot),
 inputFont:inp&&getComputedStyle(inp).fontSize, previewExposedPx:+exposedPx.toFixed(1), previewExposedFrac:b?+(exposedPx/b.height).toFixed(3):null}'''
PANEL_RECT = 'const p=document.querySelector("[data-field-panel]");if(!p)return null;const r=p.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}'


def st():
    return js(STATE)


def open_theater():
    r = js('''const d=document.querySelector('[data-testid="editor-dock"]');
const b=[...d.querySelectorAll("button")].find(e=>e.textContent.trim().startsWith("극장"));if(!b)return null;b.scrollIntoView({block:"center"});
const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}''')
    if not r:
        raise RuntimeError('dock row 극장 not found')
    time.sleep(0.8)
    r = rect_of('[...document.querySelector("[data-testid=editor-dock]").querySelectorAll("button")].find(e=>e.textContent.trim().startsWith("극장"))')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    for _ in range(30):
        time.sleep(0.3)
        if js('return !!document.querySelector("[data-field-panel]")') and keyboard_rect():
            break
    if not keyboard_rect():
        r = rect_of('document.querySelector("[data-field-panel] input")')
        tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
        for _ in range(15):
            time.sleep(0.3)
            if keyboard_rect():
                break
    time.sleep(1.0)


def type_text(text):
    ctx('NATIVE')
    for ch in text:
        if not native_tap(ch):
            raise RuntimeError(f'key {ch!r} missing')
        time.sleep(0.15)
    time.sleep(0.5)


def gap():
    pr = js(PANEL_RECT); kb = keyboard_rect()
    if not pr or not kb:
        return {'panel': pr, 'kb': kb}
    pb = to_pt(pr['x'], pr['b'])[1]
    return {'panelBottomPt': round(pb, 1), 'kbTopPt': kb['y'], 'gapPt': round(kb['y'] - pb, 1)}


def exit_close():
    js('const b=[...document.querySelector("[data-field-panel]").querySelectorAll("button")].find(e=>e.textContent.trim()==="닫기"); b.__r=1;')
    r = rect_of('[...document.querySelector("[data-field-panel]").querySelectorAll("button")].find(e=>e.textContent.trim()==="닫기")')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    return 'tap 닫기 (XCTest)'


def exit_kbd():
    for n in ('Done', '완료', 'Hide keyboard', '키보드 가리기', 'return', 'Return', '리턴', 'Go', '이동', 'Search', '검색'):
        if native_tap(n):
            return f'tap key "{n}" (XCTest)'
    return None


def exit_outside():
    p = js('''const bd=[...document.querySelectorAll("div.fixed")].find(e=>e.getAttribute("aria-hidden")==="true"&&e.className.includes("z-40"));
if(!bd)return null; for(let y=4;y<400;y+=6){for(const x of [8,200,390]){const e=document.elementFromPoint(x,y);if(e===bd)return {x,y}}} return null''')
    if not p:
        return None
    tap_css(p['x'], p['y'])
    return f'tap backdrop at css ({p["x"]},{p["y"]}) (XCTest)'


def exit_back():
    # 1차: iOS 엣지 스와이프(XCTest 합성 터치). 실패하면 WebDriver back(합성 터치 아님)으로 낮춰 표기.
    for n in ('뒤로',):
        kb = keyboard_rect()
        if not kb and native_tap(n):
            time.sleep(1.2)
            return f'Safari toolbar "{n}" button (XCTest tap)'
    for sx, ms in ((0, 250), (1, 600)):
        sim.ctx('NATIVE')
        sim._act([{'type': 'pointerMove', 'duration': 0, 'x': sx, 'y': 300}, {'type': 'pointerDown', 'button': 0},
                  {'type': 'pause', 'duration': 50}, {'type': 'pointerMove', 'duration': ms, 'x': 320, 'y': 300},
                  {'type': 'pointerUp', 'button': 0}])
        time.sleep(1.2)
        if not js('return !!document.querySelector("[data-field-panel]")'):
            return f'left-edge swipe from x={sx} (XCTest)'
    if js('return !!document.querySelector("[data-field-panel]")'):
        req('POST', 'back'); time.sleep(1.2)
        return 'edge-swipe did not close; used WebDriver back (NOT a touch; weaker evidence)'
    return 'left-edge swipe back (XCTest)'


PATHS = [('a-close', exit_close, 'ㅂㅈㄷ'), ('b-keyboard', exit_kbd, 'ㄱㅅㅁ'), ('c-outside', exit_outside, 'ㄴㅇㄹ'), ('d-back', exit_back, 'ㅎㅋㅌ')]
out = {'device': None, 'note': 'iOS Simulator 결과, 실기기 아님', 'paths': {}}
try:
    caps = req('GET', 'appium/capabilities') if False else None
except Exception:
    pass
out['runtime'] = subprocess.run(['xcrun', 'simctl', 'list', 'devices', 'booted'], capture_output=True, text=True).stdout
out['wdaDevice'] = req('GET', 'wda/device/info') if False else None

def open_row(label, want_kbd):
    r = js('''const d=document.querySelector('[data-testid="editor-dock"]');
const b=[...d.querySelectorAll("button")].find(e=>e.textContent.trim().startsWith(arguments[0]));if(!b)return null;b.scrollIntoView({block:"center"});return 1''', label)
    if not r:
        raise RuntimeError(f'dock row {label} not found')
    time.sleep(0.8)
    r = rect_of('[...document.querySelector("[data-testid=editor-dock]").querySelectorAll("button")].find(e=>e.textContent.trim().startsWith(%s))' % json.dumps(label))
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    for _ in range(30):
        time.sleep(0.3)
        if js('return !!document.querySelector("[data-field-panel]")') and (bool(keyboard_rect()) == want_kbd):
            break
    time.sleep(1.0)


def back_checks(before, after):
    return {'panelClosed': not after['panelOpen'], 'sameUrl': after['url'] == before['url'], 'sameTab': after['tab'] == before['tab'],
            'dockSame': after['dock'] == before['dock'],
            'identity': after['transform'] in ('none', 'matrix(1, 0, 0, 1, 0, 0)'),
            'noPanelToken': not (after['histState'] or {}).get('phototicketInputPanel'), 'ls': after['ls']}


def clean_close():
    if js('return !!document.querySelector("[data-field-panel]")'):
        js('[...document.querySelector("[data-field-panel]").querySelectorAll("button")].find(e=>e.textContent.trim()==="닫기").click()'); time.sleep(1.0)


def back_mode():
    res = {'note': 'iOS Simulator 결과, 실기기 아님'}
    reset_editor()
    js('document.querySelector("#dock-mode-tab-info").click()'); time.sleep(0.6)
    tap_el('document.querySelector("#dock-mode-tab-info")'); time.sleep(0.8)
    # A) text field + keyboard up, native edge swipe
    A = {}
    try:
        A['before'] = st(); shot('826s4-back-A-0-before')
        open_theater(); A['kb'] = keyboard_rect(); type_text('ㅂㅈㄷ'); A['typed'] = st(); shot('826s4-back-A-1-open-typed')
        for name, fn in (('mobile:dragFromToForDuration', lambda: (sim.ctx('NATIVE'), req('POST', 'execute/sync', {'script': 'mobile: dragFromToForDuration', 'args': [{'duration': 0.5, 'fromX': 1, 'fromY': 400, 'toX': 260, 'toY': 400}]}))),
                         ('W3C pointer x=1 slow', lambda: sim._act([{'type': 'pointerMove', 'duration': 0, 'x': 1, 'y': 400}, {'type': 'pointerDown', 'button': 0}, {'type': 'pause', 'duration': 200}, {'type': 'pointerMove', 'duration': 900, 'x': 260, 'y': 400}, {'type': 'pointerUp', 'button': 0}]))):
            try:
                fn()
            except Exception as e:
                A[name + ' error'] = repr(e)
            time.sleep(1.5)
            A['after ' + name] = st(); shot('826s4-back-A-2-after-' + name.split(':')[0].split(' ')[0])
            if not A['after ' + name]['panelOpen']:
                A['closedBy'] = name; break
        A['checks'] = back_checks(A['before'], A['after ' + [k for k in A if k.startswith('after ')][-1][6:]]) if True else None
        A['verdict'] = '통과' if A.get('closedBy') and all(v for k, v in A['checks'].items() if k != 'ls') else '실패'
    except Exception as e:
        A['verdict'] = '오류'; A['error'] = repr(e)
    clean_close(); res['A'] = A
    # B) rating panel (no keyboard), Safari toolbar Back
    if A.get('verdict') != '통과':
        B = {}
        try:
            B['before'] = st(); shot('826s4-back-B-0-before')
            open_row('평점', False); B['kb'] = keyboard_rect(); B['opened'] = st(); B['visible'] = js(VIS); shot('826s4-back-B-1-open')
            B['backFound'] = bool(native_find('뒤로'))
            B['tapped'] = native_tap('뒤로'); time.sleep(1.5)
            B['after'] = st(); shot('826s4-back-B-2-after')
            B['checks'] = back_checks(B['before'], B['after'])
            B['verdict'] = '통과' if B['tapped'] and not B['kb'] and all(v for k, v in B['checks'].items() if k != 'ls') else '실패'
        except Exception as e:
            B['verdict'] = '오류'; B['error'] = repr(e)
        clean_close(); res['B'] = B
    json.dump(res, open(f'{sim.S}/ev/826s4-back.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: (v.get('verdict'), v.get('closedBy'), v.get('checks')) for k, v in res.items() if isinstance(v, dict)}, ensure_ascii=False))


if sys.argv[1:2] == ['back']:
    back_mode(); sys.exit(0)

reset_editor()
js('document.querySelector("#dock-mode-tab-info").click()'); time.sleep(0.6)
tap_el('document.querySelector("#dock-mode-tab-info")'); time.sleep(0.8)
out['initial'] = st()
sel = sys.argv[1:] or [p[0] for p in PATHS]
for name, fn, val in PATHS:
    if name not in sel and name[0] not in sel:
        continue
    rec = {'typed': val}
    try:
        rec['before'] = st()
        shot(f'826s4-{name}-0-before')
        open_theater()
        rec['kbRect'] = keyboard_rect()
        rec['opened'] = st()
        rec['panelKbGap'] = gap()
        rec['visible'] = js(VIS)
        shot(f'826s4-{name}-1-open')
        # 새 값 입력: 기존 내용 위에 이어 붙인다(전체 삭제 없이 값이 바뀌는지만 본다).
        type_text(val)
        rec['typedState'] = st()
        shot(f'826s4-{name}-2-typed')
        how = fn()
        rec['how'] = how
        if how is None:
            rec['verdict'] = '미검증'; rec['reason'] = 'no exit control found in native keyboard (hide-key/Done absent on this layout)'
            fallback = js('const i=document.querySelector("[data-field-panel] input");i&&i.blur();return 1')  # 정리용(판정 아님)
            time.sleep(0.8)
            # 정리: 닫기로 복구
            if js('return !!document.querySelector("[data-field-panel]")'):
                exit_close(); time.sleep(0.8)
            rec['cleanup'] = 'panel closed via 닫기 for next path'
        else:
            time.sleep(1.2)
            rec['after'] = st()
            rec['kbAfter'] = keyboard_rect()
            shot(f'826s4-{name}-3-after')
            a, b = rec['before'], rec['after']
            vis = rec['visible']
            rec['checks'] = {'inputVisible': (vis['input'] or 0) >= 0.99, 'panelVisible': (vis['panel'] or 0) >= 0.99,
                             'previewExposed': vis['previewExposedPx'] > 0, 'sameTab': b['tab'] == a['tab'],
                             'identity': b['transform'] in ('none', 'matrix(1, 0, 0, 1, 0, 0)'),
                             'dockSame': a['dock'] == b['dock'], 'previewSame': a['preview'] == b['preview'],
                             'valueKept': val in (b['ls'] or ''), 'closed': not b['panelOpen']}
            ok = not a['panelOpen'] and all(rec['checks'].values())
            rec['verdict'] = '통과' if ok else '실패'
    except Exception as e:
        rec['verdict'] = '오류'; rec['error'] = repr(e)
        try: shot(f'826s4-{name}-err')
        except Exception: pass
    if js('return !!document.querySelector("[data-field-panel]")'):
        rec['cleanup'] = 'panel still open; closed via JS click for next path'
        js('[...document.querySelector("[data-field-panel]").querySelectorAll("button")].find(e=>e.textContent.trim()==="닫기").click()'); time.sleep(1.0)
    out['paths'][name] = rec
    print(name, rec.get('verdict'), rec.get('how'), json.dumps({'checks': rec.get('checks'), 'visible': rec.get('visible'), 'error': rec.get('error')}, ensure_ascii=False), flush=True)
json.dump(out, open(f'{sim.S}/ev/826s4-ios.json', 'w'), ensure_ascii=False, indent=1)
