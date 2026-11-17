import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import type { AudioFrame, SceneInstance } from "./types";
import { clamp, createSkyDome, createStarField, disposeScene, spectrumAt } from "./utils";

const COLS = 96;
const ROWS = 64;
const WIDTH = 150;
const DEPTH = 260;

export function createHorizonScene(): SceneInstance {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06010f);
  scene.fog = new THREE.FogExp2(0x0a0218, 0.0115);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
  camera.position.set(0, 12, 30);

  const noise = new ImprovedNoise();
  const sky = createSkyDome({
    top: "#04010c",
    middle: "#16052e",
    horizon: "#43103f",
    radius: 320,
  });
  scene.add(sky);

  const stars = createStarField(1400, 140, 260, 0.9, 0.7);
  stars.position.y = 30;
  scene.add(stars);

  const sunUniforms = {
    uTime: { value: 0 },
    uBeat: { value: 0 },
    uBass: { value: 0 },
  };
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(84, 84),
    new THREE.ShaderMaterial({
      uniforms: sunUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBeat;
        uniform float uBass;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p);
          float disc = smoothstep(0.34, 0.325, r);
          float halo = smoothstep(0.5, 0.12, r) * 0.32;
          float stripe = 1.0;
          if (vUv.y < 0.47) {
            stripe = smoothstep(0.3, 0.7, fract((vUv.y + uTime * 0.015) * 17.0));
          }
          float wave = 0.9 + 0.1 * sin(vUv.y * 42.0 + uTime * 1.4);
          vec3 top = vec3(1.0, 0.85, 0.42);
          vec3 bottom = vec3(1.0, 0.22, 0.55);
          vec3 color = mix(bottom, top, smoothstep(0.1, 0.85, vUv.y));
          color *= (0.6 + uBass * 0.28) * wave * (1.0 + uBeat * 0.22);
          float alpha = (disc * stripe + halo * (0.5 + uBeat * 0.4)) * (1.0 - smoothstep(0.42, 0.5, r));
          gl_FragColor = vec4(color, alpha * 0.75);
        }
      `,
    }),
  );
  sun.position.set(0, 19, -175);
  scene.add(sun);

  const heightGrid = new Float32Array((ROWS + 1) * (COLS + 1));
  const gridX = new Float32Array(COLS + 1);
  const gridZ = new Float32Array(ROWS + 1);
  for (let c = 0; c <= COLS; c++) gridX[c] = -WIDTH / 2 + (c / COLS) * WIDTH;
  for (let r = 0; r <= ROWS; r++) gridZ[r] = 24 - (r / ROWS) * DEPTH;

  const horizontalVertices = (ROWS + 1) * COLS * 2;
  const verticalVertices = (COLS + 1) * ROWS * 2;
  const totalVertices = horizontalVertices + verticalVertices;
  const positions = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 3);

  const lineIndices: Array<[number, number]> = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      lineIndices.push([r * (COLS + 1) + c, r * (COLS + 1) + c + 1]);
    }
  }
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      lineIndices.push([r * (COLS + 1) + c, (r + 1) * (COLS + 1) + c]);
    }
  }

  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  terrainGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const terrainMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const terrain = new THREE.LineSegments(terrainGeometry, terrainMaterial);
  terrain.frustumCulled = false;
  scene.add(terrain);

  const lowColor = new THREE.Color("#ff2f9a");
  const midColor = new THREE.Color("#8b5cff");
  const highColor = new THREE.Color("#3ce8ff");
  const tempColor = new THREE.Color();

  let scroll = 0;

  function update(frame: AudioFrame) {
    const { time, dt, bass, mid, beat, spectrum } = frame;
    scroll += dt * (4.5 + bass * 9);
    const energyScale = 0.75 + bass * 1.1 + mid * 0.45;

    for (let r = 0; r <= ROWS; r++) {
      const z = gridZ[r];
      for (let c = 0; c <= COLS; c++) {
        const x = gridX[c];
        const ridge =
          noise.noise(x * 0.018, z * 0.012 + scroll * 0.055, 0.0) * 7.2 +
          noise.noise(x * 0.06, z * 0.05 + scroll * 0.12, 1.7) * 2.1 +
          Math.sin(x * 0.09 + z * 0.035 + time * 0.6) * 0.55;
        const t = clamp((x + WIDTH / 2) / WIDTH, 0, 1);
        const spectrumShape = spectrumAt(spectrum, 0.04 + t * 0.55);
        const spectre = spectrumShape * (5 + bass * 9) * (0.4 + 0.6 * Math.abs(ridge) / 9);
        heightGrid[r * (COLS + 1) + c] = (ridge + spectre) * energyScale + 1.2;
      }
    }

    let vertex = 0;
    for (let index = 0; index < lineIndices.length; index++) {
      const [a, b] = lineIndices[index];
      for (const pointIndex of [a, b]) {
        const r = Math.floor(pointIndex / (COLS + 1));
        const c = pointIndex % (COLS + 1);
        const x = gridX[c];
        const z = gridZ[r];
        const h = heightGrid[pointIndex];
        positions[vertex * 3] = x;
        positions[vertex * 3 + 1] = h;
        positions[vertex * 3 + 2] = z;
        const heightMix = clamp(h / 16, 0, 1);
        tempColor.copy(lowColor).lerp(midColor, Math.min(1, heightMix * 1.6));
        tempColor.lerp(highColor, Math.max(0, heightMix - 0.4) * 1.7);
        const fade = 0.5 + smoothFade(r / ROWS) * 0.65;
        colors[vertex * 3] = tempColor.r * fade;
        colors[vertex * 3 + 1] = tempColor.g * fade;
        colors[vertex * 3 + 2] = tempColor.b * fade;
        vertex++;
      }
    }

    terrainGeometry.attributes.position.needsUpdate = true;
    terrainGeometry.attributes.color.needsUpdate = true;

    sunUniforms.uTime.value = time;
    sunUniforms.uBeat.value = beat;
    sunUniforms.uBass.value = bass;
    const sunScale = 1 + beat * 0.06 + bass * 0.04;
    sun.scale.set(sunScale, sunScale, 1);

    stars.rotation.y = time * 0.004;
    sky.position.set(camera.position.x, 0, camera.position.z);

    camera.position.x = Math.sin(time * 0.09) * 2.2;
    camera.position.y = 12 + Math.sin(time * 0.23) * 0.5 + bass * 0.9 + beat * 0.7;
    camera.position.z = 30 - beat * 2.0;
    camera.lookAt(Math.sin(time * 0.06) * 1.5, 9 + bass * 2.5, -70);
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

  return { scene, camera, update, resize, dispose, bloom: 0.42, bloomRadius: 0.4, bloomThreshold: 0.88, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) };
}

function smoothFade(t: number): number {
  return Math.min(1, Math.max(0, t * 1.4));
}
