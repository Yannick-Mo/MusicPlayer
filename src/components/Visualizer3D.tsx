import { Show, type Component } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { isXkVisualizerStyle, type Visualizer3DStyle } from "../core/visualizerStyles";
import GalaxyVisualizer from "./GalaxyVisualizer";
import XkVisualizer from "./XkVisualizer";
import CustomVisualizer from "./CustomVisualizer";

interface Visualizer3DProps {
  active: boolean;
  audioEngine: AudioEngine;
  color: string;
  style: Visualizer3DStyle;
}

const Visualizer3D: Component<Visualizer3DProps> = (props) => {
  return (
    <Show when={props.style} keyed>
      {(style) => {
        if (style === "galaxy") {
          return <GalaxyVisualizer active={props.active} audioEngine={props.audioEngine} color={props.color} />;
        }
        if (isXkVisualizerStyle(style)) {
          return <XkVisualizer active={props.active} audioEngine={props.audioEngine} style={style} />;
        }
        return <CustomVisualizer active={props.active} audioEngine={props.audioEngine} style={style} />;
      }}
    </Show>
  );
};

export default Visualizer3D;
