import { createStore } from "solid-js/store";
import type { SyncState } from "../core/lyricsSync";
import { formatTime } from "../core/utils";
import { isVisualizer3DStyle, type Visualizer3DStyle } from "../core/visualizerStyles";

export interface QueueItem {
  id: number;
  title: string;
  artist: string;
  duration?: string;
  hasLyrics?: boolean;
}

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playMode: "sequential" | "repeat" | "shuffle";
  currentSongId: number | null;
  currentSongTitle: string;
  currentSongArtist: string;
  error: string | null;
  syncState: SyncState;
  queue: QueueItem[];
  queueIndex: number;
  visualizerColor: string;
  visualizerMode: "2d" | "3d" | "off";
  visualizer3dStyle: Visualizer3DStyle;
  fontSize: number;
  showTranslation: boolean;
  backgroundImage: string;
  backgroundOverlay: number;
  backgroundImageKey: number;
  lyricsOpacity: number;
  lyricsBgColor: string;
  resumePlayback: boolean;
  lastTime: number;
  lastPlaying: boolean;
  lyricsActiveWordColor: string;
  lyricsActiveLineColor: string;
  lyricsInactiveColor: string;
  crossfade: boolean;
  crossfadeDuration: number;
  sleepTimerEnd: number | null;
  accentColor: string;
}

const PLAYER_STORAGE_KEY = "music-player-player";

export function loadPlayerState(): boolean {
  const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.queue) setPlayerStore("queue", data.queue);
    if (typeof data.queueIndex === "number") setPlayerStore("queueIndex", data.queueIndex);
    if (typeof data.currentSongId === "number") setPlayerStore("currentSongId", data.currentSongId);
    if (data.currentSongTitle) setPlayerStore("currentSongTitle", data.currentSongTitle);
    if (data.currentSongArtist) setPlayerStore("currentSongArtist", data.currentSongArtist);
    if (typeof data.volume === "number") setPlayerStore("volume", data.volume);
    if (typeof data.playMode === "string" && ["sequential", "repeat", "shuffle"].includes(data.playMode)) setPlayerStore("playMode", data.playMode as "sequential" | "repeat" | "shuffle");
    if (typeof data.visualizerColor === "string") setPlayerStore("visualizerColor", data.visualizerColor);
    if (typeof data.visualizerMode === "string" && ["2d", "3d", "off"].includes(data.visualizerMode)) setPlayerStore("visualizerMode", data.visualizerMode as "2d" | "3d" | "off");
    if (isVisualizer3DStyle(data.visualizer3dStyle)) setPlayerStore("visualizer3dStyle", data.visualizer3dStyle);
    if (typeof data.fontSize === "number") setPlayerStore("fontSize", data.fontSize);
    if (typeof data.showTranslation === "boolean") setPlayerStore("showTranslation", data.showTranslation);
    if (typeof data.backgroundImage === "string") setPlayerStore("backgroundImage", data.backgroundImage);
    if (typeof data.backgroundOverlay === "number") setPlayerStore("backgroundOverlay", data.backgroundOverlay);
    if (typeof data.backgroundImageKey === "number") setPlayerStore("backgroundImageKey", data.backgroundImageKey);
    if (typeof data.lyricsOpacity === "number") setPlayerStore("lyricsOpacity", data.lyricsOpacity);
    if (typeof data.lyricsBgColor === "string") setPlayerStore("lyricsBgColor", data.lyricsBgColor);
    if (typeof data.resumePlayback === "boolean") setPlayerStore("resumePlayback", data.resumePlayback);
    if (typeof data.lastTime === "number") setPlayerStore("lastTime", data.lastTime);
    if (typeof data.lastPlaying === "boolean") setPlayerStore("lastPlaying", data.lastPlaying);
    if (typeof data.lyricsActiveWordColor === "string") setPlayerStore("lyricsActiveWordColor", data.lyricsActiveWordColor);
    if (typeof data.lyricsActiveLineColor === "string") setPlayerStore("lyricsActiveLineColor", data.lyricsActiveLineColor);
    if (typeof data.lyricsInactiveColor === "string") setPlayerStore("lyricsInactiveColor", data.lyricsInactiveColor);
    if (typeof data.crossfade === "boolean") setPlayerStore("crossfade", data.crossfade);
    if (typeof data.crossfadeDuration === "number") setPlayerStore("crossfadeDuration", data.crossfadeDuration);
    if (typeof data.accentColor === "string") setPlayerStore("accentColor", data.accentColor);
    return true;
  } catch { return false; }
}

export function savePlayerState() {
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({
    queue: playerStore.queue,
    queueIndex: playerStore.queueIndex,
    currentSongId: playerStore.currentSongId,
    currentSongTitle: playerStore.currentSongTitle,
    currentSongArtist: playerStore.currentSongArtist,
    volume: playerStore.volume,
    playMode: playerStore.playMode,
    visualizerColor: playerStore.visualizerColor,
    visualizerMode: playerStore.visualizerMode,
    visualizer3dStyle: playerStore.visualizer3dStyle,
    fontSize: playerStore.fontSize,
    showTranslation: playerStore.showTranslation,
    backgroundImage: playerStore.backgroundImage,
    backgroundOverlay: playerStore.backgroundOverlay,
    backgroundImageKey: playerStore.backgroundImageKey,
    lyricsOpacity: playerStore.lyricsOpacity,
    lyricsBgColor: playerStore.lyricsBgColor,
    resumePlayback: playerStore.resumePlayback,
    lastTime: playerStore.lastTime,
    lastPlaying: playerStore.lastPlaying,
    lyricsActiveWordColor: playerStore.lyricsActiveWordColor,
    lyricsActiveLineColor: playerStore.lyricsActiveLineColor,
    lyricsInactiveColor: playerStore.lyricsInactiveColor,
    crossfade: playerStore.crossfade,
    crossfadeDuration: playerStore.crossfadeDuration,
    accentColor: playerStore.accentColor,
  }));
}

export const [playerStore, setPlayerStore] = createStore<PlayerState>({
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 65,
  muted: false,
  playMode: "sequential",
  currentSongId: null,
  currentSongTitle: "",
  currentSongArtist: "",
  error: null,
  syncState: {
    currentLine: null,
    currentLineIndex: -1,
    currentWordIndex: -1,
    wordProgress: 0,
    lines: [],
    hasLyrics: false,
  },
  queue: [],
  queueIndex: -1,
  visualizerColor: "#6366f1",
  visualizerMode: "2d",
  visualizer3dStyle: "galaxy",
  fontSize: 15,
  showTranslation: true,
  backgroundImage: "",
  backgroundOverlay: 40,
  backgroundImageKey: 0,
  lyricsOpacity: 50,
  lyricsBgColor: "#ffffff",
  resumePlayback: true,
  lastTime: 0,
  lastPlaying: false,
  lyricsActiveWordColor: "#a78bfa",
  lyricsActiveLineColor: "#d4d4d4",
  lyricsInactiveColor: "#555555",
  crossfade: false,
  crossfadeDuration: 2,
  sleepTimerEnd: null,
  accentColor: "#6366f1",
});

export function setQueue(items: QueueItem[], playIndex = 0) {
  setPlayerStore("queue", items);
  setPlayerStore("queueIndex", items.length > 0 ? playIndex : -1);
  savePlayerState();
}

export function addToQueue(item: QueueItem) {
  setPlayerStore("queue", [...playerStore.queue, item]);
  savePlayerState();
}

export function addToPlayNext(item: QueueItem) {
  const idx = playerStore.queueIndex;
  const q = [...playerStore.queue];
  q.splice(idx + 1, 0, item);
  setPlayerStore("queue", q);
  savePlayerState();
}

export function removeFromQueue(index: number) {
  const q = [...playerStore.queue];
  q.splice(index, 1);
  const qi = playerStore.queueIndex;
  setPlayerStore("queue", q);
  if (index < qi) {
    setPlayerStore("queueIndex", qi - 1);
  } else if (index === qi) {
    setPlayerStore("queueIndex", -1);
    setPlayerStore("playing", false);
    setPlayerStore("currentSongId", null);
    setPlayerStore("currentSongTitle", "");
    setPlayerStore("currentSongArtist", "");
    setPlayerStore("error", null);
  }
  savePlayerState();
}

export { formatTime };
