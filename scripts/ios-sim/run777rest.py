"""#777 remaining UNRUN rows: small-field enlargement path (max view, pinch zoom) and dark-theme recovery path."""
import json, time
from run777 import *

F = 'const a=document.activeElement; return a && (a.getAttribute("aria-label")||a.tagName)'
out = {'enlarge': {}, 'darkRecovery': {}}


def pinch_out_pt(cx=201, cy=420, d0=20, d1=150, ms=500):
    ctx('NATIVE')
    def f(i, sx, ex):
        return {'type': 'pointer', 'id': f'f{i}', 'parameters': {'pointerType': 'touch'}, 'actions': [
            {'type': 'pointerMove', 'duration': 0, 'x': sx, 'y': cy}, {'type': 'pointerDown', 'button': 0},
            {'type': 'pause', 'duration': 100}, {'type': 'pointerMove', 'duration': ms, 'x': ex, 'y': cy},
            {'type': 'pointerUp', 'button': 0}]}
    req('POST', 'actions', {'actions': [f(1, cx - d0, cx - d1), f(2, cx + d0, cx + d1)]})


# (a) max view: tap the small 'screen' field in Minimal
seed('minimal', 'light')
tap_el('document.querySelector(\'[aria-label="최대화"]\')'); time.sleep(1.2)
ntap = js('return document.querySelectorAll("[data-field-tap]").length')
r = js('const w=[...document.querySelectorAll("[data-ticket-scale-wrapper]")].at(-1); const e=[...w.querySelectorAll("*")].find(e=>e.childElementCount===0&&e.textContent.trim().includes("IMAX관")); if(!e) return null; const b=e.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height}')
t = r or {'x': 180, 'y': 300, 'w': 40, 'h': 10}
shot('777-enlarge-max-before')
tap_css(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2); time.sleep(1.2)
out['enlarge']['maxTapScreen'] = {'opened': js(OPENED), 'focus': js(F),
                                  'backToDefault': not js('return !!document.querySelector(\'[aria-label="기본 크기로 돌아가기"]\')'),
                                  'rect': t, 'fieldTapTargetsInMax': ntap}
shot('777-enlarge-max-after')
close_edit()

# (b) Safari pinch zoom, then tap 'screen' (the field that mis-opened 'seat' at 1x)
seed('minimal', 'light')
t0 = [v for v in js(READ) if v['field'] == 'screen'][0]
for _ in range(4):
    pinch_out_pt(cx=round(t0['x'] + t0['w'] / 2), cy=round(t0['y'] + t0['h'] / 2 + web_top())); time.sleep(1.0)
    if js('return visualViewport.scale') >= 2:
        break
sc = js('return visualViewport.scale')
t = [v for v in js(READ) if v['field'] == 'screen'][0]
efp = js('const v=visualViewport; const e=document.elementFromPoint(arguments[0]-v.offsetLeft*0, arguments[1]); return e && e.closest("[data-field-tap]")?.getAttribute("data-field-tap")', t['x'] + t['w'] / 2, t['y'] + t['h'] / 2)
shot('777-enlarge-pinch-before')
tap_css(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2); time.sleep(1.5)
out['enlarge']['pinchTapScreen'] = {'scale': sc, 'efp': efp, 'opened': js(OPENED), 'focus': js(F)}
shot('777-enlarge-pinch-after')
close_edit()
print(json.dumps(out['enlarge'], ensure_ascii=False), flush=True)

# (c) dark recovery path per mood
for mood in MOODS:
    try:
        seed(mood, 'dark')
        ex = extras(mood, 'dark')
        # prev/next verified by focused input label (heuristic-free)
        seed(mood, 'dark')
        t = [v for v in js(READ) if v['field'] == 'title'][0]
        tap_css(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2); time.sleep(1.2)
        a = js(F); native_tap('다음 항목'); time.sleep(1.0); b = js(F)
        shot(f'777-{mood}-dark-next')
        native_tap('이전 항목'); time.sleep(1.0); c = js(F)
        shot(f'777-{mood}-dark-prev')
        ex['prevNextByFocus'] = {'open': a, 'afterNext': b, 'afterPrev': c}
        close_edit()
    except Exception as e:
        ex = {'error': str(e)[:200]}
    out['darkRecovery'][mood] = ex
    print(mood, json.dumps(ex, ensure_ascii=False)[:300], flush=True)
json.dump(out, open(f'{S}/ev/777-rest.json', 'w'), ensure_ascii=False, indent=1)
