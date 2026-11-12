from pathlib import Path
p=Path('src/components/music/MusicLinkImport.tsx');s=p.read_text(encoding='utf-8');s=s.replace('}<button className="btn-primary" disabled={busy||!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addToDownloadQueue','}{items.every(item=>youtubeLink(target(item)))&&<button className="btn-primary" disabled={busy||!selected.length} onClick={()=>{for(const item of items.filter(item=>selected.includes(target(item))))a.addToDownloadQueue');s=s.replace('<Download size={15}/>Descargar selección</button></footer>','<Download size={15}/>Descargar selección</button>}</footer>');p.write_text(s,encoding='utf-8')
p=Path('src-tauri/src/playlist_import.rs');s=p.read_text(encoding='utf-8');s+='''
#[cfg(test)]mod public_tests{
 use super::*;
 #[test]fn public_list_is_bound_to_entity_and_tracks(){
  let entity=json!({"type":"playlist","id":"list1","name":"Mi lista","trackList":[
   {"entityType":"track","uri":"spotify:track:0123456789012345678901","title":"Colaboración","subtitle":"Uno, Dos","duration":180000,"isPlayable":true},
   {"entityType":"track","uri":"spotify:track:0123456789012345678902","title":"Bloqueada","subtitle":"Uno","isPlayable":false},
   {"entityType":"episode","uri":"spotify:episode:0123456789012345678901"}
  ]});
  let html=format!("<script id=\\"__NEXT_DATA__\\" type=\\"application/json\\">{}</script>",json!({"props":{"pageProps":{"state":{"data":{"entity":entity}}}}}));
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
''';p.write_text(s,encoding='utf-8')
