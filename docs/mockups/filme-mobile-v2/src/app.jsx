import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '../../filme-mobile-v1/src/ui/button';
import { Input } from '../../filme-mobile-v1/src/ui/input';
import { Dialog, DialogContent, DialogTitle } from '../../filme-mobile-v1/src/ui/dialog';
import { Icon } from '../../filme-mobile-v1/src/icons';
import { MOOD_EXCLUDED_FIELDS as PRODUCTION_EXCLUDED_FIELDS, TONE_FIXED_MOODS, POSTER_FILL_MOODS } from '../../../../src/constants/fields';
import { ALL_FIELDS_ON } from '../../../../src/constants/fieldVisibility';
import { LiveTicket, SAMPLE_POSTER } from './LiveTicket';
import { PhotoCrop } from './PhotoCrop';
import { DesignPresets } from './DesignPresets';
import { Landing } from './Landing';
import { Wordmark } from '../../../../src/components/v2/Wordmark';

const MOODS = [['minimal','Minimal','hero-minimal.webp'],['criterion','Criterion','hero-criterion.webp'],['35mm','35mm','hero-35mm.webp'],['editorial','Editorial','hero-editorial.webp'],['stub','Stub','hero-stub.webp'],['35mm-landscape','35mm Wide','hero-35mm-wide.webp']];
// Production hides Criterion's quote from its launcher; the mockup exposes it in the grouped form.
const MOOD_EXCLUDED_FIELDS = {...PRODUCTION_EXCLUDED_FIELDS, criterion:(PRODUCTION_EXCLUDED_FIELDS.criterion||[]).filter(field=>field!=='quote')};
const SAMPLE = { title:'먼 바다', original:'THE FAR SEA', release:'2025-11-19', reissue:'', actors:'윤재이, Élodie Marchand-Vasseur', runtime:'118', date:'2026-02-14', time:'19:40', theater:'메가박스 코엑스', screen:'Dolby Cinema관', seat:'H열 12번', booking:'', rating:'4.5', signature:'지윤', quote:'' };
const DEFAULT = { mood:'minimal', color:'기본', customColor:'#b0423f', material:'원본', coating:'없음', materialIntensity:60, coatingIntensity:60, signatureFont:'auto', quoteFont:'auto', chainImage:'', formatImage:'', signatureImage:'', chainLabel:'FILME', formatLabel:'IMAX', chainVisible:true, formatVisible:true, chainScale:1, formatScale:1, signatureScale:1, componentOpacity:100, crop:'원본', brightness:100, poster:true, posterSource:SAMPLE_POSTER, releaseDateFormat:'iso', watchDateFormat:'iso' };
const INLINE_TOOLS = ['정보','사진','디자인','색상','질감','로고'];
const KEY = 'filme-mockup-v2';
const GROUPS = {
  '영화': [['title','영화명'],['release','개봉일','date'],['reissue','재개봉일','date'],['runtime','상영 시간 (분)','number'],['original','원제'],['actors','출연']],
  '관람': [['date','관람일','date'],['time','관람 시간','time'],['theater','극장'],['screen','상영관'],['seat','좌석'],['booking','예매 번호']],
  '기록': [['rating','별점 (0–5)','number'],['signature','이름'],['quote','한 줄 기록']],
};
const NATIVE = {original:'titleOg',release:'releaseDate',reissue:'reissue',date:'watchDate',time:'watchTime',booking:'bookingNo'};
const FONTS = [['auto','자동'],['gothic','고딕'],['batang','바탕'],['hand','자람'],['ink','잉크'],['eunyoung','은영'],['brush','붓'],['coolguy','쿨가이'],['flower','꽃길']];
const ALL_FIELDS = Object.values(GROUPS).flat().map(([id,label,type='text'])=>({id,label,type,nativeId:NATIVE[id]||id}));
function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d?.fields || !d?.design) return null;
    const fields = Object.fromEntries(Object.entries(SAMPLE).map(([k,v])=>[k,typeof d.fields[k]==='string'?d.fields[k]:v]));
    const design = {...DEFAULT,...Object.fromEntries(Object.entries(DEFAULT).filter(([k,v])=>typeof d.design[k]===typeof v).map(([k])=>[k,d.design[k]]))};
    if(!d.design.signatureFont&&d.design.font){const font={기본:'auto',Pretendard:'gothic',경기천년바탕:'batang',잉크립퀴드:'ink'}[d.design.font]||'auto';design.signatureFont=font;design.quoteFont=font;}
    if(d.design.logo==='숨기기')design.chainVisible=false;
    if(!MOODS.some(([id])=>id===design.mood))design.mood='minimal';
    // Drafts made before provenance existed remain explicitly unknown.
    return {fields,design,sources:Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,typeof d.sources?.[k]==='string'?d.sources[k]:(fields[k]?'출처 미상':'')])),hidden:d.hidden&&typeof d.hidden==='object'?d.hidden:{}};
  } catch { return null; }
}
const savedDraft = readDraft();
const initial = savedDraft || {fields:SAMPLE,design:DEFAULT,sources:Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,SAMPLE[k]?'샘플':''])),hidden:{}};
function Action({ icon, children, ...props }) { return <Button variant="ghost" {...props}>{icon && <Icon name={icon}/>} {children}</Button>; }
function Choices({ value, options, onChange, label }) { return <div className="choices" role="group" aria-label={label}>{options.map(v=><Button key={v} variant="outline" aria-pressed={value===v} onClick={()=>onChange(v)}>{v}</Button>)}</div>; }
function Range({label,value,onChange,min=0,max=100,step=1,suffix='%',disabled=false}) { return <label className="range" data-disabled={disabled}>{label}<output>{disabled?'—':`${Math.round(value*100)/100}${suffix}`}</output><input style={{'--range-fill':`${Math.max(0,Math.min(100,(value-min)/(max-min)*100))}%`}} aria-label={label} disabled={disabled} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>; }
function DataField({ field, value, onChange, source, hidden, onOptions, onFocus, onNext, hasNext, active }) {
  const [id,label,type='text'] = field;
  const number = Number(value);
  const error = value!=='' && type==='number' && (id==='rating' ? !Number.isFinite(number)||number<0||number>5||!Number.isInteger(number*2) : !Number.isInteger(number)||number<0) ? (id==='rating'?'0부터 5까지, 0.5 단위로 입력해 주세요.':'0 이상의 정수로 입력해 주세요.') : '';
  return <div className={`field ${['title','original','actors','theater','quote','signature','booking'].includes(id)?'span-2':''}`} data-active={active}>
    <div className="field-label"><label htmlFor={id}>{label}{id==='title'&&!value&&<span className="required-hint">필수</span>}</label>{value&&<span className="source-badge" data-source={source}>{source}</span>}{hidden&&<span className="source-badge">숨김</span>}</div>
    <div className="field-entry">
      <Input id={id} name={id} type={type} value={value} autoComplete="off" required={id==='title'} placeholder={id==='title'?'영화명 입력':undefined} enterKeyHint={hasNext?'next':'done'} inputMode={type==='number'?(id==='rating'?'decimal':'numeric'):undefined} min={type==='number'?0:undefined} max={id==='rating'?5:undefined} maxLength={id==='quote'?31:undefined} step={type==='number'?(id==='rating'?0.5:1):undefined} aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined} onFocus={onFocus} onChange={e=>onChange(id,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();if(hasNext)onNext();else e.currentTarget.blur();}}}/>
      <Action className="field-settings" icon="sliders" aria-label={`${label} 표시 설정`} onClick={onOptions}/>
    </div>
    {error&&<small id={`${id}-error`} className="field-error" role="status">{error}</small>}
  </div>;
}
function App() {
  const [doc,setDoc] = useState(initial);
  const [view,setView] = useState('landing');
  const [hasDraft,setHasDraft] = useState(Boolean(savedDraft));
  const [pendingMood,setPendingMood]=useState(null);
  const focusRequested=useRef(false), completionRef=useRef(null);
  const [keyboardOpen,setKeyboardOpen]=useState(false);
  const {fields,design,sources,hidden}=doc;
  const documentRef=useRef(doc); documentRef.current=doc;
  const [panel,setPanel]=useState(null), [tool,setTool]=useState(null), [activeField,setActiveField]=useState(null);
  const [group,setGroup]=useState('영화'), [importTab,setImportTab]=useState('OCR'), [textureTab,setTextureTab]=useState('소재'), [logoTab,setLogoTab]=useState('chain');
  const [past,setPast]=useState([]), [future,setFuture]=useState([]);
  const [query,setQuery]=useState(''), [phase,setPhase]=useState('idle'), [notice,setNotice]=useState(''), [zoom,setZoom]=useState(false), [crop,setCrop]=useState(null);
  const [storageFailed,setStorageFailed]=useState(false);
  const [autoSave,setAutoSave]=useState(()=>{try{return localStorage.getItem(KEY+'-autosave')!=='off';}catch{return true;}});
  const autoSaveRef=useRef(autoSave);
  const uploadInput=useRef(null), uploadTarget=useRef('poster'), request=useRef(0), readerRef=useRef(null), opener=useRef(null), inlineHeading=useRef(null), timer=useRef(null), lastEdit=useRef(null);
  const excluded=MOOD_EXCLUDED_FIELDS[design.mood]||[];
  const available=ALL_FIELDS.filter(f=>!excluded.includes(f.nativeId));
  const poster=/^data:image\/(png|jpeg|webp);base64,/.test(design.posterSource)?design.posterSource:SAMPLE_POSTER;
  useEffect(()=>{
    if(!autoSave||!hasDraft)return;
    const save=()=>{if(!autoSaveRef.current)return;try{localStorage.setItem(KEY,JSON.stringify(documentRef.current));setStorageFailed(false);}catch{setStorageFailed(true);}};
    const timeout=setTimeout(save,250);window.addEventListener('pagehide',save);
    return()=>{clearTimeout(timeout);window.removeEventListener('pagehide',save);};
  },[doc,autoSave,hasDraft]);
  useEffect(()=>{
    const back=()=>{const state=history.state||{};const unapproved=state.filmeView==='result'&&completionRef.current!==documentRef.current;setView(unapproved?'editor':state.filmeView||'landing');setPanel(unapproved&&['저장 및 공유','미리보기'].includes(state.filmeV2Panel)?null:state.filmeV2Panel||null);setTool(history.state?.filmeV2Tool||null);setActiveField(history.state?.filmeField||null);if(state.filmeField)setGroup(Object.entries(GROUPS).find(([,items])=>items.some(([id])=>id===state.filmeField))?.[0]||'영화');setPhase('idle');setNotice('');setCrop(null);lastEdit.current=null;};
    window.addEventListener('popstate',back);
    history.replaceState({filmeView:'landing'},'',location.href);
    return()=>window.removeEventListener('popstate',back);
  },[]);
  useEffect(()=>()=>clearTimeout(timer.current),[panel,importTab]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const update=()=>{if(viewport&&viewport.scale!==1)return;const height=viewport?.height||innerHeight,top=viewport?.offsetTop||0;setKeyboardOpen(innerHeight-height>120);const css=document.documentElement.style;css.setProperty('--visible-height',`${height}px`);css.setProperty('--visible-top',`${top}px`);css.setProperty('--keyboard-inset',`${Math.max(0,innerHeight-height-top)}px`);};
    update();viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  useEffect(()=>()=>{request.current++;readerRef.current?.abort();},[tool,view]);
  useEffect(()=>{if(tool)inlineHeading.current?.focus({preventScroll:true});},[tool]);
  function toggleAutoSave(enabled){
    autoSaveRef.current=enabled;setAutoSave(enabled);
    try{localStorage.setItem(KEY+'-autosave',enabled?'on':'off');}catch{setNotice('자동 저장 설정을 저장하지 못했어요. 다시 시도해 주세요.');}
  }
  function commit(patch,editGroup=null){
    const previous=documentRef.current,next={...previous,...patch};setHasDraft(true);completionRef.current=null;if(view==='result')setView('editor');
    const now=Date.now();
    if(!editGroup||lastEdit.current?.key!==editGroup||now-lastEdit.current.time>1200)setPast(p=>[...p.slice(-29),previous]);
    lastEdit.current=editGroup?{key:editGroup,time:now}:null;
    documentRef.current=next;setDoc(next);setFuture([]);
  }
  function edit(id,value){const current=documentRef.current;const before=current.sources[id]||'';const source=!value?'':before.startsWith('OCR')?'OCR · 수정':before.startsWith('영화 검색')?'영화 검색 · 수정':'직접 입력';commit({fields:{...current.fields,[id]:value},sources:{...current.sources,[id]:source}},'field:'+id);}
  function style(key,value){commit({design:{...documentRef.current.design,[key]:value}},typeof value==='number'?'style:'+key:null);}
  function setVisibility(id){const native=NATIVE[id]||id;if(native==='title')return;commit({hidden:{...documentRef.current.hidden,[native]:!documentRef.current.hidden[native]}});}
  function applyImport(values,source){const current=documentRef.current;commit({fields:{...current.fields,...values},sources:{...current.sources,...Object.fromEntries(Object.keys(values).map(k=>[k,values[k]?source:'']))}});close();}
  function undo(){const previous=past.at(-1);if(!previous)return;setFuture(f=>[...f,documentRef.current]);setPast(p=>p.slice(0,-1));documentRef.current=previous;setDoc(previous);lastEdit.current=null;}
  function redo(){const next=future.at(-1);if(!next)return;setPast(p=>[...p,documentRef.current]);setFuture(f=>f.slice(0,-1));documentRef.current=next;setDoc(next);lastEdit.current=null;}
  function open(next){
    lastEdit.current=null;setNotice('');
    if(next==='저장 및 공유'&&completionRef.current!==documentRef.current)return;
    if(next==='정보'){if(tool==='정보')dismissTool();else selectField(activeField||GROUPS[group].find(([id])=>available.some(f=>f.id===id))[0]);return;}
    if(INLINE_TOOLS.includes(next)){
      if(tool===next){dismissTool();return;}
      setTool(next);if(next==='정보'){if(!activeField)setActiveField('title');}else setActiveField(null);
      const state={filmeView:'editor',filmeV2Tool:next};
      if(history.state?.filmeV2Tool||history.state?.filmeField)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
      return;
    }
    setPanel(next);setPhase('idle');setCrop(null);if(next==='미리보기')setZoom(false);
    const state={filmeView:view,filmeV2Panel:next,filmeV2Tool:tool,filmeField:tool==='정보'?activeField:null};
    if(tool!=='정보')setActiveField(null);
    if(history.state?.filmeV2Panel&&!(panel==='미리보기'&&next==='저장 및 공유'))history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
  }
  function close(){request.current++;readerRef.current?.abort();if(history.state?.filmeV2Panel)history.back();else setPanel(null);setCrop(null);}
  function dismissTool(){document.activeElement?.blur();setTool(null);setActiveField(null);document.querySelector(`.tool-grid button[data-tool="${tool}"]`)?.focus({preventScroll:true});if(history.state?.filmeV2Tool&&!history.state?.filmeV2Panel)history.back();}
  function selectField(id, focus=false){
    const field=available.find(f=>f.id===id);if(!field)return;
    const nextGroup=Object.entries(GROUPS).find(([,items])=>items.some(([key])=>key===id))?.[0]||'영화';
    focusRequested.current=focus;setGroup(nextGroup);setActiveField(id);setTool('정보');lastEdit.current=null;
    const state={filmeView:'editor',filmeV2Tool:'정보',filmeField:id};
    if(history.state?.filmeV2Tool)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href);
    if(focus&&activeField===id&&tool==='정보')document.getElementById(id)?.focus({preventScroll:true});
  }
  function editTicket(nativeId){
    if(nativeId==='chain'||nativeId==='format'){setLogoTab(nativeId);if(tool!=='로고')open('로고');return;}
    const field=available.find(f=>f.nativeId===nativeId);if(field)selectField(field.id,true);
  }
  useEffect(()=>{
    if(tool!=='정보')return;
    document.getElementById(activeField)?.closest('.field')?.scrollIntoView({block:'nearest',behavior:'instant'});
    if(focusRequested.current){document.getElementById(activeField)?.focus({preventScroll:true});focusRequested.current=false;}
  },[activeField,tool,keyboardOpen]);
  function chooseFile(target){uploadTarget.current=target;uploadInput.current?.click();}
  function readImage(file){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setNotice('5MB 이하의 JPG·PNG·WebP 이미지를 선택해 주세요.');return;}
    const version=++request.current,target=uploadTarget.current;readerRef.current?.abort();
    const reader=new FileReader();readerRef.current=reader;
    reader.onerror=()=>{if(version===request.current)setNotice('이미지를 읽지 못했어요. 다시 선택해 주세요.');};
    reader.onload=async()=>{const image=new Image();image.src=String(reader.result);try{await image.decode();}catch{if(version===request.current)setNotice('열 수 없는 이미지예요. 다른 이미지를 선택해 주세요.');return;}if(version!==request.current)return;if(target==='poster')open('이미지 자르기');setCrop({src:image.src,target});setNotice('');};
    reader.readAsDataURL(file);
  }
  function applyCrop(src){const target=crop.target;const current=documentRef.current.design;commit({design:{...current,...(target==='poster'?{poster:true,posterSource:src}:{[target+'Image']:src,...(target==='signature'?{}:{[target+'Visible']:true})})}});if(panel==='이미지 자르기')close();else setCrop(null);}
  function beginCrop(target){const src=target==='poster'?poster:design[target+'Image'];if(src){if(target==='poster')open('이미지 자르기');setCrop({src,target});}}
  function enterEditor(mood, resume=false){
    if(!resume){commit({fields:Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,''])),design:{...DEFAULT,mood:mood||'minimal',poster:false},sources:{},hidden:{}});setPast([]);setFuture([]);}
    setView('editor');setPanel(null);setTool(null);setActiveField(null);setHasDraft(true);
    history.pushState({filmeView:'editor'},'',location.href);
  }
  function finishEditing(){
    const invalid=!fields.title.trim()?'title':fields.runtime!==''&&(!Number.isInteger(Number(fields.runtime))||Number(fields.runtime)<0)?'runtime':fields.rating!==''&&(!Number.isFinite(Number(fields.rating))||Number(fields.rating)<0||Number(fields.rating)>5||!Number.isInteger(Number(fields.rating)*2))?'rating':null;
    if(invalid){editTicket(invalid);setNotice(invalid==='title'?'영화명을 입력해 주세요.':'입력한 숫자를 확인해 주세요.');return;}
    completionRef.current=documentRef.current;document.activeElement?.blur();setView('result');setTool(null);setActiveField(null);setNotice('');
    if(history.state?.filmeV2Tool||history.state?.filmeField)history.replaceState({filmeView:'result'},'',location.href);else history.pushState({filmeView:'result'},'',location.href);
  }
  function resumeEditing(){setView('editor');setNotice('');history.replaceState({filmeView:'editor'},'',location.href);}
  function goHome(){setView('landing');setPanel(null);setTool(null);setActiveField(null);history.pushState({filmeView:'landing'},'',location.href);}
  function importPanel(tab){setImportTab(tab);open('가져오기');}
  function simulate(){setPhase('loading');clearTimeout(timer.current);timer.current=setTimeout(()=>setPhase(importTab==='영화 검색'&&query.trim()==='없음'?'empty':'success'),450);}
  const currentField=available.find(f=>f.id===activeField);
  const ticket=<LiveTicket fields={fields} design={design} poster={poster} hidden={hidden}/>;
  const logoLabel=logoTab==='chain'?'극장':'포맷';
  const intensityKey=textureTab==='소재'?'materialIntensity':'coatingIntensity';
  function fontPicker(id){return <label className="select-field">{id==='signature'?'이름 서체':'한 줄 기록 서체'}<select aria-label={id==='signature'?'이름 서체':'한 줄 기록 서체'} value={design[id+'Font']} onChange={e=>style(id+'Font',e.target.value)}>{FONTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>;}
  return <>
    {view==='landing'?<Landing onStart={mood=>{if(hasDraft){setPendingMood(mood);open('새 티켓');}else enterEditor(mood);}} onResume={()=>enterEditor(null,true)} hasDraft={hasDraft} resumeTitle={fields.title}/>:<main className={`workspace ${view==='result'?'is-result':''} ${tool?'has-tool':''} ${activeField?'editing-field':''} ${keyboardOpen?'is-keyboard':''}`} onClickCapture={e=>{const b=e.target.closest('button');if(b)opener.current=b;}}>
      <header className="topbar">{view==='result'?<><Action icon="back" aria-label="다시 편집" onClick={resumeEditing}/><h1 className="result-heading"><Icon name="check"/>티켓 완성</h1><Action aria-label="서비스 메뉴" onClick={()=>open('메뉴')}><span className="more-dots">···</span></Action></>:<><Action icon="back" aria-label="랜딩으로 돌아가기" onClick={goHome}/><h1 className="sr-only">티켓 편집</h1><Action className="import-control" icon="scan" aria-label="정보 가져오기" onClick={()=>importPanel(group==='관람'?'OCR':'영화 검색')}>정보 채우기</Action><div className="editor-header-actions"><Action className="menu-control" aria-label="서비스 메뉴" onClick={()=>open('메뉴')}><span className="more-dots">···</span></Action><Button className="done-button" onClick={finishEditing}>완료<Icon name="check"/></Button></div></>}</header>
      <section className="stage" aria-label="티켓 작업 영역"><div className="ticket"><LiveTicket fields={fields} design={design} poster={poster} hidden={hidden} focusField={keyboardOpen&&tool==='정보'?(currentField?.nativeId==='reissue'?'releaseDate':currentField?.nativeId):undefined} onField={view==='editor'?editTicket:undefined} onPosterTap={view==='editor'?()=>open('사진'):undefined} activeTarget={view==='editor'?(tool==='정보'?(currentField?.nativeId==='reissue'?'releaseDate':currentField?.nativeId):tool==='사진'?'poster':tool==='로고'?logoTab:null):null}/></div>{view==='editor'&&!design.poster&&!tool&&<Button className="empty-photo-button" variant="outline" onClick={()=>open('사진')}><Icon name="image"/>사진 추가</Button>}<div className="canvas-actions">{view==='editor'&&<Action icon="undo" aria-label="되돌리기" disabled={!past.length} onClick={undo}/>}<Action className="expand-button" icon="expand" aria-label="전체 화면 미리보기" onClick={()=>open('미리보기')}>미리보기</Action>{view==='editor'&&<Action icon="redo" aria-label="다시 실행" disabled={!future.length} onClick={redo}/>}</div></section>
      {view==='editor'&&tool&&<section className={`inline-panel ${tool==='정보'?'info-inspector':''} ${tool==='사진'?'photo-inspector':''} ${tool==='색상'?'color-inspector':''} ${tool==='색상'&&TONE_FIXED_MOODS.has(design.mood)?'color-fixed':''}`} aria-labelledby="inline-heading" onKeyDown={e=>{if(e.key==='Escape'&&!e.nativeEvent.isComposing){e.preventDefault();dismissTool();}}}>
        <div className="inline-header"><h2 className="sr-only" id="inline-heading" ref={inlineHeading} tabIndex={-1}>{tool}</h2>{tool==='정보'&&<div className="info-groups" aria-label="정보 종류">{Object.keys(GROUPS).map(g=><Action key={g} aria-pressed={group===g} onClick={()=>selectField(GROUPS[g].find(([id])=>available.some(f=>f.id===id))[0])}>{g}</Action>)}</div>}{tool==='질감'&&<div className="mini-segments">{['소재','코팅'].map(t=><Button key={t} variant="ghost" aria-pressed={textureTab===t} onClick={()=>setTextureTab(t)}>{t}</Button>)}</div>}{tool==='로고'&&<div className="mini-segments">{[['chain','극장'],['format','포맷']].map(([id,label])=><Button key={id} variant="ghost" aria-pressed={logoTab===id} onClick={()=>setLogoTab(id)}>{label}</Button>)}</div>}<Action icon="close" aria-label="도구 닫기" onClick={dismissTool}/></div>
        <div className="inline-body">
          {tool==='정보'&&<div className="metadata-form">{GROUPS[group].filter(([id])=>available.some(f=>f.id===id)).map(field=>{const id=field[0],index=available.findIndex(f=>f.id===id),next=available[index+1];return <DataField key={id} field={field} value={fields[id]} source={sources[id]||''} hidden={hidden[NATIVE[id]||id]} active={activeField===id} onFocus={()=>{if(activeField!==id)selectField(id);}} onChange={edit} onOptions={()=>{selectField(id);document.activeElement?.blur();open('필드 옵션');history.replaceState({...history.state,filmeField:id},'',location.href);}} hasNext={Boolean(next)} onNext={()=>next&&selectField(next.id,true)}/>;})}</div>}
          {tool==='사진'&&<>{design.poster?<><div className="photo-actions"><Action icon="image" onClick={()=>chooseFile('poster')}>교체</Action><Action icon="expand" onClick={()=>beginCrop('poster')}>자르기</Action><Action icon="close" onClick={()=>style('poster',false)}>제거</Action><Action onClick={()=>commit({design:{...documentRef.current.design,poster:true,posterSource:SAMPLE_POSTER}})}>샘플</Action></div>{POSTER_FILL_MOODS.has(design.mood)&&<div className="choices" role="group" aria-label="사진 배치">{[['원본','전체 보기'],['티켓에 맞춤','영역 채우기']].map(([value,label])=><Button key={value} variant="outline" aria-pressed={design.crop===value} onClick={()=>style('crop',value)}>{label}</Button>)}</div>}<Range label="사진 불투명도" value={design.brightness} onChange={v=>style('brightness',v)}/></>:<div className="photo-empty"><Button variant="outline" onClick={()=>chooseFile('poster')}><Icon name="image"/>사진 선택</Button><Action onClick={()=>commit({design:{...documentRef.current.design,poster:true,posterSource:SAMPLE_POSTER}})}>샘플 사용</Action></div>}</>}
          {tool==='디자인'&&<DesignPresets moods={MOODS} fields={fields} design={design} poster={poster} hidden={hidden} onSelect={id=>style('mood',id)}/>}
          {tool==='색상'&&<><p className="color-target-label">{TONE_FIXED_MOODS.has(design.mood)?'고정 색상 디자인':design.mood==='editorial'?'강조색':'잉크·배경 톤'}</p>{!TONE_FIXED_MOODS.has(design.mood)&&<div className="swatches">{['기본','크림','차콜','오렌지'].map((v,i)=><button key={v} aria-pressed={design.color===v} onClick={()=>style('color',v)}><span className={`swatch swatch-${i}`}>{design.color===v&&<Icon name="check"/>}</span>{v==='오렌지'?'브릭':v}</button>)}<label className="custom-color" data-selected={design.color==='사용자 지정'}><span className="color-picker-symbol" aria-hidden="true"><Icon name="palette"/><span className="custom-color-dot" style={{backgroundColor:design.customColor}}/></span><span>직접 선택</span><span id="custom-color-state" className="sr-only">{design.color==='사용자 지정'?'선택됨':'선택 안 됨'}</span><input aria-describedby="custom-color-state" aria-label="사용자 지정 색상" type="color" value={design.customColor} onChange={e=>commit({design:{...documentRef.current.design,color:'사용자 지정',customColor:e.target.value}})}/></label></div>}<Range label="텍스트·로고 불투명도" value={design.componentOpacity} onChange={v=>style('componentOpacity',v)}/></>}
          {tool==='질감'&&<><div className="texture-presets" role="group" aria-label={textureTab}>{(textureTab==='소재'?['원본','종이','빈티지','신문']:['없음','유광','홀로그램','메탈']).map((v,i)=><button key={v} aria-pressed={(textureTab==='소재'?design.material:design.coating)===v} onClick={()=>style(textureTab==='소재'?'material':'coating',v)}><span aria-hidden="true" className={`texture-sample ${textureTab==='소재'?'material':'coating'}-${i}`}/>{v}</button>)}</div><Range disabled={textureTab==='소재'?design.material==='원본':design.coating==='없음'} label={`${textureTab} 강도`} value={design[intensityKey]} onChange={v=>style(intensityKey,v)}/></>}
          {tool==='로고'&&<><div className="logo-row"><span className="logo-kind">{design[logoTab+'Image']?'이미지':'텍스트'}</span>{design[logoTab+'Image']?<button className="logo-image-edit" aria-label={`${logoLabel} 로고 자르기`} onClick={()=>{open('로고 이미지');beginCrop(logoTab);}}><img src={design[logoTab+'Image']} alt={`${logoLabel} 로고`}/></button>:<Input aria-label={`${logoLabel} 로고 텍스트`} maxLength={24} value={design[logoTab+'Label']} onChange={e=>style(logoTab+'Label',e.target.value)}/>}<Action icon="eye" aria-label={`${logoLabel} 로고 ${design[logoTab+'Visible']?'숨기기':'표시'}`} aria-pressed={design[logoTab+'Visible']} onClick={()=>style(logoTab+'Visible',!design[logoTab+'Visible'])}/><Action className="logo-upload" icon="image" aria-label={`${logoLabel} 로고 이미지 편집`} onClick={()=>{open('로고 이미지');if(!design[logoTab+'Image'])chooseFile(logoTab);}}>{design[logoTab+'Image']?'교체':'업로드'}</Action></div>{logoTab==='format'&&<Choices label="상영 포맷" value={design.formatLabel} options={['IMAX','Dolby Cinema','4DX','SCREENX']} onChange={v=>commit({design:{...documentRef.current.design,formatLabel:v,formatImage:'',formatVisible:true}})}/>}<Range label={`${logoLabel} 로고 크기`} value={Math.round(design[logoTab+'Scale']*100)} min={60} max={130} onChange={v=>style(logoTab+'Scale',v/100)}/></>}
        </div>
      </section>}
      {view==='result'?<div className="result-actions"><Button className="result-share" onClick={()=>open('저장 및 공유')}><Icon name="share"/>저장 및 공유</Button><Action icon="edit" onClick={resumeEditing}>다시 편집</Action></div>:<section className="tools" aria-label="티켓 편집 도구"><div className="tool-grid">{[['정보','edit'],['사진','image'],['디자인','ticket'],['색상','palette'],['질감','layers'],['로고','logo']].map(([label,icon])=><Action key={label} icon={icon} data-tool={label} aria-pressed={tool===label} aria-expanded={INLINE_TOOLS.includes(label)?tool===label:undefined} onClick={()=>open(label)}>{label}</Action>)}</div></section>}
      {notice&&!panel&&<p role="status" className="notice workspace-notice">{notice}</p>}{storageFailed&&<p role="alert" className="storage-error">자동 저장 공간이 부족해요. 이 창을 닫으면 수정 내용이 사라질 수 있어요.</p>}
    </main>}
    <input ref={uploadInput} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" aria-label="이미지 파일" onChange={e=>{readImage(e.target.files?.[0]);e.target.value='';}}/>
    <Dialog open={Boolean(panel)} onOpenChange={v=>!v&&close()}><DialogContent aria-describedby={undefined} onOpenAutoFocus={e=>{if(matchMedia('(pointer: coarse)').matches){e.preventDefault();e.currentTarget.focus({preventScroll:true});}}} className={`panel ${panel==='미리보기'?'fullscreen':''} ${panel==='메뉴'?'service-menu':''} ${['새 티켓','꾸미기 초기화'].includes(panel)?'confirmation-panel':''}`} onCloseAutoFocus={e=>{e.preventDefault();if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}}>
      <div className="panel-header"><DialogTitle>{crop?'이미지 자르기':panel}</DialogTitle>{['가져오기','저장 및 공유'].includes(panel)&&<span className="source-badge">샘플</span>}</div>
      {panel==='미리보기'?<><div className={`fullscreen-stage ${zoom?'zoomed':''}`}><LiveTicket fields={fields} design={design} poster={poster} hidden={hidden} zoom={zoom}/></div><div className="preview-tools"><Action icon="expand" aria-pressed={zoom} onClick={()=>setZoom(z=>!z)}>{zoom?'화면에 맞추기':'확대'}</Action>{view==='result'&&<Button onClick={()=>open('저장 및 공유')}><Icon name="share"/>공유</Button>}</div></>:<div className="panel-body">
        {crop?<PhotoCrop key={crop.src} src={crop.src} onApply={applyCrop} onCancel={()=>panel==='이미지 자르기'?close():setCrop(null)}/>:<>
          {panel==='필드 옵션'&&<>{currentField&&<p className="settings-target">{currentField.label}</p>}{currentField&&currentField.id!=='title'&&<button className="menu-row" aria-pressed={!hidden[currentField.nativeId]} onClick={()=>setVisibility(currentField.id)}><Icon name="eye"/><span>{hidden[currentField.nativeId]?'티켓에 표시':'티켓에서 숨기기'}</span></button>}{currentField&&['signature','quote'].includes(currentField.id)&&fontPicker(currentField.id)}{currentField?.id==='signature'&&<Action icon="image" onClick={()=>open('서명 이미지')}>서명 이미지</Action>}{currentField&&['release','reissue','date'].includes(currentField.id)&&<label className="select-field">날짜 표시<select aria-label="날짜 표시" value={design[currentField.id==='date'?'watchDateFormat':'releaseDateFormat']} onChange={e=>style(currentField.id==='date'?'watchDateFormat':'releaseDateFormat',e.target.value)}><option value="iso">2026-02-14</option><option value="kr-compact">2026.02.14</option><option value="cinema-mono">14 FEB 2026</option><option value="en-long">February 14, 2026</option></select></label>}<button className="menu-row" onClick={()=>{commit({hidden:{}});close();}}><Icon name="eye"/><span>모두 표시</span></button><button className="menu-row" onClick={()=>{commit({hidden:Object.fromEntries(Object.keys(ALL_FIELDS_ON).filter(id=>id!=='title').map(id=>[id,true]))});close();}}><Icon name="type"/><span>영화명만 표시</span></button></>}
          {(panel==='로고 이미지'||panel==='서명 이미지')&&(()=>{const target=panel==='서명 이미지'?'signature':logoTab;return <><div className="logo-preview">{design[target+'Image']?<img src={design[target+'Image']} alt={target==='signature'?'서명 이미지':`${logoLabel} 로고`}/>:<span>{target==='signature'?fields.signature:design[target+'Label']}</span>}</div><div className="inline-actions"><Button variant="outline" onClick={()=>chooseFile(target)}><Icon name="image"/>이미지 업로드</Button><Action disabled={!design[target+'Image']} onClick={()=>beginCrop(target)}>자르기</Action><Action disabled={!design[target+'Image']} onClick={()=>style(target+'Image','')}>제거</Action></div><Range label={target==='signature'?'서명 크기':`${logoLabel} 로고 크기`} min={60} max={130} value={Math.round(design[target+'Scale']*100)} onChange={v=>style(target+'Scale',v/100)}/></>;})()}
          {panel==='가져오기'&&<><div className="segments" role="group" aria-label="가져오기 방식">{['OCR','영화 검색'].map(t=><Button key={t} variant="ghost" aria-pressed={importTab===t} onClick={()=>{setImportTab(t);setPhase('idle');}}>{t}</Button>)}</div>{importTab==='OCR'?<><Button variant="outline" className="upload" disabled={phase==='loading'} onClick={simulate}><Icon name="scan"/>{phase==='loading'?'읽는 중…':'예매 내역 이미지 선택'}</Button>{phase==='success'&&<><dl className="extracted"><dt>관람일</dt><dd>{SAMPLE.date}</dd><dt>극장</dt><dd>{SAMPLE.theater}</dd><dt>좌석</dt><dd>{SAMPLE.seat}</dd></dl><Button onClick={()=>applyImport({date:SAMPLE.date,time:SAMPLE.time,theater:SAMPLE.theater,seat:SAMPLE.seat,screen:SAMPLE.screen},'OCR')}>5개 항목 반영</Button></>}</>:<><form className="search-form" onSubmit={e=>{e.preventDefault();simulate();}}><Input aria-label="영화 검색어" placeholder="영화 제목" value={query} onChange={e=>setQuery(e.target.value)}/><Button aria-label="검색" disabled={phase==='loading'}><Icon name="search"/></Button></form>{['idle','success'].includes(phase)&&<button className="search-result" onClick={()=>applyImport({title:SAMPLE.title,release:SAMPLE.release,original:SAMPLE.original,actors:SAMPLE.actors,runtime:SAMPLE.runtime},'영화 검색')}><Icon name="ticket"/><span>먼 바다<small>2025 · 드라마</small></span><Icon name="plus"/></button>}{phase==='empty'&&<p className="empty-state">검색 결과가 없어요.</p>}{phase==='loading'&&<p role="status">검색 중…</p>}</>}</>}
          {panel==='저장 및 공유'&&<><div className="share-summary">{ticket}<div className="share-copy"><strong>{fields.title||'새 티켓'}</strong><span>JPEG · 고화질</span></div></div><button className="menu-row" onClick={()=>setNotice('목업에서는 파일을 생성하지 않아요.')}><Icon name="download"/><span>이미지 저장</span><Icon name="chevron"/></button><button className="menu-row" onClick={()=>setNotice('실제 서비스에서는 기기의 공유 메뉴가 열려요.')}><Icon name="share"/><span>다른 앱으로 공유</span><Icon name="chevron"/></button></>}
          {panel==='메뉴'&&<><div className="settings-list"><button className="menu-row" onClick={()=>{setPendingMood(null);open('새 티켓');}}><Icon name="plus"/><span>새 티켓</span><Icon name="chevron"/></button><label className="menu-row autosave-row"><Icon name="clock"/><span>자동 저장{!autoSave&&<small>이후 변경은 저장되지 않아요.</small>}</span><input className="autosave-switch" type="checkbox" role="switch" aria-label="자동 저장" checked={autoSave} onChange={e=>toggleAutoSave(e.target.checked)}/></label><button className="menu-row" onClick={()=>open('꾸미기 초기화')}><Icon name="undo"/><span>꾸미기 초기화</span><Icon name="chevron"/></button></div><footer className="menu-footer"><details className="mockup-info"><summary aria-label="목업 안내"><span className="menu-brand"><Wordmark/></span><span>목업 안내</span><Icon name="chevron"/></summary><p className="footnote">티켓 편집·이미지 업로드·자르기·되돌리기는 실제로 동작해요. 검색·OCR·저장·공유는 샘플이에요. 이미지는 외부로 전송하지 않아요.</p><a className="previous-link" href="../filme-mobile-v1/index.html">이전 목업 보기</a></details></footer></>}

          {panel==='새 티켓'&&<><p>새 티켓으로 바꿀까요?</p><p className="confirmation-detail">사진·입력 내용·꾸미기가 초기화돼요.</p><div className="inline-actions"><Button variant="outline" onClick={()=>view==='landing'?close():open('메뉴')}>취소</Button><Button onClick={()=>{commit({fields:Object.fromEntries(Object.keys(SAMPLE).map(k=>[k,''])),design:{...DEFAULT,mood:pendingMood||'minimal',poster:false},sources:{},hidden:{}});setPast([]);setFuture([]);setPanel(null);setTool(null);setActiveField(null);setView('editor');history.replaceState({filmeView:'editor'},'',location.href);}}>새로 만들기</Button></div></>}
          {panel==='꾸미기 초기화'&&<><p>사진과 입력 내용은 유지하고 꾸미기를 초기화할까요?</p><div className="inline-actions"><Button variant="outline" onClick={()=>open('메뉴')}>취소</Button><Button onClick={()=>{commit({design:{...DEFAULT,poster:design.poster,posterSource:design.posterSource},hidden:{}});close();}}>초기화</Button></div></>}
        </>}{notice&&<p role="status" className="notice">{notice}</p>}
      </div>}
    </DialogContent></Dialog>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
