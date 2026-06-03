mod library;
mod config;
mod migration;

use library::{Library, ImportResult, SongMeta, CategoryMeta, LibraryData};
use std::sync::Mutex;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::path::PathBuf;
use std::fs;
use tauri_plugin_notification::NotificationExt;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};

#[cfg(target_os = "windows")]
fn set_window_corner_preference(app: &tauri::AppHandle, value: u32) {
    use raw_window_handle::HasWindowHandle;
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(handle) = window.window_handle() {
            let raw = handle.as_raw();
            if let raw_window_handle::RawWindowHandle::Win32(win32) = raw {
                let hwnd = win32.hwnd.get() as isize;
                const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
                unsafe {
                    #[link(name = "dwmapi")]
                    extern "system" {
                        fn DwmSetWindowAttribute(
                            hwnd: isize, attr: u32,
                            pv: *const std::ffi::c_void, cb: u32,
                        ) -> i32;
                    }
                    DwmSetWindowAttribute(
                        hwnd, DWMWA_WINDOW_CORNER_PREFERENCE,
                        &value as *const _ as *const _,
                        std::mem::size_of::<u32>() as u32,
                    );
                }
            }
        }
    }
}

#[tauri::command]
fn set_window_corner(app: tauri::AppHandle, value: u32) {
    #[cfg(target_os = "windows")]
    set_window_corner_preference(&app, value);
}

struct AppState {
    library: Mutex<Library>,
    app_data_dir: PathBuf,
}

fn check_not_migrating() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn scan_library(state: State<AppState>) -> Result<Vec<SongMeta>, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.ensure_dirs().map_err(|e| e.to_string())?;
    let index = lib.load_index();
    Ok(index.songs)
}

#[tauri::command]
fn import_song(state: State<AppState>, path: String) -> Result<SongMeta, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.import_song(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_folder(state: State<AppState>, path: String) -> Result<ImportResult, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.import_folder(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_song(state: State<AppState>, song_id: u64) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.delete_song(song_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(_state: State<AppState>, path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_song_path(state: State<AppState>, song_id: u64) -> Result<String, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.get_audio_url(song_id).ok_or_else(|| "Song not found".to_string())
}

#[tauri::command]
fn get_cover_path(state: State<AppState>, song_id: u64) -> Result<String, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.get_cover_path(song_id).ok_or_else(|| "No cover".to_string())
}

#[tauri::command]
fn get_lyrics(state: State<AppState>, song_id: u64) -> Result<String, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    let index = lib.load_index();
    let song = index.songs.iter().find(|s| s.id == song_id)
        .ok_or_else(|| "Song not found".to_string())?;
    lib.read_lyrics(&song.filename).ok_or_else(|| "No lyrics found".to_string())
}

#[tauri::command]
fn get_library_data(state: State<AppState>) -> Result<LibraryData, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    Ok(lib.get_library_data())
}

#[tauri::command]
fn create_category(state: State<AppState>, name: String, icon: String) -> Result<CategoryMeta, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.create_category(name, icon).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_category(state: State<AppState>, category_id: String) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.delete_category(category_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_category(state: State<AppState>, category_id: String, name: String) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.rename_category(category_id, name).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_category(state: State<AppState>, category_id: String, song_id: u64) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.add_to_category(category_id, song_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_from_category(state: State<AppState>, category_id: String, song_id: u64) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.remove_from_category(category_id, song_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(state: State<AppState>, song_id: u64) -> Result<bool, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.toggle_favorite(song_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn record_play(state: State<AppState>, song_id: u64) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.record_play(song_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_lyrics(state: State<AppState>, song_id: u64, lrc_content: String) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.import_lyrics(song_id, lrc_content).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_cover(state: State<AppState>, song_id: u64, image_path: String) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.import_cover(song_id, &image_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_background_image(state: State<AppState>, source_path: String) -> Result<String, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.set_background_image(&source_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_background_image(state: State<AppState>) -> Result<(), String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    lib.clear_background_image().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<config::AppConfig, String> {
    let dir = state.app_data_dir.clone();
    Ok(config::load_config(&dir))
}

#[tauri::command]
fn get_library_path(state: State<AppState>) -> Result<String, String> {
    let lib = state.library.lock().map_err(|e| e.to_string())?;
    Ok(lib.base_path.to_string_lossy().to_string())
}

#[tauri::command]
fn start_migration(
    app: tauri::AppHandle,
    state: State<AppState>,
    new_path: String,
) -> Result<(), String> {
    let app_data_dir = state.app_data_dir.clone();
    let old_base = {
        let lib = state.library.lock().map_err(|e| e.to_string())?;
        lib.base_path.clone()
    };
    let new_base = PathBuf::from(&new_path);
    let cancel = Arc::new(AtomicBool::new(false));

    migration::start_migration(app.clone(), app_data_dir, old_base, new_base, cancel);

    Ok(())
}

#[tauri::command]
fn cancel_migration() -> Result<(), String> {
    Err("取消功能暂未实现".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            scan_library,
            import_song,
            import_folder,
            delete_song,
            read_text_file,
            get_song_path,
            get_cover_path,
            get_lyrics,
            get_library_data,
            create_category,
            delete_category,
            rename_category,
            add_to_category,
            remove_from_category,
            toggle_favorite,
            record_play,
            import_lyrics,
            import_cover,
            set_background_image,
            clear_background_image,
            set_window_corner,
            get_config,
            get_library_path,
            start_migration,
            cancel_migration,
        ])
        .setup(|app| {
            // Initialize library with Tauri app data dir so asset protocol scope matches
            let app_data = app.path().app_data_dir().expect("failed to get app data dir");
            fs::create_dir_all(&app_data).ok();

            let config = config::load_config(&app_data);
            let lib_path = PathBuf::from(&config.library_path);
            let library = Library::with_base_path(lib_path.clone());
            library.ensure_dirs().expect("failed to create library dirs");

            if !config::config_exists(&app_data) {
                let _ = config::save_config(&app_data, &config);
            }

            app.manage(AppState {
                library: Mutex::new(library),
                app_data_dir: app_data.clone(),
            });
            let _ = app.notification().request_permission();

            #[cfg(target_os = "windows")]
            set_window_corner_preference(&app.app_handle(), 3);

            let show_item = MenuItemBuilder::with_id("show_window", "显示主窗口")
                .build(app)?;
            let play_pause_item = MenuItemBuilder::with_id("play_pause", "播放/暂停")
                .build(app)?;
            let next_item = MenuItemBuilder::with_id("next", "下一首")
                .build(app)?;
            let prev_item = MenuItemBuilder::with_id("prev", "上一首")
                .build(app)?;
            let toggle_visualizer_item = MenuItemBuilder::with_id("toggle_visualizer", "切换可视化")
                .build(app)?;
            let toggle_playmode_item = MenuItemBuilder::with_id("toggle_playmode", "切换播放模式")
                .build(app)?;
            let toggle_lyrics_item = MenuItemBuilder::with_id("toggle_lyrics", "显示歌词")
                .build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出")
                .build(app)?;

            let play_submenu = SubmenuBuilder::new(app, "播放")
                .item(&play_pause_item)
                .item(&next_item)
                .item(&prev_item)
                .build()?;

            let settings_submenu = SubmenuBuilder::new(app, "设置")
                .item(&toggle_visualizer_item)
                .item(&toggle_playmode_item)
                .build()?;

            let lyrics_submenu = SubmenuBuilder::new(app, "歌词")
                .item(&toggle_lyrics_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&play_submenu)
                .item(&settings_submenu)
                .item(&lyrics_submenu)
                .separator()
                .item(&quit_item)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show_window" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "play_pause" => {
                            let _ = app.emit("tray-play-pause", ());
                        }
                        "next" => {
                            let _ = app.emit("tray-next", ());
                        }
                        "prev" => {
                            let _ = app.emit("tray-prev", ());
                        }
                        "toggle_visualizer" => {
                            let _ = app.emit("tray-toggle-visualizer", ());
                        }
                        "toggle_playmode" => {
                            let _ = app.emit("tray-toggle-playmode", ());
                        }
                        "toggle_lyrics" => {
                            let _ = app.emit("tray-toggle-lyrics", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.emit("save-state", ());
                std::thread::sleep(std::time::Duration::from_millis(50));
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
