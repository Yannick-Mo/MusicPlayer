import { type Component } from "solid-js";
import type { PlaylistCategory } from "../../store/libraryStore";

interface BatchBarProps {
  selectedCount: number;
  userPlaylists: PlaylistCategory[];
  isTauri: boolean;
  showAddOpen: boolean;
  onAddToPlaylist: (categoryId: string, songIds: number[]) => void;
  onDeleteSelected: () => void;
  onExitBatchMode: () => void;
  onToggleAddOpen: () => void;
}

const BatchBar: Component<BatchBarProps> = (p) => {
  return (
    <>
      {p.selectedCount > 0 && (
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
          style={{
            background: "rgba(var(--accent-rgb, 99, 102, 241), 0.1)",
            border: "1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.2)",
          }}
        >
          <span class="text-xs font-medium" style="color: rgba(255,255,255,0.8);">
            已选 {p.selectedCount} 首
          </span>
          <div class="flex-1" />
          <button
            onClick={() => p.onToggleAddOpen()}
            class="text-xs px-2.5 py-1 rounded transition-colors"
            style="background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75);"
          >添加到歌单</button>
          <button
            onClick={() => p.onDeleteSelected()}
            class="text-xs px-2.5 py-1 rounded transition-colors"
            style="background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3);"
          >删除选中</button>
          <button
            onClick={() => p.onExitBatchMode()}
            class="text-xs px-2.5 py-1 rounded transition-colors"
            style="background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08);"
          >退出多选</button>
        </div>
      )}

      {p.showAddOpen && (
        <>
          <div class="fixed inset-0 z-10" onClick={() => p.onToggleAddOpen()} />
          <div
            class="absolute left-20 z-20 rounded-lg py-1 min-w-[120px]"
            style={{
              background: "rgba(15,15,20,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              "backdrop-filter": "blur(16px)",
            }}
          >
            {p.userPlaylists.length > 0 ? p.userPlaylists.map((pl) => (
              <div
                onClick={() => {
                  p.onAddToPlaylist(pl.id, []);
                  p.onToggleAddOpen();
                }}
                class="px-3 py-1.5 text-xs cursor-pointer truncate hover:bg-white hover:bg-opacity-5"
                style="color: rgba(255,255,255,0.65);"
              >{pl.name}</div>
            )) : (
              <div class="px-3 py-1.5 text-xs" style="color: rgba(255,255,255,0.6);">暂无歌单</div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export { BatchBar };
export default BatchBar;
