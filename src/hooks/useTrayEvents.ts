import { onMount, onCleanup } from "solid-js";
import { setPlayerStore, playerStore } from "../store/playerStore";
import { listen } from "@tauri-apps/api/event";

export function useTrayEvents(
  requestPlay: () => void,
  playNext: () => void,
  playPrev: () => void,
) {
  onMount(() => {
    const unlistenPlayPause = listen("tray-play-pause", () => requestPlay());
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

    onCleanup(() => {
      unlistenPlayPause.then((fn) => fn());
      unlistenNext.then((fn) => fn());
      unlistenPrev.then((fn) => fn());
      unlistenToggleVis.then((fn) => fn());
      unlistenTogglePlaymode.then((fn) => fn());
      unlistenToggleLyrics.then((fn) => fn());
    });
  });
}
