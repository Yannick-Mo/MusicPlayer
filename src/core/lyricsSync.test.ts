import { describe, it, expect } from "vitest";
import { LyricsSync } from "./lyricsSync";

describe("LyricsSync", () => {
  const sampleLrc = `[00:01.00]Hello world
[00:04.00]Second line
[00:08.00]Third line`;

  it("hasLyrics is false when no lyrics loaded", () => {
    const sync = new LyricsSync();
    expect(sync.hasLyrics).toBe(false);
  });

  it("hasLyrics is true after load", async () => {
    const sync = new LyricsSync();
    await sync.load(sampleLrc);
    expect(sync.hasLyrics).toBe(true);
  });

  it("clear resets state", async () => {
    const sync = new LyricsSync();
    await sync.load(sampleLrc);
    sync.clear();
    expect(sync.hasLyrics).toBe(false);
  });

  it("update returns empty state when no lyrics", () => {
    const sync = new LyricsSync();
    const state = sync.update(5);
    expect(state.hasLyrics).toBe(false);
    expect(state.currentLine).toBeNull();
    expect(state.currentLineIndex).toBe(-1);
    expect(state.lines).toHaveLength(0);
  });

  it("update returns correct current line", async () => {
    const sync = new LyricsSync();
    await sync.load(sampleLrc);
    const state = sync.update(2.0);
    expect(state.hasLyrics).toBe(true);
    expect(state.currentLine?.text).toBe("Hello world");
    expect(state.currentLineIndex).toBe(0);
  });

  it("update returns second line at its startTime", async () => {
    const sync = new LyricsSync();
    await sync.load(sampleLrc);
    const state = sync.update(4.0);
    expect(state.currentLine?.text).toBe("Second line");
    expect(state.currentLineIndex).toBe(1);
  });

  it("update returns third line after previous end", async () => {
    const sync = new LyricsSync();
    await sync.load(sampleLrc);
    const state = sync.update(9.0);
    expect(state.currentLine?.text).toBe("Third line");
    expect(state.currentLineIndex).toBe(2);
  });

  it("update tracks word progress with word-level timestamps", async () => {
    const lrc = `[00:01.00]<00:01.00>Hello <00:01.60>world`;
    const sync = new LyricsSync();
    await sync.load(lrc);
    const state = sync.update(1.3);
    expect(state.currentWordIndex).toBe(0);
    expect(state.wordProgress).toBeCloseTo(0.5, 1);
  });
});
