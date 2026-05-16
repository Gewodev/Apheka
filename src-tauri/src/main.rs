#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::BufRead;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager};
use tauri_plugin_shell::ShellExt;

struct DownloadState {
    active: Mutex<HashMap<String, std::process::Child>>,
    path: Mutex<String>,
}

fn resolve_binary(app: &tauri::AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
    let triple = "x86_64-pc-windows-msvc";
    let candidates = [
        // In dev mode, CARGO_MANIFEST_DIR points to src-tauri/
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin"),
        // In production, resource_dir is the app bundle dir
        app.path().resource_dir().ok().map(|r| r.join("bin")).unwrap_or_default(),
    ];
    for dir in &candidates {
        let with_triple = dir.join(format!("{name}-{triple}.exe"));
        if with_triple.exists() {
            return Ok(with_triple);
        }
        let without_triple = dir.join(format!("{name}.exe"));
        if without_triple.exists() {
            return Ok(without_triple);
        }
    }
    Err(format!(
        "Binary not found: {} (checked {:?} and {:?})",
        name, candidates[0], candidates[1],
    ))
}

fn run_ytdlp(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let bin = resolve_binary(app, "yt-dlp")?;
    let output = Command::new(&bin)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stdout.is_empty() {
        return Ok(stdout);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let code = output.status.code().unwrap_or(-1);
    Err(format!("yt-dlp exited with code {code}: {stderr}"))
}

#[tauri::command]
fn open_floating_timer(app_handle: tauri::AppHandle) {
    if let Some(existing) = app_handle.get_webview_window("floating-timer") {
        let _ = existing.show();
        let _ = existing.set_focus();
        return;
    }
    let _ = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "floating-timer",
        tauri::WebviewUrl::App("index.html?window=timer".into()),
    )
    .title("OWA Studio - Timer")
    .inner_size(240.0, 120.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .and_then(|win| {
        let _ = win.set_ignore_cursor_events(false);
        let _ = win.show();
        let _ = win.set_focus();
        Ok(())
    });
}

#[tauri::command]
fn close_floating_timer(app_handle: tauri::AppHandle) {
    if let Some(win) = app_handle.get_webview_window("floating-timer") {
        let _ = win.close();
    }
}

#[tauri::command]
fn toggle_floating_timer_border(app_handle: tauri::AppHandle, show: bool) {
    if let Some(win) = app_handle.get_webview_window("floating-timer") {
        let _ = win.set_decorations(show);
    }
}

fn ensure_simple_binaries(app_handle: &tauri::AppHandle) {
    for name in &["ffmpeg", "ffprobe"] {
        if let Ok(path) = resolve_binary(app_handle, name) {
            if let Some(parent) = path.parent() {
                let simple = parent.join(format!("{name}.exe"));
                if !simple.exists() {
                    let _ = std::fs::copy(&path, &simple);
                }
            }
        }
    }
}

#[tauri::command]
async fn stream_youtube_audio(app_handle: tauri::AppHandle, url: String) -> Result<String, String> {
    run_ytdlp(&app_handle, &["-f", "bestaudio", "-g", "--no-warnings", &url])
}

#[tauri::command]
async fn get_youtube_metadata(app_handle: tauri::AppHandle, url: String) -> Result<String, String> {
    run_ytdlp(&app_handle, &["-J", "--flat-playlist", "--no-warnings", &url])
}

#[tauri::command]
async fn search_youtube(app_handle: tauri::AppHandle, query: String) -> Result<String, String> {
    let search_arg = format!("ytsearch10:{query}");
    run_ytdlp(&app_handle, &["-J", "--no-warnings", "--flat-playlist", &search_arg])
}

#[tauri::command]
async fn validate_url(app_handle: tauri::AppHandle, url: String) -> Result<String, String> {
    run_ytdlp(&app_handle, &["-J", "--flat-playlist", "--no-warnings", &url])
}

#[tauri::command]
async fn start_download(
    app_handle: tauri::AppHandle,
    url: String,
    download_id: String,
    output_dir: String,
    format: String,
) -> Result<(), String> {
    let state = app_handle.state::<DownloadState>();
    let download_path = state.path.lock().map_err(|e| e.to_string())?;
    let out_dir = if output_dir.is_empty() {
        download_path.clone()
    } else {
        output_dir
    };
    drop(download_path);

    let audio_format = if format == "mp3" { "mp3" } else { "m4a" };
    let yt_bin = resolve_binary(&app_handle, "yt-dlp")?;
    let ffmpeg_bin = resolve_binary(&app_handle, "ffmpeg")?;
    let ffmpeg_dir = ffmpeg_bin.parent().unwrap_or(std::path::Path::new("."));
    let out_template = format!("{}\\%(title)s.%(ext)s", out_dir);

    let mut child = Command::new(&yt_bin)
        .args([
            "--ffmpeg-location",
            &ffmpeg_dir.to_string_lossy(),
            "--yes-playlist",
            "--ignore-errors",
            "-x",
            "--audio-format",
            audio_format,
            "--audio-quality",
            "0",
            "--embed-metadata",
            "--embed-thumbnail",
            "--no-warnings",
            "--newline",
            "--replace-in-metadata",
            "title",
            r" \(Official.*\)",
            "",
            "--replace-in-metadata",
            "title",
            r" \(Video.*\)",
            "",
            "--replace-in-metadata",
            "title",
            r" \(Audio.*\)",
            "",
            "--replace-in-metadata",
            "title",
            r" \(Lyrics.*\)",
            "",
            "--replace-in-metadata",
            "title",
            r" \(Letra.*\)",
            "",
            "--replace-in-metadata",
            "title",
            r" \[.*?\]",
            "",
            "--parse-metadata",
            "title:%(artist)s - %(title)s",
            "-o",
            &out_template,
            &url,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let dl_id = download_id.clone();
    let emit = app_handle.clone();

    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(text) = line {
                let trimmed = text.trim();
                if trimmed.starts_with("[download]") {
                    if let Some(pct) = parse_progress(trimmed) {
                        let _ = emit.emit(
                            "download:progress",
                            serde_json::json!({
                                "downloadId": dl_id,
                                "progress": pct,
                                "line": trimmed,
                            }),
                        );
                    }
                } else if trimmed.contains("Destination:") {
                    let _ = emit.emit(
                        "download:file",
                        serde_json::json!({
                            "downloadId": dl_id,
                            "file": trimmed.replace("[download] Destination: ", "").trim(),
                            "type": "destination",
                        }),
                    );
                }
            }
        }
    });

    {
        let mut active = state.active.lock().map_err(|_| "Lock failed".to_string())?;
        active.insert(download_id.clone(), child);
    }

    // Spawn completion watcher
    let dl_id2 = download_id.clone();
    let emit2 = app_handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(1));
        loop {
            let state = emit2.state::<DownloadState>();
            let mut active = state.active.lock().unwrap();
            if let Some(mut child) = active.remove(&dl_id2) {
                let status = child.wait().ok();
                let success = status.map(|s| s.success()).unwrap_or(false);
                let code = status.and_then(|s| s.code());
                let _ = emit2.emit(
                    "download:complete",
                    serde_json::json!({
                        "downloadId": dl_id2,
                        "success": success,
                        "code": code,
                    }),
                );
            }
            break;
        }
    });

    Ok(())
}

fn parse_progress(line: &str) -> Option<f64> {
    let line = line.trim();
    if !line.starts_with("[download]") {
        return None;
    }
    let rest = line.trim_start_matches("[download]").trim();
    if let Some(pct_end) = rest.find('%') {
        let pct_str = rest[..pct_end].trim();
        if let Ok(pct) = pct_str.replace(',', ".").parse::<f64>() {
            return Some(pct / 100.0);
        }
    }
    None
}

#[tauri::command]
async fn cancel_download(app_handle: tauri::AppHandle, download_id: String) -> Result<(), String> {
    let state = app_handle.state::<DownloadState>();
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = active.remove(&download_id) {
        let _ = child.kill();
        let _ = child.wait();
        Ok(())
    } else {
        Err("Download not found".into())
    }
}

#[tauri::command]
fn get_download_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let state = app_handle.state::<DownloadState>();
    state.path.lock().map(|p| p.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_download_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let state = app_handle.state::<DownloadState>();
    let mut p = state.path.lock().map_err(|e| e.to_string())?;
    *p = path;
    Ok(())
}

#[tauri::command]
async fn get_system_stats(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let cpu_output = app_handle
        .shell()
        .command("powershell")
        .args(["-Command", "Get-WmiObject Win32_Processor | Select-Object -ExpandProperty LoadPercentage"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let mem_output = app_handle
        .shell()
        .command("powershell")
        .args([
            "-Command",
            "Get-WmiObject Win32_OperatingSystem | Select-Object @{Name='Total';Expression={$_.TotalVisibleMemorySize}}, @{Name='Free';Expression={$_.FreePhysicalMemory}} | ConvertTo-Json",
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let cpu = String::from_utf8_lossy(&cpu_output.stdout)
        .trim()
        .parse::<f64>()
        .unwrap_or(0.0);
    let mem: serde_json::Value =
        serde_json::from_str(&String::from_utf8_lossy(&mem_output.stdout))
            .unwrap_or(serde_json::json!({}));

    Ok(serde_json::json!({ "cpu": cpu, "mem": mem }))
}

fn main() {
    let default_download_path = dirs::download_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("OWA Music")
        .to_string_lossy()
        .to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DownloadState {
            active: Mutex::new(HashMap::new()),
            path: Mutex::new(default_download_path),
        })
        .invoke_handler(tauri::generate_handler![
            open_floating_timer,
            close_floating_timer,
            toggle_floating_timer_border,
            stream_youtube_audio,
            get_youtube_metadata,
            search_youtube,
            validate_url,
            start_download,
            cancel_download,
            get_download_path,
            set_download_path,
            get_system_stats,
        ])
        .setup(|app| {
            ensure_simple_binaries(app.handle());
            let app_handle = app.handle().clone();
            app.listen("timer:sync", move |event| {
                if let Some(floating) = app_handle.get_webview_window("floating-timer") {
                    let _ = floating.emit("timer:update", event.payload());
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
