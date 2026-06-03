import { onMount, onCleanup, type Accessor } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { setPlayerStore, playerStore } from "../store/playerStore";

type View = "player" | "library" | "settings";

export function useKeyboardShortcuts(
  engine: AudioEngine,
  requestPlay: () => void,
  toggleMiniMode: () => void,
  currentView: Accessor<View>,
  setCurrentView: (v: View) => void,
  miniMode: Accessor<boolean>,
) {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape" && miniMode()) {
      toggleMiniMode();
      return;
    }
    if (currentView() !== "player") return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        requestPlay();
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

  onMount(() => {
    window.addEventListener("keydown", handler);

    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventF12 = (e: KeyboardEvent) => { if (e.key === "F12") e.preventDefault(); };
    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("keydown", preventF12);

    onCleanup(() => {
      window.removeEventListener("keydown", handler);
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("keydown", preventF12);
    });
  });
}
