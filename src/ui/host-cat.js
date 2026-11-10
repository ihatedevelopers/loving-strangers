import { COATS, ellipse, limb, drawTail, paint } from './real-cat.js';

// The host: the hostel's ginger, peeking over the bottom edge of your screen as if from behind the glass.
// It keeps an eye on you the whole way down the page: follows the cursor, watches the page scroll past,
// widens its pupils when something moves fast or the night falls, perks up at "book now", nods along when
// the song plays, dozes off if you leave it alone, and boops the glass with a paw if you click it.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (cur, goal, dt, k) => cur + (goal - cur) * (1 - Math.exp(-dt * k));
const BOOK = '.ticket-btn, .ticket, .room__book, .pass__book, .actionbar__book, .pass';

export function createHost({ audio, mobile, hearts, residents }) {
  const coat = COATS.ginger;
  const s = mobile ? 0.58 : 1.05;
  const h = {
    up: 0, upGoal: 0, lookX: -0.4, lookY: -0.3, roll: 0, pupil: 0.3, open: 1, ears: 0, flat: 0, twitch: 0,
    sleep: 0, blinkT: 2, blink: 1, slow: 0, tail: 0, tailLash: 0, happy: 0, annoyed: 0, boop: null,
    cx: 0, edge: 0, seen: false, entrance: 0,
  };
  const prints = [];
  const clicks = [];
  let lastInput = performance.now(), lastMove = 0, mx = -1, my = -1, mSpeed = 0, nearT = 0, excite = 0;
  let lastScroll = scrollY, vel = 0, saccade = { x: 0, y: 0, t: 0 }, click = null;

  const touchInput = () => { lastInput = performance.now(); };
  addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (mx >= 0) mSpeed = Math.max(mSpeed, Math.hypot(e.clientX - mx, e.clientY - my) / Math.max(1, now - lastMove) * 1000);
    mx = e.clientX; my = e.clientY; lastMove = now; touchInput();
    excite = e.target.closest?.(BOOK) ? 1 : 0;
  }, { passive: true });
  addEventListener('scroll', touchInput, { passive: true });
  addEventListener('keydown', touchInput);

  const onHost = (x, y) => h.up > 0.6 && Math.abs(x - h.cx) < 52 * s && y > h.edge - 135 * s && y < h.edge + 4;
  addEventListener('pointerdown', (e) => {
    touchInput();
    const x = e.clientX, y = e.clientY;
    if (!onHost(x, y)) {
      // something happened over there: a quick look and big pupils
      click = { x, y, t: 1.1 };
      if (e.pointerType !== 'mouse') { mx = x; my = y; lastMove = performance.now(); }
      return;
    }
    const now = performance.now();
    clicks.push(now);
    while (clicks.length && now - clicks[0] > 2200) clicks.shift();
    if (clicks.length >= 4) {
      // enough. ears back, tail lashing, a pointed look away
      h.annoyed = 3.2; clicks.length = 0;
      return;
    }
    if (h.sleep > 0.5) { h.sleep = 0; h.twitch = 0.4; }
    boop();
  });

  function boop() {
    if (h.boop || h.annoyed > 0) return;
    h.boop = { t: 0, side: -1, printed: false };
    h.slow = 1.4; h.happy = 2.5;
    audio.sfx.mrrp();
  }
  function celebrate(n) {
    h.happy = 4; h.slow = 1.4;
    for (let i = 0; i < n; i++) setTimeout(() => hearts.push({ x: h.cx + (Math.random() - 0.5) * 50 * s, y: h.edge - 120 * s, t: 0 }), i * 260);
    setTimeout(boop, 500);
  }
  // the end of the journey: the host is pleased for you
  const head = document.querySelector('.contact__head');
  if (head) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { celebrate(2); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(head);
  }
  document.addEventListener('ls:coupon', () => celebrate(5));

  function place(W, H) {
    const bar = mobile && document.querySelector('.actionbar');
    const r = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
    if (r && r.height) { h.edge = r.top + 2; h.cx = r.right - 44; }
    else { h.edge = H; h.cx = W - 104; }
  }

  function step(dt, t, W, H) {
    place(W, H);
    const now = performance.now();
    const idle = (now - lastInput) / 1000;
    const hidden = document.body.classList.contains('on-film') || document.querySelector('.is-loading') || document.querySelector('[data-menu]:not([hidden])');
    const night = document.body.classList.contains('on-night');

    // first appearance: ears and eyes over the edge, a look around, then up
    if (!hidden && !h.seen) { h.seen = true; h.entrance = 0; }
    if (h.seen) h.entrance += dt;
    h.upGoal = hidden ? 0 : h.entrance < 1.6 ? 0.42 : 1;
    if (h.annoyed > 0) h.upGoal = 0.62;
    h.up = ease(h.up, h.upGoal, dt, h.upGoal < h.up ? 5 : h.entrance < 1.6 ? 3 : 2.2);

    // scroll speed: the page is the thing going by
    vel = ease(vel, (scrollY - lastScroll) / Math.max(dt, 1e-3), dt, 6);
    lastScroll = scrollY;
    mSpeed *= Math.exp(-dt * 3);

    // where to look
    const hxS = h.cx, hyS = h.edge - 62 * s;
    let tx = null, ty = null;
    if (click && (click.t -= dt) > 0) { tx = click.x; ty = click.y; }
    else if (now - lastMove < 2600 && mx >= 0) { tx = mx; ty = my; }
    let lx, ly;
    if (tx !== null) {
      lx = clamp((tx - hxS) / 280, -1, 1); ly = clamp((ty - hyS) / 240, -1, 1);
    } else if (Math.abs(vel) > 60) {
      lx = -0.15; ly = clamp(-vel / 1400, -1, 1);
    } else {
      // nothing going on: glance at a resident cat now and then, or around the room
      saccade.t -= dt;
      if (saccade.t < 0) {
        const friends = residents ? residents.cats.filter((c) => c.visible) : [];
        if (friends.length && Math.random() < 0.6) {
          const f = friends[Math.floor(Math.random() * friends.length)];
          saccade.x = clamp((f.x - hxS) / 280, -1, 1); saccade.y = clamp((f.y - 30 - hyS) / 240, -1, 1);
        } else { saccade.x = -0.2 - Math.random() * 0.7; saccade.y = -Math.random() * 0.7; }
        saccade.t = 1.6 + Math.random() * 3;
      }
      lx = saccade.x; ly = saccade.y;
    }
    if (h.annoyed > 0) { lx = 0.9; ly = -0.1; }
    h.lookX = ease(h.lookX, lx, dt, 7); h.lookY = ease(h.lookY, ly, dt, 7);

    // a curious head tilt when the cursor rests close by; nodding when the song is on
    const near = tx !== null && Math.hypot(tx - hxS, ty - hyS) < 260 && mSpeed < 80;
    nearT = near ? nearT + dt : 0;
    const music = audio.on ? Math.sin(t * Math.PI * 2 * 0.95) * 0.07 : 0;
    h.roll = ease(h.roll, (nearT > 0.6 ? 0.2 : 0) - h.lookX * 0.06 + music, dt, 4);

    // pupils: slits in daylight, round at night, wide when something moves fast or "book now" is near
    let pupil = night ? 0.85 : 0.18;
    pupil += clamp(mSpeed / 2600, 0, 0.55) + clamp(Math.abs(vel) / 4000, 0, 0.35) + excite * 0.5 + (click ? clamp(click.t, 0, 1) * 0.5 : 0);
    if (h.boop || h.happy > 0) pupil += 0.25;
    h.pupil = ease(h.pupil, clamp(pupil, 0.12, 1), dt, 5);

    // ears: forward when interested, back in the wind of a fast scroll, flat when annoyed
    h.ears = ease(h.ears, excite || near || audio.on ? 1 : 0, dt, 6);
    h.flat = ease(h.flat, h.annoyed > 0 ? 1 : clamp((Math.abs(vel) - 1400) / 2600, 0, 0.6), dt, 8);
    h.twitch = h.twitch > 0 ? h.twitch - dt : (Math.random() < dt * 0.1 ? 0.28 : 0);

    // dozing off when left alone, waking with an ear flick
    const sleepGoal = idle > 26 ? 1 : 0;
    if (sleepGoal < h.sleep && h.sleep > 0.9) h.twitch = 0.35;
    h.sleep = ease(h.sleep, sleepGoal, dt, sleepGoal ? 0.6 : 5);
    let open = idle > 15 ? 0.45 : 1;
    if (h.annoyed > 0) open = 0.5;
    h.blinkT -= dt;
    if (h.blinkT < 0) { h.blink = 0.05; if (h.blinkT < -0.14) { h.blink = 1; h.blinkT = 2.5 + Math.random() * 4.5; } }
    if (h.slow > 0) { h.slow -= dt; open = Math.min(open, 0.5 + 0.5 * Math.cos(Math.min(1, (1.4 - h.slow) / 1.4) * Math.PI * 2)); }
    h.open = ease(h.open, open, dt, 12) * 1;
    h.annoyed = Math.max(0, h.annoyed - dt);
    h.happy = Math.max(0, h.happy - dt);
    h.tail += dt * (h.annoyed > 0 ? 7 : h.happy > 0 || audio.on ? 2.4 : 1.1);

    if (h.boop) {
      h.boop.t += dt;
      if (h.boop.t > 0.32 && !h.boop.printed) {
        h.boop.printed = true;
        const p = boopPoint();
        prints.push({ x: p.x, y: p.y, t: 0, side: h.boop.side });
        hearts.push({ x: p.x, y: p.y - 30 * s, t: 0 });
      }
      if (h.boop.t > 1) h.boop = null;
    }
    for (let i = prints.length - 1; i >= 0; i--) if ((prints[i].t += dt) > 6) prints.splice(i, 1);
  }

  // the paw comes up beside the face, toward you, and presses on the glass
  const boopPoint = () => ({ x: h.cx - 60 * s, y: h.edge - 78 * s });

  // ---------- painting ----------
  function ear(path, side, k = 1) {
    const ang = side * (0.3 + h.flat * 0.95 - h.ears * 0.12) + (side < 0 ? h.twitch * Math.sin(performance.now() / 25) * 0.6 : 0);
    const hg = 31 * (1 - h.flat * 0.32) * k;
    const bx = side * 19, by = -16;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (u, v) => [bx + u * c - v * sn, by + u * sn + v * c];
    const w = 12.5 * k;
    const [ax, ay] = P(-w, 4), [tx, ty] = P(side * 1.5, -hg), [cx, cy] = P(w, 4), [q1x, q1y] = P(-w * 0.7, -hg * 0.55), [q2x, q2y] = P(w * 0.65, -hg * 0.5);
    path.moveTo(ax, ay); path.quadraticCurveTo(q1x, q1y, tx, ty); path.quadraticCurveTo(q2x, q2y, cx, cy); path.closePath();
    return P;
  }

  function eye(ctx, side, fx, fy, glow) {
    const ex = fx + side * 13.5, ey = -3 + fy, rx = 8.4, ry = 7.2, rot = -side * 0.15;
    const open = h.open * h.blink * (1 - h.sleep);
    if (open < 0.12) {
      ctx.strokeStyle = 'rgba(40,24,14,.8)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - 7, ey); ctx.quadraticCurveTo(ex, ey + 3.2, ex + 7, ey - 0.6); ctx.stroke();
      return;
    }
    ctx.save();
    const shape = new Path2D(); shape.ellipse(ex, ey, rx, ry, rot, 0, Math.PI * 2);
    const px = ex + h.lookX * 2.6, py = ey + h.lookY * 1.8;
    const g = ctx.createRadialGradient(px, py, 0.5, ex, ey, rx + 1);
    g.addColorStop(0, '#f2f5a0'); g.addColorStop(0.35, coat.eye[0]); g.addColorStop(1, coat.eye[1]);
    ctx.fillStyle = g;
    if (glow) { ctx.shadowColor = '#e8f070'; ctx.shadowBlur = 14; }
    ctx.fill(shape);
    ctx.shadowBlur = 0;
    ctx.clip(shape);
    // fine radial streaks in the iris
    ctx.strokeStyle = 'rgba(90,110,20,.25)'; ctx.lineWidth = 0.5;
    for (let a = 0; a < Math.PI * 2; a += 0.35) { ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 3, py + Math.sin(a) * 3); ctx.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); ctx.stroke(); }
    ctx.fillStyle = '#0b0a09';
    ctx.beginPath(); ctx.ellipse(px, py, 1.1 + h.pupil * 4.9, 6.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.ellipse(ex - 2.6 + h.lookX, ey - 2.8, 1.7, 1.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(ex + 3 + h.lookX, ey + 2.6, 0.7, 0, Math.PI * 2); ctx.fill();
    // the upper lid comes down as a flat line: sleepy, content, or annoyed
    const lidY = ey - ry + ry * 2 * (1 - open);
    if (open < 0.98) {
      // a soft, curved lid: content rather than cross
      ctx.fillStyle = coat.base;
      ctx.beginPath(); ctx.ellipse(ex, lidY - ry * 1.15, rx * 1.4, ry * 1.2, rot, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(70,34,12,.55)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.ellipse(ex, lidY - ry * 1.15, rx * 1.4, ry * 1.2, rot, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(38,22,12,.85)'; ctx.lineWidth = 1.2;
    ctx.stroke(shape);
  }

  function drawHead(ctx, t, night) {
    const fx = h.lookX * 5.5, fy = h.lookY * 3.8;
    const head = new Path2D();
    ellipse(head, 0, -4, 33, 28.5);
    ellipse(head, 0, 8, 37.5, 21.5);
    ellipse(head, fx, 17 + fy, 13, 9);
    ear(head, -1); ear(head, 1);
    paint(ctx, head, coat, [-42, -52, 42, 30], 41, false);
    ctx.save(); ctx.clip(head);
    // tabby markings: the M on the forehead, cheek stripes
    ctx.strokeStyle = coat.stripe; ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
    for (const [x0, y0, x1, y1] of [[-7, -30, -4, -14], [0, -32, 0, -15], [7, -30, 4, -14], [-14, -27, -11, -18], [14, -27, 11, -18]]) {
      ctx.beginPath(); ctx.moveTo(x0 + fx * 0.6, y0 + fy * 0.5); ctx.quadraticCurveTo((x0 + x1) / 2 + fx * 0.6 + 1, (y0 + y1) / 2 + fy * 0.5, x1 + fx * 0.6, y1 + fy * 0.5); ctx.stroke();
    }
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const x = side * (27 + k * 4) + fx * 0.3, y = 3 + k * 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + side * 5, y - 2, x + side * 10, y + 1); ctx.stroke();
    }
    // pale muzzle, chin and the soft shade under the cheeks
    ctx.fillStyle = coat.belly; ctx.globalAlpha = 0.62;
    ctx.beginPath(); ctx.ellipse(fx - 6.5, 13.5 + fy, 8, 6.5, 0, 0, Math.PI * 2); ctx.ellipse(fx + 6.5, 13.5 + fy, 8, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx, 23 + fy, 8.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.fillStyle = coat.shadow;
    ctx.beginPath(); ctx.ellipse(0, 28, 36, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // inner ears with tufts
    for (const side of [-1, 1]) {
      const p = new Path2D();
      const P = ear(p, side, 0.66);
      ctx.save(); ctx.translate(0, 3); ctx.fillStyle = coat.ear; ctx.globalAlpha = 0.85; ctx.fill(p); ctx.restore();
      ctx.strokeStyle = 'rgba(255,248,235,.7)'; ctx.lineWidth = 0.6;
      for (let k = -2; k <= 2; k++) {
        const [ax, ay] = P(k * 2.4, 2), [bx, by] = P(k * 3 - side * 1, -14);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }

    eye(ctx, -1, fx, fy, night);
    eye(ctx, 1, fx, fy, night);

    // nose and mouth
    const nx = fx * 1.1, ny = 9.5 + fy;
    ctx.fillStyle = coat.nose;
    ctx.beginPath();
    ctx.moveTo(nx - 4.8, ny - 2.6); ctx.quadraticCurveTo(nx, ny - 3.8, nx + 4.8, ny - 2.6);
    ctx.quadraticCurveTo(nx + 1.4, ny + 2.6, nx, ny + 3.2); ctx.quadraticCurveTo(nx - 1.4, ny + 2.6, nx - 4.8, ny - 2.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(nx - 1.2, ny - 1.8, 1.6, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(70,36,26,.6)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    const chat = h.annoyed > 0 ? 0 : 0;
    ctx.beginPath(); ctx.moveTo(nx, ny + 3.2); ctx.lineTo(nx, ny + 6 + chat);
    ctx.moveTo(nx, ny + 6); ctx.quadraticCurveTo(nx - 1.5, ny + 9, nx - 5.5, ny + 7.4);
    ctx.moveTo(nx, ny + 6); ctx.quadraticCurveTo(nx + 1.5, ny + 9, nx + 5.5, ny + 7.4);
    ctx.stroke();
    // whisker dots and whiskers
    ctx.fillStyle = 'rgba(110,55,20,.45)';
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(nx + side * (5 + k * 2.4), ny + 7 + (k % 2) * 2, 0.55, 0, Math.PI * 2); ctx.fill(); }
    const tw = Math.sin(t * 3.1) * 0.6 + (h.flat * 4);
    ctx.strokeStyle = 'rgba(255,252,240,.85)'; ctx.lineWidth = 0.75;
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const x0 = nx + side * 8, y0 = ny + 6 + k * 1.6;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + side * 24, y0 - 6 + k * 2.5 + tw, x0 + side * (44 - k * 3), y0 - 2 + k * 6.5 + tw * 1.5);
      ctx.stroke();
    }
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const x0 = fx + side * (10 + k * 5), y0 = -12 + fy;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + side * 6, y0 - 10, x0 + side * (12 + k * 4), y0 - 16); ctx.stroke();
    }
  }

  function drawPaw(ctx, x, y, k, pressed) {
    // a paw seen from below, pressed on the glass: fur, then the toe beans
    const foot = new Path2D();
    ellipse(foot, x, y, 17 * k, 19 * k);
    paint(ctx, foot, coat, [x - 20 * k, y - 22 * k, x + 20 * k, y + 22 * k], 77, false);
    const sq = 1 + pressed * 0.22;
    ctx.fillStyle = '#d9867f';
    ctx.beginPath(); ctx.ellipse(x, y + 6 * k, 8.4 * k * sq, 6.8 * k * sq, 0, 0, Math.PI * 2); ctx.fill();
    for (const [tx, ty] of [[-10, -6], [-3.6, -11.5], [3.6, -11.5], [10, -6]]) {
      ctx.beginPath(); ctx.ellipse(x + tx * k, y + ty * k, 3.6 * k * sq, 4.4 * k * sq, tx * 0.03, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(x - 2 * k, y + 4 * k, 3 * k, 1.6 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  function draw(ctx, t, W) {
    // smudgy paw prints left on the glass
    for (const p of prints) {
      ctx.save();
      ctx.globalAlpha = 0.16 * (1 - p.t / 6);
      ctx.fillStyle = '#5a4436';
      ctx.translate(p.x, p.y); ctx.scale(s, s);
      ctx.beginPath(); ctx.ellipse(0, 6 * 1.1, 10, 8.2, 0, 0, Math.PI * 2); ctx.fill();
      for (const [tx, ty] of [[-10, -6], [-3.6, -11.5], [3.6, -11.5], [10, -6]]) { ctx.beginPath(); ctx.ellipse(tx * 1.1, ty * 1.1, 4.2, 5.2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (h.up < 0.01) return;
    const night = document.body.classList.contains('on-night');
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, h.edge); ctx.clip();
    ctx.translate(h.cx, h.edge);
    ctx.scale(s, s);
    ctx.translate(0, (1 - h.up) * 150);

    // tail, rising beside the cat: a slow sway, a happy hook, or an annoyed lash
    const tailPts = [[40, 46]];
    let a = -Math.PI / 2 + 0.22;
    const lash = h.annoyed > 0 ? 0.32 : 0.1;
    for (let i = 1; i <= 13; i++) {
      const k = i / 13;
      a += -0.015 + Math.sin(h.tail - i * 0.45) * lash * k + (h.happy > 0 && i > 10 ? -0.42 : 0);
      const [px, py] = tailPts[i - 1];
      tailPts.push([px + Math.cos(a) * 7.6, py + Math.sin(a) * 7.6]);
    }
    drawTail(ctx, tailPts, 6.2, 3.6, coat, true);

    // shoulders and chest
    const body = new Path2D();
    ellipse(body, 0, 10, 46, 48);
    paint(ctx, body, coat, [-48, -40, 48, 60], 23, true);
    ctx.save(); ctx.clip(body);
    ctx.fillStyle = coat.belly; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(0, -14, 17, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // front paws resting on the edge (one goes up for a boop)
    const bp = h.boop;
    const u = bp ? bp.t : 0;
    for (const side of [-1, 1]) {
      if (bp && side === bp.side && u < 0.95) continue;
      const paw = new Path2D();
      ellipse(paw, side * 19, -6, 12, 8.4);
      limb(paw, side * 19, 20, side * 19, -4, 10, 10);
      paint(ctx, paw, coat, [side * 19 - 13, -15, side * 19 + 13, 20], 90 + side, false);
      ctx.strokeStyle = 'rgba(120,60,20,.5)'; ctx.lineWidth = 0.8;
      for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(side * 19 + dx, -1); ctx.lineTo(side * 19 + dx, -5); ctx.stroke(); }
    }

    // the head, a little lower when it dozes, and the z's
    ctx.save();
    ctx.translate(h.lookX * 7, -66 + h.lookY * 4 + h.sleep * 16);
    ctx.rotate(h.roll);
    drawHead(ctx, t, night);
    ctx.restore();
    if (h.sleep > 0.6) {
      ctx.fillStyle = night ? '#e6ecd6' : '#343631'; ctx.font = '700 13px Syne, sans-serif';
      for (let k = 0; k < 2; k++) {
        const z = (t * 0.45 + k * 0.5) % 1;
        ctx.globalAlpha = (h.sleep - 0.6) * 2.5 * Math.sin(z * Math.PI);
        ctx.fillText('z', -40 - z * 14, -110 - z * 40);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // the boop: a paw comes up and presses against the glass
    if (bp) {
      const rise = clamp(u / 0.3, 0, 1), back = clamp((u - 0.7) / 0.3, 0, 1);
      const k = (0.6 + 0.95 * Math.sin(rise * Math.PI / 2)) * (1 - back * 0.45);
      const pressed = u > 0.3 && u < 0.7 ? 1 : 0;
      const target = boopPoint();
      const sx = h.cx - 22 * s, sy = h.edge - 4 * s;
      const e = Math.sin(rise * Math.PI / 2) * (1 - back);
      const x = sx + (target.x - sx) * e, y = sy + (target.y - sy) * e;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, h.edge); ctx.clip();
      const arm = new Path2D();
      limb(arm, sx, sy + 20 * s, x, y + 8 * s * k, 12 * s, 14 * s * k);
      paint(ctx, arm, coat, [Math.min(sx, x) - 20 * s, y - 10 * s, Math.max(sx, x) + 20 * s, h.edge + 30 * s], 55, false);
      ctx.translate(x, y); ctx.scale(s, s);
      drawPaw(ctx, 0, 0, k, pressed);
      ctx.restore();
    }
  }

  return { step, draw, host: h };
}
