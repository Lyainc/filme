"""#779 iOS: slider track/thumb gestures on '투명도 › 포스터' (XCTest touches), per theme."""
import json, sys, time
from sim import *

ST = r'''
const lab=t=>[...document.querySelectorAll("label")].find(l=>l.textContent.trim()===t);
const box=t=>lab(t)&&lab(t).closest(".space-y-field");
const q=(t,s)=>box(t)&&box(t).querySelector(s);
const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
const rng=q("포스터","input[type=range]");
return {poster:rng&&+rng.value, component:+(q("컴포넌트","input[type=range]")||{}).value,
 posterPct:(q("포스터","input[inputmode=numeric]")||{}).value, componentPct:(q("컴포넌트","input[inputmode=numeric]")||{}).value,
 range:r(rng), pctInput:r(q("포스터","input[inputmode=numeric]")), compRange:r(q("컴포넌트","input[type=range]")),
 min:rng&&rng.min, max:rng&&rng.max, step:rng&&rng.step, active:document.activeElement&&(document.activeElement.getAttribute("aria-label")||document.activeElement.id||document.activeElement.tagName),
 theme:document.documentElement.className, vv:visualViewport.scale};
'''


def st():
    return js(ST)


def setup(theme):
    js('localStorage.setItem("phototicket:theme", arguments[0])', theme)
    reset_editor()
    time.sleep(0.5)
    js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="투명도"); const p=b.closest(".overflow-x-auto"); p.scrollLeft += (b.getBoundingClientRect().x - 160);')
    time.sleep(0.9)
    for _ in range(3):
        if rect_of(by_text('button', '투명도'))['y'] < 600:
            break
        tap_el(by_text('button', '투명도')); time.sleep(1.0)
    s = st()
    if not s['range']:
        raise RuntimeError('poster slider missing')
    return s


def thumb_x(s):
    rg = s['range']; v = s['poster']
    return rg['x'] + 16 + (rg['w'] - 32) * v  # approx; recorded with the measured thumb pos below


def main():
  out = []
  for theme in sys.argv[1:] or ['light', 'dark']:
      cases = [
          ('track-tap-25', 'tap', 0.25, 0),
          ('track-tap-25-up10', 'tap', 0.25, -10),
          ('track-tap-25-down10', 'tap', 0.25, 10),
          ('track-tap-25-up14', 'tap', 0.25, -14),
          ('track-tap-25-down14', 'tap', 0.25, 14),
          ('track-drag-25-to-80', 'drag', 0.25, 0),
          ('thumb-drag-to-80', 'thumbdrag', None, 0),
      ]
      for name, kind, fx, dy in cases:
          try:
              b = setup(theme)
              rg = b['range']; cy = rg['y'] + rg['h'] / 2
              if kind == 'tap':
                  x = rg['x'] + rg['w'] * fx
                  tap_css(x, cy + dy)
              elif kind == 'drag':
                  x = rg['x'] + rg['w'] * fx
                  drag_css(x, cy, rg['x'] + rg['w'] * 0.8, cy, 700)
              else:
                  # thumb center from the native control: measure via value position, then drag
                  x = rg['x'] + rg['w'] * b['poster']
                  drag_css(x, cy, rg['x'] + rg['w'] * 0.8, cy, 700)
              time.sleep(1.0)
              a = st()
              shot(f'779-{theme}-{name}')
              rec = {'theme': theme, 'case': name, 'touch': {'x': round(x, 1), 'y': round(cy + dy, 1), 'dy': dy},
                     'range': rg, 'before': {k: b[k] for k in ('poster', 'component', 'posterPct', 'componentPct')},
                     'after': {k: a[k] for k in ('poster', 'component', 'posterPct', 'componentPct', 'active')},
                     'minmaxstep': [b['min'], b['max'], b['step']], 'htmlClass': a['theme']}
          except Exception as e:
              rec = {'theme': theme, 'case': name, 'error': str(e)[:200]}
          out.append(rec)
          print(json.dumps({k: rec.get(k) for k in ('theme', 'case', 'error', 'before', 'after')}, ensure_ascii=False), flush=True)

      # % input + undo
      try:
          b = setup(theme)
          p = b['pctInput']
          tap_css(p['x'] + p['w'] / 2, p['y'] + p['h'] / 2); time.sleep(1.0)
          if not js('return document.activeElement && document.activeElement.getAttribute("inputmode")==="numeric"'):
              raise RuntimeError('pct input not focused')
          for _ in range(4):
              if not native_tap('삭제') and not native_tap('delete'):
                  break
              time.sleep(0.08)
          type_keys('37'); native_tap('완료') or native_tap('Done'); time.sleep(1.0)
          a = st()
          shot(f'779-{theme}-pct37')
          # undo: reset zoom first via fresh nav would lose history, so use the toolbar's undo in current (zoomed) view
          for _ in range(3):
              if js('return visualViewport.scale') <= 1.01: break
              pinch_in_pt(); time.sleep(1.0)
          zs = js('return visualViewport.scale')
          tap_el('document.querySelector("[aria-label=\'실행 취소\']")'); time.sleep(1.2)
          u = st()
          shot(f'779-{theme}-undo')
          rec = {'theme': theme, 'case': 'pct-input-37-then-undo', 'before': b['poster'], 'afterPct': a['poster'],
                 'afterPctLabel': a['posterPct'], 'afterUndo': u['poster'], 'vvScale': a['vv'], 'scaleAfterPinch': zs}
          # undo after a thumb drag (no zoom involved)
          b2 = setup(theme); rg = b2['range']; cy = rg['y'] + rg['h'] / 2
          drag_css(rg['x'] + rg['w'] * b2['poster'], cy, rg['x'] + rg['w'] * 0.8, cy, 700); time.sleep(1.0)
          d = st()
          tap_el('document.querySelector("[aria-label=\'실행 취소\']")'); time.sleep(1.2)
          u2 = st(); shot(f'779-{theme}-drag-undo')
          rec.update({'dragBefore': b2['poster'], 'dragAfter': d['poster'], 'dragAfterUndo': u2['poster']})
      except Exception as e:
          rec = {'theme': theme, 'case': 'pct-input-37-then-undo', 'error': str(e)[:200]}
      out.append(rec)
      print(json.dumps(rec, ensure_ascii=False), flush=True)

  json.dump(out, open(f'{S}/ev/779-ios.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
