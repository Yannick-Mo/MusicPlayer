import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioEngine } from "./audioEngine";

function mockWebAudio() {
  const gainValue = { value: 1 };
  const gainNode: any = { gain: gainValue, connect: vi.fn() };

  const analyserNode: any = {
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => { arr.fill(128); }),
    connect: vi.fn(),
  };

  let audioContextState = "running";
  const audioContext: any = {
    get state() { return audioContextState; },
    createGain: vi.fn(() => gainNode),
    createAnalyser: vi.fn(() => analyserNode),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
    resume: vi.fn(() => { audioContextState = "running"; }),
    close: vi.fn(),
  };

  const eventListeners = new Map<string, Array<(...args: any[]) => void>>();
  const addEventListener = vi.fn((event: string, handler: (...args: any[]) => void) => {
    if (!eventListeners.has(event)) eventListeners.set(event, []);
    eventListeners.get(event)!.push(handler);
  });
  const fireEvent = (event: string) => {
    const handlers = eventListeners.get(event);
    if (handlers) handlers.forEach(h => h());
  };

  const audioElement: any = {
    src: "",
    crossOrigin: "",
    currentTime: 0,
    duration: 120,
    paused: true,
    load: vi.fn(() => { fireEvent("canplaythrough"); }),
    play: vi.fn(() => { audioElement.paused = false; }),
    pause: vi.fn(() => { audioElement.paused = true; }),
    addEventListener,
    removeEventListener: vi.fn(),
  };

  (globalThis as any).AudioContext = vi.fn(() => audioContext);
  (globalThis as any).Audio = vi.fn(() => audioElement);

  return { audioContext, audioElement, analyserNode, gainNode, fireEvent };
}

describe("AudioEngine", () => {
  let mocks: ReturnType<typeof mockWebAudio>;
  let engine: AudioEngine;

  beforeEach(() => {
    mocks = mockWebAudio();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.destroy();
    vi.restoreAllMocks();
  });

  it("initializes with zero state", () => {
    expect(engine.currentTime).toBe(0);
    expect(engine.duration).toBe(0);
    expect(engine.playing).toBe(false);
  });

  it("setVolume clamps to [0, 1]", async () => {
    await engine.load("test.mp3");
    engine.setVolume(50);
    expect(mocks.gainNode.gain.value).toBe(0.5);
    engine.setVolume(150);
    expect(mocks.gainNode.gain.value).toBe(1);
    engine.setVolume(-10);
    expect(mocks.gainNode.gain.value).toBe(0);
  });

  it("setMuted sets gain to 0", async () => {
    await engine.load("test.mp3");
    engine.setVolume(50);
    engine.setMuted(true);
    expect(mocks.gainNode.gain.value).toBe(0);
  });

  it("setMuted(false) restores previous volume", async () => {
    await engine.load("test.mp3");
    engine.setVolume(50);
    engine.setMuted(false);
    expect(mocks.gainNode.gain.value).toBe(0.5);
  });

  it("getAnalyserData returns Uint8Array", () => {
    const data = engine.getAnalyserData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(128);
  });

  it("registers and calls event handlers", async () => {
    await engine.load("test.mp3");
    const onTimeUpdate = vi.fn();
    engine.on("onTimeUpdate", onTimeUpdate);

    mocks.fireEvent("timeupdate");
    expect(onTimeUpdate).toHaveBeenCalled();
  });

  it("play resumes suspended AudioContext", async () => {
    engine.load("test.mp3");
    await engine.play();
    expect(mocks.audioElement.play).toHaveBeenCalled();
  });
});
