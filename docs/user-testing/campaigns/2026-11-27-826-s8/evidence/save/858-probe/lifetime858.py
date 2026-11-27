"""#858: user-activation lifetime after an XCTest tap on a minimal page (no app code).

FILME_SIM_DIR=<dir> python3 lifetime858.py <url-path> <reps>
Each rep: tap the injected button (even reps) or the empty area (odd reps), wait 5.6 s so the
previous activation has expired, and record when isActive turns false.
"""
import json, os, sys, time
sys.path.insert(0, os.getcwd())
from sim import *
import sim

path = sys.argv[1] if len(sys.argv) > 1 else '__probe858'
reps = int(sys.argv[2]) if len(sys.argv) > 2 else 10
OUT = os.path.join(S, 'probe858'); os.makedirs(OUT, exist_ok=True)
ctx('WEB'); req('POST', 'url', {'url': URL + path}); time.sleep(3)
for _ in range(20):
    sim._ctx[0] = None; sim._web[0] = None
    try:
        if path.split('?')[0] in js('return location.href'):
            break
    except Exception:
        pass
    time.sleep(1)

SETUP = r'''
const keep = arguments[0] === 'keep';
const html = '<button id="pb" style="position:fixed;left:40px;top:300px;width:300px;height:80px;font-size:20px">probe</button><div id="pe" style="position:fixed;left:40px;top:500px;width:300px;height:80px;background:#eee">empty</div>';
if (keep) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none'; d.innerHTML = html; d.querySelectorAll('*').forEach(e => e.style.pointerEvents = 'auto'); document.body.appendChild(d); }
else document.body.innerHTML = html;
const ua = navigator.userActivation; const p = window.__l = {runs: []};
let cur = null;
const sample = () => {
  if (!cur) return;
  const now = performance.now(); const a = ua.isActive;
  if (!a && cur.offAt == null) cur.offAt = +(now - cur.click).toFixed(1);
  if (now - cur.click < 5400 && cur.offAt == null) setTimeout(sample, 2); else cur.done = true;
};
document.addEventListener('click', (e) => {
  if (cur) cur.evalMark = p.evalMark; p.evalMark = null; cur = {target: e.target.id || e.target.tagName, click: performance.now(), sinceLoad: Math.round(performance.now() - performance.getEntriesByType('navigation')[0].startTime), actAtClick: ua.isActive, offAt: null};
  p.runs.push(cur); setTimeout(sample, 0);
}, true);
return location.href;
'''
MODE = os.environ.get('MODE', 'wipe')
time.sleep(float(os.environ.get('DELAY', '0')))
print(MODE, js(SETUP, MODE), flush=True)
res = []
for i in range(reps):
    target = 'pb' if i % 2 == 0 else 'pe'
    EVAL_AT = float(os.environ.get('EVAL_AT', '-1'))
    r_ = rect_of(f'document.getElementById("{target}")')
    tap_css(r_['x'] + r_['w'] / 2, r_['y'] + r_['h'] / 2)
    if EVAL_AT >= 0 and i % 2 == 0:
        time.sleep(EVAL_AT); t_ = time.time(); js('window.__l.evalMark = performance.now() - window.__l.runs.at(-1).click; return 1'); 
        time.sleep(5.7 - EVAL_AT)
    else:
        time.sleep(5.7)
res = json.loads(js('const p=window.__l; const p_last=()=>p.evalMark; return JSON.stringify(window.__l.runs.map((r,i,a)=>({evalMark: (a[i+1]||{evalMark:p_last()}).evalMark, target:r.target, sinceLoad:r.sinceLoad, actAtClick:r.actAtClick, offAt:r.offAt})))'))
for r in res:
    print(json.dumps(r), flush=True)
json.dump(res, open(f'{OUT}/lifetime-{MODE}-{path.strip("/").replace("/", "_") or "root"}.json', 'w'), indent=1)
