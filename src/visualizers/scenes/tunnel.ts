import * as THREE from "three";
import type { AudioFrame, SceneInstance } from "./types";
import { clamp, createStarField, disposeScene, makeGlowTexture, spectrumAt } from "./utils";

const RING_COUNT = 46;
const BARS_PER_RING = 56;
const SPACING = 5.6;
const TUNNEL_LENGTH = RING_COUNT * SPACING;
const BASE_RADIUS = 4.1;

export function createTunnelScene(): SceneInstance {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03010a);
  scene.fog = new THREE.FogExp2(0x08021a, 0.0135);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
  camera.position.set(0, 0, 2.5);

  const stars = createStarField(700, 40, 120, 0.6, 0.5);
  scene.add(stars);

  const glowTexture = makeGlowTexture(128);
  const coreGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x8f6bff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  coreGlow.position.set(0, 0, -240);
  coreGlow.scale.set(90, 90, 1);
  scene.add(coreGlow);

  const barGeometry = new THREE.BoxGeometry(0.07, 1, 0.07);
  const barMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const bars = new THREE.InstancedMesh(barGeometry, barMaterial, RING_COUNT * BARS_PER_RING);
  bars.frustumCulled = false;
  scene.add(bars);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let ring = 0; ring < RING_COUNT; ring++) {
    for (let bar = 0; bar < BARS_PER_RING; bar++) {
      const index = ring * BARS_PER_RING + bar;
      const depth = ring / RING_COUNT;
      color.setHSL(0.5 + depth * 0.36, 1.0, 0.38);
      bars.setColorAt(index, color);
    }
  }
  if (bars.instanceColor) bars.instanceColor.needsUpdate = true;

  const ringLines: THREE.LineLoop[] = [];
  const ringPositions: number[] = [];
  const ringLineMaterial = new THREE.LineBasicMaterial({
    color: 0x4a7cff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const circlePoints: THREE.Vector3[] = [];
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    circlePoints.push(new THREE.Vector3(Math.cos(angle) * BASE_RADIUS, Math.sin(angle) * BASE_RADIUS, 0));
  }
  const circleGeometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
  for (let ring = 0; ring < RING_COUNT; ring++) {
    const line = new THREE.LineLoop(circleGeometry, ringLineMaterial);
    const z = -ring * SPACING;
    line.position.z = z;
    ringPositions.push(z);
    ringLines.push(line);
    scene.add(line);
  }

  const shockwaves: THREE.Mesh[] = [];
  const shockMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5fd0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const shockGeometry = new THREE.TorusGeometry(1, 0.012, 6, 128);
  for (let i = 0; i < 4; i++) {
    const wave = new THREE.Mesh(shockGeometry, shockMaterial.clone());
    wave.position.z = -12 - i * 3;
    wave.visible = false;
    scene.add(wave);
    shockwaves.push(wave);
  }
  let waveIndex = 0;

  let lastBeat = 0;

  function update(frame: AudioFrame) {
    const { time, dt, bass, mid, beat, spectrum, energy } = frame;
    const speed = 9 + bass * 22 + energy * 8;
    const travel = speed * dt;

    for (let ring = 0; ring < RING_COUNT; ring++) {
      let z = ringPositions[ring] + travel;
      if (z > 4) z -= TUNNEL_LENGTH;
      ringPositions[ring] = z;
      ringLines[ring].position.z = z;
    }

    for (let ring = 0; ring < RING_COUNT; ring++) {
      const z = ringPositions[ring];
      const depth = clamp(-z / TUNNEL_LENGTH, 0, 1);
      const depthFade = 1 - depth * 0.55;
      for (let bar = 0; bar < BARS_PER_RING; bar++) {
        const index = ring * BARS_PER_RING + bar;
        const angle = (bar / BARS_PER_RING) * Math.PI * 2 + time * 0.06 + ring * 0.06;
        const sample = spectrumAt(spectrum, (bar / BARS_PER_RING) * 0.85 + 0.02);
        const wave = 0.5 + 0.5 * Math.sin(time * 1.7 + ring * 0.55 + bar * 0.2);
        const level = sample * 0.8 + wave * 0.08 + bass * 0.22 + mid * 0.08;
        const height = (0.16 + level * (2.4 + bass * 2.6)) * depthFade;
        const radius = BASE_RADIUS + sample * 0.7 + beat * 0.25;
        dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
        dummy.rotation.set(0, 0, angle - Math.PI / 2);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        bars.setMatrixAt(index, dummy.matrix);
      }
    }
    bars.instanceMatrix.needsUpdate = true;

    if (beat > 0.6 && time - lastBeat > 0.28) {
      lastBeat = time;
      const wave = shockwaves[waveIndex % shockwaves.length];
      waveIndex++;
      wave.visible = true;
      wave.scale.setScalar(0.5);
      wave.position.z = -7;
      (wave.material as THREE.MeshBasicMaterial).opacity = 0.75;
    }
    for (const wave of shockwaves) {
      if (!wave.visible) continue;
      const material = wave.material as THREE.MeshBasicMaterial;
      wave.scale.setScalar(wave.scale.x + dt * 9);
      wave.position.z -= dt * 5;
      material.opacity -= dt * 0.9;
      if (material.opacity <= 0.01) wave.visible = false;
    }

    camera.position.x = Math.sin(time * 0.31) * 0.22;
    camera.position.y = Math.cos(time * 0.24) * 0.18;
    camera.rotation.z = Math.sin(time * 0.17) * 0.07;
    camera.lookAt(Math.sin(time * 0.13) * 0.35, Math.cos(time * 0.11) * 0.3, -40);

    coreGlow.material.opacity = 0.2 + bass * 0.25 + beat * 0.15;
    stars.rotation.z = time * 0.006;
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

  return { scene, camera, update, resize, dispose, bloom: 0.6 };
}
