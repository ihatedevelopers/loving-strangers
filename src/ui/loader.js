import gsap from 'gsap';
import sunPaths from '../sun-paths.txt?raw';

// The logo's sun: an ink outline that fills with yellow from the bottom while the island loads.
function sunSVG() {
  const parts = sunPaths.trim().split('\n');
  const all = parts.join('');
  const core = parts.pop();
  const rays = parts.join('');
  return `<svg class="sun-svg" viewBox="0 0 875.4 875.9" aria-hidden="true">
    <defs><clipPath id="sun-fill"><rect data-fill x="-20" y="900" width="920" height="920"/></clipPath></defs>
    <g class="ghost">${all}</g>
    <g clip-path="url(#sun-fill)"><g class="rays">${rays}</g>${core}</g>
  </svg>`;
}

// Time-based like the portfolio loader: never stalls on a slow device, opens within 6 s at most.
export function initLoader({ ready, onReveal }) {
  const loader = document.querySelector('[data-loader]');
  const num = loader.querySelector('[data-loader-n]');
  loader.querySelector('[data-loader-sun]').innerHTML = sunSVG();
  const fill = loader.querySelector('[data-fill]');

  let isReady = false;
  ready.then(() => { isReady = true; });
  const t0 = performance.now();
  let last = t0, p = 0, done = false;

  const tick = () => {
    const now = performance.now();
    const dt = Math.min(0.5, (now - last) / 1000);
    const elapsed = now - t0;
    last = now;
    const target = isReady && elapsed > 900 ? 100 : Math.min(88, elapsed / 30);
    p += (target - p) * Math.min(1, dt * 7);
    const shown = elapsed > 6000 ? 100 : Math.min(100, Math.round(p + 0.4));
    num.textContent = shown;
    fill.setAttribute('y', 900 - shown * 9.2);
    if (shown >= 100) reveal();
    else setTimeout(tick, 16);
  };

  const reveal = () => {
    if (done) return;
    done = true;
    onReveal();
    const tl = gsap.timeline({ onComplete: () => { loader.remove(); } });
    tl.to(loader.querySelector('.loader__sun'), { y: -220, rotate: 40, opacity: 0, duration: 0.9, ease: 'power3.in' })
      .to('.loader__n, .loader__t', { opacity: 0, duration: 0.4 }, 0)
      .to(loader, { yPercent: -100, duration: 1.1, ease: 'power4.inOut' }, 0.5)
      .fromTo('.hero__video', { scale: 1.25 }, { scale: 1, duration: 2.2, ease: 'power3.out', clearProps: 'transform' }, 0.6)
      .fromTo('.hero__title .w > *', { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'power4.out', stagger: 0.1 }, 0.95)
      .fromTo('.hero__eyebrow, .hero__sub, .hero__actions > *, .hero__cue', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.08 }, 1.3);
  };
  tick();
}

// The record button in the hero: the song is the way in.
export function initPlayButton({ audio, toast }) {
  const btn = document.querySelector('[data-play]');
  const label = btn.querySelector('[data-play-label]');
  const sub = btn.querySelector('[data-play-sub]');
  ['pointerenter', 'pointerdown', 'focus'].forEach((ev) => btn.addEventListener(ev, () => audio.prime(), { once: true }));
  btn.addEventListener('click', async () => {
    if (audio.on) { audio.pause(); return; }
    label.textContent = 'tuning in…';
    const ok = await audio.play();
    if (!ok) {
      label.textContent = 'start the journey';
      toast('the browser blocked the music: tap the record again');
    }
  });
  audio.onChange((on) => {
    btn.classList.toggle('is-playing', on);
    label.textContent = on ? 'now playing' : 'start the journey';
    sub.textContent = on ? 'Loving Strangers · tap to pause' : 'with our song · Jocelyn Pook, Loving Strangers';
  });
}
