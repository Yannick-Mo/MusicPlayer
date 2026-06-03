import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { IPlatform, SongFileInfo, CategoryInfo, LibraryData, ImportResult, AppConfig, MigrationProgress } from "./interface";

export const tauriPlatform: IPlatform = {
  async readTextFile(path: string): Promise<string> {
    return invoke("read_text_file", { path });
  },

  getAudioUrl(path: string): string {
    return convertFileSrc(path);
  },

  async scanLibrarySongs(_libraryPath: string): Promise<SongFileInfo[]> {
    return invoke("scan_library");
  },

  async importSong(path: string): Promise<SongFileInfo> {
    return invoke("import_song", { path });
  },

  async importFolder(path: string): Promise<ImportResult> {
    return invoke("import_folder", { path });
  },

  async deleteSong(songId: number): Promise<void> {
    return invoke("delete_song", { songId });
  },

  async getSongPath(songId: number): Promise<string> {
    return invoke("get_song_path", { songId });
  },

  async getCoverPath(songId: number): Promise<string> {
    return invoke("get_cover_path", { songId });
  },

  async getLyrics(songId: number): Promise<string> {
    return invoke("get_lyrics", { songId });
  },

  async getLibraryData(): Promise<LibraryData> {
    return invoke("get_library_data");
  },

  async createCategory(name: string, icon: string): Promise<CategoryInfo> {
    return invoke("create_category", { name, icon });
  },

  async deleteCategory(categoryId: string): Promise<void> {
    return invoke("delete_category", { categoryId });
  },

  async renameCategory(categoryId: string, name: string): Promise<void> {
    return invoke("rename_category", { categoryId, name });
  },

  async addToCategory(categoryId: string, songId: number): Promise<void> {
    return invoke("add_to_category", { categoryId, songId });
  },

  async removeFromCategory(categoryId: string, songId: number): Promise<void> {
    return invoke("remove_from_category", { categoryId, songId });
  },

  async toggleFavorite(songId: number): Promise<boolean> {
    return invoke("toggle_favorite", { songId });
  },

  async recordPlay(songId: number): Promise<void> {
    return invoke("record_play", { songId });
  },

  async importLyrics(songId: number, lrcContent: string): Promise<void> {
    return invoke("import_lyrics", { songId, lrcContent });
  },

  async importCover(songId: number, imagePath: string): Promise<void> {
    return invoke("import_cover", { songId, imagePath });
  },

  async setBackgroundImage(sourcePath: string): Promise<string> {
    return invoke("set_background_image", { sourcePath });
  },

  async clearBackgroundImage(): Promise<void> {
    return invoke("clear_background_image");
  },

  async showNotification(title: string, body: string): Promise<void> {
    let permitted = await isPermissionGranted();
    if (!permitted) {
      const permission = await requestPermission();
      permitted = permission === "granted";
    }
    if (permitted) {
      sendNotification({ title, body });
    }
  },

  async getConfig(): Promise<AppConfig> {
    return invoke("get_config");
  },

  async getLibraryPath(): Promise<string> {
    return invoke("get_library_path");
  },

  async startMigration(newPath: string): Promise<void> {
    return invoke("start_migration", { newPath });
  },

  async cancelMigration(): Promise<void> {
    return invoke("cancel_migration");
  },
};
