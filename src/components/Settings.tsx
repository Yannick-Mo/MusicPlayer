import { createSignal, onMount, onCleanup, type Component } from "solid-js";
import { playerStore, setPlayerStore } from "../store/playerStore";
import { getPlatform } from "../platform/index";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { MigrationProgress } from "../platform/interface";

type Tab = "playback" | "lyrics" | "visualizer" | "storage" | "about";

const labels: Record<Tab, string> = {
  playback: "播放",
  lyrics: "歌词",
  visualizer: "可视化",
  storage: "存储",
  about: "关于",
};

const Settings: Component = () => {
  const [tab, setTab] = createSignal<Tab>("playback");

  const tabs: Tab[] = ["playback", "lyrics", "visualizer", "storage", "about"];

  const ColorPicker: Component<{ value: string; onChange: (c: string) => void; presets: string[] }> = (p) => (
    <div class="flex items-center gap-2.5">
      {p.presets.map((c) => (
        <div
          onClick={() => p.onChange(c)}
          class="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110"
          classList={{ "ring-2 ring-white/40": p.value === c }}
          style={{ background: c }}
        />
      ))}
      <input
        type="color"
        value={p.value}
        onInput={(e) => p.onChange(e.currentTarget.value)}
        class="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
        style="background: none;"
      />
    </div>
  );

  const TrackSwitch: Component<{ value: boolean; onChange: (v: boolean) => void }> = (p) => (
    <div
      onClick={() => p.onChange(!p.value)}
      class="w-9 h-5 rounded-full relative cursor-pointer transition-colors"
      style={{ background: p.value ? "rgba(var(--accent-rgb), 0.5)" : "rgba(255,255,255,0.1)" }}
    >
      <div
        class="w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all"
        style={{ left: p.value ? "18px" : "3px" }}
      />
    </div>
  );

  const [libraryPath, setLibraryPath] = createSignal("");
  const [migrationProgress, setMigrationProgress] = createSignal<MigrationProgress | null>(null);

  // Load initial path
  getPlatform().then(platform => {
    platform.getLibraryPath().then(setLibraryPath).catch(() => {});
  });

  // Listen for migration progress events
  onMount(() => {
    const unlistenPromise = listen<MigrationProgress>("migration-progress", (event) => {
      const p = event.payload;
      setMigrationProgress(p);
      if (p.phase === "completed" || p.phase === "error" || p.phase === "cancelled") {
        // Refresh library path after migration
        setTimeout(() => {
          getPlatform().then(platform => {
            platform.getLibraryPath().then(setLibraryPath).catch(() => {});
          });
        }, 500);
      }
    });

    onCleanup(() => {
      unlistenPromise.then(fn => fn());
    });
  });

  return (
    <div class="h-full flex flex-col overflow-hidden">
      <div class="px-6 py-5 border-b" style="border-color: rgba(255,255,255,0.06);">
        <h2 class="text-xl font-semibold" style="color: rgba(255,255,255,0.9);">设置</h2>
      </div>

      <div class="flex px-6 py-3 gap-1" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <div class="flex gap-0.5 p-1 rounded-lg" style="background: rgba(255,255,255,0.03);">
          {tabs.map((t) => (
            <button
              onClick={() => setTab(t)}
              class="px-4 py-2 text-sm rounded-md transition-colors"
              style={{
                background: tab() === t ? "rgba(var(--accent-rgb), 0.15)" : "transparent",
                color: tab() === t ? "var(--accent-light)" : "rgba(255,255,255,0.7)",
              }}
            >
              {labels[t]}
            </button>
          ))}
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        {tab() === "playback" && (
          <div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">启动恢复播放</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">启动时自动续播上次进度</div></div>
              <TrackSwitch value={playerStore.resumePlayback} onChange={(v) => setPlayerStore("resumePlayback", v)} />
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">背景图</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">选择图片作为播放器背景</div></div>
              <div class="flex items-center gap-2">
                {playerStore.backgroundImage && (
                  <>
                    <div class="w-8 h-8 rounded overflow-hidden border" style="border-color: rgba(255,255,255,0.1);">
                      <img src={`${convertFileSrc(playerStore.backgroundImage)}?k=${playerStore.backgroundImageKey}`} class="w-full h-full object-cover" alt="" />
                    </div>
                    <button
                      onClick={async () => {
                        const platform = await getPlatform();
                        await platform.clearBackgroundImage();
                        setPlayerStore("backgroundImage", "");
                        setPlayerStore("backgroundImageKey", playerStore.backgroundImageKey + 1);
                      }}
                      class="px-2.5 py-1 text-xs rounded transition-colors"
                      style="color: #f87171; border: 1px solid rgba(239,68,68,0.3);"
                    >清除</button>
                  </>
                )}
                <button
                  onClick={async () => {
                    try {
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const selected = await open({
                        multiple: false,
                        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "bmp", "webp", "gif"] }],
                      });
                      if (selected) {
                        const platform = await getPlatform();
                        const dest = await platform.setBackgroundImage(selected);
                        setPlayerStore("backgroundImage", dest);
                        setPlayerStore("backgroundImageKey", playerStore.backgroundImageKey + 1);
                      }
                    } catch (e) {
                      console.error("Failed to set background:", e);
                    }
                  }}
                  class="px-2.5 py-1 text-xs rounded transition-colors"
                  style="color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1);"
                >选择图片</button>
              </div>
            </div>
            {playerStore.backgroundImage && (
              <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
                <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">遮罩强度</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">暗化背景图使内容更清晰</div></div>
                <div class="flex items-center gap-3 w-40">
                  <span class="text-sm" style="color: rgba(255,255,255,0.65);">0%</span>
                  <input type="range" min="0" max="100" value={playerStore.backgroundOverlay} onInput={(e) => setPlayerStore("backgroundOverlay", Number(e.currentTarget.value))} class="w-full" />
                  <span class="text-sm" style="color: rgba(255,255,255,0.65);">100%</span>
                </div>
              </div>
            )}
            <div class="flex items-center justify-between mt-3">
              <span class="text-xs" style="color: rgba(255,255,255,0.7);">淡入淡出</span>
              <button
                onClick={() => setPlayerStore("crossfade", !playerStore.crossfade)}
                class="w-10 h-5 rounded-full relative transition-colors"
                style={{
                  background: playerStore.crossfade ? "var(--accent-gradient)" : "rgba(255,255,255,0.15)",
                }}
              >
                <div
                  class="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: "white",
                    transform: playerStore.crossfade ? "translateX(20px)" : "translateX(2px)",
                  }}
                />
              </button>
            </div>
            {playerStore.crossfade && (
              <div class="mt-2">
                <div class="flex justify-between text-xs mb-1" style="color: rgba(255,255,255,0.5);">
                  <span>过渡时长</span>
                  <span class="font-mono">{playerStore.crossfadeDuration.toFixed(1)}秒</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={playerStore.crossfadeDuration}
                  onInput={(e) => setPlayerStore("crossfadeDuration", parseFloat(e.currentTarget.value))}
                  class="w-full"
                />
              </div>
            )}
            <div class="mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.06);">
              <div class="text-xs mb-2" style="color: rgba(255,255,255,0.7);">主题色</div>
              <div class="flex items-center gap-2 flex-wrap">
                {["#6366f1", "#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#ec4899", "#a855f7", "#14b8a6"].map((color) => (
                  <button
                    onClick={() => setPlayerStore("accentColor", color)}
                    class="w-7 h-7 rounded-full transition-transform"
                    style={{
                      background: color,
                      transform: playerStore.accentColor === color ? "scale(1.2)" : "scale(1)",
                      border: playerStore.accentColor === color ? "2px solid white" : "2px solid transparent",
                    }}
                  />
                ))}
                <div class="relative">
                  <div class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);">
                    <input
                      type="color"
                      value={playerStore.accentColor}
                      onInput={(e) => setPlayerStore("accentColor", e.currentTarget.value)}
                      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span class="text-xs" style="color: rgba(255,255,255,0.6);">🎨</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab() === "lyrics" && (
          <div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">歌词字体大小</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">当前: {playerStore.fontSize}px</div></div>
              <div class="flex items-center gap-3 w-40">
                <span class="text-sm" style="color: rgba(255,255,255,0.65);">A</span>
                <input type="range" min="12" max="24" value={playerStore.fontSize} onInput={(e) => setPlayerStore("fontSize", Number(e.currentTarget.value))} class="w-full" />
                <span class="text-base" style="color: rgba(255,255,255,0.75);">A</span>
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">面板背景色</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">选择颜色 + 调节透明度</div></div>
              <div class="flex items-center gap-2.5">
                {["#ffffff", "#000000", "#6366f1", "#8b5cf6", "#1e1b4b", "#0a0a0f", "#18181b", "#27272a"].map((c) => (
                  <div
                    onClick={() => setPlayerStore("lyricsBgColor", c)}
                    class="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110"
                    classList={{ "ring-2 ring-white/40": playerStore.lyricsBgColor === c }}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={playerStore.lyricsBgColor}
                  onInput={(e) => setPlayerStore("lyricsBgColor", e.currentTarget.value)}
                  class="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
                  style="background: none;"
                />
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">面板透明度</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">当前: {Math.round(playerStore.lyricsOpacity)}%</div></div>
              <div class="flex items-center gap-3 w-40">
                <span class="text-sm" style="color: rgba(255,255,255,0.65);">透</span>
                <input type="range" min="0" max="100" value={playerStore.lyricsOpacity} onInput={(e) => setPlayerStore("lyricsOpacity", Number(e.currentTarget.value))} class="w-full" />
                <span class="text-sm" style="color: rgba(255,255,255,0.65);">实</span>
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">双语对照</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">同时显示原文与译文</div></div>
              <TrackSwitch value={playerStore.showTranslation} onChange={(v) => setPlayerStore("showTranslation", v)} />
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">高亮词颜色</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">卡拉 OK 逐词高亮</div></div>
              <ColorPicker value={playerStore.lyricsActiveWordColor} onChange={(c) => setPlayerStore("lyricsActiveWordColor", c)} presets={["#a78bfa", "#818cf8", "#6366f1", "#c084fc", "#e879f9", "#f472b6", "#fb923c", "#ffffff"]} />
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">非当前行颜色</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">未播放和已播放的行</div></div>
              <ColorPicker value={playerStore.lyricsInactiveColor} onChange={(c) => setPlayerStore("lyricsInactiveColor", c)} presets={["#555555", "#444444", "#666666", "#3f3f46", "#52525b", "#71717a", "#78716c", "#57534e"]} />
            </div>
          </div>
        )}

        {tab() === "visualizer" && (
          <div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">可视化风格</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">选择背景动画效果</div></div>
              <div class="flex gap-1 p-[3px] rounded-md" style="background: rgba(255,255,255,0.04);">
                {(["2d", "3d", "off"] as const).map((m) => (
                  <span
                    onClick={() => setPlayerStore("visualizerMode", m)}
                    class="px-3 py-1.5 text-xs rounded cursor-pointer transition-colors"
                    style={{
                      background: playerStore.visualizerMode === m ? "rgba(99,102,241,0.15)" : "transparent",
                      color: playerStore.visualizerMode === m ? "#818cf8" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {m === "2d" ? "2D 频谱" : m === "3d" ? "3D 粒子" : "关闭"}
                  </span>
                ))}
              </div>
            </div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div><div class="text-sm" style="color: rgba(255,255,255,0.9);">频谱颜色</div><div class="text-xs" style="color: rgba(255,255,255,0.65);">2D 频谱条的颜色</div></div>
              <div class="flex items-center gap-2.5">
                {["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#22c55e", "#06b6d4", "#ffffff"].map((c) => (
                  <div
                    onClick={() => setPlayerStore("visualizerColor", c)}
                    class="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110"
                    classList={{ "ring-2 ring-white/40": playerStore.visualizerColor === c }}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={playerStore.visualizerColor}
                  onInput={(e) => setPlayerStore("visualizerColor", e.currentTarget.value)}
                  class="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
                  style="background: none;"
                />
              </div>
            </div>
          </div>
        )}



        {tab() === "storage" && (
          <div>
            <div class="flex items-center justify-between py-3 border-b" style="border-color: rgba(255,255,255,0.04);">
              <div>
                <div class="text-sm" style="color: rgba(255,255,255,0.9);">音乐库路径</div>
                <div class="text-xs break-all mt-1 font-mono" style="color: rgba(255,255,255,0.6);">{libraryPath()}</div>
              </div>
            </div>

            {!migrationProgress() && (
              <div class="mt-4">
                <button
                  onClick={async () => {
                    try {
                      const { open } = await import("@tauri-apps/plugin-dialog");
                      const selected = await open({
                        multiple: false,
                        directory: true,
                      });
                      if (selected && typeof selected === "string") {
                        const platform = await getPlatform();
                        await platform.startMigration(selected);
                      }
                    } catch (e) {
                      console.error("Migration error:", e);
                    }
                  }}
                  class="px-4 py-2 text-sm rounded transition-colors"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    background: "rgba(var(--accent-rgb), 0.2)",
                    border: "1px solid rgba(var(--accent-rgb), 0.3)",
                  }}
                >
                  更换存储路径
                </button>
              </div>
            )}

            {migrationProgress() && (
              <div class="mt-4 p-4 rounded-lg" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                {migrationProgress()!.phase === "counting" && (
                  <div class="text-sm" style="color: rgba(255,255,255,0.7);">正在统计文件数量...</div>
                )}
                {migrationProgress()!.phase === "copying" && (
                  <div>
                    <div class="flex justify-between text-sm mb-2">
                      <span style="color: rgba(255,255,255,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">正在复制: {migrationProgress()!.current_file}</span>
                      <span style="color: rgba(255,255,255,0.5);">{migrationProgress()!.current} / {migrationProgress()!.total}</span>
                    </div>
                    <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.08);">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${migrationProgress()!.total > 0 ? (migrationProgress()!.current / migrationProgress()!.total * 100) : 0}%`,
                          background: "var(--accent-gradient)",
                        }}
                      />
                    </div>
                  </div>
                )}
                {migrationProgress()!.phase === "completed" && (
                  <div>
                    <div class="text-sm" style="color: #22c55e;">迁移完成！</div>
                    <div class="text-xs mt-1" style="color: rgba(255,255,255,0.5);">已迁移 {migrationProgress()!.current} 个文件</div>
                  </div>
                )}
                {migrationProgress()!.phase === "error" && (
                  <div>
                    <div class="text-sm" style="color: #ef4444;">迁移失败</div>
                    <div class="text-xs mt-1" style="color: #fca5a5;">{migrationProgress()!.error}</div>
                  </div>
                )}
                {migrationProgress()!.phase === "cancelled" && (
                  <div class="text-sm" style="color: #f59e0b;">迁移已取消</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab() === "about" && (
          <div class="flex flex-col items-center justify-center py-12 gap-3">
            <img src="/icon-lg.png" class="w-14 h-14 rounded-2xl" />
            <div class="text-base font-semibold" style="color: rgba(255,255,255,0.9);">MusicPlayer</div>
            <div class="text-sm" style="color: rgba(255,255,255,0.6);">v0.1.0</div>
            <div class="text-sm text-center max-w-xs mt-2" style="color: rgba(255,255,255,0.5);">
              Tauri 2.0 + Solid.js + Tailwind CSS
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
