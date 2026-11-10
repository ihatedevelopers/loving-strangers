import { drawRealCat } from './real-cat.js';

// The house cats don't chase anyone. Each one has a favourite spot in the page and its own routine;
// the cursor only gets a look, and a click gets a slow blink back (a cat's way of saying hello).

const HOMES = [
  { sel: '.room--poets .room__media', coat: 'ginger', at: 0.8, kind: 'sleeper', face: -1 },
  { sel: '.dinners__stack', coat: 'white', at: 0.16, kind: 'groomer', face: 1 },
  { sel: '.guestbook', coat: 'black', at: 0.78, kind: 'loafer', face: -1 },
  { sel: '.scores', coat: 'black', at: 0.6, kind: 'watcher', face: -1, glow: true },
  { sel: '.postcard', coat: 'white', at: 0.72, kind: 'watcher', face: -1 },
  { sel: '.foot', coat: 'ginger', at: 0.5, kind: 'walker', face: 1 },
];

// each routine is a little weighted script: [pose, min seconds, max seconds]
const ROUTINES = {
  sleeper: () => [['sleep', 14, 26], ['loaf', 2.5, 4], ['yawn', 1.2, 1.4], ['loaf', 2, 4]],
  groomer: () => (Math.random() < 0.5 ? [['groom', 3, 5], ['sit', 3, 6]] : [['sit', 4, 6], ['loaf', 6, 10], ['yawn', 1.2, 1.4]]),
  loafer: () => [['loaf', 8, 14], ['sleep', 8, 16]],
  watcher: () => (Math.random() < 0.35 ? [['groom', 2.5, 3.5], ['sit', 5, 9]] : [['sit', 6, 12], Math.random() < 0.3 ? ['yawn', 1.2, 1.4] : ['sit', 2, 3]]),
  walker: () => [['walk', 0, 0], ['sit', 3, 6], ['stretch', 1.2, 1.5]],
};

export function createResidents({ audio, mobile, hearts }) {
  const scale = mobile ? 0.72 : 1;
  const cats = [];
  HOMES.forEach((h, i) => {
    const el = document.querySelector(h.sel);
    if (!el) return;
    cats.push({
      ...h, el, coat: h.coat, seed: i + 1, x: 0, y: 0, pos: h.at, dir: h.face,
      script: [], pose: 'sit', left: 0, blink: 1, blinkT: 1 + Math.random() * 4, slow: 0,
      twitch: 0, lookX: 0, lookY: 0, phase: 0, hover: 0, visible: false,
    });
  });
  const vis = new Set();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))), { rootMargin: '120px 0px' });
  cats.forEach((c) => io.observe(c.el));

  const next = (c) => {
    if (!c.script.length) c.script = ROUTINES[c.kind]();
    const [pose, a, b] = c.script.shift();
    c.pose = pose;
    c.left = a + Math.random() * (b - a);
    // walkers pick somewhere along their ledge to stroll to
    if (pose === 'walk') {
      let to = 0.12 + Math.random() * 0.76;
      if (Math.abs(to - c.pos) < 0.15) to = c.pos > 0.5 ? 0.15 : 0.85;
      c.goal = to;
    }
  };

  function hit(x, y) {
    return cats.find((c) => c.visible && Math.abs(x - c.x) < 42 * scale && y < c.y + 6 && y > c.y - 70 * scale);
  }
  addEventListener('pointerdown', (e) => {
    const c = hit(e.clientX, e.clientY);
    if (!c) return;
    // a slow blink back, a purr and a heart; a sleeping cat wakes up for it
    c.slow = 1.2;
    if (c.pose === 'sleep') { c.pose = 'loaf'; c.left = 4; }
    hearts.push({ x: c.x + c.dir * 18 * scale, y: c.y - 60 * scale, t: 0 });
    audio.sfx.mrrp();
  });

  function step(dt, t, mouse, H) {
    for (const c of cats) {
      c.visible = vis.has(c.el);
      if (!c.visible) continue;
      const r = c.el.getBoundingClientRect();
      c.y = r.top;
      c.visible = r.top > 40 && r.top < H + 40;
      if (!c.visible) continue;
      const lo = r.left + 50 * scale, hi = r.right - 50 * scale;

      if (!c.started) { c.started = true; next(c); }
      if (c.pose === 'walk') {
        const target = c.goal;
        const d = target - c.pos;
        const speed = 26 / Math.max(1, hi - lo); // px per second, in ledge units
        c.dir = Math.sign(d) || c.dir;
        c.pos += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        c.phase += 26 * dt * 0.11;
        if (Math.abs(d) < 0.002) next(c);
      } else {
        c.left -= dt;
        if (c.left <= 0) next(c);
      }
      c.x = lo + (hi - lo) * c.pos;

      // blinking, a slow blink when greeted, now and then an ear flick
      c.blinkT -= dt;
      if (c.blinkT < 0) { c.blink = 0.1; if (c.blinkT < -0.13) { c.blink = 1; c.blinkT = 2.5 + Math.random() * 5; } }
      if (c.slow > 0) { c.slow -= dt; c.blink = 0.5 + 0.5 * Math.cos(Math.min(1, 1.2 - c.slow) * Math.PI * 2); }
      c.twitch = c.twitch > 0 ? c.twitch - dt : (Math.random() < dt * 0.08 ? 0.25 : 0);

      // the cursor gets a look when it comes close; a lingering cursor wakes a sleeper
      const hx = c.x + c.dir * 20 * scale, hy = c.y - 50 * scale;
      const dx = mouse.x - hx, dy = mouse.y - hy;
      const near = mouse.inside && Math.hypot(dx, dy) < 220;
      const lx = near ? Math.max(-1, Math.min(1, (dx * c.dir) / 120)) : Math.sin(t * 0.3 + c.seed) * 0.4;
      const ly = near ? Math.max(-1, Math.min(1, dy / 120)) : 0;
      c.lookX += (lx - c.lookX) * (1 - Math.exp(-dt * 4));
      c.lookY += (ly - c.lookY) * (1 - Math.exp(-dt * 4));
      c.hover = hit(mouse.x, mouse.y) === c ? c.hover + dt : 0;
      if (c.hover > 0.9 && c.pose === 'sleep') { c.pose = 'loaf'; c.left = 3; c.slow = 1.2; }
    }
  }

  function draw(ctx, t) {
    for (const c of cats) {
      if (!c.visible) continue;
      ctx.save();
      // fade out under the nav bar instead of sitting on top of it
      ctx.globalAlpha = Math.max(0, Math.min(1, (c.y - 70) / 40));
      ctx.translate(c.x, c.y);
      ctx.scale(c.dir * scale, scale);
      drawRealCat(ctx, c, c.pose, t, c.glow);
      ctx.restore();
    }
  }

  return { step, draw, cats };
}
