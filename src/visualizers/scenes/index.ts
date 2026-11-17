import type { CustomVisualizerStyle } from "../../core/visualizerStyles";
import type { SceneFactory } from "./types";
import { createHorizonScene } from "./horizon";
import { createLiquidScene } from "./liquid";
import { createTunnelScene } from "./tunnel";
import { createKaleidoscopeScene } from "./kaleidoscope";
import { createOceanScene } from "./ocean";
import { createSkylineScene } from "./skyline";
import { createFluidScene } from "./fluid";
import { createAttractorScene } from "./attractor";
import { createMandelbulbScene } from "./mandelbulb";
import { createMorphScene } from "./morph";

const FACTORIES: Record<CustomVisualizerStyle, SceneFactory> = {
  horizon: createHorizonScene,
  liquid: createLiquidScene,
  tunnel: createTunnelScene,
  kaleidoscope: createKaleidoscopeScene,
  ocean: createOceanScene,
  skyline: createSkylineScene,
  fluid: createFluidScene,
  attractor: createAttractorScene,
  mandelbulb: createMandelbulbScene,
  morph: createMorphScene,
};

export function createCustomScene(style: CustomVisualizerStyle) {
  return FACTORIES[style]();
}
