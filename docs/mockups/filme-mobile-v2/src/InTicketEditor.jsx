import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function InTicketEditor({ field, fields, source, onChange, onClose, onHide, onNavigate, hidden, children }) {
  const card = useRef(null);
  const input = useRef(null);
  const [position, setPosition] = useState(null);
  const value = fields[field.id] ?? '';
  const number = Number(value);
  const error = value !== '' && field.type === 'number' && (
    field.id === 'rating'
      ? (!Number.isFinite(number) || number < 0 || number > 5 || !Number.isInteger(number * 2))
      : (!Number.isInteger(number) || number < 0)
  ) ? (field.id === 'rating' ? '0부터 5까지, 0.5 단위로 입력해 주세요.' : '0 이상의 정수로 입력해 주세요.') : '';

  const positioned = Boolean(position);
  useEffect(() => { if (positioned) input.current?.focus({ preventScroll: true }); }, [field.id, positioned]);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const stage = document.querySelector('.stage');
    const measure = () => {
      const anchor = [...(stage?.querySelectorAll('[data-field-tap]') || [])]
        .find(node => node.dataset.fieldTap === field.nativeId && node.getBoundingClientRect().width > 0);
      const rect = anchor?.getBoundingClientRect();
      const leftEdge = viewport?.offsetLeft || 0;
      const topEdge = viewport?.offsetTop || 0;
      const width = Math.min(320, (viewport?.width || innerWidth) - 24);
      const height = card.current?.offsetHeight || 160;
      const left = Math.max(leftEdge + 12, Math.min(rect?.left || leftEdge + 12, leftEdge + (viewport?.width || innerWidth) - width - 12));
      const top = Math.max(topEdge + 8, Math.min(rect?.top || topEdge + 8, topEdge + (viewport?.height || innerHeight) - height - 8));
      setPosition(previous => previous?.left === left && previous?.top === top && previous?.width === width ? previous : { left, top, width });
    };
    measure();
    const observer = stage && new ResizeObserver(measure);
    if (stage) observer.observe(stage);
    if (card.current) observer?.observe(card.current);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [field.nativeId, field.id, value, error, hidden]);

  return <section ref={card} className="in-ticket-editor" style={position || { visibility:'hidden' }} aria-label={`${field.label} 편집`} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  }}>
    <div className="in-ticket-editor-head">
      <div className="in-ticket-editor-heading"><strong>{field.label}</strong>{source && <span className="in-ticket-editor-source">{source}</span>}</div>
      <button type="button" aria-label="닫기" onClick={onClose}>×</button>
    </div>
    <input ref={input} aria-label={field.label} aria-invalid={Boolean(error)} aria-describedby={error ? 'in-ticket-editor-error' : undefined}
      type={field.type || 'text'} value={value} autoComplete="off" maxLength={field.id === 'quote' ? 31 : undefined}
      inputMode={field.type === 'number' ? (field.id === 'rating' ? 'decimal' : 'numeric') : undefined}
      min={field.type === 'number' ? 0 : undefined} max={field.id === 'rating' ? 5 : undefined}
      step={field.type === 'number' ? (field.id === 'rating' ? 0.5 : 1) : undefined}
      onChange={event => onChange(field.id, event.target.value)} />
    {error && <small id="in-ticket-editor-error" role="status">{error}</small>}
    {children}
    <div className="in-ticket-editor-actions">
      {field.id !== 'title' && <button type="button" aria-pressed={Boolean(hidden)} onClick={onHide}>{hidden ? '표시' : '숨기기'}</button>}
      <span />
      <button type="button" aria-label="이전 항목" onClick={() => onNavigate(-1)}>‹</button>
      <button type="button" aria-label="다음 항목" onClick={() => onNavigate(1)}>›</button>
    </div>
  </section>;
}
