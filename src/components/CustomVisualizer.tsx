import { onMount, onCleanup, type Component } from "solid-js";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { AudioEngine } from "../core/audioEngine";
import type { CustomVisualizerStyle } from "../core/visualizerStyles";
import { createCustomScene } from "../visualizers/scenes";
import type { AudioFrame, SceneInstance } from "../visualizers/scenes/types";
import { clamp, damp } from "../visualizers/scenes/utils";

interface CustomVisualizerProps {
  active: boolean;
  audioEngine: AudioEngine;
  style: CustomVisualizerStyle;
}

const CustomVisualizer: Component<CustomVisualizerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let renderer: THREE.WebGLRenderer | null = null;
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let scene: SceneInstance | null = null;
  let rafId: number | null = null;
  let startTime = 0;
  let prevTime = 0;
  let bassSmooth = 0;
  let midSmooth = 0;
  let trebleSmooth = 0;
  let energySmooth = 0;
  let bassAvg = 0;
  let lastBeat = 0;
  let beatPulse = 0;

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!scene || !renderer || !composer) return;

    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;

    const playing = props.audioEngine.playing && props.active;
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let energy = 0;
    let spectrum: Uint8Array;

    if (playing) {
      spectrum = props.audioEngine.getAnalyserData();
      const length = spectrum.length;
      let low = 0;
      let middle = 0;
      let high = 0;
      let all = 0;
      const lowEnd = Math.min(11, length);
      const midEnd = Math.min(48, length);
      for (let i = 1; i < length; i++) {
        const value = spectrum[i];
        all += value;
        if (i < lowEnd) low += value;
        else if (i < midEnd) middle += value;
        else high += value;
      }
      bass = clamp(low / (Math.max(1, lowEnd - 1) * 220), 0, 1);
      mid = clamp(middle / (Math.max(1, midEnd - lowEnd) * 210), 0, 1);
      treble = clamp(high / (Math.max(1, length - midEnd) * 190), 0, 1);
      energy = clamp(all / (Math.max(1, length - 1) * 195), 0, 1);
      bassAvg = damp(bassAvg, bass, 1.5, dt);

      if (bass > bassAvg * 1.26 + 0.035 && elapsed - lastBeat > 0.2) {
        lastBeat = elapsed;
        beatPulse = 1;
      }
    } else {
      spectrum = new Uint8Array(128);
      const phase = (elapsed % 2.8) / 2.8;
      beatPulse = Math.max(beatPulse * 0.94, Math.pow(1 - phase, 5) * 0.35);
      bass = 0.14 + Math.sin(elapsed * 0.5) * 0.04;
      mid = 0.09 + Math.sin(elapsed * 0.37 + 1.2) * 0.03;
      treble = 0.06 + Math.sin(elapsed * 0.61 + 2.1) * 0.02;
      energy = 0.1 + Math.sin(elapsed * 0.23) * 0.03;
    }

    beatPulse *= Math.exp(-dt * 4.5);
    bassSmooth = damp(bassSmooth, bass, 6, dt);
    midSmooth = damp(midSmooth, mid, 5, dt);
    trebleSmooth = damp(trebleSmooth, treble, 7, dt);
    energySmooth = damp(energySmooth, energy, 3, dt);

    const frame: AudioFrame = {
      time: elapsed,
      dt,
      playing,
      bass: bassSmooth,
      mid: midSmooth,
      treble: trebleSmooth,
      energy: energySmooth,
      beat: beatPulse,
      spectrum,
    };

    scene.update(frame);
    composer.render();
  }

  function resize() {
    if (!containerRef || !renderer || !composer || !scene) return;
    const width = containerRef.clientWidth || window.innerWidth;
    const height = containerRef.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    scene.resize(width, height);
  }

  onMount(() => {
    if (!containerRef) return;
    startTime = performance.now();
    prevTime = startTime;

    const targetRatio = () => Math.min(window.devicePixelRatio || 1, 1.5);
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.setPixelRatio(1);
    containerRef.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    scene = createCustomScene(props.style);
    renderer.setPixelRatio(scene.pixelRatio ?? targetRatio());

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene.scene, scene.camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      scene.bloom ?? 0.5,
      scene.bloomRadius ?? 0.5,
      scene.bloomThreshold ?? 0.72,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    resize();
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(animate);

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (scene) {
        scene.dispose();
        scene = null;
      }
      if (bloomPass) {
        bloomPass.dispose();
        bloomPass = null;
      }
      if (composer) {
        composer.dispose();
        composer = null;
      }
      if (renderer) {
        renderer.forceContextLoss();
        renderer.dispose();
        if (containerRef && renderer.domElement.parentElement === containerRef) {
          containerRef.removeChild(renderer.domElement);
        }
        renderer = null;
      }
    });
  });

  return <div ref={containerRef} class="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default CustomVisualizer;
