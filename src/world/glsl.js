// Shared GLSL. Every scene shader writes a "semantic" colour instead of a real one:
//   r = ink coverage, g = sun-yellow coverage, b = paper tone (1 bright, 0 shaded)
// The post pass turns that into the final palette, so day, dusk and night are just uniforms.

export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*vnoise(p); p *= 2.03; a *= .5; } return v; }
// crisp line of ~w pixels around integer values of x, fades out when lines get denser than the pixel grid
float inkLine(float x, float w){
  float fw = max(fwidth(x), 1e-5);
  float d = abs(fract(x - .5) - .5) / fw;
  return (1. - smoothstep(w - .6, w + .6, d)) * (1. - smoothstep(.18, .4, fw));
}
`;

export const FOG = /* glsl */ `
uniform vec3 uCam;
float fogFade(vec3 w){ float d = distance(w, uCam); return 1. - smoothstep(3200., 9500., d) * .82; }
`;
