"""#858: does navigator.share succeed when called synchronously in the click vs after a 750 ms wait (no capture)?

On the result screen, a capture-phase click listener swallows [저장] (handleSave never runs) and calls
navigator.share with a tiny JPEG File either immediately ('now') or after setTimeout 750 ('late').
Alternates now/late for REPS pairs right after the result screen opens (the window where losses cluster).
"""
import json, os, sys, time
sys.path.insert(0, os.getcwd())
from sim import *
import sim
import run768

OUT = os.path.join(S, 'probe858'); os.makedirs(OUT, exist_ok=True)
REPS = int(os.environ.get('REPS', '5'))

INSTALL = r'''
const p = window.__s = {runs: [], mode: 'now'};
const ua = navigator.userActivation;
const bytes = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='), c => c.charCodeAt(0));
const file = new File([bytes], 'probe.jpg', {type: 'image/jpeg'});
document.addEventListener('click', (e) => {
  if (!(e.target.closest && e.target.closest('[data-testid=result-save]'))) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const run = {mode: p.mode, click: performance.now(), actAtClick: ua.isActive};
  p.runs.push(run);
  const go = () => {
    run.shareAt = +(performance.now() - run.click).toFixed(1); run.actAtShare = ua.isActive;
    navigator.share({files: [file], title: 'probe'}).then(() => { run.r = 'shared'; }, (err) => { run.r = err.name; });
  };
  if (p.mode === 'now') go(); else setTimeout(go, 750);
}, true);
return true;
'''


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
    js(INSTALL)
    out = []
    for i in range(REPS * 2):
        mode = 'now' if i % 2 == 0 else 'late'
        js('window.__s.mode = arguments[0]; return true', mode)
        tap_el('document.querySelector(\'[data-testid="result-save"]\')')
        time.sleep(2.0)
        sheet = sheet_open()
        if sheet:
            dismiss()
        time.sleep(0.8)
        run = js('return JSON.stringify(window.__s.runs.at(-1) || null)')
        rec = json.loads(run) if run else {}
        rec.update({'i': i + 1, 'sheet': sheet})
        out.append(rec)
        print(json.dumps(rec), flush=True)
        json.dump(out, open(f'{OUT}/sharetiming.json', 'w'), indent=1)
        time.sleep(5.5 - 2.8)  # let the previous activation expire before the next tap


if __name__ == '__main__':
    main()
