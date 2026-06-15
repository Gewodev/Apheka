#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
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
    include_cover: bool,
    audio_quality: String,
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
    let ffmpeg_dir_str = ffmpeg_dir.to_string_lossy().to_string();
    let out_template = format!("{}\\%(title)s.%(ext)s", out_dir);

    let mut args = vec![
        "--ffmpeg-location",
        &ffmpeg_dir_str,
        "--yes-playlist",
        "--ignore-errors",
        "-x",
        "--audio-format",
        audio_format,
        "--audio-quality",
        &audio_quality,
        "--no-warnings",
        "--windows-filenames",
        "--newline",
        "--replace-in-metadata",
        "title",
        r" \(Official.*\)",
        "--replace-in-metadata",
        "title",
        r" \[Official.*\]",
        "--replace-in-metadata",
        "title",
        r" \(.*Video\)",
        "--replace-in-metadata",
        "title",
        r" \(.*Audio\)",
        "--replace-in-metadata",
        "title",
        r" \(.*Lyrics\)",
        "--replace-in-metadata",
        "title",
        r" \(.*Remaster.*\)",
        "--output",
        &out_template,
    ];

    if include_cover {
        args.push("--embed-metadata");
        args.push("--embed-thumbnail");
    }

    args.push(&url);

    let mut child = Command::new(&yt_bin)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let dl_id = download_id.clone();
    let emit = app_handle.clone();

    // Shared stderr capture (non-fatal lines filtered)
    let stderr_buf = std::sync::Arc::new(std::sync::Mutex::new(String::new()));

    // Read stderr for progress AND errors (yt-dlp writes progress to stderr by default)
    let stderr_buf_progress = stderr_buf.clone();
    let dl_id_progress = dl_id.clone();
    let emit_progress = emit.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(text) = line {
                let trimmed = text.trim();

                // Parse download progress from stderr
                if trimmed.starts_with("[download]") {
                    if !trimmed.contains("Destination:") && !trimmed.contains("has already been downloaded") {
                        if let Some(pct) = parse_progress(trimmed) {
                            // Scale download progress to 0-80% — remaining 20% is for post-processing
                            let scaled = pct * 0.8;
                            let _ = emit_progress.emit(
                                "download:progress",
                                serde_json::json!({
                                    "downloadId": dl_id_progress,
                                    "progress": scaled,
                                    "line": trimmed,
                                }),
                            );
                        }
                    }
                }

                // Capture only genuine errors (NOT metadata-replace warnings)
                let is_metadata_error = trimmed.contains("is not a valid URL")
                    || trimmed.contains("--replace-in-metadata")
                    || trimmed.contains("don't self-terminate")
                    || trimmed.contains("[generic]")
                    || trimmed.contains("[youtube]")
                    || (trimmed.contains("not a valid URL") && trimmed.len() < 150);
                if !is_metadata_error && (trimmed.contains("ERROR:") || trimmed.contains("Error:")) {
                    let mut buf = stderr_buf_progress.lock().unwrap();
                    buf.push_str(&trimmed);
                    buf.push('\n');
                }
            }
        }
    });

    // Also read stdout for destination info (e.g. "[download] Destination: ...")
    let dl_id_stdout = dl_id.clone();
    let emit_stdout = emit.clone();
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(text) = line {
                let trimmed = text.trim();
                if trimmed.contains("Destination:") {
                    let _ = emit_stdout.emit(
                        "download:file",
                        serde_json::json!({
                            "downloadId": dl_id_stdout,
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
    let stderr_buf_watcher = stderr_buf.clone();
    let out_dir_watcher = out_dir.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let state = emit2.state::<DownloadState>();
            let mut active = state.active.lock().unwrap();
            if let Some(mut child) = active.remove(&dl_id2) {
                let status = child.wait().ok();
                let code = status.and_then(|s| s.code());
                let error_msg = stderr_buf_watcher.lock().unwrap().clone();
                // Check if any audio file was actually created in the output dir
                let dir = std::path::Path::new(&out_dir_watcher);
                let has_output = dir.exists() && dir.read_dir().ok()
                    .map(|entries| entries.filter_map(|e| e.ok())
                        .any(|e| {
                            let n = e.file_name().to_string_lossy().to_lowercase();
                            n.ends_with(".mp3") || n.ends_with(".m4a") || n.ends_with(".wav")
                        })
                    ).unwrap_or(false);
                // Consider success if exit code is 0 OR if no actual ERROR lines in stderr
                // OR if an audio file was created (yt-dlp may exit non-zero for metadata warnings)
                let success = status.map(|s| s.success()).unwrap_or(false)
                    || error_msg.is_empty()
                    || has_output;
                let final_code = if success { Some(0) } else { code };
                let final_error = if success { String::new() } else { error_msg };
                let _ = emit2.emit(
                    "download:progress",
                    serde_json::json!({
                        "downloadId": dl_id2,
                        "progress": 1.0,
                    }),
                );
                let _ = emit2.emit(
                    "download:complete",
                    serde_json::json!({
                        "downloadId": dl_id2,
                        "success": success,
                        "code": final_code,
                        "errorMessage": final_error,
                    }),
                );
                break;
            }
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

async fn run_powershell_json(app_handle: &tauri::AppHandle, cmd: &str) -> Result<serde_json::Value, String> {
    let output = app_handle
        .shell()
        .command("powershell")
        .args(["-Command", cmd])
        .output()
        .await
        .map_err(|e| format!("PowerShell failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() || stdout == "null" || stdout == "{}" {
        return Err("No output".into());
    }
    serde_json::from_str(&stdout).map_err(|e| format!("JSON parse failed: {e}"))
}

async fn run_powershell_raw(app_handle: &tauri::AppHandle, cmd: &str) -> Result<String, String> {
    let output = app_handle
        .shell()
        .command("powershell")
        .args(["-Command", cmd])
        .output()
        .await
        .map_err(|e| format!("PowerShell failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() { Err("No output".into()) } else { Ok(stdout) }
}

#[tauri::command]
async fn get_system_stats(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    // CPU usage via performance counter (real-time sample over 1s)
    let cpu = run_powershell_json(&app_handle,
        "$s = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1 -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue; if ($null -ne $s) { [math]::Round($s, 1) } else { (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average) }"
    ).await.ok().and_then(|v| v.as_f64()).unwrap_or(0.0);

    // RAM in GB (more accurate)
    let mem = run_powershell_json(&app_handle,
        "$cs = Get-CimInstance Win32_ComputerSystem; $os = Get-CimInstance Win32_OperatingSystem; @{Total=[math]::Round($cs.TotalPhysicalMemory/1GB,1); Free=[math]::Round(($os.FreePhysicalMemory*1024)/1GB,1); Used=[math]::Round(($cs.TotalPhysicalMemory - $os.FreePhysicalMemory*1024)/1GB,1); Pct=[math]::Round((1 - ($os.FreePhysicalMemory*1024)/$cs.TotalPhysicalMemory)*100,1)} | ConvertTo-Json"
    ).await.unwrap_or(serde_json::json!({}));

    // Disk: all fixed drives summed
    let disk = run_powershell_json(&app_handle,
        "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID, @{N='SizeGB';E={[math]::Round($_.Size/1GB,1)}}, @{N='FreeGB';E={[math]::Round($_.FreeSpace/1GB,1)}} | ConvertTo-Json"
    ).await.unwrap_or(serde_json::json!([]));

    // Battery
    let battery = run_powershell_json(&app_handle,
        "Get-CimInstance Win32_Battery | Select-Object @{N='Pct';E={$_.EstimatedChargeRemaining}} | ConvertTo-Json"
    ).await.ok();

    // Network: actual current bandwidth usage via performance counters
    let net = run_powershell_json(&app_handle,
        "$i = (Get-Counter '\\Network Interface(*)\\Bytes Total/sec' -ErrorAction SilentlyContinue).CounterSamples | Where-Object {$_.InstanceName -notmatch '_isatap|_teredo|Loopback|Pseudo'} | Select-Object -First 1; if ($i) { $mbps = [math]::Round($i.CookedValue * 8 / 1MB, 1); [PSCustomObject]@{Name=$i.InstanceName;SpeedMbps=$mbps} | ConvertTo-Json } else { '{}' }"
    ).await.unwrap_or(serde_json::json!({}));

    // CPU temperature via performance counter
    let cpu_temp_str = run_powershell_raw(&app_handle,
        "$t = Get-Counter '\\Thermal Zone Information\\*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CounterSamples | Where-Object {$_.InstanceName -match 'CPU|TZ\\d+'} | Select-Object -First 1 -ExpandProperty CookedValue; if ($null -ne $t -and $t -gt 0) { [math]::Round($t, 1) } else { try { $z = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Where-Object { $_.InstanceName -match 'CPU' } | Select-Object -First 1 -ExpandProperty CurrentTemperature; if ($null -ne $z) { [math]::Round(($z/10)-273.15, 1) } else { 'null' } } catch { 'null' } }"
    ).await.unwrap_or_default();
    let cpu_temp: f64 = cpu_temp_str.trim().parse().unwrap_or(-1.0);

    // CPU model/name
    let cpu_name = run_powershell_raw(&app_handle,
        "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name"
    ).await.unwrap_or_default().trim().to_string();

    // GPU temperature via nvidia-smi or performance counter
    let gpu_temp_str = run_powershell_raw(&app_handle,
        "$t = & nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader 2>$null; if ($t) { $t.Trim() } else { try { $c = Get-Counter '\\GPU Core Temperature' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CounterSamples | Select-Object -First 1 -ExpandProperty CookedValue; if ($null -ne $c -and $c -gt 0) { [math]::Round($c, 1) } else { 'null' } } catch { 'null' } }"
    ).await.unwrap_or_default();
    let gpu_temp: f64 = gpu_temp_str.trim().parse().unwrap_or(-1.0);

    // GPU name
    let gpu_name = run_powershell_raw(&app_handle,
        "Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name"
    ).await.unwrap_or_default().trim().to_string();

    // Laptop model
    let laptop_model = run_powershell_raw(&app_handle,
        "$cs = Get-CimInstance Win32_ComputerSystem; ($cs.Manufacturer + ' ' + $cs.Model).Trim()"
    ).await.unwrap_or_default().trim().to_string();

    // OS info
    let os_info = run_powershell_raw(&app_handle,
        "$os = Get-CimInstance Win32_OperatingSystem; $os.Caption + ' | Build ' + $os.BuildNumber"
    ).await.unwrap_or_default().trim().to_string();

    // Parse disk
    let (disk_total, disk_free) = match &disk {
        serde_json::Value::Array(arr) => {
            let total: f64 = arr.iter().filter_map(|d| d.get("SizeGB")?.as_f64()).sum();
            let free: f64 = arr.iter().filter_map(|d| d.get("FreeGB")?.as_f64()).sum();
            (total, free)
        }
        serde_json::Value::Object(obj) => {
            (obj.get("SizeGB").and_then(|v| v.as_f64()).unwrap_or(0.0),
             obj.get("FreeGB").and_then(|v| v.as_f64()).unwrap_or(0.0))
        }
        _ => (0.0, 0.0),
    };
    let disk_used = disk_total - disk_free;
    let disk_pct = if disk_total > 0.0 { (disk_used / disk_total * 100.0).round() } else { 0.0 };

    let battery_pct = battery.and_then(|b| {
        if let serde_json::Value::Object(ref obj) = b {
            obj.get("Pct").and_then(|v| v.as_f64())
        } else if let serde_json::Value::Array(ref arr) = b {
            arr.first().and_then(|v| v.get("Pct")).and_then(|v| v.as_f64())
        } else { None }
    }).unwrap_or(-1.0);

    let net_speed = net.get("SpeedMbps").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let net_name = net.get("Name").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // RAM: parse from our structured JSON
    let ram_total = mem.get("Total").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ram_pct = mem.get("Pct").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ram_used_gb = mem.get("Used").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let res = serde_json::json!({
        "cpu": cpu,
        "cpuTemp": if cpu_temp >= 0.0 { serde_json::json!(cpu_temp) } else { serde_json::Value::Null },
        "cpuName": cpu_name,
        "gpuTemp": if gpu_temp >= 0.0 { serde_json::json!(gpu_temp) } else { serde_json::Value::Null },
        "gpuName": gpu_name,
        "ram": ram_pct,
        "ramTotal": ram_total,
        "ramUsed": ram_used_gb,
        "disk": disk_pct,
        "diskTotal": disk_total,
        "diskUsed": disk_used,
        "battery": battery_pct,
        "netSpeed": net_speed,
        "netName": net_name,
        "laptopModel": laptop_model,
        "osInfo": os_info,
    });
    Ok(res)
}

#[tauri::command]
async fn export_to_zip(app_handle: tauri::AppHandle, save_path: String) -> Result<String, String> {
    let state = app_handle.state::<DownloadState>();
    let download_dir = state.path.lock().map_err(|e| e.to_string())?.clone();

    let dir = std::path::Path::new(&download_dir);
    if !dir.exists() {
        return Err("Download directory does not exist".into());
    }

    let file = std::fs::File::create(&save_path)
        .map_err(|e| format!("Cannot create ZIP file: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);

    let mut entries: Vec<std::path::PathBuf> = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| format!("Cannot read directory: {e}"))? {
        let entry = entry.map_err(|e| format!("Cannot read entry: {e}"))?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if ext_lower == "mp3" || ext_lower == "m4a" || ext_lower == "wav" || ext_lower == "flac" || ext_lower == "ogg" {
                    entries.push(path);
                }
            }
        }
    }

    if entries.is_empty() {
        return Err("No audio files found in the download directory".into());
    }

    for entry in &entries {
        let name = entry.file_name().unwrap().to_string_lossy().to_string();
        zip.start_file(&name, zip::write::FileOptions::<()>::default())
            .map_err(|e| format!("ZIP add file error: {e}"))?;
        let data = std::fs::read(entry).map_err(|e| format!("Read error: {e}"))?;
        zip.write_all(&data).map_err(|e| format!("Write error: {e}"))?;
    }

    zip.finish().map_err(|e| format!("ZIP finish error: {e}"))?;

    Ok(save_path)
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
            stream_youtube_audio,
            get_youtube_metadata,
            search_youtube,
            validate_url,
            start_download,
            cancel_download,
            get_download_path,
            set_download_path,
            get_system_stats,
            export_to_zip,
        ])
        .setup(|app| {
            ensure_simple_binaries(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
