export interface SongFileInfo {
  id: number;
  filename: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  format: string;
  has_lyrics: boolean;
  has_cover: boolean;
  play_count: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  song_ids: number[];
}

export interface LibraryData {
  songs: SongFileInfo[];
  categories: CategoryInfo[];
  favorites: number[];
  recent_plays: number[];
}

export interface ImportResult {
  total: number;
  lyrics: number;
  no_lyrics: number;
}

export interface IPlatform {
  readTextFile(path: string): Promise<string>;
  getAudioUrl(path: string): string;
  scanLibrarySongs(libraryPath: string): Promise<SongFileInfo[]>;
  importSong(path: string): Promise<SongFileInfo>;
  importFolder(path: string): Promise<ImportResult>;
  deleteSong(songId: number): Promise<void>;
  getSongPath(songId: number): Promise<string>;
  getCoverPath(songId: number): Promise<string>;
  getLyrics(songId: number): Promise<string>;
  getLibraryData(): Promise<LibraryData>;
  createCategory(name: string, icon: string): Promise<CategoryInfo>;
  deleteCategory(categoryId: string): Promise<void>;
  renameCategory(categoryId: string, name: string): Promise<void>;
  addToCategory(categoryId: string, songId: number): Promise<void>;
  removeFromCategory(categoryId: string, songId: number): Promise<void>;
  toggleFavorite(songId: number): Promise<boolean>;
  recordPlay(songId: number): Promise<void>;
  importLyrics(songId: number, lrcContent: string): Promise<void>;
  importCover(songId: number, imagePath: string): Promise<void>;
  setBackgroundImage(sourcePath: string): Promise<string>;
  clearBackgroundImage(): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
}
