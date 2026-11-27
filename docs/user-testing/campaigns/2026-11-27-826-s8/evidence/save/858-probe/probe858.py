"""#858 probe: what turns navigator.userActivation.isActive off after an XCTest tap on result [저장]?

Usage (from scripts/ios-sim): FILME_SIM_DIR=<dir> python3 <this> <mode> [<mode> ...]
modes: block   - capture-phase listener swallows the click (handleSave never runs): control
       plain   - tap a non-interactive spot on the result screen: control
       save    - real handleSave with broad DOM API wrapping (consumer detection)
"""
import json, os, sys, time
sys.path.insert(0, os.getcwd())
from sim import *
import sim
import run768

OUT = os.path.join(S, 'probe858')
os.makedirs(OUT, exist_ok=True)

PROBE = r'''
const wrapApis = arguments[0];
const ua = navigator.userActivation;
const act = () => ua.isActive;
const p = window.__p || (window.__p = {});
p.events = []; p.samples = []; p.consumers = []; p.ring = []; p.flip = null; p.block = false;
if (!p.installed) {
  p.installed = true;
  const tap = (t) => document.addEventListener(t, (e) => {
    const now = performance.now();
    p.events.push({t, now: +now.toFixed(1), ts: +e.timeStamp.toFixed(1), act: act()});
    if (t === 'click' && p.block && e.target.closest && e.target.closest('[data-testid=result-save]')) {
      e.stopImmediatePropagation(); e.preventDefault();
    }
    if (t === 'pointerdown' || t === 'touchstart') p.startSampling();
  }, true);
  ['pointerdown','touchstart','touchend','pointerup','mousedown','mouseup','click','focusin','focusout','blur','visibilitychange','pagehide'].forEach(tap);
  window.addEventListener('blur', () => p.events.push({t: 'window-blur', now: +performance.now().toFixed(1), act: act()}), true);
  window.addEventListener('focus', () => p.events.push({t: 'window-focus', now: +performance.now().toFixed(1), act: act()}), true);
  p.startSampling = () => {
    if (p.sampling) return; p.sampling = true;
    let last = act(); const t0 = performance.now(); p.samples.push([+t0.toFixed(1), last]);
    const mc = new MessageChannel();
    mc.port1.onmessage = () => {
      const now = performance.now(); const a = act();
      if (a !== last) { p.samples.push([+now.toFixed(1), a]); last = a; if (!a && !p.flip) p.flip = {at: +now.toFixed(1), recent: p.ring.slice(-25)}; }
      if (now - t0 < 3000) setTimeout(() => mc.port2.postMessage(0), 1); else { p.samples.push([+now.toFixed(1), a, 'end']); p.sampling = false; }
    };
    mc.port2.postMessage(0);
  };
  if (wrapApis) {
    const SKIP = /^(Object|Function|Array|Promise|String|Number|Boolean|Symbol|Map|Set|WeakMap|WeakSet|WeakRef|Reflect|Proxy|.*Error|.*Array|ArrayBuffer|SharedArrayBuffer|DataView|JSON|Math|Date|RegExp|BigInt|Intl|Atomics|MessagePort|MessageChannel|UserActivation|Performance.*|FinalizationRegistry|AggregateError|Iterator|AsyncIterator)$/;
    let wrapped = 0;
    const wrapObj = (obj, label) => {
      for (const k of Object.getOwnPropertyNames(obj)) {
        if (k === 'constructor' || k === 'prototype') continue;
        let d; try { d = Object.getOwnPropertyDescriptor(obj, k); } catch { continue; }
        if (!d || !d.configurable) continue;
        const name = label + '.' + k;
        const note = (b) => {
          const a = act();
          p.ring.push(name); if (p.ring.length > 400) p.ring.shift();
          if (b && !a && p.consumers.length < 20) p.consumers.push({name, at: +performance.now().toFixed(1), stack: (new Error().stack || '').split('\n').slice(1, 8).join(' | ')});
        };
        try {
          if (typeof d.value === 'function') {
            const f = d.value;
            const w = function (...args) {
              const b = act();
              let r;
              try { r = new.target ? Reflect.construct(f, args, new.target) : f.apply(this, args); }
              finally { note(b); }
              return r;
            };
            try { Object.defineProperty(w, 'name', {value: f.name}); } catch {}
            if (f.prototype) w.prototype = f.prototype;
            Object.defineProperty(obj, k, Object.assign({}, d, {value: w})); wrapped++;
          } else if (d.set) {
            const s = d.set;
            Object.defineProperty(obj, k, Object.assign({}, d, {set(v) { const b = act(); try { s.call(this, v); } finally { note(b); } }})); wrapped++;
          }
        } catch {}
      }
    };
    for (const g of Object.getOwnPropertyNames(window)) {
      if (SKIP.test(g)) continue;
      let v; try { v = window[g]; } catch { continue; }
      if (typeof v === 'function' && v.prototype && /^[A-Z]/.test(g)) wrapObj(v.prototype, g);
    }
    // window-level functions (fetch, setTimeout, createImageBitmap, requestAnimationFrame, ...)
    const winFns = Object.getOwnPropertyNames(window).filter(g => { try { return typeof window[g] === 'function' && /^[a-z]/.test(g); } catch { return false; } });
    const holder = {}; for (const g of winFns) { try { Object.defineProperty(holder, g, Object.getOwnPropertyDescriptor(window, g)); } catch {} }
    for (const g of winFns) {
      const d = Object.getOwnPropertyDescriptor(window, g); if (!d || !d.configurable || typeof d.value !== 'function') continue;
      const f = d.value; const name = 'window.' + g;
      try { Object.defineProperty(window, g, Object.assign({}, d, {value: function (...a) { const b = act(); try { return f.apply(this, a); } finally { const x = act(); p.ring.push(name); if (p.ring.length > 400) p.ring.shift(); if (b && !x && p.consumers.length < 20) p.consumers.push({name, at: +performance.now().toFixed(1), stack: (new Error().stack||'').split('\n').slice(1,8).join(' | ')}); } }})); wrapped++; } catch {}
    }
    p.wrapped = wrapped;
  }
}
return {installed: true, wrapped: p.wrapped || 0};
'''

READ = 'const p=window.__p; return JSON.stringify({events:p.events, samples:p.samples, flip:p.flip, consumers:p.consumers, alert: document.querySelector("[data-testid=result-alert]")?.textContent||null})'


def sheet_open():
    ctx('NATIVE')
    return 'ActivityListView' in req('GET', 'source')


def dismiss_sheet():
    for name in ('닫기', 'Close'):
        if native_tap(name):
            time.sleep(1.0)
            break
    if sheet_open():
        tap_pt(200, 120); time.sleep(1.0)


def open_result():
    r = rect_of('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="완료")')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(2.5)


def close_result():
    # 결과 화면의 '편집으로' 류 뒤로 버튼 — aria-label/텍스트로 찾는다
    js('const b=[...document.querySelectorAll("button")].find(b=>/(편집|돌아가)/.test((b.getAttribute("aria-label")||"")+b.textContent)); b&&b.click(); return !!b')
    time.sleep(1.5)


def one(mode, wrap, poll):
    js(PROBE, wrap)
    js('window.__p.block = arguments[0]; return true', mode.startswith('block'))
    save = 'document.querySelector(\'[data-testid="result-save"]\')'
    if mode.startswith('plain'):
        r = rect_of(save)
        tap_css(r['x'] + r['w'] / 2, r['y'] - 30)  # just above the CTA row: non-interactive area
    else:
        tap_el(save)
    sheet = False
    if poll:
        for _ in range(8):
            time.sleep(0.5)
            if sheet_open():
                sheet = True; break
        time.sleep(max(0, 3.4 - 0.5 * (_ + 1)))
        rec = json.loads(js(READ))
    else:
        time.sleep(3.4)
        rec = json.loads(js(READ))  # web-context read first, before any native accessibility query
        sheet = sheet_open()
    rec['sheet'] = sheet
    if sheet:
        dismiss_sheet()
    return rec


def main():
    modes = sys.argv[1:] or ['block', 'plain', 'save']
    reps = int(os.environ.get('REPS', '3'))
    print(json.dumps(run768.seed_cell('both', False, False)), flush=True)
    open_result()
    res = []
    for mode in modes:
        for i in range(reps):
            wrap = os.environ.get('WRAP', '1') == '1'
            poll = not mode.endswith('-nopoll')
            rec = {'mode': mode, 'rep': i + 1, 'wrap': wrap, 'poll': poll}
            try:
                rec.update(one(mode, wrap, poll))
            except Exception as e:
                rec['error'] = str(e)[:300]
            res.append(rec)
            ev = rec.get('events') or []
            click = next((e for e in ev if e['t'] == 'click'), None)
            print(json.dumps({'mode': mode, 'rep': i + 1, 'sheet': rec.get('sheet'), 'alert': rec.get('alert'),
                              'click': click, 'samples': rec.get('samples'),
                              'consumers': [c['name'] for c in rec.get('consumers') or []]}, ensure_ascii=False), flush=True)
            json.dump(res, open(f'{OUT}/probe-{"-".join(modes)}.json', 'w'), ensure_ascii=False, indent=1)
            if rec.get('alert'):
                js('return true')
            time.sleep(1.0)


if __name__ == '__main__':
    main()
