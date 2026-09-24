import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../filme-mobile-v1/src/ui/button';
import { Wordmark } from '../../../../src/components/v2/Wordmark';
import { LAYOUTS } from '../../../../src/utils/layouts';
import { useMatchMedia } from '../../../../src/hooks/useMatchMedia';

const ASSETS = '../../../public/assets/landing/';
const GALLERY_LAYOUTS = LAYOUTS.filter((layout) => layout.id !== '35mm-landscape');
const HERO_IMAGES = {
  minimal: `${ASSETS}hero-minimal.webp`,
  criterion: `${ASSETS}hero-criterion.webp`,
  '35mm': `${ASSETS}hero-35mm.webp`,
  editorial: `${ASSETS}hero-editorial.webp`,
  stub: `${ASSETS}hero-stub.webp`,
};

// Preserve the production landing's five-card placement and slow transition.
const CAROUSEL_SLOTS = [
  { x: 0, scale: 1, opacity: 1, blur: 0, z: 3 },
  { x: 0.64, scale: 0.78, opacity: 0.5, blur: 1.1, z: 2 },
  { x: 1.1, scale: 0.6, opacity: 0.27, blur: 2.2, z: 1 },
];
const INTERVAL_MS = 10000;
const TRANSITION_MS = 2200;
const CARD_RATIO = 1534 / 960;

function MoodCarousel() {
  const reducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState(170);
  const stage = useRef(null);

  useEffect(() => {
    if (!stage.current) return undefined;
    const measure = () => setWidth(Math.min(215, Math.max(170, Math.floor(stage.current.getBoundingClientRect().height / CARD_RATIO))));
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    measure();
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = setInterval(() => setActive((i) => (i + 1) % GALLERY_LAYOUTS.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const distance = (index) => {
    const n = GALLERY_LAYOUTS.length;
    let d = index - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  const card = (layout, index) => {
    const rotated = layout.id === 'editorial';
    const height = rotated ? width * layout.width / layout.height : width * layout.height / layout.width;
    const d = distance(index);
    const slot = CAROUSEL_SLOTS[Math.min(Math.abs(d), CAROUSEL_SLOTS.length - 1)];
    const style = {
      position: 'absolute', top: '50%', left: '50%', marginLeft: -width / 2,
      marginTop: -height / 2, zIndex: slot.z, opacity: slot.opacity,
      filter: slot.blur ? `blur(${slot.blur}px)` : undefined,
      transform: `translateX(${Math.sign(d) * slot.x * width}px) scale(${slot.scale})`,
      transitionProperty: 'transform, opacity, filter',
      transitionDuration: reducedMotion ? '0ms' : `${TRANSITION_MS}ms`,
      transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
    };
    return <div
      key={layout.id}
      className="landing-card"
      style={style}
    >
      <span className="landing-card-face" style={{ width, height, position: 'relative', overflow: 'hidden' }}>
        <span style={rotated ? {
          position: 'absolute', top: '50%', left: '50%', width: height, height: width,
          transform: 'translate(-50%, -50%) rotate(90deg)',
        } : { display: 'block', width: '100%', height: '100%' }}>
          <img src={HERO_IMAGES[layout.id]} alt="" draggable="false" />
        </span>
      </span>
    </div>;
  };

  return <div className="landing-carousel" ref={stage} aria-hidden="true">
    {GALLERY_LAYOUTS.map(card)}
  </div>;
}

export function Landing({ onStart, onResume, hasDraft = false, resumeTitle = '' }) {
  return <main className="landing-shell">
    <header className="landing-header"><div className="landing-brand"><Wordmark as="h1" /></div></header>
    <section className="landing-gallery" aria-label="티켓 디자인 미리보기">
      <MoodCarousel />
    </section>
    <div className="landing-bottom">
      <Button className="landing-start" onClick={() => onStart('minimal')}>티켓 만들기</Button>
      {hasDraft && <button type="button" className="landing-resume" onClick={onResume}>이어서 편집{resumeTitle ? ` — ${resumeTitle}` : ''}</button>}
      <p className="landing-note">개인 기록용 비공식 티켓 · FILME</p>
    </div>
  </main>;
}
