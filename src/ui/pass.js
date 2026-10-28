import gsap from 'gsap';

// The boarding pass: drag the stub past the perforation and it tears off, revealing the 5% code.

export function initPass({ audio, toast }) {
  const pass = document.querySelector('[data-pass]');
  if (!pass) return;
  const stub = pass.querySelector('[data-stub]');
  const front = stub.querySelector('.pass__stub-front');
  const vertical = () => window.matchMedia('(max-width: 900px)').matches;
  let torn = false, dragging = false, sx = 0, sy = 0, angle = 0;

  front.style.transformOrigin = vertical() ? '0 0' : '0 100%';

  const tear = () => {
    if (torn) return;
    torn = true;
    audio.sfx.tear();
    pass.classList.add('is-torn');
    const dir = vertical() ? 1 : 1;
    gsap.to(front, {
      rotate: vertical() ? 28 : 38 * dir, x: vertical() ? 60 : 160, y: vertical() ? 420 : 520, opacity: 0,
      duration: 1.3, ease: 'power2.in', onComplete: () => { front.style.visibility = 'hidden'; },
    });
    gsap.from(stub.querySelector('.pass__stub-back > *'), { scale: 0.7, opacity: 0, duration: 0.6, ease: 'back.out(2)', delay: 0.2 });
  };

  stub.addEventListener('pointerdown', (e) => {
    if (torn) return;
    dragging = true; sx = e.clientX; sy = e.clientY;
    stub.setPointerCapture(e.pointerId);
    front.style.transformOrigin = vertical() ? '0 0' : '0 100%';
  });
  stub.addEventListener('pointermove', (e) => {
    if (!dragging || torn) return;
    const d = vertical() ? e.clientY - sy + (e.clientX - sx) * 0.3 : e.clientX - sx + (e.clientY - sy) * 0.5;
    angle = Math.max(0, d) * 0.22;
    gsap.set(front, { rotate: vertical() ? -angle * 0.5 : angle, x: Math.max(0, d) * 0.15 });
    if (angle > 9 && !stub.dataset.creaked) { stub.dataset.creaked = 1; audio.sfx.tear(); }
    if (angle > 24) { dragging = false; tear(); }
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    delete stub.dataset.creaked;
    if (!torn) gsap.to(front, { rotate: 0, x: 0, duration: 0.6, ease: 'elastic.out(1, .4)' });
  };
  stub.addEventListener('pointerup', release);
  stub.addEventListener('pointercancel', release);
  pass.querySelector('[data-tear-btn]').addEventListener('click', tear);

  pass.querySelector('[data-copy]').addEventListener('click', async (e) => {
    const code = e.currentTarget.dataset.copy;
    try { await navigator.clipboard.writeText(code); toast('copied! use it at checkout ✦'); } catch { toast(`your code: ${code}`); }
    pass.querySelector('[data-copied]').textContent = 'copied ✓';
  });
}
