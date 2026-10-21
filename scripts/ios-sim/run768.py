"""#768 iOS: Stub S01–S16 — README 공통 입력, poster A / stamp B, ghost off preview vs saved JPEG.

Setup (seed, file injection, toggles, text edits) uses page JS; the save uses XCTest touches on the
result CTA and the native share sheet, and the saved file is pulled from the simulator's Photos DCIM.
"""
import glob, json, os, shutil, sys, time
from sim import *

DCIM = os.path.expanduser(f'~/Library/Developer/CoreSimulator/Devices/{UDID}/data/Media/DCIM/100APPLE')
OUT = f'{S}/ev/768'
os.makedirs(OUT, exist_ok=True)

SHORT = {'title': '테스트 영화', 'titleOg': 'TEST MOVIE', 'actors': '테스트 배우 A, 테스트 배우 B',
         'theater': '테스트 극장', 'quote': '다시 보고 싶은 영화'}
LONG = {'title': '아주 긴 영화 제목으로 확인하는 한여름 밤의 마지막 상영과 우리의 이야기',
        'titleOg': 'A Very Long Original Movie Title for the Last Screening of a Summer Night',
        'actors': '테스트 배우 A, 테스트 배우 B, 테스트 배우 C, 테스트 배우 D, 테스트 배우 E',
        'theater': '아주 긴 이름의 테스트 극장 특별상영관', 'quote': '긴 문장으로 남기는 한줄평이며 잘림과 겹침이 없는지 확인해요'}
COMMON = {'releaseDate': '2026-09-17', 'runtime': '123', 'rating': 4.5, 'watchDate': '2026-09-17', 'watchTime': '19:30',
          'screen': '12관', 'seat': 'H12', 'signature': 'QA', 'bookingNumber': 'TEST-768', 'isReissue': True,
          'reissueDate': '2026-09-17'}
ADM = ['seat', 'watchDate', 'watchTime', 'theater', 'screen']
FILM = ['runtime', 'rating', 'releaseDate', 'reissue', 'actors']
SECTIONS = {'both': (True, True), 'adm': (True, False), 'film': (False, True), 'none': (False, False)}
CELLS = []
n = 0
for sec in ('both', 'adm', 'film', 'none'):
    for poster in (True, False):
        for long in (False, True):
            n += 1
            CELLS.append((f'S{n:02d}', sec, poster, long))

UPLOAD_STAMP = os.environ.get('STAMP_UPLOAD') == '1'
WRAP = '[...document.querySelectorAll("[data-ticket-scale-wrapper]")].at(-1)'


def seed_cell(sec, poster, long, theme='light'):
    adm, film = SECTIONS[sec]
    fv = {f: adm for f in ADM}
    fv.update({f: film for f in FILM})
    movie = dict(COMMON, **(LONG if long else SHORT))
    ajs('''async () => {  // clear persisted images so a posterless cell cannot restore the previous cell's poster
      const db = await new Promise((res, rej) => { const r = indexedDB.open("filme-images"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const names = [...db.objectStoreNames];
      if (names.length) await new Promise((res, rej) => { const tx = db.transaction(names, "readwrite"); names.forEach(n => tx.objectStore(n).clear()); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      db.close(); return names; }''')
    ajs('''async (o) => {
      const img = await fetch("/assets/posters/sample-crossing.jpg").then(r=>r.blob());
      const url = await new Promise(r=>{const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(img);});
      localStorage.setItem("filme:phototicket:v1", JSON.stringify({movieInfo:o.movie, fieldVisibility:o.fv, hadPoster:o.poster,
        components:Object.assign({layout:"stub", material:"original", coating:"none", backgroundPatternScale:1}, o.uploadStamp ? {} : {backgroundPatternImage:url})}));
      localStorage.setItem("phototicket:theme", o.theme); return true; }''', {'movie': movie, 'fv': fv, 'theme': theme, 'poster': poster, 'uploadStamp': UPLOAD_STAMP})
    import sim
    ctx('WEB'); req('POST', 'url', {'url': f'{URL}?s={int(time.time()*1000)}'}); time.sleep(2.5)
    sim._ctx[0] = None; sim._web[0] = None
    for _ in range(30):
        r = rect_of('document.querySelector("[data-testid=landing-restore]")')
        if r and r['h'] > 0:
            break
        time.sleep(0.5)
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    for _ in range(30):
        time.sleep(0.5)
        if js('return document.querySelectorAll("[data-field-tap]").length>0 && !document.querySelector("[data-testid=landing]")?.getBoundingClientRect().height'):
            break
    rec_poster = js('return [...document.querySelectorAll("' + "[data-ticket-scale-wrapper]" + '")].at(-1)?.querySelectorAll("img").length')
    if poster:
        ajs('''async () => {
          const el=[...document.querySelectorAll("input[type=file]")].find(i=>(i.accept||"").includes("image/jpeg"));
          if(!el) throw new Error("poster input missing");
          const b=await fetch("/assets/posters/sample-bus.jpg").then(r=>r.blob());
          const dt=new DataTransfer(); dt.items.add(new File([b],"sample-bus.jpg",{type:"image/jpeg"}));
          el.files=dt.files; el.dispatchEvent(new Event("change",{bubbles:true})); return true; }''')
        for _ in range(60):
            time.sleep(0.5)
            if js('return [...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="적용")'):
                break
        time.sleep(1.2)
        js('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="적용").click()')
        time.sleep(2.0)
    if UPLOAD_STAMP:
        js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="스탬프"); const p=b.closest(".overflow-x-auto"); p.scrollLeft += (b.getBoundingClientRect().x - 160); b.click()'); time.sleep(1.0)
        ajs('''async () => {
          const el=document.querySelector('input[type=file][aria-label="스탬프 이미지 업로드"]'); if(!el) throw new Error("stamp input missing");
          const b=await fetch("/assets/posters/sample-crossing.jpg").then(r=>r.blob());
          const dt=new DataTransfer(); dt.items.add(new File([b],"sample-crossing.jpg",{type:"image/jpeg"}));
          el.files=dt.files; el.dispatchEvent(new Event("change",{bubbles:true})); return true; }''')
        for _ in range(60):
            time.sleep(0.5)
            if js('return [...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="적용")'):
                break
        time.sleep(1.2)
        js('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="적용").click()'); time.sleep(2.0)
        js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="스탬프"); b&&b.click()'); time.sleep(0.8)
    # ghost off via the edit menu (shell-local, default on)
    js('document.querySelector(\'[aria-label="편집 메뉴"]\').click()'); time.sleep(0.6)
    st = js('const b=document.querySelector(\'[aria-label="빈 항목 미리보기"]\'); return b && (b.getAttribute("aria-checked")||b.getAttribute("aria-pressed"))')
    if st == 'true':
        js('document.querySelector(\'[aria-label="빈 항목 미리보기"]\').click()'); time.sleep(0.4)
    ghost = js('const b=document.querySelector(\'[aria-label="빈 항목 미리보기"]\'); return b && (b.getAttribute("aria-checked")||b.getAttribute("aria-pressed"))')
    js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); time.sleep(0.4)
    if js('return !!document.querySelector(\'[aria-label="빈 항목 미리보기"]\')'):
        js('document.querySelector(\'[aria-label="편집 메뉴"]\').click()'); time.sleep(0.4)
    ajs('() => document.fonts.ready.then(()=>true)'); time.sleep(0.8)
    has_poster = js('const w=' + WRAP + '; return !!w && [...w.querySelectorAll("img")].some(i=>/^(blob|data):/.test(i.getAttribute("src")||"") && !i.closest("[data-bg-pattern]"))')
    stamp_src = js('const w=' + WRAP + '; const s=w&&w.querySelector("[data-bg-pattern]"); if(!s) return null; const i=s.querySelector("img"); const bg=getComputedStyle(s).backgroundImage; return (i&&i.getAttribute("src")||bg||"").slice(0,30)')
    return {'ghostAfterToggle': ghost, 'posterImgInPreview': has_poster, 'stampSrc': stamp_src, 'stampUpload': UPLOAD_STAMP}


def set_input(selector_expr, value):
    return js('''const el=(''' + selector_expr + '''); if(!el) return false;
      const set=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),"value").set; set.call(el, arguments[0]);
      el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true})); return true;''', value)


STAMP_PROBE = '''const w=''' + WRAP + '''; if(!w) return null; const s=w.querySelector("[data-bg-pattern]"); if(!s) return {stamp:false};
const sr=s.getBoundingClientRect(); const texts=[...w.querySelectorAll("*")].filter(e=>e.childElementCount===0 && e.textContent.trim() && !s.contains(e));
let overlap=[]; for(const t of texts){const r=t.getBoundingClientRect(); const ox=Math.min(r.right,sr.right)-Math.max(r.left,sr.left), oy=Math.min(r.bottom,sr.bottom)-Math.max(r.top,sr.top); if(ox>0.5&&oy>0.5) overlap.push(t.textContent.trim().slice(0,20));}
const wr=w.getBoundingClientRect();
return {stamp:true, rel:{x:+((sr.x-wr.x)/wr.width).toFixed(3), y:+((sr.y-wr.y)/wr.height).toFixed(3), w:+(sr.width/wr.width).toFixed(3), h:+(sr.height/wr.height).toFixed(3)}, textOverlap:overlap};'''


def interactions(long):
    """README cell step 2-3: titleOg off->on, title short->long->orig, stamp scale, maximize/restore."""
    rec = {}
    rec['initial'] = js(STAMP_PROBE)
    # 원제 표시 off -> on through the field drawer's visibility toggle
    js('document.querySelector(\'[aria-label="티켓 항목 목록 열기"]\')?.click()'); time.sleep(0.8)
    tog = '[...document.querySelectorAll("[role=dialog] button")].find(b=>/원제/.test(b.getAttribute("aria-label")||"") && /(노출|표시|숨)/.test(b.getAttribute("aria-label")||""))'
    rec['titleOgToggle'] = js('const b=(' + tog + '); return b && b.getAttribute("aria-label")')
    if rec['titleOgToggle']:
        js('(' + tog + ').click()'); time.sleep(0.6); rec['afterOgOff'] = js(STAMP_PROBE)
        js('(' + tog + ').click()'); time.sleep(0.6); rec['afterOgOn'] = js(STAMP_PROBE)
    js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); time.sleep(0.6)
    # title short -> long -> original via the in-place editor
    orig = js('return JSON.parse(localStorage.getItem("filme:phototicket:v1")).movieInfo.title')
    js('document.querySelector("[data-field-tap=title]").click()'); time.sleep(0.8)
    ti = '[...document.querySelectorAll("input,textarea")].find(e=>e.style.zIndex==="60") || document.activeElement'
    for i, v in enumerate(['짧은 제목', LONG['title'], orig]):
        set_input(ti, v); time.sleep(0.6)
        js('document.querySelector(\'[aria-label="편집 완료"]\')?.click()'); time.sleep(0.9)
        rec[f'title{i}'] = js(STAMP_PROBE)
        if i < 2:
            js('document.querySelector("[data-field-tap=title]").click()'); time.sleep(0.8)
    # stamp scale 1 -> 1.5 (DESIGN 스탬프 rail, '스탬프 크기' % input), then maximize/restore
    js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="스탬프"); b&&b.click()'); time.sleep(0.8)
    pct = '([...document.querySelectorAll("label")].find(l=>l.textContent.trim()==="스탬프 크기")||{closest:()=>null}).closest(".space-y-field")?.querySelector("input[inputmode=numeric]")'
    if js('return !!(' + pct + ')'):
        js('const e=(' + pct + '); e.focus();')
        set_input(pct, '150'); js('(' + pct + ').blur()'); time.sleep(0.8)
        rec['scale150'] = js(STAMP_PROBE)
        js('document.querySelector(\'[aria-label="최대화"]\')?.click()'); time.sleep(1.0)
        rec['maximized'] = js(STAMP_PROBE)
        js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); time.sleep(0.8)
        js('document.querySelector(\'[aria-label="기본 크기로 돌아가기"]\')?.click()'); time.sleep(1.0)
        rec['restored'] = js(STAMP_PROBE)
        if not long:
            js('const e=(' + pct + '); e.focus();'); set_input(pct, '100'); js('(' + pct + ').blur()'); time.sleep(0.8)
        rec['finalScalePct'] = js('return (' + pct + ')?.value')
        js('const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="스탬프"); b&&b.click()'); time.sleep(0.6)
    else:
        rec['scale'] = 'stamp size input not found'
    return rec


def save_jpeg(cid):
    before = set(glob.glob(f'{DCIM}/*'))
    # '완료' -> result
    r = rect_of('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="완료")')
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); time.sleep(2.5)
    shot(f'768/{cid}-preview')
    r = rect_of('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("사진에 저장"))')
    if not r:
        return {'error': 'save CTA missing'}
    tap_css(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
    got = None
    for _ in range(40):
        time.sleep(0.5)
        ctx('NATIVE')
        if 'ActivityListView' in req('GET', 'source'):
            time.sleep(1.0)
            shot(f'768/{cid}-sheet')
            tap_pt(156, 772)  # '이미지 저장' in the share sheet (remote view: no usable element rect; position from screenshot)
            got = 'tap(156,772)'
            break
    time.sleep(1.5)
    for name in ('허용', '모든 사진에 대한 접근 허용', 'Allow', 'OK', '확인'):
        if native_find(name):
            native_tap(name); time.sleep(1.0)
    new = []
    for _ in range(20):
        new = sorted(set(glob.glob(f'{DCIM}/*')) - before)
        if new:
            break
        time.sleep(0.5)
    out = {'shareAction': got, 'newFiles': [os.path.basename(p) for p in new]}
    if new:
        dst = f'{OUT}/{cid}-saved{os.path.splitext(new[-1])[1].lower()}'
        shutil.copy2(new[-1], dst); out['saved'] = dst
    out['ctaLabel'] = js('const b=[...document.querySelectorAll("button")].find(b=>/사진에 저장/.test(b.textContent)); return b&&b.textContent.trim()')
    return out


def main():
    only = sys.argv[1:]
    res = []
    for cid, sec, poster, long in CELLS:
        if only and cid not in only:
            continue
        try:
            cid_out = cid + ('-upload' if UPLOAD_STAMP else '')
            rec = {'id': cid_out, 'sections': sec, 'poster': poster, 'long': long}
            rec.update(seed_cell(sec, poster, long))
            rec['interactions'] = interactions(long)
            rec['editorFinal'] = js(STAMP_PROBE)
            shot(f'768/{cid_out}-editor')
            rec['save'] = save_jpeg(cid_out)
        except Exception as e:
            rec['error'] = str(e)[:300]
        res.append(rec)
        print(json.dumps({k: rec.get(k) for k in ('id', 'error', 'ghostAfterToggle', 'editorFinal', 'save')}, ensure_ascii=False), flush=True)
        json.dump(res, open(f'{OUT}/768-ios{"-" + "-".join(only) if only else ""}{"-upload" if UPLOAD_STAMP else ""}.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
