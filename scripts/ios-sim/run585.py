"""#585 iOS: six % inputs x exit paths (keyboard Done / tap outside). XCTest touches, soft keyboard."""
import json, sys, time
from sim import *

MEASURE = r'''
const lab=[...document.querySelectorAll("label")].find(l=>l.textContent.trim()===arguments[0]);
const box=lab&&lab.closest(".space-y-field");
const inp=box&&box.querySelector("input[inputmode=numeric]");
const rng=box&&box.querySelector("input[type=range]");
const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
const dock=document.querySelector("[data-rail-id]")?.closest("div.relative.shrink-0");
const prev=document.querySelector("div.relative.mx-auto.block.rounded-card");
const vv=window.visualViewport;
let hit=false; if(inp){const b=inp.getBoundingClientRect(); const el=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2); hit=el===inp;}
return {label:r(lab),input:r(inp),inputValue:inp&&inp.value,range:rng&&rng.value,dock:r(dock),preview:r(prev),
 vv:{h:+vv.height.toFixed(1),top:+vv.offsetTop.toFixed(1),scale:+vv.scale.toFixed(3),left:+vv.offsetLeft.toFixed(1),pageTop:+vv.pageTop.toFixed(1)},inputFont:inp&&getComputedStyle(inp).fontSize,scrollY,hit,focused:document.activeElement===inp,innerH:innerHeight};
'''

SLIDERS = [
    ('투명도', None, '포스터', '37', '42'),
    ('투명도', None, '컴포넌트', '37', '42'),
    ('후보정', ('재질 · 원본', '미술용지'), '재질 강도', '37', '42'),
    ('후보정', ('코팅 · 유광', None), '코팅 강도', '37', '42'),
    ('크기', ('@로고', None), '극장 로고 크기', '80', '90'),
    ('크기', ('@로고', None), '포맷 로고 크기', '80', '90'),
]


def m(label):
    return js(MEASURE, label)


def visible_frac(rect, vv, scroll_y):
    if not rect:
        return None
    # rect is client (layout-viewport) px; the visual viewport's top in those coords is pageTop - scrollY.
    # vv.offsetTop alone is not it: iOS reports the keyboard scroll there even at scale 1.
    vtop = vv['pageTop'] - scroll_y
    top, bot = max(rect['y'], vtop), min(rect['y'] + rect['h'], vtop + vv['h'])
    return round(max(0, bot - top) / rect['h'], 3)


def open_panel(rail, sub, label):
    for attempt in range(2):
        r = rect_of(by_text('button', rail))
        if r['x'] < 0 or r['x'] + r['w'] > 402:
            js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()===arguments[0]); const p=b.closest(".overflow-x-auto"); p.scrollLeft += (b.getBoundingClientRect().x - 160);', rail)
            time.sleep(0.5)
        if not m(label)['hit']:
            time.sleep(0.8)  # let rail scroll-snap settle; a touch during momentum only stops scrolling
            for _t in range(3):
                if rect_of(by_text('button', rail))['y'] < 600:
                    break  # dock expanded = a panel is open
                tap_el(by_text('button', rail)); time.sleep(1.0)
        if sub:
            tab, chip = sub
            if not m(label)['hit'] and tab.startswith('@'):
                tap_el(by_text('button', tab[1:])); time.sleep(0.8)
            elif not m(label)['hit']:
                tap_el(f'[...document.querySelectorAll("button")].find(e=>e.textContent.trim().startsWith({json.dumps(tab.split(" · ")[0])}+" ·"))'); time.sleep(0.6)
            if chip and not m(label)['hit']:
                tap_el(by_text('button', chip)); time.sleep(0.8)
        if m(label)['hit']:
            return
    shot('585-notfound-' + label)
    raise RuntimeError('slider not reachable: ' + label)


NEUTRAL = r'''
const v=visualViewport, bad="button,input,label,a,[role],select,textarea";
const prev=document.querySelector("div.relative.mx-auto.block.rounded-card");
for (const fy of [0.08,0.15,0.25,0.35,0.45]) for (const fx of [0.03,0.97,0.5]) {
  const x=v.offsetLeft+v.width*fx, y=v.offsetTop+v.height*fy;
  const e=document.elementFromPoint(x - v.offsetLeft, y - v.offsetTop);
  if(!e||e.closest(bad)||(prev&&prev.contains(e))||e.closest("[data-rail-id]")) continue;
  return {x, y, tag:e.tagName, cls:(e.className||"").toString().slice(0,40)};
}
return null;
'''


def run_exit(label, value, exit_path, tag, prep):
    reset_editor(); prep()
    before = m(label)
    tap_css(before['input']['x'] + before['input']['w'] / 2, before['input']['y'] + before['input']['h'] / 2)
    time.sleep(1.2)
    kb = keyboard_rect()
    during = m(label)
    shot(f'{tag}-during')
    if not js(MEASURE, label)['focused']:
        raise RuntimeError('input not focused after tap (refusing to type)')
    # clear + type via soft keyboard
    for _ in range(4):
        if not native_tap('삭제') and not native_tap('delete'):
            break
        time.sleep(0.08)
    type_keys(value)
    time.sleep(0.4)
    typed = m(label)
    shot(f'{tag}-typed')
    if exit_path == 'done':
        ok = native_tap('완료') or native_tap('Done')
    else:  # tap outside: gray workbench area right of the ticket preview, above dock
        pt = js(NEUTRAL)
        ok = pt
        if pt:
            tap_css(pt['x'], pt['y'])
    time.sleep(1.2)
    kb_after = keyboard_rect()
    after = m(label)
    shot(f'{tag}-after')
    return {'label': label, 'exit': exit_path, 'value': value, 'exitTapFound': ok,
            'keyboardDuring': kb, 'keyboardAfter': kb_after,
            'before': before, 'during': during, 'typed': typed, 'after': after,
            'visibleDuring': {'input': visible_frac(during['input'], during['vv'], during['scrollY']), 'label': visible_frac(during['label'], during['vv'], during['scrollY']),
                              'preview': visible_frac(during['preview'], during['vv'], during['scrollY'])},
            'restored': {'dockSame': before['dock'] == after['dock'], 'previewSame': before['preview'] == after['preview']}}


out = []
only = sys.argv[1:]


def make_prep(rail, sub, label):
    def prep():
        open_panel(rail, sub, label)
    return prep


for i, (rail, sub, label, v1, v2) in enumerate(SLIDERS):
    if only and str(i) not in only:
        continue
    for v, ex, t in ((v1, 'done', 'a'), (v2, 'outside', 'b')):
        try:
            r = run_exit(label, v, ex, f'585-{i}{t}', make_prep(rail, sub, label))
        except Exception as e:
            r = {'label': label, 'exit': ex, 'error': str(e)[:300]}
        out.append(r)
        print(json.dumps({k: r.get(k) for k in ('label', 'exit', 'error', 'exitTapFound', 'visibleDuring', 'restored')}, ensure_ascii=False), flush=True)
        print('  during vv', (r.get('during') or {}).get('vv'), 'font', (r.get('during') or {}).get('inputFont'), 'after vv', (r.get('after') or {}).get('vv'), 'val', (r.get('after') or {}).get('inputValue'), (r.get('after') or {}).get('range'), flush=True)
json.dump(out, open(f'{S}/ev/585-ios.json', 'w'), ensure_ascii=False, indent=1)
