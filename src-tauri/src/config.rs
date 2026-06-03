use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub library_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            library_path: String::new(),
        }
    }
}

pub fn get_config_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("config.json")
}

pub fn config_exists(app_data_dir: &PathBuf) -> bool {
    get_config_path(app_data_dir).exists()
}

pub fn load_config(app_data_dir: &PathBuf) -> AppConfig {
    let config_path = get_config_path(app_data_dir);
    if config_path.exists() {
        match std::fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_json::from_str::<AppConfig>(&content) {
                    Ok(config) => {
                        if config.library_path.is_empty() {
                            eprintln!("WARNING: config.json has empty library_path, using default");
                            AppConfig {
                                library_path: get_default_library_path(app_data_dir),
                            }
                        } else if !std::path::Path::new(&config.library_path).exists() {
                            eprintln!("WARNING: config.json library_path does not exist on disk, using default");
                            AppConfig {
                                library_path: get_default_library_path(app_data_dir),
                            }
                        } else {
                            config
                        }
                    }
                    Err(e) => {
                        eprintln!("WARNING: config.json is corrupted ({}), using default", e);
                        AppConfig {
                            library_path: get_default_library_path(app_data_dir),
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("WARNING: failed to read config.json ({}), using default", e);
                AppConfig {
                    library_path: get_default_library_path(app_data_dir),
                }
            }
        }
    } else {
        AppConfig {
            library_path: get_default_library_path(app_data_dir),
        }
    }
}

pub fn get_default_library_path(app_data_dir: &PathBuf) -> String {
    let path = app_data_dir.join("library");
    path.to_string_lossy().to_string()
}

pub fn save_config(app_data_dir: &PathBuf, config: &AppConfig) -> std::io::Result<()> {
    let config_path = get_config_path(app_data_dir);
    let content = serde_json::to_string_pretty(config)?;
    std::fs::write(config_path, content)
}
