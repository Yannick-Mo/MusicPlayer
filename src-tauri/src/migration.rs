use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, serde::Serialize)]
pub struct MigrationProgress {
    pub phase: String,
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub error: Option<String>,
}

fn emit_progress(app_handle: &AppHandle, progress: &MigrationProgress) {
    let _ = app_handle.emit("migration-progress", progress);
}

fn count_files(dir: &Path) -> u64 {
    if !dir.is_dir() {
        return 0;
    }
    match std::fs::read_dir(dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .count() as u64,
        Err(_) => 0,
    }
}

fn count_total(old_base: &Path) -> u64 {
    let mut total = 0u64;
    if old_base.join("metadata.json").exists() {
        total += 1;
    }
    if old_base.join("metadata.json.bak").exists() {
        total += 1;
    }
    total += count_files(&old_base.join("songs"));
    total += count_files(&old_base.join("lyrics"));
    total += count_files(&old_base.join("covers"));
    if old_base.is_dir() {
        if let Ok(entries) = std::fs::read_dir(old_base) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("background.") && entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    total += 1;
                }
            }
        }
    }
    total
}

fn cancel_or_err(app_handle: &AppHandle, result: Result<(), &str>, current: u64, total: u64) -> bool {
    match result {
        Err("cancelled") => {
            emit_progress(app_handle, &MigrationProgress {
                phase: "cancelled".to_string(), current, total,
                current_file: String::new(), error: None,
            });
            true
        }
        Err(msg) => {
            emit_progress(app_handle, &MigrationProgress {
                phase: "error".to_string(), current, total,
                current_file: String::new(), error: Some(msg.to_string()),
            });
            true
        }
        Ok(()) => false,
    }
}

fn copy_file_with_progress(
    app_handle: &AppHandle,
    src: &Path,
    dst: &Path,
    current: &mut u64,
    total: u64,
    cancel: &AtomicBool,
) -> Result<(), &'static str> {
    if cancel.load(Ordering::SeqCst) {
        return Err("cancelled");
    }

    *current += 1;
    let filename = src.file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    emit_progress(app_handle, &MigrationProgress {
        phase: "copying".to_string(),
        current: *current,
        total,
        current_file: filename,
        error: None,
    });

    std::fs::copy(src, dst).map_err(|_| "文件复制失败")?;
    Ok(())
}

fn copy_dir(
    app_handle: &AppHandle,
    src_dir: &Path,
    dst_dir: &Path,
    current: &mut u64,
    total: u64,
    cancel: &AtomicBool,
) -> Result<(), &'static str> {
    if !src_dir.is_dir() {
        return Ok(());
    }

    std::fs::create_dir_all(dst_dir).map_err(|_| "无法创建目标目录")?;

    let entries: Vec<_> = match std::fs::read_dir(src_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
            .collect(),
        Err(_) => return Ok(()),
    };

    for entry in entries {
        let src = entry.path();
        let filename = entry.file_name();
        let dst = dst_dir.join(&filename);
        copy_file_with_progress(app_handle, &src, &dst, current, total, cancel)?;
    }

    Ok(())
}

pub fn start_migration(
    app_handle: AppHandle,
    app_data_dir: PathBuf,
    old_base: PathBuf,
    new_base: PathBuf,
    cancel: Arc<AtomicBool>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        // --- Validation ---
        if !old_base.is_dir() {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "error".to_string(),
                current: 0,
                total: 0,
                current_file: String::new(),
                error: Some("旧路径不存在".to_string()),
            });
            return;
        }

        if new_base == old_base {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "error".to_string(),
                current: 0,
                total: 0,
                current_file: String::new(),
                error: Some("新路径与旧路径相同".to_string()),
            });
            return;
        }

        if new_base.join("metadata.json").exists() {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "error".to_string(),
                current: 0,
                total: 0,
                current_file: String::new(),
                error: Some("目标路径已包含音乐库".to_string()),
            });
            return;
        }

        match std::fs::create_dir_all(&new_base) {
            Ok(_) => {
                let test_path = new_base.join(".migrate_test");
                match std::fs::write(&test_path, b"test") {
                    Ok(_) => {
                        let _ = std::fs::remove_file(&test_path);
                    }
                    Err(e) => {
                        emit_progress(&app_handle, &MigrationProgress {
                            phase: "error".to_string(),
                            current: 0,
                            total: 0,
                            current_file: String::new(),
                            error: Some(format!("无法写入目标路径: {}", e)),
                        });
                        return;
                    }
                }
            }
            Err(e) => {
                emit_progress(&app_handle, &MigrationProgress {
                    phase: "error".to_string(),
                    current: 0,
                    total: 0,
                    current_file: String::new(),
                    error: Some(format!("无法创建目标路径: {}", e)),
                });
                return;
            }
        }

        if cancel.load(Ordering::SeqCst) {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "cancelled".to_string(),
                current: 0,
                total: 0,
                current_file: String::new(),
                error: None,
            });
            return;
        }

        // --- Counting phase ---
        let total = count_total(&old_base);
        emit_progress(&app_handle, &MigrationProgress {
            phase: "counting".to_string(),
            current: 0,
            total,
            current_file: String::new(),
            error: None,
        });

        if cancel.load(Ordering::SeqCst) {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "cancelled".to_string(),
                current: 0,
                total,
                current_file: String::new(),
                error: None,
            });
            return;
        }

        // --- Copying phase ---
        let mut current = 0u64;

        let _ = std::fs::create_dir_all(new_base.join("songs"));
        let _ = std::fs::create_dir_all(new_base.join("lyrics"));
        let _ = std::fs::create_dir_all(new_base.join("covers"));

        // Copy metadata.json atomically
        let metadata_src = old_base.join("metadata.json");
        if metadata_src.exists() {
            current += 1;
            emit_progress(&app_handle, &MigrationProgress {
                phase: "copying".to_string(),
                current,
                total,
                current_file: "metadata.json".to_string(),
                error: None,
            });
            let metadata_dst = new_base.join("metadata.json");
            let tmp_path = new_base.join("metadata.json.tmp");
            match std::fs::read_to_string(&metadata_src) {
                Ok(content) => {
                    if let Err(e) = std::fs::write(&tmp_path, &content)
                        .and_then(|_| std::fs::rename(&tmp_path, &metadata_dst))
                    {
                        emit_progress(&app_handle, &MigrationProgress {
                            phase: "error".to_string(),
                            current,
                            total,
                            current_file: "metadata.json".to_string(),
                            error: Some(format!("复制 metadata.json 失败: {}", e)),
                        });
                        return;
                    }
                }
                Err(e) => {
                    emit_progress(&app_handle, &MigrationProgress {
                        phase: "error".to_string(),
                        current,
                        total,
                        current_file: "metadata.json".to_string(),
                        error: Some(format!("读取 metadata.json 失败: {}", e)),
                    });
                    return;
                }
            }
        }

        if cancel.load(Ordering::SeqCst) {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "cancelled".to_string(),
                current,
                total,
                current_file: String::new(),
                error: None,
            });
            return;
        }

        // Copy metadata.json.bak
        let bak_src = old_base.join("metadata.json.bak");
        if bak_src.exists() && cancel_or_err(&app_handle,
            copy_file_with_progress(&app_handle, &bak_src, &new_base.join("metadata.json.bak"), &mut current, total, &cancel),
            current, total,
        ) { return; }

        // Copy songs dir
        if cancel_or_err(&app_handle,
            copy_dir(&app_handle, &old_base.join("songs"), &new_base.join("songs"), &mut current, total, &cancel),
            current, total,
        ) { return; }

        // Copy lyrics dir
        if cancel_or_err(&app_handle,
            copy_dir(&app_handle, &old_base.join("lyrics"), &new_base.join("lyrics"), &mut current, total, &cancel),
            current, total,
        ) { return; }

        // Copy covers dir
        if cancel_or_err(&app_handle,
            copy_dir(&app_handle, &old_base.join("covers"), &new_base.join("covers"), &mut current, total, &cancel),
            current, total,
        ) { return; }

        // Copy background.* files from old_base root
        if let Ok(entries) = std::fs::read_dir(&old_base) {
            for entry in entries.flatten() {
                if cancel.load(Ordering::SeqCst) {
                    emit_progress(&app_handle, &MigrationProgress {
                        phase: "cancelled".to_string(),
                        current,
                        total,
                        current_file: String::new(),
                        error: None,
                    });
                    return;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("background.") && entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    let src = entry.path();
                    let dst = new_base.join(&name);
                    current += 1;
                    emit_progress(&app_handle, &MigrationProgress {
                        phase: "copying".to_string(),
                        current,
                        total,
                        current_file: name.clone(),
                        error: None,
                    });
                    if let Err(e) = std::fs::copy(&src, &dst) {
                        emit_progress(&app_handle, &MigrationProgress {
                            phase: "error".to_string(),
                            current,
                            total,
                            current_file: name,
                            error: Some(format!("复制背景文件失败: {}", e)),
                        });
                        return;
                    }
                }
            }
        }

        // --- Completion ---
        let config = crate::config::AppConfig {
            library_path: new_base.to_string_lossy().to_string(),
        };
        if let Err(e) = crate::config::save_config(&app_data_dir, &config) {
            emit_progress(&app_handle, &MigrationProgress {
                phase: "error".to_string(),
                current,
                total,
                current_file: String::new(),
                error: Some(format!("保存配置失败: {}", e)),
            });
            return;
        }

        emit_progress(&app_handle, &MigrationProgress {
            phase: "completed".to_string(),
            current: total,
            total,
            current_file: String::new(),
            error: None,
        });
    })
}
