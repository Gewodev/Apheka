use serde_json::{json,Value};
use std::time::Duration;
use tokio::sync::Semaphore;
static IMPORTS:Semaphore=Semaphore::const_new(1);
fn identity(value:&str)->Result<(&'static str,String),String>{
 let url=reqwest::Url::parse(value).map_err(|_|"Enlace de lista no válido")?;
 if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return Err("Usa un enlace HTTPS sin credenciales".into());}
 let parts:Vec<_>=url.path_segments().ok_or("Enlace de lista no válido")?.collect();
 let pos=parts.iter().position(|v|*v=="playlist").ok_or("Pega el enlace de una lista de reproducción")?;
 let id=parts.get(pos+1).filter(|id|!id.is_empty()&&id.len()<=64&&id.chars().all(|c|c.is_ascii_alphanumeric())).ok_or("Identificador de lista no válido")?.to_string();
 match url.host_str(){Some("www.deezer.com"|"deezer.com") if id.chars().all(|c|c.is_ascii_digit())=>Ok(("deezer",id)),Some("open.spotify.com")=>Ok(("spotify",id)),_=>Err("Este servicio no está disponible para importar listas".into())}
}
async fn get(client:&reqwest::Client,url:String,token:Option<&str>)->Result<Value,String>{
 let mut request=client.get(url);if let Some(token)=token{request=request.bearer_auth(token);}
 let mut response=request.send().await.map_err(|_|"No se pudo conectar con el servicio de listas")?;
 match response.status().as_u16(){401|403=>return Err("El servicio requiere autorización válida para esta lista. No se ha importado ninguna canción.".into()),429=>return Err("El servicio alcanzó su límite de consultas. Espera antes de reintentar.".into()),200=>{},_=>return Err(format!("El servicio no pudo entregar la lista (HTTP {})",response.status().as_u16()))}
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"La lectura de la lista se interrumpió")?{if bytes.len()+chunk.len()>2*1024*1024{return Err("La página de la lista supera el límite de lectura".into());}bytes.extend_from_slice(&chunk);}
 let value:Value=serde_json::from_slice(&bytes).map_err(|_|"El servicio no entregó datos de lista válidos")?;
 if value.get("error").is_some(){return Err("La lista no es pública o el servicio no permite consultarla".into());}Ok(value)
}
#[tauri::command]
pub async fn read_external_playlist(window:tauri::WebviewWindow,url:String,access_token:Option<String>)->Result<Value,String>{
 if window.label()!="main"{return Err("Ventana no permitida".into());}
 let (service,id)=identity(&url)?;
 let token=access_token.as_deref().filter(|v|!v.is_empty());
 if service=="spotify"&&token.is_none(){return Err("Spotify requiere un token de acceso con permiso para leer esta lista. Pégalo en Autorización de Spotify; no se guarda. También puedes importar el enlace público equivalente de YouTube Music o Deezer.".into());}
 if token.is_some_and(|v|v.len()>4096||v.chars().any(char::is_control)){return Err("Autorización no válida".into());}
 let _permit=IMPORTS.try_acquire().map_err(|_|"Ya se está consultando una lista; espera a que termine")?;
 tokio::time::timeout(Duration::from_secs(75),async{
  let client=reqwest::Client::builder().https_only(true).timeout(Duration::from_secs(12)).connect_timeout(Duration::from_secs(6)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"No se pudo preparar la conexión de listas")?;
  let base=if service=="deezer"{format!("https://api.deezer.com/playlist/{id}")}else{format!("https://api.spotify.com/v1/playlists/{id}")};
  let root=get(&client,base,if service=="spotify"{token}else{None}).await?;
  let total=if service=="deezer"{root["nb_tracks"].as_u64()}else{root["items"]["total"].as_u64().or_else(||root["tracks"]["total"].as_u64())}.unwrap_or(0);
  let mut entries=Vec::new();let mut page=0;
  loop {
   let url=if service=="deezer"{format!("https://api.deezer.com/playlist/{id}/tracks?limit=100&index={}",page*100)}else{format!("https://api.spotify.com/v1/playlists/{id}/items?limit=50&offset={}",page*50)};
   let data=get(&client,url,if service=="spotify"{token}else{None}).await?;
   let rows=data[if service=="deezer"{"data"}else{"items"}].as_array().ok_or("La lista no contiene canciones accesibles")?;
   for row in rows{
    let t=if service=="deezer"{row}else{row.get("item").or_else(||row.get("track")).unwrap_or(row)};
    if t.is_null()||t["type"].as_str().is_some_and(|k|k!="track"){continue;}
    let title=t[if service=="deezer"{"title"}else{"name"}].as_str().unwrap_or("");if title.is_empty(){continue;}
    let artist=if service=="deezer"{t["artist"]["name"].as_str().unwrap_or("").to_string()}else{t["artists"].as_array().map(|a|a.iter().filter_map(|v|v["name"].as_str()).collect::<Vec<_>>().join(", ")).unwrap_or_default()};
    let cover=if service=="deezer"{t["album"]["cover_medium"].as_str()}else{t["album"]["images"][0]["url"].as_str()}.unwrap_or("");
    entries.push(json!({"id":format!("{}:{}",service,t["id"].as_str().map(str::to_owned).unwrap_or_else(||t["id"].to_string())),"title":title,"channel":artist,"duration":if service=="deezer"{t["duration"].as_f64().unwrap_or(0.0)}else{t["duration_ms"].as_f64().unwrap_or(0.0)/1000.0},"thumbnail":cover,"webpage_url":t["link"].as_str().or_else(||t["external_urls"]["spotify"].as_str()).unwrap_or("")}));
   }
   page+=1;if data["next"].is_null()||rows.is_empty()||page>=20{break;}
  }
  Ok(json!({"id":id,"service":service,"title":root[if service=="deezer"{"title"}else{"name"}].as_str().unwrap_or("Lista importada"),"thumbnail":if service=="deezer"{root["picture_medium"].as_str()}else{root["images"][0]["url"].as_str()},"webpage_url":url,"entries":entries,"playlist_count":total}))
 }).await.map_err(|_|"La consulta de lista agotó el tiempo de espera; no se ha guardado una lista parcial".to_string())?
}
#[cfg(test)]mod tests{use super::*;#[test]fn fixed_services_only(){assert_eq!(identity("https://www.deezer.com/es/playlist/908622995").unwrap(),("deezer","908622995".into()));assert_eq!(identity("https://open.spotify.com/playlist/abc123").unwrap().0,"spotify");for s in ["http://deezer.com/playlist/1","https://evil.example/playlist/1","https://api.deezer.com/playlist/1","https://name:pass@deezer.com/playlist/1","https://deezer.com/playlist/../../x"]{assert!(identity(s).is_err());}}}
