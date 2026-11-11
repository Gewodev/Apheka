use serde_json::{json,Value};
use std::time::Duration;
use tokio::sync::Semaphore;
static IMPORTS:Semaphore=Semaphore::const_new(1);
fn spotify_embed(html:&str,id:&str,url:&str,transport:&str,elapsed:u128)->Result<Value,String>{
 let marker=html.find("id=\"__NEXT_DATA__\"").ok_or("Spotify no publicó el listado en esta vista. No se inventarán canciones.")?;
 let rest=&html[marker..];let begin=rest.find('>').ok_or("Vista pública de Spotify no válida")?+1;
 let end=rest[begin..].find("</script>").ok_or("Vista pública de Spotify incompleta")?+begin;
 let root:Value=serde_json::from_str(&rest[begin..end]).map_err(|_|"No se pudieron leer los metadatos públicos de Spotify")?;
 let entity=&root["props"]["pageProps"]["state"]["data"]["entity"];
 if entity["type"]!="playlist"||entity["id"]!=id{return Err("Spotify devolvió una lista diferente; no se importó".into());}
 let rows=entity["trackList"].as_array().ok_or("Spotify no publicó canciones accesibles para esta lista")?;
 let entries:Vec<Value>=rows.iter().take(1000).filter_map(|row|{
  if row["entityType"]!="track"||row["isPlayable"]==false{return None;}
  let track=row["uri"].as_str()?.strip_prefix("spotify:track:")?;
  if track.len()!=22||!track.chars().all(|c|c.is_ascii_alphanumeric()){return None;}
  Some(json!({"id":format!("spotify:{track}"),"title":row["title"].as_str()?,"channel":row["subtitle"].as_str()?,"duration":row["duration"].as_f64().unwrap_or(0.0)/1000.0,"thumbnail":"","webpage_url":format!("https://open.spotify.com/track/{track}")}))
 }).collect();
 let cover=entity["visualIdentity"]["image"].as_array().and_then(|v|v.last()).and_then(|v|v["url"].as_str()).unwrap_or("");
 Ok(json!({"id":id,"title":entity["name"].as_str().unwrap_or("Lista de Spotify"),"thumbnail":cover,"webpage_url":url,"service":"spotify","entries":entries,"playlist_count":entity["totalCount"].as_u64().unwrap_or(0),"diagnostics":{"provider":"Spotify público","transport":transport,"pages":1,"elapsedMs":elapsed,"totalKnown":entity["totalCount"].is_u64(),"note":"Listado publicado en la vista pública. Spotify puede mostrar solo una parte de la lista."}}))
}
fn identity(value:&str)->Result<(&'static str,String),String>{
 let url=reqwest::Url::parse(value).map_err(|_|"Enlace de lista no válido")?;
 if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return Err("Usa un enlace HTTPS sin credenciales".into());}
 if matches!(url.host_str(),Some("www.youtube.com"|"youtube.com"|"music.youtube.com")){
  let id=url.query_pairs().find(|(k,_)|k=="list").map(|(_,v)|v.into_owned()).filter(|v|v.len()>=3&&v.len()<=160&&v.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-')).ok_or("Enlace de lista de YouTube no válido")?;
  return Ok((if url.host_str()==Some("music.youtube.com"){"youtubeMusic"}else{"youtube"},id));
 }
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
pub async fn read_external_playlist(window:tauri::WebviewWindow,url:String,access_token:Option<String>,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<Value,String>{
 if window.label()!="main"{return Err("Ventana no permitida".into());}
 read_playlist(url,access_token,proxy_mode,proxy_url).await
}
async fn read_playlist(url:String,access_token:Option<String>,proxy_mode:Option<String>,proxy_url:Option<String>)->Result<Value,String>{
 let (service,id)=identity(&url)?;
 let token=access_token.as_deref().filter(|v|!v.is_empty());
 let _permit=IMPORTS.try_acquire().map_err(|_|"Ya se está consultando una lista; espera a que termine")?;
 if matches!(service,"youtube"|"youtubeMusic"){return Err("Las listas de YouTube se revisan con el extractor nativo.".into());}
 if token.is_some_and(|v|v.len()>4096||v.chars().any(char::is_control)){return Err("Autorización no válida".into());}
 tokio::time::timeout(Duration::from_secs(75),async{
  let started=std::time::Instant::now();let client=crate::music_network::apply_proxy(reqwest::Client::builder().https_only(true).timeout(Duration::from_secs(12)).connect_timeout(Duration::from_secs(6)).redirect(reqwest::redirect::Policy::none()),proxy_mode.as_deref(),proxy_url.as_deref())?.build().map_err(|_|"No se pudo preparar la conexión de listas")?;
  if service=="spotify"&&token.is_none(){
   // Official public oEmbed API confirms the entity; the public embed publishes
   // its own track list. No cookies, anonymous-token minting or access bypass.
   let query=reqwest::Url::parse_with_params("https://open.spotify.com/oembed",&[("url",url.as_str())]).map_err(|_|"Enlace no válido")?;
   let meta=get(&client,query.to_string(),None).await?;
   if meta["provider_name"]!="Spotify"{return Err("El enlace no corresponde a Spotify".into());}
   let mut response=client.get(format!("https://open.spotify.com/embed/playlist/{id}")).send().await.map_err(|_|"No se pudo leer la vista pública de Spotify")?;
   if response.status()!=reqwest::StatusCode::OK{return Err("Spotify no permite leer esta lista públicamente. Usa un enlace público accesible de Deezer o YouTube Music.".into());}
   let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"La vista pública de Spotify se interrumpió")?{if bytes.len()+chunk.len()>2*1024*1024{return Err("La vista de Spotify supera el límite de lectura".into());}bytes.extend_from_slice(&chunk);}
   return spotify_embed(&String::from_utf8_lossy(&bytes),&id,&url,proxy_mode.as_deref().unwrap_or("system"),started.elapsed().as_millis());
  }
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
  Ok(json!({"id":id,"service":service,"title":root[if service=="deezer"{"title"}else{"name"}].as_str().unwrap_or("Lista importada"),"thumbnail":if service=="deezer"{root["picture_medium"].as_str()}else{root["images"][0]["url"].as_str()},"webpage_url":url,"entries":entries,"playlist_count":total,"diagnostics":{"provider":service,"transport":proxy_mode.as_deref().unwrap_or("system"),"pages":page,"elapsedMs":started.elapsed().as_millis()}}))
 }).await.map_err(|_|"La consulta de lista agotó el tiempo de espera; no se ha guardado una lista parcial".to_string())?
}
#[cfg(test)]mod tests{use super::*;#[test]fn fixed_services_only(){assert_eq!(identity("https://www.deezer.com/es/playlist/908622995").unwrap(),("deezer","908622995".into()));assert_eq!(identity("https://open.spotify.com/playlist/abc123").unwrap().0,"spotify");for s in ["http://deezer.com/playlist/1","https://evil.example/playlist/1","https://api.deezer.com/playlist/1","https://name:pass@deezer.com/playlist/1","https://deezer.com/playlist/../../x"]{assert!(identity(s).is_err());}}}

#[cfg(test)]mod public_tests{
 use super::*;
 #[test]fn public_list_is_bound_to_entity_and_tracks(){
  let entity=json!({"type":"playlist","id":"list1","name":"Mi lista","trackList":[
   {"entityType":"track","uri":"spotify:track:0123456789012345678901","title":"Colaboración","subtitle":"Uno, Dos","duration":180000,"isPlayable":true},
   {"entityType":"track","uri":"spotify:track:0123456789012345678902","title":"Bloqueada","subtitle":"Uno","isPlayable":false},
   {"entityType":"episode","uri":"spotify:episode:0123456789012345678901"}
  ]});
  let html=format!("<script id=\"__NEXT_DATA__\" type=\"application/json\">{}</script>",json!({"props":{"pageProps":{"state":{"data":{"entity":entity}}}}}));
  let value=spotify_embed(&html,"list1","https://open.spotify.com/playlist/list1","system",10).unwrap();
  assert_eq!(value["entries"].as_array().unwrap().len(),1);
  assert_eq!(value["entries"][0]["channel"],"Uno, Dos");assert_eq!(value["entries"][0]["duration"],180.0);
  assert_eq!(value["diagnostics"]["totalKnown"],false);
  assert!(spotify_embed(&html,"different","","system",0).is_err());assert!(spotify_embed("no data","list1","","system",0).is_err());
 }
 #[tokio::test]#[ignore="Requires live public services"]async fn open_playlist_services(){
  for url in ["https://www.deezer.com/playlist/908622995","https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"]{
   let result=read_playlist(url.into(),None,Some("system".into()),None).await;
   match result {Ok(value)=>{println!("PUBLIC {}: {} rows; {}",url,value["entries"].as_array().unwrap().len(),value["diagnostics"]);assert!(!value["entries"].as_array().unwrap().is_empty());},Err(error)=>panic!("PUBLIC {url}: {error}")}
  }
 }
}
