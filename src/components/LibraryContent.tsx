import { createSignal, createMemo, createResource, onMount, onCleanup, type Component } from "solid-js";
import { libraryStore, setLibraryStore, addSongFromImport, removeSongFromStore, refreshLibraryData, type Song } from "../store/libraryStore";
import { addToPlayNext } from "../store/playerStore";
import { getPlatform } from "../platform";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { SongFileInfo } from "../platform/interface";

interface LibraryContentProps {
  onPlay: (id: number, title: string, artist: string) => void;
}

const covers = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #a855f7, #d946ef)",
  "linear-gradient(135deg, #22c55e, #10b981)",
  "linear-gradient(135deg, #f472b6, #ec4899)",
];

const CoverCell: Component<{ song: Song; refreshKey: number }> = (p) => {
  const [coverPath] = createResource(() => p.song.hasCover ? `${p.song.id}-${p.refreshKey}` : undefined, async (key) => {
    const id = parseInt(key);
    if (isNaN(id)) return undefined;
    try {
      const platform = await getPlatform();
      const path = await platform.getCoverPath(id);
      return convertFileSrc(path);
    } catch { return undefined; }
  });
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

const LibraryContent: Component<LibraryContentProps> = (props) => {
  const [page, setPage] = createSignal(1);
  const [coverRefreshKey, setCoverRefreshKey] = createSignal(0);
  const [selectedSongId, setSelectedSongId] = createSignal<number | null>(null);
  const [menuSongId, setMenuSongId] = createSignal<number | null>(null);
  const [menuPos, setMenuPos] = createSignal<{ x: number; y: number } | null>(null);
  const [playlistSubSongId, setPlaylistSubSongId] = createSignal<number | null>(null);
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
  const closeMenu = () => { setMenuSongId(null); setMenuPos(null); setPlaylistSubSongId(null); };
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
    (window as any).__handleSongDeleted?.(songId);
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
        const fn = (window as any).__playSong;
        if (fn) fn(meta.id, meta.title, meta.artist);
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
          const fn = (window as any).__playSong;
          if (fn) fn(newSong.id, newSong.title, newSong.artist);
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
                const fn = (window as any).__replaceQueueAndPlay;
                if (fn) fn(items, 0);
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
        ) : paged().map((song, i) => {
          const liked = isFavorite(song.id);
          return (
            <div
              onClick={() => {
                if (batchMode()) {
                  const next = new Set(selectedIds());
                  if (next.has(song.id)) next.delete(song.id);
                  else next.add(song.id);
                  setSelectedIds(next);
                } else {
                  setSelectedSongId(song.id);
                }
              }}
              onDblClick={() => {
                if (!batchMode()) props.onPlay(song.id, song.title, song.artist);
              }}
              onContextMenu={(e) => openSongMenu(song, e)}
              class="flex items-center py-3.5 text-sm border-b cursor-pointer hover:bg-white hover:bg-opacity-5"
              style={{ background: (selectedSongId() === song.id && !batchMode()) || (batchMode() && selectedIds().has(song.id)) ? "rgba(var(--accent-rgb), 0.1)" : undefined, "border-color": "rgba(255,255,255,0.03)" }}
            >
              {batchMode() && (
                <div class="w-[28px] flex-shrink-0 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds().has(song.id)}
                    onInput={(e) => {
                      const next = new Set(selectedIds());
                      if (e.currentTarget.checked) next.add(song.id);
                      else next.delete(song.id);
                      setSelectedIds(next);
                    }}
                    class="w-3 h-3"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              <div class="w-[24px] flex-shrink-0" style="color: rgba(255,255,255,0.5);">{(page() - 1) * perPage + i + 1}</div>
              <div class="flex-[2] flex items-center gap-2 min-w-0">
                <CoverCell song={song} refreshKey={coverRefreshKey()} />
                <span class="truncate" style="color: rgba(255,255,255,0.85);">{song.title}</span>
              </div>
              <div class="flex-[1.4] truncate" style="color: rgba(255,255,255,0.6);">{song.artist}</div>
              <div class="flex-[1] truncate" style="color: rgba(255,255,255,0.65);">{song.album}</div>
              <div class="w-[44px] text-center font-mono" style="color: rgba(255,255,255,0.65);">{song.duration}</div>
              <div class="w-[52px] text-center font-mono text-xs" style="color: rgba(255,255,255,0.65);">{song.playCount || 0}</div>
              <div class="w-[38px] text-center flex items-center justify-center gap-0.5" style="color: rgba(255,255,255,0.65);">
                {song.hasLyrics
                  ? <span style="color: #34d399;">✓</span>
                  : <span onClick={(e) => { e.stopPropagation(); importLyrics(song.id); }} class="cursor-pointer" style="color: rgba(255,255,255,0.8); font-size: 15px;">+</span>
                }
              </div>
              <div class="w-[34px] text-center text-sm cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id); }} style={`color: ${liked ? "#ef4444" : "rgba(255,255,255,0.5)"};`}>
                {liked ? "♥" : "♡"}
              </div>
              <div
                onClick={(e) => openSongMenu(song, e)}
                class="w-[34px] text-center cursor-pointer text-xs"
                style="color: rgba(255,255,255,0.65);" data-menu-trigger
              >⋯</div>
            </div>
          );
        })}
      </div>

      {batchMode() && (
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
          style={{
            background: "rgba(var(--accent-rgb, 99, 102, 241), 0.1)",
            border: "1px solid rgba(var(--accent-rgb, 99, 102, 241), 0.2)",
          }}
        >
          <span class="text-xs font-medium" style="color: rgba(255,255,255,0.8);">
            已选 {selectedIds().size} 首
          </span>
          <div class="flex-1" />
          {selectedIds().size > 0 && (
            <>
              <button
                onClick={() => setBatchAddOpen(true)}
                class="text-xs px-2.5 py-1 rounded transition-colors"
                style="background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75);"
              >添加到歌单</button>
              <button
                onClick={async () => {
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
                    (window as any).__handleSongDeleted?.(id);
                  }
                  setSelectedIds(new Set<number>());
                }}
                class="text-xs px-2.5 py-1 rounded transition-colors"
                style="background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3);"
              >删除选中</button>
            </>
          )}
          <button
            onClick={() => { setBatchMode(false); setSelectedIds(new Set<number>()); }}
            class="text-xs px-2.5 py-1 rounded transition-colors"
            style="background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08);"
          >退出多选</button>
        </div>
      )}

      {batchAddOpen() && (
        <>
          <div class="fixed inset-0 z-10" onClick={() => setBatchAddOpen(false)} />
          <div
            class="absolute left-20 z-20 rounded-lg py-1 min-w-[120px]"
            style={{
              background: "rgba(15,15,20,0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              "backdrop-filter": "blur(16px)",
            }}
          >
            {userPlaylists().length > 0 ? userPlaylists().map((pl) => (
              <div
                onClick={async () => {
                  for (const id of Array.from(selectedIds())) {
                    await addToPlaylist(pl.id, id);
                  }
                  setBatchAddOpen(false);
                  setSelectedIds(new Set<number>());
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

      <div class="flex justify-center items-center gap-1.5 pt-3 mt-auto border-t" style="border-color: rgba(255,255,255,0.04);">
        <button onClick={() => setPage(Math.max(1, page() - 1))} disabled={page() <= 1} class="text-xs" style="color: rgba(255,255,255,0.65);">‹</button>
        {Array.from({ length: totalPages() }, (_, i) => i + 1).map((p) => (
          <button onClick={() => setPage(p)} class="text-xs px-[9px] py-[3px] rounded" style={{
            background: p === page() ? "rgba(var(--accent-rgb), 0.12)" : "transparent",
            color: p === page() ? "var(--accent-light)" : "rgba(255,255,255,0.65)",
          }}>{p}</button>
        ))}
        <button onClick={() => setPage(Math.min(totalPages(), page() + 1))} disabled={page() >= totalPages()} class="text-xs" style="color: rgba(255,255,255,0.65);">›</button>
      </div>
    </div>

    {menuSong() && menuPos() && (
      <div
        ref={menuRef}
        class="fixed z-[9999] rounded-lg py-1 min-w-[150px]"
        style={{
          left: `${menuPos()!.x}px`,
          top: `${menuPos()!.y}px`,
          background: "rgba(15,15,20,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          "backdrop-filter": "blur(16px)",
        }}
      >
        <div
          onClick={() => { const s = menuSong(); if (s) { addToPlayNext({ id: s.id, title: s.title, artist: s.artist }); } closeMenu(); }}
          class="px-3 py-2 text-xs cursor-pointer whitespace-nowrap hover:bg-white hover:bg-opacity-5 rounded"
          style="color: rgba(255,255,255,0.6);"
        >➡️ 下一首播放</div>

        <div class="relative">
          <div
            onClick={(e) => { e.stopPropagation(); const s = menuSong(); if (s) setPlaylistSubSongId(playlistSubSongId() === s.id ? null : s.id); }}
            class="px-3 py-2 text-xs cursor-pointer whitespace-nowrap hover:bg-white hover:bg-opacity-5 rounded"
            style="color: rgba(255,255,255,0.6);"
          >➕ 添加到歌单</div>
          {playlistSubSongId() !== null && (
            <div
              class="absolute right-full top-0 mr-1 z-[9999] rounded-lg py-1 min-w-[110px]"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(15,15,20,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
                "backdrop-filter": "blur(16px)",
              }}
            >
              {userPlaylists().length > 0 ? userPlaylists().map((pl) => (
                <div
                  onClick={() => { addToPlaylist(pl.id, menuSong()!.id); closeMenu(); }}
                  class="px-3 py-1.5 text-xs cursor-pointer truncate hover:bg-white hover:bg-opacity-5"
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
            const s = menuSong(); if (!s) return; closeMenu();
            try {
              if (isTauri) {
                const { open } = await import("@tauri-apps/plugin-dialog");
                const selected = await open({
                  multiple: false,
                  filters: [{ name: "图片", extensions: ["jpg", "jpeg", "png"] }],
                });
                if (!selected) return;
                const platform = await getPlatform();
                await platform.importCover(s.id, selected);
                setLibraryStore("songs", (song) => song.id === s.id, "hasCover", true);
                setCoverRefreshKey((k) => k + 1);
              }
            } catch (e) { console.error("导入封面失败:", e); }
          }}
          class="px-3 py-2 text-xs cursor-pointer whitespace-nowrap hover:bg-white hover:bg-opacity-5 rounded"
          style="color: rgba(255,255,255,0.6);"
        >🖼️ 导入封面</div>

        <div
          onClick={() => { closeMenu(); setBatchMode(true); setSelectedIds(new Set<number>()); }}
          class="px-3 py-2 text-xs cursor-pointer whitespace-nowrap hover:bg-white hover:bg-opacity-5 rounded"
          style="color: rgba(255,255,255,0.6);"
        >📋 批量选择</div>

        <div class="h-px mx-2 my-0.5" style="background: rgba(255,255,255,0.06);"></div>

        <div
          onClick={async (e) => { e.stopPropagation(); const s = menuSong(); if (s) await handleDeleteSong(s.id); closeMenu(); }}
          class="px-3 py-2 text-xs cursor-pointer whitespace-nowrap hover:bg-white hover:bg-opacity-5 rounded"
          style="color: #f87171;"
        >🗑️ 删除</div>
      </div>
    )}
    </>
  );
};

export default LibraryContent;
