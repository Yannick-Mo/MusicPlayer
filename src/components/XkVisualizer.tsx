import { onMount, onCleanup, type Component } from "solid-js";
import { World } from "../visualizers/xk/world";
import { AudioEngine } from "../core/audioEngine";
import type { Visualizer3DStyle } from "../core/visualizerStyles";

interface XkVisualizerProps {
  active: boolean;
  audioEngine: AudioEngine;
  style: Exclude<Visualizer3DStyle, "galaxy">;
}

const XkVisualizer: Component<XkVisualizerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let canvasRef: HTMLCanvasElement | undefined;
  let world: World | null = null;
  let rafId: number | null = null;
  let startTime = 0;
  let prevTime = 0;
  let bassAvg = 0;
  let lastBeat = 0;
  let beatPulse = 0;
  let intensity = 0.16;

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!world) return;

    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;

    const playing = props.audioEngine.playing && props.active;
    let bass = 0;
    let energy = 0;

    if (playing) {
      const raw = props.audioEngine.getAnalyserData();
      let low = 0;
      let all = 0;
      for (let i = 1; i <= 10 && i < raw.length; i++) low += raw[i];
      for (let i = 1; i < raw.length; i++) all += raw[i];
      bass = Math.min(1, low / (10 * 170));
      energy = Math.min(1, all / ((raw.length - 1) * 140));
      bassAvg += (bass - bassAvg) * Math.min(1, dt * 2);

      if (bass > bassAvg * 1.26 + 0.03 && elapsed - lastBeat > 0.2) {
        lastBeat = elapsed;
        beatPulse = 1;
        if (props.style === "cosmos" || props.style === "voyage" || props.style === "asteroids") {
          const xk = world as unknown as { warpSurge: number };
          xk.warpSurge = Math.max(xk.warpSurge, 0.16 + bass * 0.18);
        }
      }
    } else {
      const phase = (elapsed % 1.8) / 1.8;
      beatPulse = Math.max(beatPulse * 0.94, Math.pow(1 - phase, 4) * 0.22);
    }

    beatPulse *= Math.exp(-dt * 4.2);
    const target = playing
      ? Math.max(0.22, Math.min(1.15, 0.26 + energy * 0.85 + bass * 0.35))
      : 0.16 + Math.sin(elapsed * 0.2) * 0.02;
    intensity += (target - intensity) * Math.min(1, dt * 2.4);

    world.update(dt, elapsed, {
      intensity,
      beatPulse,
      paused: false,
    });
    world.render();
  }

  function resize() {
    if (world) world.resize();
  }

  onMount(() => {
    startTime = performance.now();
    prevTime = startTime;
    if (canvasRef) world = new World(canvasRef, { style: props.style });
    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(animate);

    onCleanup(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (world) {
        world.dispose();
        world = null;
      }
    });
  });

  return (
    <div ref={containerRef} class="absolute inset-0 w-full h-full pointer-events-none">
      <canvas ref={canvasRef} class="block w-full h-full" />
    </div>
  );
};

export default XkVisualizer;
