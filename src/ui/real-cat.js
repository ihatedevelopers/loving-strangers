// A cat painted, not outlined: real proportions, soft shading and a coat of short fur strokes.
// Poses: sit, groom, yawn, loaf, sleep, walk, stretch. Everything is drawn facing right; mirror outside.

export const COATS = {
  ginger: { base: '#d9883e', light: '#f2bf7f', shadow: '#9a5420', stripe: 'rgba(150, 72, 20, .55)', belly: '#f3d2a2', eye: ['#c8d85a', '#7e9a2a'], nose: '#d98a7f', ear: '#d99a8c', whisker: 'rgba(255,255,255,.8)' },
  white: { base: '#efece6', light: '#ffffff', shadow: '#b8bcc6', stripe: null, belly: '#ffffff', eye: ['#9fd8f6', '#3f8fc4'], nose: '#e9a2a6', ear: '#efb7bc', whisker: 'rgba(120,120,120,.55)' },
  grey: { base: '#8e9094', light: '#c9cbcf', shadow: '#55575c', stripe: 'rgba(58, 60, 64, .5)', belly: '#dcdddf', eye: ['#e0cb62', '#9c8a2c'], nose: '#b98a8c', ear: '#caa0a4', whisker: 'rgba(255,255,255,.75)' },
  cream: { base: '#e6c79c', light: '#f9e8cc', shadow: '#b48b5c', stripe: 'rgba(176, 122, 72, .32)', belly: '#fbefdf', eye: ['#b3d872', '#5f912e'], nose: '#e0a092', ear: '#e3aea4', whisker: 'rgba(255,255,255,.8)' },
  black: { base: '#232326', light: '#4a4a52', shadow: '#0c0c0e', stripe: null, belly: '#2c2c31', eye: ['#f6d24a', '#c98a12'], nose: '#3a3a40', ear: '#3a3036', whisker: 'rgba(230,230,230,.6)' },
};

// deterministic noise so the fur pattern stays put frame to frame
export function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function ellipse(path, x, y, rx, ry, rot = 0) {
  // start a fresh sub-path, or the pen draws a line from the previous shape
  path.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  path.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  path.closePath();
}
export function limb(path, x0, y0, x1, y1, w0, w1) {
  // a tapered limb as a closed quad with round ends
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  const cx = Math.cos(a), cy = Math.sin(a);
  path.moveTo(x0 + cx * w0, y0 + cy * w0);
  path.lineTo(x1 + cx * w1, y1 + cy * w1);
  path.arc(x1, y1, w1, a, a + Math.PI);
  path.lineTo(x0 - cx * w0, y0 - cy * w0);
  path.arc(x0, y0, w0, a + Math.PI, a);
  path.closePath();
}
function tailPath(path, pts, w0, w1) {
  for (let i = 1; i < pts.length; i++) {
    const k0 = (i - 1) / (pts.length - 1), k1 = i / (pts.length - 1);
    limb(path, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w0 + (w1 - w0) * k0, w0 + (w1 - w0) * k1);
  }
}
function tailPoints(x, y, a0, curl, n, seg, wave, t, speed) {
  const pts = [[x, y]];
  let a = a0;
  for (let i = 1; i <= n; i++) {
    a += curl + Math.sin(t * speed - i * 0.5) * wave * (i / n);
    const [px, py] = pts[i - 1];
    pts.push([px + Math.cos(a) * seg, py + Math.sin(a) * seg]);
  }
  return pts;
}

// the tail is painted as one brush stroke that thins toward the tip (no seams between segments)
export function drawTail(ctx, pts, w0, w1, coat, stripes) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pass = (col, scale, dy, alpha) => {
    ctx.strokeStyle = col; ctx.globalAlpha = alpha;
    for (let i = 1; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      ctx.lineWidth = (w0 + (w1 - w0) * k) * 2 * scale;
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1] + dy); ctx.lineTo(pts[i][0], pts[i][1] + dy); ctx.stroke();
    }
  };
  pass(coat.base, 1, 0, 1);
  pass(coat.shadow, 0.55, 1.4, 0.35);
  pass(coat.light, 0.4, -1.3, 0.35);
  if (stripes && coat.stripe) {
    ctx.strokeStyle = coat.stripe; ctx.globalAlpha = 1;
    for (let i = 2; i < pts.length - 1; i += 2) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i + 1];
      const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1;
      const w = (w0 + (w1 - w0) * (i / pts.length)) * 1.05;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pts[i][0] + nx / l * w, pts[i][1] + ny / l * w); ctx.lineTo(pts[i][0] - nx / l * w, pts[i][1] - ny / l * w); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function earPath(path, x, y, tilt, h) {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const [ax, ay] = P(-5.5, 2), [bx, by] = P(0.5, -h), [cx2, cy2] = P(6, 2), [qx, qy] = P(-2.5, -h * 0.55), [rx, ry] = P(4, -h * 0.5);
  path.moveTo(ax, ay); path.quadraticCurveTo(qx, qy, bx, by); path.quadraticCurveTo(rx, ry, cx2, cy2); path.closePath();
}

// paint a silhouette: base coat, light from above, shadow below, then fur
export function paint(ctx, path, coat, box, seed, stripes) {
  ctx.fillStyle = coat.base;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const [x0, y0, x1, y1] = box;
  let g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, coat.light); g.addColorStop(0.45, coat.base); g.addColorStop(1, coat.shadow);
  ctx.globalAlpha = 0.75; ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = 1;
  // tabby bands
  if (stripes && coat.stripe) {
    const r = rng(seed + 7);
    ctx.strokeStyle = coat.stripe; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const sx = x0 + (i + 0.5) * (x1 - x0) / 9 + (r() - 0.5) * 4;
      ctx.lineWidth = 2.5 + r() * 2.5;
      ctx.beginPath(); ctx.moveTo(sx, y0); ctx.quadraticCurveTo(sx + 5 + r() * 4, (y0 + y1) / 2, sx - 2, y1 - (y1 - y0) * 0.25); ctx.stroke();
    }
  }
  // the coat: hundreds of short hairs, lighter on top, darker underneath
  const r = rng(seed);
  ctx.lineCap = 'round'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 260; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
    const k = (y - y0) / (y1 - y0);
    ctx.strokeStyle = k < 0.5 ? coat.light : coat.shadow;
    ctx.globalAlpha = 0.18 + r() * 0.2;
    const a = -0.5 + r() * 0.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5 + 1.5); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function face(ctx, hx, hy, coat, cat, t, sleeping, glow) {
  const open = sleeping ? 0 : cat.blink;
  // eye: almond, coloured iris, slit pupil that widens in the dark, a catchlight
  const ex = hx + 6.2, ey = hy - 1.2;
  if (open < 0.25) {
    ctx.strokeStyle = 'rgba(30,25,22,.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ex - 3.4, ey); ctx.quadraticCurveTo(ex, ey + 1.6, ex + 3.6, ey - 0.4); ctx.stroke();
  } else {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(ex, ey, 3.6, 2.7 * open, -0.12, 0, Math.PI * 2);
    const ig = ctx.createRadialGradient(ex, ey, 0.2, ex, ey, 3.6);
    ig.addColorStop(0, coat.eye[0]); ig.addColorStop(1, coat.eye[1]);
    ctx.fillStyle = ig; ctx.fill();
    if (glow) { ctx.shadowColor = coat.eye[0]; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0; }
    ctx.clip();
    const lx = cat.lookX * 1.2, ly = cat.lookY * 0.6;
    ctx.fillStyle = '#0d0d0d';
    ctx.beginPath(); ctx.ellipse(ex + lx, ey + ly, glow ? 1.6 : 0.8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,18,16,.6)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(ex, ey, 3.6, 2.7 * open, -0.12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(ex + 1.2 + cat.lookX * 0.6, ey - 0.9 * open, 0.75, 0, Math.PI * 2); ctx.fill();
  }
  // nose and mouth
  ctx.fillStyle = coat.nose;
  ctx.beginPath(); ctx.moveTo(hx + 13.2, hy + 2.4); ctx.lineTo(hx + 15.2, hy + 1.8); ctx.lineTo(hx + 14.6, hy + 3.9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,28,.45)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(hx + 14.6, hy + 3.9); ctx.quadraticCurveTo(hx + 14, hy + 6, hx + 12, hy + 5.6); ctx.stroke();
  // whiskers
  ctx.strokeStyle = coat.whisker; ctx.lineWidth = 0.45;
  for (const [dx, dy] of [[13, -2.5], [14, 0.5], [12.5, 3.5]]) {
    ctx.beginPath(); ctx.moveTo(hx + 13, hy + 4); ctx.quadraticCurveTo(hx + 13 + dx * 0.6, hy + 4 + dy * 0.5, hx + 13 + dx, hy + 4 + dy); ctx.stroke();
  }
}

function headPath(path, hx, hy, tilt, earTwitch) {
  // skull, cheeks, muzzle and two ears as one shape
  ellipse(path, hx, hy, 10.5, 9.2, tilt);
  ellipse(path, hx + 2, hy + 3.4, 10, 6.2, tilt);
  ellipse(path, hx + 11, hy + 3, 5.2, 4.2, tilt);
  earPath(path, hx - 4, hy - 6.5, -0.32 + earTwitch, 11);
  earPath(path, hx + 4.5, hy - 7.5, 0.12, 11.5);
}

function innerEars(ctx, hx, hy, coat, earTwitch) {
  const p = new Path2D();
  earPath(p, hx - 4, hy - 7, -0.32 + earTwitch, 7);
  earPath(p, hx + 4.5, hy - 8, 0.12, 7.5);
  ctx.fillStyle = coat.ear; ctx.globalAlpha = 0.75; ctx.fill(p); ctx.globalAlpha = 1;
}

export function drawRealCat(ctx, cat, pose, t, glow = false) {
  const coat = COATS[cat.coat];
  const tw = cat.twitch > 0 ? Math.sin(t * 40) * 0.12 : 0;
  // soft contact shadow
  ctx.fillStyle = 'rgba(15, 15, 12, .2)';
  ctx.beginPath(); ctx.ellipse(-2, 1, pose === 'walk' ? 30 : 26, 3.4, 0, 0, Math.PI * 2); ctx.fill();

  const body = new Path2D();
  let hx, hy, sleeping = false, box, tailFront = null, tailBack = null;

  if (pose === 'sleep') {
    const br = 1 + Math.sin(t * 1.5 + cat.seed) * 0.03;
    ellipse(body, -2, -13 * br, 30, 13.5 * br);
    ellipse(body, -18, -12, 14, 12);
    tailFront = tailPoints(-30, -5, 0.15, -0.05, 10, 5.4, 0.04, t, 1);
    hx = 19; hy = -12; sleeping = true;
    headPath(body, hx, hy, 0.25, tw);
    box = [-46, -32, 34, 2];
  } else if (pose === 'loaf') {
    ellipse(body, -4, -14, 29, 14);
    ellipse(body, 12, -16, 12, 12.5);
    tailFront = tailPoints(-30, -5, 0.1, -0.02, 9, 5.2, 0.12, t, 1.6);
    hx = 22; hy = -30;
    headPath(body, hx, hy, 0, tw);
    box = [-44, -46, 38, 2];
  } else if (pose === 'walk' || pose === 'stretch') {
    const ph = cat.phase;
    const st = pose === 'stretch' ? 1 : 0;
    const bob = Math.sin(ph * 2) * 0.8 * (1 - st);
    ellipse(body, -2, -27 + bob + st * 6, 30, 11.5, st * 0.12);
    ellipse(body, 18, -28 + bob + st * 12, 12, 12);
    ellipse(body, -20, -26 + bob, 12, 11.5);
    const sw = 0.42 * (1 - st);
    const legs = [[-22, ph], [-14, ph + Math.PI], [14, ph + Math.PI + 0.3], [21, ph + 0.3]];
    legs.forEach(([lx, p], k) => {
      const a = Math.sin(p) * sw + (st && k > 1 ? -0.7 : 0);
      const top = -20 + bob + (st && k > 1 ? 10 : 0);
      limb(body, lx, top, lx + Math.sin(a) * 19, Math.min(0, top + Math.cos(a) * 19), 3.8, 2.6);
    });
    tailBack = tailPoints(-30, -29 + bob, st ? -0.2 : -2.3, st ? 0 : 0.17, 11, 5, 0.22, t, 2.2);
    hx = 34; hy = -38 + bob + st * 20;
    headPath(body, hx, hy, st * 0.3, tw);
    box = [-52, -60, 50, 2];
  } else {
    // sit, groom and yawn share the seated body
    ellipse(body, -12, -18, 19, 17.5);
    ellipse(body, 4, -32, 12.5, 21, -0.25);
    const paw = pose === 'groom' ? Math.sin(t * 7) * 0.5 + 0.5 : 0;
    limb(body, 9, -18, 11, 0, 4, 3);
    if (pose === 'groom') limb(body, 12, -24, 18, -48 + paw * 3, 3.8, 3);
    else limb(body, 14, -18, 16, 0, 4, 3);
    tailFront = tailPoints(-28, -4, 0.05, -0.035, 10, 4.8, 0.3, t, 1.4);
    hx = pose === 'groom' ? 9 : 8; hy = pose === 'groom' ? -54 + paw * 2 : -60;
    const tilt = pose === 'yawn' ? -0.35 : pose === 'groom' ? 0.35 : 0;
    headPath(body, hx, hy, tilt, tw);
    box = [-40, -84, 34, 2];
    sleeping = pose === 'yawn';
  }

  if (tailBack) drawTail(ctx, tailBack, 4.4, 2.4, coat, !!coat.stripe);
  paint(ctx, body, coat, box, cat.seed * 13, !!coat.stripe);
  if (tailFront) drawTail(ctx, tailFront, 4.4, 2.4, coat, !!coat.stripe);
  innerEars(ctx, hx, hy, coat, tw);
  // a pale chest and chin
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = coat.belly; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(hx + 6, hy + 6, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore();
  face(ctx, hx, hy, coat, cat, t, sleeping, glow);
  if (pose === 'yawn') {
    ctx.fillStyle = '#7a3a3e';
    ctx.beginPath(); ctx.ellipse(hx + 12, hy + 6, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}
