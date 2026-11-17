// @ts-nocheck
import * as THREE from 'three';
import { TAU, rand, clamp, PALETTE } from './gfx-utils';

const NEBULA_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAG = `
uniform float uTime;
uniform float uIntensity;
uniform float uAspect;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.13;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
  float drift = uTime * 0.006;
  vec2 q = vec2(
    fbm(uv * 1.25 + vec2(drift, -drift * 0.4)),
    fbm(uv * 1.25 + vec2(5.2, 1.3) - vec2(drift * 0.6, drift))
  );
  vec2 r = vec2(
    fbm(uv * 1.9 + q * 1.8 + vec2(1.7, 9.2) + vec2(uTime * 0.009, 0.0)),
    fbm(uv * 1.9 + q * 1.8 + vec2(8.3, 2.8) - vec2(0.0, uTime * 0.008))
  );
  float f = fbm(uv * 1.35 + r * 2.35);
  float ribbon = fbm(uv * 2.8 + r * 4.2 + 3.7);

  vec3 col = vec3(0.005, 0.008, 0.022);
  col = mix(col, vec3(0.085, 0.018, 0.2), smoothstep(0.22, 0.84, f));
  col = mix(col, vec3(0.012, 0.16, 0.26), pow(smoothstep(0.34, 0.92, ribbon), 2.0) * 0.8);
  col += vec3(0.48, 0.045, 0.34) * pow(smoothstep(0.52, 0.95, r.x), 2.2) * 0.62;
  col += vec3(0.88, 0.48, 0.2) * pow(smoothstep(0.63, 1.0, f * ribbon), 3.2) * 0.2;

  float band = exp(-pow((uv.y + 0.08 + uv.x * 0.07) * 3.0, 2.0));
  col += vec3(0.16, 0.22, 0.48) * band * 0.13;

  float core = length(uv - vec2(-0.62, 0.35));
  col += vec3(0.12, 0.38, 0.54) * exp(-core * 4.2) * 0.16;
  float core2 = length(uv - vec2(0.65, -0.24));
  col += vec3(0.4, 0.1, 0.34) * exp(-core2 * 5.0) * 0.1;

  float dust = pow(noise(uv * 340.0 + 7.0), 28.0);
  col += vec3(0.6, 0.82, 1.0) * dust * 0.55;

  float edge = smoothstep(1.65, 0.16, length((vUv - 0.5) * vec2(1.0, 1.18)));
  col *= edge;
  col *= 0.72 + uIntensity * 0.36;
  col += vec3(0.1, 0.3, 0.55) * uIntensity * 0.018;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Nebula {
  constructor(scene, aspect) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
        uAspect: { value: aspect },
      },
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      depthWrite: false,
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1500, 950), this.material);
    this.mesh.position.set(0, 0, -400);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    scene.add(this.mesh);
  }

  update(time, intensity, aspect) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uIntensity.value = intensity;
    this.material.uniforms.uAspect.value = aspect;
  }
}

const STAR_VERT = `
uniform float uPixelRatio;
uniform float uTravel;
uniform float uTime;
attribute float aSize;
attribute float aPhase;
attribute float aSpeed;
attribute float aHero;
attribute vec3 aColor;
varying vec3 vColor;
varying float vHero;
varying float vTwinkle;

void main() {
  vec3 p = position;
  p.z = mod(position.z + uTravel * aSpeed, 260.0) - 248.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(1.0, -mv.z);
  float tw = 0.72 + 0.28 * sin(uTime * (0.55 + aPhase * 1.8) + aPhase * 37.0);
  gl_PointSize = aSize * uPixelRatio * (270.0 / dist) * (0.86 + 0.14 * tw);
  gl_PointSize = clamp(gl_PointSize, 0.7, 30.0);
  vColor = aColor;
  vHero = aHero;
  vTwinkle = tw;
}
`;

const STAR_FRAG = `
varying vec3 vColor;
varying float vHero;
varying float vTwinkle;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(1.0, 0.0, d);
  core = pow(core, 1.8);
  float glow = pow(max(0.0, 1.0 - d), 3.0);
  float cross = max(0.0, 1.0 - abs(pc.x) * 15.0) * max(0.0, 1.0 - abs(pc.y) * 1.9)
              + max(0.0, 1.0 - abs(pc.y) * 15.0) * max(0.0, 1.0 - abs(pc.x) * 1.9);
  vec3 col = vColor * (core * 1.3 + glow * 0.6 + cross * vHero * 0.7);
  col *= vTwinkle;
  float alpha = clamp(core + glow * 0.5 + cross * vHero * 0.55, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export class Starfield {
  constructor(scene, count, pixelRatio) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const heroes = new Float32Array(count);

    const colorChoices = [
      [0.76, 0.87, 1.0],
      [0.52, 0.86, 1.0],
      [0.72, 0.6, 1.0],
      [1.0, 0.82, 0.62],
      [1.0, 0.98, 0.96],
    ];

    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 0.62) * 96;
      const angle = Math.random() * TAU;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.66;
      positions[i * 3 + 2] = Math.random() * 260;

      const pick = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      const b = rand(0.42, 1.0);
      colors[i * 3] = pick[0] * b;
      colors[i * 3 + 1] = pick[1] * b;
      colors[i * 3 + 2] = pick[2] * b;

      const hero = Math.random() < 0.006;
      sizes[i] = hero ? rand(3.4, 7.2) : rand(0.65, 2.15);
      phases[i] = Math.random();
      speeds[i] = rand(0.62, 1.45);
      heroes[i] = hero ? 1 : 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aHero', new THREE.BufferAttribute(heroes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
        uTravel: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
    scene.add(this.points);
  }

  update(travel, time, pixelRatio) {
    this.material.uniforms.uTravel.value = travel;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }
}

const WARP_VERT = `
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const WARP_FRAG = `
varying float vAlpha;
varying vec3 vColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(vColor, vAlpha * uOpacity);
}
`;

export class WarpStreaks {
  constructor(scene, count) {
    this.count = count;
    this.streaks = [];
    const pos = new Float32Array(count * 2 * 3);
    const col = new Float32Array(count * 2 * 3);
    const alpha = new Float32Array(count * 2);
    const palette = [PALETTE.ice, PALETTE.cyan, PALETTE.violet, PALETTE.magenta, PALETTE.gold];
    for (let i = 0; i < count; i++) {
      const radius = rand(2.0, 46);
      const angle = Math.random() * TAU;
      const color = palette[Math.floor(Math.random() * palette.length)];
      this.streaks.push({
        z: rand(-190, 0),
        speed: rand(0.7, 1.6),
        len: rand(0.6, 3.5),
        angle,
        radius,
        color,
        alpha: rand(0.18, 0.85),
      });
      const a = i * 6;
      col[a] = color.r;
      col[a + 1] = color.g;
      col[a + 2] = color.b;
      col[a + 3] = color.r;
      col[a + 4] = color.g;
      col[a + 5] = color.b;
      alpha[i * 2] = 0;
      alpha[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.6 } },
      vertexShader: WARP_VERT,
      fragmentShader: WARP_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
    scene.add(this.lines);
  }

  update(dt, time, intensity, warpSurge) {
    const speedBase = 7 + intensity * 48 + warpSurge * 90;
    const pos = this.geo.attributes.position.array;
    const alpha = this.geo.attributes.aAlpha.array;
    for (let i = 0; i < this.count; i++) {
      const s = this.streaks[i];
      s.z += dt * speedBase * s.speed;
      if (s.z > 7) {
        s.z = rand(-190, -160);
        s.angle = Math.random() * TAU;
        s.radius = rand(2.2, 46);
        s.speed = rand(0.7, 1.6);
        s.len = rand(0.5, 3.2);
      }
      const a = s.angle + time * 0.012 * (0.4 + intensity);
      const x = Math.cos(a) * s.radius;
      const y = Math.sin(a) * s.radius * 0.7;
      const length = s.len * (0.6 + intensity * 5.5 + warpSurge * 9);
      const nearFade = clamp((s.z + 60) / 60, 0.15, 1);
      const headAlpha = s.alpha * (0.28 + intensity * 0.75) * nearFade;
      const o = i * 6;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = s.z;
      pos[o + 3] = x;
      pos[o + 4] = y;
      pos[o + 5] = s.z - length;
      alpha[i * 2] = 0;
      alpha[i * 2 + 1] = headAlpha;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.material.uniforms.uOpacity.value = 0.55 + intensity * 0.35;
  }
}

const RIBBON_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RIBBON_FRAG = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
uniform float uIntensity;
uniform float uKick;
uniform float uSeed;
varying vec2 vUv;

void main() {
  float edge = smoothstep(0.0, 0.44, vUv.x) * smoothstep(1.0, 0.56, vUv.x);
  float fade = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
  float flow = pow(0.5 + 0.5 * sin(vUv.y * 22.0 - uTime * 1.5 + uSeed * 5.0), 7.0);
  float flow2 = pow(0.5 + 0.5 * sin(vUv.y * 8.0 + uTime * 0.65 + uSeed * 9.0), 12.0);
  vec3 col = mix(uColorA, uColorB, clamp(vUv.y * 0.8 + 0.2 * sin(uTime * 0.2 + uSeed * 4.0), 0.0, 1.0));
  float a = edge * fade * (0.16 + 0.42 * flow + 0.36 * flow2) * (0.35 + uIntensity * 0.9);
  a += edge * fade * 0.14 * uKick;
  gl_FragColor = vec4(col * a, a);
}
`;

export class LightRibbons {
  constructor(scene, count = 7, segments = 150) {
    this.items = [];
    const colors = [
      [PALETTE.cyan, PALETTE.violet],
      [PALETTE.magenta, PALETTE.cyan],
      [PALETTE.gold, PALETTE.magenta],
      [PALETTE.violet, PALETTE.ice],
      [PALETTE.ice, PALETTE.blue],
      [PALETTE.magenta, PALETTE.white],
      [PALETTE.cyan, PALETTE.gold],
    ];
    for (let k = 0; k < count; k++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array((segments + 1) * 2 * 3);
      const uvs = new Float32Array((segments + 1) * 2 * 2);
      const indices = [];
      for (let i = 0; i <= segments; i++) {
        const v = i / segments;
        uvs[i * 4] = 0;
        uvs[i * 4 + 1] = v;
        uvs[i * 4 + 2] = 1;
        uvs[i * 4 + 3] = v;
        if (i < segments) {
          const a = i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      const [ca, cb] = colors[k % colors.length];
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uColorA: { value: ca.clone() },
          uColorB: { value: cb.clone() },
          uTime: { value: 0 },
          uIntensity: { value: 0.4 },
          uKick: { value: 0 },
          uSeed: { value: rand(0, 10) },
        },
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      scene.add(mesh);
      this.items.push({
        mesh,
        geo,
        material,
        segments,
        radius: rand(11, 26),
        zStart: rand(-185, -140),
        zEnd: rand(-12, -5),
        phase: rand(0, TAU),
        twist: rand(2.6, 6.0),
        width: rand(0.1, 0.32),
      });
    }
  }

  update(time, intensity, kick) {
    for (const item of this.items) {
      const { mesh, geo, segments } = item;
      const positions = geo.attributes.position.array;
      const count = segments + 1;
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      const zs = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const v = i / segments;
        zs[i] = THREE.MathUtils.lerp(item.zStart, item.zEnd, v);
        const angle = v * item.twist + item.phase + time * 0.09;
        const radius = item.radius + Math.sin(v * 7.0 + item.phase + time * 0.16) * 2.4
          + Math.sin(v * 2.2 - item.phase) * 1.6;
        xs[i] = Math.cos(angle) * radius;
        ys[i] = Math.sin(angle) * radius * 0.6 + Math.sin(v * 3.2 + item.phase + time * 0.2) * 1.4;
      }
      for (let i = 0; i < count; i++) {
        const prev = Math.max(0, i - 1);
        const next = Math.min(segments, i + 1);
        const tx = xs[next] - xs[prev];
        const ty = ys[next] - ys[prev];
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len;
        const ny = tx / len;
        const taper = Math.sin((i / segments) * Math.PI) * item.width;
        const o = i * 6;
        positions[o] = xs[i] + nx * taper;
        positions[o + 1] = ys[i] + ny * taper;
        positions[o + 2] = zs[i];
        positions[o + 3] = xs[i] - nx * taper;
        positions[o + 4] = ys[i] - ny * taper;
        positions[o + 5] = zs[i];
      }
      geo.attributes.position.needsUpdate = true;
      item.material.uniforms.uTime.value = time;
      item.material.uniforms.uIntensity.value = intensity;
      item.material.uniforms.uKick.value = kick;
      mesh.visible = intensity > 0.03;
    }
  }
}
