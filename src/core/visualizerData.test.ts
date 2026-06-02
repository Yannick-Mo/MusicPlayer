import { describe, it, expect } from "vitest";
import { VisualizerData } from "./visualizerData";

describe("VisualizerData", () => {
  it("initially returns zero frequencies", () => {
    const vd = new VisualizerData();
    const frame = vd.process(new Uint8Array(128), new Uint8Array(128));
    expect(frame.frequencies).toHaveLength(128);
    expect(frame.average).toBe(0);
    expect(frame.peak).toBe(0);
  });

  it("smooths frequency data over time", () => {
    const vd = new VisualizerData();
    vd.setSmoothFactor(0.5);
    vd.process(new Uint8Array(128).fill(200), new Uint8Array(128));
    const frame2 = vd.process(new Uint8Array(128).fill(0), new Uint8Array(128));
    expect(frame2.frequencies[0]).toBeGreaterThan(0);
    expect(frame2.frequencies[0]).toBeLessThan(200);
  });

  it("setSmoothFactor clamps to [0,1]", () => {
    const vd = new VisualizerData();
    vd.setSmoothFactor(-1);
    vd.setSmoothFactor(2);
    const frame = vd.process(new Uint8Array(128).fill(100), new Uint8Array(128));
    expect(frame.frequencies[0]).toBeGreaterThanOrEqual(0);
  });

  it("setBufferSize changes buffer length", () => {
    const vd = new VisualizerData();
    vd.setBufferSize(64);
    const frame = vd.process(new Uint8Array(64), new Uint8Array(64));
    expect(frame.frequencies).toHaveLength(64);
  });

  it("reset clears smoothed data", () => {
    const vd = new VisualizerData();
    vd.process(new Uint8Array(128).fill(200), new Uint8Array(128));
    vd.reset();
    const frame = vd.process(new Uint8Array(128).fill(100), new Uint8Array(128));
    expect(frame.frequencies[0]).toBe(70);
  });

  it("computes correct peak and average", () => {
    const vd = new VisualizerData();
    const data = new Uint8Array(128);
    data[0] = 255;
    data[1] = 128;
    const frame = vd.process(data, new Uint8Array(128));
    expect(frame.peak).toBe(179);
    expect(frame.average).toBeCloseTo(269 / 128, 1);
  });
});
