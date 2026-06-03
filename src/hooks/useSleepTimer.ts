import { onCleanup } from "solid-js";
import { AudioEngine } from "../core/audioEngine";
import { playerStore, setPlayerStore } from "../store/playerStore";
import { showToast } from "../components/Toast";

export function useSleepTimer(engine: AudioEngine) {
  const sleepTimerCheck = setInterval(() => {
    const end = playerStore.sleepTimerEnd;
    if (end !== null && Date.now() >= end) {
      engine.pause();
      setPlayerStore("sleepTimerEnd", null);
      showToast("睡眠定时器已到，播放已暂停");
    }
  }, 1000);

  onCleanup(() => {
    clearInterval(sleepTimerCheck);
  });
}
