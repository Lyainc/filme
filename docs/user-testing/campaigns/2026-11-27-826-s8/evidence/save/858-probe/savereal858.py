"""#858: real [저장] (no instrumentation) with vs without XCUITest `source` polling during the capture."""
import json, os, sys, time
sys.path.insert(0, os.getcwd())
from sim import *
import sim, run768

OUT = os.path.join(S, 'probe858'); os.makedirs(OUT, exist_ok=True)
REPS = int(os.environ.get('REPS', '6'))
ORDER = os.environ.get('ORDER', 'poll,nopoll').split(',')
LOG = r'''const p = window.__r || (window.__r = {runs: []});
if (!p.hooked) { p.hooked = true; const orig = navigator.share.bind(navigator);
  navigator.share = (d) => { const run = {at: performance.now(), act: navigator.userActivation.isActive}; p.runs.push(run);
    return orig(d).then((v) => { run.r = 'shared'; return v; }, (e) => { run.r = e.name; throw e; }); }; }
return true;'''


def sheet_open():
    ctx('NATIVE')
    return 'ActivityListView' in req('GET', 'source')


def dismiss():
    for name in ('닫기', 'Close'):
        if native_tap(name):
            time.sleep(1.0); return
    tap_pt(200, 120); time.sleep(1.0)


def main():
    print(json.dumps(run768.seed_cell('both', False, False)), flush=True)
    r = rect_of('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="완료")')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(2.5)
    js(LOG)
    out = []
    for i in range(REPS * len(ORDER)):
        mode = ORDER[i % len(ORDER)]
        js('document.querySelector("[data-testid=result-alert]") && 0; return true')
        n0 = js('return window.__r.runs.length')
        t_tap = time.time()
        tap_el('document.querySelector(\'[data-testid="result-save"]\')')
        sheet = False
        if mode == 'poll':
            for _ in range(8):
                time.sleep(0.5)
                if sheet_open():
                    sheet = True; break
                if js('return !!document.querySelector("[data-testid=result-alert]")'):
                    break
        else:
            time.sleep(3.0)
        runs = json.loads(js('return JSON.stringify(window.__r.runs.slice(arguments[0]))', n0))
        alert = js('return document.querySelector("[data-testid=result-alert]")?.textContent || null')
        if mode != 'poll':
            sheet = sheet_open()
        if sheet:
            dismiss()
        rec = {'i': i + 1, 'mode': mode, 'sheet': sheet, 'alert': alert, 'share': runs}
        out.append(rec); print(json.dumps(rec, ensure_ascii=False), flush=True)
        json.dump(out, open(f'{OUT}/savereal-{"-".join(ORDER)}.json', 'w'), ensure_ascii=False, indent=1)
        time.sleep(4.0)


if __name__ == '__main__':
    main()
