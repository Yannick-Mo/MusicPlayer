import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { createSkyDome, createStarField, disposeScene, makeGlowTexture } from "./utils";

const PARTICLE_COUNT = 32000;

type ShapeName = "sphere" | "knot" | "heart" | "galaxy" | "saturn" | "wave" | "cube";

const SHAPES: ShapeName[] = ["sphere", "knot", "heart", "galaxy", "saturn", "wave", "cube"];

function buildShape(name: ShapeName): { positions: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const color = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    let hue = 0.58;
    let saturation = 0.7;
    let lightness = 0.62;

    if (name === "sphere") {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.9 + Math.random() * 0.18;
      x = radius * Math.sin(phi) * Math.cos(theta);
      y = radius * Math.cos(phi);
      z = radius * Math.sin(phi) * Math.sin(theta);
      hue = 0.53 + Math.random() * 0.12;
      saturation = 0.55 + Math.random() * 0.4;
      lightness = 0.55 + Math.random() * 0.35;
    } else if (name === "knot") {
      const t = Math.random() * Math.PI * 2;
      const p = 2;
      const q = 3;
      const tube = 0.62 + Math.cos(q * t) * 0.62;
      x = tube * Math.cos(p * t) * 1.15;
      y = tube * Math.sin(p * t) * 1.15;
      z = Math.sin(q * t) * 0.85;
      const jitter = 0.07;
      x += (Math.random() - 0.5) * jitter;
      y += (Math.random() - 0.5) * jitter;
      z += (Math.random() - 0.5) * jitter;
      hue = 0.82 + Math.random() * 0.18;
      saturation = 0.8;
      lightness = 0.55 + Math.random() * 0.35;
    } else if (name === "heart") {
      const t = Math.random() * Math.PI * 2;
      const thickness = (Math.random() - 0.5) * 0.35;
      x = Math.pow(Math.sin(t), 3) * 1.6;
      y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.105;
      z = thickness;
      y += 0.15;
      hue = 0.96 + Math.random() * 0.06;
      saturation = 0.85;
      lightness = 0.58 + Math.random() * 0.3;
    } else if (name === "galaxy") {
      const radius = Math.pow(Math.random(), 0.65) * 2.7;
      const arm = Math.floor(Math.random() * 3);
      const angle = (arm / 3) * Math.PI * 2 + radius * 1.5 + Math.random() * 0.55;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = (Math.random() - 0.5) * (0.18 + radius * 0.09);
      hue = 0.56 + radius * 0.04 + Math.random() * 0.1;
      saturation = 0.6;
      lightness = 0.55 + Math.random() * 0.4;
    } else if (name === "saturn") {
      if (Math.random() < 0.62) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 1.2 + Math.random() * 0.1;
        x = radius * Math.sin(phi) * Math.cos(theta);
        y = radius * Math.cos(phi);
        z = radius * Math.sin(phi) * Math.sin(theta);
        hue = 0.1 + Math.random() * 0.08;
        saturation = 0.7;
        lightness = 0.6 + Math.random() * 0.25;
      } else {
        const radius = 1.75 + Math.random() * 1.15;
        const theta = Math.random() * Math.PI * 2;
        x = Math.cos(theta) * radius;
        z = Math.sin(theta) * radius;
        y = (Math.random() - 0.5) * 0.06;
        hue = 0.45 + Math.random() * 0.15;
        saturation = 0.45;
        lightness = 0.7;
      }
    } else if (name === "wave") {
      x = (Math.random() - 0.5) * 4.4;
      z = (Math.random() - 0.5) * 4.4;
      y = Math.sin(x * 1.8 + z * 0.8) * 0.5 + Math.cos(z * 2.2 - x * 0.4) * 0.32;
      hue = 0.48 + y * 0.08;
      saturation = 0.7;
      lightness = 0.55 + y * 0.25;
    } else {
      const half = 1.55;
      const face = Math.floor(Math.random() * 6);
      const a = (Math.random() - 0.5) * 2 * half;
      const b = (Math.random() - 0.5) * 2 * half;
      if (face === 0) (x = a), (y = b), (z = half);
      else if (face === 1) (x = a), (y = b), (z = -half);
      else if (face === 2) (x = a), (y = half), (z = b);
      else if (face === 3) (x = a), (y = -half), (z = b);
      else if (face === 4) (x = half), (y = a), (z = b);
      else (x = -half), (y = a), (z = b);
      hue = 0.72 + Math.random() * 0.12;
      saturation = 0.6;
      lightness = 0.6 + Math.random() * 0.3;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    color.setHSL(hue % 1, saturation, lightness);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  return { positions, colors };
}

export function createMorphScene(): SceneInstance {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(0, 0.7, 6.6);

  scene.add(
    createSkyDome({
      top: "#010107",
      middle: "#060a26",
      horizon: "#120b32",
      radius: 80,
    }),
  );
  const stars = createStarField(900, 18, 55, 0.4, 0.55);
  scene.add(stars);

  const shapeData = SHAPES.map((name) => ({ name, ...buildShape(name) }));
  const currentPositions = Float32Array.from(shapeData[0].positions);
  const currentColors = Float32Array.from(shapeData[0].colors);

  let targetIndex = 0;
  let targetPositions = shapeData[targetIndex].positions;
  let targetColors = shapeData[targetIndex].colors;

  const phase = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) phase[i] = 0.65 + Math.random() * 0.9;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(currentColors, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(phase, 1));

  const glowTexture = makeGlowTexture(64);
  const uniforms = {
    uTime: { value: 0 },
    uBass: { value: 0 },
    uBeat: { value: 0 },
    uSize: { value: 0.028 },
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
      uniform float uBeat;
      uniform float uSize;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        float swirl = sin(uTime * 0.8 + aSeed * 6.2831853) * (0.02 + uBass * 0.05);
        pos += normalize(pos + 0.0001) * swirl * (0.4 + uBeat);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uSize * uPixelRatio * (0.5 + aSeed * 0.9) * (1.0 + uBass * 0.6) * (300.0 / max(0.6, -mvPosition.z));
        gl_PointSize = clamp(gl_PointSize, 0.6, 5.0);
        vColor = color * (0.55 + uBass * 0.25 + uBeat * 0.15);
        vAlpha = 0.24 + aSeed * 0.32;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.05, d) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let lastMorph = 0;

  function morphTo(index: number) {
    targetIndex = index % shapeData.length;
    targetPositions = shapeData[targetIndex].positions;
    targetColors = shapeData[targetIndex].colors;
  }

  function update(frame: AudioFrame) {
    const { time, dt, bass, beat } = frame;
    uniforms.uTime.value = time;
    uniforms.uBass.value = bass;
    uniforms.uBeat.value = beat;

    const sinceMorph = time - lastMorph;
    if (sinceMorph > 10.5 || (beat > 0.82 && sinceMorph > 4.2)) {
      lastMorph = time;
      morphTo(targetIndex + 1);
    }

    const positions = geometry.attributes.position.array as Float32Array;
    const colors = geometry.attributes.color.array as Float32Array;
    const speed = 1.9;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const rate = Math.min(1, dt * speed * phase[i]);
      const offset = i * 3;
      positions[offset] += (targetPositions[offset] - positions[offset]) * rate;
      positions[offset + 1] += (targetPositions[offset + 1] - positions[offset + 1]) * rate;
      positions[offset + 2] += (targetPositions[offset + 2] - positions[offset + 2]) * rate;
      colors[offset] += (targetColors[offset] - colors[offset]) * rate;
      colors[offset + 1] += (targetColors[offset + 1] - colors[offset + 1]) * rate;
      colors[offset + 2] += (targetColors[offset + 2] - colors[offset + 2]) * rate;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    points.rotation.y = time * 0.1 + beat * 0.06;
    points.rotation.x = Math.sin(time * 0.17) * 0.16;
    points.rotation.z = Math.cos(time * 0.11) * 0.06;
    const scale = 1 + bass * 0.05;
    points.scale.set(scale, scale, scale);

    camera.position.x = Math.sin(time * 0.07) * 2.4;
    camera.position.y = 0.7 + Math.sin(time * 0.16) * 0.4 + bass * 0.3;
    camera.position.z = 6.6 + Math.cos(time * 0.06) * 0.8 - beat * 0.3;
    camera.lookAt(0, 0, 0);

    stars.rotation.y = time * 0.004;
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

  return { scene, camera, update, resize, dispose, bloom: 0.5 };
}
