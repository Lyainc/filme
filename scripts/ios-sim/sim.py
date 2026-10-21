"""Appium XCUITest helpers for iOS Simulator Mobile Safari (#585, #777, #779, #768).

Environment: FILME_SIM_DIR (outputs + session id, default /tmp/filme-ios-sim), FILME_SIM_UDID (booted
simulator), FILME_URL (app under test, default http://localhost:3038/), APPIUM_URL (default
http://127.0.0.1:4725). The Appium session is created on first import and reused via <dir>/apsid.

Web coordinates (CSS px) -> screen points: x same, y + web_top() (Safari content origin).
Touches are XCTest-synthesized via W3C pointer actions in NATIVE_APP context.
"""
import json, os, subprocess, time, urllib.request

S = os.environ.get('FILME_SIM_DIR', '/tmp/filme-ios-sim')
B = os.environ.get('APPIUM_URL', 'http://127.0.0.1:4725')
UDID = os.environ.get('FILME_SIM_UDID', '2E1CE4CC-1DB0-4D03-A511-4C0AB87CA474')
URL = os.environ.get('FILME_URL', 'http://localhost:3038/')
os.makedirs(f'{S}/ev', exist_ok=True)


def _session_alive(sid):
    try:
        with urllib.request.urlopen(f'{B}/session/{sid}/url', timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def _new_session():
    caps = {'capabilities': {'alwaysMatch': {
        'platformName': 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': UDID, 'browserName': 'Safari',
        'appium:safariInitialUrl': URL, 'appium:noReset': True, 'appium:newCommandTimeout': 3600,
        'appium:wdaLaunchTimeout': 600000, 'appium:wdaConnectionTimeout': 600000}}}
    r = urllib.request.Request(f'{B}/session', data=json.dumps(caps).encode(), method='POST',
                               headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=900) as resp:
        sid = json.loads(resp.read())['value']['sessionId']
    open(f'{S}/apsid', 'w').write(sid)
    return sid


_sid_file = f'{S}/apsid'
SID = open(_sid_file).read().strip() if os.path.exists(_sid_file) else ''
if not SID or not _session_alive(SID):
    SID = _new_session()
_ctx = [None]
_web = [None]


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f'{B}/session/{SID}/{path}', data=data, method=method,
                               headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read())['value']


def ctx(name):
    if _ctx[0] == name:
        return
    if name == 'WEB':
        if _web[0] is None:
            _web[0] = [c for c in req('GET', 'contexts') if c.startswith('WEBVIEW')][-1]
        req('POST', 'context', {'name': _web[0]})
    else:
        req('POST', 'context', {'name': 'NATIVE_APP'})
    _ctx[0] = name


def js(script, *args):
    ctx('WEB')
    return req('POST', 'execute/sync', {'script': script, 'args': list(args)})


_top = [None]


def web_top():
    # Safari content origin on screen. Measured once per toolbar state; 62 with bottom address bar.
    if _top[0] is None:
        _top[0] = 62
    return _top[0]


def _act(actions):
    ctx('NATIVE')
    req('POST', 'actions', {'actions': [{'type': 'pointer', 'id': 'finger1',
                                         'parameters': {'pointerType': 'touch'}, 'actions': actions}]})


def tap_pt(x, y, hold_ms=80):
    _act([{'type': 'pointerMove', 'duration': 0, 'x': round(x), 'y': round(y)},
          {'type': 'pointerDown', 'button': 0}, {'type': 'pause', 'duration': hold_ms},
          {'type': 'pointerUp', 'button': 0}])


def vv():
    return js('const v=visualViewport;return {s:v.scale,l:v.offsetLeft,t:v.offsetTop,w:v.width,h:v.height}')


def to_pt(x, y, v=None):
    """Layout-viewport CSS coords (getBoundingClientRect) -> screen points, honoring pinch/auto zoom."""
    v = v or vv()
    return (x - v['l']) * v['s'], (y - v['t']) * v['s'] + web_top()


def tap_css(x, y, hold_ms=80):
    tap_pt(*to_pt(x, y), hold_ms)


def drag_css(x1, y1, x2, y2, ms=600):
    v = vv(); a = to_pt(x1, y1, v); b = to_pt(x2, y2, v)
    _act([{'type': 'pointerMove', 'duration': 0, 'x': round(a[0]), 'y': round(a[1])},
          {'type': 'pointerDown', 'button': 0}, {'type': 'pause', 'duration': 150},
          {'type': 'pointerMove', 'duration': ms, 'x': round(b[0]), 'y': round(b[1])},
          {'type': 'pause', 'duration': 100}, {'type': 'pointerUp', 'button': 0}])


def native_find(name):
    """Return rect of first native element whose name/label == name, or None."""
    ctx('NATIVE')
    for using, value in (('accessibility id', name), ('xpath', f'//*[@label="{name}"]')):
        try:
            el = req('POST', 'element', {'using': using, 'value': value})
            eid = list(el.values())[0]
            r = req('GET', f'element/{eid}/rect')
            if r and r.get('width', 0) > 0:
                return r
        except Exception:
            pass
    return None


def native_tap(name):
    r = native_find(name)
    if not r:
        return False
    tap_pt(r['x'] + r['width'] / 2, r['y'] + r['height'] / 2)
    return True


def type_keys(text):
    """Type via the on-screen software keyboard: tap each key element by its label."""
    ctx('NATIVE')
    for ch in text:
        if not native_tap(ch):
            raise RuntimeError(f'key {ch!r} not found on soft keyboard')
        time.sleep(0.12)


def keyboard_rect():
    ctx('NATIVE')
    try:
        el = req('POST', 'element', {'using': 'class name', 'value': 'XCUIElementTypeKeyboard'})
        return req('GET', f'element/{list(el.values())[0]}/rect')
    except Exception:
        return None


def shot(name):
    os.makedirs(os.path.dirname(f'{S}/ev/s/{name}'), exist_ok=True); os.makedirs(os.path.dirname(f'{S}/ev/{name}'), exist_ok=True)
    subprocess.run(['xcrun', 'simctl', 'io', UDID, 'screenshot', f'{S}/ev/{name}.png'], capture_output=True)
    subprocess.run(['sips', '-Z', '700', f'{S}/ev/{name}.png', '--out', f'{S}/ev/s/{name}.png'], capture_output=True)
    return f'{S}/ev/s/{name}.png'


def rect_of(js_expr_returning_element):
    return js('const e=(' + js_expr_returning_element + '); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};')


def by_text(tag, text):
    return f'[...document.querySelectorAll("{tag}")].find(e=>e.textContent.trim()==={json.dumps(text)})'


def tap_el(expr, dx=0.5, dy=0.5):
    r = rect_of(expr)
    if not r:
        raise RuntimeError(f'no element: {expr}')
    tap_css(r['x'] + r['w'] * dx, r['y'] + r['h'] * dy)
    return r


def reset_editor():
    """Reload (clears Safari zoom) and enter the editor via the landing's direct-input link when shown."""
    global _nav
    _nav = globals().get('_nav', 0) + 1
    ctx('WEB')
    req('POST', 'url', {'url': f'{URL}?r={_nav}'})
    time.sleep(2.5)
    _ctx[0] = None; _web[0] = None
    for _ in range(10):
        try:
            if js('return document.readyState') == 'complete':
                break
        except Exception:
            _web[0] = None
        time.sleep(0.5)
    time.sleep(1.5)
    for _ in range(3):
        shown = js('const l=document.querySelector("[data-testid=landing]");return !!l && getComputedStyle(l).display!=="none" && l.getBoundingClientRect().height>0')
        if not shown:
            return
        r = rect_of(by_text('a,button', '포스터 없이 직접 입력'))
        if r and r['h'] > 0:
            tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
        time.sleep(1.5)
    raise RuntimeError('landing did not close')


def pinch_in_pt(cx=201, cy=420, d0=150, d1=20, ms=500):
    """Two-finger pinch toward center (zoom out) via XCTest touches."""
    ctx('NATIVE')
    def f(i, sx, ex):
        return {'type': 'pointer', 'id': f'f{i}', 'parameters': {'pointerType': 'touch'}, 'actions': [
            {'type': 'pointerMove', 'duration': 0, 'x': sx, 'y': cy}, {'type': 'pointerDown', 'button': 0},
            {'type': 'pause', 'duration': 100}, {'type': 'pointerMove', 'duration': ms, 'x': ex, 'y': cy},
            {'type': 'pointerUp', 'button': 0}]}
    req('POST', 'actions', {'actions': [f(1, cx - d0, cx - d1), f(2, cx + d0, cx + d1)]})


def ajs(fn_src, arg=None, timeout=60):
    """Run an (async) JS function source `(a) => ...` and return its resolved value."""
    ctx('WEB')
    req('POST', 'timeouts', {'script': timeout * 1000})
    script = ('const done=arguments[arguments.length-1]; Promise.resolve((' + fn_src + ')(arguments[0]))'
              '.then(v=>done({ok:true,v}),e=>done({ok:false,e:String(e&&e.message||e)}));')
    r = req('POST', 'execute/async', {'script': script, 'args': [arg]})
    if not r.get('ok'):
        raise RuntimeError(r.get('e'))
    return r['v']
