#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod local_asr;
mod native_notifications;
mod charvis_stream;
mod music_network;
mod jev;
mod charvis;
mod charvis_web;
mod charvis_artifacts;
mod charvis_vault;
mod media_source;
mod playlist_import;
mod youtube_identity;


mod external_open;
mod workspace_pointer;
mod floating_timer;
mod media_controls;
mod app_update;
mod asr_setup;
mod rendering;
mod release_notice;
mod mcp;
mod catalog_download;
use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use reqwest;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// CREATE_NO_WINDOW: sin esta flag, cada binario de consola (yt-dlp, where) abre
/// una ventana de terminal visible en la build de producción (windows_subsystem).
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Destroy only the retired video window, including a restored legacy instance.
#[tauri::command]
fn retire_legacy_media_windows(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("youtube-player") {
        window.destroy().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn quiet(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    { cmd.creation_flags(CREATE_NO_WINDOW) }
    #[cfg(not(windows))]
    { cmd }
}

struct DownloadState {
    active: Mutex<HashMap<String, std::process::Child>>,
    path: Mutex<String>,
}

fn stop_download_child(child: &mut std::process::Child) {
    if matches!(child.try_wait(),Ok(Some(_))) {return;}
    #[cfg(windows)]
    { let process_id=child.id().to_string();let _=quiet(Command::new("taskkill").args(["/PID", &process_id, "/T", "/F"])).status(); }
    let _=child.kill();let _=child.wait();
}

fn resolve_binary(app: &tauri::AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
    let triple = "x86_64-pc-windows-msvc";
    let candidates = [
        // An explicitly repaired managed tool takes precedence over the bundled copy.
        app.path().app_data_dir().ok().map(|r|r.join("bin")).unwrap_or_default(),
        app.path().resource_dir().ok().map(|r|r.join("bin")).unwrap_or_default(),
        // Never execute binaries from the developer checkout in an installed release.
        if cfg!(debug_assertions) {std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin")} else {std::path::PathBuf::new()},
    ];
    for dir in &candidates {
        if dir.as_os_str().is_empty() { continue; }
        let with_triple = dir.join(format!("{name}-{triple}.exe"));
        let without_triple = dir.join(format!("{name}.exe"));
        if without_triple.is_file() { return Ok(without_triple); }
        if with_triple.is_file() { return Ok(with_triple); }
    }
    // PATH del sistema: el usuario puede tener yt-dlp/ffmpeg ya instalados
    // (winget, scoop, chocolatey, Python Scripts…) — no duplicar descargas.
    if let Ok(out) = quiet(Command::new("where").arg(name)).output() {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Some(first) = stdout.lines().map(str::trim).find(|l| !l.is_empty()) {
                let p = std::path::PathBuf::from(first);
                if p.exists() {
                    return Ok(p);
                }
            }
        }
    }
    Err(format!(
        "{} no encontrado (Windows Defender pudo eliminarlo). Buscado en {:?}, {:?}, {:?} y PATH.",
        name, candidates[0], candidates[1], candidates[2],
    ))
}

struct PartialDownload(std::path::PathBuf);
impl Drop for PartialDownload {fn drop(&mut self){let _=std::fs::remove_file(&self.0);}}

static YTDLP_INSTALL_LOCK:tokio::sync::Mutex<()>=tokio::sync::Mutex::const_new(());

/// Explicit repair only; never install/download tools on app startup.
#[tauri::command]
async fn download_yt_dlp(app_handle: tauri::AppHandle) -> Result<String, String> {
    let _install_guard=YTDLP_INSTALL_LOCK.lock().await;
    // Si ya hay un yt-dlp funcional (app, bundle o PATH del sistema), no re-descargar
    if let Ok(bin) = resolve_binary(&app_handle, "yt-dlp") {
        if let Ok(out) = quiet(Command::new(&bin).args(["--version"])).output() {
            if out.status.success() {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return Ok(format!("yt-dlp ya estaba instalado en {}. Versión: {}", bin.display(), version));
            }
        }
    }

    let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let bin_dir = app_data.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(|e| format!("No se pudo crear directorio bin: {e}"))?;

    let dest = bin_dir.join("yt-dlp.exe");

    // Get latest release URL from GitHub
    let client = reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(10)).timeout(std::time::Duration::from_secs(180)).build().map_err(|e|e.to_string())?;
    let release = client
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .header("User-Agent", "APHEKA")
        .send()
        .await
        .map_err(|e| format!("Error consultando release de yt-dlp: {e}"))?
        .error_for_status().map_err(|e|e.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Error parseando release: {e}"))?;

    let assets = release["assets"].as_array().ok_or("No assets in release")?;
    let asset = assets
        .iter()
        .find(|a| a["name"].as_str()==Some("yt-dlp.exe"))
        .ok_or("No yt-dlp.exe asset found")?;

    let download_url = asset["browser_download_url"].as_str().ok_or("No download URL")?;

    let mut resp = client
        .get(download_url)
        .header("User-Agent", "APHEKA")
        .send()
        .await
        .map_err(|e| format!("Error descargando yt-dlp: {e}"))?
        .error_for_status().map_err(|e|e.to_string())?;

    let temporary=bin_dir.join(format!("yt-dlp-{}.partial.exe",uuid::Uuid::new_v4()));
    let _cleanup=PartialDownload(temporary.clone());
    let mut downloaded_bytes=0usize;
    let mut file = std::fs::File::create(&temporary).map_err(|e| format!("No se pudo crear archivo: {e}"))?;
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("Error en chunk: {e}"))? {
        downloaded_bytes+=chunk.len();if downloaded_bytes>100_000_000 {return Err("La descarga supera el tamaño permitido".into());}
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| format!("Error escribiendo: {e}"))?;
    }

    file.sync_all().map_err(|e|e.to_string())?;drop(file);
    // Verify the complete file before replacing the managed executable.
    let output = quiet(Command::new(&temporary).args(["--version"])).output().map_err(|e| format!("Error ejecutando yt-dlp: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("yt-dlp descargado no funciona: {stderr}"));
    }

    std::fs::rename(&temporary,&dest).map_err(|e|e.to_string())?;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(format!("yt-dlp instalado en {}. Versión: {}", dest.display(), version))
}

fn youtube_source(url:&str)->Result<(),String>{let url=reqwest::Url::parse(url).map_err(|_|"Enlace de música no válido")?;if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some()||!matches!(url.host_str(),Some("youtube.com"|"www.youtube.com"|"music.youtube.com"|"m.youtube.com"|"youtu.be")){return Err("Usa un enlace HTTPS de YouTube o YouTube Music".into());}Ok(())}
fn run_ytdlp(app:&tauri::AppHandle,args:&[&str],proxy:Option<&str>)->Result<String,String>{let bin=resolve_binary(app,"yt-dlp")?;let mut cmd=Command::new(&bin);cmd.args(["--ignore-config","--no-cache-dir","--socket-timeout","15","--retries","1","--extractor-retries","1","--playlist-end","200"]);if let Some(proxy)=proxy{cmd.args(["--proxy",proxy]);}let output=quiet(cmd.args(args)).output().map_err(|_|"No se pudo iniciar la herramienta de audio")?;if !output.status.success(){return Err("No se pudo consultar ese enlace. Revisa la conexión y la disponibilidad del audio.".into());}let stdout=String::from_utf8_lossy(&output.stdout).trim().to_string();if stdout.is_empty(){return Err("El enlace no devolvió audio disponible".into());}Ok(stdout)}
async fn media_query(app:tauri::AppHandle,value:String,kind:&'static str,mode:Option<String>,proxy:Option<String>)->Result<String,String>{if kind=="stream"{youtube_source(&value)?;}else if kind!="search"{media_source::validate(&value)?;}let proxy=music_network::proxy_value(mode.as_deref(),proxy.as_deref())?;static SLOTS:std::sync::OnceLock<std::sync::Arc<tokio::sync::Semaphore>>=std::sync::OnceLock::new();let permit=SLOTS.get_or_init(||std::sync::Arc::new(tokio::sync::Semaphore::new(2))).clone().acquire_owned().await.map_err(|_|"Consulta de audio cerrada")?;tauri::async_runtime::spawn_blocking(move||{let _permit=permit;match kind{"stream"=>run_ytdlp(&app,&["-f","bestaudio","-g","--no-warnings","--",&value],proxy.as_deref()),"search"=>{let search=format!("ytsearch10:{}",value.chars().take(200).collect::<String>());run_ytdlp(&app,&["-J","--flat-playlist","--no-warnings",&search],proxy.as_deref())},_=>run_ytdlp(&app,&["-J","--flat-playlist","--no-warnings","--",&value],proxy.as_deref())}}).await.map_err(|_|"No se pudo completar la consulta de audio")?}
#[tauri::command]
async fn stream_youtube_audio(app_handle:tauri::AppHandle,url:String,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<String,String>{media_query(app_handle,url,"stream",proxy_mode,proxy_url).await}
#[tauri::command]
async fn get_youtube_metadata(app_handle:tauri::AppHandle,url:String,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<String,String>{media_query(app_handle,url,"metadata",proxy_mode,proxy_url).await}
#[tauri::command]
async fn search_youtube(app_handle:tauri::AppHandle,query:String,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<String,String>{media_query(app_handle,query,"search",proxy_mode,proxy_url).await}
#[tauri::command]
async fn validate_url(app_handle:tauri::AppHandle,url:String,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<String,String>{media_query(app_handle,url,"metadata",proxy_mode,proxy_url).await}

#[tauri::command]
async fn start_download(
    app_handle: tauri::AppHandle,
    url: String,
    download_id: String,
    output_dir: String,
    format: String,
    include_cover: bool,
    audio_quality: String,
    proxy_mode: Option<String>,
    proxy_url: Option<String>,
    video_quality: Option<String>,
) -> Result<(), String> {
    media_source::validate(&url)?;
    let proxy=music_network::proxy_value(proxy_mode.as_deref(),proxy_url.as_deref())?;
    let state = app_handle.state::<DownloadState>();
    let download_path = state.path.lock().map_err(|e| e.to_string())?;
    let out_dir = if output_dir.is_empty() {
        download_path.clone()
    } else {
        output_dir
    };
    drop(download_path);

    let video = format == "mp4";
    let audio_format = if format == "mp3" { "mp3" } else { "m4a" };
    let height=match video_quality.as_deref(){Some("720")=>"720",Some("best")=>"2160",_=>"1080"};
    let video_selector=format!("bestvideo[ext=mp4][height<=?{height}]+bestaudio[ext=m4a]/best[ext=mp4][height<=?{height}]/best[height<=?{height}]");
    let yt_bin = resolve_binary(&app_handle, "yt-dlp")?;
    let ffmpeg_bin = resolve_binary(&app_handle, "ffmpeg")?;
    let ffmpeg_dir_str = ffmpeg_bin.to_string_lossy().to_string();
    let out_template = "%(title)s.%(ext)s".to_string();
    let workspace=DownloadWorkspace(std::env::temp_dir().join(format!("apheka-download-{}",uuid::Uuid::new_v4())));
    std::fs::create_dir_all(&workspace.0).map_err(|e|e.to_string())?;
    let work_home=workspace.0.to_string_lossy().to_string();
    let temp_path=format!("temp:{}",workspace.0.join("parts").to_string_lossy());
    std::fs::create_dir_all(&out_dir).map_err(|e|e.to_string())?;

    let receipt_path=std::env::temp_dir().join(format!("apheka-audio-{}.jsonl",uuid::Uuid::new_v4()));
    let receipt=DownloadReceipt(receipt_path.clone());
    let receipt_file=receipt_path.to_string_lossy().to_string();
    let mut args = vec![
        "--ffmpeg-location",
        &ffmpeg_dir_str,
        "--yes-playlist",
        "--no-ignore-errors",
        "-x",
        "--audio-format",
        audio_format,
        "--audio-quality",
        &audio_quality,
        "--socket-timeout",
        "15",
        "--retries",
        "2",
        "--fragment-retries",
        "2",
        "--extractor-retries",
        "1",
        "--concurrent-fragments",
        "1",
        "--postprocessor-args",
        "ffmpeg:-threads 2",
        "--no-warnings",
        "--windows-filenames",
        "--newline",
        "--replace-in-metadata",
        "title",
        r" \(Official.*\)",
        "",
        "--replace-in-metadata",
        "title",
        r" \[Official.*\]",
        "",
        "--replace-in-metadata",
        "title",
        r" \(.*Video\)",
        "",
        "--replace-in-metadata",
        "title",
        r" \(.*Audio\)",
        "",
        "--replace-in-metadata",
        "title",
        r" \(.*Lyrics\)",
        "",
        "--replace-in-metadata",
        "title",
        r" \(.*Remaster.*\)",
        "",
        "--paths",
        &work_home,
        "--paths",
        &temp_path,
        "--output",
        &out_template,
    ];

    if video {let extraction=args.iter().position(|arg|*arg=="-x").unwrap();args.drain(extraction..extraction+5);args.extend(["-f",&video_selector,"--merge-output-format","mp4","--remux-video","mp4"]);}
    args.extend(["--ignore-config","--no-cache-dir","--encoding","utf-8"]);
    if let Some(proxy)=proxy.as_deref(){args.extend(["--proxy",proxy]);}
    args.push("--embed-metadata");
    if include_cover && !video {
        args.push("--embed-thumbnail");
    }

    args.extend(["--no-simulate", "--progress", "--print", "after_move:APHEKA_FILE:%(filepath,_filename)j", "--print-to-file", "after_move:%(filepath,_filename)j", &receipt_file]);
    args.push("--");
    args.push(&url);

    let mut child = quiet(Command::new(&yt_bin).args(&args))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("Access is denied") || msg.contains("denied") || msg.contains("5") {
                format!("Windows Defender bloqueó yt-dlp. Agrega la carpeta a exclusiones de Windows Security: {msg}")
            } else if msg.contains("not found") || msg.contains("2") {
                format!("yt-dlp no encontrado (pudo ser eliminado por Windows Defender). Reinstala la app o agrega exclusiones: {msg}")
            } else {
                format!("Error al iniciar yt-dlp: {msg}")
            }
        })?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let dl_id = download_id.clone();
    let emit = app_handle.clone();

    // Shared stderr capture (non-fatal lines filtered)
    let stderr_buf = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let completed_files = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let completed_paths=std::sync::Arc::new(Mutex::new(std::collections::HashSet::<std::path::PathBuf>::new()));

    // Read stderr for progress AND errors (yt-dlp writes progress to stderr by default)
    let stderr_buf_progress = stderr_buf.clone();
    let dl_id_progress = dl_id.clone();
    let emit_progress = emit.clone();
    let stderr_reader = std::thread::spawn(move || {
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
                    || (trimmed.contains("not a valid URL") && trimmed.len() < 150);
                if !is_metadata_error && (trimmed.contains("ERROR:") || trimmed.contains("Error:")) {
                    let mut buf = stderr_buf_progress.lock().unwrap();
                    if buf.len()<4000 {buf.push_str(&trimmed);buf.push('\n');}
                }
            }
        }
    });

    // Also read stdout for destination info (e.g. "[download] Destination: ...")
    let dl_id_stdout = dl_id.clone();
    let emit_stdout = emit.clone();
    let output_count = completed_files.clone();
    let output_paths=completed_paths.clone();
    let output_root=out_dir.clone();
    let workspace_root=workspace.0.clone();
    let watcher_workspace=workspace.0.clone();
    let stdout_reader = std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(text) = line {
                let trimmed = text.trim();
                if let Some(final_path) = trimmed.strip_prefix("APHEKA_FILE:") {
                    record_download_file(&emit_stdout,&dl_id_stdout,final_path,&output_root,&workspace_root,&output_paths,&output_count);
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
    std::thread::spawn(move || {
        let _receipt=receipt;
        let _workspace=workspace;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(300));
            let outcome = {
                let state = emit2.state::<DownloadState>();
                let mut active = state.active.lock().unwrap();
                let Some(child) = active.get_mut(&dl_id2) else { break; };
                match child.try_wait() {
                    Ok(Some(status)) => { active.remove(&dl_id2); Some(Ok(status)) },
                    Ok(None) => None,
                    Err(error) => { active.remove(&dl_id2); Some(Err(error)) },
                }
            };
            let Some(outcome) = outcome else { continue; };
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            if let Ok(contents)=std::fs::read_to_string(&receipt_path){for line in contents.lines(){record_download_file(&emit2,&dl_id2,line,&out_dir,&watcher_workspace,&completed_paths,&completed_files);}}
            let success = outcome.as_ref().map(|s| s.success()).unwrap_or(false) && completed_files.load(std::sync::atomic::Ordering::Relaxed)>0;
            let code = outcome.as_ref().ok().and_then(|s| s.code());
            let error = if success { String::new() } else {
                let captured = stderr_buf_watcher.lock().unwrap().clone();
                if captured.is_empty() { if code==Some(0){"La herramienta terminó sin confirmar un archivo de audio. Reintenta la descarga.".to_string()}else{"No se pudo completar la descarga. Revisa la conexión o la disponibilidad de la canción.".to_string()} } else { captured }
            };
            let _ = emit2.emit("download:complete", serde_json::json!({
                "downloadId": dl_id2, "success": success, "code": code, "errorMessage": error
            }));
            break;
        }
    });

    Ok(())
}

struct DownloadWorkspace(std::path::PathBuf);
impl Drop for DownloadWorkspace{fn drop(&mut self){if self.0.parent()==Some(std::env::temp_dir().as_path())&&self.0.file_name().and_then(|n|n.to_str()).map(|n|n.starts_with("apheka-download-")).unwrap_or(false){let _=std::fs::remove_dir_all(&self.0);}}}
struct DownloadReceipt(std::path::PathBuf);
impl Drop for DownloadReceipt{fn drop(&mut self){let _=std::fs::remove_file(&self.0);}}
fn same_download_file(a:&std::path::Path,b:&std::path::Path)->bool{
    use std::io::Read;
    let (Ok(ma),Ok(mb))=(a.metadata(),b.metadata())else{return false;};
    if !ma.is_file()||!mb.is_file()||ma.len()!=mb.len(){return false;}
    let (Ok(mut left),Ok(mut right))=(std::fs::File::open(a),std::fs::File::open(b))else{return false;};
    let mut x=[0u8;65536];let mut y=[0u8;65536];
    loop{let (Ok(nx),Ok(ny))=(left.read(&mut x),right.read(&mut y))else{return false;};if nx!=ny||x[..nx]!=y[..ny]{return false;}if nx==0{return true;}}
}
fn publish_download(source:&std::path::Path,root:&std::path::Path)->Result<std::path::PathBuf,std::io::Error>{
    let name=source.file_name().ok_or_else(||std::io::Error::other("Archivo sin nombre"))?;
    let stem=source.file_stem().unwrap_or(name).to_string_lossy();let ext=source.extension().map(|e|format!(".{}",e.to_string_lossy())).unwrap_or_default();
    for index in 0..1000{
        let destination=if index==0{root.join(name)}else{root.join(format!("{stem} ({}){ext}",index+1))};
        if destination.exists(){if destination.canonicalize()?.starts_with(root)&&same_download_file(source,&destination){return Ok(destination);}continue;}
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&destination){
            Ok(mut output)=>{let result=std::fs::File::open(source).and_then(|mut input|std::io::copy(&mut input,&mut output)).and_then(|_|output.sync_all());drop(output);if let Err(error)=result{let _=std::fs::remove_file(&destination);return Err(error);}return Ok(destination);},
            Err(error)if error.kind()==std::io::ErrorKind::AlreadyExists=>continue,
            Err(error)=>return Err(error),
        }
    }
    Err(std::io::Error::other("Demasiados archivos con el mismo nombre"))
}
fn record_download_file(app:&tauri::AppHandle,id:&str,raw:&str,root:&str,workspace:&std::path::Path,seen:&std::sync::Arc<Mutex<std::collections::HashSet<std::path::PathBuf>>>,count:&std::sync::Arc<std::sync::atomic::AtomicUsize>){
    let value=serde_json::from_str::<String>(raw.trim()).unwrap_or_else(|_|raw.trim().to_string());
    let Ok(source)=std::path::PathBuf::from(&value).canonicalize()else{return;};
    let (Ok(work),Ok(parent))=(workspace.canonicalize(),std::path::Path::new(root).canonicalize())else{return;};
    if !source.starts_with(work)||!source.metadata().map(|m|m.is_file()&&m.len()>0).unwrap_or(false){return;}
    let Ok(mut paths)=seen.lock()else{return;};if paths.contains(&source){return;}
    let Ok(file)=publish_download(&source,&parent)else{return;};paths.insert(source);
    count.fetch_add(1,std::sync::atomic::Ordering::Relaxed);
    let clean=file.to_string_lossy().trim_start_matches(r"\\?\").to_string();
    let _=app.emit("download:file",serde_json::json!({"downloadId":id,"file":clean,"type":"completed"}));
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

#[cfg(test)]mod download_publish_tests{
    use super::*;
    #[test]fn keeps_existing_files_and_reuses_identical_output(){
        let base=std::env::temp_dir().join(format!("apheka-publish-qa-{}",uuid::Uuid::new_v4()));
        let work=base.join("work");let output=base.join("output");std::fs::create_dir_all(&work).unwrap();std::fs::create_dir_all(&output).unwrap();
        let root=output.canonicalize().unwrap();let source=work.join("Canción á.mp3");
        std::fs::write(&source,b"first audio").unwrap();let first=publish_download(&source,&root).unwrap();
        assert_eq!(publish_download(&source,&root).unwrap(),first);assert_eq!(std::fs::read_dir(&output).unwrap().count(),1);
        std::fs::write(&source,b"different audio").unwrap();let second=publish_download(&source,&root).unwrap();
        assert_ne!(first,second);assert_eq!(std::fs::read(&first).unwrap(),b"first audio");assert_eq!(std::fs::read(&second).unwrap(),b"different audio");
        assert!(base.file_name().unwrap().to_string_lossy().starts_with("apheka-publish-qa-"));std::fs::remove_dir_all(base).unwrap();
    }
}

#[tauri::command]
async fn cancel_download(app_handle: tauri::AppHandle, download_id: String) -> Result<(), String> {
    let state = app_handle.state::<DownloadState>();
    let mut active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = active.remove(&download_id) {
        stop_download_child(&mut child);
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
async fn export_to_zip(app_handle: tauri::AppHandle, save_path: String) -> Result<String, String> {    let state = app_handle.state::<DownloadState>();
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

#[derive(serde::Serialize)]
struct FoundBrowser {
    id: String,
    name: String,
    exe: String,
}

// Detecta navegadores INSTALADOS en el sistema revisando sus rutas conocidas.
// Solo se devuelven los que realmente existen — nada de listas fijas en la UI.
#[tauri::command]
fn detect_installed_browsers() -> Vec<FoundBrowser> {
    let pf = std::env::var("ProgramFiles").unwrap_or_default();
    let pfx86 = std::env::var("ProgramFiles(x86)").unwrap_or_default();
    let lad = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let defs: &[(&str, &str, &[&str])] = &[
        ("chrome", "Google Chrome", &[
            "{PF}\\Google\\Chrome\\Application\\chrome.exe",
            "{PFX}\\Google\\Chrome\\Application\\chrome.exe",
            "{LAD}\\Google\\Chrome\\Application\\chrome.exe",
        ]),
        ("edge", "Microsoft Edge", &[
            "{PFX}\\Microsoft\\Edge\\Application\\msedge.exe",
            "{PF}\\Microsoft\\Edge\\Application\\msedge.exe",
        ]),
        ("brave", "Brave", &[
            "{PF}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "{PFX}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "{LAD}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        ]),
        ("firefox", "Firefox", &[
            "{PF}\\Mozilla Firefox\\firefox.exe",
            "{PFX}\\Mozilla Firefox\\firefox.exe",
        ]),
        ("opera", "Opera", &[
            "{LAD}\\Programs\\Opera\\opera.exe",
            "{PF}\\Opera\\opera.exe",
        ]),
        ("operagx", "Opera GX", &[
            "{LAD}\\Programs\\Opera GX\\launcher.exe",
        ]),
        ("vivaldi", "Vivaldi", &[
            "{LAD}\\Vivaldi\\Application\\vivaldi.exe",
        ]),
    ];
    let mut out: Vec<FoundBrowser> = Vec::new();
    for (id, name, paths) in defs {
        for p in *paths {
            let full = p.replace("{PF}", &pf).replace("{PFX}", &pfx86).replace("{LAD}", &lad);
            if std::path::Path::new(&full).exists() {
                out.push(FoundBrowser { id: id.to_string(), name: name.to_string(), exe: full });
                break;
            }
        }
    }
    out
}

// Abre un URL EN UN NAVEGADOR CONCRETO (no el predeterminado del sistema).
#[tauri::command]
fn open_url_in_browser(exe: String, url: String) -> Result<(), String> {
    let target = external_open::target(&url)?;
    let p = std::path::PathBuf::from(&exe);
    if !p.exists() {
        return Err("Ese navegador ya no está disponible en el sistema".into());
    }
    std::process::Command::new(&p)
        .arg(&target)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No se pudo abrir con ese navegador: {e}"))
}

fn main() {
    if std::env::args().nth(1).as_deref()==Some("--apheka-asr-worker"){local_asr::worker_main();return;}
    if std::env::args().any(|arg| arg == "--mcp") { mcp::stdio_main(); return; }
    let context=tauri::generate_context!();
    let rendering=rendering::configure(&context.config().identifier);
    let default_download_path = dirs::download_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("APHEKA Music")
        .to_string_lossy()
        .to_string();

    tauri::Builder::default()
        .manage(rendering)
        .setup(|app|{youtube_identity::configure(app.handle());let _=retire_legacy_media_windows(app.handle().clone());Ok(())})
        .manage(music_network::MusicNetwork::default())
        .manage(jev::JevState::default())
        .manage(charvis::CharvisState::default())
        .manage(charvis_web::WebState::default())
        .manage(mcp::McpState::default())
        .manage(catalog_download::CatalogDownloads::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _=retire_legacy_media_windows(app.clone());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .manage(DownloadState {
            active: Mutex::new(HashMap::new()),
            path: Mutex::new(default_download_path),
        })
        .invoke_handler(tauri::generate_handler![
            native_notifications::send_workspace_notification,
            playlist_import::read_external_playlist,
            retire_legacy_media_windows,
            music_network::music_catalog_request, music_network::cancel_music_catalog_request,
            jev::jev_status, jev::jev_connect, jev::jev_disconnect, jev::jev_decide,
            charvis::charvis_credential, charvis::charvis_request, local_asr::charvis_local_transcribe, local_asr::charvis_asr_cancel, charvis::charvis_cancel,
            charvis_web::charvis_web_request, charvis_web::charvis_web_cancel,
            charvis_artifacts::charvis_create_artifact, charvis_artifacts::charvis_artifact_bytes,
            charvis_vault::charvis_vault,
            catalog_download::download_catalog_track, catalog_download::cancel_catalog_download, catalog_download::catalog_download_usage,
            mcp::mcp_status, mcp::mcp_start, mcp::mcp_stop, mcp::mcp_register,
            mcp::mcp_connection, mcp::mcp_rotate, mcp::mcp_claim, mcp::mcp_resolve,
            release_notice::get_release_notice,
            release_notice::acknowledge_release,
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
            detect_installed_browsers,
            open_url_in_browser,
            workspace_pointer::restore_workspace_pointer,
            workspace_pointer::refresh_workspace_cursor,
            floating_timer::toggle_floating_timer, floating_timer::close_floating_timer,
            media_controls::media_controls_update, media_controls::media_controls_clear,
            app_update::update_state, app_update::relaunch_app, app_update::apply_update,
            asr_setup::asr_status, asr_setup::asr_prepare,
            rendering::graphics_status, rendering::graphics_set_mode,
            download_yt_dlp,
        ])
        .on_window_event(|window,event| {
            if window.label()=="floating-timer" && matches!(event,tauri::WindowEvent::Destroyed) {
                workspace_pointer::recover_after_timer_close(window.app_handle());
            }
            // Auxiliary windows cannot keep a headless main instance alive.
            // Main's close-requested handler flushes the editors before this event.
            if window.label()=="main" && matches!(event,tauri::WindowEvent::Destroyed) {
                local_asr::stop_all();
                let mut children:Vec<_>=window.state::<DownloadState>().active.lock().map(|mut active|active.drain().map(|(_,child)|child).collect()).unwrap_or_default();
                for child in &mut children {stop_download_child(child); }
                for (label,auxiliary) in window.app_handle().webview_windows() {
                    if label!="main" {let _=auxiliary.destroy();}
                }
            }
        })
        .run(context)
        .expect("error while running tauri application");
}
