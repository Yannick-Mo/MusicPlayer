import { createSignal, createMemo, onMount, onCleanup, type Component } from "solid-js";
import { libraryStore, setLibraryStore, addSongFromImport, removeSongFromStore, refreshLibraryData, type Song } from "../store/libraryStore";
import { addToPlayNext } from "../store/playerStore";
import { executeCommand } from "../core/commandBus";
import { getPlatform } from "../platform";
import type { SongFileInfo } from "../platform/interface";
import SongRow from "./library/SongRow";
import { ContextMenu } from "./library/ContextMenu";
import { Pagination } from "./library/Pagination";
import { BatchBar } from "./library/BatchBar";

interface LibraryContentProps {
  onPlay: (id: number, title: string, artist: string) => void;
}

const LibraryContent: Component<LibraryContentProps> = (props) => {
  const [page, setPage] = createSignal(1);
  const [coverRefreshKey, setCoverRefreshKey] = createSignal(0);
  const [selectedSongId, setSelectedSongId] = createSignal<number | null>(null);
  const [menuSongId, setMenuSongId] = createSignal<number | null>(null);
  const [menuPos, setMenuPos] = createSignal<{ x: number; y: number } | null>(null);
  const [batchMode, setBatchMode] = createSignal(false);
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [batchAddOpen, setBatchAddOpen] = createSignal(false);
  const perPage = 15;
  const [sortColumn, setSortColumn] = createSignal<string | null>(null);
  const [sortDir, setSortDir] = createSignal<"asc" | "desc">("asc");

  const handleSort = (col: string) => {
    if (sortColumn() === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sortIndicator = (col: string) => {
    if (sortColumn() !== col) return "";
    return sortDir() === "asc" ? " ▲" : " ▼";
  };

  const userPlaylists = createMemo(() => libraryStore.categories.filter((c) => c.type === "user"));
  const menuSong = createMemo(() => {
    const id = menuSongId();
    if (id === null) return null;
    return libraryStore.songs.find((s) => s.id === id) ?? null;
  });

  let menuRef: HTMLDivElement | undefined;
  const closeMenu = () => { setMenuSongId(null); setMenuPos(null); };
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-menu-trigger]')) return;
    if (menuRef && menuRef.contains(target)) return;
    closeMenu();
  };
  onMount(() => document.addEventListener("click", onDocClick));
  onCleanup(() => document.removeEventListener("click", onDocClick));

  async function addToPlaylist(categoryId: string, songId: number) {
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (isTauri) {
      try {
        const platform = await getPlatform();
        await platform.addToCategory(categoryId, songId);
      } catch (err) {
        console.error("添加到歌单失败:", err);
        return;
      }
    }
    const idx = libraryStore.categories.findIndex((c) => c.id === categoryId);
    if (idx < 0) return;
    if (libraryStore.categories[idx].songIds.includes(songId)) return;
    setLibraryStore("categories", idx, "songIds", [...libraryStore.categories[idx].songIds, songId]);
  }

  async function handleDeleteSong(songId: number) {
    if (!confirm("确定删除这首歌？")) return;
    try {
      const isTauri = "__TAURI_INTERNALS__" in window;
      if (isTauri) {
        const platform = await getPlatform();
        await platform.deleteSong(songId);
      }
    } catch (err) {
      console.error("后端删除失败:", err);
    }
    await removeSongFromStore(songId);
    executeCommand("handleSongDeleted", songId);
  }

  const filteredSongs = () => {
    const cat = libraryStore.categories.find((c) => c.id === libraryStore.activeCategoryId);
    let list = cat?.id === "all" ? libraryStore.songs : libraryStore.songs.filter((s) => cat?.songIds.includes(s.id));
    if (libraryStore.search) {
      const q = libraryStore.search.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    }
    if (libraryStore.filter === "hasLyrics") list = list.filter((s) => s.hasLyrics);
    if (libraryStore.filter === "noLyrics") list = list.filter((s) => !s.hasLyrics);
    return list;
  };

  const sortedAndFiltered = () => {
    const list = filteredSongs();
    const col = sortColumn();
    if (!col) return list;
    return [...list].sort((a, b) => {
      let cmp: number;
      if (col === "duration") {
        cmp = a.durationSec - b.durationSec;
      } else {
        const va = (a as any)[col]?.toLowerCase() || "";
        const vb = (b as any)[col]?.toLowerCase() || "";
        cmp = va < vb ? -1 : va > vb ? 1 : 0;
      }
      return sortDir() === "desc" ? -cmp : cmp;
    });
  };

  const totalPages = () => Math.max(1, Math.ceil(sortedAndFiltered().length / perPage));
  const paged = () => sortedAndFiltered().slice((page() - 1) * perPage, page() * perPage);

  const stats = () => ({
    total: libraryStore.songs.length,
    withLyrics: libraryStore.songs.filter((s) => s.hasLyrics).length,
    withoutLyrics: libraryStore.songs.filter((s) => !s.hasLyrics).length,
  });

  const currentCatName = () => libraryStore.categories.find((c) => c.id === libraryStore.activeCategoryId)?.name || "媒体库";

  function isFavorite(songId: number): boolean {
    const fav = libraryStore.categories.find((c) => c.id === "favorites");
    return fav ? fav.songIds.includes(songId) : false;
  }

  async function toggleFavorite(songId: number) {
    const isTauri = "__TAURI_INTERNALS__" in window;
    let newState: boolean | null = null;
    if (isTauri) {
      try {
        const platform = await getPlatform();
        newState = await platform.toggleFavorite(songId);
      } catch (err) {
        console.error("切换收藏失败:", err);
        return;
      }
    }
    const favIdx = libraryStore.categories.findIndex((c) => c.id === "favorites");
    if (favIdx < 0) return;
    const ids = libraryStore.categories[favIdx].songIds;
    if (newState === true || (newState === null && !ids.includes(songId))) {
      setLibraryStore("categories", favIdx, "songIds", [...ids, songId]);
    } else {
      setLibraryStore("categories", favIdx, "songIds", (prev) => prev.filter((id) => id !== songId));
    }
  }

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  function openSongMenu(song: Song, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (menuSongId() === song.id) {
      setMenuSongId(null);
      setMenuPos(null);
    } else {
      const mw = 150;
      let mx = e.clientX;
      if (mx + mw > window.innerWidth - 8) mx = window.innerWidth - mw - 8;
      if (mx < 8) mx = 8;
      let my = e.clientY + 4;
      if (my + 120 > window.innerHeight) my = window.innerHeight - 124;
      setMenuSongId(song.id);
      setMenuPos({ x: mx, y: my });
    }
  }

  const handleImportFile = async () => {
    try {
      if (isTauri) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{ name: "音频文件", extensions: ["mp3", "flac", "wav", "aac", "ogg", "m4a"] }],
        });
        if (!selected) return;
        const platform = await getPlatform();
        const meta: SongFileInfo = await platform.importSong(selected);
        await addSongFromImport(meta);
        setPage(totalPages());
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".mp3,.flac,.wav,.aac,.ogg,.m4a";
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const newSong: Song = {
            id: Date.now(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "本地文件",
            album: "导入",
            duration: "0:00",
            durationSec: 0,
            hasLyrics: false,
            hasCover: false,
            format: file.name.split(".").pop()?.toUpperCase() || "MP3",
            playCount: 0,
          };
          setLibraryStore("songs", [...libraryStore.songs, newSong]);
          setLibraryStore("categories", 0, "songIds", [...libraryStore.categories[0].songIds, newSong.id]);
          setPage(totalPages());
        };
        input.click();
      }
    } catch (err) {
      console.error("导入单曲失败:", err);
    }
  };

  const handleImportFolder = async () => {
    try {
      if (isTauri) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        if (!selected) return;
        const platform = await getPlatform();
        setLibraryStore("importSummary", null);
        await platform.importFolder(selected);
        await refreshLibraryData();
        setPage(totalPages());
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".mp3,.flac,.wav,.aac,.ogg,.m4a";
        input.multiple = true;
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (!files) return;
          const added = Array.from(files).map((file) => ({
            id: Date.now() + Math.random(),
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "本地文件",
            album: "导入",
            duration: "0:00",
            durationSec: 0,
            hasLyrics: false,
            hasCover: false,
            format: file.name.split(".").pop()?.toUpperCase() || "MP3",
            playCount: 0,
          } as Song));
          setLibraryStore("songs", [...libraryStore.songs, ...added]);
          for (const s of added) {
            setLibraryStore("categories", 0, "songIds", [...libraryStore.categories[0].songIds, s.id]);
          }
          setPage(totalPages());
        };
        input.click();
      }
    } catch (err) {
      console.error("导入文件夹失败:", err);
    }
  };

  async function importLyrics(songId: number) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".lrc,.txt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;
        if (isTauri) {
          try {
            const platform = await getPlatform();
            await platform.importLyrics(songId, text);
          } catch (err) {
            console.error("导入歌词失败:", err);
            return;
          }
        }
        setLibraryStore("lyricsCache", songId, text);
        setLibraryStore("songs", (s) => s.id === songId, "hasLyrics", true);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const handlePlayNext = (song: Song) => {
    addToPlayNext({ id: song.id, title: song.title, artist: song.artist });
    closeMenu();
  };

  const handleContextAddToPlaylist = (categoryId: string, songId: number) => {
    addToPlaylist(categoryId, songId);
  };

  const handleImportCover = async (songId: number) => {
    try {
      if (isTauri) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png"] }],
        });
        if (!selected) return;
        const platform = await getPlatform();
        await platform.importCover(songId, selected);
        setLibraryStore("songs", (song) => song.id === songId, "hasCover", true);
        setCoverRefreshKey((k) => k + 1);
      }
    } catch (e) { console.error("导入封面失败:", e); }
  };

  const handleBatchSelect = () => {
    setBatchMode(true);
    setSelectedIds(new Set<number>());
  };

  const handleContextDelete = async (songId: number) => {
    await handleDeleteSong(songId);
  };

  const handleBatchAddToPlaylist = (categoryId: string, _songIds: number[]) => {
    const ids = Array.from(selectedIds());
    for (const id of ids) {
      addToPlaylist(categoryId, id);
    }
    setSelectedIds(new Set<number>());
    setBatchAddOpen(false);
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds());
    if (!confirm(`确定删除选中的 ${ids.length} 首歌？`)) return;
    for (const id of ids) {
      try {
        const platform = await getPlatform();
        if (isTauri) await platform.deleteSong(id);
      } catch (err) {
        console.error("删除失败:", err);
      }
      await removeSongFromStore(id);
      executeCommand("handleSongDeleted", id);
    }
    setSelectedIds(new Set<number>());
  };

  const handleExitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set<number>());
  };

  const handleToggleAddOpen = () => setBatchAddOpen((v) => !v);

  return (
    <>
    <div class="flex-1 flex flex-col p-[18px] overflow-hidden" style="position: relative;">
      <div class="flex justify-between items-center mb-3">
        <div class="flex items-center gap-2.5">
          <div>
            <div class="text-base font-semibold" style="color: rgba(255,255,255,0.85);">{currentCatName()}</div>
            <div class="text-xs mt-0.5" style="color: rgba(255,255,255,0.65);">
              共 {stats().total} 首 · {stats().withLyrics} 首有歌词 · {stats().withoutLyrics} 首无歌词
            </div>
          </div>
          {filteredSongs().length > 0 && (
            <button
              onClick={() => {
                const items = filteredSongs().map((s) => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, hasLyrics: s.hasLyrics }));
                executeCommand("replaceQueueAndPlay", items, 0);
              }}
              class="text-xs px-3 py-1.5 rounded"
              style={{ background: "var(--accent-gradient)", color: "white" }}
            >▶ 播放全部</button>
          )}
        </div>
        <div class="flex gap-1.5">
          <button onClick={handleImportFile} class="text-xs px-3 py-1.5 rounded" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.85);">
            ➕ 导入单曲
          </button>
          <button onClick={handleImportFolder} class="text-xs px-3 py-1.5 rounded" style={{ background: "rgba(var(--accent-rgb), 0.18)", border: "1px solid rgba(var(--accent-rgb), 0.4)", color: "var(--accent-light)" }}>
            📁 导入文件夹
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2.5 mb-3.5">
        <div class="flex items-center gap-1 flex-1 max-w-[260px] px-2.5 py-1.5 rounded-md" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);">
          <span style="color: rgba(255,255,255,0.8); font-size: 13px;">🔍</span>
          <input
            value={libraryStore.search}
            onInput={(e) => { setLibraryStore("search", e.currentTarget.value); setPage(1); }}
            placeholder="搜索歌曲..."
            class="bg-transparent outline-none text-xs w-full"
            style="color: rgba(255,255,255,0.8);"
          />
        </div>
        <div class="flex gap-1">
          {(["all", "hasLyrics", "noLyrics"] as const).map((f) => (
            <button
              onClick={() => { setLibraryStore("filter", f); setPage(1); }}
              class="text-xs px-2.5 py-1.5 rounded"
              style={{
                background: libraryStore.filter === f ? "rgba(var(--accent-rgb), 0.12)" : "rgba(255,255,255,0.03)",
                color: libraryStore.filter === f ? "#ffffff" : "rgba(255,255,255,0.65)",
              }}
            >
              {f === "all" ? "全部" : f === "hasLyrics" ? "有歌词" : "无歌词"}
            </button>
          ))}
        </div>
      </div>

      <div class="flex text-xs pb-1.5 border-b uppercase tracking-wider" style="color: rgba(255,255,255,0.5); border-color: rgba(255,255,255,0.04);">
        {batchMode() && (
          <div class="w-[28px] flex-shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              checked={selectedIds().size === paged().length && paged().length > 0}
              ref={(el) => { if (el) el.indeterminate = selectedIds().size > 0 && selectedIds().size < paged().length; }}
              onInput={(e) => {
                if (e.currentTarget.checked) {
                  setSelectedIds(new Set<number>(paged().map(s => s.id)));
                } else {
                  setSelectedIds(new Set<number>());
                }
              }}
              class="w-3 h-3"
            />
          </div>
        )}
        <div class="w-[24px] flex-shrink-0"></div>
        <div class="flex-[2] cursor-pointer select-none" onClick={() => handleSort("title")} style={{ color: sortColumn() === "title" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>标题{sortIndicator("title")}</div>
        <div class="flex-[1.4] cursor-pointer select-none" onClick={() => handleSort("artist")} style={{ color: sortColumn() === "artist" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>艺术家{sortIndicator("artist")}</div>
        <div class="flex-[1] cursor-pointer select-none" onClick={() => handleSort("album")} style={{ color: sortColumn() === "album" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>专辑{sortIndicator("album")}</div>
        <div class="w-[44px] text-center cursor-pointer select-none" onClick={() => handleSort("duration")} style={{ color: sortColumn() === "duration" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)" }}>时长{sortIndicator("duration")}</div>
        <div class="w-[52px] text-center">播放</div>
        <div class="w-[38px] text-center">歌词</div>
        <div class="w-[34px] text-center">♥</div>
        <div class="w-[34px] text-center"></div>
      </div>

      <div class="flex-1 overflow-y-auto">
        {libraryStore.loading ? (
          <div class="flex items-center justify-center h-full text-xs" style="color: rgba(255,255,255,0.65);">加载中...</div>
        ) : paged().length === 0 ? (
          <div class="flex items-center justify-center h-full text-xs" style="color: rgba(255,255,255,0.65);">暂无歌曲，导入音乐开始</div>
        ) : paged().map((song, i) => (
          <SongRow
            song={song}
            index={i}
            page={page()}
            perPage={perPage}
            isSelected={(!batchMode() && selectedSongId() === song.id) || (batchMode() && selectedIds().has(song.id))}
            isFavorite={isFavorite(song.id)}
            isBatchMode={batchMode()}
            coverRefreshKey={coverRefreshKey()}
            onPlay={props.onPlay}
            onToggleFavorite={toggleFavorite}
            onToggleSelect={(id) => {
              const next = new Set(selectedIds());
              if (next.has(id)) next.delete(id); else next.add(id);
              setSelectedIds(next);
            }}
            onSelect={setSelectedSongId}
            onOpenMenu={openSongMenu}
            onImportLyrics={importLyrics}
          />
        ))}
      </div>

      {batchMode() && (
        <BatchBar
          selectedCount={selectedIds().size}
          userPlaylists={userPlaylists()}
          isTauri={isTauri}
          showAddOpen={batchAddOpen()}
          onAddToPlaylist={handleBatchAddToPlaylist}
          onDeleteSelected={handleDeleteSelected}
          onExitBatchMode={handleExitBatchMode}
          onToggleAddOpen={handleToggleAddOpen}
        />
      )}

      <Pagination
        page={page()}
        totalPages={totalPages()}
        onPageChange={setPage}
      />
    </div>

    <ContextMenu
      song={menuSong()}
      position={menuPos()}
      userPlaylists={userPlaylists()}
      isTauri={isTauri}
      menuRef={(el) => { menuRef = el; }}
      onClose={closeMenu}
      onPlayNext={handlePlayNext}
      onAddToPlaylist={handleContextAddToPlaylist}
      onImportCover={handleImportCover}
      onBatchSelect={handleBatchSelect}
      onDelete={handleContextDelete}
    />
    </>
  );
};

export default LibraryContent;
