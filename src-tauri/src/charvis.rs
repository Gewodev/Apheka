//! Charvis uses fixed provider routes. Credentials never enter localStorage or tool context.
use serde_json::{json,Value};
use std::{collections::HashMap,sync::Mutex,time::Duration};

pub struct CharvisState{client:Result<reqwest::Client,reqwest::Error>,requests:Mutex<HashMap<String,tokio::sync::oneshot::Sender<()>>>,slots:tokio::sync::Semaphore}
impl Default for CharvisState{fn default()->Self{Self{client:reqwest::Client::builder().https_only(true).redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(8)).timeout(Duration::from_secs(90)).pool_idle_timeout(Duration::from_secs(90)).build(),requests:Mutex::new(HashMap::new()),slots:tokio::sync::Semaphore::new(2)}}}
fn base(provider:&str)->Result<&'static str,String>{match provider{
 "opencode"=>Ok("https://opencode.ai/zen/v1"),"openai"=>Ok("https://api.openai.com/v1"),"gemini"=>Ok("https://generativelanguage.googleapis.com/v1beta/openai"),"anthropic"=>Ok("https://api.anthropic.com/v1"),"deepseek"=>Ok("https://api.deepseek.com"),"kimi"=>Ok("https://api.moonshot.ai/v1"),"mistral"=>Ok("https://api.mistral.ai/v1"),"groq"=>Ok("https://api.groq.com/openai/v1"),"xai"=>Ok("https://api.x.ai/v1"),_=>Err("Proveedor de Charvis no reconocido.".into())}}
fn main_only(window:&tauri::WebviewWindow)->Result<(),String>{if window.label()=="main"{Ok(())}else{Err("Charvis solo está disponible en la ventana principal.".into())}}
fn target(provider:&str)->Result<String,String>{base(provider)?;Ok(format!("APHEKA/Charvis/{provider}"))}
#[cfg(windows)]fn read_key(provider:&str)->Option<String>{use windows_sys::Win32::Security::Credentials::*;let name:Vec<u16>=target(provider).ok()?.encode_utf16().chain(Some(0)).collect();let mut value=std::ptr::null_mut();unsafe{if CredReadW(name.as_ptr(),CRED_TYPE_GENERIC,0,&mut value)==0||value.is_null(){return None;}let result=if (*value).CredentialBlobSize>0&&(*value).CredentialBlobSize<=2048&&!(*value).CredentialBlob.is_null(){String::from_utf8(std::slice::from_raw_parts((*value).CredentialBlob,(*value).CredentialBlobSize as usize).to_vec()).ok()}else{None};CredFree(value.cast());result}}
#[cfg(not(windows))]fn read_key(_: &str)->Option<String>{None}
#[cfg(windows)]fn save_key(provider:&str,key:&str)->Result<(),String>{use windows_sys::Win32::Security::Credentials::*;let mut name:Vec<u16>=target(provider)?.encode_utf16().chain(Some(0)).collect();let mut user:Vec<u16>="APHEKA".encode_utf16().chain(Some(0)).collect();let mut bytes=key.as_bytes().to_vec();let mut value:CREDENTIALW=unsafe{std::mem::zeroed()};value.Type=CRED_TYPE_GENERIC;value.TargetName=name.as_mut_ptr();value.UserName=user.as_mut_ptr();value.CredentialBlobSize=bytes.len() as u32;value.CredentialBlob=bytes.as_mut_ptr();value.Persist=CRED_PERSIST_LOCAL_MACHINE;let saved=unsafe{CredWriteW(&value,0)}!=0;bytes.fill(0);if saved{Ok(())}else{Err("No se pudo guardar la clave en el Administrador de credenciales de Windows.".into())}}
#[cfg(not(windows))]fn save_key(_: &str,_: &str)->Result<(),String>{Err("El almacén seguro de Charvis requiere Windows.".into())}
#[tauri::command]pub fn charvis_credential(window:tauri::WebviewWindow,provider:String,action:String,api_key:Option<String>)->Result<Value,String>{main_only(&window)?;target(&provider)?;match action.as_str(){
 "status"=>{},
 "save"=>{let key=api_key.as_deref().unwrap_or_default().trim();if key.len()<8||key.len()>2048||key.chars().any(char::is_whitespace){return Err("Escribe una clave válida, sin espacios.".into());}save_key(&provider,key)?;},
 "remove"=>{#[cfg(windows)]{use windows_sys::Win32::Security::Credentials::*;let name:Vec<u16>=target(&provider)?.encode_utf16().chain(Some(0)).collect();if read_key(&provider).is_some()&&unsafe{CredDeleteW(name.as_ptr(),CRED_TYPE_GENERIC,0)}==0{return Err("No se pudo retirar la clave guardada.".into());}}},
 _=>return Err("Acción de credencial no permitida.".into())};Ok(json!({"configured":read_key(&provider).is_some()}))}
async fn bounded(mut response:reqwest::Response,on_event:Option<&tauri::ipc::Channel<Value>>,key:&str)->Result<Value,String>{
 let status=response.status().as_u16();
 if !(200..300).contains(&status){
  let mut bytes=Vec::new();while let Ok(Some(chunk))=response.chunk().await{if bytes.len()+chunk.len()>16384{break;}bytes.extend_from_slice(&chunk);}
  let error=serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null);
  let detail=error["error"]["message"].as_str().or_else(||error["message"].as_str()).unwrap_or("").replace(key,"[clave protegida]");
  let detail=detail.chars().filter(|c|!c.is_control()).take(450).collect::<String>();
  let title=match status{400|422=>"El proveedor rechazó un parámetro del modelo.",401|403=>"El proveedor rechazó la clave o sus permisos.",402=>"El modelo requiere saldo en el proveedor.",429=>"El proveedor alcanzó su límite. Espera antes de reenviar.",404=>"El modelo o ruta seleccionados no están disponibles.",_=>"El proveedor no pudo completar la consulta."};
  return Err(format!("{title} (HTTP {status}) {}",detail));
 }
 let streaming=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v|v.to_str().ok()).is_some_and(|v|v.contains("text/event-stream"));
 let mut bytes=Vec::new();let mut total=0usize;
 if !streaming{while let Some(chunk)=response.chunk().await.map_err(|_|"La respuesta se interrumpió.")?{total+=chunk.len();if total>4*1024*1024{return Err("La respuesta supera el límite de Charvis.".into());}bytes.extend_from_slice(&chunk);}return serde_json::from_slice(&bytes).map_err(|_|"El proveedor devolvió una respuesta no válida.".into());}
 let mut completion=crate::charvis_stream::Completion::default();let mut data=String::new();let mut last=std::time::Instant::now();
 while let Some(chunk)=response.chunk().await.map_err(|_|"La respuesta en directo se interrumpió.")?{
  total+=chunk.len();if total>4*1024*1024{return Err("La respuesta supera el límite de Charvis.".into());}bytes.extend_from_slice(&chunk);
  while let Some(end)=bytes.iter().position(|b|*b==b'\n'){
   let line=bytes.drain(..=end).collect::<Vec<_>>();let line=std::str::from_utf8(&line).map_err(|_|"El proveedor devolvió texto no válido.")?.trim_end_matches(['\r','\n']);
   if line.is_empty(){if !data.is_empty(){completion.accept(data.trim_end())?;data.clear();}}else if let Some(part)=line.strip_prefix("data:"){data.push_str(part.trim_start());data.push('\n');}
  }
  if last.elapsed()>=Duration::from_millis(100){if let Some(channel)=on_event{let _=channel.send(json!({"type":"text","text":completion.text}));}last=std::time::Instant::now();}
 }
 if !data.is_empty(){completion.accept(data.trim_end())?;}
 if let Some(channel)=on_event{let _=channel.send(json!({"type":"text","text":completion.text}));}
 completion.response()
}
fn payload_valid(operation:&str,payload:&Value)->Result<(),String>{
 if payload.to_string().len()>10*1024*1024{return Err("Los adjuntos superan el límite del mensaje.".into());}
 if operation=="chat"{let messages=payload["messages"].as_array().ok_or("Faltan los mensajes del chat.")?;if messages.is_empty()||messages.len()>100{return Err("Mensajes de Charvis fuera de los límites.".into());}let model=payload["model"].as_str().unwrap_or("");if model.is_empty()||model.len()>160{return Err("Selecciona un modelo del proveedor.".into());}}
 Ok(())
}
#[tauri::command]pub fn charvis_cancel(window:tauri::WebviewWindow,state:tauri::State<'_,CharvisState>,request_id:String)->Result<(),String>{main_only(&window)?;if let Some(cancel)=state.requests.lock().map_err(|_|"Consulta ocupada.")?.remove(&request_id){let _=cancel.send(());}Ok(())}
#[tauri::command]pub async fn charvis_request(window:tauri::WebviewWindow,state:tauri::State<'_,CharvisState>,provider:String,operation:String,payload:Value,request_id:String,audio:Option<Vec<u8>>,audio_base64:Option<String>,mime:Option<String>,on_event:tauri::ipc::Channel<Value>)->Result<Value,String>{
 main_only(&window)?;let endpoint=base(&provider)?;if !matches!(operation.as_str(),"models"|"chat"|"transcribe"){return Err("Operación no permitida.".into());}payload_valid(&operation,&payload)?;
 if request_id.is_empty()||request_id.len()>64||!request_id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'){return Err("Identificador de consulta no válido.".into());}
 let key=read_key(&provider).ok_or("Guarda la clave de este proveedor en Ajustes → Sistema → Charvis.")?;
 let (sender,cancelled)=tokio::sync::oneshot::channel();{let mut pending=state.requests.lock().map_err(|_|"Consulta ocupada.")?;if pending.len()>=4||pending.contains_key(&request_id){return Err("Charvis ya tiene consultas en curso.".into());}pending.insert(request_id.clone(),sender);}
 let query=async{
  let _slot=state.slots.acquire().await.map_err(|_|"Charvis se cerró.")?;let client=state.client.as_ref().map_err(|_|"No se pudo preparar la conexión HTTPS.")?;
  let path=match operation.as_str(){"models"=>"models","chat"=>"chat/completions",_=>"audio/transcriptions"};
  let mut req=if operation=="models"{client.get(format!("{endpoint}/{path}"))}else{client.post(format!("{endpoint}/{path}"))};
  req=req.bearer_auth(&key);if provider=="anthropic"{req=req.header("x-api-key",&key).header("anthropic-version","2023-06-01");}
  if operation=="transcribe"{
   if !matches!(provider.as_str(),"groq"|"openai"){return Err("Selecciona OpenAI o Groq para transcribir audio.".into());}
   let bytes=if let Some(encoded)=audio_base64{use base64::Engine;if encoded.len()>28*1024*1024{return Err("El audio supera el límite de transporte.".into());}base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|_|"El audio recibido no es válido.")?}else{audio.ok_or("No hay audio para transcribir.")?};if bytes.is_empty()||bytes.len()>20*1024*1024{return Err("El audio debe ocupar como máximo 20 MB.".into());}
   let kind=mime.as_deref().unwrap_or("audio/webm").split(';').next().unwrap_or("audio/webm");let ext=match kind{"audio/webm"|"video/webm"=>"webm","audio/mp4"|"audio/x-m4a"|"video/mp4"=>"mp4","audio/mpeg"=>"mp3","audio/wav"|"audio/x-wav"=>"wav","audio/ogg"=>"ogg",_=>return Err("Formato de audio no admitido. Usa WebM, MP3, M4A, WAV u OGG.".into())};
   let file=reqwest::multipart::Part::bytes(bytes).file_name(format!("audio.{ext}")).mime_str(kind).map_err(|_|"Audio no válido.")?;
   let model=if provider=="groq"{"whisper-large-v3-turbo"}else{"whisper-1"};let mut form=reqwest::multipart::Form::new().part("file",file).text("model",model).text("response_format","json");if let Some(prompt)=payload["prompt"].as_str(){form=form.text("prompt",prompt.chars().take(800).collect::<String>());}req=req.multipart(form);
  }else if operation=="chat"{req=req.json(&payload);}else{req=req.timeout(Duration::from_secs(15));}
  bounded(req.send().await.map_err(|error|if error.is_timeout(){"La consulta agotó el tiempo de espera. Puedes volver a enviarla."}else{"No se pudo conectar por HTTPS con el proveedor."})?,Some(&on_event),&key).await
 };
 let result=tokio::select!{_=cancelled=>Err("Consulta cancelada.".into()),result=query=>result};if let Ok(mut pending)=state.requests.lock(){pending.remove(&request_id);}result
}
#[cfg(test)]mod tests{use super::*;#[test]fn fixed_routes_and_bounded_messages(){assert!(base("openai").unwrap().starts_with("https://"));assert!(base("https://evil.test").is_err());assert!(payload_valid("chat",&json!({"model":"chosen","messages":[{"role":"user","content":"test"}]})).is_ok());assert!(payload_valid("chat",&json!({"model":"chosen","messages":[],"stream":true})).is_err());assert!(payload_valid("chat",&json!({"model":"chosen","messages":[{"role":"user","content":"test"}],"stream":true})).is_ok());}}
