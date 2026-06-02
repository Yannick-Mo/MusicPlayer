import { type LrcData, type LrcLine, parseLrc, findCurrentLine, findCurrentWord, getWordProgress } from "./lrcParser";

export interface SyncState {
  currentLine: LrcLine | null;
  currentLineIndex: number;
  currentWordIndex: number;
  wordProgress: number;
  lines: LrcLine[];
  hasLyrics: boolean;
}

export class LyricsSync {
  private lrcData: LrcData | null = null;
  private currentTime = 0;

  async load(lrcContent: string, translationContent?: string): Promise<void> {
    this.lrcData = parseLrc(lrcContent, translationContent);
  }

  clear(): void {
    this.lrcData = null;
    this.currentTime = 0;
  }

  update(time: number): SyncState {
    this.currentTime = time;
    const lines = this.lrcData?.lines ?? [];
    const hasLyrics = lines.length > 0;

    if (!hasLyrics) {
      return { currentLine: null, currentLineIndex: -1, currentWordIndex: -1, wordProgress: 0, lines: [], hasLyrics: false };
    }

    const currentLine = findCurrentLine(lines, time);
    const currentLineIndex = currentLine ? lines.indexOf(currentLine) : -1;

    let currentWordIndex = -1;
    let wordProgress = 0;

    if (currentLine) {
      const wIdx = findCurrentWord(currentLine, time);
      currentWordIndex = wIdx;
      if (wIdx >= 0 && wIdx < currentLine.words.length) {
        wordProgress = getWordProgress(currentLine.words[wIdx], time);
      } else if (wIdx >= currentLine.words.length) {
        wordProgress = 1;
      }
    }

    return { currentLine, currentLineIndex, currentWordIndex, wordProgress, lines, hasLyrics };
  }

  get hasLyrics(): boolean {
    return (this.lrcData?.lines.length ?? 0) > 0;
  }
}
