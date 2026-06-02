import { describe, it, expect } from "vitest";
import { parseLrc, findCurrentLine, findCurrentWord, getWordProgress } from "./lrcParser";

describe("parseLrc", () => {
  const sampleLrc = `[ti:Test Song]
[ar:Test Artist]
[al:Test Album]
[offset:500]
[00:01.00]Line one
[00:04.50]Line two
[00:08.00]Line three`;

  it("parses metadata tags", () => {
    const result = parseLrc(sampleLrc);
    expect(result.title).toBe("Test Song");
    expect(result.artist).toBe("Test Artist");
    expect(result.album).toBe("Test Album");
    expect(result.offset).toBe(500);
  });

  it("parses timed lines", () => {
    const result = parseLrc(sampleLrc);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].text).toBe("Line one");
    expect(result.lines[0].startTime).toBe(1.0);
    expect(result.lines[1].text).toBe("Line two");
    expect(result.lines[1].startTime).toBe(4.5);
    expect(result.lines[2].text).toBe("Line three");
    expect(result.lines[2].startTime).toBe(8.0);
  });

  it("sets endTime from next line startTime", () => {
    const result = parseLrc(sampleLrc);
    expect(result.lines[0].endTime).toBe(4.5);
    expect(result.lines[1].endTime).toBe(8.0);
  });

  it("handles word-level timestamps", () => {
    const lrc = `[00:01.00]<00:01.00>Hello <00:01.80>world
[00:03.00]Normal line`;
    const result = parseLrc(lrc);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toBe("Hello world");
    expect(result.lines[0].words).toHaveLength(2);
    expect(result.lines[0].words[0].word).toBe("Hello");
    expect(result.lines[0].words[0].startTime).toBe(1.0);
    expect(result.lines[0].words[1].word).toBe("world");
    expect(result.lines[0].words[1].startTime).toBe(1.8);
  });

  it("includes translation when provided", () => {
    const lrc = `[00:01.00]Hello
[00:03.00]World`;
    const trans = `[00:01.00]你好
[00:03.00]世界`;
    const result = parseLrc(lrc, trans);
    expect(result.lines[0].translation).toBe("你好");
    expect(result.lines[1].translation).toBe("世界");
  });

  it("handles empty content", () => {
    const result = parseLrc("");
    expect(result.lines).toHaveLength(0);
  });

  it("parses timestamps with dot and colon separators", () => {
    const lrc = `[00:01:50]Dot style
[00:03:20]Colon style`;
    const result = parseLrc(lrc);
    expect(result.lines[0].startTime).toBe(1.5);
    expect(result.lines[1].startTime).toBe(3.2);
  });
});

describe("findCurrentLine", () => {
  const lines = parseLrc(`[00:01.00]A\n[00:04.00]B\n[00:08.00]C`).lines;

  it("returns null when no lines match", () => {
    expect(findCurrentLine(lines, 0)).toBeNull();
    expect(findCurrentLine(lines, 0.5)).toBeNull();
  });

  it("returns first line at its startTime", () => {
    expect(findCurrentLine(lines, 1.0)).toBe(lines[0]);
  });

  it("returns correct line during its interval", () => {
    expect(findCurrentLine(lines, 2.0)).toBe(lines[0]);
    expect(findCurrentLine(lines, 6.0)).toBe(lines[1]);
    expect(findCurrentLine(lines, 9.0)).toBe(lines[2]);
  });
});

describe("findCurrentWord", () => {
  const lrc = `[00:01.00]<00:01.00>One <00:01.60>Two <00:02.20>Three`;
  const line = parseLrc(lrc).lines[0];

  it("returns -1 before any word", () => {
    expect(findCurrentWord(line, 0.5)).toBe(-1);
  });

  it("returns correct word index at given time", () => {
    expect(findCurrentWord(line, 1.0)).toBe(0);
    expect(findCurrentWord(line, 1.6)).toBe(1);
    expect(findCurrentWord(line, 2.2)).toBe(2);
  });
});

describe("getWordProgress", () => {
  const word = { word: "Hello", startTime: 1.0, endTime: 2.0 };

  it("returns 0 before word starts", () => {
    expect(getWordProgress(word, 0.5)).toBe(0);
  });

  it("returns 0.5 at midpoint", () => {
    expect(getWordProgress(word, 1.5)).toBe(0.5);
  });

  it("returns 1 after word ends", () => {
    expect(getWordProgress(word, 2.5)).toBe(1);
  });
});
