// Shared terrain: the GPU draws this mountain and the camera walks on the same numbers.
// Scene units: the summit sits at H, which stands for 2351 m (Pico, highest point in Portugal).

export const H = 600;
export const METERS_PER_UNIT = 2351 / H;
export const PICO_R = 1750;
export const FAIAL = { x: -5900, z: 700, r: 2000, h: 270 };
export const HOSTEL = { x: -1905, z: 40 };

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x, z, oct = 5) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Distance to the island's spine: Pico is a long island, the volcano sits at its western end.
function spineDist(x, z) {
  const t = Math.min(1, Math.max(0, x / 9000));
  const sx = t * 9000, sz = Math.sin(t * 2.4) * 380;
  return Math.hypot(x - sx, z - sz);
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z * 1.04);
  let h = H * Math.pow(Math.max(0, 1 - r / PICO_R), 1.5);

  // Piquinho: the small steep cone on top of the crater.
  h += 42 * Math.pow(Math.max(0, 1 - Math.hypot(x + 10, z - 8) / 60), 1.2);
  // crater rim dip just around it
  h -= 10 * Math.max(0, 1 - Math.abs(Math.hypot(x, z) - 85) / 40) * smooth(500, 560, h);

  // gullies down the flanks (lava channels)
  const ang = Math.atan2(z, x);
  const gully = Math.pow(Math.abs(Math.sin(ang * 9 + fbm(x * 0.002, z * 0.002) * 4)), 3);
  h -= gully * 18 * smooth(30, 200, h) * (1 - smooth(450, 590, h));

  // eastern ridge running along the island
  const sd = spineDist(x, z);
  const ridge = 190 * Math.exp(-Math.pow(sd / 900, 2)) * smooth(-400, 1800, x);
  h = Math.max(h, ridge);

  // coastal shelf where Madalena and the vineyards sit
  const coast = 2080 + 260 * (fbm(x * 0.0015 + 3, z * 0.0015) - 0.5);
  const d = Math.min(r * 1.0, sd + 180);
  const shelf = 16 * (1 - smooth(coast - 520, coast, d)) - 40 * smooth(coast, coast + 260, d);
  h = Math.max(h, shelf);

  // rough lava texture, strongest on the low slopes
  if (h > 0) h += (fbm(x * 0.006, z * 0.006, 4) - 0.5) * 22 * (0.4 + 0.6 * smooth(0, 120, h));

  // Faial across the channel: a broad dome with a caldera
  const fd = Math.hypot((x - FAIAL.x) * 0.85, z - FAIAL.z);
  let faial = FAIAL.h * Math.pow(Math.max(0, 1 - fd / FAIAL.r), 1.1) - 40;
  faial -= 70 * Math.max(0, 1 - fd / 260);
  h = Math.max(h, faial);

  // Ilhéu Deitado and Ilhéu em Pé, the two islets in front of Madalena
  h = Math.max(h, 26 * Math.max(0, 1 - Math.hypot(x + 2330, z - 160) / 34) - 2);
  h = Math.max(h, 44 * Math.max(0, 1 - Math.hypot(x + 2290, z + 40) / 22) - 2);

  return h;
}

export const toMeters = (h) => Math.max(0, Math.round(h * METERS_PER_UNIT));
