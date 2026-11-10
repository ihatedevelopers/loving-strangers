import { HOUSE_CATS, drawHouseCat } from './house-cats.js';

// Three house cats follow your cursor.
// They trot after it, sit down when it stops, and fall asleep if you leave them long enough.

const INK = '#343631';
// The hostel's real cats by default (?cats=house); older looks stay available: ?cats=ink, ?cats=silhouette, ?cats=paws
const STYLE = new URLSearchParams(location.search).get('cats') || 'house';
const CATS = STYLE === 'silhouette'
  ? [{ fill: INK, stripes: false, eye: '#fbb600' }, { fill: INK, stripes: false, eye: '#fbb600' }, { fill: INK, stripes: false, eye: '#fbb600' }]
  : [{ fill: '#fbb600', stripes: true, eye: INK }, { fill: '#fffdf6', stripes: false, eye: INK }, { fill: '#2b2c25', stripes: false, eye: '#fbb600' }];

export function initCats({ audio, mobile }) {
  const canvas = document.getElementById('cats');
  const ctx = canvas.getContext('2d');
  const fine = window.matchMedia('(pointer: fine)').matches;
  let dpr = 1, W = 0, H = 0;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    // CSS size follows innerHeight too, so iOS toolbars never stretch the cats
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  };
  resize();
  addEventListener('resize', resize);

  const scale = mobile ? 0.8 : 1;
  const mouse = { x: W * 0.5, y: H * 0.72, inside: fine, hover: 0, hoverGoal: 0, down: 0 };
  const looks = STYLE === 'house' ? HOUSE_CATS : CATS;
  const cats = looks.slice(0, mobile ? 2 : 3).map((look, i) => ({
    ...look, look,
    x: W * 0.5 - 60 - i * 55, y: H + 40, vx: 0, vy: 0,
    face: 1, phase: i * 1.7, still: 0, speed: 0, state: 'walk', tail: Math.random() * 6,
    seed: Math.random() * 10, blink: 1, blinkT: 1 + Math.random() * 4, twitch: 0, pounce: null,
  }));
  const catScale = STYLE === 'house' ? 1.1 : 1;
  // the lead cat hunts the cursor: a fast flick then a sudden stop makes it crouch, wiggle and pounce
  const hunt = { px: 0, py: 0, energy: 0, calm: 0, cooldown: 3 };
  const hearts = [];
  const paws = [];
  let lastPaw = { x: 0, y: 0 }, pawSide = 1;

  if (fine) {
    document.documentElement.classList.add('has-cats');
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
      mouse.hoverGoal = e.target.closest?.('a, button, [data-cursor], [data-stub], [data-clay], [data-record], [data-develop]') ? 1 : 0;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.inside = false; });
    addEventListener('pointerdown', () => {
      mouse.down = 1;
      const c = cats[0];
      if (Math.hypot(c.x - mouse.x, c.y - mouse.y) < 90) {
        hearts.push({ x: c.x + c.face * 18 * scale, y: c.y - 44 * scale, t: 0 });
        if (Math.random() < 0.5) audio.sfx.mrrp();
      }
    });
  } else {
    // on phones the cats stroll along the bottom edge toward wherever you last tapped
    mouse.y = H - 18;
    addEventListener('pointerdown', (e) => { mouse.x = e.clientX; }, { passive: true });
    setInterval(() => { if (Math.random() < 0.5) mouse.x = 40 + Math.random() * (W - 80); }, 7000);
  }

  function leg(x0, y0, x1, y1, fill) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 5.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function tailPath(points, fill) {
    for (const [w, col] of [[5.6, INK], [2.6, fill]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(points[0], points[1]);
      ctx.quadraticCurveTo(points[2], points[3], points[4], points[5]);
      ctx.stroke();
    }
  }
  function head(x, y, c, sleeping) {
    ctx.fillStyle = c.fill; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 4); ctx.lineTo(x - 5, y - 14); ctx.lineTo(x - 1, y - 7);
    ctx.lineTo(x + 3, y - 7); ctx.lineTo(x + 7, y - 14); ctx.lineTo(x + 8, y - 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, 9, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.eye; ctx.strokeStyle = c.eye;
    if (sleeping) {
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x + 4, y - 1, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x + 4, y - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + 8.4, y + 2, 1, 0, Math.PI * 2); ctx.fill();
  }
  function stripes(cx, cy, n) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const x = cx - 8 + i * 7;
      ctx.beginPath(); ctx.moveTo(x, cy - 8); ctx.quadraticCurveTo(x + 2, cy - 4, x, cy - 1); ctx.stroke();
    }
  }

  function drawCat(c, t) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.face * scale, scale);
    const sway = Math.sin(t * 2 + c.tail) * 4;
    if (c.state === 'walk') {
      const bob = Math.sin(c.phase * 2) * 1.1;
      const L = 12;
      const legs = [[-13, 0], [-8, Math.PI], [9, Math.PI + 0.4], [14, 0.4]];
      for (const [hx, off] of legs.slice(0, 2)) { const a = Math.sin(c.phase + off) * 0.55; leg(hx, -12 + bob, hx + Math.sin(a) * L, -12 + bob + Math.cos(a) * L, c.fill); }
      tailPath([-16, -19 + bob, -32, -18 + sway, -30, -36 + sway], c.fill);
      ctx.fillStyle = c.fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -18 + bob, 19, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (c.stripes) stripes(0, -18 + bob, 3);
      for (const [hx, off] of legs.slice(2)) { const a = Math.sin(c.phase + off) * 0.55; leg(hx, -12 + bob, hx + Math.sin(a) * L, -12 + bob + Math.cos(a) * L, c.fill); }
      head(19, -26 + bob, c, false);
    } else if (c.state === 'sit') {
      tailPath([-6, -2, 6, 7, 20, 0], c.fill);
      ctx.fillStyle = c.fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-1, -15, 10.5, 15, -0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (c.stripes) stripes(-1, -12, 2);
      leg(4, -12, 4.5, 0, c.fill); leg(8.5, -12, 9, 0, c.fill);
      head(4, -33, c, false);
    } else {
      // asleep: a loaf with its tail wrapped round
      ctx.fillStyle = c.fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -8.5, 18, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (c.stripes) stripes(-3, -8, 3);
      tailPath([-16, -4, -6, 5, 12, 0], c.fill);
      head(13, -12, c, true);
      const zt = (t * 0.6 + c.tail) % 1;
      ctx.save(); ctx.scale(c.face, 1);
      ctx.fillStyle = INK; ctx.globalAlpha = 1 - zt;
      ctx.font = `italic ${10 + zt * 6}px Fraunces, serif`;
      ctx.fillText('z', c.face * (16 + zt * 10), -26 - zt * 22);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- the page is their house: tops of headings, photos and cards are ledges ----------
  const perchMode = STYLE === 'house' && fine;
  const PERCHES = '.display, .room__name, .room__media, .place__media, .postcard, .pass__main, .stop, .note, .person__portrait, .guestbook, .drone__frame, .dinners__stack, .arrive__col, .stat, .scores li, .statement';
  const visible = new Set();
  if (perchMode) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
    document.querySelectorAll(PERCHES).forEach((el) => io.observe(el));
  }
  const FLOOR = { floor: true };
  const rectOf = (el) => (el === FLOOR ? { left: 0, right: W, top: H - 4 } : el.getBoundingClientRect());
  const usable = (el, r) => r.width > 90 && r.top > 70 && r.top < H - 24 && el.style.visibility !== 'hidden' && getComputedStyle(el).opacity > 0.3;
  // the closest ledge right under the cursor, or the floor
  function ledgeAt(x, y) {
    // inside an element: the cats climb onto that one (the smallest, so a photo beats its section);
    // otherwise they take the nearest edge just below the cursor
    let inside = null, insideArea = Infinity, below = FLOOR, bestDy = Infinity;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      if (x < r.left - 6 || x > r.right + 6 || !usable(el, r)) continue;
      if (y >= r.top - 48 && y <= r.bottom) {
        const area = r.width * r.height;
        if (area < insideArea) { insideArea = area; inside = el; }
      } else if (r.top > y && r.top - y < bestDy) { bestDy = r.top - y; below = el; }
    }
    return inside || below;
  }
  const span = (el) => { const r = rectOf(el); return [Math.max(24, r.left + 24), Math.min(W - 24, r.right - 24)]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function jump(c, to, tx, dur) {
    const r = rectOf(to);
    const up = c.y - r.top;
    c.jump = { t: 0, dur: dur ?? clamp(0.32 + Math.hypot(tx - c.x, up) / 1600, 0.32, 0.7), fx: c.x, fy: c.y, tx, to, h: up > 0 ? up * 0.25 + 46 : 22 };
    c.face = Math.sign(tx - c.x) || c.face;
  }

  let last = performance.now(), side = -1;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // The line of cats keeps to one side of the cursor and only swaps sides once the cursor has
    // clearly crossed over. (Tying the target to each cat's own facing made it flip forever.)
    const lead = cats[0];
    if (lead.x < mouse.x - 30) side = -1;
    else if (lead.x > mouse.x + 30) side = 1;

    const mv = Math.hypot(mouse.x - hunt.px, mouse.y - hunt.py) / Math.max(dt, 1e-3);
    hunt.px = mouse.x; hunt.py = mouse.y;
    hunt.energy = Math.max(hunt.energy * Math.exp(-dt * 1.1), mv > 900 ? 1 : 0);
    hunt.calm = mv < 40 ? hunt.calm + dt : 0;
    hunt.cooldown -= dt;

    const target = perchMode ? ledgeAt(mouse.x, mouse.y) : null;

    cats.forEach((c, i) => {
      // blinking and ear twitches keep them alive even when nothing happens
      c.blinkT -= dt;
      if (c.blinkT < 0) { c.blink = 0.1; if (c.blinkT < -0.13) { c.blink = 1; c.blinkT = 2 + Math.random() * 4.5; } }
      c.twitch = c.twitch > 0 ? c.twitch - dt : (Math.random() < dt * 0.15 ? 0.3 : 0);

      if (perchMode) {
        c.surf ??= FLOOR;
        // in the air: a jump (or a pounce) lands on a ledge that may itself be moving with the page
        if (c.jump) {
          const j = c.jump;
          j.t += dt;
          const u = Math.min(1, j.t / j.dur);
          const ty = rectOf(j.to).top;
          c.x = j.fx + (j.tx - j.fx) * u;
          c.y = j.fy + (ty - j.fy) * u - Math.sin(u * Math.PI) * j.h;
          c.state = 'leap'; c.leapTilt = (u - 0.5) * 0.6;
          if (u >= 1) {
            c.surf = j.to; c.jump = null; c.state = 'sit'; c.leapTilt = 0; c.still = 0.4; c.vx = 0;
            if (j.pounce) {
              hunt.cooldown = 6; hunt.energy = 0;
              hearts.push({ x: c.x + c.face * 20, y: c.y - 46, t: 0 });
              if (Math.random() < 0.6) audio.sfx.mrrp();
            }
          }
          return;
        }
        // the hunt: a fast flick and a sudden stop -> crouch, wiggle, pounce onto the cursor's ledge
        if (i === 0) {
          const d = Math.hypot(mouse.x - c.x, mouse.y - c.y);
          if (!c.crouch && hunt.cooldown <= 0 && hunt.energy > 0.45 && hunt.calm > 0.12 && d > 70 && d < 380 && c.state !== 'sleep') {
            c.crouch = { t: 0, to: target };
            c.face = Math.sign(mouse.x - c.x) || c.face;
          }
          if (c.crouch) {
            c.crouch.t += dt;
            c.state = 'crouch'; c.vx = 0; c.still = 0;
            c.y = rectOf(c.surf).top;
            if (c.crouch.t > 0.8) {
              const [lo, hi] = span(c.crouch.to);
              jump(c, c.crouch.to, clamp(mouse.x - Math.sign(mouse.x - c.x || 1) * 20, lo, hi), 0.42);
              c.jump.pounce = true; c.jump.h = Math.max(c.jump.h, 70);
              c.crouch = null;
            }
            return;
          }
        }
        // the ledge scrolled away or vanished: hop down to the floor
        if (c.surf !== FLOOR) {
          const r = c.surf.getBoundingClientRect();
          if (!visible.has(c.surf) || !usable(c.surf, r) || c.x < r.left - 10 || c.x > r.right + 10) {
            jump(c, FLOOR, c.x, 0.4);
            return;
          }
        }
        c.y = rectOf(c.surf).top;
        // follow the cursor's ledge, one cat after another
        if (c.surf !== target) {
          c.wait = (c.wait || 0) + dt;
          c.state = c.speed > 22 ? 'walk' : 'sit';
          if (c.wait > 0.18 + i * 0.22) {
            const [lo, hi] = span(target);
            jump(c, target, clamp(mouse.x + side * (46 + 62 * i) * scale * catScale, lo, hi));
            c.wait = 0;
          }
          return;
        }
        c.wait = 0;
        // walk along the ledge
        const [lo, hi] = span(c.surf);
        const tx = clamp(mouse.x + side * (46 + 62 * i) * scale * catScale, lo, hi);
        const dx = tx - c.x;
        const want = Math.abs(dx) > 8 ? Math.sign(dx) * Math.min(380 * (1 - i * 0.06), (Math.abs(dx) - 8) * 3.2) : 0;
        c.vx += (want - c.vx) * (1 - Math.exp(-dt * 7));
        c.x = clamp(c.x + c.vx * dt, lo - 12, hi + 12);
        c.speed = Math.abs(c.vx);
        if (c.speed > 40) c.face = Math.sign(c.vx);
        else if (c.speed < 22) c.face = Math.sign(mouse.x - c.x) || c.face;
        c.phase += c.speed * dt * 0.11;
        if (c.speed > 22) { c.still = 0; c.state = 'walk'; } else {
          c.still += dt;
          c.state = c.still > 8 + i * 1.5 ? 'sleep' : c.still > 0.35 ? 'sit' : c.state;
        }
        if (!mouse.inside) c.state = c.still > 1 ? 'sleep' : c.state;
        return;
      }

      const tx = mouse.x + side * (46 + 62 * i) * scale * catScale;
      const ty = fine ? mouse.y + (34 + i * 5) * scale : H - 16;
      const dx = tx - c.x, dy = ty - c.y;
      const dist = Math.hypot(dx, dy);
      const max = (fine ? 420 : 120) * (1 - i * 0.06);
      // a small dead zone so a resting cat stops instead of hunting back and forth
      const want = dist > 8 ? Math.min(max, (dist - 8) * 3.2) : 0;
      const k = 1 - Math.exp(-dt * 7);
      c.vx += ((dist ? dx / dist : 0) * want - c.vx) * k;
      c.vy += ((dist ? dy / dist : 0) * want - c.vy) * k;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.speed = Math.hypot(c.vx, c.vy);
      // walking: face where you go; resting: look at the cursor
      if (c.speed > 40 && Math.abs(c.vx) > 30) c.face = Math.sign(c.vx);
      else if (c.speed < 22 && fine) c.face = -side;
      c.phase += c.speed * dt * 0.11;
      if (c.speed > 22) { c.still = 0; c.state = 'walk'; } else {
        c.still += dt;
        c.state = c.still > 8 + i * 1.5 ? 'sleep' : c.still > 0.35 ? 'sit' : c.state;
      }
      if (fine && !mouse.inside) c.state = c.still > 1 ? 'sleep' : c.state;
    });
    if (STYLE === 'paws') {
      // paw prints trail the cursor instead of cats, left and right in turn, fading away
      const lead = cats[0];
      if (Math.hypot(lead.x - lastPaw.x, lead.y - lastPaw.y) > 34) {
        const a = Math.atan2(lead.y - lastPaw.y, lead.x - lastPaw.x);
        pawSide = -pawSide;
        paws.push({ x: lead.x + Math.cos(a + Math.PI / 2) * 9 * pawSide, y: lead.y + Math.sin(a + Math.PI / 2) * 9 * pawSide, a, t: 0 });
        lastPaw = { x: lead.x, y: lead.y };
      }
      for (let i = paws.length - 1; i >= 0; i--) {
        const pw = paws[i];
        pw.t += dt;
        if (pw.t > 1.8) { paws.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(pw.x, pw.y); ctx.rotate(pw.a + Math.PI / 2); ctx.scale(scale, scale);
        ctx.globalAlpha = 1 - pw.t / 1.8;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(0, 3, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
        [[-6, -4], [-2, -8], [2, -8], [6, -4]].forEach(([px, py]) => { ctx.beginPath(); ctx.ellipse(px, py, 2.2, 2.8, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      }
    } else {
      // draw back to front so the leader is on top
      for (let i = cats.length - 1; i >= 0; i--) {
        const c = cats[i];
        if (STYLE !== 'house') { drawCat(c, t); continue; }
        const sc = scale * catScale;
        // eyes follow the cursor from wherever the head is
        const hx = c.x + c.face * 27 * sc, hy = c.y - 36 * sc;
        const lx = Math.max(-1, Math.min(1, ((mouse.x - hx) * c.face) / 160));
        const ly = Math.max(-1, Math.min(1, (mouse.y - hy) / 160));
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.face * sc, sc);
        drawHouseCat(ctx, c, t, lx, ly);
        ctx.restore();
      }
    }

    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.t += dt;
      if (h.t > 1.2) { hearts.splice(i, 1); continue; }
      const s = 1 + h.t * 0.6;
      ctx.save();
      ctx.translate(h.x + Math.sin(h.t * 7) * 6, h.y - h.t * 40);
      ctx.scale(s, s);
      ctx.globalAlpha = 1 - h.t / 1.2;
      ctx.fillStyle = '#fbb600'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-9, -3, -4, -10, 0, -5); ctx.bezierCurveTo(4, -10, 9, -3, 0, 4);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (fine && mouse.inside) {
      mouse.hover += (mouse.hoverGoal - mouse.hover) * (1 - Math.exp(-dt * 14));
      mouse.down *= Math.exp(-dt * 10);
      const r = 5 + mouse.hover * 13 - mouse.down * 2;
      ctx.lineWidth = 2; ctx.strokeStyle = INK;
      ctx.fillStyle = `rgba(251, 182, 0, ${1 - mouse.hover * 0.75})`;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (import.meta.env.DEV) { window.__cats = cats; window.__hunt = hunt; }
  return { wake() {} };
}
