import { Show, type Component } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import type { Visualizer3DStyle } from "../core/visualizerStyles";
import GalaxyVisualizer from "./GalaxyVisualizer";
import XkVisualizer from "./XkVisualizer";

interface Visualizer3DProps {
  active: boolean;
  audioEngine: AudioEngine;
  color: string;
  style: Visualizer3DStyle;
}

const Visualizer3D: Component<Visualizer3DProps> = (props) => {
  return (
    <>
      {props.style === "galaxy" ? (
        <GalaxyVisualizer active={props.active} audioEngine={props.audioEngine} color={props.color} />
      ) : (
        <Show when={props.style} keyed>
          {(style) => (
            <XkVisualizer
              active={props.active}
              audioEngine={props.audioEngine}
              style={style as Exclude<Visualizer3DStyle, "galaxy">}
            />
          )}
        </Show>
      )}
    </>
  );
};

export default Visualizer3D;
