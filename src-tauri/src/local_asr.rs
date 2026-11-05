//! Offline Spanish dictation. Models live only in a cancellable child process.
use base64::Engine;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    ffi::{c_char, c_void, CStr, CString},
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::Manager;
static JOBS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
fn jobs() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    JOBS.get_or_init(Default::default)
}
fn main_only(w: &tauri::WebviewWindow) -> Result<(), String> {
    if w.label() == "main" {
        Ok(())
    } else {
        Err("Dictado disponible solo en la ventana principal.".into())
    }
}
struct TempAudio(PathBuf);
impl Drop for TempAudio {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn run(
    mut command: Command,
    cancel: &AtomicBool,
    seconds: u64,
    failure: &str,
) -> Result<Vec<u8>, String> {
    command
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .stdout(Stdio::piped());
    crate::quiet(&mut command);
    let mut child = command
        .spawn()
        .map_err(|_| "No se pudo iniciar el dictado local.")?;
    // Drain concurrently so even an unexpected native log cannot block a full pipe.
    let stdout = child
        .stdout
        .take()
        .ok_or("No se pudo recibir la transcripción.")?;
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stdout.take(131072).read_to_end(&mut bytes);
        bytes
    });
    let started = Instant::now();
    let status = loop {
        if cancel.load(Ordering::Relaxed) || started.elapsed() > Duration::from_secs(seconds) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            return Err(if cancel.load(Ordering::Relaxed) {
                "Dictado cancelado."
            } else {
                "El dictado tardó demasiado. Prueba con una grabación más corta."
            }
            .into());
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => std::thread::sleep(Duration::from_millis(40)),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = reader.join();
                return Err("El dictado se interrumpió.".into());
            }
        }
    };
    let bytes = reader.join().unwrap_or_default();
    if !status.success() {
        if let Ok(value) = serde_json::from_slice::<Value>(&bytes) {
            if let Some(error) = value["error"].as_str() {
                return Err(error.chars().take(500).collect());
            }
        }
        return Err(format!(
            "{} (código {}).",
            failure,
            status.code().unwrap_or(-1)
        ));
    }
    Ok(bytes)
}
#[tauri::command]
pub fn charvis_asr_cancel(window: tauri::WebviewWindow, request_id: String) -> Result<(), String> {
    main_only(&window)?;
    if let Some(flag) = jobs()
        .lock()
        .map_err(|_| "Dictado ocupado.")?
        .get(&request_id)
    {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}
#[tauri::command]
pub async fn charvis_local_transcribe(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    request_id: String,
    audio_base64: String,
) -> Result<Value, String> {
    main_only(&window)?;
    if uuid::Uuid::parse_str(&request_id).is_err() || audio_base64.len() > 25 * 1024 * 1024 {
        return Err("Grabación fuera de los límites del dictado.".into());
    }
    let flag = Arc::new(AtomicBool::new(false));
    {
        let mut active = jobs().lock().map_err(|_| "Dictado ocupado.")?;
        if !active.is_empty() {
            return Err("Espera a que termine el dictado anterior.".into());
        }
        active.insert(request_id.clone(), flag.clone());
    }
    let id = request_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(audio_base64)
            .map_err(|_| "Audio no válido.")?;
        if bytes.is_empty() || bytes.len() > 18 * 1024 * 1024 {
            return Err("La grabación está vacía o es demasiado grande.".into());
        }
        let root = app
            .path()
            .resource_dir()
            .map_err(|_| "No se encontró el dictado local.")?
            .join("asr");
        let root = if root.is_dir() {
            root
        } else if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/asr")
        } else {
            return Err("Reinstala APHEKA para recuperar el dictado local.".into());
        };
        let temp_path = std::env::temp_dir().join(format!("apheka-asr-{id}"));
        std::fs::create_dir(&temp_path).map_err(|_| "No se pudo preparar el audio.")?;
        let temp = TempAudio(temp_path);
        let input = temp.0.join("input.audio");
        let pcm = temp.0.join("voice.f32");
        std::fs::write(&input, bytes).map_err(|_| "No se pudo preparar el audio.")?;
        let mut decode = Command::new(crate::resolve_binary(&app, "ffmpeg")?);
        decode
            .args(["-nostdin", "-v", "error", "-threads", "1", "-i"])
            .arg(&input)
            .args([
                "-t", "181", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le",
            ])
            .arg(&pcm);
        run(
            decode,
            &flag,
            25,
            "No se pudo leer la grabación. Prueba a grabar de nuevo",
        )?;
        if std::fs::metadata(&pcm)
            .map_err(|_| "No hay audio legible.")?
            .len()
            > 180 * 16000 * 4
        {
            return Err("El dictado admite hasta tres minutos por grabación.".into());
        }
        let mut worker =
            Command::new(std::env::current_exe().map_err(|_| "No se pudo iniciar el dictado.")?);
        worker
            .arg("--apheka-asr-worker")
            .arg(&root)
            .arg(&pcm)
            .env("MOONSHINE_ORT_SINGLE_THREAD", "1")
            .env("OMP_NUM_THREADS", "1");
        let out = run(
            worker,
            &flag,
            100,
            "El motor de dictado se cerró antes de terminar",
        )?;
        let value: Value =
            serde_json::from_slice(&out).map_err(|_| "El dictado no devolvió texto válido.")?;
        if value["text"].as_str().unwrap_or("").trim().is_empty() {
            return Err("No se reconoció voz. El audio se conserva para reintentar.".into());
        }
        Ok(value)
    })
    .await
    .map_err(|_| "El dictado local se interrumpió.".to_string())
    .and_then(|v| v);
    if let Ok(mut active) = jobs().lock() {
        active.remove(&request_id);
    }
    result
}
fn verify(root: &Path) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    let manifest: Value = serde_json::from_str(include_str!("../asr-manifest.json"))
        .map_err(|_| "Manifiesto de dictado no válido.")?;
    for entry in manifest["files"]
        .as_array()
        .ok_or("Manifiesto incompleto.")?
    {
        let path = root.join(entry["file"].as_str().ok_or("Recurso no válido.")?);
        let mut file = std::fs::File::open(path).map_err(|_| "Faltan recursos del dictado.")?;
        let mut hash = Sha256::new();
        let mut buf = [0u8; 65536];
        loop {
            let n = file
                .read(&mut buf)
                .map_err(|_| "No se pudo verificar el dictado.")?;
            if n == 0 {
                break;
            }
            hash.update(&buf[..n]);
        }
        if format!("{:x}", hash.finalize()) != entry["sha256"].as_str().unwrap_or("") {
            return Err("Un recurso del dictado está dañado. Reinstala APHEKA.".into());
        }
    }
    Ok(())
}
#[repr(C)]
struct Line {
    text: *const c_char,
    audio: *const f32,
    audio_count: usize,
    start: f32,
    duration: f32,
    id: u64,
    flags: [i8; 5],
    spans: *const c_void,
    span_count: u64,
    latency: u32,
    words: *const c_void,
    word_count: u64,
}
#[repr(C)]
struct Transcript {
    lines: *const Line,
    count: u64,
}
fn transcribe(root: &Path, pcm: &Path) -> Result<Value, String> {
    verify(root)?;
    let bytes = std::fs::read(pcm).map_err(|_| "Audio no disponible.")?;
    if bytes.is_empty() || bytes.len() % 4 != 0 || bytes.len() > 180 * 16000 * 4 {
        return Err("Audio fuera de límites.".into());
    }
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    if samples.iter().any(|x| !x.is_finite()) {
        return Err("Audio no válido.".into());
    }
    assert_eq!(std::mem::size_of::<Line>(), 88);
    let model_path = root.join("model");
    // The native PathResolver may return a verbatim Windows path. Moonshine
    // uses legacy file APIs, so adapt only the FFI path, preserving Unicode.
    let path = CString::new(dunce::simplified(&model_path).to_string_lossy().as_bytes())
        .map_err(|_| "Ruta de modelo no válida.")?;
    unsafe {
        let _ort = libloading::Library::new(root.join("onnxruntime.dll"))
            .map_err(|_| "No se pudo cargar el motor de voz.")?;
        let lib = libloading::Library::new(root.join("moonshine.dll"))
            .map_err(|_| "No se pudo cargar el dictado.")?;
        let load: libloading::Symbol<
            unsafe extern "C" fn(*const c_char, u32, *const c_void, u64, i32) -> i32,
        > = lib
            .get(b"moonshine_load_transcriber_from_files\0")
            .map_err(|_| "Motor incompatible.")?;
        let free: libloading::Symbol<unsafe extern "C" fn(i32)> = lib
            .get(b"moonshine_free_transcriber\0")
            .map_err(|_| "Motor incompatible.")?;
        let infer: libloading::Symbol<
            unsafe extern "C" fn(i32, *const f32, u64, i32, u32, *mut *const Transcript) -> i32,
        > = lib
            .get(b"moonshine_transcribe_without_streaming\0")
            .map_err(|_| "Motor incompatible.")?;
        let handle = load(path.as_ptr(), 2, std::ptr::null(), 0, 30000);
        if handle < 0 {
            return Err("No se pudo abrir el modelo español.".into());
        }
        let mut transcript = std::ptr::null();
        let status = infer(
            handle,
            samples.as_ptr(),
            samples.len() as u64,
            16000,
            0,
            &mut transcript,
        );
        let mut lines = Vec::new();
        if status == 0 && !transcript.is_null() {
            let t = &*transcript;
            if t.count <= 2000 && !t.lines.is_null() {
                for line in std::slice::from_raw_parts(t.lines, t.count as usize) {
                    if !line.text.is_null() {
                        lines.push(
                            CStr::from_ptr(line.text)
                                .to_string_lossy()
                                .trim()
                                .to_owned(),
                        );
                    }
                }
            }
        }
        free(handle);
        if status != 0 {
            return Err("No se pudo transcribir esta grabación.".into());
        }
        Ok(json!({"text":lines.join(" "),"language":"es","engine":"moonshine-local"}))
    }
}
pub fn stop_all() {
    if let Ok(active) = jobs().lock() {
        for flag in active.values() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}
pub fn worker_main() {
    let args: Vec<_> = std::env::args_os().collect();
    let result = if args.len() == 4 {
        transcribe(Path::new(&args[2]), Path::new(&args[3]))
    } else {
        Err("Argumentos de dictado no válidos.".into())
    };
    match result {
        Ok(value) => println!("{}", value),
        Err(error) => {
            println!("{}", json!({"error":error}));
            std::process::exit(1);
        }
    }
}
