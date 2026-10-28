import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CatmullRomCurve3, Vector3 } from 'three';
import { sunMark } from './ui/loader.js';

// Scroll is the camera. Each chapter of the page owns a stretch of the flight.

const V = (x, y, z) => new Vector3(x, y, z);
const path = (pts) => new CatmullRomCurve3(pts, false, 'centripetal');
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => t * t * (3 - 2 * t);
// piecewise-linear through evenly spaced keys
const keys = (arr, t) => {
  const x = clamp01(t) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(x));
  return lerp(arr[i], arr[i + 1], x - i);
};

// 1 · the ferry from Faial, then the harbour, then the mountain
const ARRIVAL = {
  pos: path([V(-4300, 34, 520), V(-3400, 60, 320), V(-2650, 95, 220), V(-2190, 80, 130)]),
  look: path([V(0, 330, 0), V(0, 350, 0), V(-1890, 10, 40), V(-1900, 4, 40)]),
  fov: [28, 34, 40, 44],
  tod: [0, 0.45, 0.85, 1],
};

// a typical day, written into the guestbook one line at a time
const DAY = [
  ['08:30', 'vegetarian breakfast, the reception opens'],
  ['09:00', 'two strangers leave to hike the vineyards'],
  ['10:20', 'the cats claim the hammock'],
  ['11:00', 'check-out hugs at the yellow door'],
  ['12:30', 'road trip to the lava pools, windows down'],
  ['14:00', 'laptops out in the co-working room'],
  ['15:00', 'check-in: new strangers arrive'],
  ['16:40', 'stretching in the greenhouse'],
  ['18:00', 'sunset over Faial from the garden'],
  ['19:30', 'one long table, one big pot'],
  ['21:00', 'the fire pit is lit'],
  ['22:15', 'a guitar comes out, then karaoke'],
  ['23:00', 'quiet hours. the stars take over'],
];

// 2 · the climb: sea level to the summit, morning to golden hour
const CLIMB = {
  pos: path([V(-2650, 26, -150), V(-2230, 22, -470), V(-1560, 95, -720), V(-1050, 270, -520), V(-520, 430, -300), V(-60, 652, 30)]),
  look: path([V(-4200, 40, 400), V(-1950, 0, -820), V(-1200, 30, -480), V(0, 470, 0), V(0, 640, 0), V(-3200, 470, 420)]),
  fov: [42, 46, 48, 46, 50, 52],
  tod: [1.15, 1.3, 1.5, 1.75, 2.1, 2.55],
  alt: [0, 0, 40, 400, 1200, 2351],
};

// The journey starts right away; the 3D world plugs in whenever it is ready (or never, on old devices).
export function initJourney({ mobile }) {
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

  // ---------- hero: the house's own film; scrolling zooms in, the fog rolls over and the island is drawn ----------
  const hero = document.querySelector('[data-hero]');
  const heroVideo = hero.querySelector('[data-hero-video]');
  const heroCopy = hero.querySelector('[data-hero-copy]');
  const heroShade = hero.querySelector('.hero__shade');
  const cue = hero.querySelector('.hero__cue');
  const whiteout = hero.querySelector('[data-whiteout]');
  const stage = hero.querySelector('.hero__stage');
  // the logo's sun rises over the film, turns, swells until its yellow fills the screen, and that yellow becomes paper
  const sunrise = hero.querySelector('[data-sunrise]');
  const disc = hero.querySelector('[data-disc]');
  const mark = hero.querySelector('[data-sunmark]');
  mark.innerHTML = sunMark();
  let heroP = 0;
  const heroUpdate = (p) => {
    heroP = p;
    heroVideo.style.transform = `scale(${1 + 0.38 * smooth(clamp01(p / 0.6))}) translateY(${p * 6}%)`;
    heroShade.style.opacity = 1 - clamp01((p - 0.25) / 0.25);
    heroCopy.style.transform = `translate3d(0, ${-p * 340}px, 0)`;
    heroCopy.style.opacity = 1 - clamp01(p / 0.28);
    heroCopy.style.visibility = p > 0.3 ? 'hidden' : 'visible';
    cue.style.opacity = 1 - clamp01(p * 8);
    const rise = smooth(clamp01((p - 0.16) / 0.22));
    const swell = clamp01((p - 0.4) / 0.18);
    sunrise.style.transform = `translate(-50%, -50%) scale(${rise}) rotate(${p * 160}deg)`;
    // the disc must outgrow the screen's diagonal
    const discPx = sunrise.offsetWidth * 0.52;
    disc.style.transform = `scale(${1 + swell * swell * (Math.hypot(innerWidth, innerHeight) / Math.max(1, discPx))})`;
    mark.style.opacity = 1 - clamp01(swell * 2.2);
    // the yellow cools into paper, and the island is drawn on it
    whiteout.style.opacity = smooth(clamp01((p - 0.55) / 0.08));
    world?.setDraw(clamp01((p - 0.63) / 0.35));
    const fade = 1 - clamp01((p - 0.63) / 0.08);
    stage.style.opacity = fade;
    stage.style.visibility = fade > 0 ? 'visible' : 'hidden';
    // the film only plays while you can see it
    if (fade > 0 && heroVideo.paused && heroVideo.dataset.started) heroVideo.play().catch(() => {});
    if (fade <= 0 && !heroVideo.paused) heroVideo.pause();
    setView(ARRIVAL.pos.getPoint(0), ARRIVAL.look.getPoint(0), ARRIVAL.fov[0], 0);
  };
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (st) => heroUpdate(st.progress) });
  heroUpdate(0);

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
      show(lines[0], 0.02, 0.3, t);
      show(lines[1], 0.32, 0.58, t);
      show(lines[2], 0.62, 1, t);
      pinOn = t > 0.58;
      if (!pinOn) pin.classList.remove('is-on');
      hud.textContent = Math.max(0, Math.round(40 * (1 - t)));
      setView(ARRIVAL.pos.getPoint(t), ARRIVAL.look.getPoint(t), keys(ARRIVAL.fov, t), keys(ARRIVAL.tod, t));
    },
    // once you're past the harbour the pin has done its job
    onLeave() { pinOn = false; pin.classList.remove('is-on'); },
    onLeaveBack() { pinOn = false; pin.classList.remove('is-on'); },
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
    // a cat walks the dotted trail and every room tints the paper with its own colour
    const stage = places.querySelector('.places__pin');
    const trail = places.querySelector('[data-trail]');
    const cat = places.querySelector('[data-trail-cat]');
    const line = places.querySelector('.trail');
    const placeEls = gsap.utils.toArray('.place');
    const total = trail.getTotalLength();
    let tinted = -1;
    const walk = (p) => {
      const pt = trail.getPointAtLength(p * total);
      const ahead = trail.getPointAtLength(Math.min(total, p * total + 4));
      cat.style.transform = `translate(${(pt.x / 1000) * line.clientWidth - 23}px, ${(pt.y / 80) * line.clientHeight - 23}px) scaleX(${ahead.x >= pt.x ? 1 : -1}) rotate(${Math.sin(p * 60) * 8}deg)`;
      const i = Math.min(placeEls.length - 1, Math.floor(p * placeEls.length));
      if (i !== tinted) {
        tinted = i;
        stage.style.backgroundColor = `color-mix(in srgb, ${placeEls[i].dataset.color} 13%, #f5eedf)`;
      }
    };
    walk(0);
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { ...st, scrub: 0.8, onUpdate: (s) => walk(s.progress) } });
    gsap.utils.toArray('.place__ink').forEach((ink) => {
      gsap.fromTo(ink, { rotate: -24, scale: 0.6 }, { rotate: 6, scale: 1, ease: 'none', scrollTrigger: { ...st, scrub: true } });
    });
    return () => { ScrollTrigger.removeEventListener('refreshInit', size); places.style.height = ''; };
  });

  // ---------- the statement lights up word by word ----------
  const statement = document.querySelector('[data-statement]');
  const hot = new Set(['fire,', 'table', 'family.']);
  statement.setAttribute('aria-label', statement.textContent);
  statement.innerHTML = statement.textContent.trim().split(/\s+/).map((w) => `<span class="wd${hot.has(w) ? ' hot' : ''}" aria-hidden="true">${w}</span>`).join(' ');
  const words = [...statement.querySelectorAll('.wd')];
  ScrollTrigger.create({
    trigger: statement, start: 'top 80%', end: 'bottom 40%', scrub: true,
    onUpdate: (st) => { const n = Math.round(st.progress * words.length * 1.05); words.forEach((w, i) => w.classList.toggle('on', i < n)); },
  });

  // ---------- life at the house: the phone tilts as you pass ----------
  gsap.fromTo('[data-phone]', { rotate: -12, y: 80 }, { rotate: 6, y: -140, ease: 'none', scrollTrigger: { trigger: '.life', start: 'top bottom', end: 'bottom top', scrub: true } });

  // ---------- numbers count up, the guestbook starts writing ----------
  ScrollTrigger.create({
    trigger: '.numbers', start: 'top 70%', once: true,
    onEnter: () => {
      document.querySelectorAll('.stat b').forEach((b) => {
        const o = { v: 0 }, end = parseFloat(b.dataset.n), d = Number(b.dataset.d || 0);
        gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { b.textContent = d ? o.v.toFixed(d) : Math.round(o.v).toLocaleString('en'); } });
      });
      const box = document.querySelector('[data-log]');
      let i = 0;
      const add = () => {
        const [time, text] = DAY[i++ % DAY.length];
        const row = document.createElement('div');
        row.innerHTML = `<time>${time}</time><span>${text}</span>`;
        box.appendChild(row);
        gsap.fromTo(row, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
        while (box.children.length > 12) box.firstChild.remove();
      };
      for (let k = 0; k < 5; k++) add();
      setInterval(add, 1700);
    },
  });

  // ---------- creators: rings turn with the scroll, portraits rise ----------
  gsap.utils.toArray('.person').forEach((el, i) => {
    gsap.fromTo(el, { y: 140, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power4.out', delay: i * 0.12, scrollTrigger: { trigger: '.people', start: 'top 85%' } });
    gsap.to(el.querySelector('.person__ring'), { rotate: 200, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // ---------- strangers → friends, across the whole stay ----------
  const friendsN = document.querySelector('[data-friends-n]');
  const friendsDot = document.querySelector('[data-friends-dot]');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      friendsN.textContent = Math.round(smooth(st.progress) * 548);
      friendsDot.style.bottom = `calc(${st.progress * 100}% - 5px)`;
    },
  });
  ScrollTrigger.create({ trigger: '.pico', start: 'top 60%', end: 'bottom 40%', onToggle: (st) => document.body.classList.toggle('in-pico', st.isActive) });

  // the fire behind the reviews drifts slower than the page
  gsap.fromTo('.reviews__fire', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.reviews', start: 'top bottom', end: 'bottom top', scrub: true } });

  // ---------- the last word ----------
  gsap.fromTo('.mega > *', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.4, ease: 'power4.out', stagger: 0.12, scrollTrigger: { trigger: '.foot', start: 'top 85%' } });

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
    end: 'bottom 75%',
    onUpdate(st) {
      const t = st.progress;
      setView(NIGHT_POS, V(lerp(-3200, -900, t), lerp(560, 2600, Math.min(1, t * 2)), lerp(420, 1600, t)), 56, 3, 1);
    },
    onToggle(st) { document.body.classList.toggle('on-night', st.isActive); },
    onLeave() { document.body.classList.remove('on-night'); },
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
      heroUpdate(heroP);
    },
  };
}
