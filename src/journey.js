import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CatmullRomCurve3, Vector3 } from 'three';

// Scroll is the camera. Each chapter of the page owns a stretch of the flight.

const V = (x, y, z) => new Vector3(x, y, z);
const path = (pts) => new CatmullRomCurve3(pts, false, 'centripetal');
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
// piecewise-linear through evenly spaced keys
const keys = (arr, t) => {
  const x = clamp01(t) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(x));
  return lerp(arr[i], arr[i + 1], x - i);
};

// 1 · the ferry from Faial, then the harbour, then the mountain
const ARRIVAL = {
  pos: path([V(-4300, 34, 520), V(-3400, 60, 320), V(-2500, 92, 170), V(-2420, 150, 210), V(-2250, 105, 150)]),
  look: path([V(0, 330, 0), V(0, 350, 0), V(-1890, 10, 40), V(-700, 310, 0), V(-900, 270, 0)]),
  fov: [28, 34, 40, 40, 44],
  tod: [0, 0.5, 0.9, 1, 1.1],
};

// 2 · the climb: sea level to the summit, morning to golden hour
const CLIMB = {
  pos: path([V(-2650, 26, -150), V(-2230, 22, -470), V(-1560, 95, -720), V(-1050, 270, -520), V(-520, 430, -300), V(-60, 652, 30)]),
  look: path([V(-4200, 40, 400), V(-1950, 0, -820), V(-1200, 30, -480), V(0, 470, 0), V(0, 640, 0), V(-3200, 470, 420)]),
  fov: [42, 46, 48, 46, 50, 52],
  tod: [1.15, 1.3, 1.5, 1.75, 2.1, 2.55],
  alt: [0, 0, 40, 400, 1200, 2351],
};

// The journey starts right away; the 3D world plugs in whenever it is ready (or never, on old devices).
export function initJourney({ mobile, reduced }) {
  let world = null;
  const pin = document.querySelector('.world-pin');
  const pinPos = { x: 0, y: 0, visible: false };
  let pinOn = false;
  const canvas = document.getElementById('world');

  const setView = (pos, look, fov, tod, night = 0) => {
    if (!world) return;
    world.goal.pos.copy(pos);
    world.goal.look.copy(look);
    world.goal.fov = mobile ? fov + 14 : fov;
    world.goal.tod = tod;
    world.goal.night = night;
  };

  // ---------- arrival ----------
  const lines = gsap.utils.toArray('.arrival [data-line]');
  const hud = document.querySelector('[data-hud-dist]');
  const show = (el, a, b, t) => {
    // fade in over [a, a+.06], hold, fade out over [b-.06, b]
    const o = b >= 1 ? clamp01((t - a) / 0.06) : Math.min(clamp01((t - a) / 0.06), clamp01((b - t) / 0.06));
    el.style.opacity = o;
    el.style.transform = `translateY(${(1 - o) * 26}px)`;
    el.style.filter = o < 1 ? `blur(${(1 - o) * 6}px)` : '';
    // invisible text must not catch clicks or keyboard focus
    el.style.visibility = o > 0.02 ? 'visible' : 'hidden';
  };
  ScrollTrigger.create({
    trigger: '.arrival',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate(st) {
      const t = st.progress;
      show(lines[0], -0.1, 0.2, t);
      show(lines[1], 0.2, 0.38, t);
      show(lines[2], 0.4, 0.6, t);
      show(lines[3], 0.64, 1, t);
      pinOn = t > 0.42 && t < 0.62;
      if (!pinOn) pin.classList.remove('is-on');
      hud.textContent = Math.max(0, 9.8 * (1 - t / 0.6)).toFixed(1);
      setView(ARRIVAL.pos.getPoint(t), ARRIVAL.look.getPoint(t), keys(ARRIVAL.fov, t), keys(ARRIVAL.tod, t));
    },
  });

  // the paper house slides over the island: stop drawing while it covers the screen
  const houseST = ScrollTrigger.create({
    trigger: '.house',
    start: 'top top',
    end: 'bottom bottom',
    onToggle: (st) => world?.setActive(!st.isActive),
  });

  // ---------- the places in between: horizontal track ----------
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    // a tall section with a sticky stage: no GSAP pin, so nothing below it has to be re-measured
    const places = document.querySelector('[data-places]');
    const track = document.querySelector('[data-track]');
    const dist = () => track.scrollWidth - innerWidth + 80;
    const size = () => { places.style.height = `${dist() + innerHeight}px`; };
    size();
    ScrollTrigger.addEventListener('refreshInit', size);
    const st = { trigger: places, start: 'top top', end: 'bottom bottom', invalidateOnRefresh: true };
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { ...st, scrub: reduced ? true : 0.8 } });
    gsap.utils.toArray('.place__ink').forEach((ink) => {
      gsap.fromTo(ink, { rotate: -24, scale: 0.6 }, { rotate: 6, scale: 1, ease: 'none', scrollTrigger: { ...st, scrub: true } });
    });
    return () => { ScrollTrigger.removeEventListener('refreshInit', size); places.style.height = ''; };
  });

  // dinners: the photos fan out like a hand of cards
  const stack = gsap.utils.toArray('[data-stack] img');
  gsap.timeline({ scrollTrigger: { trigger: '[data-stack]', start: 'top 85%', end: 'bottom 35%', scrub: 0.6 } })
    .fromTo(stack, { rotate: 0, x: 0, y: 0 }, {
      rotate: (i) => [-9, 4, -2, 8][i], x: (i) => [-60, 40, -10, 70][i] * (mobile ? 0.4 : 1), y: (i) => [20, -30, 40, -10][i], ease: 'none',
    });

  // ---------- pico: the climb ----------
  // the stop photos sit in hidden cards, where lazy images never start: fetch them on approach
  ScrollTrigger.create({
    trigger: '.pico', start: 'top 600%', once: true,
    onEnter: () => document.querySelectorAll('.stop img').forEach((img) => { img.loading = 'eager'; }),
  });
  const stops = gsap.utils.toArray('.stop');
  const altEl = document.querySelector('[data-alt]');
  const altFill = document.querySelector('[data-alt-fill]');
  const picoHead = document.querySelector('.pico__head');
  let current = -1;
  const showStop = (i) => {
    if (i === current) return;
    const prev = stops[current];
    current = i;
    world?.setWhale(i === 0);
    if (prev) gsap.to(prev, { autoAlpha: 0, y: -30, rotate: 1, duration: 0.45, ease: 'power2.in', overwrite: true });
    gsap.fromTo(stops[i], { autoAlpha: 0, y: 50, rotate: -2 }, { autoAlpha: 1, y: 0, rotate: -1, duration: 0.8, delay: prev ? 0.25 : 0, ease: 'back.out(1.4)', overwrite: true });
  };
  ScrollTrigger.create({
    trigger: '.pico',
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate(st) {
      // the first screen of the section is the island fading back in
      const enter = clamp01(st.progress * 7);
      const t = clamp01((st.progress * 7 - 1) / 6);
      if (enter < 1) {
        setView(CLIMB.pos.getPoint(0), CLIMB.look.getPoint(0), CLIMB.fov[0], CLIMB.tod[0]);
      } else {
        setView(CLIMB.pos.getPoint(t), CLIMB.look.getPoint(t), keys(CLIMB.fov, t), keys(CLIMB.tod, t));
      }
      const alt = Math.round(keys(CLIMB.alt, t));
      altEl.textContent = alt;
      altFill.style.height = `${(alt / 2351) * 100}%`;
      if (enter >= 1) showStop(Math.min(stops.length - 1, Math.floor(t * stops.length * 0.999)));
      // the big title steps aside once the climb begins
      picoHead.style.opacity = 1 - clamp01((t - 0.06) / 0.08);
    },
  });

  // ---------- night: creators and reviews under the stars ----------
  const NIGHT_POS = V(-60, 660, 30);
  ScrollTrigger.create({
    trigger: '.creators',
    start: 'top 85%',
    endTrigger: '.reviews',
    end: 'bottom 40%',
    onUpdate(st) {
      const t = st.progress;
      setView(NIGHT_POS, V(lerp(-3200, -900, t), lerp(560, 2600, Math.min(1, t * 2)), lerp(420, 1600, t)), 56, 3, 1);
    },
    onToggle(st) { document.body.classList.toggle('on-night', st.isActive); },
  });

  // ---------- dawn: back to the sea for the ticket ----------
  ScrollTrigger.create({
    trigger: '.contact',
    start: 'top 40%',
    end: 'bottom bottom',
    onUpdate(st) {
      const t = st.progress;
      setView(V(lerp(-3600, -3000, t), lerp(60, 40, t), lerp(420, 300, t)), V(0, 330, 0), lerp(34, 30, t), 0, 0);
    },
    onLeaveBack() { /* the night trigger takes over again */ },
  });

  ScrollTrigger.refresh();

  return {
    attach(w) {
      if (!w) { canvas.remove(); return; }
      world = w;
      world.setPointer(0, 0);
      if (!mobile) {
        window.addEventListener('pointermove', (e) => world.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
      }
      world.onFrame(() => {
        if (!pinOn) return;
        world.project(world.hostelAnchor, pinPos);
        pin.style.transform = `translate3d(${pinPos.x}px, ${pinPos.y}px, 0)`;
        pin.classList.toggle('is-on', pinPos.visible);
      });
      // jump straight to wherever the page already is
      setView(ARRIVAL.pos.getPoint(0), ARRIVAL.look.getPoint(0), ARRIVAL.fov[0], 0);
      ScrollTrigger.getAll().forEach((st) => st.vars.onUpdate?.(st));
      if (houseST.isActive) world.setActive(false);
      world.snap();
    },
  };
}
