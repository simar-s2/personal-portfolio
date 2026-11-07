// GLSL for the six draw calls. Colors are premultiplied, so a pixel with alpha 0 adds light.

const head = '#version 300 es\nprecision highp float;\n';

const roundRect = /* glsl */ `
  float roundRect(vec2 p, vec2 h, float r) {
    vec2 q = abs(p) - h + r;
    return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
  }
`;

const bezier = /* glsl */ `
  layout(location=1) in vec3 p0;
  layout(location=2) in vec3 p1;
  layout(location=3) in vec3 p2;
  layout(location=4) in vec3 p3;
  vec3 curve(float t) {
    float u = 1. - t;
    return u*u*u*p0 + 3.*u*u*t*p1 + 3.*u*t*t*p2 + t*t*t*p3;
  }
`;

export const blockVS = `${head}
layout(location=0) in vec3 aSign;
layout(location=1) in vec3 aDir;
layout(location=2) in vec3 iPos;
layout(location=3) in vec3 iHalf;
layout(location=4) in vec2 iRad;
layout(location=5) in float iTone;
layout(location=6) in vec4 iState; // lift, glow, down, dim
uniform mat4 uVP;
out vec3 vN, vW, vL, vH;
out float vTone;
out vec4 vState;
void main() {
  vec3 R = vec3(iRad.x, iRad.y, iRad.x);
  vec3 p = aSign * (iHalf - R) + aDir * R;
  vec3 w = iPos + p + vec3(0., iState.x, 0.);
  vN = normalize(aDir / max(R, vec3(.001)));
  vW = w; vL = p; vH = iHalf; vTone = iTone; vState = iState;
  gl_Position = uVP * vec4(w, 1.);
}`;

export const blockFS = `${head}
in vec3 vN, vW, vL, vH;
in float vTone;
in vec4 vState;
uniform vec3 uEye, uBase, uAccent, uDown;
uniform vec4 uLight; // ambient, diffuse, specular, rim
out vec4 o;
${roundRect}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
  vec3 L = normalize(vec3(-.5, .85, .35));
  float diff = max(dot(N, L), 0.);
  float hemi = .5 + .5 * N.y;
  float spec = pow(max(dot(N, normalize(L + V)), 0.), 40.);
  float rim = pow(1. - max(dot(N, V), 0.), 4.);
  float ground = mix(.55, 1., smoothstep(0., 1.1, vW.y));

  vec3 base = mix(uBase * vTone, uDown, vState.z);
  vec3 c = base * (uLight.x + hemi * .5 + diff * uLight.y) * ground;
  c += (uLight.z * spec + uLight.w * rim * hemi) * (1. - vState.z * .8);

  // A fine line inset on the top face, so blocks look machined rather than plain.
  if (N.y > .98 && min(vH.x, vH.z) > .22) {
    float d = roundRect(vL.xz, vH.xz - .1, .07);
    float w = fwidth(d);
    c += (1. - smoothstep(0., w * 1.3, abs(d))) * .05;
  }

  // Lit up by the walkthrough, or faded out because something else is.
  c = mix(c, c * .55 + uAccent * (.3 + .7 * hemi), vState.y * .9);
  c = mix(c, base * (.55 + .2 * hemi), vState.w * .6);
  o = vec4(c, 1.);
}`;

export const groundVS = `${head}
layout(location=0) in vec2 aQ;
uniform mat4 uVP;
uniform vec3 uC; // center x, center z, radius
out vec2 vP;
void main() {
  vP = aQ * uC.z + uC.xy;
  gl_Position = uVP * vec4(vP.x, 0., vP.y, 1.);
}`;

export const groundFS = `${head}
in vec2 vP;
uniform vec3 uC;
uniform vec4 uDot;
out vec4 o;
void main() {
  vec2 g = abs(fract(vP - .5) - .5);
  float d = length(g);
  float w = fwidth(d);
  float dot_ = 1. - smoothstep(.024 - w, .024 + w, d);
  float fade = 1. - smoothstep(uC.z * .34, uC.z * .96, length(vP - uC.xy));
  float a = dot_ * fade * uDot.a;
  o = vec4(uDot.rgb * a, a);
}`;

export const zoneVS = `${head}
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iZone; // center x, center z, half w, half d
uniform mat4 uVP;
out vec2 vP, vH;
void main() {
  vH = iZone.zw;
  vP = aQ * (iZone.zw + .1);
  gl_Position = uVP * vec4(vP.x + iZone.x, .004, vP.y + iZone.y, 1.);
}`;

export const zoneFS = `${head}
in vec2 vP, vH;
uniform vec3 uFg;
uniform vec2 uZone; // fill, line
out vec4 o;
${roundRect}
void main() {
  float d = roundRect(vP, vH, .28);
  float w = fwidth(d);
  float fill = 1. - smoothstep(-w, w, d);
  float line = 1. - smoothstep(0., w * 1.2, abs(d) - .008);
  float dash = step(.42, fract((vP.x + vP.y) * 1.5));
  float a = fill * uZone.x + line * dash * uZone.y;
  o = vec4(uFg * a, a);
}`;

export const shadowVS = `${head}
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iS; // center x, center z, half w, half d
layout(location=2) in vec2 iR; // corner radius, strength
uniform mat4 uVP;
out vec2 vP, vH, vR;
void main() {
  const float spread = .55;
  vH = iS.zw; vR = iR;
  vP = aQ * (iS.zw + spread);
  gl_Position = uVP * vec4(vP.x + iS.x + .05, .008, vP.y + iS.y + .05, 1.);
}`;

export const shadowFS = `${head}
in vec2 vP, vH, vR;
uniform float uShadow;
out vec4 o;
${roundRect}
void main() {
  float d = roundRect(vP, vH, min(vR.x, min(vH.x, vH.y)));
  float a = 1. - smoothstep(-.14, .5, d);
  a = a * a * vR.y * uShadow;
  o = vec4(0., 0., 0., a);
}`;

export const wireVS = `${head}
layout(location=0) in vec2 aT; // position along the curve, side of the ribbon
${bezier}
layout(location=5) in vec3 iS; // lit, dim, base alpha
uniform mat4 uVP;
uniform vec2 uRes;
uniform float uWidth;
out float vSide, vT;
out vec3 vS;
void main() {
  float t = aT.x;
  vec4 a = uVP * vec4(curve(t), 1.);
  vec4 b0 = uVP * vec4(curve(max(t - .01, 0.)), 1.);
  vec4 b1 = uVP * vec4(curve(min(t + .01, 1.)), 1.);
  vec2 dir = normalize((b1.xy / b1.w - b0.xy / b0.w) * uRes);
  float w = uWidth * (1. + iS.x * .7);
  a.xy += vec2(-dir.y, dir.x) * aT.y * w / uRes * 2. * a.w;
  vSide = aT.y; vT = t; vS = iS;
  gl_Position = a;
}`;

export const wireFS = `${head}
in float vSide, vT;
in vec3 vS;
uniform vec3 uWire, uAccent;
out vec4 o;
void main() {
  float edge = 1. - smoothstep(.45, 1., abs(vSide));
  float a = edge * mix(vS.z, .95, vS.x) * (1. - vS.y * .75) * mix(.6, 1., vT);
  o = vec4(mix(uWire, uAccent, vS.x) * a, a);
}`;

export const packetVS = `${head}
layout(location=0) in vec2 aQ;
${bezier}
layout(location=5) in vec3 iP; // phase, speed, size
layout(location=6) in vec2 iS; // lit, dim
uniform mat4 uVP;
uniform vec2 uScale;
uniform float uTime;
out vec2 vQ;
out vec2 vS;
out float vA;
void main() {
  float t = fract(iP.x + uTime * iP.y);
  vec4 c = uVP * vec4(curve(t), 1.);
  c.xy += aQ * iP.z * (1. + iS.x * .45) * uScale;
  vQ = aQ; vS = iS;
  vA = iP.y > 0. ? sin(3.14159 * t) : 1.;
  gl_Position = c;
}`;

export const packetFS = `${head}
in vec2 vQ, vS;
in float vA;
uniform vec3 uPacket, uAccent;
uniform float uAdd;
out vec4 o;
void main() {
  float r = dot(vQ, vQ);
  if (r > 1.) discard;
  float g = exp(-r * 6.) * .55 + smoothstep(.2, .04, r);
  float a = min(g, 1.) * vA * (1. - vS.y * .92);
  o = vec4(mix(uPacket, uAccent, vS.x) * a, a * (1. - uAdd));
}`;
