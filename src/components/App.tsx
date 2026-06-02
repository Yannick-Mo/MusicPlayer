import { createSignal, createEffect, onMount, onCleanup, type Component } from "solid-js";
import TitleBar from "./TitleBar";
import ControlBar from "./ControlBar";
import LyricsPanel from "./LyricsPanel";
import Visualizer from "./Visualizer";
import PlaylistSidebar from "./PlaylistSidebar";
import MediaLibrary from "./MediaLibrary";
import Settings from "./Settings";
import MiniPlayer from "./MiniPlayer";
import Toast, { showToast } from "./Toast";
import { AudioEngine } from "../core/audioEngine";
import { LyricsSync } from "../core/lyricsSync";
import { VisualizerData } from "../core/visualizerData";
import { playerStore, setPlayerStore, addToQueue, addToPlayNext, setQueue, removeFromQueue, loadPlayerState, savePlayerState, type QueueItem } from "../store/playerStore";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { libraryStore, loadLibraryData } from "../store/libraryStore";
import { getPlatform } from "../platform/index";
import { listen } from "@tauri-apps/api/event";

const playerStateLoaded = loadPlayerState();

const ORIGINAL_MIN_W = 900;
const ORIGINAL_MIN_H = 600;

type View = "player" | "library" | "settings";

const App: Component = () => {
  const [currentView, setCurrentView] = createSignal<View>("player");
  const [playlistOpen, setPlaylistOpen] = createSignal(false);
  const [miniMode, setMiniMode] = createSignal(false);
  let savedSize: {w: number; h: number} | null = null;
  let savedOnce = false;
  createEffect(() => {
    const _ = [
      playerStore.backgroundImage, playerStore.backgroundOverlay,
      playerStore.lyricsOpacity, playerStore.lyricsBgColor,
      playerStore.fontSize, playerStore.showTranslation,
      playerStore.visualizerColor, playerStore.visualizerMode,
      playerStore.resumePlayback,
      playerStore.lyricsActiveWordColor, playerStore.lyricsInactiveColor,
      playerStore.crossfade, playerStore.crossfadeDuration,
      playerStore.accentColor,
    ];
    if (!savedOnce) { savedOnce = true; return; }
    savePlayerState();
  });
  createEffect(() => {
    const c = playerStore.accentColor;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * 0.35);
    const lg = Math.round(g + (255 - g) * 0.35);
    const lb = Math.round(b + (255 - b) * 0.35);
    const light = `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
    const dr = Math.round(r * 0.6);
    const dg = Math.round(g * 0.6);
    const db = Math.round(b * 0.6);
    const dark = `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;

    let styleEl = document.getElementById("accent-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "accent-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --accent: ${c};
        --accent-rgb: ${r}, ${g}, ${b};
        --accent-light: ${light};
        --accent-dark: ${dark};
        --accent-gradient: linear-gradient(135deg, ${c}, ${light});
        accent-color: ${c};
      }
    `;
  });
  const engine = new AudioEngine();
  const lsync = new LyricsSync();
  const vdata = new VisualizerData();

  async function loadSong(songId: number, title: string, artist: string): Promise<boolean> {
    try {
      const platform = await getPlatform();
      const path = await platform.getSongPath(songId);
      const url = platform.getAudioUrl(path);
      setPlayerStore("currentSongId", songId);
      setPlayerStore("currentSongTitle", title);
      setPlayerStore("currentSongArtist", artist);
      setPlayerStore("error", null);
      await engine.load(url);

      try {
        const cached = libraryStore.lyricsCache[songId];
        if (cached) {
          await lsync.load(cached);
        } else {
          const lrc = await platform.getLyrics(songId);
          await lsync.load(lrc);
        }
      } catch {
        lsync.clear();
      }
      return true;
    } catch (err) {
      console.error("Failed to load song:", err);
      engine.reset();
      setPlayerStore("error", "歌曲已损坏");
      setPlayerStore("currentSongId", songId);
      setPlayerStore("currentSongTitle", title);
      setPlayerStore("currentSongArtist", artist);
      setPlayerStore("playing", false);
      engine.pause();
      return false;
    }
  }

  function ensureSongInQueue(songId: number, title: string, artist: string): number {
    const q = playerStore.queue;
    const existIdx = q.findIndex((s) => s.id === songId);
    if (existIdx >= 0) return existIdx;
    const song = libraryStore.songs.find((s) => s.id === songId);
    const item: QueueItem = { id: songId, title, artist, duration: song?.duration };
    const cur = playerStore.queueIndex;
    if (cur >= 0 && cur < q.length) {
      addToPlayNext(item);
      showToast(`已添加到下一首播放`);
      return cur + 1;
    }
    const newIdx = q.length;
    addToQueue(item);
    showToast(`已添加到播放队列`);
    return newIdx;
  }

  async function playSong(songId: number, title: string, artist: string) {
    const idx = ensureSongInQueue(songId, title, artist);
    setPlayerStore("queueIndex", idx);
    const ok = await loadSong(songId, title, artist);
    savePlayerState();
    if (ok) { await engine.play(); getPlatform().then(p => p.recordPlay(songId)).catch(() => {}); showToast(`正在播放 ${title}`); getPlatform().then(p => p.showNotification(title, artist)).catch(() => {}); }
  }

  async function playNext() {
    const q = playerStore.queue;
    if (q.length === 0) return;
    let nextIdx: number;
    const cur = playerStore.queueIndex;
    switch (playerStore.playMode) {
      case "repeat":
        nextIdx = cur >= 0 && cur < q.length ? cur : 0;
        break;
      case "shuffle":
        nextIdx = Math.floor(Math.random() * q.length);
        break;
      default:
        nextIdx = cur >= 0 && cur < q.length - 1 ? cur + 1 : 0;
    }
    const next = q[nextIdx];
    if (next) {
      if (playerStore.crossfade && playerStore.playing) {
        await engine.fadeOut(playerStore.crossfadeDuration);
      }
      setPlayerStore("queueIndex", nextIdx);
      const ok = await loadSong(next.id, next.title, next.artist);
      savePlayerState();
      if (ok) {
        if (playerStore.crossfade) {
          await engine.fadeIn(playerStore.crossfadeDuration);
        }
        await engine.play();
      }
    }
  }

  async function playPrev() {
    const q = playerStore.queue;
    if (q.length === 0) return;
    const cur = playerStore.queueIndex;
    const prevIdx = cur > 0 ? cur - 1 : q.length - 1;
    const prev = q[prevIdx];
    if (prev) {
      if (playerStore.crossfade && playerStore.playing) {
        await engine.fadeOut(playerStore.crossfadeDuration);
      }
      setPlayerStore("queueIndex", prevIdx);
      const ok = await loadSong(prev.id, prev.title, prev.artist);
      savePlayerState();
      if (ok) {
        if (playerStore.crossfade) {
          await engine.fadeIn(playerStore.crossfadeDuration);
        }
        await engine.play();
      }
    }
  }

  async function replaceQueueAndPlay(items: QueueItem[], playIndex = 0) {
    setQueue(items, playIndex);
    if (items.length > 0) {
      const first = items[playIndex];
      const ok = await loadSong(first.id, first.title, first.artist);
      if (ok) await engine.play();
    }
  }

  (window as any).__requestPlay = async () => {
    if (playerStore.queue.length === 0) {
      setPlayerStore("error", "播放队列为空");
      return;
    }
    if (playerStore.playing) {
      engine.pause();
      return;
    }
    setPlayerStore("error", null);
    const id = playerStore.currentSongId;
    if (id !== null) {
      if (engine.duration > 0) {
        await engine.play();
      } else {
        const ok = await loadSong(id, playerStore.currentSongTitle, playerStore.currentSongArtist);
        if (ok) await engine.play();
      }
    } else {
      const idx = playerStore.queueIndex >= 0 ? playerStore.queueIndex : 0;
      const item = playerStore.queue[idx];
      if (item) {
        const ok = await loadSong(item.id, item.title, item.artist);
        if (ok) await engine.play();
      }
    }
  };

  (window as any).__playSong = playSong;
  (window as any).__playAt = async (index: number) => {
    const song = playerStore.queue[index];
    if (!song) return;
    setPlayerStore("queueIndex", index);
    const ok = await loadSong(song.id, song.title, song.artist);
    savePlayerState();
    if (ok) await engine.play();
  };
  (window as any).__playNext = playNext;
  (window as any).__playPrev = playPrev;
  (window as any).__replaceQueueAndPlay = replaceQueueAndPlay;
  (window as any).__clearQueue = () => {
    setPlayerStore("queue", []);
    setPlayerStore("queueIndex", -1);
    setPlayerStore("currentSongId", null);
    setPlayerStore("currentSongTitle", "");
    setPlayerStore("currentSongArtist", "");
    setPlayerStore("error", "播放队列为空");
    engine.pause();
    savePlayerState();
    showToast("播放队列已清空");
  };

  const appWindow = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null;

  (window as any).__toggleMiniMode = async () => {
    const next = !miniMode();
    setPlaylistOpen(false);

    if (appWindow) {
      try {
        if (next) {
          const os = await appWindow.outerSize();
          const factor = await appWindow.scaleFactor();
          savedSize = { w: Math.round(os.width / factor), h: Math.round(os.height / factor) };
          invoke("set_window_corner", { value: 0 });
          await appWindow.setAlwaysOnTop(true);
          await appWindow.setMinSize(new LogicalSize(300, 70));
          await appWindow.setMaxSize(new LogicalSize(400, 80));
          await appWindow.setSize(new LogicalSize(350, 70));
        } else {
          invoke("set_window_corner", { value: 3 });
          await appWindow.setAlwaysOnTop(false);
          const w = savedSize?.w ?? ORIGINAL_MIN_W;
          const h = savedSize?.h ?? ORIGINAL_MIN_H + 120;
          await appWindow.setSize(new LogicalSize(w, h));
          await appWindow.setMaxSize(null);
          await appWindow.setMinSize(new LogicalSize(ORIGINAL_MIN_W, ORIGINAL_MIN_H));
          savedSize = null;
        }
      } catch (e) {
        console.error("mini mode resize failed:", e);
      }
    }

    setMiniMode(next);
  };

  (window as any).__removeFromQueue = (index: number) => {
    const qi = playerStore.queueIndex;
    removeFromQueue(index);
    if (index === qi) {
      engine.reset();
    }
  };

  (window as any).__handleSongDeleted = (songId: number) => {
    const q = playerStore.queue;
    const curIdx = playerStore.queueIndex;
    const removedBefore = q.filter((s, i) => s.id === songId && i < curIdx).length;
    const isCurrentDeleted = q[curIdx]?.id === songId;
    const newQueue = q.filter(s => s.id !== songId);
    setPlayerStore("queue", newQueue);

    if (isCurrentDeleted) {
      engine.reset();
      setPlayerStore("playing", false);
      setPlayerStore("currentSongId", null);
      setPlayerStore("currentSongTitle", "");
      setPlayerStore("currentSongArtist", "");
      setPlayerStore("error", null);
      if (newQueue.length > 0) {
        const newIdx = Math.min(removedBefore, newQueue.length - 1);
        setPlayerStore("queueIndex", newIdx);
        savePlayerState();
        const item = newQueue[newIdx];
        if (item) {
          loadSong(item.id, item.title, item.artist).then(async ok => {
            if (ok) await engine.play();
          });
        }
      } else {
        setPlayerStore("queueIndex", -1);
        setPlayerStore("error", "播放队列为空");
        savePlayerState();
      }
    } else {
      const newIndex = Math.max(0, curIdx - removedBefore);
      if (newQueue.length > 0) {
        setPlayerStore("queueIndex", newIndex);
      } else {
        setPlayerStore("queueIndex", -1);
        setPlayerStore("error", "播放队列为空");
      }
      savePlayerState();
    }
  };

  onMount(() => {
    engine.on("onTimeUpdate", (time) => {
      setPlayerStore("currentTime", time);
      setPlayerStore("lastTime", time);
      const state = lsync.update(time);
      setPlayerStore("syncState", state);
    });
    engine.on("onDurationChange", (dur) => setPlayerStore("duration", dur));
    engine.on("onPlayStateChange", (playing) => {
      setPlayerStore("playing", playing);
      setPlayerStore("lastPlaying", playing);
      savePlayerState();
    });
    engine.on("onEnded", () => playNext());
    engine.setVolume(playerStore.volume);

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && miniMode()) {
        (window as any).__toggleMiniMode();
        return;
      }
      if (currentView() !== "player") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          {
            const fn = (window as any).__requestPlay;
            if (fn) fn();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          engine.seek(Math.max(0, engine.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          engine.seek(Math.min(engine.duration, engine.currentTime + 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          setPlayerStore("volume", Math.min(100, playerStore.volume + 10));
          engine.setVolume(playerStore.volume);
          break;
        case "ArrowDown":
          e.preventDefault();
          setPlayerStore("volume", Math.max(0, playerStore.volume - 10));
          engine.setVolume(playerStore.volume);
          break;
        case "l":
          if (e.ctrlKey) { e.preventDefault(); setCurrentView("library"); }
          break;
        case ",":
          if (e.ctrlKey) { e.preventDefault(); setCurrentView("settings"); }
          break;
      }
    };

    window.addEventListener("keydown", handler);

    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventF12 = (e: KeyboardEvent) => { if (e.key === "F12") e.preventDefault(); };
    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("keydown", preventF12);

    const unlistenPlayPause = listen("tray-play-pause", () => { const fn = (window as any).__requestPlay; if (fn) fn(); });
    const unlistenNext = listen("tray-next", () => playNext());
    const unlistenPrev = listen("tray-prev", () => playPrev());
    const unlistenToggleVis = listen("tray-toggle-visualizer", () => {
      setPlayerStore("visualizerMode", playerStore.visualizerMode === "2d" ? "3d" : playerStore.visualizerMode === "3d" ? "off" : "2d");
    });
    const unlistenTogglePlaymode = listen("tray-toggle-playmode", () => {
      const next = { sequential: "repeat" as const, repeat: "shuffle" as const, shuffle: "sequential" as const };
      setPlayerStore("playMode", next[playerStore.playMode]);
    });
    const unlistenToggleLyrics = listen("tray-toggle-lyrics", () => {
      setPlayerStore("showTranslation", !playerStore.showTranslation);
    });

    const sleepTimerCheck = setInterval(() => {
      const end = playerStore.sleepTimerEnd;
      if (end !== null && Date.now() >= end) {
        engine.pause();
        setPlayerStore("sleepTimerEnd", null);
        showToast("睡眠定时器已到，播放已暂停");
      }
    }, 1000);

    if (playerStore.queue.length === 0) {
      setPlayerStore("error", "播放队列为空");
    }
    if (playerStore.volume !== undefined) {
      engine.setVolume(playerStore.volume);
    }

    loadLibraryData().then(() => {
      if (playerStore.resumePlayback && playerStore.lastPlaying && playerStore.currentSongId !== null) {
        const song = libraryStore.songs.find((s) => s.id === playerStore.currentSongId);
        if (song) {
          loadSong(song.id, song.title, song.artist).then(async ok => {
            if (ok && playerStore.lastTime > 0) {
              engine.seek(Math.min(playerStore.lastTime, engine.duration));
            }
            if (ok && playerStore.lastPlaying) {
              await engine.play();
            }
          });
        }
      }
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("keydown", preventF12);
      engine.destroy();
      unlistenPlayPause.then((fn) => fn());
      unlistenNext.then((fn) => fn());
      unlistenPrev.then((fn) => fn());
      unlistenToggleVis.then((fn) => fn());
      unlistenTogglePlaymode.then((fn) => fn());
      unlistenToggleLyrics.then((fn) => fn());
      clearInterval(sleepTimerCheck);
    });
  });

  return (
    <>
      {miniMode() ? (
        <MiniPlayer
          audioEngine={engine}
          onExpand={() => { (window as any).__toggleMiniMode(); }}
        />
      ) : (
        <div class="h-screen w-screen flex flex-col bg-bg relative overflow-hidden">
          {playerStore.backgroundImage && (
            <img
              src={`${convertFileSrc(playerStore.backgroundImage)}?k=${playerStore.backgroundImageKey}`}
              class="absolute inset-0 w-full h-full object-cover pointer-events-none"
              alt=""
            />
          )}
          {playerStore.backgroundImage && playerStore.backgroundOverlay > 0 && (
            <div
              class="absolute inset-0 w-full h-full pointer-events-none"
              style={{ background: `rgba(0,0,0,${playerStore.backgroundOverlay / 100})` }}
            />
          )}
          <Visualizer
            active={currentView() === "player"}
            visualizerData={vdata}
            audioEngine={engine}
            mode={playerStore.visualizerMode}
            color={playerStore.visualizerColor}
          />
          <TitleBar view={currentView()} onViewChange={setCurrentView} />
          <div class="flex-1 flex relative overflow-hidden" style="z-index: 1;">
            <PlaylistSidebar
              open={playlistOpen()}
              onClose={() => setPlaylistOpen(false)}
            />
            <div class="flex-1 relative">
              {currentView() === "player" && (
                <LyricsPanel
                  syncState={playerStore.syncState}
                  title={playerStore.currentSongTitle}
                  artist={playerStore.currentSongArtist}
                  songId={playerStore.currentSongId ?? undefined}
                  transparent={playerStore.visualizerMode === "3d"}
                  fontSize={playerStore.fontSize}
                  showTranslation={playerStore.showTranslation}
                  activeWordColor={playerStore.lyricsActiveWordColor}
                  activeLineColor={playerStore.lyricsActiveLineColor}
                  inactiveColor={playerStore.lyricsInactiveColor}
                  opacity={playerStore.lyricsOpacity}
                  bgColor={playerStore.lyricsBgColor}
                />
              )}
              {currentView() === "library" && (
                <MediaLibrary onPlay={(id, title, artist) => {
                  setCurrentView("player");
                  playSong(id, title, artist);
                }} />
              )}
              {currentView() === "settings" && <Settings />}
            </div>
          </div>
          <ControlBar
            onTogglePlaylist={() => setPlaylistOpen((p) => !p)}
            audioEngine={engine}
            visualizerMode={playerStore.visualizerMode}
            onToggleVisualizerMode={() => setPlayerStore("visualizerMode", playerStore.visualizerMode === "2d" ? "3d" : playerStore.visualizerMode === "3d" ? "off" : "2d")}
          />
          <Toast />
        </div>
      )}
    </>
  );
};

export default App;
