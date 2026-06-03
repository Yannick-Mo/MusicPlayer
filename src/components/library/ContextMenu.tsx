import { createSignal, type Component } from "solid-js";
import type { Song, PlaylistCategory } from "../../store/libraryStore";

interface ContextMenuProps {
  song: Song | null;
  position: { x: number; y: number } | null;
  userPlaylists: PlaylistCategory[];
  isTauri: boolean;
  menuRef: (el: HTMLDivElement) => void;
  onClose: () => void;
  onPlayNext: (song: Song) => void;
  onAddToPlaylist: (categoryId: string, songId: number) => void;
  onImportCover: (songId: number) => Promise<void>;
  onBatchSelect: () => void;
  onDelete: (songId: number) => Promise<void>;
}

const ContextMenu: Component<ContextMenuProps> = (p) => {
  const [playlistSubOpen, setPlaylistSubOpen] = createSignal(false);

  return (
    <>
      <style>{`.cm-item:hover,.cm-sub-item:hover{background:rgba(var(--accent-rgb,99,102,241),0.15)}`}</style>
      {p.song && p.position && (
        <div
          ref={p.menuRef}
          class="fixed z-[9999] rounded-lg py-1 min-w-[150px]"
          style={{
            left: `${p.position.x}px`,
            top: `${p.position.y}px`,
            background: "rgba(15,15,22,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            "backdrop-filter": "blur(20px)",
          }}
        >
          <div
            onClick={() => { p.onPlayNext(p.song!); p.onClose(); }}
            class="cm-item px-3 py-2 text-xs cursor-pointer whitespace-nowrap rounded"
            style="color: rgba(255,255,255,0.6);"
          >➡️ 下一首播放</div>

          <div class="relative">
            <div
              onClick={(e) => { e.stopPropagation(); setPlaylistSubOpen((v) => !v); }}
              class="cm-item px-3 py-2 text-xs cursor-pointer whitespace-nowrap rounded"
              style="color: rgba(255,255,255,0.6);"
            >➕ 添加到歌单</div>
            {playlistSubOpen() && (
              <div
                class="absolute right-full top-0 mr-1 z-[9999] rounded-lg py-1 min-w-[110px] max-h-48 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "rgba(15,15,22,0.85)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  "backdrop-filter": "blur(16px)",
                }}
              >
                {p.userPlaylists.length > 0 ? p.userPlaylists.map((pl) => (
                  <div
                    onClick={() => { p.onAddToPlaylist(pl.id, p.song!.id); p.onClose(); }}
                    class="cm-sub-item px-3 py-1.5 text-xs cursor-pointer truncate"
                    style="color: rgba(255,255,255,0.65);"
                  >{pl.name}</div>
                )) : (
                  <div class="px-3 py-1.5 text-xs" style="color: rgba(255,255,255,0.6);">暂无歌单</div>
                )}
              </div>
            )}
          </div>

          <div
            onClick={async () => {
              const s = p.song!;
              p.onClose();
              await p.onImportCover(s.id);
            }}
            class="cm-item px-3 py-2 text-xs cursor-pointer whitespace-nowrap rounded"
            style="color: rgba(255,255,255,0.6);"
          >🖼️ 导入封面</div>

          <div
            onClick={() => { p.onBatchSelect(); p.onClose(); }}
            class="cm-item px-3 py-2 text-xs cursor-pointer whitespace-nowrap rounded"
            style="color: rgba(255,255,255,0.6);"
          >📋 批量选择</div>

          <div class="h-px mx-2 my-0.5" style="background: rgba(255,255,255,0.06);"></div>

          <div
            onClick={async () => {
              await p.onDelete(p.song!.id);
              p.onClose();
            }}
            class="cm-item px-3 py-2 text-xs cursor-pointer whitespace-nowrap rounded"
            style="color: #f87171;"
          >🗑️ 删除</div>
        </div>
      )}
    </>
  );
};

export { ContextMenu };
export default ContextMenu;
