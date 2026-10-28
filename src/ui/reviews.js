import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Reviews drift like two conveyor belts; scrolling pushes them faster, hovering holds them still.
export function initReviews() {
  const rows = [...document.querySelectorAll('.flow__row')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  rows.forEach((row) => {
    // duplicate the notes so the belt loops without a seam
    [...row.children].forEach((n) => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.tabIndex = -1; row.appendChild(c); });
  });
  if (reduced) return;

  let boost = 0;
  ScrollTrigger.create({ trigger: '.reviews', start: 'top bottom', end: 'bottom top', onUpdate: (st) => { boost = Math.min(6, Math.abs(st.getVelocity()) / 400); } });
  const state = rows.map((row) => ({ row, x: 0, dir: Number(row.dataset.dir), hold: false, half: 0 }));
  state.forEach((s) => {
    s.row.addEventListener('pointerenter', () => { s.hold = true; });
    s.row.addEventListener('pointerleave', () => { s.hold = false; });
    s.row.addEventListener('focusin', () => { s.hold = true; });
    s.row.addEventListener('focusout', () => { s.hold = false; });
  });
  const measure = () => state.forEach((s) => { s.half = s.row.scrollWidth / 2; });
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);

  let visible = false;
  ScrollTrigger.create({ trigger: '.reviews', start: 'top bottom', end: 'bottom top', onToggle: (st) => { visible = st.isActive; } });
  gsap.ticker.add((_, dt) => {
    if (!visible) return;
    boost *= 0.94;
    for (const s of state) {
      if (s.hold) continue;
      s.x += s.dir * -(0.045 + boost * 0.12) * dt;
      if (s.x <= -s.half) s.x += s.half;
      if (s.x > 0) s.x -= s.half;
      s.row.style.transform = `translate3d(${s.x}px,0,0)`;
    }
  });

  // the scores count up the first time you see them
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' }, onUpdate: () => { el.textContent = o.v.toFixed(1); } });
  });
}
