from pathlib import Path
p=Path('src-tauri/src/main.rs');s=p.read_text('utf-8').replace('mod playlist_import;','mod playlist_import;\nmod playlist_service;').replace('playlist_import::read_external_playlist,','playlist_import::read_external_playlist,\n            playlist_service::playlist_service_status,playlist_service::playlist_service_save,');p.write_text(s,'utf-8')
p=Path('src-tauri/src/playlist_import.rs');s=p.read_text('utf-8');s=s.replace(' let parts:Vec<_>=', ''' if matches!(url.host_str(),Some("www.youtube.com"|"youtube.com"|"music.youtube.com")){
  let id=url.query_pairs().find(|(k,_)|k=="list").map(|(_,v)|v.into_owned()).filter(|v|v.len()>=3&&v.len()<=160&&v.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-')).ok_or("Enlace de lista de YouTube no válido")?;
  return Ok((if url.host_str()==Some("music.youtube.com"){"youtubeMusic"}else{"youtube"},id));
 }
 let parts:Vec<_>=''');s=s.replace('access_token:Option<String>)->','access_token:Option<String>,proxy_mode:Option<String>,proxy_url:Option<String>,use_service:Option<bool>)->')
s=s.replace(' if service=="spotify"&&token.is_none()', ' let third_party=use_service.unwrap_or(false);\n if third_party{return tokio::time::timeout(Duration::from_secs(75),crate::playlist_service::inspect(window.app_handle(),&url,service,&id,proxy_mode.as_deref(),proxy_url.as_deref())).await.map_err(|_|"MusicAPI agotó el tiempo de consulta".to_string())?;}\n if matches!(service,"youtube"|"youtubeMusic"){return Err("Usa la lectura nativa de YouTube o configura el intermediario de listas".into());}\n if service=="spotify"&&token.is_none()')
start=s.index('  let client=reqwest::Client::builder()');end=s.index('\n  let base=',start);s=s[:start]+'  let started=std::time::Instant::now();let client=crate::playlist_service::client(proxy_mode.as_deref(),proxy_url.as_deref())?;'+s[end:]
s=s.replace('"entries":entries,"playlist_count":total','"entries":entries,"playlist_count":total,"diagnostics":{"provider":service,"transport":proxy_mode.as_deref().unwrap_or("system"),"pages":page,"elapsedMs":started.elapsed().as_millis()}')
# Both direct and intermediary queries share the same bounded request slot.
s=s.replace(' let third_party=',' let _permit=IMPORTS.try_acquire().map_err(|_|"Ya se está consultando una lista; espera a que termine")?;\n let third_party=',1)
s=s.replace(' let _permit=IMPORTS.try_acquire().map_err(|_|"Ya se está consultando una lista; espera a que termine")?;\n tokio::time::timeout',' tokio::time::timeout',1)
p.write_text(s,'utf-8')
