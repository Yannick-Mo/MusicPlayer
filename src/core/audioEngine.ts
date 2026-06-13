export interface AudioEngineEvents {
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onEnded: () => void;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private events: AudioEngineEvents = {
    onTimeUpdate: () => {},
    onDurationChange: () => {},
    onPlayStateChange: () => {},
    onEnded: () => {},
  };
  private rafId: number | null = null;
  private _volume: number = 65;
  private _muted: boolean = false;

  on<E extends keyof AudioEngineEvents>(event: E, handler: AudioEngineEvents[E]): void {
    this.events[event] = handler;
  }

  async load(url: string): Promise<void> {
    this.cleanup();

    this.audioContext = new AudioContext();
    this.audioElement = new Audio(url);
    this.audioElement.crossOrigin = "anonymous";

    this.audioElement.addEventListener("loadedmetadata", () => {
      this.events.onDurationChange(this.audioElement!.duration);
    });
    this.audioElement.addEventListener("durationchange", () => {
      this.events.onDurationChange(this.audioElement!.duration);
    });
    this.audioElement.addEventListener("timeupdate", () => {
      this.events.onTimeUpdate(this.audioElement!.currentTime);
    });
    this.audioElement.addEventListener("ended", () => {
      this.events.onPlayStateChange(false);
      this.events.onEnded();
      this.stopRAF();
    });

    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) return reject(new Error("No audio element"));
      this.audioElement.addEventListener("canplaythrough", () => resolve(), { once: true });
      this.audioElement.addEventListener("error", () => reject(new Error("Failed to load audio")), { once: true });
      this.audioElement.load();
    });

    this.gainNode = this.audioContext.createGain();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;

    this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.setVolume(this._volume);
    if (this._muted) {
      this.gainNode.gain.value = 0;
    }

    setTimeout(() => {
      if (this.audioElement && this.audioElement.duration > 0) {
        this.events.onDurationChange(this.audioElement.duration);
      }
    }, 100);
  }

  async play(): Promise<void> {
    if (!this.audioElement || !this.audioContext) return;
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    try {
      await this.audioElement.play();
    } catch {
      this.events.onPlayStateChange(false);
      return;
    }
    this.events.onPlayStateChange(true);
    this.startRAF();
  }

  pause(): void {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.events.onPlayStateChange(false);
    this.stopRAF();
  }

  togglePlay(): void {
    if (!this.audioElement) return;
    if (this.audioElement.paused) this.play();
    else this.pause();
  }

  seek(time: number): void {
    if (!this.audioElement) return;
    this.audioElement.currentTime = time;
  }

  setVolume(vol: number): void {
    this._volume = vol;
    if (!this.gainNode) return;
    this.gainNode.gain.value = Math.max(0, Math.min(1, vol / 100));
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    if (!this.gainNode) return;
    this.gainNode.gain.value = muted ? 0 : Math.max(0, Math.min(1, this._volume / 100));
  }

  async fadeOut(durationSec: number): Promise<void> {
    if (!this.gainNode) return;
    const startGain = this.gainNode.gain.value;
    const startTime = performance.now();
    return new Promise((resolve) => {
      const step = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        const t = Math.min(1, elapsed / durationSec);
        this.gainNode!.gain.value = startGain * (1 - t);
        if (t >= 1) {
          this.gainNode!.gain.value = 0;
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  }

  async fadeIn(durationSec: number): Promise<void> {
    if (!this.gainNode) return;
    const targetGain = this._volume / 100;
    const startTime = performance.now();
    this.gainNode.gain.value = 0;
    return new Promise((resolve) => {
      const step = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        const t = Math.min(1, elapsed / durationSec);
        this.gainNode!.gain.value = targetGain * t;
        if (t >= 1) {
          this.gainNode!.gain.value = targetGain;
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  }

  get currentTime(): number {
    return this.audioElement?.currentTime ?? 0;
  }

  get duration(): number {
    return this.audioElement?.duration ?? 0;
  }

  get playing(): boolean {
    return this.audioElement ? !this.audioElement.paused : false;
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(128);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  private startRAF(): void {
    const loop = () => {
      this.events.onTimeUpdate(this.currentTime);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRAF(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.cleanup();
  }

  reset(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.stopRAF();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = "";
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioElement = null;
    this.audioContext = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.sourceNode = null;
  }
}
