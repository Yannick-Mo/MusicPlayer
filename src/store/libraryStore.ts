import { createStore } from "solid-js/store";
import type { SongFileInfo, CategoryInfo } from "../platform/interface";
import { getPlatform } from "../platform";

export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  hasLyrics: boolean;
  hasCover: boolean;
  format: string;
  playCount: number;
}

export interface PlaylistCategory {
  id: string;
  name: string;
  icon: string;
  type: "system" | "user";
  songIds: number[];
}

export interface LibraryState {
  songs: Song[];
  categories: PlaylistCategory[];
  activeCategoryId: string;
  filter: "all" | "hasLyrics" | "noLyrics";
  search: string;
  loading: boolean;
  loaded: boolean;
  lyricsCache: Record<number, string>;
  importSummary: { total: number; lyrics: number; noLyrics: number } | null;
}

function songFileToSong(meta: SongFileInfo): Song {
  const secs = meta.duration || 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return {
    id: meta.id,
    title: meta.title || "未知",
    artist: meta.artist || "未知艺术家",
    album: meta.album || "-",
    duration: `${m}:${s.toString().padStart(2, "0")}`,
    durationSec: secs,
    hasLyrics: meta.has_lyrics || false,
    hasCover: meta.has_cover || false,
    format: meta.format || "MP3",
    playCount: meta.play_count || 0,
  };
}

function categoryInfoToPlaylist(cat: CategoryInfo): PlaylistCategory {
  return {
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    type: "user",
    songIds: cat.song_ids,
  };
}

export const [libraryStore, setLibraryStore] = createStore<LibraryState>({
  songs: [],
  categories: [
    { id: "all", name: "全部音乐", icon: "🎵", type: "system", songIds: [] },
    { id: "favorites", name: "我喜欢", icon: "❤️", type: "system", songIds: [] },
    { id: "recent", name: "最近播放", icon: "🎧", type: "system", songIds: [] },
  ],
  activeCategoryId: "all",
  filter: "all",
  search: "",
  loading: false,
  loaded: false,
  lyricsCache: {},
  importSummary: null,
});

export async function loadLibraryData() {
  setLibraryStore("loading", true);
  try {
    const platform = await getPlatform();
    const data = await platform.getLibraryData();
    setLibraryStore("songs", data.songs.map(songFileToSong));
    setLibraryStore("categories", [
      { id: "all", name: "全部音乐", icon: "🎵", type: "system", songIds: data.songs.map((s) => s.id) },
      { id: "favorites", name: "我喜欢", icon: "❤️", type: "system", songIds: data.favorites },
      { id: "recent", name: "最近播放", icon: "🎧", type: "system", songIds: data.recent_plays.slice().reverse() },
      ...data.categories.map(categoryInfoToPlaylist),
    ]);
    setLibraryStore("loaded", true);
  } catch (err) {
    console.error("Failed to load library data:", err);
  } finally {
    setLibraryStore("loading", false);
  }
}

export async function addSongFromImport(songMeta: SongFileInfo) {
  const song = songFileToSong(songMeta);
  setLibraryStore("songs", [...libraryStore.songs, song]);
  setLibraryStore("categories", 0, "songIds", [...libraryStore.categories[0].songIds, song.id]);
}

export async function removeSongFromStore(songId: number) {
  setLibraryStore("songs", (prev) => prev.filter((s) => s.id !== songId));
  const cache = { ...libraryStore.lyricsCache };
  delete cache[songId];
  setLibraryStore("lyricsCache", cache);
  for (let i = 0; i < libraryStore.categories.length; i++) {
    if (libraryStore.categories[i].songIds.includes(songId)) {
      setLibraryStore("categories", i, "songIds", (prev) => prev.filter((id) => id !== songId));
    }
  }
}

export async function refreshLibraryData() {
  await loadLibraryData();
}
