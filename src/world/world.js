import * as THREE from 'three';
import { NOISE, FOG } from './glsl.js';
import { heightAt, HOSTEL, FAIAL } from './terrain.js';

// "The island, drawn in ink". A Three.js world rendered as a living illustration:
// contour lines, hatching and marker-yellow, in the style of the hostel's own tile artwork.

const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// time of day 0..3: dawn, day, golden hour, dusk. Night is a separate ink-bleed layer.
const DAY = [
  { paper: '#f5e6cf', shade: '#e2cbac', ink: '#29291f', yel: '#f8b21a', sun: [0.55, 0.16, -0.82] },
  { paper: '#f5eedf', shade: '#e2d7c0', ink: '#25261f', yel: '#fbb600', sun: [0.35, 0.82, 0.45] },
  { paper: '#f7e3bd', shade: '#e3c393', ink: '#2a2520', yel: '#fba600', sun: [-0.86, 0.18, 0.47] },
  { paper: '#efcfae', shade: '#cfa98a', ink: '#2a2321', yel: '#f6941a', sun: [-0.97, 0.02, 0.24] },
].map((k) => ({
  paper: hex(k.paper), shade: hex(k.shade), ink: hex(k.ink), yel: hex(k.yel),
  sun: new THREE.Vector3(...k.sun).normalize(),
}));
const NIGHT = { paper: hex('#1b1c19'), shade: hex('#111210'), ink: hex('#f1e5c6'), yel: hex('#f6b21c') };

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
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
uniform vec3 uSun; uniform float uPx;
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 n = normalize(vN);
  float ndl = dot(n, uSun);
  float lit = smoothstep(-.1, .32, ndl) * smoothstep(-.12, .05, uSun.y);
  float shade = 1. - lit;
  float h = vW.y;
  float ink = 0., yel = 0., light = mix(.5, 1., lit);
  vec2 sp = gl_FragCoord.xy / uPx;

  // contour lines: thin every ~100 m, bold every ~500 m
  float c = inkLine(h / 26., .5) * .55 + inkLine(h / 130., .95);
  ink = max(ink, min(c, 1.) * smoothstep(6., 14., h) * .9);

  // hatching in the shadows, crossed where it is darkest
  float hs = 6.5;
  float h1 = 1. - smoothstep(.3, 1., abs(fract((sp.x + sp.y) / hs) - .5) * hs);
  float h2 = 1. - smoothstep(.3, 1., abs(fract((sp.x - sp.y * .6) / hs) - .5) * hs);
  float gap = step(.32, vnoise(vec2((sp.x - sp.y) / 9., (sp.x + sp.y) / 2.5)));
  ink = max(ink, h1 * gap * smoothstep(.5, .85, shade) * .75);
  ink = max(ink, h2 * smoothstep(.93, 1., shade) * .55);

  // marker-yellow strokes on the sunny side, denser up high (the tile's mountain is yellow)
  vec2 sd = vec2(dot(sp, vec2(.83, -.56)), dot(sp, vec2(.56, .83)));
  float strokes = vnoise(vec2(sd.x / 3.2, sd.y / 140.)) * .7 + vnoise(vW.xz * .004) * .3;
  float want = lit * smoothstep(60., 420., h);
  yel = smoothstep(.6, .64, strokes + want * .5) * smoothstep(40., 110., h);

  // UNESCO vineyards: the lattice of black basalt walls (currais) on the low western slopes
  vec2 v = vW.xz + vec2(vnoise(vW.xz * .02), vnoise(vW.xz * .02 + 9.)) * 6.;
  float walls = max(inkLine(v.x / 13., .7), inkLine(v.y / 10., .7));
  float vineZone = smoothstep(4., 9., h) * (1. - smoothstep(55., 80., h)) * smoothstep(-1150., -1450., vW.x) * smoothstep(-260., -420., vW.z);
  ink = max(ink, walls * vineZone * .5);
  yel *= 1. - vineZone * .6;

  // the shoreline: one confident line, plus a broken second one like a wave pulling back
  ink = max(ink, 1. - smoothstep(.3, 1.4, abs(h - .9) / max(fwidth(h), 1e-3) * .5));
  float wash = (1. - smoothstep(.3, 1.1, abs(h - 3.2) / max(fwidth(h), 1e-3) * .5)) * step(.5, vnoise(vW.xz * .05));
  ink = max(ink, wash * .7);

  float f = fogFade(vW);
  gl_FragColor = vec4(ink * f, yel * f, mix(1., light, f), 1.);
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
uniform vec3 uSun; uniform vec2 uFwd; uniform float uTime;
varying vec3 vW; varying vec3 vN;
float lineSet(float coord, float s, float across){
  float idx = floor(coord / s + .5);
  float dash = smoothstep(.36, .46, vnoise(vec2(across / (34. * s) + uTime * .04 * s, idx * 3.71)));
  return inkLine(coord / s, .55) * dash;
}
void main(){
  float along = dot(vW.xz, uFwd);
  float across = dot(vW.xz, vec2(-uFwd.y, uFwd.x));
  float coord = along / 6. + vW.y * .8;
  float lod = max(0., log2(fwidth(coord) * 10.));
  float l0 = floor(lod), fl = fract(lod);
  float line = mix(lineSet(coord, exp2(l0), across), lineSet(coord, exp2(l0 + 1.), across), fl);

  vec3 view = normalize(vW - uCam);
  vec3 r = reflect(view, normalize(vN));
  float glint = pow(max(dot(r, uSun), 0.), 18.) * smoothstep(-.05, .1, uSun.y);
  float thick = mix(lineSet(coord * .5, exp2(l0), across * .6), lineSet(coord * .5, exp2(l0 + 1.), across * .6), fl);
  float yel = smoothstep(.08, .35, glint) * thick;

  float f = fogFade(vW);
  float ink = line * (1. - yel) * .85;
  gl_FragColor = vec4(ink * f, yel * f, .93 + .07 * (1. - f), 1.);
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
uniform vec3 uSun; uniform vec3 uMoon; uniform float uTime; uniform float uNight;
varying vec3 vDir;
// a sun in the style of the logo: a disc with fifteen rounded rays, outlined in ink
void body(vec3 d, vec3 s, float R, bool rays, inout float ink, inout float yel, bool crescent){
  float facing = dot(d, s);
  if (facing <= .6) return;
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
    p.y += sin(p.x * 30.) * R * .03;
    float ray = length(p - vec2(clamp(p.x, a0, a1), 0.)) - R * .13;
    sdf = min(sdf, ray);
  }
  float fw = fwidth(sdf);
  yel = max(yel, 1. - smoothstep(-fw, fw, sdf));
  ink = max(ink, 1. - smoothstep(fw * .7, fw * 2.1, abs(sdf)));
}
void main(){
  vec3 d = normalize(vDir);
  float light = 1. - .2 * smoothstep(.0, .75, d.y);
  float ink = 0., yel = 0.;
  if (uNight < .5) body(d, uSun, .058, true, ink, yel, false);
  if (uNight > .01) {
    body(d, uMoon, .045, false, ink, yel, true);
    vec3 g = d * 70.;
    vec3 cell = floor(g);
    vec3 f = fract(g) - .5;
    float hs = hash13(cell);
    float tw = .6 + .4 * sin(uTime * (1. + hs * 3.) + hs * 40.);
    float star = (1. - smoothstep(.0, .09 * hs, length(f))) * step(.9, hs);
    float spark = (1. - smoothstep(.0, .025, min(abs(f.x), abs(f.y)) * 1.)) * (1. - smoothstep(.1, .3, length(f))) * step(.985, hs);
    ink = max(ink, max(star, spark) * tw * smoothstep(.03, .15, d.y) * uNight);
  }
  gl_FragColor = vec4(ink, yel, light, 1.);
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
  float fw = fwidth(d);
  if (d > fw) discard;
  float ink = 1. - smoothstep(fw * .4, fw * 1.3, abs(d));
  // little curls inside, like the tile's clouds
  float curl = 1. - smoothstep(fw * .5, fw * 1.6, abs(length(p - vec2(-.2 + vSeed, .15)) - .28));
  curl *= step(p.y, .15 + .1) * step(.15 - .28, p.y) * step(p.x, -.2 + vSeed + .05);
  ink = max(ink, curl * .8);
  float f = fogFade(vW);
  gl_FragColor = vec4(ink * f, 0., 1., 1.);
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
uniform float uTime;
varying vec2 vP; varying vec3 vW;
float ellipse(vec2 p, vec2 c, vec2 r, float a){ p -= c; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p; return (length(p / r) - 1.) * min(r.x, r.y); }
void main(){
  if (vW.y < .2) discard;
  vec2 p = vP;
  // a sperm whale's fluke: two lobes on a tapering stalk, notch in the middle
  float lobeL = ellipse(p, vec2(-.43, .5), vec2(.5, .15), -.38);
  float lobeR = ellipse(p, vec2(.43, .5), vec2(.5, .15), .38);
  float w = mix(.07, .16, smoothstep(.4, -1., p.y));
  float stalk = max(abs(p.x) - w, max(p.y - .5, -p.y - 1.2));
  float d = min(min(lobeL, lobeR), stalk);
  d = max(d, -(length(p - vec2(0., .66)) - .06));
  float fw = fwidth(d);
  // water pouring off the tail edge
  float drip = step(.6, vnoise(vec2(p.x * 18., p.y * 3. + uTime * 6.))) * step(abs(p.x), .9) * step(p.y, .4) * step(-.4, p.y) * (1. - step(.5, abs(p.x) - .1));
  if (d > fw && drip < .5) discard;
  float body = 1. - smoothstep(-fw, fw, d);
  float ink = max(body * .92, drip * .7);
  gl_FragColor = vec4(ink * fogFade(vW), 0., 1., 1.);
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
uniform vec3 uSun; uniform float uRoofYellow; uniform float uPx;
varying vec3 vW; varying vec3 vN;
void main(){
  vec3 n = normalize(vN);
  float lit = smoothstep(-.1, .3, dot(n, uSun));
  vec2 sp = gl_FragCoord.xy / uPx;
  float hatch = 1. - smoothstep(.4, 1.2, abs(fract((sp.x + sp.y) / 4.) - .5) * 4.);
  float roof = step(.5, n.y);
  float ink = mix(hatch * (1. - lit) * .8, (1. - uRoofYellow) * .85, roof);
  float yel = roof * uRoofYellow;
  float f = fogFade(vW);
  gl_FragColor = vec4(ink * f, yel * f, mix(.75, 1., lit), 1.);
}`;

const POST_FRAG = /* glsl */ `
${NOISE}
uniform sampler2D tCol; uniform sampler2D tDepth;
uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar; uniform float uPx; uniform float uNight;
uniform vec3 pPaper, pShade, pInk, pYel, nPaper, nShade, nInk, nYel;
varying vec2 vUv;
float invDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x * 2. - 1.;
  return (uFar + uNear - z * (uFar - uNear)) / (2. * uNear * uFar);
}
void main(){
  // line boil: the drawing re-traces itself 8 times a second, like a hand-drawn film
  float tick = floor(uTime * 8.);
  vec2 jit = vec2(vnoise(vUv * uRes / (70. * uPx) + tick * 17.3), vnoise(vUv * uRes / (70. * uPx) + tick * 9.1 + 40.)) - .5;
  vec2 uv = vUv + jit * 1.7 * uPx / uRes;
  vec4 s = texture2D(tCol, uv);

  vec2 px = 1.3 * uPx / uRes;
  float wc = invDepth(uv);
  float lap = abs(invDepth(uv - vec2(px.x, 0.)) + invDepth(uv + vec2(px.x, 0.)) - 2. * wc)
            + abs(invDepth(uv - vec2(0., px.y)) + invDepth(uv + vec2(0., px.y)) - 2. * wc);
  float edge = smoothstep(.08, .22, lap / wc);
  float ink = max(s.r, edge);

  vec3 day = mix(mix(pShade, pPaper, s.b), pYel, s.g);
  day = mix(day, pInk, ink);
  vec3 night = mix(mix(nShade, nPaper, s.b), nYel, s.g * .9);
  night = mix(night, nInk, ink * .9);

  // day turns to night like ink soaking through paper
  vec2 asp = vUv * vec2(uRes.x / uRes.y, 1.);
  float bleed = fbm(asp * 2.6) * .8 + vnoise(asp * 24.) * .2;
  float m = smoothstep(bleed - .05, bleed + .05, uNight * 1.25 - .12);
  vec3 col = mix(day, night, m);

  float grain = (vnoise(vUv * uRes / (2.2 * uPx)) - .5) * .045 + (hash12(vUv * uRes) - .5) * .03;
  float fibre = (vnoise(vec2(asp.x * 9., asp.y * 140.)) - .5) * .018;
  col *= 1. + grain + fibre;
  col *= mix(1., .88, smoothstep(.5, 1.2, length(vUv - .5) * 1.5));
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
    pPaper: { value: new THREE.Vector3() }, pShade: { value: new THREE.Vector3() }, pInk: { value: new THREE.Vector3() }, pYel: { value: new THREE.Vector3() },
    nPaper: { value: NIGHT.paper }, nShade: { value: NIGHT.shade }, nInk: { value: NIGHT.ink }, nYel: { value: NIGHT.yel },
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
    postUniforms.pPaper.value.lerpVectors(a.paper, b.paper, f);
    postUniforms.pShade.value.lerpVectors(a.shade, b.shade, f);
    postUniforms.pInk.value.lerpVectors(a.ink, b.ink, f);
    postUniforms.pYel.value.lerpVectors(a.yel, b.yel, f);
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
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    uniforms.uTime.value += reduced ? 0 : dt;
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
