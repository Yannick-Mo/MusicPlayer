import type { IPlatform, SongFileInfo, CategoryInfo, LibraryData, ImportResult, AppConfig, MigrationProgress } from "./interface";

export const browserPlatform: IPlatform = {
  async readTextFile(path: string): Promise<string> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to read ${path}`);
    return res.text();
  },

  getAudioUrl(path: string): string {
    return path;
  },

  async scanLibrarySongs(_libraryPath: string): Promise<SongFileInfo[]> {
    return [];
  },

  async importSong(_path: string): Promise<SongFileInfo> {
    throw new Error("importSong not available in browser");
  },

  async importFolder(_path: string): Promise<ImportResult> {
    throw new Error("importFolder not available in browser");
  },

  async deleteSong(_songId: number): Promise<void> {
    throw new Error("deleteSong not available in browser");
  },

  async getSongPath(_songId: number): Promise<string> {
    throw new Error("getSongPath not available in browser");
  },

  async getCoverPath(_songId: number): Promise<string> {
    throw new Error("getCoverPath not available in browser");
  },

  async getLyrics(_songId: number): Promise<string> {
    throw new Error("getLyrics not available in browser");
  },

  async getLibraryData(): Promise<LibraryData> {
    return { songs: [], categories: [], favorites: [], recent_plays: [] };
  },

  async createCategory(_name: string, _icon: string): Promise<CategoryInfo> {
    throw new Error("createCategory not available in browser");
  },

  async deleteCategory(_categoryId: string): Promise<void> {
    throw new Error("deleteCategory not available in browser");
  },

  async renameCategory(_categoryId: string, _name: string): Promise<void> {
    throw new Error("renameCategory not available in browser");
  },

  async addToCategory(_categoryId: string, _songId: number): Promise<void> {
    throw new Error("addToCategory not available in browser");
  },

  async removeFromCategory(_categoryId: string, _songId: number): Promise<void> {
    throw new Error("removeFromCategory not available in browser");
  },

  async toggleFavorite(_songId: number): Promise<boolean> {
    throw new Error("toggleFavorite not available in browser");
  },

  async recordPlay(_songId: number): Promise<void> {
    throw new Error("recordPlay not available in browser");
  },

  async importLyrics(_songId: number, _lrcContent: string): Promise<void> {
    throw new Error("importLyrics not available in browser");
  },

  async importCover(_songId: number, _imagePath: string): Promise<void> {
    throw new Error("importCover not available in browser");
  },

  async setBackgroundImage(_sourcePath: string): Promise<string> {
    throw new Error("setBackgroundImage not available in browser");
  },

  async clearBackgroundImage(): Promise<void> {
    throw new Error("clearBackgroundImage not available in browser");
  },

  async showNotification(_title: string, _body: string): Promise<void> {
    // Browser notification not supported
  },

  async getConfig(): Promise<AppConfig> {
    return { library_path: "" };
  },

  async getLibraryPath(): Promise<string> {
    return "";
  },

  async startMigration(_newPath: string): Promise<void> {
    throw new Error("startMigration not available in browser");
  },

  async cancelMigration(): Promise<void> {
    throw new Error("cancelMigration not available in browser");
  },
};
