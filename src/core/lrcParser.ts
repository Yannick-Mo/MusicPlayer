export interface LrcWord {
  word: string;
  startTime: number;
  endTime: number;
}

export interface LrcLine {
  text: string;
  translation?: string;
  startTime: number;
  endTime: number;
  words: LrcWord[];
}

export interface LrcData {
  title?: string;
  artist?: string;
  album?: string;
  offset: number;
  lines: LrcLine[];
}

function parseTimestamp(ts: string): number {
  const match = ts.match(/(\d+):(\d+)[:.](\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
}

function extractWordTimestamps(text: string): { words: LrcWord[]; cleanText: string } {
  const wordRegex = /<(\d+:\d+[\.:]\d+)>([^<]*)/g;
  const words: LrcWord[] = [];
  let match;
  const cleanText = text.replace(/<\d+:\d+[\.:]\d+>/g, "");

  while ((match = wordRegex.exec(text)) !== null) {
    const startTime = parseTimestamp(match[1]);
    const word = match[2].trim();
    if (word) {
      words.push({ word, startTime, endTime: startTime });
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    words[i].endTime = words[i + 1].startTime;
  }

  return { words, cleanText };
}

export function parseLrc(lrcContent: string, translationContent?: string): LrcData {
  const metaKeys = new Set(["ti", "ar", "al", "offset", "title", "artist", "album", "by", "re", "ve", "length", "language", "tool", "author"]);

  function tryParseMeta(line: string): { key: string; value: string } | null {
    const m = line.match(/\[(\w+):(.+?)\]/);
    if (m && metaKeys.has(m[1].toLowerCase())) return { key: m[1].toLowerCase(), value: m[2].trim() };
    return null;
  }
  const lineRegex = /\[(\d+:\d+[\.:]\d+)\](.*)/;
  const lines: LrcLine[] = [];
  let offset = 0;

  const contentLines = lrcContent.split("\n");
  const transMap = new Map<number, string>();
  if (translationContent) {
    const transLines = translationContent.split("\n");
    let idx = 0;
    for (const tl of transLines) {
      const tm = tl.match(lineRegex);
      if (tm) {
        transMap.set(idx, tm[2].trim());
        idx++;
      }
    }
  }

  let transIdx = 0;
  const result: LrcData = { offset: 0, lines: [] };

  for (const raw of contentLines) {
    const line = raw.trim();
    if (!line) continue;

    const meta = tryParseMeta(line);
    if (meta) {
      if (meta.key === "offset") offset = parseInt(meta.value);
      else if (meta.key === "ti" || meta.key === "title") result.title = meta.value;
      else if (meta.key === "ar" || meta.key === "artist") result.artist = meta.value;
      else if (meta.key === "al" || meta.key === "album") result.album = meta.value;
      continue;
    }

    const lineMatch = line.match(lineRegex);
    if (lineMatch) {
      const startTime = parseTimestamp(lineMatch[1]);
      const rawText = lineMatch[2].trim();
      const { words, cleanText } = extractWordTimestamps(rawText);
      const translation = transMap.get(transIdx);

      lines.push({
        text: cleanText,
        translation,
        startTime,
        endTime: startTime + 4,
        words: words.length > 0 ? words : [{ word: cleanText, startTime, endTime: startTime + 4 }],
      });
      transIdx++;
    }
  }

  for (let i = 0; i < lines.length - 1; i++) {
    lines[i].endTime = lines[i + 1].startTime;
  }

  result.lines = lines;
  result.offset = offset;
  return result;
}

export function findCurrentLine(lines: LrcLine[], time: number): LrcLine | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (time >= lines[i].startTime) return lines[i];
  }
  return null;
}

export function findCurrentWord(line: LrcLine, time: number): number {
  if (line.words.length === 0) return -1;
  for (let i = line.words.length - 1; i >= 0; i--) {
    if (time >= line.words[i].startTime) return i;
  }
  return -1;
}

export function getWordProgress(word: LrcWord, time: number): number {
  const duration = word.endTime - word.startTime;
  if (duration <= 0) return time >= word.startTime ? 1 : 0;
  return Math.min(1, Math.max(0, (time - word.startTime) / duration));
}
