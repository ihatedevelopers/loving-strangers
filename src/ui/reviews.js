import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Rows that drift like conveyor belts; scrolling pushes them faster, hovering holds them still.
function initBelts(rowSelector, section, speed) {
  const rows = [...document.querySelectorAll(rowSelector)];
  if (!rows.length) return;
  rows.forEach((row) => {
    // duplicate the items so the belt loops without a seam
    [...row.children].forEach((n) => {
      const c = n.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('tabindex', '-1');
      row.appendChild(c);
    });
  });

  let boost = 0, visible = false;
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onUpdate: (st) => { boost = Math.min(7, Math.abs(st.getVelocity()) / 350); },
    onToggle: (st) => { visible = st.isActive; },
  });
  const state = rows.map((row) => ({ row, x: 0, dir: Number(row.dataset.dir || row.dataset.strip || 1), hold: false, half: 0 }));
  state.forEach((s) => {
    ['pointerenter', 'focusin'].forEach((ev) => s.row.addEventListener(ev, () => { s.hold = true; }));
    ['pointerleave', 'focusout'].forEach((ev) => s.row.addEventListener(ev, () => { s.hold = false; }));
  });
  // one loop = the original items plus the gap that follows the last of them
  const measure = () => state.forEach((s) => { s.half = (s.row.scrollWidth + parseFloat(getComputedStyle(s.row).columnGap || 0)) / 2; });
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  ScrollTrigger.addEventListener('refresh', measure);

  gsap.ticker.add((_, dt) => {
    if (!visible) return;
    boost *= 0.94;
    for (const s of state) {
      const v = (s.hold ? 0.15 : 1) * (speed + boost * 0.12);
      s.x -= s.dir * v * dt;
      if (s.x <= -s.half) s.x += s.half;
      if (s.x > 0) s.x -= s.half;
      s.row.style.transform = `translate3d(${s.x}px,0,0)`;
    }
  });
}

export function initReviews() {
  initBelts('.flow__row', '.reviews', 0.05);
  initBelts('.strip__row', '.life', 0.04);

  // the scores count up the first time you see them
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' }, onUpdate: () => { el.textContent = o.v.toFixed(1); } });
  });
}
