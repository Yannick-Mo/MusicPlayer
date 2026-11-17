// @ts-nocheck
import * as THREE from 'three';
import { TAU, rand, clamp, smoothstep01, PALETTE } from './gfx-utils';

const FLIGHT_SPEED = 150;

const ASTEROID_VERT = `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  vPos = position;
  gl_Position = projectionMatrix * mv;
}
`;

const ASTEROID_FRAG = `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
uniform vec3 uRim;
uniform float uTime;
uniform float uFade;
void main() {
  vec3 n = normalize(vNormal);
  float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.6);
  float grain = 0.55 + 0.45 * sin(vPos.x * 6.0 + vPos.y * 4.0 + vPos.z * 7.0 + uTime * 0.02);
  vec3 col = vec3(0.006, 0.007, 0.013) + uRim * fres * 0.66;
  col += uRim * 0.018 * grain;
  gl_FragColor = vec4(col, uFade);
}
`;

const PLANET_VERT = `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  vPos = position;
  gl_Position = projectionMatrix * mv;
}
`;

const PLANET_FRAG = `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
uniform vec3 uTint;
uniform vec3 uRim;
uniform float uSeed;
uniform float uTime;
uniform float uFade;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(vView);
  float light = clamp(dot(n, normalize(vec3(-0.58, 0.42, 0.72))), 0.0, 1.0);
  float bands = 0.5 + 0.5 * sin(vPos.y * (7.0 + uSeed * 2.4) + sin(vPos.x * 3.4 + uSeed) * 1.3 + uSeed * 2.0);
  float grain = hash(floor(vPos * 26.0 + uSeed * 17.0));
  vec3 base = mix(vec3(0.003, 0.005, 0.011), uTint * 0.075, 0.24 + bands * 0.4);
  base += uTint * light * 0.1;
  base += uTint * grain * 0.01;
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.4);
  float halo = pow(1.0 - max(dot(n, viewDir), 0.0), 8.0);
  base += uRim * (rim * 0.56 + halo * 0.34);
  base *= 0.92 + 0.08 * sin(uTime * 0.7 + uSeed * 9.0);
  gl_FragColor = vec4(base, uFade);
}
`;

function makeRingTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  for (let r = 92; r < 248; r += 0.6) {
    const band = 0.5 + 0.5 * Math.sin((r - 92) * 0.34 + Math.sin(r * 0.11) * 2.4);
    const grain = 0.5 + 0.5 * Math.sin(r * 1.77 + 1.3);
    const gap = (r > 156 && r < 166) || (r > 204 && r < 209) ? 0.16 : 1.0;
    const alpha = (0.025 + band * 0.18 + grain * 0.06) * gap;
    ctx.strokeStyle = `rgba(158, 224, 255, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Asteroids {
  constructor(scene) {
    this.items = [];
    this.planets = [];
    this.geometries = [];
    for (let g = 0; g < 5; g++) {
      const geo = new THREE.IcosahedronGeometry(1, 2);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = Math.sin(v.x * 4.7 + v.y * 6.1 + v.z * 3.3) * 0.5
          + Math.sin(v.x * 11 - v.z * 8.3) * 0.22
          + Math.sin(v.y * 17 + v.z * 5.1) * 0.08;
        v.multiplyScalar(0.88 + n * 0.3);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      this.geometries.push(geo);
    }

    for (let i = 0; i < 13; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uRim: { value: (i % 2 ? PALETTE.cyan : PALETTE.violet).clone() },
          uTime: { value: 0 },
          uFade: { value: 1 },
        },
        vertexShader: ASTEROID_VERT,
        transparent: true,
        depthWrite: true,
        fragmentShader: ASTEROID_FRAG,
      });
      const mesh = new THREE.Mesh(this.geometries[i % this.geometries.length], mat);
      const item = {
        mesh,
        spin: new THREE.Vector3(),
        drift: new THREE.Vector2(),
        speed: 10,
        size: 3,
        phase: rand(0, TAU),
      };
      this.respawn(item, true);
      this.items.push(item);
      scene.add(mesh);
    }

    const sphere = new THREE.SphereGeometry(1, 56, 36);
    const ringTex = makeRingTexture();
    const planetDefs = [
      [PALETTE.cyan, PALETTE.cyan, true, 1.0],
      [PALETTE.violet, PALETTE.violet, false, 0.9],
      [new THREE.Color(0.3, 0.5, 0.62), PALETTE.ice, false, 0.82],
      [PALETTE.magenta, PALETTE.violet, true, 1.0],
      [PALETTE.blue, PALETTE.ice, false, 0.74],
      [new THREE.Color(0.24, 0.38, 0.46), PALETTE.cyan, false, 0.86],
      [new THREE.Color(0.36, 0.44, 0.6), PALETTE.violet, false, 0.8],
      [PALETTE.cyan, PALETTE.ice, true, 0.94],
      [new THREE.Color(0.3, 0.36, 0.5), PALETTE.cyan, false, 0.7],
    ];
    for (let i = 0; i < planetDefs.length; i++) {
      const [tint, rim, hasRing, scaleBase] = planetDefs[i];
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTint: { value: tint.clone().multiplyScalar(0.62) },
          uRim: { value: rim.clone().multiplyScalar(0.8) },
          uSeed: { value: rand(0, 10) },
          uTime: { value: 0 },
          uFade: { value: 0 },
        },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        transparent: true,
        depthWrite: true,
      });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.renderOrder = 1;
      const group = new THREE.Group();
      group.add(mesh);
      let ring = null;
      if (hasRing) {
        ring = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: ringTex,
            color: rim.clone().lerp(PALETTE.white, 0.25),
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.set(-Math.PI / 2 + rand(0.12, 0.3), 0, rand(-0.45, 0.45));
        ring.scale.setScalar(rand(2.2, 2.7));
        ring.renderOrder = 2;
        group.add(ring);
      }
      const item = {
        group,
        mesh,
        ring,
        ringBase: ring ? ring.material.opacity : 0,
        slot: i,
        scaleBase,
        speed: 3,
        size: 20,
        spin: rand(0.008, 0.02) * (i % 2 ? 1 : -1),
        phase: rand(0, TAU),
      };
      this.respawnPlanet(item, true);
      this.planets.push(item);
      scene.add(group);
    }
  }

  respawn(item, initial) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = initial ? rand(-480, -50) : rand(-640, -460);
    const x = side * rand(6, 96);
    const y = rand(-46, 50);
    item.mesh.position.set(x, y, z);
    item.size = rand(1.6, 6.0);
    const roll = Math.random();
    if (roll < 0.16) item.size = rand(20, 36);
    else if (roll < 0.36) item.size *= rand(1.8, 3.0);
    item.mesh.scale.setScalar(item.size);
    item.speed = FLIGHT_SPEED;
    item.drift.set(-side * rand(0.1, 0.7), rand(-0.22, 0.22));
    item.spin.set(rand(-0.14, 0.14), rand(-0.12, 0.12), rand(-0.1, 0.1));
    item.phase = rand(0, TAU);
    item.mesh.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
  }

  respawnPlanet(item, initial) {
    const side = item.slot % 2 === 0 ? -1 : 1;
    const z = initial ? rand(-660, -300) : rand(-760, -620);
    const x = side * rand(55, 235);
    const y = rand(-85, 90);
    item.size = rand(10, 22) * item.scaleBase;
    const roll = Math.random();
    if (roll < 0.24) item.size *= rand(2.8, 4.2);
    else if (roll < 0.46) item.size *= rand(1.7, 2.3);
    item.speed = FLIGHT_SPEED;
    item.phase = rand(0, TAU);
    item.group.position.set(x, y, z);
    item.group.rotation.set(rand(-0.05, 0.05), rand(0, TAU), rand(-0.04, 0.04));
    item.group.scale.setScalar(item.size);
    item.mesh.rotation.set(rand(-0.2, 0.2), rand(0, TAU), rand(-0.1, 0.1));
    item.mesh.material.uniforms.uFade.value = 0;
    if (item.ring) item.ring.material.opacity = item.ringBase;
  }

  update(time, dt) {
    for (const item of this.items) {
      item.mesh.position.z += item.speed * dt;
      item.mesh.position.x += item.drift.x * dt;
      item.mesh.position.y += item.drift.y * dt + Math.sin(time * 0.07 + item.phase) * 0.002;
      const fadeIn = smoothstep01(clamp((item.mesh.position.z + 600) / 130, 0, 1));
      const fadeOut = smoothstep01(clamp((26 - item.mesh.position.z) / 46, 0, 1));
      const fade = fadeIn * fadeOut;
      item.mesh.material.uniforms.uFade.value = fade;
      item.mesh.material.depthWrite = fade > 0.05;
      item.mesh.rotation.x += item.spin.x * dt;
      item.mesh.rotation.y += item.spin.y * dt;
      item.mesh.rotation.z += item.spin.z * dt;
      item.mesh.material.uniforms.uTime.value = time;
      if (item.mesh.position.z > 34) this.respawn(item, false);
    }

    for (const item of this.planets) {
      item.group.position.z += item.speed * dt;
      item.group.position.y += Math.sin(time * 0.045 + item.phase) * 0.006;
      item.mesh.rotation.y += item.spin * dt;
      const fadeIn = smoothstep01(clamp((item.group.position.z + 690) / 210, 0, 1));
      const fadeOut = smoothstep01(clamp((38 - item.group.position.z) / 24, 0, 1));
      const fade = fadeIn * fadeOut;
      item.mesh.material.uniforms.uFade.value = fade;
      item.mesh.material.depthWrite = fade > 0.04;
      item.mesh.material.uniforms.uTime.value = time;
      if (item.ring) {
        item.ring.material.opacity = item.ringBase * fade;
        item.ring.visible = fade > 0.02;
      }
      if (item.group.position.z > 40) this.respawnPlanet(item, false);
    }
  }
}
