import type * as THREE from "three";

export interface AudioFrame {
  time: number;
  dt: number;
  playing: boolean;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beat: number;
  spectrum: Uint8Array;
}

export interface SceneInstance {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  update(frame: AudioFrame): void;
  resize(width: number, height: number): void;
  dispose(): void;
  bloom?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  pixelRatio?: number;
}

export type SceneFactory = () => SceneInstance;
