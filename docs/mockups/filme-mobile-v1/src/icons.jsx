import React from 'react';

// One consistent 24px, 1.7px-stroke icon set; decorative to their labelled controls.
const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'm14 6-6 6 6 6',
  chevron: 'm9 6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 5v14M5 12h14',
  search: 'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  image: 'M4 3h16v18H4zM4 16l5-5 4 4 3-3 4 4M8 7h.01',
  scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 9h10M7 13h10M7 17h6',
  edit: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6',
  info: 'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  undo: 'M8 4 3 9l5 5M3 9h11a7 7 0 0 1 0 14',
  redo: 'm16 4 5 5-5 5m5-5H10a7 7 0 0 0 0 14',
  expand: 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6',
  sliders: 'M4 7h5m5 0h6M4 17h10m5 0h1M9 4v6m5 4v6',
  palette: 'M21 12A9 9 0 1 0 12 21h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a2 2 0 0 0 2-1ZM7 9h.01M11 6h.01M16 7h.01',
  layers: 'm3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5',
  type: 'M4 5h16M12 5v15M8 20h8',
  stamp: 'M7 12h10l3 5v3H4v-3l3-5ZM9 12V7a3 3 0 1 1 6 0v5M4 23h16',
  logo: 'm12 3 9 5v8l-9 5-9-5V8l9-5ZM8 9v7m0-7 4 5 4-5v7',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  share: 'M12 15V2m-4 4 4-4 4 4M7 9H4v13h16V9h-3',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  alert: 'M12 8v5m0 4v.01M10 3 1 20h22L14 3h-4Z',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  ticket: 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Zm12 0v2m0 3v2m0 3v4',
};
export function Icon({ name, className = '', ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`icon ${className}`} {...props}><path d={paths[name] || paths.ticket} /></svg>;
}
export function X(props) { return <Icon name="close" {...props} />; }
