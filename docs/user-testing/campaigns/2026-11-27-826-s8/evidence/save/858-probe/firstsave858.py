"""#858: first [저장] after a fresh navigation — Appium `url` vs `simctl openurl` — with the parser-stall metric."""
import json, os, sys, time, subprocess
sys.path.insert(0, os.getcwd())
from sim import *
import sim, run768

OUT = os.path.join(S, 'probe858'); os.makedirs(OUT, exist_ok=True)
REPS = int(os.environ.get('REPS', '4'))
NT = 'const n=performance.getEntriesByType("navigation")[0]; return {href:location.href, di:Math.round(n.domInteractive), load:Math.round(n.loadEventEnd), now:Math.round(performance.now())}'
OBS = r'''const o = window.__o = {resources: [], heads: [], flip: null, click: null};
new PerformanceObserver((l) => { for (const e of l.getEntries()) o.resources.push([Math.round(e.startTime), Math.round(e.responseEnd), e.initiatorType, e.name.slice(-60)]); }).observe({type: 'resource', buffered: false});
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) o.heads.push([Math.round(performance.now()), n.nodeName, (n.src || n.href || '').slice(-60)]); }).observe(document.head, {childList: true});
document.addEventListener('click', () => { o.click = Math.round(performance.now()); let last = true;
  const f = () => { const a = navigator.userActivation.isActive; if (last && !a && !o.flip) o.flip = Math.round(performance.now()); last = a; if (performance.now() - o.click < 3000) requestAnimationFrame(f); };
  requestAnimationFrame(f); }, true);
return true;'''
HOOK = r'''const p = window.__r = {runs: []}; const orig = navigator.share.bind(navigator);
navigator.share = (d) => { const run = {at: Math.round(performance.now()), act: navigator.userActivation.isActive}; p.runs.push(run);
  return orig(d).then((v) => { run.r = 'shared'; return v; }, (e) => { run.r = e.name; throw e; }); }; return true;'''


def attach(tag):
    for _ in range(90):
        sim._ctx[0] = None; sim._web[0] = None
        try:
            for c in reversed([c for c in req('GET', 'contexts') if c.startswith('WEBVIEW')]):
                req('POST', 'context', {'name': c}); sim._ctx[0] = 'WEB'; sim._web[0] = c
                h = js(NT)
                if tag in h['href'] and h['load'] > 0:
                    return h
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('page did not load: ' + tag)


def sheet_open():
    ctx('NATIVE')
    return 'ActivityListView' in req('GET', 'source')


def dismiss():
    for name in ('닫기', 'Close'):
        if native_tap(name):
            time.sleep(1.0); return
    tap_pt(200, 120); time.sleep(1.0)


def one(via, k):
    tag = f'fs={via}{k}{int(time.time())}'
    t0 = time.time()
    if via == 'appium':
        ctx('WEB'); req('POST', 'url', {'url': URL + '?' + tag})
    else:
        subprocess.run(['xcrun', 'simctl', 'openurl', UDID, URL + '?' + tag])
    nav = attach(tag); nav['wall'] = round(time.time() - t0, 1)
    for _ in range(30):
        r = rect_of('document.querySelector("[data-testid=landing-restore]")')
        if r and r['h'] > 0:
            break
        time.sleep(0.5)
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(2.0)
    r = rect_of('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="완료")')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(2.5)
    js(HOOK)
    js(OBS)
    if os.environ.get('WARM') == '1':
        js('document.querySelector(\'[data-testid="result-save"]\').click(); return true'); time.sleep(4.0)
        js('window.__o.resources=[]; window.__o.heads=[]; window.__o.flip=null; window.__r.runs=[]; return true')
        if js('return !!document.querySelector("[data-testid=result-alert]")'): pass
    since = js('return Math.round(performance.now())')
    tap_el('document.querySelector(\'[data-testid="result-save"]\')')
    sheet = False
    for _ in range(8):
        time.sleep(0.5)
        if sheet_open():
            sheet = True; break
        if js('return !!document.querySelector("[data-testid=result-alert]")'):
            break
    runs = json.loads(js('return JSON.stringify(window.__r.runs)'))
    obs = json.loads(js('return JSON.stringify(window.__o)'))
    if sheet:
        dismiss()
    return {'via': via, 'k': k, 'nav': nav, 'saveAtSinceNav': since, 'sheet': sheet, 'share': runs, 'obs': obs}


def main():
    print(json.dumps(run768.seed_cell('both', False, False)), flush=True)
    out = []
    for k in range(REPS):
        for via in os.environ.get('VIA', 'simctl').split(','):
            try:
                rec = one(via, k)
            except Exception as e:
                rec = {'via': via, 'k': k, 'error': str(e)[:200]}
            out.append(rec); print(json.dumps(rec), flush=True)
            json.dump(out, open(f'{OUT}/firstsave-warm{os.environ.get("WARM","0")}.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
