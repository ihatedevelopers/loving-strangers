import './dev-drive.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createAudio } from './ui/audio.js';
import { initIntro } from './ui/intro.js';
import { initCats } from './ui/cats.js';
import { initRooms } from './ui/rooms.js';
import { initPass } from './ui/pass.js';
import { initNav } from './ui/nav.js';
import { initReviews } from './ui/reviews.js';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger });
if (import.meta.env.DEV) queueMicrotask(() => { window.__lenis = lenis; });

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;

const lenis = new Lenis({ lerp: reduced ? 1 : 0.1, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
// sections change height in JS (the horizontal track), so re-measure Lenis whenever ScrollTrigger does
ScrollTrigger.addEventListener('refresh', () => lenis.resize());
gsap.ticker.add((t) => lenis.raf(t * 1000));
lenis.stop();
window.scrollTo(0, 0);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const audio = createAudio();
const toast = (msg) => {
  const el = document.querySelector('[data-toast]');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-on'), 2600);
};

// The 3D island is loaded on its own so the intro paints instantly.
let world = null;
const worldReady = import('./world/world.js')
  .then(async ({ createWorld }) => {
    // probe on a throwaway canvas so three.js still chooses the real context's settings
    if (!document.createElement('canvas').getContext('webgl2')) throw new Error('no webgl2');
    const canvas = document.getElementById('world');
    world = await createWorld(canvas, { mobile });
    if (import.meta.env.DEV) window.__world = world;
    // nothing to draw behind the intro card yet
    if (document.body.classList.contains('is-intro')) world.setActive(false);
    return world;
  })
  .catch((err) => {
    console.warn('world unavailable, using the photo fallback', err);
    document.documentElement.classList.add('no-webgl');
    return null;
  });

initNav({ lenis, audio });
const cats = initCats({ audio, mobile });
initRooms({ audio });
initPass({ audio, toast });
initReviews();

initIntro({
  audio,
  toast,
  onStart() {
    document.body.classList.remove('is-intro');
    lenis.start();
    cats?.wake();
    world?.setActive(true);
    ScrollTrigger.refresh();
  },
});

// the journey never waits for the 3D world: it starts now and the world joins when ready
import('./journey.js').then(({ initJourney }) => {
  const journey = initJourney({ mobile, reduced });
  worldReady.then((w) => journey.attach(w));
});

// videos play only while you can see them
const vio = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting) {
      if (v.preload !== 'auto') v.preload = 'auto';
      v.play().catch(() => {});
    } else v.pause();
  }
}, { rootMargin: '200px 0px' });
document.querySelectorAll('[data-lazy-video]').forEach((v) => vio.observe(v));

// the postcard illustration is the heaviest image: fetch it only on the way down
const card = document.querySelector('.postcard');
const cio = new IntersectionObserver(([e]) => { if (e.isIntersecting) { card.classList.add('is-near'); cio.disconnect(); } }, { rootMargin: '1500px 0px' });
cio.observe(card);

window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
