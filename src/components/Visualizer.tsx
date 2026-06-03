import { onMount, onCleanup, type Component } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { VisualizerData } from "../core/visualizerData";
import { hexToHsl } from "../core/utils";
import Visualizer3D from "./Visualizer3D";

interface VisualizerProps {
  active: boolean;
  visualizerData: VisualizerData;
  audioEngine: AudioEngine;
  mode: "2d" | "3d" | "off";
  color: string;
}

const Visualizer2D: Component<{ active: boolean; visualizerData: VisualizerData; audioEngine: AudioEngine; color: string }> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let rafId: number | null = null;

  const draw = () => {
    rafId = requestAnimationFrame(draw);
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const raw = props.audioEngine.getAnalyserData();
    const frame = props.visualizerData.process(raw, raw);
    const { width, height } = canvasRef;

    ctx.clearRect(0, 0, width, height);

    if (!props.active) return;

    const hsl = hexToHsl(props.color);
    const barCount = frame.frequencies.length;
    const barWidth = width / barCount;

    for (let i = 0; i < barCount; i++) {
      const barHeight = (frame.frequencies[i] / 255) * height * 0.6;
      const x = i * barWidth;
      const y = height - barHeight;
      const lightness = Math.min(90, Math.max(30, hsl.l + (i / barCount - 0.5) * 20));
      ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s}%, ${lightness}%)`;
      ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
    }

  };

  onMount(() => {
    if (canvasRef && canvasRef.parentElement) {
      canvasRef.width = canvasRef.parentElement.clientWidth;
      canvasRef.height = canvasRef.parentElement.clientHeight;
    }
    rafId = requestAnimationFrame(draw);
    onCleanup(() => { if (rafId !== null) cancelAnimationFrame(rafId); });
  });

  return <canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none" />;
};

const Visualizer: Component<VisualizerProps> = (props) => {
  return (
    <>
      {props.mode === "3d" && <Visualizer3D active={props.active} audioEngine={props.audioEngine} visualizerData={props.visualizerData} />}
      {props.mode === "2d" && <Visualizer2D active={props.active} visualizerData={props.visualizerData} audioEngine={props.audioEngine} color={props.color} />}
    </>
  );
};

export default Visualizer;
