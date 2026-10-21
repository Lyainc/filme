"""#777 iOS: on-ticket field direct taps (XCTest) per mood x theme. Port of scripts/measure-field-taps.mjs."""
import json, sys, time
from sim import *

MOVIE = {'title': '인터스텔라', 'titleOg': 'Interstellar', 'releaseDate': '2014-11-06',
         'watchDate': '2026-09-17', 'watchTime': '19:30', 'theater': 'CGV 용산아이파크몰', 'screen': 'IMAX관',
         'seat': 'H12', 'actors': '매튜 맥커너히, 앤 해서웨이, 제시카 차스테인', 'rating': 4.5, 'runtime': '169',
         'bookingNumber': '1234-5678-9012', 'signature': 'Lyainc', 'quote': '사랑은 시공간을 초월한다'}
MOODS = ['minimal', 'criterion', '35mm', 'editorial', 'stub', '35mm-landscape']

READ = '''return [...document.querySelectorAll("[data-field-tap]")].map(el=>{const r=el.getBoundingClientRect();
return {field:el.getAttribute("data-field-tap"),x:r.x,y:r.y,w:r.width,h:r.height}}).filter(t=>t.w>0&&t.h>0&&t.y+t.h>0&&t.y<innerHeight&&t.x<innerWidth&&t.x+t.w>0)'''
OPENED = '''const bar=document.querySelector('[aria-label="필드 편집 도구"]'); if(!bar) return null;
const hl=[...document.querySelectorAll('input, div[aria-hidden="true"]')].find(el=>el.style.zIndex==='60'); if(!hl) return '?open';
const h=hl.getBoundingClientRect(), cx=h.x+h.width/2, cy=h.y+h.height/2; let best=null;
for(const el of document.querySelectorAll('[data-field-tap]')){const r=el.getBoundingClientRect(); const d=Math.hypot(r.x+r.width/2-cx,r.y+r.height/2-cy); if(!best||d<best.d) best={d,f:el.getAttribute('data-field-tap')};}
return best?best.f:'?open';'''
CHROME = '''return [['handle',document.querySelector('[aria-label="티켓 항목 목록 열기"]')],['toolbar',document.querySelector('[role="toolbar"]:not([aria-label="필드 편집 도구"])')]]
.filter(([,e])=>e).map(([n,e])=>{const r=e.getBoundingClientRect();return {name:n,x:r.x,y:r.y,w:r.width,h:r.height}})'''


def seed(mood, theme):
    js('localStorage.setItem("filme:phototicket:v1", JSON.stringify({movieInfo: arguments[0], components:{layout: arguments[1]}})); localStorage.setItem("phototicket:theme", arguments[2]);', MOVIE, mood, theme)
    global_nav = int(time.time())
    ctx('WEB'); req('POST', 'url', {'url': f'{URL}?m={mood}&t={theme}&n={global_nav}'})
    time.sleep(2.5)
    import sim; sim._ctx[0] = None; sim._web[0] = None
    for _ in range(20):
        r = rect_of('document.querySelector("[data-testid=landing-restore]")')
        if r and r['h'] > 0:
            break
        time.sleep(0.5)
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    for _ in range(20):
        time.sleep(0.5)
        if js('return document.querySelectorAll("[data-field-tap]").length>0 && !document.querySelector("[data-testid=landing]")?.getBoundingClientRect().height'):
            break
    time.sleep(1.0)


def wait_open(ms=1200):
    t0 = time.time()
    while time.time() - t0 < ms / 1000:
        o = js(OPENED)
        if o:
            return o
        time.sleep(0.15)
    return None


def close_edit():
    js('document.querySelector(\'[aria-label="편집 완료"]\')?.click()')
    for _ in range(20):
        time.sleep(0.15)
        if js('''const w=document.querySelector(".crop-marks"); const t=w&&getComputedStyle(w).transform;
return !document.querySelector('[aria-label="필드 편집 도구"]') && (!t||t==="none"||t==="matrix(1, 0, 0, 1, 0, 0)")'''):
            break
    if js('return !!document.querySelector(\'[role="dialog"][aria-label="티켓 항목"]\')'):
        js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); time.sleep(0.5)
    if js('return visualViewport.scale') > 1.01:
        for _ in range(4):
            pinch_in_pt(d0=170, d1=10); time.sleep(0.8)
            if js('return visualViewport.scale') <= 1.01:
                break


def probe_fields(mood, theme):
    taps = js(READ)
    chrome = js(CHROME)
    res = []
    for i, t0 in enumerate(taps):
        nth = [v for v in taps if v['field'] == t0['field']].index(t0)
        cur = [v for v in js(READ) if v['field'] == t0['field']]
        t = cur[nth] if nth < len(cur) else t0
        cx, cy = t['x'] + t['w'] / 2, t['y'] + t['h'] / 2
        pts = {'center': (cx, cy), 'inTop': (cx, t['y'] + 2), 'inBottom': (cx, t['y'] + t['h'] - 2)}
        probes = {}
        cover = []
        for c in chrome:
            ox = max(0, min(t['x'] + t['w'], c['x'] + c['w']) - max(t['x'], c['x']))
            oy = max(0, min(t['y'] + t['h'], c['y'] + c['h']) - max(t['y'], c['y']))
            if ox * oy > 0:
                cover.append({'by': c['name'], 'frac': round(ox * oy / (t['w'] * t['h']), 2)})
        for k, (px, py) in pts.items():
            time.sleep(0.4)
            tap_css(px, py)
            o = wait_open()
            if not o and not js('return !!document.querySelector(\'[role="dialog"][aria-label="티켓 항목"]\')'):
                time.sleep(0.8); tap_css(px, py); o = wait_open(1500)  # 'none' must reproduce twice
            if o:
                # field toolbar vs opened field overlap (auto-move check)
                ov = js('''const bar=document.querySelector('[aria-label="필드 편集 도구"]'.replace("集","집"));
const hl=[...document.querySelectorAll('input, div[aria-hidden="true"]')].find(el=>el.style.zIndex==='60');
if(!bar||!hl) return null; const a=bar.getBoundingClientRect(), b=hl.getBoundingClientRect();
const ox=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)), oy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
return +(ox*oy/(b.width*b.height||1)).toFixed(2)''')
                probes[k] = {'opened': o, 'barOverlap': ov}
                close_edit()
            else:
                dr = js('return !!document.querySelector(\'[role="dialog"][aria-label="티켓 항목"]\')')
                probes[k] = {'opened': 'drawer' if dr else 'none'}
                if dr:
                    close_edit()
        res.append({'field': t['field'], 'rect': {k: round(t[k], 1) for k in ('x', 'y', 'w', 'h')}, 'coveredBy': cover, 'probes': probes})
        bad = [k for k, v in probes.items() if v['opened'] != t['field']]
        print(f"  {mood}/{theme} {t['field']:<14} {'OK' if not bad else 'MISS ' + str({k: probes[k]['opened'] for k in bad})} cover={cover}", flush=True)
    return res


def extras(mood, theme):
    """handle -> drawer, drawer item -> edit, prev/next, edit text + undo."""
    out = {}
    h = native_find('티켓 항목 목록 열기')
    r = rect_of('document.querySelector(\'[aria-label="티켓 항목 목록 열기"]\')')
    if r:
        tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(1.0)
        out['handleOpensDrawer'] = js('return !!document.querySelector(\'[role="dialog"][aria-label="티켓 항목"]\')')
        shot(f'777-{mood}-{theme}-drawer')
        close_edit()
    # open title, then try next / prev buttons
    tt = [v for v in js(READ) if v['field'] == 'title']
    if tt:
        t = tt[0]; tap_css(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2)
        o1 = wait_open(); shot(f'777-{mood}-{theme}-title-open')
        o2 = js(OPENED) if native_tap('다음 항목') and not time.sleep(0.9) else None
        o3 = js(OPENED) if native_tap('이전 항목') and not time.sleep(0.9) else None
        out['prevNext'] = {'opened': o1, 'afterNext': o2, 'afterPrev': o3}
        # type into title via soft keyboard, close, undo
        foc = js('const a=document.activeElement; return a && a.tagName==="INPUT" ? (a.value) : null')
        out['focusedValue'] = foc
        if foc is not None and o3 == 'title':
            native_tap('space') or native_tap('스페이스'); time.sleep(0.2)
            typed = js('return document.activeElement.value')
            close_edit(); time.sleep(0.8)
            after = js('return JSON.parse(localStorage.getItem("filme:phototicket:v1")||"{}").movieInfo?.title')
            tap_el('document.querySelector("[aria-label=\'실행 취소\']")'); time.sleep(1.0)
            undone = js('return document.querySelector("[data-field-tap=title]")?.textContent?.trim()')
            out['editUndo'] = {'typed': typed, 'savedDraftTitle': after, 'afterUndoText': undone}
        else:
            close_edit()
    return out


def main():
    themes = [a for a in sys.argv[1:] if a in ('light', 'dark')] or ['light', 'dark']
    moods = [a for a in sys.argv[1:] if a in MOODS] or MOODS
    allres = []
    for theme in themes:
        for mood in moods:
            try:
                seed(mood, theme)
                shot(f'777-{mood}-{theme}-start')
                rec = {'mood': mood, 'theme': theme, 'fields': probe_fields(mood, theme)}
                if theme == 'light':
                    rec['extras'] = extras(mood, theme)
                    print('  extras', json.dumps(rec['extras'], ensure_ascii=False), flush=True)
            except Exception as e:
                rec = {'mood': mood, 'theme': theme, 'error': str(e)[:300]}
                print('  ERROR', mood, theme, rec['error'], flush=True)
            allres.append(rec)
            json.dump(allres, open(f'{S}/ev/777-ios-{"-".join(themes)}.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
