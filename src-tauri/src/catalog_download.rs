//! Direct, artist-permitted Audius downloads. No subprocess or transcoding.
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
#[derive(Default)]
pub struct CatalogDownloads(pub Mutex<HashMap<String, Arc<CatalogCancel>>>);
#[derive(Default)]
pub struct CatalogCancel {flag:AtomicBool,signal:tokio::sync::Notify}
const AUDIO_EXTENSIONS: [&str; 6] = ["mp3", "flac", "ogg", "wav", "m4a", "aac"];
fn audio_extension(head: &[u8]) -> Option<&'static str> {
    if head.starts_with(b"fLaC") {
        Some("flac")
    } else if head.starts_with(b"OggS") {
        Some("ogg")
    } else if head.starts_with(b"RIFF") && head.get(8..12) == Some(b"WAVE".as_slice()) {
        Some("wav")
    } else if head.get(4..8) == Some(b"ftyp".as_slice()) {
        Some("m4a")
    } else if head.starts_with(b"ID3") {
        Some("mp3")
    } else if head.len() >= 2 && head[0] == 0xff && head[1] & 0xf6 == 0xf0 {
        Some("aac")
    } else if head.len() >= 2 && head[0] == 0xff && head[1] & 0xe0 == 0xe0 {
        Some("mp3")
    } else {
        None
    }
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn music_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let p = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("music");
    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}
fn used_bytes(dir: &std::path::Path) -> u64 {
    fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| {
            let n = e.file_name().to_string_lossy().to_string();
            n.starts_with("direct-")
                && (AUDIO_EXTENSIONS
                    .iter()
                    .any(|ext| n.ends_with(&format!(".{ext}")))
                    || n.ends_with(".part"))
        })
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}
fn allows_download(data: &serde_json::Value) -> bool {
    data["is_downloadable"] == true
        && data["is_download_gated"] != true
        && data["access"]["download"] != false
        && data["is_delete"] != true
}
#[tauri::command]
pub fn cancel_catalog_download(id: String, state: tauri::State<CatalogDownloads>) {
    if let Ok(jobs) = state.0.lock() {
        if let Some(cancel) = jobs.get(&id) {
            cancel.flag.store(true, Ordering::Relaxed);cancel.signal.notify_one();
        }
    }
}
#[tauri::command]
pub fn catalog_download_usage(app: tauri::AppHandle) -> Result<u64, String> {
    Ok(used_bytes(&music_dir(&app)?))
}
#[tauri::command]
pub async fn download_catalog_track(
    app: tauri::AppHandle,
    id: String,
    budget_mb: u32,
    proxy_mode: Option<String>,
    proxy_url: Option<String>,
) -> Result<serde_json::Value, String> {
    if !valid_id(&id) {
        return Err("Identificador musical no válido.".into());
    }
    let cancelled = Arc::new(CatalogCancel::default());
    {
        let state = app.state::<CatalogDownloads>();
        let mut jobs = state.0.lock().map_err(|_| "La cola está ocupada.")?;
        if !jobs.is_empty() {
            return Err("Espera a que termine la descarga actual.".into());
        }
        jobs.insert(id.clone(), cancelled.clone());
    }
    let dir = music_dir(&app);
    let result=tokio::select! { _=cancelled.signal.notified()=>Err("Descarga cancelada.".to_string()), result=async {
  let dir=dir?;
  for ext in AUDIO_EXTENSIONS {let existing=dir.join(format!("direct-{id}.{ext}"));if existing.exists(){return Ok(serde_json::json!({"path":existing.to_string_lossy(),"bytes":fs::metadata(&existing).map_err(|e|e.to_string())?.len()}));}}
  let client=crate::music_network::apply_proxy(reqwest::Client::builder().connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(180)).read_timeout(Duration::from_secs(30)).https_only(true),proxy_mode.as_deref(),proxy_url.as_deref())?.build().map_err(|e|e.to_string())?;
  let metadata:serde_json::Value=client.get(format!("https://api.audius.co/v1/tracks/{id}?app_name=APHEKA")).send().await.map_err(|_|"No se pudo consultar al proveedor.")?.error_for_status().map_err(|_|"La canción ya no está disponible.")?.json().await.map_err(|_|"Respuesta de catálogo no válida.")?;
  if !allows_download(&metadata["data"]){return Err("El artista no habilitó una descarga pública para esta grabación.".into());}
  if cancelled.flag.load(Ordering::Relaxed){return Err("Descarga cancelada.".into());}
  let mut response=client.get(format!("https://api.audius.co/v1/tracks/{id}/download?app_name=APHEKA&original=false")).send().await.map_err(|_|"No se pudo iniciar la descarga.")?.error_for_status().map_err(|_|"El proveedor no permite descargar esta canción ahora.")?;
  let part=dir.join(format!("direct-{id}.part"));
  // A previous interrupted transfer for this exact track may be replaced.
  if part.exists(){fs::remove_file(&part).map_err(|_|"No se pudo reiniciar la descarga anterior.")?;}
  let total=response.content_length().unwrap_or(0);let limit=128*1024*1024u64;
  let available=(budget_mb.clamp(64,4096) as u64*1024*1024).saturating_sub(used_bytes(&dir));
  if total>limit||total>available{return Err("No hay espacio dentro del límite de descargas. Amplía el límite o elimina una copia que ya no uses.".into());}
  // Only this single worker owns this exact partial path. Never remove other music.
  let mut file=OpenOptions::new().create(true).truncate(true).write(true).open(&part).map_err(|_|"No se pudo guardar el audio.")?;
  let mut bytes=0u64;let mut last=Instant::now();let mut signature=Vec::new();
  let transfer=async {
   while let Some(chunk)=response.chunk().await.map_err(|_|"Se interrumpió la conexión. Puedes reintentar.")? {
    if cancelled.flag.load(Ordering::Relaxed){return Err("Descarga cancelada.".to_string());}
    bytes+=chunk.len() as u64;if bytes>limit||bytes>available{return Err("Se alcanzó el límite de espacio configurado.".into());}
    if signature.len()<16 {signature.extend(chunk.iter().take(16-signature.len()));}
    file.write_all(&chunk).map_err(|_|"No se pudo escribir el archivo.")?;
    if last.elapsed()>Duration::from_millis(250){let _=app.emit("catalog-download-progress",serde_json::json!({"id":id,"bytes":bytes,"total":total}));last=Instant::now();}
   }
   if cancelled.flag.load(Ordering::Relaxed){return Err("Descarga cancelada.".into());}
   if bytes<128 || audio_extension(&signature).is_none(){return Err("El proveedor no entregó un formato de audio compatible.".into());}
   file.sync_all().map_err(|_|"No se pudo completar el guardado.")?;Ok(())
  }.await;
  drop(file);if let Err(error)=transfer{let _=fs::remove_file(&part);return Err(error);}
  let extension=audio_extension(&signature).ok_or("Formato de audio no compatible.")?;
  let final_path=dir.join(format!("direct-{id}.{extension}"));
  fs::rename(&part,&final_path).map_err(|_|"No se pudo finalizar el archivo.")?;
  Ok(serde_json::json!({"path":final_path.to_string_lossy(),"bytes":bytes}))
 }=>result };
    if result.is_err(){if let Ok(dir)=music_dir(&app){let _=fs::remove_file(dir.join(format!("direct-{id}.part")));}}
    if let Ok(mut jobs) = app.state::<CatalogDownloads>().0.lock() {
        jobs.remove(&id);
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn audio_uses_bytes_instead_of_provider_filename() {
        assert_eq!(audio_extension(b"fLaC\0\0\0"), Some("flac"));
        assert_eq!(audio_extension(b"ID3\0"), Some("mp3"));
        assert_eq!(audio_extension(b"RIFF1234WAVE"), Some("wav"));
        assert_eq!(audio_extension(b"OggS1234"), Some("ogg"));
        assert_eq!(audio_extension(b"1234ftypM4A "), Some("m4a"));
        assert_eq!(audio_extension(&[0xff, 0xf1]), Some("aac"));
        assert_eq!(audio_extension(&[0xff, 0xfb]), Some("mp3"));
        assert_eq!(audio_extension(b"<html>Error"), None);
    }
    #[test]
    fn ids_stay_in_music_dir() {
        for id in ["../x", "", "a/b", "C:\\x", "x.mp3"] {
            assert!(!valid_id(id));
        }
        assert!(valid_id("abc_123-Z"));
    }
    #[test]
    fn downloads_need_artist_permission() {
        assert!(!allows_download(
            &serde_json::json!({"access":{"download":true}})
        ));
        assert!(!allows_download(
            &serde_json::json!({"is_downloadable":true,"is_download_gated":true})
        ));
        assert!(allows_download(
            &serde_json::json!({"is_downloadable":true,"access":{"download":true}})
        ));
    }
}
