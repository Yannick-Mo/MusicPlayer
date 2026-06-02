import { type Component } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";

type View = "player" | "library" | "settings";

interface TitleBarProps {
  view: View;
  onViewChange: (view: View) => void;
}

const TitleBar: Component<TitleBarProps> = (props) => {
  const tabs: { id: View; label: string }[] = [
    { id: "player", label: "播放" },
    { id: "library", label: "媒体库" },
    { id: "settings", label: "设置" },
  ];

  const appWindow = getCurrentWindow();

  return (
    <div
      class="h-12 flex items-center justify-between px-4 relative"
      style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); z-index: 1; -webkit-app-region: drag;"
      data-tauri-drag-region
    >
      <div class="flex items-center gap-3">
        <img src="/icon.png" class="w-6 h-6 rounded" />
        <span class="text-base font-semibold" style="color: rgba(255,255,255,0.85); letter-spacing: 0.3px;">
          MusicPlayer
        </span>
        <span class="text-sm" style="color: rgba(255,255,255,0.6);">|</span>
        <span class="text-sm" style="color: rgba(255,255,255,0.55);">
          {props.view === "player" ? "正在播放" : props.view === "library" ? "媒体库" : "设置"}
        </span>
      </div>

      <div class="flex gap-0.5" style="-webkit-app-region: no-drag;">
        {tabs.map((tab) => (
          <button
            onClick={() => props.onViewChange(tab.id)}
            class="px-3 py-1.5 text-sm transition-colors rounded"
            style={`color: ${props.view === tab.id ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)"}; border-bottom: ${props.view === tab.id ? "2px solid var(--accent-light)" : "2px solid transparent"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div class="flex gap-2" style="-webkit-app-region: no-drag;">
        <button
          onClick={() => appWindow.minimize()}
          class="px-2 py-1 text-sm transition-colors rounded hover:bg-white/10"
          style="color: rgba(255,255,255,0.6);"
        >
          ━
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          class="px-2 py-1 text-sm transition-colors rounded hover:bg-white/10"
          style="color: rgba(255,255,255,0.6);"
        >
          □
        </button>
        <button
          onClick={() => appWindow.close()}
          class="px-2 py-1 text-sm transition-colors rounded hover:bg-red-500/20"
          style="color: rgba(255,255,255,0.65);"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
