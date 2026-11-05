use serde::Serialize;
use std::{collections::HashMap,sync::Mutex,time::{Duration,Instant}};
pub struct MusicNetwork {
    clients:Mutex<HashMap<String,(Instant,reqwest::Client)>>,
    requests:Mutex<HashMap<String,tokio::sync::oneshot::Sender<()>>>,
    permits:tokio::sync::Semaphore,
    lyric_permits:tokio::sync::Semaphore,
}
impl Default for MusicNetwork {fn default()->Self{Self{clients:Mutex::new(HashMap::new()),requests:Mutex::new(HashMap::new()),permits:tokio::sync::Semaphore::new(3),lyric_permits:tokio::sync::Semaphore::new(2)}}}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct CatalogResponse {status:u16,body:String,content_type:String}
fn catalog_target(value:&str)->Result<reqwest::Url,String>{
    let url=reqwest::Url::parse(value).map_err(|_|"Dirección de catálogo no válida")?;
    if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return Err("El catálogo requiere HTTPS sin credenciales en la dirección".into());}
    let permitted=match url.host_str().unwrap_or_default(){
        "music.youtube.com"|"www.youtube.com"=>url.path().starts_with("/youtubei/")||url.path()=="/sw.js_data",
        "itunes.apple.com"=>matches!(url.path(),"/search"|"/lookup"),
        "api.audius.co"=>url.path().starts_with("/v1/")&&!url.path().contains("/stream")&&!url.path().contains("/download"),
        "lrclib.net"=>url.path().starts_with("/api/"),
        "api.lyrics.ovh"=>url.path().starts_with("/v1/")&&url.path().split('/').count()==4,
        _=>false,
    };
    if !permitted{return Err("Destino de catálogo no permitido".into());}Ok(url)
}
fn proxy_address(value:&str)->Result<String,String>{
    let url=reqwest::Url::parse(value.trim()).map_err(|_|"Escribe un proxy HTTP o HTTPS válido, con su puerto")?;
    if !matches!(url.scheme(),"http"|"https")||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some()||!matches!(url.path(),""|"/")||url.query().is_some()||url.fragment().is_some(){return Err("Usa un proxy sin credenciales en la dirección. La autenticación se configura en el proxy del sistema.".into());}Ok(url.to_string())
}
pub fn proxy_value(mode:Option<&str>,proxy:Option<&str>)->Result<Option<String>,String>{match mode.unwrap_or("system"){"system"=>Ok(None),"direct"=>Ok(Some(String::new())),"custom"=>proxy_address(proxy.unwrap_or_default()).map(Some),_=>Err("Modo de conexión no válido".into())}}
pub fn apply_proxy(builder:reqwest::ClientBuilder,mode:Option<&str>,proxy:Option<&str>)->Result<reqwest::ClientBuilder,String>{match proxy_value(mode,proxy)?{None=>Ok(builder),Some(value) if value.is_empty()=>Ok(builder.no_proxy()),Some(value)=>Ok(builder.proxy(reqwest::Proxy::all(value).map_err(|_|"No se pudo configurar ese proxy")?))}}
async fn request(state:&MusicNetwork,url:String,method:String,headers:HashMap<String,String>,body:Option<Vec<u8>>,mode:Option<String>,proxy:Option<String>)->Result<CatalogResponse,String>{
    let url=catalog_target(&url)?;
    if !matches!(method.as_str(),"GET"|"POST"){return Err("Método de catálogo no permitido".into());}
    if body.as_ref().map_or(false,|b|b.len()>512*1024){return Err("La consulta supera el tamaño permitido".into());}
    let normalized=proxy_value(mode.as_deref(),proxy.as_deref())?;let key=format!("{}:{}",mode.as_deref().unwrap_or("system"),normalized.as_deref().unwrap_or_default());
    let client={let mut clients=state.clients.lock().map_err(|_|"No se pudo preparar la conexión")?;
        if let Some((time,client))=clients.get_mut(&key).filter(|(time,_)|time.elapsed()<Duration::from_secs(900)){*time=Instant::now();client.clone()}else{
            let builder=reqwest::Client::builder().https_only(true).timeout(Duration::from_secs(20)).connect_timeout(Duration::from_secs(8)).pool_idle_timeout(Duration::from_secs(30)).redirect(reqwest::redirect::Policy::custom(|attempt|{if attempt.previous().len()>=3||catalog_target(attempt.url().as_str()).is_err(){attempt.stop()}else{attempt.follow()}}));
            let client=apply_proxy(builder,mode.as_deref(),proxy.as_deref())?.build().map_err(|_|"No se pudo preparar la conexión HTTPS")?;
            if clients.len()>=3{clients.clear();}clients.insert(key,(Instant::now(),client.clone()));client
        }
    };
    let lyric_request=matches!(url.host_str(),Some("lrclib.net"|"api.lyrics.ovh"));
    let mut req=client.request(if method=="POST"{reqwest::Method::POST}else{reqwest::Method::GET},url);if lyric_request{req=req.timeout(Duration::from_secs(7));}
    // Authentication, cookies and arbitrary headers never cross this public-catalog bridge.
    for (name,value) in headers{let name=name.to_ascii_lowercase();if matches!(name.as_str(),"accept"|"accept-language"|"content-type"|"origin"|"referer"|"user-agent"|"x-origin"|"x-goog-visitor-id")||name.starts_with("x-youtube-client-"){req=req.header(name,value);}}
    if let Some(body)=body{req=req.body(body);}
    let mut response=req.send().await.map_err(|error|if error.is_timeout(){"La conexión con el catálogo agotó el tiempo de espera. Revisa la red o el proxy.".to_string()}else if error.is_connect(){"No se pudo conectar con el catálogo. Revisa la red o el proxy.".to_string()}else{"La conexión HTTPS con el catálogo no se pudo completar.".to_string()})?;
    let status=response.status().as_u16();let content_type=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v|v.to_str().ok()).unwrap_or("application/json").to_string();let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_|"La respuesta del catálogo se interrumpió")?{if bytes.len()+chunk.len()>6*1024*1024{return Err("La respuesta del catálogo supera el tamaño permitido".into());}bytes.extend_from_slice(&chunk);}
    Ok(CatalogResponse{status,body:String::from_utf8_lossy(&bytes).into_owned(),content_type})
}
#[tauri::command]
pub fn cancel_music_catalog_request(window:tauri::WebviewWindow,state:tauri::State<'_,MusicNetwork>,request_id:String)->Result<(),String>{if window.label()!="main"{return Err("Ventana no permitida".into());}if let Some(cancel)=state.requests.lock().map_err(|_|"Conexión ocupada")?.remove(&request_id){let _=cancel.send(());}Ok(())}
#[tauri::command]
pub async fn music_catalog_request(window:tauri::WebviewWindow,state:tauri::State<'_,MusicNetwork>,url:String,method:String,headers:HashMap<String,String>,body:Option<Vec<u8>>,proxy_mode:Option<String>,proxy_url:Option<String>,request_id:Option<String>)->Result<CatalogResponse,String>{
    if window.label()!="main"{return Err("La conexión musical solo está disponible en la ventana principal".into());}
    let is_lyric=matches!(catalog_target(&url)?.host_str(),Some("lrclib.net"|"api.lyrics.ovh"));
    let id=request_id.unwrap_or_else(||uuid::Uuid::new_v4().to_string());if id.is_empty()||id.len()>64||!id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'){return Err("Consulta no válida".into());}
    let (sender,cancelled)=tokio::sync::oneshot::channel();{let mut requests=state.requests.lock().map_err(|_|"Conexión ocupada")?;if requests.len()>=8||requests.contains_key(&id){return Err("Hay varias consultas en curso. Vuelve a intentarlo en un instante.".into());}requests.insert(id.clone(),sender);}
    let result=tokio::select!{_ = cancelled=>Err("Consulta cancelada".into()),value=tokio::time::timeout(Duration::from_secs(if is_lyric{10}else{24}),async{let slots=if is_lyric{&state.lyric_permits}else{&state.permits};let _permit=slots.acquire().await.map_err(|_|"Conexión cerrada")?;request(&state,url,method,headers,body,proxy_mode,proxy_url).await})=>value.unwrap_or_else(|_|Err("El catálogo agotó el tiempo de espera de esta consulta.".into()))};
    if let Ok(mut requests)=state.requests.lock(){requests.remove(&id);}result
}
#[cfg(test)]
mod tests{use super::*;
    #[test]fn destinations_are_scoped(){assert!(catalog_target("https://music.youtube.com/youtubei/v1/search").is_ok());assert!(catalog_target("https://api.lyrics.ovh/v1/Artist/Track").is_ok());for url in ["http://music.youtube.com/youtubei/v1/search","https://127.0.0.1/private","https://music.youtube.com.evil.test/youtubei/v1/search","https://api.audius.co/v1/tracks/x/stream"]{assert!(catalog_target(url).is_err());}}
    #[test]fn explicit_proxy_has_no_embedded_secrets(){assert!(proxy_address("http://127.0.0.1:8080").is_ok());for url in ["file:///c:/data","http://user:secret@proxy:8080","http://proxy:8080/path"]{assert!(proxy_address(url).is_err());}}
    #[test]fn proxy_modes_keep_their_meaning(){assert_eq!(proxy_value(None,None).unwrap(),None);assert_eq!(proxy_value(Some("direct"),None).unwrap(),Some(String::new()));assert_eq!(proxy_value(Some("custom"),Some("http://127.0.0.1:8080")).unwrap(),Some("http://127.0.0.1:8080/".into()));assert!(proxy_value(Some("unknown"),None).is_err());}
}
