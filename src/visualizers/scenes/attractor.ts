import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { createSkyDome, createStarField, disposeScene, makeGlowTexture } from "./utils";

const POINT_COUNT = 160000;
const PREWARM = 4000;

function aizawaStep(state: number[], dt: number): number[] {
  const [x = 0, y = 0, z = 0] = state;
  const a = 0.95;
  const b = 0.7;
  const c = 0.6;
  const d = 3.5;
  const e = 0.25;
  const f = 0.1;
  const dx = (z - b) * x - d * y;
  const dy = d * x + (z - b) * y;
  const dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
  return [x + dx * dt, y + dy * dt, z + dz * dt];
}

export function createAttractorScene(): SceneInstance {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020106);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
  camera.position.set(0, 0.8, 6.8);

  scene.add(
    createSkyDome({
      top: "#010106",
      middle: "#070420",
      horizon: "#160a33",
      radius: 80,
    }),
  );
  const stars = createStarField(900, 18, 50, 0.35, 0.5);
  scene.add(stars);

  const glowTexture = makeGlowTexture(128);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x8f6bff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.set(6.8, 6.8, 1);
  scene.add(halo);

  const positions = new Float32Array(POINT_COUNT * 3);
  const colors = new Float32Array(POINT_COUNT * 3);
  const seeds = new Float32Array(POINT_COUNT);
  let state = [0.1, 0, 0];
  for (let i = 0; i < PREWARM; i++) state = aizawaStep(state, 0.008);

  const color = new THREE.Color();
  const scale = 1.5;
  for (let i = 0; i < POINT_COUNT; i++) {
    const previous = state;
    for (let sub = 0; sub < 2; sub++) state = aizawaStep(state, 0.008);
    const [x = 0, y = 0, z = 0] = state;
    positions[i * 3] = x * scale;
    positions[i * 3 + 1] = (z - 0.6) * scale;
    positions[i * 3 + 2] = y * scale;

    const speed = Math.hypot(x - (previous[0] ?? 0), y - (previous[1] ?? 0), z - (previous[2] ?? 0));
    const speedMix = Math.min(1, speed * 6.5);
    color.setHSL(0.62 + speedMix * 0.16, 0.55 + speedMix * 0.35, 0.52 + speedMix * 0.28);
    colors[i * 3] = color.r * 0.58;
    colors[i * 3 + 1] = color.g * 0.58;
    colors[i * 3 + 2] = color.b * 0.58;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uTreble: { value: 0 },
    uBeat: { value: 0 },
    uSize: { value: 0.046 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.5) },
    uTexture: { value: glowTexture },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      uniform float uTime;
      uniform float uBass;
      uniform float uTreble;
      uniform float uBeat;
      uniform float uSize;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 pos = position;

        float radius = length(pos.xz);
        float phase = aSeed * 6.2831853;
        float swirl = sin(uTime * 0.9 + radius * 2.6 + phase) * (0.05 + uBass * 0.14);
        float ca = cos(swirl);
        float sa = sin(swirl);
        pos.xz = mat2(ca, -sa, sa, ca) * pos.xz;

        pos.y += sin(uTime * 1.6 + radius * 3.4 + phase) * (0.02 + uBass * 0.06 + uBeat * 0.05);
        pos.xz *= 1.0 + sin(uTime * 1.2 + radius * 1.5 + phase) * (0.01 + uBass * 0.03);

        float breath = 1.0 + uBass * 0.06 + uBeat * 0.055;
        pos *= breath;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float twinkle = 0.82 + 0.3 * sin(uTime * (1.8 + uTreble * 3.0) + phase * 5.0);
        gl_PointSize = uSize * uPixelRatio * (0.55 + aSeed * 0.8) * twinkle * (1.0 + uBass * 0.65) * (300.0 / max(0.6, -mvPosition.z));
        gl_PointSize = clamp(gl_PointSize, 0.5, 6.0);

        vColor = color;
        vAlpha = (0.34 + aSeed * 0.4) * (0.72 + 0.28 * sin(uTime * 2.4 + phase * 7.0));
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const group = new THREE.Group();
  scene.remove(points);
  group.add(points);
  scene.add(group);
  group.rotation.x = 0.18;

  function update(frame: AudioFrame) {
    const { time, bass, beat, treble } = frame;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uTreble.value = treble;
    uniforms.uBeat.value = beat;

    group.rotation.y = time * 0.14 + Math.sin(time * 0.23) * 0.3;
    group.rotation.x = 0.16 + Math.sin(time * 0.17) * 0.22;
    group.rotation.z = Math.sin(time * 0.11) * 0.14;
    const scale = 1 + bass * 0.05 + beat * 0.04;
    group.scale.set(scale, scale, scale);

    halo.material.opacity = 0.05 + bass * 0.1 + beat * 0.06;
    const haloScale = 6.4 + bass * 1.0 + beat * 0.5;
    halo.scale.set(haloScale, haloScale, 1);

    camera.position.x = Math.sin(time * 0.11) * 1.5;
    camera.position.y = 0.8 + Math.sin(time * 0.17) * 0.55 + bass * 0.45;
    camera.position.z = 6.6 + Math.cos(time * 0.09) * 0.9 - beat * 0.35;
    camera.lookAt(Math.sin(time * 0.083) * 0.25, 0.1 + Math.sin(time * 0.12) * 0.15, 0);
    camera.fov = 46 + beat * 2.5 + treble * 1.2;
    camera.updateProjectionMatrix();

    stars.rotation.y = time * 0.004;
    stars.rotation.z = treble * 0.05;
  }

  function resize(width: number, height: number) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function dispose() {
    disposeScene(scene);
    scene.clear();
  }

  update({
    time: 0,
    dt: 0.016,
    playing: false,
    bass: 0.14,
    mid: 0.09,
    treble: 0.06,
    energy: 0.1,
    beat: 0,
    spectrum: new Uint8Array(128),
  });

  return { scene, camera, update, resize, dispose, bloom: 0.32, bloomRadius: 0.32, bloomThreshold: 0.9 };
}
