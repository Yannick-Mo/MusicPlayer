// @ts-nocheck
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smoothstep01 = (x) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
export const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

export const PALETTE = {
  ice: new THREE.Color(0.62, 0.94, 1.0),
  cyan: new THREE.Color(0.18, 0.86, 1.0),
  violet: new THREE.Color(0.62, 0.38, 1.0),
  magenta: new THREE.Color(1.0, 0.28, 0.74),
  gold: new THREE.Color(1.0, 0.72, 0.38),
  white: new THREE.Color(1.0, 0.98, 0.94),
  blue: new THREE.Color(0.25, 0.45, 1.0),
};

export function canvasTexture(canvas, { srgb = true, mipmap = true, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = mipmap ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = mipmap;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.1, 'rgba(255,255,255,0.94)');
  g.addColorStop(0.3, 'rgba(198,242,255,0.36)');
  g.addColorStop(0.62, 'rgba(120,160,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(c, { mipmap: false });
}

export function makeFlareTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.22);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(235,252,255,0.95)');
  g.addColorStop(0.38, 'rgba(120,220,255,0.34)');
  g.addColorStop(1, 'rgba(40,80,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const h = ctx.createLinearGradient(0, 0, size, 0);
  h.addColorStop(0, 'rgba(80,200,255,0)');
  h.addColorStop(0.3, 'rgba(160,240,255,0.2)');
  h.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  h.addColorStop(0.7, 'rgba(160,240,255,0.2)');
  h.addColorStop(1, 'rgba(80,200,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, size * 0.485, size, size * 0.03);

  const v = ctx.createLinearGradient(0, 0, 0, size);
  v.addColorStop(0, 'rgba(110,230,255,0)');
  v.addColorStop(0.42, 'rgba(170,245,255,0.16)');
  v.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  v.addColorStop(0.58, 'rgba(170,245,255,0.16)');
  v.addColorStop(1, 'rgba(110,230,255,0)');
  ctx.fillStyle = v;
  ctx.fillRect(size * 0.493, 0, size * 0.014, size);

  ctx.strokeStyle = 'rgba(200,250,255,0.32)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(size / 2 + Math.cos(a) * size * 0.4, size / 2 + Math.sin(a) * size * 0.4);
    ctx.stroke();
  }
  return canvasTexture(c, { mipmap: false });
}

export function makeStreakTexture(w = 512, h = 96) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(80,160,255,0)');
  g.addColorStop(0.45, 'rgba(120,220,255,0.08)');
  g.addColorStop(0.8, 'rgba(210,250,255,0.55)');
  g.addColorStop(0.97, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.38, w, h * 0.24);
  const core = ctx.createRadialGradient(w * 0.93, h / 2, 0, w * 0.93, h / 2, h * 0.48);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.25, 'rgba(200,250,255,0.65)');
  core.addColorStop(1, 'rgba(80,180,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);
  return canvasTexture(c, { mipmap: false });
}

export function makeSoftDiscTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(1,3,8,0.94)');
  g.addColorStop(0.5, 'rgba(2,5,12,0.82)');
  g.addColorStop(0.8, 'rgba(1,3,8,0.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvasTexture(c, { mipmap: false });
}

export const CINEMATIC_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.5 },
    uDistortion: { value: 0.02 },
    uFlash: { value: 0 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.9 },
    uLetterbox: { value: 0.045 },
    uResolution: { value: new THREE.Vector2(1280, 720) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uDistortion;
    uniform float uFlash;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uLetterbox;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      vec2 duv = uv + c * r2 * uDistortion;
      vec2 dir = normalize(c + 1e-6);
      float ab = uAberration * (0.0016 + r2 * 0.0045);

      vec3 col;
      col.r = texture2D(tDiffuse, duv + dir * ab * 1.6).r;
      col.g = texture2D(tDiffuse, duv).g;
      col.b = texture2D(tDiffuse, duv - dir * ab * 1.6).b;

      col += vec3(0.02, 0.05, 0.09) * (1.0 - smoothstep(0.0, 1.4, r2 * 2.4)) * 0.24;

      float scan = 0.975 + 0.025 * sin(uv.y * uResolution.y * 1.15 + uTime * 1.7);
      col *= scan;

      vec2 gcoord = uv * uResolution * 0.7 + fract(uTime) * 161.0;
      float grain = hash(gcoord) - 0.5;
      col += grain * uGrain;

      float vig = smoothstep(1.1, 0.24, length(c * vec2(1.05, 1.0)));
      col *= mix(1.0, vig, uVignette);

      float lens = exp(-abs(c.y) * 36.0) * smoothstep(0.95, 0.02, abs(c.x));
      col += vec3(0.28, 0.6, 1.0) * lens * uFlash * 0.45;

      float flashMask = smoothstep(0.85, 0.18, length(c));
      col = mix(col, vec3(0.72, 0.9, 1.0), clamp(uFlash * flashMask, 0.0, 0.9));

      float bar = uLetterbox;
      float top = smoothstep(1.0 - bar, 1.0 - bar + 0.004, vUv.y);
      float bottom = smoothstep(bar - 0.004, bar, vUv.y);
      col *= (1.0 - top) * bottom;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};
