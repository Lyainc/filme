"""#858 완료 조건: 결과 화면을 새로 열어 [저장] · [공유] **첫 탭**에 공유 시트가 뜨는지.

회차마다 페이지를 새로 탐색하고(실패가 몰리던 조건 — 새 페이지의 첫 캡처) '이어서 만들기' → 완료 → 버튼 한 번만 XCTest로
누른다. 다시 누르지 않는다. navigator.share를 감싸 호출 시각 · 그 순간 활성 · 결과(이름)를 남긴다.

    python3 run858.py [save=10] [share=5]

출력: $FILME_SIM_DIR/ev/858/858-ios.json. Simulator 결과이고 실기기 결과가 아니다.
"""
import json, os, sys, time
from sim import *
import sim
import run768

OUT = f'{S}/ev/858'
os.makedirs(OUT, exist_ok=True)
HOOK = r'''const p = window.__r = {runs: []}; const orig = navigator.share.bind(navigator);
navigator.share = (d) => { const run = {at: Math.round(performance.now() - (p.click || 0)), act: navigator.userActivation.isActive, files: !!(d && d.files)}; p.runs.push(run);
  return orig(d).then((v) => { run.r = 'shared'; return v; }, (e) => { run.r = e.name; throw e; }); };
document.addEventListener('click', () => { p.click = performance.now(); }, true); return true;'''


def dismiss():
    for name in ('닫기', 'Close'):
        if native_tap(name):
            time.sleep(1.0)
            return
    tap_pt(200, 120)
    time.sleep(1.0)


def fresh_result(tag):
    ctx('WEB')
    req('POST', 'url', {'url': f'{URL}?r858={tag}'})
    time.sleep(2.5)
    for _ in range(60):
        sim._ctx[0] = None
        sim._web[0] = None
        try:
            if f'r858={tag}' in js('return location.href') and js('return document.readyState') == 'complete':
                break
        except Exception:
            pass
        time.sleep(1)
    restore = 'document.querySelector("[data-testid=landing-restore]")'
    for _ in range(30):
        r = rect_of(restore)
        if r and r['h'] > 0:
            break
        time.sleep(0.5)
    tap_el(restore)
    time.sleep(2.0)
    tap_el(by_text('button', '완료'))
    time.sleep(2.5)
    js(HOOK)
    return js('return Math.round(performance.now())')


def first_tap(testid, wait_s):
    tap_el(f'document.querySelector(\'[data-testid="{testid}"]\')')
    sheet = False
    for _ in range(int(wait_s * 2)):
        time.sleep(0.5)
        if sheet_open():
            sheet = True
            break
        if js('return !!document.querySelector("[data-testid=result-alert]")'):
            break
    rec = {'sheet': sheet,
           'share': json.loads(js('return JSON.stringify(window.__r.runs)')),
           'alert': js('return document.querySelector("[data-testid=result-alert]")?.textContent || null')}
    if sheet:
        dismiss()
    return rec


def save(out):
    with open(f'{OUT}/858-ios.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


def main():
    args = dict(a.split('=') for a in sys.argv[1:])
    n_save, n_share = int(args.get('save', 10)), int(args.get('share', 5))
    seed = run768.seed_cell('both', False, False)
    out = {'build': js('return window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId'), 'url': URL, 'udid': UDID,
           'note': 'iOS Simulator 결과이고 실기기 결과가 아니다. 회차마다 새 페이지 · 버튼 첫 탭 1회. [공유]는 /api/ticket이 Blob 토큰 없이 실패하는 로컬 환경이면 share까지 가지 않는다.', 'seed': seed,
           'save': [], 'share': []}
    for kind, n, testid, wait_s in (('save', n_save, 'result-save', 6), ('share', n_share, 'result-share', 10)):
        for i in range(n):
            rec = {'i': i + 1, 'harnessRetries': []}
            # 탭 전 단계(탐색 · 진입)의 Appium 끊김은 판정이 아니라 하네스 오류라 그 단계만 다시 한다. 탭 뒤 오류는 그대로 남긴다.
            for _ in range(3):
                try:
                    rec['sinceNav'] = fresh_result(f'{kind}{i}{int(time.time())}')
                    break
                except Exception as e:
                    rec['harnessRetries'].append(str(e)[:120])
            if 'sinceNav' in rec:
                try:
                    rec.update(first_tap(testid, wait_s))
                except Exception as e:
                    rec['error'] = str(e)[:300]
            else:
                rec['error'] = 'harness: 결과 화면 진입 3회 실패'
            out[kind].append(rec)
            print(kind, json.dumps(rec, ensure_ascii=False), flush=True)
            save(out)
    out['summary'] = {k: f"{sum(1 for r in out[k] if r.get('sheet'))}/{len(out[k])} 첫 탭 시트" for k in ('save', 'share')}
    save(out)
    print(json.dumps(out['summary'], ensure_ascii=False))
    sys.exit(0 if all(r.get('sheet') for r in out['save']) else 1)


if __name__ == '__main__':
    main()
