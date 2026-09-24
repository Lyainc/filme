import React, { memo, useLayoutEffect, useRef, useState } from 'react';
import { MoodMinimal } from '../../../../src/components/moods/MoodMinimal';
import { MoodCriterion } from '../../../../src/components/moods/MoodCriterion';
import { Mood35mm } from '../../../../src/components/moods/Mood35mm';
import { MoodEditorial } from '../../../../src/components/moods/MoodEditorial';
import { MoodStub } from '../../../../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../../../../src/components/moods/Mood35mmLandscape';
import { INITIAL_STATE } from '../../../../src/hooks/usePhototicket';
import { ALL_FIELDS_ON } from '../../../../src/constants/fieldVisibility';
import { getLayout } from '../../../../src/utils/layouts';
import { defaultIntensityForTexture } from '../../../../src/utils/textureRecipes';

const MOODS = { minimal:MoodMinimal, criterion:MoodCriterion, '35mm':Mood35mm, editorial:MoodEditorial, stub:MoodStub, '35mm-landscape':Mood35mmLandscape };
const COLORS = { '기본':'#FFFFFF', '크림':'#F4E8D6', '차콜':'#393737', '오렌지':'#B0423F' };
const FONTS = { '기본':'auto', Pretendard:'gothic', '경기천년바탕':'batang', '잉크립퀴드':'ink' };
const FONT_VALUES = new Set(['auto', 'gothic', 'batang', 'hand', 'ink', 'eunyoung', 'brush', 'coolguy', 'flower']);
const MATERIALS = { '원본':'original', '종이':'artpaper', '빈티지':'vintage', '신문':'newspaper' };
const COATINGS = { '없음':'none', '유광':'gloss', '홀로그램':'hologram', '메탈':'metal' };
export const FIELD_IDS = {
  title:'title', titleOg:'original', actors:'actors', releaseDate:'release', reissue:'reissue',
  watchDate:'date', watchTime:'time', theater:'theater', screen:'screen', seat:'seat',
  runtime:'runtime', rating:'rating', bookingNo:'booking', signature:'signature', quote:'quote',
  chain:'chain', format:'format',
};
const percent = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : fallback;
const logoScale = (value) => Number.isFinite(value) ? Math.max(0.6, Math.min(1.3, value)) : 1;
export const SAMPLE_POSTER = '../../../public/assets/posters/sample-pier.jpg';

export const LiveTicket = memo(function LiveTicket({ fields, design, poster, zoom = false, onField, onPosterTap, hidden = {}, focusField, activeTarget }) {
  const host = useRef(null);
  const natural = useRef(null);
  const [focusOffset,setFocusOffset]=useState(0);
  const [targetRect,setTargetRect]=useState(null);
  const [size, setSize] = useState({ width:0, height:0 });
  const layout = getLayout(design.mood);
  const Mood = MOODS[layout.id];
  useLayoutEffect(() => {
    const update = () => {
      const { width, height } = host.current.getBoundingClientRect();
      setSize(s => s.width === width && s.height === height ? s : { width, height });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const fit = focusField ? size.width / layout.width : Math.min(size.width / layout.width, size.height / layout.height);
  const scale = fit * (zoom ? 2 : 1);
  useLayoutEffect(()=>{
    if(!focusField||!natural.current||!scale)return;
    const anchor=natural.current.querySelector(`[data-field-tap="${focusField}"]`);
    if(!anchor){setFocusOffset(0);return;}
    const rect=anchor.getBoundingClientRect(),frame=natural.current.getBoundingClientRect();
    const centered=size.height/2-(rect.top-frame.top+rect.height/2);
    setFocusOffset(Math.min(0,Math.max(size.height-layout.height*scale,centered)));
  },[focusField,fields,design,scale,size.height,layout.height]);
  useLayoutEffect(()=>{
    if(!activeTarget||!natural.current||!scale){setTargetRect(null);return;}
    let cancelled=false;
    const measure=()=>{
      if(cancelled)return;
      const anchor=natural.current?.querySelector(activeTarget==='poster'?'[data-poster-tap]':`[data-field-tap="${activeTarget}"]`);
      if(!anchor){setTargetRect(null);return;}
      const rect=anchor.getBoundingClientRect(),frame=natural.current.getBoundingClientRect();
      setTargetRect({left:rect.left-frame.left-2,top:rect.top-frame.top-2,width:rect.width+4,height:rect.height+4});
    };
    measure();document.fonts.ready.then(measure);
    const observer=new ResizeObserver(measure);observer.observe(natural.current);
    return()=>{cancelled=true;observer.disconnect();};
  },[activeTarget,fields,design,hidden,scale]);
  const material = MATERIALS[design.material] || design.material || 'original';
  const coating = COATINGS[design.coating] || design.coating || 'none';
  const oldFont = FONTS[design.font] || 'auto';
  const color = design.color === '사용자 지정' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(design.customColor || '')
    ? design.customColor : COLORS[design.color] || COLORS['기본'];
  const components = {
    ...INITIAL_STATE.components, layout:layout.id,
    themeColor:color,
    material, coating,
    materialIntensity:percent(design.materialIntensity, defaultIntensityForTexture(material)),
    coatingIntensity:percent(design.coatingIntensity, defaultIntensityForTexture(coating)),
    posterOpacity:percent(design.brightness, 1),
    componentOpacity:percent(design.componentOpacity, 1),
    posterFit:design.crop === '티켓에 맞춤' ? 'cover' : 'contain',
    quoteFont:FONT_VALUES.has(design.quoteFont) ? design.quoteFont : oldFont,
    signatureFont:FONT_VALUES.has(design.signatureFont) ? design.signatureFont : oldFont,
    chain:design.chainImage || '', format:design.formatImage || '', signatureImage:design.signatureImage || '',
    chainLabel:design.chainLabel ?? fields.theater ?? '', formatLabel:design.formatLabel ?? 'IMAX',
    chainVisible:design.chainVisible ?? true, formatVisible:design.formatVisible ?? true,
    chainScale:logoScale(design.chainScale), formatScale:logoScale(design.formatScale), signatureScale:logoScale(design.signatureScale),
  };
  const rating = Number(fields.rating);
  const runtime = Number(fields.runtime);
  const movieInfo = {
    ...INITIAL_STATE.movieInfo, title:fields.title, titleOg:fields.original, actors:fields.actors,
    releaseDate:fields.release, releaseDateFormat:design.releaseDateFormat || 'kr-compact',
    releaseDateGranularity:design.releaseDateGranularity || (fields.release?.length === 4 ? 'year' : fields.release?.length === 7 ? 'year-month' : 'date'),
    reissueDate:fields.reissue || '', isReissue:!!fields.reissue,
    watchDate:fields.date, watchDateFormat:design.watchDateFormat || 'kr-compact', watchTime:fields.time,
    theater:fields.theater, screen:fields.screen, seat:fields.seat,
    runtime:fields.runtime !== '' && Number.isInteger(runtime) && runtime >= 0 ? String(runtime) : '',
    rating:Number.isFinite(rating) && rating >= 0 && rating <= 5 && Number.isInteger(rating * 2) ? rating : 0,
    bookingNumber:fields.booking, signature:fields.signature, quote:fields.quote,
  };
  const fieldVisibility = { ...ALL_FIELDS_ON };
  for (const field of Object.keys(ALL_FIELDS_ON)) if (hidden[field] != null) fieldVisibility[field] = !hidden[field];
  return <div className={`live-ticket ${zoom ? 'is-zoomed' : ''} ${focusField?'field-focused':''}`} ref={host} data-layout={layout.id}>
    <div className="ticket-paper" style={{ width:layout.width * scale, height:layout.height * scale, transform:focusField?`translateY(${focusOffset}px)`:undefined }}>
      <div ref={natural} className="ticket-natural" data-ticket-natural style={{ width:layout.width, height:layout.height, transform:`scale(${scale})` }}>
        <Mood movieInfo={movieInfo} components={components} croppedImageUrl={design.poster ? poster : null}
          fieldVisibility={fieldVisibility} ghost={Boolean(onField)} onField={onField}
          onPosterTap={onPosterTap}/>
      </div>
      {targetRect&&<div className="edit-target" aria-hidden="true" style={targetRect}/>}
    </div>
  </div>;
});
