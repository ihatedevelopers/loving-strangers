// Three house cats follow your cursor, drawn in the same ink as the island.
// They trot after it, sit down when it stops, and fall asleep if you leave them long enough.

const INK = '#25261f';
const CATS = [
  { fill: '#fbb600', stripes: true, eye: INK },
  { fill: '#fffdf6', stripes: false, eye: INK },
  { fill: '#2b2c25', stripes: false, eye: '#fbb600' },
];

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
  const cats = CATS.slice(0, mobile ? 2 : 3).map((look, i) => ({
    ...look,
    x: W * 0.5 - 60 - i * 55, y: H + 40, vx: 0, vy: 0,
    face: 1, phase: i * 1.7, still: 0, speed: 0, state: 'walk', tail: Math.random() * 6,
  }));
  const hearts = [];

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

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    cats.forEach((c, i) => {
      let tx, ty;
      if (i === 0) {
        tx = mouse.x - c.face * 46 * scale;
        ty = fine ? mouse.y + 34 * scale : H - 16;
      } else {
        const lead = cats[i - 1];
        tx = lead.x - lead.face * 58 * scale;
        ty = fine ? lead.y + 6 : H - 16;
      }
      const dx = tx - c.x, dy = ty - c.y;
      const dist = Math.hypot(dx, dy);
      const max = (fine ? 420 : 120) * (1 - i * 0.06);
      const want = dist > 4 ? Math.min(max, dist * 3.2) : 0;
      const k = 1 - Math.exp(-dt * 7);
      c.vx += ((dist ? dx / dist : 0) * want - c.vx) * k;
      c.vy += ((dist ? dy / dist : 0) * want - c.vy) * k;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.speed = Math.hypot(c.vx, c.vy);
      if (Math.abs(c.vx) > 14) c.face = Math.sign(c.vx);
      c.phase += c.speed * dt * 0.11;
      if (c.speed > 22) { c.still = 0; c.state = 'walk'; } else {
        c.still += dt;
        c.state = c.still > 8 + i * 1.5 ? 'sleep' : c.still > 0.35 ? 'sit' : c.state;
      }
      if (fine && !mouse.inside) c.state = c.still > 1 ? 'sleep' : c.state;
    });
    // draw back to front so the leader is on top
    for (let i = cats.length - 1; i >= 0; i--) drawCat(cats[i], t);

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
  return { wake() {} };
}
