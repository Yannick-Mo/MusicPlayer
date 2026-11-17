import { createSignal, For, type Component } from "solid-js";
import { playerStore, setPlayerStore } from "../store/playerStore";
import { VISUALIZER_3D_STYLES, getVisualizer3DStyle } from "../core/visualizerStyles";

const VisualizerStyleSwitcher: Component = () => {
  const [open, setOpen] = createSignal(false);
  const current = () => getVisualizer3DStyle(playerStore.visualizer3dStyle);

  return (
    <>
      {open() && (
        <div class="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
      <div class="absolute right-4 bottom-4 z-20 flex flex-col items-end gap-2">
        {open() && (
          <div
            class="w-64 p-2 rounded-xl shadow-2xl"
            style={{
              background: "rgba(10,12,22,0.78)",
              border: "1px solid rgba(255,255,255,0.08)",
              "backdrop-filter": "blur(16px)",
            }}
          >
            <div class="text-[10px] px-2 py-1.5 tracking-widest" style="color: rgba(255,255,255,0.4);">
              3D 场景 · {VISUALIZER_3D_STYLES.length}
            </div>
            <div class="max-h-[52vh] overflow-y-auto pr-1">
            <For each={VISUALIZER_3D_STYLES}>
              {(style) => {
                const selected = () => playerStore.visualizer3dStyle === style.id;
                return (
                  <button
                    onClick={() => {
                      setPlayerStore("visualizer3dStyle", style.id);
                      setOpen(false);
                    }}
                    class="w-full text-left px-2 py-2 rounded-lg flex items-center gap-2.5 transition-colors"
                    style={{ background: selected() ? "rgba(var(--accent-rgb), 0.14)" : "transparent" }}
                  >
                    <span
                      class="w-6 h-1.5 rounded-full shrink-0"
                      style={{ background: `linear-gradient(90deg, ${style.swatch.join(", ")})` }}
                    />
                    <span class="flex-1 min-w-0">
                      <span
                        class="block text-xs"
                        style={{ color: selected() ? "var(--accent-light)" : "rgba(255,255,255,0.85)" }}
                      >
                        {style.name}
                      </span>
                      <span class="block text-[10px] mt-0.5 truncate" style="color: rgba(255,255,255,0.4);">
                        {style.description}
                      </span>
                    </span>
                  </button>
                );
              }}
            </For>
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen((value) => !value)}
          class="px-3 py-1.5 rounded-full text-xs flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{
            background: "rgba(10,12,22,0.62)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.82)",
            "backdrop-filter": "blur(12px)",
          }}
        >
          <span
            class="w-2 h-2 rounded-full"
            style={{ background: `linear-gradient(135deg, ${current().swatch[1]}, ${current().swatch[2]})` }}
          />
          {current().name}
          <span class="text-[9px]" style="color: rgba(255,255,255,0.4);">{open() ? "▼" : "▲"}</span>
        </button>
      </div>
    </>
  );
};

export default VisualizerStyleSwitcher;
