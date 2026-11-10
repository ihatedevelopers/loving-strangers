import * as THREE from 'three';
import { NOISE, FOG } from './glsl.js';
import { heightAt, HOSTEL, FAIAL } from './terrain.js';

// Pico in colour with a hand-drawn soul: real sky, sea and slopes, outlined lightly in ink,
// and drawn onto paper as you arrive.

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// time of day 0..3: dawn, day, golden hour, dusk. Night is graded on top in the post pass.
const DAY = [
  { top: '#5f9bd3', bot: '#dfe6e6', sunCol: '#ffe2bc', sun: [0.55, 0.22, -0.82] },
  { top: '#4a95d4', bot: '#cde6f4', sunCol: '#fff6e6', sun: [0.35, 0.82, 0.45] },
  { top: '#5d93c8', bot: '#f6cf95', sunCol: '#ffcf8a', sun: [-0.86, 0.18, 0.47] },
  { top: '#4a5f94', bot: '#f19f6e', sunCol: '#ffa060', sun: [-0.97, 0.02, 0.24] },
].map((k) => ({ top: hex(k.top), bot: hex(k.bot), sunCol: hex(k.sunCol), sun: new THREE.Vector3(...k.sun).normalize() }));
const PAPER = hex('#e6ecd6');
const INK = hex('#343631');

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

// shared lighting and atmosphere for every surface
const LIGHT = /* glsl */ `
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyBot;
vec3 shade(vec3 base, vec3 n){
  float ndl = max(dot(n, uSun), 0.) * smoothstep(-.12, .06, uSun.y);
  vec3 ambient = mix(uSkyBot, uSkyTop, .5 + .5 * n.y) * .55 + .12;
  return base * (ambient + uSunCol * ndl * .95);
}
vec3 haze(vec3 col, vec3 w){
  float d = distance(w, uCam);
  return mix(col, uSkyBot, smoothstep(1800., 11000., d) * .78);
}
`;

const TERRAIN_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TERRAIN_FRAG = /* glsl */ `
${NOISE}
${FOG}
${LIGHT}
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 n = normalize(vN);
  float h = vW.y;
  float nz = fbm(vW.xz * .006) - .5;
  float hh = h + nz * 60.;
  // Pico from the sea up: black lava shore, green fields and vines, dark woods, brown scrub, bare lava cone
  vec3 col = vec3(.24, .23, .22);
  col = mix(col, vec3(.44, .58, .30), smoothstep(2., 8., h));
  col = mix(col, vec3(.29, .44, .23), smoothstep(50., 130., hh));
  col = mix(col, vec3(.40, .34, .26), smoothstep(170., 270., hh));
  col = mix(col, vec3(.22, .19, .18), smoothstep(330., 450., hh));
  col *= .9 + .2 * vnoise(vW.xz * .05);
  // steep faces show bare rock
  col = mix(col, vec3(.30, .28, .27), smoothstep(.55, .3, n.y) * smoothstep(20., 60., h));

  // UNESCO vineyards: a lattice of black basalt walls on the low western slopes
  vec2 v = vW.xz + vec2(vnoise(vW.xz * .02), vnoise(vW.xz * .02 + 9.)) * 6.;
  float walls = max(inkLine(v.x / 13., .7), inkLine(v.y / 10., .7));
  float vineZone = smoothstep(4., 9., h) * (1. - smoothstep(55., 80., h)) * smoothstep(-1150., -1450., vW.x) * smoothstep(-260., -420., vW.z);
  col = mix(col, vec3(.16, .15, .15), walls * vineZone * .65);

  col = shade(col, n);
  // a faint contour every ~100 m keeps a touch of the hand-drawn map
  col *= 1. - inkLine(h / 26., .5) * .12 * smoothstep(10., 30., h);
  // white surf where the land meets the sea
  float surf = 1. - smoothstep(.2, 1.6, abs(h - 1.) / max(fwidth(h), 1e-3) * .45);
  col = mix(col, vec3(.95), surf * .8);
  gl_FragColor = vec4(haze(col, vW), 1.);
}`;

const OCEAN_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vW; varying vec3 vN;
float wave(vec2 p){
  return sin(p.x * .018 + uTime * .8) * 1.2 + sin(p.y * .025 - uTime * .6 + p.x * .009) * .9 + sin((p.x + p.y) * .055 + uTime * 1.5) * .3;
}
void main(){
  vec4 w = modelMatrix * vec4(position, 1.);
  float e = 2.;
  float hc = wave(w.xz);
  vec3 n = normalize(vec3(hc - wave(w.xz + vec2(e, 0.)), e, hc - wave(w.xz + vec2(0., e))));
  w.y += hc;
  vW = w.xyz; vN = n;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const OCEAN_FRAG = /* glsl */ `
${NOISE}
${FOG}
${LIGHT}
uniform vec2 uFwd; uniform float uTime;
varying vec3 vW; varying vec3 vN;
float lineSet(float coord, float s, float across){
  float idx = floor(coord / s + .5);
  float dash = smoothstep(.36, .46, vnoise(vec2(across / (34. * s) + uTime * .04 * s, idx * 3.71)));
  return inkLine(coord / s, .55) * dash;
}
void main(){
  vec3 n = normalize(vN);
  vec3 view = normalize(vW - uCam);
  // Atlantic blue that picks up the sky toward the horizon
  float fres = pow(1. - max(dot(-view, n), 0.), 3.);
  vec3 col = mix(vec3(.07, .26, .42), vec3(.13, .40, .58), smoothstep(-1., 1.5, vW.y));
  col = mix(col, mix(uSkyBot, uSkyTop, .35), fres * .75);
  col *= .8 + .35 * max(dot(n, uSun), 0.);
  // light wave lines, like the drawing's sea but in foam
  float along = dot(vW.xz, uFwd);
  float across = dot(vW.xz, vec2(-uFwd.y, uFwd.x));
  float coord = along / 6. + vW.y * .8;
  float lod = max(0., log2(fwidth(coord) * 10.));
  float l0 = floor(lod), fl = fract(lod);
  float line = mix(lineSet(coord, exp2(l0), across), lineSet(coord, exp2(l0 + 1.), across), fl);
  col = mix(col, vec3(.86, .93, .97), line * .22);
  // the sun's path on the water
  vec3 r = reflect(view, n);
  float glint = pow(max(dot(r, uSun), 0.), 60.) * smoothstep(-.05, .1, uSun.y);
  col += uSunCol * glint * 1.4;
  gl_FragColor = vec4(haze(col, vW), 1.);
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyBot; uniform vec3 uMoon; uniform float uTime; uniform float uNight;
varying vec3 vDir;
// the logo's sun: a disc with fifteen rounded rays
float sunShape(vec3 d, vec3 s, float R, bool rays, bool crescent){
  float facing = dot(d, s);
  if (facing <= .6) return 1e3;
  vec3 t1 = normalize(cross(s, vec3(0., 1., 0.)));
  vec3 t2 = cross(t1, s);
  vec2 q = vec2(dot(d, t1), dot(d, t2)) / facing;
  float sdf = length(q) - R;
  if (crescent) sdf = max(sdf, -(length(q - vec2(R * .45, R * .2)) - R * .86));
  if (rays) {
    float rot = uTime * .035;
    vec2 q2 = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * q;
    float sector = 6.2831853 / 15.;
    float ai = floor(atan(q2.y, q2.x) / sector + .5);
    float ac = ai * sector;
    vec2 p = mat2(cos(ac), -sin(ac), sin(ac), cos(ac)) * q2;
    float a0 = R * 1.32, a1 = a0 + R * mix(.55, .95, hash12(vec2(ai, 3.)));
    float ray = length(p - vec2(clamp(p.x, a0, a1), 0.)) - R * .13;
    sdf = min(sdf, ray);
  }
  return sdf;
}
void main(){
  vec3 d = normalize(vDir);
  vec3 col = mix(uSkyBot, uSkyTop, smoothstep(-.02, .55, d.y));
  // warm glow around the sun
  col += uSunCol * pow(max(dot(d, uSun), 0.), 24.) * .35 * (1. - uNight);
  if (uNight < .5) {
    float s = sunShape(d, uSun, .05, true, false);
    float fw = fwidth(s);
    col = mix(col, vec3(.984, .714, 0.), 1. - smoothstep(-fw, fw, s));
  }
  // night: deep blue, a crescent moon and stars
  vec3 nightSky = mix(vec3(.10, .14, .26), vec3(.03, .05, .12), smoothstep(-.02, .6, d.y));
  col = mix(col, nightSky, uNight);
  if (uNight > .01) {
    float m = sunShape(d, uMoon, .045, false, true);
    float fw = fwidth(m);
    col = mix(col, vec3(.98, .92, .72), (1. - smoothstep(-fw, fw, m)) * uNight);
    vec3 g = d * 70.;
    vec3 cell = floor(g);
    vec3 f = fract(g) - .5;
    float hs = hash13(cell);
    float tw = .6 + .4 * sin(uTime * (1. + hs * 3.) + hs * 40.);
    float star = (1. - smoothstep(.0, .09 * hs, length(f))) * step(.9, hs);
    col += vec3(1.) * star * tw * smoothstep(.03, .15, d.y) * uNight;
  }
  gl_FragColor = vec4(col, 1.);
}`;

const CLOUD_VERT = /* glsl */ `
attribute vec4 aCloud; attribute float aSeed;
uniform vec3 uCamRight; uniform float uTime;
varying vec2 vUv; varying float vSeed; varying vec3 vW;
void main(){
  vec3 c = aCloud.xyz + vec3(sin(uTime * .03 + aSeed * 9.) * 40., 0., cos(uTime * .025 + aSeed * 7.) * 30.);
  vec3 w = c + uCamRight * position.x * aCloud.w + vec3(0., 1., 0.) * position.y * aCloud.w;
  vUv = uv; vSeed = aSeed; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;

const CLOUD_FRAG = /* glsl */ `
${NOISE}
${FOG}
${LIGHT}
varying vec2 vUv; varying float vSeed; varying vec3 vW;
void main(){
  vec2 p = (vUv * 2. - 1.) * vec2(2., 1.);
  float d = 1e3;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float r = .42 + .3 * hash12(vec2(fi, vSeed * 13.)) + (i == 2 ? .22 : 0.);
    vec2 c = vec2(-1.35 + fi * .68, -.55 + r);
    d = min(d, length(p - c) - r);
  }
  d = max(d, -(p.y + .55));
  d += (vnoise(p * 6. + vSeed * 20.) - .5) * .06;
  float fw = fwidth(d);
  if (d > fw) discard;
  // white tops, cool grey bellies, a warm rim on the sun side
  vec3 col = mix(mix(uSkyTop, vec3(.72, .76, .82), .6), vec3(1.), smoothstep(-.6, .5, p.y));
  col = mix(col, col * uSunCol * 1.1, .35);
  col *= 1. - (1. - smoothstep(fw * .4, fw * 1.3, abs(d))) * .18;
  gl_FragColor = vec4(haze(col, vW), 1.);
}`;

const WHALE_VERT = /* glsl */ `
uniform vec3 uCamRight; uniform vec3 uWhalePos; uniform float uWhaleRise;
varying vec2 vP; varying vec3 vW;
void main(){
  float size = 60.;
  vec3 w = uWhalePos + uCamRight * position.x * size + vec3(0., 1., 0.) * (position.y + mix(-1.25, .05, uWhaleRise)) * size;
  vP = position.xy; vW = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;

const WHALE_FRAG = /* glsl */ `
${NOISE}
${FOG}
${LIGHT}
uniform float uTime;
varying vec2 vP; varying vec3 vW;
float ellipse(vec2 p, vec2 c, vec2 r, float a){ p -= c; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p; return (length(p / r) - 1.) * min(r.x, r.y); }
void main(){
  if (vW.y < .2) discard;
  vec2 p = vP;
  float lobeL = ellipse(p, vec2(-.43, .5), vec2(.5, .15), -.38);
  float lobeR = ellipse(p, vec2(.43, .5), vec2(.5, .15), .38);
  float w = mix(.07, .16, smoothstep(.4, -1., p.y));
  float stalk = max(abs(p.x) - w, max(p.y - .5, -p.y - 1.2));
  float d = min(min(lobeL, lobeR), stalk);
  d = max(d, -(length(p - vec2(0., .66)) - .06));
  float fw = fwidth(d);
  float drip = step(.6, vnoise(vec2(p.x * 18., p.y * 3. + uTime * 6.))) * step(abs(p.x), .9) * step(p.y, .4) * step(-.4, p.y) * (1. - step(.5, abs(p.x) - .1));
  if (d > fw && drip < .5) discard;
  vec3 col = d > fw ? vec3(.85, .92, .97) : vec3(.17, .19, .22) * (.8 + .4 * smoothstep(-.6, .6, p.y));
  gl_FragColor = vec4(haze(col, vW), 1.);
}`;

const HOUSE_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.);
  vW = w.xyz; vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HOUSE_FRAG = /* glsl */ `
${NOISE}
${FOG}
${LIGHT}
uniform float uRoofYellow;
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 n = normalize(vN);
  float roof = step(.5, n.y);
  // white walls and terracotta roofs, like Madalena; the hostel's roof is the yellow one
  vec3 base = mix(vec3(.93, .92, .88), mix(vec3(.66, .30, .20), vec3(.984, .714, 0.), uRoofYellow), roof);
  gl_FragColor = vec4(haze(shade(base, n), vW), 1.);
}`;

const POST_FRAG = /* glsl */ `
${NOISE}
uniform sampler2D tCol; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar; uniform float uPx; uniform float uNight;
uniform vec3 uPaper, uInk;
uniform float uDraw;
varying vec2 vUv;
float invDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x * 2. - 1.;
  return (uFar + uNear - z * (uFar - uNear)) / (2. * uNear * uFar);
}
void main(){
  vec2 uv = vUv;
  vec3 col = texture2D(tCol, uv).rgb;
  float isSky = step(.99999, texture2D(tDepth, uv).x);

  // fine ink outlines from depth: the hand-drawn soul, kept light
  float tick = floor(uTime * 8.);
  vec2 jit = (vec2(vnoise(vUv * uRes / (70. * uPx) + tick * 17.3), vnoise(vUv * uRes / (70. * uPx) + tick * 9.1 + 40.)) - .5) * uPx / uRes;
  vec2 px = 1.2 * uPx / uRes;
  vec2 ue = uv + jit;
  float wc = invDepth(ue);
  float lap = abs(invDepth(ue - vec2(px.x, 0.)) + invDepth(ue + vec2(px.x, 0.)) - 2. * wc)
            + abs(invDepth(ue - vec2(0., px.y)) + invDepth(ue + vec2(0., px.y)) - 2. * wc);
  float edge = smoothstep(.08, .25, lap / wc) * .55;

  // night: everything below the sky sinks into moonlit blue, spreading like ink through paper
  vec2 asp = vUv * vec2(uRes.x / uRes.y, 1.);
  float bleed = fbm(asp * 2.6) * .8 + vnoise(asp * 24.) * .2;
  float m = smoothstep(bleed - .05, bleed + .05, uNight * 1.25 - .12);
  vec3 moonlit = col * vec3(.22, .27, .42) + vec3(.01, .02, .05);
  col = mix(col, moonlit, m * (1. - isSky));
  col = mix(col, uInk, edge * (1. - m * .6));

  // the island draws itself onto the paper: outlines first, then the colour
  if (uDraw < .999) {
    float n = fbm(asp * 5.) * .5 + distance(vUv, vec2(.5, .62)) * 1.1 + vnoise(asp * 60.) * .08;
    float k = uDraw * 1.9;
    float lines = smoothstep(n - .05, n + .01, k);
    float paint = smoothstep(n - .05, n + .01, k - .5);
    vec3 sketch = mix(uPaper, uInk, edge * 1.6 * lines);
    col = mix(sketch, col, paint);
  }

  float grain = (vnoise(vUv * uRes / (2.2 * uPx)) - .5) * .03 + (hash12(vUv * uRes) - .5) * .02;
  col *= 1. + grain;
  col *= mix(1., .9, smoothstep(.5, 1.2, length(vUv - .5) * 1.5));
  gl_FragColor = vec4(col, 1.);
}`;

export async function createWorld(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  let active = true;
  // pixel ratio within a pixel budget: big retina screens get sharpness only while it stays affordable
  const budget = mobile ? 1.4e6 : 2.6e6;
  const pickPx = () => Math.max(0.75, Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75, Math.sqrt(budget / (innerWidth * innerHeight))));
  let px = pickPx();
  renderer.setPixelRatio(px);
  canvas.addEventListener('webglcontextlost', (e) => {
    // iOS can drop the context in the background: fall back to the photo instead of a frozen canvas
    e.preventDefault();
    active = false;
    document.documentElement.classList.add('no-webgl');
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 5, 40000);
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: DAY[0].sun.clone() },
    uMoon: { value: new THREE.Vector3(-0.5, 0.42, 0.62).normalize() },
    uCam: { value: camera.position },
    uPx: { value: px },
    uNight: { value: 0 },
    uSunCol: { value: DAY[0].sunCol.clone() },
    uSkyTop: { value: DAY[0].top.clone() },
    uSkyBot: { value: DAY[0].bot.clone() },
  };

  // terrain: Pico in detail, Faial in the distance
  const terrainMat = new THREE.ShaderMaterial({ uniforms, vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG });
  const worker = new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' });
  let jobs = 0;
  const failed = new Promise((_, reject) => {
    worker.addEventListener('error', reject);
    setTimeout(() => reject(new Error('terrain worker timeout')), 15000);
  });
  const makeGround = (x0, x1, z0, z1, sx, sz, edge = 0) => new Promise((resolve) => {
    const id = ++jobs;
    const onMsg = ({ data }) => {
      if (data.id !== id) return;
      worker.removeEventListener('message', onMsg);
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, data.heights[i]);
      g.computeVertexNormals();
      resolve(new THREE.Mesh(g, terrainMat));
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, x0, x1, z0, z1, sx, sz, edge });
  });
  const res = mobile ? 0.6 : 1;
  const grounds = await Promise.race([failed, Promise.all([
    makeGround(-2750, 5600, -3000, 3000, Math.round(360 * res), Math.round(260 * res), 700),
    makeGround(FAIAL.x - 2300, FAIAL.x + 2300, FAIAL.z - 2300, FAIAL.z + 2300, Math.round(110 * res), Math.round(110 * res)),
  ])]).finally(() => worker.terminate());
  grounds.forEach((g) => scene.add(g));

  // ocean follows the camera so the horizon never ends
  const oceanUniforms = { ...uniforms, uFwd: { value: new THREE.Vector2(1, 0) } };
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(36000, 36000, mobile ? 140 : 220, mobile ? 140 : 220).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ uniforms: oceanUniforms, vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG }),
  );
  scene.add(ocean);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // clouds: Pico's famous cloud "hat" on its flank, plus a few wanderers
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
    const r = 700 + Math.random() * 260;
    clouds.push([Math.cos(a) * r, 330 + Math.random() * 70, Math.sin(a) * r, 70 + Math.random() * 50]);
  }
  for (let i = 0; i < 12; i++) {
    clouds.push([-2000 + Math.random() * 9000, 1300 + Math.random() * 1200, (Math.random() < .5 ? -1 : 1) * (2500 + Math.random() * 4000), 200 + Math.random() * 220]);
  }
  const cloudGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 1, 1, 1);
  quad.translate(0, 0, 0);
  cloudGeo.index = quad.index;
  cloudGeo.setAttribute('position', quad.attributes.position);
  cloudGeo.setAttribute('uv', quad.attributes.uv);
  cloudGeo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(clouds.flat()), 4));
  cloudGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(clouds.map(() => Math.random())), 1));
  cloudGeo.instanceCount = clouds.length;
  const cloudUniforms = { ...uniforms, uCamRight: { value: new THREE.Vector3(1, 0, 0) } };
  const cloudMesh = new THREE.Mesh(cloudGeo, new THREE.ShaderMaterial({ uniforms: cloudUniforms, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG }));
  cloudMesh.frustumCulled = false;
  scene.add(cloudMesh);

  // a whale in the channel, surfacing for the "whales before breakfast" stop
  const whaleUniforms = { ...uniforms, uCamRight: cloudUniforms.uCamRight, uWhalePos: { value: new THREE.Vector3(-3100, 0, -250) }, uWhaleRise: { value: 0 } };
  const whale = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: whaleUniforms, vertexShader: WHALE_VERT, fragmentShader: WHALE_FRAG }));
  whale.frustumCulled = false;
  whale.visible = false;
  scene.add(whale);
  let whaleOn = false, whaleT = 0;

  // Madalena: little white houses by the harbour, and one with a yellow roof
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  houseGeo.translate(0, 0.5, 0);
  const homes = [];
  let guard = 0;
  while (homes.length < (mobile ? 140 : 240) && guard++ < 6000) {
    const x = -2140 + Math.random() * 520, z = -420 + Math.random() * 840;
    const y = heightAt(x, z);
    if (y < 3 || y > 46 || Math.hypot(x - HOSTEL.x, z - HOSTEL.z) < 16) continue;
    homes.push([x, y, z]);
  }
  const houses = new THREE.InstancedMesh(houseGeo, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uRoofYellow: { value: 0 } }, vertexShader: HOUSE_VERT, fragmentShader: HOUSE_FRAG,
  }), homes.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  homes.forEach(([x, y, z], i) => {
    e.set(0, Math.random() * Math.PI, 0);
    m4.compose(new THREE.Vector3(x, y - 1, z), q.setFromEuler(e), new THREE.Vector3(5 + Math.random() * 4, 3.5 + Math.random() * 3, 4 + Math.random() * 3));
    houses.setMatrixAt(i, m4);
  });
  scene.add(houses);

  const hostelY = heightAt(HOSTEL.x, HOSTEL.z);
  const hostel = new THREE.InstancedMesh(houseGeo, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uRoofYellow: { value: 1 } }, vertexShader: HOUSE_VERT, fragmentShader: HOUSE_FRAG,
  }), 1);
  m4.compose(new THREE.Vector3(HOSTEL.x, hostelY - 1, HOSTEL.z), q.setFromEuler(e.set(0, 0.3, 0)), new THREE.Vector3(11, 6.5, 8));
  hostel.setMatrixAt(0, m4);
  scene.add(hostel);
  const hostelAnchor = new THREE.Vector3(HOSTEL.x, hostelY + 9, HOSTEL.z);

  // render into a semantic buffer, then paint it in the post pass
  const target = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(2, 2);
  target.depthTexture.type = THREE.UnsignedIntType;

  const postUniforms = {
    tCol: { value: target.texture }, tDepth: { value: target.depthTexture },
    uRes: { value: new THREE.Vector2(2, 2) }, uTime: uniforms.uTime, uNight: uniforms.uNight, uPx: uniforms.uPx,
    uNear: { value: camera.near }, uFar: { value: camera.far },
    uPaper: { value: PAPER }, uInk: { value: INK },
    uDraw: { value: 1 },
  };
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: FULLSCREEN_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false }));
  post.frustumCulled = false;
  postScene.add(post);

  // view state: callers set a goal, the world eases toward it
  const goal = { pos: new THREE.Vector3(-4700, 70, 300), look: new THREE.Vector3(0, 320, 0), tod: 0, night: 0, fov: 50 };
  const cur = { pos: goal.pos.clone(), look: goal.look.clone(), tod: 0, night: 0, fov: 50 };
  const pointer = new THREE.Vector2();
  const pointerEased = new THREE.Vector2();
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();

  function applyPalette(tod) {
    const t = Math.min(DAY.length - 1.0001, Math.max(0, tod));
    const i = Math.floor(t), f = t - i;
    const a = DAY[i], b = DAY[i + 1];
    uniforms.uSkyTop.value.lerpVectors(a.top, b.top, f);
    uniforms.uSkyBot.value.lerpVectors(a.bot, b.bot, f);
    uniforms.uSunCol.value.lerpVectors(a.sunCol, b.sunCol, f);
    uniforms.uSun.value.lerpVectors(a.sun, b.sun, f).normalize();
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    px = pickPx();
    uniforms.uPx.value = px;
    renderer.setPixelRatio(px);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const bw = Math.floor(w * px), bh = Math.floor(h * px);
    target.setSize(bw, bh);
    postUniforms.uRes.value.set(bw, bh);
  }
  resize();
  window.addEventListener('resize', resize);

  let raf = 0, last = performance.now(), onFrame = null, odd = false;

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    cur.pos.lerp(goal.pos, k);
    cur.look.lerp(goal.look, k);
    cur.tod += (goal.tod - cur.tod) * k;
    cur.night += (goal.night - cur.night) * k;
    cur.fov += (goal.fov - cur.fov) * k;
    pointerEased.lerp(pointer, 1 - Math.exp(-dt * 2.5));

    camera.position.copy(cur.pos);
    camera.lookAt(cur.look);
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    // a gentle head-turn toward the cursor
    camera.position.addScaledVector(right, pointerEased.x * 14).y += pointerEased.y * 8;
    tmp.copy(cur.look).addScaledVector(right, pointerEased.x * 40);
    tmp.y += pointerEased.y * 25;
    camera.lookAt(tmp);
    if (Math.abs(camera.fov - cur.fov) > 0.01) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }
    const minY = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 6;
    if (camera.position.y < minY) camera.position.y = minY;

    // the whale dives and surfaces on a slow loop while its stop is showing
    if (whaleOn || whaleUniforms.uWhaleRise.value > 0.001) {
      whaleT += dt;
      const cycle = (whaleT % 7) / 7;
      const goalRise = whaleOn ? Math.sin(Math.min(1, cycle / 0.75) * Math.PI) : 0;
      whaleUniforms.uWhaleRise.value += (goalRise - whaleUniforms.uWhaleRise.value) * (1 - Math.exp(-dt * 2.4));
      whale.visible = true;
    } else whale.visible = false;

    applyPalette(cur.tod);
    uniforms.uNight.value = cur.night;
    oceanUniforms.uFwd.value.set(fwd.x, fwd.z).normalize();
    cloudUniforms.uCamRight.value.copy(right);
    ocean.position.set(Math.round(camera.position.x / 200) * 200, 0, Math.round(camera.position.z / 200) * 200);
    sky.position.copy(camera.position);
    sky.scale.setScalar(30000);

    // once the camera has settled, draw "on twos": it matches the 8 fps line boil and saves battery
    const settled = cur.pos.distanceToSquared(goal.pos) < 1 && Math.abs(goal.tod - cur.tod) < 0.002 && Math.abs(goal.night - cur.night) < 0.002 && pointerEased.distanceToSquared(pointer) < 1e-4;
    odd = !odd;
    if (!settled || odd) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    }

    onFrame?.(cur);
    if (active && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && active) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', start);
  // compile every shader in the background before the first frame
  // (compiled against the render target, whale included, so the real first frames hit the cache)
  whale.visible = true;
  renderer.setRenderTarget(target);
  await renderer.compileAsync(scene, camera).catch(() => {});
  renderer.setRenderTarget(null);
  await renderer.compileAsync(postScene, postCam).catch(() => {});
  whale.visible = false;
  start();

  return {
    goal,

    camera,
    hostelAnchor,
    setActive(v) { active = v; if (v) start(); },
    setPointer(x, y) { pointer.set(x, y); },
    setWhale(v) { if (v && !whaleOn) whaleT = 0; whaleOn = v; },
    // 0 = blank paper, 1 = the island fully drawn
    setDraw(v) { postUniforms.uDraw.value = v; },
    onFrame(fn) { onFrame = fn; },
    // world point to CSS pixels (null when behind the camera)
    project(v, out = { x: 0, y: 0, visible: false }) {
      tmp.copy(v).project(camera);
      out.visible = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      out.x = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
      out.y = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
      return out;
    },
    snap() { cur.pos.copy(goal.pos); cur.look.copy(goal.look); cur.tod = goal.tod; cur.night = goal.night; cur.fov = goal.fov; },
  };
}
