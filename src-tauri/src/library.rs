use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use lofty::file::AudioFile;
use lofty::file::TaggedFileExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SongMeta {
    pub id: u32,
    pub filename: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u32,
    pub format: String,
    #[serde(default)]
    pub has_lyrics: bool,
    #[serde(default)]
    pub has_cover: bool,
    #[serde(default)]
    pub play_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryMeta {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub song_ids: Vec<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryIndex {
    pub songs: Vec<SongMeta>,
    #[serde(default)]
    pub categories: Vec<CategoryMeta>,
    #[serde(default)]
    pub favorites: Vec<u32>,
    #[serde(default)]
    pub recent_plays: Vec<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub total: u32,
    pub lyrics: u32,
    pub no_lyrics: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryData {
    pub songs: Vec<SongMeta>,
    pub categories: Vec<CategoryMeta>,
    pub favorites: Vec<u32>,
    pub recent_plays: Vec<u32>,
}

pub struct Library {
    pub base_path: PathBuf,
}

impl Library {
    pub fn with_base_path(path: PathBuf) -> Self {
        Self { base_path: path }
    }

    pub fn songs_dir(&self) -> PathBuf {
        self.base_path.join("songs")
    }

    pub fn lyrics_dir(&self) -> PathBuf {
        self.base_path.join("lyrics")
    }

    pub fn covers_dir(&self) -> PathBuf {
        self.base_path.join("covers")
    }

    pub fn metadata_path(&self) -> PathBuf {
        self.base_path.join("metadata.json")
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        fs::create_dir_all(self.songs_dir())?;
        fs::create_dir_all(self.lyrics_dir())?;
        fs::create_dir_all(self.covers_dir())?;
        Ok(())
    }

    pub fn load_index(&self) -> LibraryIndex {
        let path = self.metadata_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(index) = serde_json::from_str(&content) {
                    return index;
                }
            }
        }
        LibraryIndex {
            songs: Vec::new(),
            categories: Vec::new(),
            favorites: Vec::new(),
            recent_plays: Vec::new(),
        }
    }

    pub fn save_index(&self, index: &LibraryIndex) -> std::io::Result<()> {
        let content = serde_json::to_string_pretty(index)?;
        fs::write(self.metadata_path(), content)?;
        Ok(())
    }

    pub fn get_library_data(&self) -> LibraryData {
        let index = self.load_index();
        LibraryData {
            songs: index.songs,
            categories: index.categories,
            favorites: index.favorites,
            recent_plays: index.recent_plays,
        }
    }

    pub fn has_lyrics(&self, song_filename: &str) -> bool {
        let stem = PathBuf::from(song_filename)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let lrc_path = self.lyrics_dir().join(format!("{}.lrc", stem));
        lrc_path.exists()
    }

    fn import_lyrics_from_source(&self, src: &Path, stem: &str) -> bool {
        let parent = src.parent().unwrap_or(Path::new(""));
        let candidates = [
            format!("{}.lrc", stem),
            format!("{}-歌词.lrc", stem),
            format!("{}歌词.lrc", stem),
            format!("{}.lrc", stem.replace("-", " ")),
        ];
        for lrc_name in &candidates {
            let lrc_path = parent.join(lrc_name);
            if lrc_path.exists() {
                if let Ok(content) = fs::read_to_string(&lrc_path) {
                    let dest = self.lyrics_dir().join(format!("{}.lrc", stem));
                    let _ = fs::write(&dest, &content);
                    return true;
                }
            }
        }
        false
    }

    fn import_cover_from_source(&self, src: &Path, stem: &str, song_id: u32) -> bool {
        let parent = src.parent().unwrap_or(Path::new(""));
        let candidates = [
            format!("{}.jpg", stem),
            format!("{}.jpeg", stem),
            format!("{}.png", stem),
            format!("{}-cover.jpg", stem),
            format!("{}-cover.png", stem),
            format!("{}封面.jpg", stem),
            format!("{}封面.png", stem),
            "cover.jpg".to_string(),
            "cover.png".to_string(),
        ];
        for name in &candidates {
            let img_path = parent.join(name);
            if !img_path.exists() { continue; }
            let ext = match img_path.extension().and_then(|e| e.to_str()) {
                Some("jpg") | Some("jpeg") => "jpg",
                Some("png") => "png",
                _ => continue,
            };
            let dest = self.covers_dir().join(format!("{}.{}", song_id, ext));
            if fs::copy(&img_path, &dest).is_ok() {
                return true;
            }
        }
        false
    }

    pub fn read_lyrics(&self, song_filename: &str) -> Option<String> {
        let stem = PathBuf::from(song_filename)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let lrc_path = self.lyrics_dir().join(format!("{}.lrc", stem));
        if lrc_path.exists() {
            fs::read_to_string(lrc_path).ok()
        } else {
            None
        }
    }

    pub fn import_song(&self, source: &str) -> std::io::Result<SongMeta> {
        self.ensure_dirs()?;
        let src = PathBuf::from(source);
        let filename = src.file_name().unwrap_or_default().to_string_lossy().to_string();
        let dest = self.songs_dir().join(&filename);

        fs::copy(&src, &dest)?;

        let format = src.extension()
            .map(|e| e.to_string_lossy().to_uppercase().to_string())
            .unwrap_or_else(|| "UNKNOWN".to_string());

        let stem = src.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let has_lrc = self.import_lyrics_from_source(&src, &stem);

        let mut index = self.load_index();
        let new_id = index.songs.iter().map(|s| s.id).max().unwrap_or(9999) + 1;

        let mut has_cover = extract_cover(&src, &self.covers_dir(), new_id);
        if !has_cover {
            has_cover = self.import_cover_from_source(&src, &stem, new_id);
        }

        let duration = get_audio_duration(&src).unwrap_or(0);

        let meta = SongMeta {
            id: new_id,
            filename: filename.clone(),
            title: stem.clone(),
            artist: "未知艺术家".to_string(),
            album: "-".to_string(),
            duration,
            format,
            has_lyrics: has_lrc,
            has_cover,
            play_count: 0,
        };

        index.songs.push(meta.clone());
        self.save_index(&index)?;

        Ok(meta)
    }

    pub fn import_folder(&self, folder: &str) -> std::io::Result<ImportResult> {
        self.ensure_dirs()?;
        let dir = PathBuf::from(folder);
        let mut total = 0u32;
        let mut lyrics = 0u32;
        let mut no_lyrics = 0u32;

        if dir.is_dir() {
            for entry in fs::read_dir(&dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        match ext.to_str().unwrap_or("").to_lowercase().as_str() {
                            "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" => {
                                if let Ok(_meta) = self.import_song(path.to_str().unwrap_or("")) {
                                    total += 1;
                                    let filename = path.file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string();
                                    if self.has_lyrics(&filename) {
                                        lyrics += 1;
                                    } else {
                                        no_lyrics += 1;
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        Ok(ImportResult { total, lyrics, no_lyrics })
    }

    pub fn delete_song(&self, song_id: u32) -> std::io::Result<()> {
        let mut index = self.load_index();
        let pos = index.songs.iter().position(|s| s.id == song_id);
        if let Some(idx) = pos {
            let song = &index.songs[idx];
            let song_path = self.songs_dir().join(&song.filename);
            let _ = fs::remove_file(&song_path);
            let stem = PathBuf::from(&song.filename)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let lrc_path = self.lyrics_dir().join(format!("{}.lrc", stem));
            let _ = fs::remove_file(&lrc_path);
            let cover_path = self.covers_dir().join(format!("{}.jpg", song.id));
            let _ = fs::remove_file(&cover_path);
            let cover_png = self.covers_dir().join(format!("{}.png", song.id));
            let _ = fs::remove_file(&cover_png);
            index.songs.remove(idx);
            index.favorites.retain(|&id| id != song_id);
            index.recent_plays.retain(|&id| id != song_id);
            for cat in index.categories.iter_mut() {
                cat.song_ids.retain(|&id| id != song_id);
            }
            self.save_index(&index)?;
        }
        Ok(())
    }

    pub fn get_audio_url(&self, song_id: u32) -> Option<String> {
        let index = self.load_index();
        let song = index.songs.iter().find(|s| s.id == song_id)?;
        let path = self.songs_dir().join(&song.filename);
        if path.exists() {
            Some(path.to_string_lossy().to_string())
        } else {
            None
        }
    }

    pub fn get_cover_path(&self, song_id: u32) -> Option<String> {
        let jpg = self.covers_dir().join(format!("{}.jpg", song_id));
        if jpg.exists() {
            return Some(jpg.to_string_lossy().to_string());
        }
        let png = self.covers_dir().join(format!("{}.png", song_id));
        if png.exists() {
            return Some(png.to_string_lossy().to_string());
        }
        None
    }

    pub fn create_category(&self, name: String, icon: String) -> std::io::Result<CategoryMeta> {
        let mut index = self.load_index();
        let id = format!("cat_{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis());
        let cat = CategoryMeta {
            id,
            name,
            icon,
            song_ids: Vec::new(),
        };
        index.categories.push(cat.clone());
        self.save_index(&index)?;
        Ok(cat)
    }

    pub fn delete_category(&self, category_id: String) -> std::io::Result<()> {
        let mut index = self.load_index();
        index.categories.retain(|c| c.id != category_id);
        self.save_index(&index)?;
        Ok(())
    }

    pub fn rename_category(&self, category_id: String, name: String) -> std::io::Result<()> {
        let mut index = self.load_index();
        if let Some(cat) = index.categories.iter_mut().find(|c| c.id == category_id) {
            cat.name = name;
        }
        self.save_index(&index)?;
        Ok(())
    }

    pub fn add_to_category(&self, category_id: String, song_id: u32) -> std::io::Result<()> {
        let mut index = self.load_index();
        if let Some(cat) = index.categories.iter_mut().find(|c| c.id == category_id) {
            if !cat.song_ids.contains(&song_id) {
                cat.song_ids.push(song_id);
            }
        }
        self.save_index(&index)?;
        Ok(())
    }

    pub fn remove_from_category(&self, category_id: String, song_id: u32) -> std::io::Result<()> {
        let mut index = self.load_index();
        if let Some(cat) = index.categories.iter_mut().find(|c| c.id == category_id) {
            cat.song_ids.retain(|&id| id != song_id);
        }
        self.save_index(&index)?;
        Ok(())
    }

    pub fn toggle_favorite(&self, song_id: u32) -> std::io::Result<bool> {
        let mut index = self.load_index();
        let is_fav = if let Some(pos) = index.favorites.iter().position(|&id| id == song_id) {
            index.favorites.remove(pos);
            false
        } else {
            index.favorites.push(song_id);
            true
        };
        self.save_index(&index)?;
        Ok(is_fav)
    }

    pub fn record_play(&self, song_id: u32) -> std::io::Result<()> {
        let mut index = self.load_index();
        index.recent_plays.retain(|&id| id != song_id);
        index.recent_plays.push(song_id);
        if index.recent_plays.len() > 100 {
            index.recent_plays.remove(0);
        }
        if let Some(song) = index.songs.iter_mut().find(|s| s.id == song_id) {
            song.play_count += 1;
        }
        self.save_index(&index)?;
        Ok(())
    }

    pub fn import_lyrics(&self, song_id: u32, lrc_content: String) -> std::io::Result<()> {
        let mut index = self.load_index();
        if let Some(song) = index.songs.iter_mut().find(|s| s.id == song_id) {
            let stem = PathBuf::from(&song.filename)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let lrc_path = self.lyrics_dir().join(format!("{}.lrc", stem));
            fs::write(&lrc_path, &lrc_content)?;
            song.has_lyrics = true;
            self.save_index(&index)?;
        }
        Ok(())
    }

    pub fn import_cover(&self, song_id: u32, image_path: &str) -> std::io::Result<()> {
        let src = Path::new(image_path);
        let ext = match src.extension().and_then(|e| e.to_str()) {
            Some("jpg") | Some("jpeg") => "jpg",
            Some("png") => "png",
            _ => return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Unsupported image format")),
        };
        let dest = self.covers_dir().join(format!("{}.{}", song_id, ext));
        fs::copy(src, &dest)?;
        let mut index = self.load_index();
        if let Some(song) = index.songs.iter_mut().find(|s| s.id == song_id) {
            song.has_cover = true;
            self.save_index(&index)?;
        }
        Ok(())
    }

    pub fn set_background_image(&self, source: &str) -> std::io::Result<String> {
        let src = Path::new(source);
        let ext = src.extension().unwrap_or_default();
        if ext.is_empty() {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "File has no extension"));
        }
        let dest = self.base_path.join(format!("background.{}", ext.to_string_lossy()));
        // Remove old background files with other extensions
        for entry in fs::read_dir(&self.base_path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("background.") && entry.path() != dest {
                let _ = fs::remove_file(entry.path());
            }
        }
        fs::copy(src, &dest)?;
        Ok(dest.to_string_lossy().to_string())
    }

    pub fn clear_background_image(&self) -> std::io::Result<()> {
        for entry in fs::read_dir(&self.base_path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("background.") {
                fs::remove_file(entry.path())?;
            }
        }
        Ok(())
    }
}

fn extract_cover(path: &Path, covers_dir: &Path, song_id: u32) -> bool {
    let file = match lofty::read_from_path(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    for tag in file.tags() {
        for pic in tag.pictures() {
            let ext = match pic.mime_type().and_then(|m| m.ext()) {
                Some(e) => e,
                None => continue,
            };
            let dest = covers_dir.join(format!("{}.{}", song_id, ext));
            if fs::write(&dest, pic.data()).is_ok() {
                return true;
            }
        }
    }
    false
}

fn get_audio_duration(path: &Path) -> Option<u32> {
    let file = lofty::read_from_path(path).ok()?;
    let dur = file.properties().duration();
    if dur.is_zero() { None } else { Some(dur.as_secs() as u32) }
}
