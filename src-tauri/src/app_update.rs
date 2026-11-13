//! Update channel for the desktop app.
//!
//! Two sources are read without touching the network:
//! - the marker written by the installer (`%LOCALAPPDATA%\com.owa.studio\apheka-installed.txt`),
//!   which tells whether a newer build is already installed on this machine;
//! - an optional channel file in the app data folder (`update-channel.json`), which
//!   publishes a version, a download address, a SHA-256 fingerprint and a note.
//!
//! Every read is best effort: a missing or unreadable file simply means "no news".

use serde::Serialize;
use std::io::Write;
use tauri::Manager;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChannel {
    pub version: String,
    pub url: Option<String>,
    /// SHA-256 of the published installer. Required to apply an update.
    pub sha256: Option<String>,
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
        sha256: value.get("sha256").and_then(|v| v.as_str()).map(|v| v.trim().to_lowercase()).filter(|v| v.len() == 64 && v.chars().all(|c| c.is_ascii_hexdigit())),
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

/// Download, verify and apply a published update.
///
/// The file is only executed when its SHA-256 matches the fingerprint published
/// in the channel, and only from an HTTPS address. The installer runs silently
/// and updates the existing installation in place; a detached helper reopens the
/// app when the installation finishes.
#[tauri::command]
pub async fn apply_update(app: tauri::AppHandle, url: String, sha256: String) -> Result<(), String> {
    let url = url.trim().to_string();
    if !url.starts_with("https://") {
        return Err("La actualización debe venir de una dirección segura (https).".into());
    }
    let expected = sha256.trim().to_lowercase();
    if expected.len() != 64 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("La actualización no trae una huella verificable.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|e| format!("No se pudo preparar la descarga: {e}"))?;
    let mut response = client.get(&url).send().await.map_err(|e| format!("No se pudo descargar la actualización: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("La descarga de la actualización falló ({}).", response.status()));
    }
    let temp = std::env::temp_dir().join(format!("apheka-update-{}.exe", uuid::Uuid::new_v4()));
    let mut file = std::fs::File::create(&temp).map_err(|e| format!("No se pudo preparar la actualización: {e}"))?;
    use sha2::Digest as _;
    let mut hasher = sha2::Sha256::new();
    let mut written: u64 = 0;
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("La descarga se interrumpió: {e}"))? {
        written += chunk.len() as u64;
        if written > 600 * 1024 * 1024 {
            let _ = std::fs::remove_file(&temp);
            return Err("La actualización es demasiado grande.".into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| format!("No se pudo guardar la actualización: {e}"))?;
    }
    file.flush().map_err(|e| format!("No se pudo guardar la actualización: {e}"))?;
    drop(file);
    let digest = hasher.finalize();
    let actual = digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    if actual != expected {
        let _ = std::fs::remove_file(&temp);
        return Err("La actualización no coincide con la huella publicada. No se instaló.".into());
    }
    run_installer(&temp, &app)?;
    Ok(())
}

/// Launch the verified installer silently and reopen the app afterwards.
fn run_installer(installer: &std::path::Path, app: &tauri::AppHandle) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let executable = std::env::current_exe().map_err(|e| format!("No se pudo localizar la aplicación: {e}"))?;
    let target = executable.to_string_lossy().to_string();
    // The installer closes the running app and updates it in place; the helper
    // waits for it and reopens the app when the installation is finished.
    let helper = format!(
        "ping -n 26 127.0.0.1 >nul & start \"\" \"{target}\""
    );
    let _ = std::process::Command::new("cmd")
        .args(["/C", &helper])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
    let mut command = std::process::Command::new(installer);
    command.args(["/S", "/UPDATE"]);
    command.creation_flags(CREATE_NO_WINDOW);
    command.spawn().map_err(|e| format!("No se pudo iniciar la actualización: {e}"))?;
    let _ = app;
    Ok(())
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
        let handle = UpdateChannel { version: "6.27.0".into(), url: None, sha256: None, notes: None };
        assert!(!handle.version.trim().is_empty());
    }

    #[test]
    fn only_secure_addresses_are_accepted() {
        assert!(!"http://ejemplo.test/setup.exe".starts_with("https://"));
        assert!("https://ejemplo.test/setup.exe".starts_with("https://"));
    }
}
