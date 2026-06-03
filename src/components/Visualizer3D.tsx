import { onMount, onCleanup, createEffect, type Component } from "solid-js";
import * as THREE from "three";
import { AudioEngine } from "../core/audioEngine";
import { VisualizerData } from "../core/visualizerData";

interface Visualizer3DProps {
  active: boolean;
  audioEngine: AudioEngine;
  visualizerData: VisualizerData;
}

const GRID_SIZE = 64;
const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE;

const Visualizer3D: Component<Visualizer3DProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let geometry: THREE.BufferGeometry;
  let material: THREE.PointsMaterial;
  let points: THREE.Points;
  let positions: Float32Array;
  let colors: Float32Array;
  let rafId: number | null = null;
  let rotationAngle = 0;

  function buildTerrain() {
    geometry = new THREE.BufferGeometry();
    positions = new Float32Array(PARTICLE_COUNT * 3);
    colors = new Float32Array(PARTICLE_COUNT * 3);

    const half = GRID_SIZE / 2;
    let idx = 0;
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const px = (x - half) * 0.3;
        const pz = (z - half) * 0.3;
        positions[idx] = px;
        positions[idx + 1] = 0;
        positions[idx + 2] = pz;
        colors[idx] = 0.39;
        colors[idx + 1] = 0.4;
        colors[idx + 2] = 0.95;
        idx += 3;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    points = new THREE.Points(geometry, material);
    scene.add(points);
  }

  function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 12, 16);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a0f, 1);

    if (containerRef) {
      containerRef.appendChild(renderer.domElement);
    }

    buildTerrain();
  }

  function resize() {
    if (!containerRef || !renderer) return;
    const w = containerRef.clientWidth;
    const h = containerRef.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (!props.active) return;

    const raw = props.audioEngine.getAnalyserData();
    const frame = props.visualizerData.process(raw, raw);

    const half = GRID_SIZE / 2;
    let idx = 0;
    const freqLen = frame.frequencies.length;

    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const fi = Math.floor((x + z * GRID_SIZE) / PARTICLE_COUNT * freqLen) % freqLen;
        const height = (frame.frequencies[fi] / 255) * 5;

        idx = (z * GRID_SIZE + x) * 3;
        positions[idx + 1] *= 0.85;
        positions[idx + 1] += height * 0.15;

        const normalized = positions[idx + 1] / 5;
        const r = 0.39 + normalized * 0.25;
        const g = 0.4 + normalized * 0.2;
        const b = 0.95 - normalized * 0.25;
        colors[idx] = Math.min(1, r);
        colors[idx + 1] = Math.min(1, g);
        colors[idx + 2] = Math.min(1, b);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    rotationAngle += 0.002;
    points.rotation.y = rotationAngle;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(animate);
  }

  onMount(() => {
    initScene();
    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(animate);

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (containerRef && renderer.domElement.parentElement === containerRef) {
        containerRef.removeChild(renderer.domElement);
      }
    });
  });

  createEffect(() => {
    if (props.active) startAnimation();
  });

  return <div ref={containerRef} class="absolute inset-0 w-full h-full pointer-events-none" style={{ display: props.active ? "" : "none" }} />;
};

export default Visualizer3D;
