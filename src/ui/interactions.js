import gsap from 'gsap';

// The mouse is felt everywhere: cards lean toward it, buttons pull to it, the cursor says what a click will do.
export function initInteractions({ audio }) {
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (!fine) return;

  // cards and photos tilt toward the cursor (through GSAP so they combine with scroll animations)
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 9);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 9);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  // buttons pull toward the cursor, then spring back
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.28);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .35)', overwrite: 'auto' });
    });
  });

  // a little label rides next to the cursor: "book", "tear", "play"…
  const label = document.querySelector('[data-cursor-label]');
  let lx = -100, ly = -100, tx = -100, ty = -100, current = null;
  addEventListener('pointermove', (e) => { tx = e.clientX + 18; ty = e.clientY + 16; }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-cursor]');
    if (t === current) return;
    current = t;
    label.textContent = t?.dataset.cursor || '';
    label.classList.toggle('is-on', !!t);
    if (t && audio.on) audio.sfx.blip();
  });
  gsap.ticker.add(() => {
    lx += (tx - lx) * 0.25;
    ly += (ty - ly) * 0.25;
    label.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
  });
}
