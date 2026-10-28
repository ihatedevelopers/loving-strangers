// Each artist room answers in its own medium: words, clay, light and sound.

export function initRooms({ audio }) {
  const once = (el, fn, margin = '-15% 0px') => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: margin });
    io.observe(el);
  };

  // poets: the poem types itself
  document.querySelectorAll('[data-poem]').forEach((el) => {
    const lines = el.dataset.poem.split('|');
    el.setAttribute('aria-label', lines.join(' '));
    once(el, () => {
      const caret = '<span class="caret"></span>';
      let li = 0, ci = 0, out = '';
      const tick = () => {
        if (li >= lines.length) { el.innerHTML = out + caret; return; }
        const line = lines[li];
        if (ci < line.length) { out += line[ci++]; el.innerHTML = out + caret; setTimeout(tick, 38 + Math.random() * 70); }
        else { out += '<br>'; li++; ci = 0; setTimeout(tick, 420); }
      };
      tick();
    });
  });

  // sculptors: push the photo around like soft clay
  document.querySelectorAll('[data-clay]').forEach((el) => {
    const img = el.querySelector('img');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
      const a = 30 + x * 0.4, b = 70 - x * 0.4, c = 30 + y * 0.4, d = 70 - y * 0.4;
      img.style.borderRadius = `${a}% ${b}% ${100 - a}% ${100 - b}% / ${c}% ${100 - c}% ${d}% ${100 - d}%`;
    });
    el.addEventListener('pointerleave', () => { img.style.borderRadius = ''; });
  });

  // photographers: the polaroid develops, then you can take the shot
  document.querySelectorAll('[data-develop]').forEach((el) => {
    once(el, () => setTimeout(() => el.classList.add('is-developed'), 300), '-25% 0px');
    el.querySelector('[data-shutter]')?.addEventListener('click', () => {
      audio.sfx.shutter();
      const f = document.createElement('div');
      f.className = 'flash';
      document.body.appendChild(f);
      f.addEventListener('animationend', () => f.remove());
      el.classList.remove('is-developed');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-developed')));
    });
  });

  // musicians: the record spins and strums when you touch it
  document.querySelectorAll('[data-record]').forEach((el) => {
    let last = 0;
    const on = () => {
      el.classList.add('is-playing');
      if (performance.now() - last > 1800) { last = performance.now(); audio.sfx.strum(); }
    };
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerleave', () => el.classList.remove('is-playing'));
    el.addEventListener('click', () => (el.classList.contains('is-playing') ? el.classList.remove('is-playing') : on()));
  });

  // creator cards flip on tap for touch screens
  document.querySelectorAll('[data-card]').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('is-flipped'));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('is-flipped'); } });
  });
}
