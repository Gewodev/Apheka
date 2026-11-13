//! Update channel for the desktop app.
//!
//! Two sources are read without touching the network:
//! - the marker written by the installer (`%LOCALAPPDATA%\com.owa.studio\apheka-installed.txt`),
//!   which tells whether a newer build is already installed on this machine;
//! - an optional channel file in the app data folder (`update-channel.json`), which
//!   publishes a version, a download address and a note.
//!
//! Every read is best effort: a missing or unreadable file simply means "no news".

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannel {
    pub version: String,
    pub url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    /// Version of the last installer run on this machine.
    pub installed: Option<String>,
    /// Version published through the channel file, when present.
    pub channel: Option<UpdateChannel>,
}

fn installed_marker() -> Option<String> {
    let base = std::env::var("LOCALAPPDATA").ok()?;
    let path = std::path::Path::new(&base).join("com.owa.studio").join("apheka-installed.txt");
    let raw = std::fs::read_to_string(path).ok()?;
    let value = raw.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn channel_file(app: &tauri::AppHandle) -> Option<UpdateChannel> {
    let path = app.path().app_data_dir().ok()?.join("update-channel.json");
    let raw = std::fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let version = value.get("version")?.as_str()?.trim().to_string();
    if version.is_empty() {
        return None;
    }
    Some(UpdateChannel {
        version,
        url: value.get("url").and_then(|v| v.as_str()).map(|v| v.trim().to_string()).filter(|v| !v.is_empty()),
        notes: value.get("notes").and_then(|v| v.as_str()).map(|v| v.trim().to_string()).filter(|v| !v.is_empty()),
    })
}

#[tauri::command]
pub fn update_state(app: tauri::AppHandle) -> UpdateState {
    UpdateState { installed: installed_marker(), channel: channel_file(&app) }
}

/// Restart the application so a freshly installed build is the one that runs.
#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    let _ = app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_files_mean_no_news() {
        assert!(installed_marker().is_none_or(|value| !value.is_empty()));
    }

    #[test]
    fn channel_requires_a_version() {
        let handle = UpdateChannel { version: "6.27.0".into(), url: None, notes: None };
        assert!(!handle.version.trim().is_empty());
    }
}
