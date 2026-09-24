import React, { useEffect, useRef } from 'react';
import { Icon } from '../../filme-mobile-v1/src/icons';
import { LiveTicket } from './LiveTicket';

const railStyle = { height:150, display:'flex', alignItems:'stretch', gap:8, overflowX:'auto', scrollSnapType:'x proximity', scrollbarWidth:'none', padding:'0 4px' };
const cardStyle = { flex:'0 0 104px', height:150, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, padding:4, border:'2px solid transparent', borderRadius:12, background:'transparent', boxShadow:'none', scrollSnapAlign:'center' };
const thumbStyle = { width:92, height:116, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' };
const navStyle = { position:'absolute', top:16, left:16, right:56, height:44, display:'flex', alignItems:'center', justifyContent:'space-between' };
const arrowStyle = { width:44, height:44, minWidth:44, padding:0, border:0, background:'transparent' };

export function DesignPresets({ moods, fields, design, poster, hidden, onSelect }) {
  const rail = useRef(null);

  useEffect(() => {
    rail.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block:'nearest', inline:'center' });
  }, [design.mood]);

  const scroll = direction => rail.current?.scrollBy({ left:direction * 112, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return <section aria-label="티켓 디자인 목록" style={{ height:150, minHeight:150 }}>
    <div style={navStyle}>
      <button type="button" aria-label="이전 디자인 보기" onClick={() => scroll(-1)} style={arrowStyle}><Icon name="back"/></button>
      <span style={{ fontSize:12, color:'var(--color-muted)', fontVariantNumeric:'tabular-nums' }}>{moods.findIndex(([id]) => id === design.mood) + 1} / {moods.length}</span>
      <button type="button" aria-label="다음 디자인 보기" onClick={() => scroll(1)} style={arrowStyle}><Icon name="chevron"/></button>
    </div>
    <div className="layout-rail" ref={rail} style={railStyle}>
      {moods.map(([id, name]) => <button key={id} type="button" aria-label={name} aria-pressed={design.mood === id} onClick={() => onSelect(id)} style={{ ...cardStyle, borderColor:design.mood === id ? 'var(--color-accent)' : 'transparent', background:design.mood === id ? 'var(--color-accent-soft)' : 'transparent' }}>
        <span aria-hidden="true" style={thumbStyle}>
          <span style={{ width:id === 'editorial' || id === '35mm-landscape' ? 92 : 116 * 960 / 1534, height:id === 'editorial' || id === '35mm-landscape' ? 92 * 960 / 1534 : 116, display:'block', pointerEvents:'none' }}>
            <LiveTicket fields={fields} design={{ ...design, mood:id }} poster={poster} hidden={hidden}/>
          </span>
        </span>
        <span style={{ fontSize:11, lineHeight:'14px', whiteSpace:'nowrap' }}>{name}</span>
      </button>)}
    </div>
  </section>;
}
