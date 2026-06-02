import { createResource, createMemo, type Component } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { playerStore } from "../store/playerStore";

interface MiniPlayerProps {
  audioEngine: AudioEngine;
  onExpand: () => void;
}

const MiniPlayer: Component<MiniPlayerProps> = (props) => {
  const [coverUrl] = createResource(() => playerStore.currentSongId, async (id) => {
    if (id === null) return undefined;
    try {
      const { getPlatform } = await import("../platform/index");
      const platform = await getPlatform();
      const path = await platform.getCoverPath(id);
      const { convertFileSrc } = await import("@tauri-apps/api/core");
      return convertFileSrc(path);
    } catch { return undefined; }
  });

  const currentLyric = createMemo(() => {
    const st = playerStore.syncState;
    if (!st || !st.hasLyrics || !st.currentLine) return "";
    return st.currentLine.text;
  });

  return (
    <div
      class="h-full w-full flex flex-col"
      style={{ background: "rgba(10,10,15,0.95)", "-webkit-app-region": "drag" }}
      data-tauri-drag-region
    >
      <div class="flex items-center px-3 gap-3 flex-1">
        <div class="w-[45px] h-[45px] rounded-lg flex-shrink-0 overflow-hidden" style={coverUrl() ? {} : { background: "var(--accent-gradient)" }}>
          {coverUrl() ? <img src={coverUrl()!} class="w-full h-full object-cover" alt="" /> : null}
        </div>
        <div class="min-w-0 flex-1 flex flex-col justify-center leading-tight" style="gap: 3px;">
          <div class="text-xs font-medium truncate" style="color: rgba(255,255,255,0.85);">
            {playerStore.currentSongTitle || "未播放"}
            {playerStore.currentSongArtist && <span class="ml-1.5" style="color: rgba(255,255,255,0.4);">{playerStore.currentSongArtist}</span>}
          </div>
          <div class="text-[11px] truncate" style="color: rgba(255,255,255,0.45);">
            {currentLyric() || <span style="color: rgba(255,255,255,0.15);">♪</span>}
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <button
            onClick={() => { const fn = (window as any).__playPrev; if (fn) fn(); }}
            class="text-sm"
            style="color: rgba(255,255,255,0.55);"
          >⏮</button>
          <button
            onClick={() => { const fn = (window as any).__requestPlay; if (fn) fn(); }}
            class="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent-gradient)" }}
          >
            <span class="text-white text-sm">{playerStore.playing ? "⏸" : "▶"}</span>
          </button>
          <button
            onClick={() => { const fn = (window as any).__playNext; if (fn) fn(); }}
            class="text-sm"
            style="color: rgba(255,255,255,0.55);"
          >⏭</button>
        </div>
        <button
          onClick={props.onExpand}
          class="text-[10px] px-1.5 py-0.5 rounded"
          style="color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1);"
        >⤢</button>
      </div>
    </div>
  );
};

export default MiniPlayer;
