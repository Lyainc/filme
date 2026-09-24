import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Icon } from './icons';

const ASSETS = '../../../public/assets/landing/';
const MOODS = [
  { id: 'minimal', label: 'Minimal', note: '장면에 집중하는', file: 'hero-minimal.webp' },
  { id: 'criterion', label: 'Criterion', note: '한 편의 영화 노트', file: 'hero-criterion.webp' },
  { id: '35mm', label: '35mm', note: '필름으로 남기는', file: 'hero-35mm.webp' },
  { id: 'editorial', label: 'Editorial', note: '매거진의 한 페이지', file: 'hero-editorial.webp', wide: true },
  { id: 'stub', label: 'Stub', note: '오래된 극장의 기억', file: 'hero-stub.webp' },
  { id: '35mm-landscape', label: '35mm Wide', note: '넓게 펼쳐진 장면', file: 'hero-35mm-wide.webp', wide: true },
];
const EMPTY = { title: '', year: '', original: '', actors: '', runtime: '', date: '', time: '', theater: '', screen: '', seat: '', booking: '', rating: '', signature: '', quote: '' };
const SAMPLE = { ...EMPTY, title: '먼 바다', year: '2025', original: 'THE FAR SEA', actors: '윤재이, Élodie Marchand-Vasseur', runtime: '118', date: '2026-02-14', time: '19:40', theater: '메가박스 코엑스', screen: 'Dolby Cinema관', seat: 'H열 12번', rating: '4.5', signature: '지윤' };
const DEFAULT_DESIGN = { mood: 'minimal', poster: false, crop: '원본 비율', material: '원본', coating: '없음', opacity: 100, size: 100, color: '기본', stamp: '없음', font: '자동', signature: '', quote: '', logo: '기본 로고', logoSize: 100, logoVisible: true, logoText: '', logoUploaded: false, stampSize: 100 };
const KEY = 'filme-mockup-v1-draft';
const SCENE = new URLSearchParams(location.search).get('scene');
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d || typeof d !== 'object' || !d.fields || !d.design) return null;
    const fields = Object.fromEntries(Object.keys(EMPTY).map(k => [k, typeof d.fields[k] === 'string' ? d.fields[k] : '']));
    const design = { ...DEFAULT_DESIGN };
    for (const k of Object.keys(design)) if (typeof d.design[k] === typeof design[k]) design[k] = d.design[k];
    if (!MOODS.some(m => m.id === design.mood)) design.mood = 'minimal';
    return { fields, design, hidden: Array.isArray(d.hidden) ? d.hidden.filter(k => Object.hasOwn(EMPTY, k)) : [] };
  } catch { return null; }
}
const initial = SCENE && !location.hash ? { fields: SAMPLE, design: DEFAULT_DESIGN } : readDraft();
const STEPS = ['info', 'design', 'result'];

function Field({ id, label, optional, error, ...props }) {
  return <div className="field"><label htmlFor={id}>{label}{optional && <span className="optional">선택</span>}</label><Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}</div>;
}
function Choice({ value, options, onChange, label }) {
  return <div className="choices" role="group" aria-label={label}>{options.map(option => <Button key={option} type="button" variant="outline" className={`choice ${value === option ? 'selected' : ''}`} aria-pressed={value === option} onClick={() => onChange(option)}>{option}{value === option && <Icon name="check" />}</Button>)}</div>;
}
function Range({ id, label, value, onChange, min = 0, max = 100 }) {
  return <div className="range-field"><label htmlFor={id}>{label}<output htmlFor={id}>{value}%</output></label><input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} /></div>;
}
function App() {
  const [page, setPage] = useState(() => { const route = location.hash.slice(1) || SCENE; return STEPS.includes(route) ? (initial?.fields.title && /^\d{4}$/.test(initial.fields.year) ? route : 'info') : 'home'; });
  const [fields, setFields] = useState(initial?.fields || EMPTY);
  const [design, setDesign] = useState(initial?.design || DEFAULT_DESIGN);
  const [hasDraft, setHasDraft] = useState(Boolean(initial));
  const [storageFailed, setStorageFailed] = useState(false);
  const [errors, setErrors] = useState({});
  const [hero, setHero] = useState(0);
  const [panel, setPanel] = useState(null);
  const [tab, setTab] = useState('질감');
  const [working, setWorking] = useState(design);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('idle');
  const [scenario, setScenario] = useState('success');
  const [hidden, setHidden] = useState(initial?.hidden || []);
  const [notice, setNotice] = useState('');
  const timer = useRef(null);
  const opener = useRef(null);
  const heading = useRef(null);
  const started = useRef(Boolean(initial));
  const currentMood = MOODS.find(m => m.id === design.mood);
  const valid = fields.title.trim() && /^\d{4}$/.test(fields.year);

  useEffect(() => {
    const route = () => {
      let next = location.hash.slice(1) || (STEPS.includes(SCENE) ? SCENE : 'home');
      if (!['home', ...STEPS].includes(next)) next = 'home';
      if (['design', 'result'].includes(next) && !valid) next = 'info';
      setPanel(history.state?.filmeMockupPanel || null); setPage(next);
    };
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    return () => { window.removeEventListener('hashchange', route); window.removeEventListener('popstate', route); };
  }, [valid]);
  useEffect(() => {
    if (!started.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ fields, design, hidden })); setHasDraft(true); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }, [fields, design, hidden]);
  useEffect(() => () => clearTimeout(timer.current), [panel]);
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, [page]);
  useEffect(() => {
    if (!window.visualViewport) return;
    const update = () => {
      const vp = window.visualViewport;
      const keyboard = Math.max(0, window.innerHeight - vp.height - vp.offsetTop);
      document.documentElement.style.setProperty('--keyboard-offset', `${keyboard > 120 ? keyboard : 0}px`);
      document.body.classList.toggle('keyboard-open', keyboard > 120);
    };
    visualViewport.addEventListener('resize', update); visualViewport.addEventListener('scroll', update);
    return () => { visualViewport.removeEventListener('resize', update); visualViewport.removeEventListener('scroll', update); };
  }, []);

  function go(next) {
    if (history.state?.filmeMockupPanel && next === page) { close(); return; }
    setPanel(null); setPage(next); window.scrollTo(0, 0);
    if (history.state?.filmeMockupPanel) history.replaceState(null, '', `#${next}`);
    else if (location.hash !== `#${next}`) location.hash = next;
  }
  function open(type, options = {}) {
    setPhase('idle'); setWorking({ ...design }); setPanel(type);
    if (history.state?.filmeMockupPanel) history.replaceState({ filmeMockupPanel: type }, '', location.href);
    else history.pushState({ filmeMockupPanel: type }, '', location.href);
    if (options.tab) setTab(options.tab);
    if (type === 'search') setQuery(fields.title);
  }
  function close() { if (history.state?.filmeMockupPanel) history.back(); else setPanel(null); }
  function run(next = scenario) {
    clearTimeout(timer.current); setPhase('loading');
    timer.current = setTimeout(() => setPhase(next), 850);
  }
  function change(key, value) {
    started.current = true;
    setFields(v => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(v => ({ ...v, [key]: undefined }));
  }
  function commit(next) {
    started.current = true;
    setPast(v => [...v.slice(-19), design]); setFuture([]); setDesign(next);
  }
  function undo() {
    if (!past.length) return;
    setFuture(v => [design, ...v]); setDesign(past.at(-1)); setPast(v => v.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast(v => [...v, design]); setDesign(future[0]); setFuture(v => v.slice(1));
  }
  function start() { if (hasDraft && fields.title) open('reset'); else begin(); }
  function begin() {
    started.current = true; setFields({ ...EMPTY }); setDesign({ ...DEFAULT_DESIGN, mood: MOODS[hero].id });
    setPast([]); setFuture([]); setErrors({}); setHidden([]); setNotice(''); go('info');
  }
  function next(e) {
    e.preventDefault();
    const problems = {};
    if (!fields.title.trim()) problems.title = '제목이 비어 있어요. 영화 제목을 입력해 주세요.';
    if (!/^\d{4}$/.test(fields.year)) problems.year = '연도를 확인해 주세요. 숫자 네 자리로 입력해 주세요.';
    setErrors(problems);
    const first = Object.keys(problems)[0];
    if (first) document.getElementById(first)?.focus(); else go('design');
  }
  function useSample(which = 0) {
    started.current = true;
    setFields(which ? { ...SAMPLE, title: '빈 방의 오후', original: 'AN EMPTY AFTERNOON', year: '2025', runtime: '94' } : { ...SAMPLE });
    setErrors({}); setNotice('샘플 정보를 채웠어요. 내용을 수정할 수 있어요.'); go('info');
  }
  function ticket(mood = currentMood, cls = '') {
    return <img className={`ticket-image ${mood.wide ? 'wide' : ''} ${cls}`} src={ASSETS + mood.file} alt={`${mood.label} 디자인의 기존 샘플 티켓`} draggable="false" />;
  }
  const titles = { moods: '티켓 디자인', about: '목업 안내', search: '영화 검색', ocr: '스크린샷으로 입력', poster: '포스터', settings: '세부 꾸미기', preview: '티켓 미리보기', visibility: '표시할 정보', save: '이미지 저장', share: '티켓 공유', reset: '새 티켓 시작' };
  const descriptions = { moods: '영화의 분위기에 맞는 한 장을 골라 보세요.', about: '샘플로 제작 흐름과 화면을 살펴보세요.', search: '제목을 검색해 영화 정보를 채워요.', ocr: '예매 내역의 영화와 관람 정보를 가져와요.', poster: '포스터를 넣거나, 글자만으로 완성해요.', settings: '필요한 만큼만 취향을 더해요.', preview: '기존 티켓 디자인을 그대로 사용한 샘플이에요.', visibility: '티켓에 남기고 싶은 정보를 선택하세요.', save: '목업 시연이에요. 실제 파일은 저장되지 않아요.', share: '목업 시연이에요. 실제 공유 링크는 만들지 않아요.', reset: '현재 목업 초안을 지우고 새로 시작할까요?' };

  return <>
    <div className={`app-frame page-${page}`} data-page={page} onClickCapture={e => {
      // Touch activation does not consistently focus buttons (including iOS Safari).
      // Keep the actual invoking button, not document.activeElement, for sheet dismissal.
      const button = e.target.closest('button');
      if (button) opener.current = button;
    }}>
      <header className={`app-header ${page === 'home' ? 'landing-header' : ''}`}>
        {page !== 'home' ? <Button variant="ghost" size="icon" className="icon-button" aria-label="뒤로 가기" onClick={() => go(page === 'info' ? 'home' : page === 'design' ? 'info' : 'design')}><Icon name="back" /></Button> : <span className="prototype-label">인터랙티브 목업</span>}
        {page !== 'home' && <span className="nav-title">{page === 'result' ? '내 티켓' : '티켓 만들기'}</span>}
        <Button variant="ghost" size="icon" className="icon-button about-button" aria-label="목업 안내" onClick={() => open('about')}><Icon name="info" /></Button>
      </header>

      {page === 'home' ? <main className="home-main">
        <div className="home-copy"><h1 ref={heading} tabIndex={-1}>좋아한 영화,<br />간직할 한 장.</h1><p>나만의 포토티켓으로 남겨 보세요.</p></div>
        <div className="hero-stage" aria-label="디자인 미리보기">
          <div className="hero-ticket">{ticket(MOODS[hero])}</div>
          <Button variant="ghost" size="icon" className="hero-prev icon-button" aria-label="이전 디자인" onClick={() => setHero(v => (v + 5) % 6)}><Icon name="back" /></Button>
          <Button variant="ghost" size="icon" className="hero-next icon-button" aria-label="다음 디자인" onClick={() => setHero(v => (v + 1) % 6)}><Icon name="chevron" /></Button>
        </div>
        <div className="hero-caption"><span>{MOODS[hero].label}</span><span>{String(hero + 1).padStart(2, '0')} <span className="muted">/ 06</span></span></div>
        <div className="home-actions">
          <Button className="primary-button" onClick={start}>티켓 만들기<Icon name="arrow" /></Button>
          <Button variant="ghost" className="secondary-start" onClick={() => open('ocr')}><Icon name="scan" />스크린샷으로 시작</Button>
          {hasDraft && fields.title && <button className="resume-row" onClick={() => { started.current = true; go(valid ? 'design' : 'info'); }}><Icon name="clock" /><span><strong>이어서 만들기</strong><small>{fields.title}</small></span><Icon name="chevron" /></button>}
        </div>
        <footer className="home-footer"><p>비공식 팬메이드 티켓이라 양도·재판매할 수 없고, 정보 정확성은 보장하지 않으며 분실·훼손에 책임지지 않아요.</p><span>© FILME</span></footer>
      </main> : <>
        <ol className="progress-steps" aria-label="제작 단계">{['영화 정보', '꾸미기', '완성'].map((label, i) => <li key={label} className={STEPS.indexOf(page) >= i ? 'reached' : ''} aria-current={STEPS[i] === page ? 'step' : undefined}><span>{STEPS.indexOf(page) > i ? <Icon name="check" /> : i + 1}</span>{label}</li>)}</ol>

        {page === 'info' && <main className="info-main">
          <div className="page-intro"><h1 ref={heading} tabIndex={-1}>어떤 영화를 보셨나요?</h1><p>제목과 개봉연도만 있으면 시작할 수 있어요.</p></div>
          <div className="import-actions"><Button variant="outline" onClick={() => open('search')}><Icon name="search" />영화 검색</Button><Button variant="outline" onClick={() => open('ocr')}><Icon name="scan" />스크린샷 입력</Button></div>
          {notice && <p className="inline-notice" role="status"><Icon name="check" />{notice}</p>}
          <form id="movie-form" onSubmit={next} noValidate>
            <section className="form-section">
              <div className="section-title"><h2>기본 정보</h2><span>필수</span></div>
              <Field id="title" label="영화 제목" required placeholder="예: 먼 바다" value={fields.title} error={errors.title} onChange={e => change('title', e.target.value)} />
              <Field id="year" label="개봉연도" required inputMode="numeric" maxLength={4} placeholder="예: 2025" value={fields.year} error={errors.year} onChange={e => change('year', e.target.value)} />
            </section>
            <details className="form-details" open={Boolean(SCENE)}><summary><div><h2>관람 기록</h2><p>날짜, 극장, 좌석을 함께 남겨요.</p></div><Icon name="down" /></summary><div className="details-body">
              <div className="field-pair"><Field id="date" label="관람일" type="date" value={fields.date} onChange={e => change('date', e.target.value)} /><Field id="time" label="관람 시간" type="time" value={fields.time} onChange={e => change('time', e.target.value)} /></div>
              <Field id="theater" label="극장" placeholder="예: 메가박스 코엑스" value={fields.theater} onChange={e => change('theater', e.target.value)} />
              <div className="field-pair"><Field id="screen" label="상영관" placeholder="예: 3관" value={fields.screen} onChange={e => change('screen', e.target.value)} /><Field id="seat" label="좌석" placeholder="예: H열 12번" value={fields.seat} onChange={e => change('seat', e.target.value)} /></div>
              <Field id="booking" label="예매 번호" value={fields.booking} onChange={e => change('booking', e.target.value)} />
            </div></details>
            <details className="form-details"><summary><div><h2>영화 상세 정보</h2><p>원제, 출연, 러닝타임, 평점</p></div><Icon name="down" /></summary><div className="details-body">
              <Field id="original" label="원제" value={fields.original} onChange={e => change('original', e.target.value)} />
              <Field id="actors" label="출연" value={fields.actors} onChange={e => change('actors', e.target.value)} />
              <div className="field-pair"><Field id="runtime" label="러닝타임 (분)" inputMode="numeric" value={fields.runtime} onChange={e => change('runtime', e.target.value)} /><Field id="rating" label="평점 (0–5)" type="number" min="0" max="5" step="0.5" value={fields.rating} onChange={e => change('rating', e.target.value)} /></div>
            </div></details>
          </form>
          <Button variant="ghost" className="text-action" onClick={() => open('visibility')}><Icon name="eye" />표시할 정보 선택</Button>
          <div className="bottom-bar"><span className="bottom-hint">세부 정보는 나중에 채워도 돼요.</span><Button type="submit" form="movie-form" className="primary-button">디자인 고르기<Icon name="arrow" /></Button></div>
        </main>}

        {page === 'design' && <main className="design-main">
          <div className="design-heading"><div><h1 ref={heading} tabIndex={-1} className="sr-only">티켓 꾸미기</h1><button className="mood-picker-trigger" aria-label={`디자인 변경 — ${currentMood.label}`} onClick={() => open('moods')}>{currentMood.label}<Icon name="down" /></button><span className={`draft-status ${storageFailed ? 'error-text' : ''}`}>{storageFailed ? '초안 저장 공간을 확인해 주세요.' : '목업 초안 저장됨'}</span></div><div className="history-buttons"><Button variant="ghost" size="icon" className="icon-button" aria-label="실행 취소" disabled={!past.length} onClick={undo}><Icon name="undo" /></Button><Button variant="ghost" size="icon" className="icon-button" aria-label="다시 실행" disabled={!future.length} onClick={redo}><Icon name="redo" /></Button></div></div>
          <div className="preview-stage"><button className="preview-ticket-button" aria-label="티켓 크게 보기" onClick={() => open('preview')}>{ticket()}</button><Button variant="secondary" size="icon" className="expand-button icon-button" aria-label="미리보기 확대" onClick={() => open('preview')}><Icon name="expand" /></Button><span className="sample-label">디자인 샘플</span></div>

          <div className="option-list">
            <button className="option-row" onClick={() => open('poster')}><span className="row-icon"><Icon name="image" /></span><span className="row-content"><strong>포스터</strong><small>{design.poster ? '샘플 포스터 선택됨' : '사진을 더하거나 글자만으로'}</small></span><span className="row-value">{design.poster ? '변경' : '선택'}</span><Icon name="chevron" /></button>
            <button className="option-row" onClick={() => open('settings', { tab: '질감' })}><span className="row-icon"><Icon name="sliders" /></span><span className="row-content"><strong>세부 꾸미기</strong><small>컬러, 질감, 문구, 로고</small></span><Icon name="chevron" /></button>
            <button className="option-row" onClick={() => go('info')}><span className="row-icon"><Icon name="edit" /></span><span className="row-content"><strong>영화 정보</strong><small>{fields.title} · {fields.year}</small></span><Icon name="chevron" /></button>
          </div>
          <div className="bottom-bar"><span className="bottom-hint">지금 디자인으로도 완성할 수 있어요.</span><Button className="primary-button" onClick={() => go('result')}>티켓 완성<Icon name="check" /></Button></div>
        </main>}

        {page === 'result' && <main className="result-main"><div className="page-intro"><span className="completion-mark"><Icon name="check" /></span><h1 ref={heading} tabIndex={-1}>간직할 한 장이 완성됐어요.</h1><p>좋아한 장면을 오래 꺼내 볼 수 있게.</p></div><div className="result-ticket" onClick={() => open('preview')}><button aria-label="완성 티켓 크게 보기">{ticket()}</button></div><div className="result-caption"><strong>{fields.title}</strong><span>{currentMood.label} · {fields.year}</span><small>디자인 샘플 미리보기</small></div><Button variant="ghost" className="text-action" onClick={() => go('design')}><Icon name="edit" />다시 편집</Button><div className="bottom-bar"><div className="result-actions"><Button variant="outline" className="share-button" onClick={() => open('share')}><Icon name="share" /><span>공유</span></Button><Button className="primary-button" onClick={() => open('save')}><Icon name="download" />이미지 저장</Button></div><button className="start-over" onClick={() => go('home')}>처음 화면으로</button></div></main>}
      </>}
    </div>

    <Dialog open={Boolean(panel)} onOpenChange={isOpen => { if (!isOpen) close(); }}>
      <DialogContent className={`sheet ${panel === 'preview' ? 'preview-sheet' : ''}`} onCloseAutoFocus={e => { e.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-header"><DialogTitle>{titles[panel] || '설정'}</DialogTitle><DialogDescription>{descriptions[panel]}</DialogDescription></div>
        <div className="sheet-body">
          {panel === 'about' && <><div className="about-note"><Icon name="ticket" /><p>이 목업은 화면과 조작 흐름을 검토해요. 검색·인식·저장·공유는 샘플 동작이에요.</p></div><p className="body-copy">티켓은 기존 6종 디자인 이미지예요. 입력과 꾸미기 값은 조작 상태만 바뀌고, 티켓 이미지에는 반영되지 않아요.</p><div className="field"><label htmlFor="scenario">시연할 응답 상태</label><select id="scenario" value={scenario} onChange={e => setScenario(e.target.value)}><option value="success">정상 완료</option><option value="empty">결과 없음</option><option value="error">오류 발생</option></select><p className="helper">영화 검색·스크린샷·저장 시연에 적용해요.</p></div><p className="helper">실제 서비스의 초안과는 별도로 보관해요.</p><Button className="primary-button" onClick={close}>확인</Button></>}

          {panel === 'reset' && <div className="stack"><p className="body-copy">현재 초안의 정보와 꾸미기 선택이 초기화돼요.</p><Button className="primary-button" onClick={begin}>새로 시작</Button><Button variant="outline" className="full-button" onClick={close}>계속 편집</Button></div>}

          {panel === 'search' && <><form className="search-form" onSubmit={e => { e.preventDefault(); run(query.trim() ? scenario : 'empty'); }}><label htmlFor="search" className="sr-only">영화 제목 검색</label><Input id="search" placeholder="영화 제목" value={query} onChange={e => setQuery(e.target.value)} /><Button type="submit" aria-label="검색" disabled={phase === 'loading'}><Icon name="search" /></Button></form>{phase === 'loading' ? <Loading text="영화를 찾고 있어요." /> : phase === 'error' ? <Failure text="영화를 불러오지 못했어요." action="직접 입력" onAction={() => { close(); go('info'); }} /> : phase === 'empty' ? <EmptyState text="검색 결과가 없어요." detail="다른 제목으로 검색하거나 직접 입력해 주세요." /> : <><div className="list-caption">샘플 검색 결과</div>{['먼 바다', '빈 방의 오후'].map((title, i) => <button className="search-result" key={title} onClick={() => useSample(i)}><span className="search-thumb">{ticket(MOODS[i])}</span><span><strong>{title}</strong><small>2025 · {i ? '94' : '118'}분</small></span><Icon name="plus" /></button>)}</>}<Button variant="ghost" className="full-button" onClick={() => { close(); go('info'); }}>직접 입력</Button></>}

          {panel === 'ocr' && <>{phase === 'loading' ? <Loading text="관람 정보를 읽고 있어요." /> : ['error', 'empty'].includes(phase) ? <><Failure text={phase === 'empty' ? '관람 정보를 찾지 못했어요.' : '스크린샷을 읽지 못했어요.'} action="다시 시도" onAction={() => run()} /><Button variant="ghost" className="full-button" onClick={() => go('info')}>직접 입력</Button></> : phase === 'success' ? <><div className="inline-notice"><Icon name="check" />샘플 관람 정보를 가져왔어요.</div><dl className="summary-list"><div><dt>영화</dt><dd>먼 바다</dd></div><div><dt>관람일</dt><dd>2026.02.14. 19:40</dd></div><div><dt>극장</dt><dd>메가박스 코엑스</dd></div><div><dt>좌석</dt><dd>H열 12번</dd></div></dl><Button className="primary-button" onClick={() => useSample()}>정보 확인하기<Icon name="arrow" /></Button></> : <><div className="upload-zone"><Icon name="scan" /><strong>예매 내역 한 장으로 시작</strong><p>영화 제목과 관람 정보가 보이는<br />스크린샷을 선택하세요.</p></div><Button className="primary-button" onClick={() => run()}>샘플 스크린샷 선택</Button><p className="helper centered">목업에서는 준비된 샘플로 시연해요.</p></>}</>}

          {panel === 'moods' && <div className="mood-grid" role="group" aria-label="티켓 디자인">{MOODS.map(mood => <button key={mood.id} className={`mood-option ${design.mood === mood.id ? 'selected' : ''}`} aria-pressed={design.mood === mood.id} onClick={() => { commit({ ...design, mood: mood.id }); close(); }}><span className="mood-thumbnail">{ticket(mood)}{design.mood === mood.id && <span className="selected-check"><Icon name="check" /></span>}</span><strong>{mood.label}</strong><small>{mood.note}</small></button>)}</div>}

          {panel === 'preview' && <div className="expanded-ticket">{ticket()}<p className="helper centered">{currentMood.label} · 기존 디자인 샘플</p></div>}

          {panel === 'poster' && <><div className="poster-sample">{ticket()}<span>기존 포스터 샘플</span></div><Choice label="포스터 선택" value={working.poster ? '샘플 포스터' : '포스터 없음'} options={['샘플 포스터', '포스터 없음']} onChange={value => setWorking(v => ({ ...v, poster: value === '샘플 포스터' }))} /><div className="setting-section"><h3>자르기</h3><Choice label="포스터 자르기" value={working.crop} options={['원본 비율', '세로', '가로']} onChange={crop => setWorking(v => ({ ...v, crop }))} /><p className="helper">사진 선택과 자르기의 화면 흐름만 시연해요.</p></div><Range id="poster-size" label="포스터 크기" value={working.size} min={50} max={150} onChange={size => setWorking(v => ({ ...v, size }))} /></>}

          {panel === 'settings' && <><div className="settings-tabs" role="group" aria-label="꾸미기 항목">{[['질감', 'layers'], ['컬러', 'palette'], ['문구', 'type'], ['로고', 'logo'], ['스탬프', 'stamp']].map(([name, icon]) => <button key={name} className={tab === name ? 'selected' : ''} aria-pressed={tab === name} onClick={() => setTab(name)}><Icon name={icon} />{name}</button>)}</div>
            {tab === '질감' && <><div className="setting-section"><h3>종이 재질</h3><Choice label="종이 재질" value={working.material} options={['원본', '아트지', '빈티지', '신문지']} onChange={material => setWorking(v => ({ ...v, material }))} /></div><div className="setting-section"><h3>코팅</h3><Choice label="코팅" value={working.coating} options={['없음', '유광', '홀로그램', '메탈', '스코딕스']} onChange={coating => setWorking(v => ({ ...v, coating }))} /></div><Range id="opacity" label="효과 강도" value={working.opacity} onChange={opacity => setWorking(v => ({ ...v, opacity }))} /><p className="helper">선택 상태 시연이며 샘플 이미지에는 합성하지 않아요.</p></>}
            {tab === '컬러' && <><div className="setting-section"><h3>티켓 컬러</h3>{['minimal', 'editorial'].includes(design.mood) ? <Choice label="티켓 컬러" value={working.color} options={['기본', '차콜', '브릭', '세이지']} onChange={color => setWorking(v => ({ ...v, color }))} /> : <div className="empty-setting"><Icon name="palette" /><p>{currentMood.label}은 고유 컬러를 사용해요.</p><span>이 디자인에는 컬러 변경이 적용되지 않아요.</span></div>}</div></>}
            {tab === '문구' && <><Field id="signature" label="서명" optional placeholder="예: collected by 지윤" value={working.signature} onChange={e => setWorking(v => ({ ...v, signature: e.target.value }))} />{design.mood === 'criterion' ? <Field id="quote" label="한줄평" optional value={working.quote} onChange={e => setWorking(v => ({ ...v, quote: e.target.value }))} /> : <p className="helper">한줄평은 Criterion 디자인에서 사용할 수 있어요.</p>}<div className="field"><label htmlFor="font">서체</label><select id="font" value={working.font} onChange={e => setWorking(v => ({ ...v, font: e.target.value }))}>{['자동', '고딕', '바탕', '자람', '잉크', '은영', '붓', '쿨가이', '꽃길'].map(font => <option key={font}>{font}</option>)}</select><p className="helper">목업은 서체 선택 동작만 시연해요.</p></div></>}
            {tab === '로고' && <><label className="switch-row"><span><strong>로고 표시</strong><small>극장·상영 포맷 로고</small></span><input type="checkbox" role="switch" checked={working.logoVisible} onChange={e => setWorking(v => ({ ...v, logoVisible: e.target.checked }))} /></label>{working.logoVisible && <><Choice label="로고 종류" value={working.logo} options={['기본 로고', '텍스트', '이미지']} onChange={logo => setWorking(v => ({ ...v, logo }))} />{working.logo === '텍스트' && <Field id="logo-text" label="로고 문구" value={working.logoText || ''} placeholder="예: FILM CLUB" onChange={e => setWorking(v => ({ ...v, logoText: e.target.value }))} />}{working.logo === '이미지' && <Button variant="outline" className="full-button" onClick={() => setWorking(v => ({ ...v, logoUploaded: true }))}><Icon name="image" />{working.logoUploaded ? '샘플 이미지 선택됨' : '샘플 로고 선택'}</Button>}<Range id="logo-size" label="로고 크기" value={working.logoSize} min={50} max={150} onChange={logoSize => setWorking(v => ({ ...v, logoSize }))} /></>}</>}
            {tab === '스탬프' && <><div className="setting-section"><h3>스탬프 패턴</h3><Choice label="스탬프 패턴" value={working.stamp} options={['없음', '별', '도트', '격자', '선']} onChange={stamp => setWorking(v => ({ ...v, stamp }))} /></div><Range id="stamp-size" label="스탬프 크기" value={working.stampSize || 100} min={50} max={150} onChange={stampSize => setWorking(v => ({ ...v, stampSize }))} /><p className="helper">패턴과 크기의 선택 동작을 시연해요.</p></>}
          </>}

          {panel === 'visibility' && <><p className="helper">제목과 개봉연도는 티켓 완성에 필요해요.</p>{[['original', '원제'], ['actors', '출연'], ['date', '관람일'], ['time', '관람 시간'], ['theater', '극장'], ['screen', '상영관'], ['seat', '좌석'], ['rating', '평점']].map(([key, label]) => <label className="switch-row" key={key}><span>{label}</span><input type="checkbox" role="switch" checked={!hidden.includes(key)} onChange={e => setHidden(v => e.target.checked ? v.filter(k => k !== key) : [...v, key])} /></label>)}<Button className="primary-button" onClick={close}>확인</Button></>}

          {['save', 'share'].includes(panel) && <>{phase === 'loading' ? <Loading text={panel === 'save' ? '티켓을 준비하고 있어요.' : '공유 링크를 준비하고 있어요.'} /> : ['error', 'empty'].includes(phase) ? <Failure text={panel === 'save' ? '이미지를 저장하지 못했어요.' : '공유 링크를 만들지 못했어요.'} action="다시 시도" onAction={() => run()} /> : phase === 'success' ? <div className="feedback-state"><span className="completion-mark"><Icon name="check" /></span><h3>{panel === 'save' ? '저장 완료 화면이에요.' : '링크 복사 완료 화면이에요.'}</h3><p>실제 {panel === 'save' ? '파일 저장' : '링크 생성·복사'}은 실행하지 않았어요.</p><Button className="primary-button" onClick={close}>확인</Button></div> : <><dl className="summary-list"><div><dt>디자인</dt><dd>{currentMood.label}</dd></div><div><dt>형식</dt><dd>{panel === 'save' ? 'JPEG 이미지' : '공유 링크'}</dd></div></dl><Button className="primary-button" onClick={() => run()}><Icon name={panel === 'save' ? 'download' : 'share'} />{panel === 'save' ? '저장 시연' : '링크 복사 시연'}</Button></>}</>}
        </div>
        {['poster', 'settings'].includes(panel) && <div className="sheet-footer"><Button className="primary-button" onClick={() => { commit(working); close(); }}>적용<Icon name="check" /></Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}
function Loading({ text }) { return <div className="feedback-state" role="status" aria-live="polite"><span className="spinner" /><h3>{text}</h3><p>잠시만 기다려 주세요.</p><div className="skeleton-lines" aria-hidden="true"><i /><i /><i /></div></div>; }
function Failure({ text, action, onAction }) { return <div className="feedback-state failure" role="alert"><Icon name="alert" /><h3>{text}</h3><p>다시 시도하거나 직접 입력해 주세요.</p><Button variant="outline" className="full-button" onClick={onAction}>{action}</Button></div>; }
function EmptyState({ text, detail }) { return <div className="feedback-state"><Icon name="search" /><h3>{text}</h3><p>{detail}</p></div>; }

createRoot(document.getElementById('root')).render(<App />);
