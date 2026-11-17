import { createResource, createSignal, createMemo, createEffect, onCleanup, type Component } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { playerStore, setPlayerStore } from "../store/playerStore";
import { executeCommand } from "../core/commandBus";
import { getVisualizer3DStyle } from "../core/visualizerStyles";
import { getPlatform } from "../platform";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ControlBarProps {
  onTogglePlaylist: () => void;
  audioEngine: AudioEngine;
  visualizerMode: "2d" | "3d" | "off";
  onToggleVisualizerMode: () => void;
}

const ControlBar: Component<ControlBarProps> = (props) => {
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const ModeIcon = () => {
    return (
      <svg viewBox="0 0 20 20" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        {playerStore.playMode === "sequential" && (
          <>
            <path d="M13 3l4 4-4 4" />
            <path d="M3 7h14" />
            <path d="M7 17l-4-4 4-4" />
            <path d="M17 13H3" />
          </>
        )}
        {playerStore.playMode === "repeat" && (
          <>
            <path d="M17 10a7 7 0 11-4-6.36" />
            <path d="M17 3v3.5H13.5" />
            <path d="M7 12.5v-4h1.5" />
            <circle cx="7" cy="13" r=".5" fill="currentColor" />
          </>
        )}
        {playerStore.playMode === "shuffle" && (
          <>
            <path d="M4 14l12-8" />
            <path d="M16 6l-4-2" />
            <path d="M16 6l-4 2" />
            <path d="M4 6l12 8" />
            <path d="M16 14l-4-2" />
            <path d="M16 14l-4 2" />
          </>
        )}
      </svg>
    );
  };

  const [coverUrl] = createResource(() => playerStore.currentSongId, async (id) => {
    if (id === null) return undefined;
    try {
      const platform = await getPlatform();
      const path = await platform.getCoverPath(id);
      return convertFileSrc(path);
    } catch { return undefined; }
  });

  const cycleMode = () => {
    const next = { sequential: "repeat" as const, repeat: "shuffle" as const, shuffle: "sequential" as const };
    setPlayerStore("playMode", next[playerStore.playMode]);
  };

  const [showTimerPopup, setShowTimerPopup] = createSignal(false);
  const [tick, setTick] = createSignal(0);
  let timerInterval: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    const end = playerStore.sleepTimerEnd;
    if (end !== null && !timerInterval) {
      timerInterval = setInterval(() => setTick(t => t + 1), 1000);
    } else if (end === null && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = undefined;
    }
  });

  onCleanup(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  const remainingMs = createMemo(() => {
    tick();
    const end = playerStore.sleepTimerEnd;
    if (end === null) return -1;
    return Math.max(0, end - Date.now());
  });

  const timerPresets = [
    { label: "15分钟", value: 15 * 60 * 1000 },
    { label: "30分钟", value: 30 * 60 * 1000 },
    { label: "45分钟", value: 45 * 60 * 1000 },
    { label: "60分钟", value: 60 * 60 * 1000 },
    { label: "90分钟", value: 90 * 60 * 1000 },
  ];

  function setSleepTimer(durationMs: number) {
    setPlayerStore("sleepTimerEnd", Date.now() + durationMs);
    setShowTimerPopup(false);
  }

  function clearSleepTimer() {
    setPlayerStore("sleepTimerEnd", null);
    setShowTimerPopup(false);
  }

  const formatTimer = (ms: number) => {
    if (ms <= 0) return "0:00";
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  let timerRef: HTMLDivElement | undefined;

  function handleTimerClick() {
    if (playerStore.sleepTimerEnd !== null) {
      clearSleepTimer();
    } else {
      setShowTimerPopup(p => !p);
    }
  }

  let progressRef: HTMLDivElement | undefined;

  function startProgressDrag(e: MouseEvent) {
    e.preventDefault();
    function move(ev: MouseEvent) {
      if (!progressRef) return;
      const rect = progressRef.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      props.audioEngine.seek(pct * playerStore.duration);
    }
    move(e);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
  }

  let volumeRef: HTMLDivElement | undefined;

  function startVolumeDrag(e: MouseEvent) {
    e.preventDefault();
    function move(ev: MouseEvent) {
      if (!volumeRef) return;
      const rect = volumeRef.getBoundingClientRect();
      const vol = Math.floor(Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100)));
      setPlayerStore("volume", vol);
      setPlayerStore("muted", false);
      props.audioEngine.setVolume(vol);
    }
    move(e);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", () => window.removeEventListener("mousemove", move), { once: true });
  }

  return (
    <div
      class="px-7 pt-0 pb-1.5 relative"
      style="background: rgba(255,255,255,0.03); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-top: 1px solid rgba(255,255,255,0.06); z-index: 1;"
    >
      <div class="flex items-center gap-3.5 mb-0.5">
        <span class="text-xs text-secondary min-w-[36px] font-mono">{formatTime(playerStore.currentTime)}</span>
        <div
          ref={progressRef}
          class="flex-1 h-1 rounded-full cursor-pointer relative"
          style="background: rgba(255,255,255,0.06);"
          onMouseDown={startProgressDrag}
        >
          <div
            class="h-full rounded-full relative"
            style={{ width: `${playerStore.duration > 0 ? (playerStore.currentTime / playerStore.duration) * 100 : 0}%`, background: "var(--accent-gradient)" }}
          >
            <div
              class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full cursor-grab"
              style={{ background: "var(--accent-light)", border: "2px solid rgba(255,255,255,0.2)", "box-shadow": "0 0 12px rgba(var(--accent-rgb), 0.5)", right: "-6px" }}
            />
          </div>
        </div>
        <span class="text-xs text-secondary min-w-[36px] text-right font-mono">{formatTime(playerStore.duration)}</span>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3.5 flex-1">
          <button onClick={cycleMode} class="text-[21px] px-2 transition-colors" style="color: rgba(255,255,255,0.6);">
            <ModeIcon />
          </button>
          {playerStore.currentSongId !== null ? (
            <>
              <div class="w-9 h-9 rounded flex-shrink-0 overflow-hidden" style={coverUrl() ? {} : { background: "var(--accent-gradient)" }}>
                {coverUrl() ? <img src={coverUrl()!} class="w-full h-full object-cover" alt="" /> : null}
              </div>
              <div class="min-w-0">
                <div class="text-xs font-medium truncate" style="color: rgba(255,255,255,0.85);">{playerStore.currentSongTitle}</div>
                <div class="text-[10px] truncate" style="color: rgba(255,255,255,0.4);">{playerStore.currentSongArtist}</div>
              </div>
            </>
          ) : null}
        </div>

        <div class="flex items-center gap-5">
          <button
            onClick={() => executeCommand("playPrev")}
            class="text-lg transition-colors"
            style="color: rgba(255,255,255,0.55);"
          >⏮</button>
          <div class="relative">
            <button
              onClick={() => executeCommand("requestPlay")}
              class="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent-gradient)", "box-shadow": "0 4px 20px rgba(var(--accent-rgb), 0.35)" }}
            >
              <span class="text-white text-lg ml-0.5">{playerStore.playing ? "⏸" : "▶"}</span>
            </button>
            {playerStore.error && (
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap pointer-events-none"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                  "backdrop-filter": "blur(8px)",
                }}
              >{playerStore.error}</div>
            )}
          </div>
          <button
            onClick={() => executeCommand("playNext")}
            class="text-lg transition-colors"
            style="color: rgba(255,255,255,0.55);"
          >⏭</button>
        </div>

        <div class="flex items-center gap-3 flex-1 justify-end">
          <button
            onClick={() => {
              const muted = !playerStore.muted;
              setPlayerStore("muted", muted);
              props.audioEngine.setMuted(muted);
            }}
            class="text-sm transition-colors"
            style="color: rgba(255,255,255,0.5);"
          >
            {playerStore.muted ? "🔇" : "🔊"}
          </button>
          <div
            ref={volumeRef}
            class="w-16 h-1 rounded-full cursor-pointer"
            style="background: rgba(255,255,255,0.06);"
            onMouseDown={startVolumeDrag}
          >
            <div
              class="h-full rounded-full"
              style={`width: ${playerStore.muted ? 0 : playerStore.volume}%; background: rgba(255,255,255,0.35);`}
            />
          </div>
          <div ref={timerRef} class="relative">
            <button
              onClick={handleTimerClick}
              class="text-sm transition-colors flex items-center gap-1"
              style={{ color: playerStore.sleepTimerEnd !== null ? "#a78bfa" : "rgba(255,255,255,0.5)" }}
            >
              <span>⏱</span>
              {remainingMs() >= 0 && <span class="text-[11px] font-mono">{formatTimer(remainingMs())}</span>}
            </button>
            <style>{`.timer-item:hover{background:rgba(var(--accent-rgb,99,102,241),0.15)}`}</style>
            {showTimerPopup() && (
              <>
                <div class="fixed inset-0 z-10" onClick={() => setShowTimerPopup(false)} />
                <div
                  class="absolute bottom-full right-0 mb-2 py-2 rounded-xl z-20 min-w-[140px]"
                  style={{
                    background: "rgba(15,15,22,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div class="text-[11px] px-3 pb-1.5" style="color: rgba(255,255,255,0.35);">睡眠定时器</div>
                  {timerPresets.map((p) => (
                    <button
                      onClick={() => setSleepTimer(p.value)}
                      class="timer-item w-full text-left px-3 py-1.5 text-xs transition-colors"
                      style="color: rgba(255,255,255,0.75);"
                    >{p.label}</button>
                  ))}
                  <div class="h-px mx-2 my-1" style="background: rgba(255,255,255,0.06);" />
                  <button
                    onClick={clearSleepTimer}
                    class="timer-item w-full text-left px-3 py-1.5 text-xs transition-colors"
                    style="color: rgba(255,255,255,0.4);"
                  >取消定时</button>
                </div>
              </>
            )}
          </div>
          <div class="w-px h-5" style="background: rgba(255,255,255,0.06);" />
          <button onClick={props.onTogglePlaylist} class="text-sm transition-colors" style="color: rgba(255,255,255,0.5);">📋</button>
          <button
            onClick={props.onToggleVisualizerMode}
            title={props.visualizerMode === "3d" ? `3D 场景：${getVisualizer3DStyle(playerStore.visualizer3dStyle).name}（点击关闭）` : "切换可视化：2D / 3D / 关闭"}
            class="text-[10px] px-2 py-0.5 rounded transition-colors"
            style="color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1);"
          >
            {props.visualizerMode === "off" ? "关" : props.visualizerMode === "2d" ? "2D" : "3D"}
          </button>
          <button
            onClick={() => executeCommand("toggleMiniMode")}
            class="text-xs px-1.5 py-0.5 rounded transition-colors"
            style="color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1);"
          >⤡</button>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
