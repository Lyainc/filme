/*
 * Sheet-sized crop control. The host page must load
 * react-image-crop/dist/ReactCrop.css (for this standalone mockup, copy it
 * beside index.html and add <link rel="stylesheet" href="./react-crop.css">).
 * No other CSS is required: the image is capped at 240px and the actions at 44px here.
 */
import React, { useId, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';

const LABELS = {
  cropArea: '자르기 영역',
  nwDragHandle: '왼쪽 위 모서리',
  nDragHandle: '위쪽 모서리',
  neDragHandle: '오른쪽 위 모서리',
  eDragHandle: '오른쪽 모서리',
  seDragHandle: '오른쪽 아래 모서리',
  sDragHandle: '아래쪽 모서리',
  swDragHandle: '왼쪽 아래 모서리',
  wDragHandle: '왼쪽 모서리',
};

const FULL = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

function initialCrop(mode, image, aspect) {
  const ratio = mode === 'original' ? image.naturalWidth / image.naturalHeight
    : mode === 'square' ? 1
      : mode === 'preset' ? aspect : undefined;
  if (!ratio || Math.abs(ratio - image.naturalWidth / image.naturalHeight) < 0.005) return FULL;
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, ratio, image.width, image.height),
    image.width,
    image.height,
  );
}

export function PhotoCrop({ src, aspect, onApply, onCancel }) {
  const preset = Number.isFinite(aspect) && aspect > 0;
  const [mode, setMode] = useState(preset ? 'preset' : 'free');
  const [crop, setCrop] = useState(FULL);
  const [readySrc, setReadySrc] = useState(null);
  const [naturalAspect, setNaturalAspect] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const imageRef = useRef(null);
  const busyRef = useRef(false);
  const modeName = useId();
  const ready = readySrc === src;
  const ratio = mode === 'original' ? naturalAspect
    : mode === 'square' ? 1
      : mode === 'preset' && preset ? aspect : undefined;

  async function handleLoad(event) {
    const image = event.currentTarget;
    try {
      if (image.decode) await image.decode();
      if (imageRef.current !== image || !image.naturalWidth || !image.naturalHeight) return;
      setNaturalAspect(image.naturalWidth / image.naturalHeight);
      setCrop(initialCrop(mode, image, aspect));
      setReadySrc(src);
      setError('');
    } catch {
      if (imageRef.current === image) setError('이미지를 열 수 없어요. 다른 이미지를 선택해 주세요.');
    }
  }

  function chooseMode(next) {
    setMode(next);
    const image = imageRef.current;
    if (ready && image) setCrop(initialCrop(next, image, aspect));
  }

  async function apply() {
    const image = imageRef.current;
    if (busyRef.current || !ready || !image || !crop?.width || !crop?.height) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const x = Math.min(image.naturalWidth - 1, Math.max(0, Math.round(image.naturalWidth * crop.x / 100)));
      const y = Math.min(image.naturalHeight - 1, Math.max(0, Math.round(image.naturalHeight * crop.y / 100)));
      const width = Math.max(1, Math.min(image.naturalWidth - x, Math.round(image.naturalWidth * crop.width / 100)));
      const height = Math.max(1, Math.min(image.naturalHeight - y, Math.round(image.naturalHeight * crop.height / 100)));
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
      await onApply(canvas.toDataURL('image/png'));
    } catch {
      setError('이미지를 자르지 못했어요. 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const modes = [['free', '자유'], ['original', '원본 비율'], ['square', '1:1']];
  if (preset) modes.push(['preset', '티켓 비율']);

  return <section aria-label="사진 자르기" style={{display:'grid', gap:12}}>
    <div role="radiogroup" aria-label="자르기 비율" style={{display:'flex', flexWrap:'wrap', gap:8}}>
      {modes.map(([value, label]) => <label key={value} style={{display:'inline-flex', alignItems:'center', gap:6, minHeight:44, padding:'0 8px'}}>
        <input type="radio" name={modeName} value={value} checked={mode === value} disabled={busy}
          onChange={() => chooseMode(value)} />{label}
      </label>)}
    </div>
    <div style={{textAlign:'center', overflow:'auto', padding:12}}>
      <ReactCrop crop={ready ? crop : undefined} onChange={(_, percentCrop) => setCrop(percentCrop)}
        aspect={ratio} keepSelection disabled={busy || !ready} ariaLabels={LABELS}
        style={{maxHeight:240, maxWidth:'100%'}}>
        <img key={src} ref={imageRef} src={src} alt="자를 이미지" onLoad={handleLoad}
          onError={() => setError('이미지를 불러오지 못했어요. 다른 이미지를 선택해 주세요.')}
          style={{display:'block', maxHeight:240, maxWidth:'100%'}} />
      </ReactCrop>
    </div>
    {error && <p role="alert" style={{margin:0}}>{error}</p>}
    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
      <button type="button" disabled={busy} onClick={onCancel} style={{minHeight:44, padding:'0 16px'}}>취소</button>
      <button type="button" disabled={busy || !ready || !crop?.width || !crop?.height} onClick={apply}
        style={{minHeight:44, padding:'0 16px'}}>{busy ? '처리 중…' : '적용'}</button>
    </div>
  </section>;
}
