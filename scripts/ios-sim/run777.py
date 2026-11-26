"""#777 iOS: on-ticket field direct taps (XCTest) per mood x theme. Port of scripts/measure-field-taps.mjs.

#826 S8 acceptance-3: 필드를 누르면 키보드에 붙는 입력 패널([data-field-panel], #826 S3 · S4)이 열린다. 열린 필드는 패널의
data-field-panel 값과 포커스된 입력의 aria-label(FIELD_LABELS, 평점은 숫자 버튼이라 포커스 입력 없음)로 판정하고, 닫기는
패널 '닫기', 이전 · 다음은 패널의 '이전 항목' · '다음 항목' 웹 버튼이다. iOS Simulator 결과, 실기기 아님 — 손가락 접촉 면적은
포인터 한 점으로 재현되지 않는다."""
import json, sys, time
from sim import *

# docs/user-testing/README.md '공통 입력'의 짧은 입력(Seed 826-s8 constraint-7: 가상 데이터만). FILME_777_LONG=1이면 긴 입력.
SHORT = {'title': '테스트 영화', 'titleOg': 'TEST MOVIE', 'releaseDate': '2026-09-17',
         'watchDate': '2026-09-17', 'watchTime': '19:30', 'theater': '테스트 극장', 'screen': '12관',
         'seat': 'H12', 'actors': '테스트 배우 A, 테스트 배우 B', 'rating': 4.5, 'runtime': '123',
         'bookingNumber': 'TEST-768', 'signature': 'QA', 'quote': '다시 보고 싶은 영화'}
LONG = dict(SHORT, title='아주 긴 영화 제목으로 확인하는 한여름 밤의 마지막 상영과 우리의 이야기',
            titleOg='A Very Long Original Movie Title for the Last Screening of a Summer Night',
            actors='테스트 배우 A, 테스트 배우 B, 테스트 배우 C, 테스트 배우 D, 테스트 배우 E',
            theater='아주 긴 이름의 테스트 극장 특별상영관', quote='긴 문장으로 남기는 한줄평이며 잘림과 겹침이 없는지 확인해요')
import os as _os
MOVIE = LONG if _os.environ.get('FILME_777_LONG') == '1' else SHORT
MOODS = ['minimal', 'criterion', '35mm', 'editorial', 'stub', '35mm-landscape']
LABELS = {'title': '제목', 'titleOg': '원제', 'actors': '출연', 'watchDate': '관람일', 'watchTime': '관람 시간', 'theater': '극장',
          'screen': '상영관', 'seat': '좌석', 'runtime': '러닝타임', 'rating': '평점', 'releaseDate': '개봉일', 'reissue': '재개봉',
          'bookingNo': '예매 번호', 'signature': '서명', 'quote': '한줄평', 'chain': '극장 로고', 'format': '포맷 로고'}

# 필드 탭 타깃 — 보이는 부분(overflow가 visible이 아닌 조상 박스와의 교집합)만 잰다. 말줄임 · 잘림으로 완전히 가려진 필드는
# hidden으로 돌려 탭하지 않는다(그 자리를 누르면 위에 보이는 이웃 필드가 열리는 게 맞는 동작이다, #826 S8).
READ = '''const vis=el=>{const r=el.getBoundingClientRect();let L=r.left,T=r.top,R=r.right,B=r.bottom;
for(let n=el.parentElement;n&&n!==document.body;n=n.parentElement){const cs=getComputedStyle(n);if(cs.overflowX!=="visible"||cs.overflowY!=="visible"){const q=n.getBoundingClientRect();L=Math.max(L,q.left);T=Math.max(T,q.top);R=Math.min(R,q.right);B=Math.min(B,q.bottom);}}
return {x:L,y:T,w:Math.max(0,R-L),h:Math.max(0,B-T),fw:r.width,fh:r.height}};
return [...document.querySelectorAll("[data-field-tap]")].map(el=>({field:el.getAttribute("data-field-tap"),...vis(el)}))
.filter(t=>t.fw>0&&t.fh>0&&t.y+t.h>=0&&t.y<innerHeight&&t.x<innerWidth&&t.x+t.w>=0)'''
# 열린 필드 = 입력 패널의 data-field-panel. 포커스 입력의 aria-label도 같이 돌려 라벨표와 대조한다.
OPENED = '''const p=document.querySelector('[data-field-panel]'); if(!p) return null; return p.getAttribute('data-field-panel');'''
FOCUS_LABEL = '''const a=document.activeElement; return a && /^(INPUT|TEXTAREA)$/.test(a.tagName) ? a.getAttribute('aria-label') : null'''
# 셸 크롬 히트 박스 — 옛 항목 목록 핸들·플로팅 툴바는 #826 S2에서 삭제돼 상단 줄(header)·도크만 남았다.
CHROME = '''return [['topbar',document.querySelector('header')],['dock',document.querySelector('[data-testid="editor-dock"]')]]
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
    js('[...document.querySelectorAll("[data-field-panel] button")].find(e=>e.textContent.trim()==="닫기")?.click()')
    for _ in range(20):
        time.sleep(0.15)
        if js('''const w=document.querySelector(".crop-marks"); const t=w&&getComputedStyle(w).transform;
return !document.querySelector('[data-field-panel]') && (!t||t==="none"||t==="matrix(1, 0, 0, 1, 0, 0)")'''):
            break
    time.sleep(0.4)
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
        if t0['w'] * t0['h'] == 0:
            res.append({'field': t0['field'], 'hidden': True, 'fullRect': {'w': round(t0['fw'], 1), 'h': round(t0['fh'], 1)}})
            print(f"  {mood}/{theme} {t0['field']:<14} HIDDEN (잘려 보이지 않음, 탭 안 함)", flush=True)
            continue
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
            if not o:
                time.sleep(0.8); tap_css(px, py); o = wait_open(1500)  # 'none' must reproduce twice
            if o:
                fl = js(FOCUS_LABEL)
                probes[k] = {'opened': o, 'focusLabel': fl, 'labelMatches': fl is None and o == 'rating' or fl == LABELS.get(o)}
                close_edit()
            else:
                probes[k] = {'opened': 'none'}  # 드로어 폴백은 핸들과 함께 삭제됐다(#826 S2)
        res.append({'field': t['field'], 'rect': {k: round(t[k], 1) for k in ('x', 'y', 'w', 'h')}, 'coveredBy': cover, 'probes': probes})
        bad = [k for k, v in probes.items() if v['opened'] != t['field'] or not v.get('labelMatches', False)]
        print(f"  {mood}/{theme} {t['field']:<14} {'OK' if not bad else 'MISS ' + str({k: probes[k]['opened'] for k in bad})} cover={cover}", flush=True)
    return res


def panel_btn(name):
    """입력 패널의 웹 버튼(이전 항목 · 다음 항목)을 XCTest로 누른다."""
    r = rect_of(f'document.querySelector(\'[data-field-panel] [aria-label="{name}"]\')')
    if not r or r['w'] == 0:
        return False
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    return True


def extras(mood, theme):
    """info-mode tab -> dock list, prev/next, edit text + undo. (옛 핸들 → 드로어 단계는 #826 S2에서 정보 모드 탭으로.)"""
    out = {}
    r = rect_of('document.getElementById("dock-mode-tab-info")')
    if r:
        tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(1.0)
        out['infoTabSelected'] = js('return document.getElementById("dock-mode-tab-info")?.getAttribute("aria-selected")==="true"')
        out['dockInfoRows'] = js('return document.querySelectorAll(\'[data-testid="dock-body"] button\').length')
        shot(f'777-{mood}-{theme}-info-dock')
    # open title, then try next / prev buttons
    tt = [v for v in js(READ) if v['field'] == 'title']
    if tt:
        t = tt[0]; tap_css(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2)
        o1 = wait_open(); shot(f'777-{mood}-{theme}-title-open')
        o2 = js(OPENED) if panel_btn('다음 항목') and not time.sleep(0.9) else None
        o3 = js(OPENED) if panel_btn('이전 항목') and not time.sleep(0.9) else None
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
