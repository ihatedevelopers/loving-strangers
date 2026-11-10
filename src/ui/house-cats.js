// The hostel's own three cats, drawn properly: a ginger, the blue-eyed white one and a black one.
// Soft shapes, eyes that follow you and blink, a tail that never stops talking.

export const HOUSE_CATS = [
  { name: 'ginger', base: '#e9963f', dark: '#c46a23', light: '#f8dcb4', eye: '#93cf4c', nose: '#e58b8b', earIn: '#f1b6a2', stripes: true },
  { name: 'white', base: '#f7f4ef', dark: '#d5d9e0', light: '#ffffff', eye: '#7cc4f0', nose: '#efa3a8', earIn: '#f4c3c8', stripes: false },
  { name: 'black', base: '#2c2d31', dark: '#17181b', light: '#4b4d55', eye: '#f3c435', nose: '#45464c', earIn: '#55474f', stripes: false },
];

const LINE = 'rgba(28, 28, 26, .55)';

function capsule(ctx, x0, y0, x1, y1, w, col, edge) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = edge; ctx.lineWidth = w + 1.6;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// a leg that swings from the hip, with a round paw
function leg(ctx, x, y, angle, len, col, edge) {
  const fx = x + Math.sin(angle) * len, fy = y + Math.cos(angle) * len;
  capsule(ctx, x, y, fx, fy, 6.4, col, edge);
  ctx.fillStyle = col; ctx.strokeStyle = edge; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.ellipse(fx + 1.2, fy, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// a tail made of short segments; each one bends a little more and lags a little behind
function tail(ctx, x, y, base, curl, amp, t, speed, col, edge, n = 9, seg = 4.4) {
  const pts = [[x, y]];
  let a = base;
  for (let i = 1; i <= n; i++) {
    a += curl + Math.sin(t * speed - i * 0.55) * amp * (i / n);
    const [px, py] = pts[i - 1];
    pts.push([px + Math.cos(a) * seg, py + Math.sin(a) * seg]);
  }
  for (const [w, c] of [[7.2, edge], [5.6, col]]) {
    ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = w * (1 - (i / pts.length) * 0.35);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  }
}

function ear(ctx, x, y, tilt, look) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = look.base; ctx.strokeStyle = LINE; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-5.2, 3); ctx.quadraticCurveTo(-1.5, -9, 0.5, -9.5); ctx.quadraticCurveTo(3, -6, 5.4, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = look.earIn;
  ctx.beginPath(); ctx.moveTo(-2.6, 2); ctx.quadraticCurveTo(-0.5, -5.5, 0.6, -6); ctx.quadraticCurveTo(2, -3.5, 3, 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function eye(ctx, x, y, r, look, open, lx, ly, wide) {
  if (open < 0.2) {
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(x, y - 0.6, r * 0.9, 0.25, Math.PI - 0.25); ctx.stroke();
    return;
  }
  ctx.fillStyle = look.eye; ctx.strokeStyle = LINE; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.88 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#141414';
  ctx.beginPath(); ctx.ellipse(x + lx * r * 0.35, y + ly * r * 0.3, wide ? r * 0.62 : r * 0.28, r * 0.78 * open, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath(); ctx.arc(x + lx * r * 0.3 + r * 0.25, y - r * 0.3 * open, r * 0.22, 0, Math.PI * 2); ctx.fill();
}

function head(ctx, x, y, look, c, t, lx, ly, sleeping, wide) {
  ear(ctx, x - 5, y - 6.5, -0.28 + Math.sin(t * 0.7 + c.seed) * 0.04 * (c.twitch > 0 ? 6 : 1), look);
  ear(ctx, x + 5, y - 7, 0.22, look);
  ctx.fillStyle = look.base; ctx.strokeStyle = LINE; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(x, y, 10.5, 9.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // fluffy cheeks
  ctx.beginPath(); ctx.ellipse(x + 1, y + 3.2, 11.2, 6.6, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = look.light;
  ctx.beginPath(); ctx.ellipse(x + 5, y + 4, 5.4, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  if (look.stripes) {
    ctx.strokeStyle = look.dark; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 9); ctx.lineTo(x + dx * 0.6, y - 5); ctx.stroke(); }
  }
  const open = sleeping ? 0 : c.blink;
  eye(ctx, x + 6.2, y - 0.4, 2.7, look, open, lx, ly, wide);
  eye(ctx, x - 0.6, y - 0.8, 2.3, look, open, lx, ly, wide);
  // nose, mouth, whiskers
  ctx.fillStyle = look.nose;
  ctx.beginPath(); ctx.moveTo(x + 9.6, y + 3); ctx.lineTo(x + 11.6, y + 2.6); ctx.lineTo(x + 10.8, y + 4.4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = LINE; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(x + 10.8, y + 4.4); ctx.quadraticCurveTo(x + 10, y + 6.4, x + 8.4, y + 5.8); ctx.stroke();
  ctx.strokeStyle = look.name === 'black' ? 'rgba(235,235,235,.55)' : 'rgba(60,60,60,.35)'; ctx.lineWidth = .6;
  for (const [ex, ey] of [[22, -2], [23, 1.5], [21.5, 5]]) { ctx.beginPath(); ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + ex, y + ey); ctx.stroke(); }
}

export function drawHouseCat(ctx, c, t, lx, ly) {
  const look = c.look;
  const edge = LINE;
  // soft shadow on whatever it walks on
  ctx.fillStyle = 'rgba(20, 20, 18, .16)';
  ctx.beginPath(); ctx.ellipse(0, 1, c.state === 'sleep' ? 22 : 24, 3.6, 0, 0, Math.PI * 2); ctx.fill();

  if (c.state === 'walk' || c.state === 'leap' || c.state === 'crouch') {
    const crouch = c.state === 'crouch' ? 1 : 0;
    const leaping = c.state === 'leap';
    const bob = leaping ? 0 : Math.sin(c.phase * 2) * 1.2;
    const low = crouch * 8;
    const wig = crouch ? Math.sin(t * 34) * 2.2 : 0; // the famous pre-pounce bum wiggle
    const g = leaping ? 0.75 : 1;
    ctx.save();
    if (leaping) ctx.rotate(c.leapTilt || 0);
    // far legs
    const sw = leaping ? 0 : 0.6;
    leg(ctx, -15 + wig, -15 + bob + low, leaping ? 0.9 : Math.sin(c.phase + Math.PI) * sw, 13 * g - low * 0.6, look.dark, edge);
    leg(ctx, 13, -15 + bob + low, leaping ? -1.1 : Math.sin(c.phase) * sw, 13 * g - low * 0.6, look.dark, edge);
    tail(ctx, -24 + wig, -24 + bob + low, crouch ? 3.0 : -2.2, crouch ? 0.06 : 0.16, crouch ? 0.5 : 0.28, t, crouch ? 9 : 3, look.base, edge);
    // body: a soft bean, a little lighter underneath
    const gr = ctx.createLinearGradient(0, -32 + low, 0, -12 + low);
    gr.addColorStop(0, look.base); gr.addColorStop(1, look.name === 'black' ? look.light : look.light);
    ctx.fillStyle = gr; ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
    ctx.beginPath();
    const y0 = bob + low;
    ctx.moveTo(-22 + wig, -30 + y0 + crouch * -3);
    ctx.bezierCurveTo(-8, -33 + y0, 6, -29 + y0, 16, -31 + y0);
    ctx.bezierCurveTo(24, -32 + y0, 28, -24 + y0, 24, -17 + y0);
    ctx.bezierCurveTo(20, -12 + y0, 4, -11 + y0, -4, -12 + y0);
    ctx.bezierCurveTo(-14, -12 + y0, -24 + wig, -13 + y0, -28 + wig, -19 + y0);
    ctx.bezierCurveTo(-31 + wig, -25 + y0, -28 + wig, -30 + y0, -22 + wig, -30 + y0 + crouch * -3);
    ctx.fill(); ctx.stroke();
    if (look.stripes) {
      ctx.strokeStyle = look.dark; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const sx of [-16, -9, -2, 5, 12]) {
        ctx.beginPath(); ctx.moveTo(sx + wig * 0.3, -31 + y0); ctx.quadraticCurveTo(sx + 2, -26 + y0, sx, -21 + y0); ctx.stroke();
      }
    }
    // near legs
    leg(ctx, -11 + wig, -15 + bob + low, leaping ? 1.1 : Math.sin(c.phase) * sw, 13 * g - low * 0.6, look.base, edge);
    leg(ctx, 17, -15 + bob + low, leaping ? -1.3 : Math.sin(c.phase + Math.PI) * sw, 13 * g - low * 0.6, look.base, edge);
    head(ctx, 27, -34 + bob + low * 1.25, look, c, t, lx, ly, false, crouch || leaping);
    ctx.restore();
  } else if (c.state === 'sit') {
    // tail wrapped neatly round the paws, flicking at the tip
    tail(ctx, -12, -3, -0.02, -0.07, 0.5, t, 2.2, look.base, edge, 8, 4);
    ctx.fillStyle = look.base; ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(-4, -11, 13.5, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // haunch
    const gr = ctx.createLinearGradient(0, -36, 0, -8);
    gr.addColorStop(0, look.base); gr.addColorStop(1, look.light);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.ellipse(4, -21, 10.5, 16.5, -0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // chest
    if (look.stripes) {
      ctx.strokeStyle = look.dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const sy of [-16, -10]) { ctx.beginPath(); ctx.moveTo(-12, sy); ctx.quadraticCurveTo(-6, sy - 3, -1, sy); ctx.stroke(); }
    }
    leg(ctx, 5, -14, 0.02, 13.5, look.base, edge);
    leg(ctx, 10, -14, -0.02, 13.5, look.base, edge);
    head(ctx, 7, -40 + Math.sin(t * 1.3 + c.seed) * 0.4, look, c, t, lx, ly, false, false);
  } else {
    // asleep: a loaf that breathes, tail tucked round the nose
    const breathe = 1 + Math.sin(t * 1.6 + c.seed) * 0.035;
    ctx.save(); ctx.scale(1, breathe);
    ctx.fillStyle = look.base; ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(-1, -10, 21, 10.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (look.stripes) {
      ctx.strokeStyle = look.dark; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
      for (const sx of [-12, -5, 2]) { ctx.beginPath(); ctx.moveTo(sx, -20); ctx.quadraticCurveTo(sx + 2, -15, sx, -10); ctx.stroke(); }
    }
    ctx.restore();
    head(ctx, 14, -13, look, c, t, 0, 0, true, false);
    tail(ctx, -19, -2.5, 0.02, -0.06, 0.08, t, 1.2, look.base, edge, 9, 4.2);
  }
}
