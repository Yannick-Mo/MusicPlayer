import { onMount, onCleanup } from "solid-js";
import { setPlayerStore, playerStore } from "../store/playerStore";
import { listen } from "@tauri-apps/api/event";

export function useTrayEvents(
  requestPlay: () => void,
  playNext: () => void,
  playPrev: () => void,
) {
  onMount(async () => {
    const unlistenPlayPause = await listen("tray-play-pause", () => requestPlay());
    const unlistenNext = await listen("tray-next", () => playNext());
    const unlistenPrev = await listen("tray-prev", () => playPrev());
    const unlistenToggleVis = await listen("tray-toggle-visualizer", () => {
      setPlayerStore("visualizerMode", playerStore.visualizerMode === "2d" ? "3d" : playerStore.visualizerMode === "3d" ? "off" : "2d");
    });
    const unlistenTogglePlaymode = await listen("tray-toggle-playmode", () => {
      const next = { sequential: "repeat" as const, repeat: "shuffle" as const, shuffle: "sequential" as const };
      setPlayerStore("playMode", next[playerStore.playMode]);
    });
    const unlistenToggleLyrics = await listen("tray-toggle-lyrics", () => {
      setPlayerStore("showTranslation", !playerStore.showTranslation);
    });

    onCleanup(() => {
      unlistenPlayPause();
      unlistenNext();
      unlistenPrev();
      unlistenToggleVis();
      unlistenTogglePlaymode();
      unlistenToggleLyrics();
    });
  });
}
