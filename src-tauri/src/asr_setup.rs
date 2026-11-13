//! Local dictation resources are prepared on demand.
//!
//! The installer does not carry the recognition models: the app downloads them
//! once, verifies every file against the signed manifest and keeps them in the
//! app data folder. Only ffmpeg (always bundled) decodes the recorded audio.
//!
//! Nothing is executed before its fingerprint matches, and a partial download
//! never replaces a working copy.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

const WHEEL_URL: &str = "https://files.pythonhosted.org/packages/ea/05/ad3457baa56170a13829c98327598a4d99d6cd4bdff8ae59df4c47ebdd11/moonshine_voice-0.1.5-py3-none-win_amd64.whl";
const WHEEL_SHA256: &str = "7fc9a84e827360ddb85c2735f44a1502c5575c27dcb476a2555646cd20a70e9d";
const MODEL_BASE: &str = "https://download.moonshine.ai/model/tiny-streaming-es/quantized_26_08_24";

/// Files taken from the official wheel, and where they live inside it.
const WHEEL_FILES: &[(&str, &str)] = &[
    ("moonshine.dll", "moonshine_voice/moonshine.dll"),
    ("onnxruntime.dll", "moonshine_voice/onnxruntime.dll"),
    ("LICENSE.txt", "moonshine_voice-0.1.5.dist-info/licenses/LICENSE"),
];

/// Model files published by the project, with their public address.
const MODEL_FILES: &[(&str, &str)] = &[
    ("model/adapter.ort", "adapter.ort"),
    ("model/cross_kv.ort", "cross_kv.ort"),
    ("model/decoder_kv.ort", "decoder_kv.ort"),
    ("model/encoder.ort", "encoder.ort"),
    ("model/frontend.model.ort", "frontend.model.ort"),
    ("model/frontend.weights.ort", "frontend.weights.ort"),
    ("model/streaming_config.json", "streaming_config.json"),
    ("model/tokenizer.bin", "tokenizer.bin"),
];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AsrStatus {
    /// True when every resource of the manifest is available and verified.
    pub ready: bool,
    /// Where the resources live.
    pub root: String,
    /// Files that still have to be prepared.
    pub missing: Vec<String>,
    /// Size of the pending download in bytes.
    pub bytes: u64,
}

fn manifest() -> serde_json::Value {
    serde_json::from_str(include_str!("../asr-manifest.json")).unwrap_or(serde_json::Value::Null)
}

/// The license notice travels with the installer and is not a runtime file.
const NOTICE_FILE: &str = "ONNX-LICENSE.txt";

fn manifest_files() -> Vec<(String, String, u64)> {
    manifest()["files"]
        .as_array()
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| {
                    let file = entry.get("file")?.as_str()?.to_string();
                    let sha = entry.get("sha256")?.as_str()?.to_string();
                    let bytes = entry.get("bytes").and_then(|v| v.as_u64()).unwrap_or(0);
                    Some((file, sha, bytes))
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Files the recognition engine needs at runtime.
fn runtime_files() -> Vec<(String, String, u64)> {
    manifest_files()
        .into_iter()
        .filter(|(file, _, _)| file != NOTICE_FILE)
        .collect()
}

/// The folder where the downloaded resources are kept.
pub fn asr_root(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|folder| folder.join("asr"))
}

/// Every place a resource can live: the prepared folder first, the bundled
/// notices second.
pub fn asr_roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(root) = asr_root(app) {
        roots.push(root);
    }
    if let Ok(resources) = app.path().resource_dir() {
        roots.push(resources.join("asr"));
    }
    roots
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|_| "No se pudo leer el recurso.".to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let read = file.read(&mut buffer).map_err(|_| "No se pudo leer el recurso.".to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Verify that every runtime resource of the manifest is present in one of the
/// roots. The result is cached by size and modification time, so a dictation
/// does not hash dozens of megabytes on every recording.
pub fn verify_roots(roots: &[PathBuf]) -> Result<(), String> {
    use std::sync::Mutex;
    static CACHE: Mutex<Option<(u64, u64)>> = Mutex::new(None);
    let files = runtime_files();
    let mut bytes = 0u64;
    let mut newest = 0u64;
    let mut found = Vec::with_capacity(files.len());
    for (file, expected, _) in &files {
        let Some(path) = roots.iter().find_map(|root| {
            let candidate = root.join(file);
            if candidate.is_file() {
                Some(candidate)
            } else {
                None
            }
        }) else {
            return Err("Faltan recursos del dictado.".to_string());
        };
        std::fs::metadata(&path)
            .map(|meta| {
                bytes += meta.len();
                let modified = meta
                    .modified()
                    .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|value| value.as_millis() as u64)
                    .unwrap_or(0);
                newest = newest.max(modified);
            })
            .unwrap_or_default();
        found.push((path, expected.clone()));
    }
    if let Ok(cache) = CACHE.lock() {
        if *cache == Some((bytes, newest)) {
            return Ok(());
        }
    }
    for (path, expected) in found {
        let actual = file_sha256(&path)?;
        if actual != expected {
            return Err("Un recurso del dictado está dañado.".to_string());
        }
    }
    if let Ok(mut cache) = CACHE.lock() {
        *cache = Some((bytes, newest));
    }
    Ok(())
}

fn status_for(app: &tauri::AppHandle) -> AsrStatus {
    let roots = asr_roots(app);
    let mut missing = Vec::new();
    let mut bytes = 0u64;
    for (file, _, size) in runtime_files() {
        let present = roots.iter().any(|root| root.join(&file).is_file());
        if !present {
            missing.push(file.clone());
            bytes += size;
        }
    }
    let ready = missing.is_empty() && verify_roots(&roots).is_ok();
    AsrStatus {
        ready,
        root: asr_root(app)
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default(),
        missing,
        bytes,
    }
}

#[tauri::command]
pub fn asr_status(app: tauri::AppHandle) -> AsrStatus {
    status_for(&app)
}

async fn download(url: &str, target: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|_| "No se pudo preparar la descarga.".to_string())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("No se pudo descargar el dictado: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("No se pudo descargar el dictado ({}).", response.status()));
    }
    let partial = target.with_extension("partial");
    let mut file = std::fs::File::create(&partial).map_err(|_| "No se pudo guardar el dictado.".to_string())?;
    let mut written = 0u64;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("La descarga del dictado se interrumpió: {e}"))?
    {
        written += chunk.len() as u64;
        if written > 400 * 1024 * 1024 {
            let _ = std::fs::remove_file(&partial);
            return Err("El archivo del dictado es demasiado grande.".to_string());
        }
        use std::io::Write;
        file.write_all(&chunk)
            .map_err(|_| "No se pudo guardar el dictado.".to_string())?;
    }
    use std::io::Write;
    file.flush().map_err(|_| "No se pudo guardar el dictado.".to_string())?;
    drop(file);
    std::fs::rename(&partial, target).map_err(|_| "No se pudo preparar el dictado.".to_string())?;
    Ok(())
}

/// Download and verify every pending resource of the local dictation.
#[tauri::command]
pub async fn asr_prepare(app: tauri::AppHandle) -> Result<AsrStatus, String> {
    let Some(root) = asr_root(&app) else {
        return Err("No se pudo localizar la carpeta de datos.".to_string());
    };
    let status = status_for(&app);
    if status.ready {
        return Ok(status);
    }
    std::fs::create_dir_all(root.join("model"))
        .map_err(|_| "No se pudo preparar la carpeta del dictado.".to_string())?;
    let expected = manifest_files();
    let total = expected.len() as u64;

    // The runtime libraries travel inside the official wheel.
    if status.missing.iter().any(|file| WHEEL_FILES.iter().any(|(name, _)| name == file)) {
        let wheel = std::env::temp_dir().join("apheka-moonshine.whl");
        download(WHEEL_URL, &wheel).await?;
        let digest = file_sha256(&wheel)?;
        if digest != WHEEL_SHA256 {
            let _ = std::fs::remove_file(&wheel);
            return Err("El paquete del dictado no coincide con la huella esperada.".to_string());
        }
        let file = std::fs::File::open(&wheel).map_err(|_| "No se pudo leer el paquete del dictado.".to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|_| "El paquete del dictado está dañado.".to_string())?;
        for (name, inner) in WHEEL_FILES {
            if !status.missing.iter().any(|file| file == name) {
                continue;
            }
            let mut entry = archive
                .by_name(inner)
                .map_err(|_| "El paquete del dictado está incompleto.".to_string())?;
            let target = root.join(name);
            if let Some(parent) = target.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let mut output = std::fs::File::create(&target)
                .map_err(|_| "No se pudo guardar el dictado.".to_string())?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|_| "No se pudo guardar el dictado.".to_string())?;
        }
        let _ = std::fs::remove_file(&wheel);
    }

    let mut done = 0u64;
    for (name, inner) in MODEL_FILES {
        if !status.missing.iter().any(|file| file == name) {
            done += 1;
            continue;
        }
        let url = format!("{MODEL_BASE}/{inner}");
        let target = root.join(name);
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        download(&url, &target).await?;
        done += 1;
        let _ = app.emit(
            "asr-prepare-progress",
            serde_json::json!({ "done": done, "total": total }),
        );
    }

    let roots = asr_roots(&app);
    verify_roots(&roots)?;
    Ok(status_for(&app))
}
