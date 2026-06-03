import { createResource, type Component } from "solid-js";
import { type Song } from "../../store/libraryStore";
import { getPlatform } from "../../platform";
import { convertFileSrc } from "@tauri-apps/api/core";

const covers = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #a855f7, #d946ef)",
  "linear-gradient(135deg, #22c55e, #10b981)",
  "linear-gradient(135deg, #f472b6, #ec4899)",
];

interface CoverCellProps {
  song: Song;
  refreshKey: number;
}

const CoverCell: Component<CoverCellProps> = (p) => {
  const [coverPath] = createResource(
    () => p.song.hasCover ? `${p.song.id}-${p.refreshKey}` : undefined,
    async (key: string) => {
      const id = parseInt(key);
      if (isNaN(id)) return undefined;
      try {
        const platform = await getPlatform();
        const path = await platform.getCoverPath(id);
        return convertFileSrc(path);
      } catch { return undefined; }
    }
  );
  return (
    <>
      {coverPath() ? (
        <img src={coverPath()!} class="w-[36px] h-[36px] rounded flex-shrink-0 object-cover" alt="" />
      ) : (
        <div class="w-[36px] h-[36px] rounded flex-shrink-0" style={{ background: covers[p.song.id % covers.length] }} />
      )}
    </>
  );
};

interface SongRowProps {
  song: Song;
  index: number;
  page: number;
  perPage: number;
  isSelected: boolean;
  isFavorite: boolean;
  isBatchMode: boolean;
  coverRefreshKey: number;
  onPlay: (id: number, title: string, artist: string) => void;
  onToggleFavorite: (id: number) => void;
  onToggleSelect: (id: number) => void;
  onSelect: (id: number) => void;
  onOpenMenu: (song: Song, e: MouseEvent) => void;
  onImportLyrics: (songId: number) => void;
}

const SongRow: Component<SongRowProps> = (p) => {
  return (
    <div
      onClick={() => {
        if (p.isBatchMode) {
          p.onToggleSelect(p.song.id);
        } else {
          p.onSelect(p.song.id);
        }
      }}
      onDblClick={() => {
        if (!p.isBatchMode) p.onPlay(p.song.id, p.song.title, p.song.artist);
      }}
      onContextMenu={(e) => p.onOpenMenu(p.song, e)}
      class="flex items-center py-3.5 text-sm border-b cursor-pointer hover:bg-white hover:bg-opacity-5"
      style={{
        background: p.isSelected ? "rgba(var(--accent-rgb), 0.1)" : undefined,
        "border-color": "rgba(255,255,255,0.03)",
      }}
    >
      {p.isBatchMode && (
        <div class="w-[28px] flex-shrink-0 flex items-center justify-center">
          <input
            type="checkbox"
            checked={p.isSelected}
            onInput={() => p.onToggleSelect(p.song.id)}
            class="w-3 h-3"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div class="w-[24px] flex-shrink-0" style="color: rgba(255,255,255,0.5);">{(p.page - 1) * p.perPage + p.index + 1}</div>
      <div class="flex-[2] flex items-center gap-2 min-w-0">
        <CoverCell song={p.song} refreshKey={p.coverRefreshKey} />
        <span class="truncate" style="color: rgba(255,255,255,0.85);">{p.song.title}</span>
      </div>
      <div class="flex-[1.4] truncate" style="color: rgba(255,255,255,0.6);">{p.song.artist}</div>
      <div class="flex-[1] truncate" style="color: rgba(255,255,255,0.65);">{p.song.album}</div>
      <div class="w-[44px] text-center font-mono" style="color: rgba(255,255,255,0.65);">{p.song.duration}</div>
      <div class="w-[52px] text-center font-mono text-xs" style="color: rgba(255,255,255,0.65);">{p.song.playCount || 0}</div>
      <div class="w-[38px] text-center flex items-center justify-center gap-0.5" style="color: rgba(255,255,255,0.65);">
        {p.song.hasLyrics
          ? <span style="color: #34d399;">✓</span>
          : <span onClick={(e) => { e.stopPropagation(); p.onImportLyrics(p.song.id); }} class="cursor-pointer" style="color: rgba(255,255,255,0.8); font-size: 15px;">+</span>
        }
      </div>
      <div class="w-[34px] text-center text-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); p.onToggleFavorite(p.song.id); }} style={`color: ${p.isFavorite ? "#ef4444" : "rgba(255,255,255,0.5)"};`}>
        {p.isFavorite ? "♥" : "♡"}
      </div>
      <div
        onClick={(e) => p.onOpenMenu(p.song, e)}
        class="w-[34px] text-center cursor-pointer text-xs"
        style="color: rgba(255,255,255,0.65);" data-menu-trigger
      >⋯</div>
    </div>
  );
};

export { CoverCell, SongRow };
export default SongRow;
