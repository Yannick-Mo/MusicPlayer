export interface VisualizerFrame {
  frequencies: Uint8Array;
  waveform: Uint8Array;
  peak: number;
  average: number;
}

export class VisualizerData {
  private bufferLen = 128;
  private smoothFactor = 0.3;
  private smoothedFreq: Uint8Array = new Uint8Array(this.bufferLen);

  setBufferSize(size: number): void {
    this.bufferLen = size;
    this.smoothedFreq = new Uint8Array(size);
  }

  setSmoothFactor(factor: number): void {
    this.smoothFactor = Math.max(0, Math.min(1, factor));
  }

  process(frequencyData: Uint8Array, waveformData: Uint8Array): VisualizerFrame {
    const len = Math.min(frequencyData.length, this.bufferLen);
    let sum = 0;
    let peak = 0;

    for (let i = 0; i < len; i++) {
      const raw = frequencyData[i];
      this.smoothedFreq[i] = Math.round(
        this.smoothedFreq[i] * this.smoothFactor + raw * (1 - this.smoothFactor)
      );
      sum += this.smoothedFreq[i];
      if (this.smoothedFreq[i] > peak) peak = this.smoothedFreq[i];
    }

    return {
      frequencies: this.smoothedFreq.slice(0, len),
      waveform: waveformData.slice(0, len),
      peak,
      average: len > 0 ? sum / len : 0,
    };
  }

  reset(): void {
    this.smoothedFreq = new Uint8Array(this.bufferLen);
  }
}
