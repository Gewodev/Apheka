// ── Servidor local de Ventanas: puente HTTP entre la app y la extensión ──────
// std-only. Escucha en 127.0.0.1:44117. Estado global compartido entre el
// hilo del servidor y los comandos Tauri.
// Endpoints:
//   GET  /owa/ping                  → {ok:true}
//   POST /owa/pair    {code}        → {token}   (código activo 5 min, un uso)
//   GET  /owa/sync?token=…           → {state}   (árbol + bloqueos + openRequests)
//   POST /owa/state   {token,state} → actualiza estado y avisa a la webview

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex as StdMutex;
use std::time::{SystemTime, UNIX_EPOCH};

struct Shared {
    state_json: String,
    link_code: Option<(String, u64)>, // (código, expira_ms)
    tokens: Vec<String>,
}

static SHARED: StdMutex<Option<Shared>> = StdMutex::new(None);

fn with_shared<R>(f: impl FnOnce(&mut Shared) -> R) -> R {
    let mut guard = SHARED.lock().unwrap();
    if guard.is_none() {
        *guard = Some(Shared {
            state_json: "{\"folders\":[],\"blocks\":[],\"openRequests\":[]}".to_string(),
            link_code: None,
            tokens: Vec::new(),
        });
    }
    f(guard.as_mut().unwrap())
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn pseudo_rand(prev: u64, salt: u64) -> u64 {
    prev.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407 + salt)
        ^ (std::process::id() as u64).wrapping_mul(2654435761)
}

fn gen_code(seed: u64) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut out = String::new();
    let mut n = seed;
    for i in 0..6 {
        n = pseudo_rand(n, i as u64 + 1);
        out.push(ALPHABET[(n % ALPHABET.len() as u64) as usize] as char);
    }
    out
}

fn gen_token(seed: u64) -> String {
    let mut out = String::new();
    let mut n = seed;
    for i in 0..4 {
        n = pseudo_rand(n, i as u64 + 7);
        out.push_str(&format!("{:08x}", n));
    }
    out
}

fn respond(mut stream: std::net::TcpStream, status: &str, body: &str) {
    let resp = format!(
        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nConnection: close\r\n\r\n{}",
        status,
        body.len(),
        body
    );
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
    let _ = stream.shutdown(std::net::Shutdown::Both);
}

fn serve_once(stream: std::net::TcpStream) {
    let mut buf = [0u8; 262144];
    let mut total = 0usize;
    {
        let mut clone = match stream.try_clone() { Ok(c) => c, Err(_) => return };
        loop {
            match clone.read(&mut buf[total..]) {
                Ok(0) => break,
                Ok(n) => {
                    total += n;
                    if total >= buf.len() { break; }
                    // fin probable de la petición: cuerpo JSON cerrado y headers presentes
                    if total > 4 && buf[..total].windows(4).any(|w| w == b"\r\n\r\n") {
                        let raw = String::from_utf8_lossy(&buf[..total]);
                        let body_start = raw.find("\r\n\r\n").map(|p| p + 4).unwrap_or(total);
                        let clen = raw.lines()
                            .find(|l| l.to_ascii_lowercase().starts_with("content-length:"))
                            .and_then(|l| l.split(':').nth(1))
                            .and_then(|v| v.trim().parse::<usize>().ok())
                            .unwrap_or(0);
                        if total >= body_start + clen { break; }
                    }
                }
                Err(_) => break,
            }
        }
    }
    let raw = String::from_utf8_lossy(&buf[..total]).to_string();
    let first_line = raw.lines().next().unwrap_or("").to_string();
    let body_start = raw.find("\r\n\r\n").map(|p| p + 4).unwrap_or(raw.len());
    let body = raw[body_start..].to_string();

    if first_line.starts_with("OPTIONS") {
        respond(stream, "204 No Content", "");
        return;
    }

    if first_line.contains("GET /owa/ping") {
        respond(stream, "200 OK", "{\"ok\":true,\"app\":\"owa-studio\"}");
        return;
    }

    if first_line.contains("POST /owa/pair") {
        let code: String = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("code").and_then(|c| c.as_str()).map(|s| s.to_uppercase()))
            .unwrap_or_default();
        let result = with_shared(|sh| {
            let valid = match &sh.link_code {
                Some((c, exp)) => c == &code && *exp > now_ms(),
                None => false,
            };
            if !valid { sh.link_code = None; return None; }
            let token = gen_token(now_ms());
            sh.tokens.push(token.clone());
            sh.link_code = None; // un código = un vínculo
            Some(token)
        });
        match result {
            Some(token) => respond(stream, "200 OK", &format!("{{\"token\":\"{}\"}}", token)),
            None => respond(stream, "401 Unauthorized", "{\"error\":\"código inválido o vencido\"}"),
        }
        return;
    }

    let extract_token = |raw: &str| -> Option<String> {
        let marker = "token=";
        let qi = raw.find('?')?;
        let rest = &raw[qi..];
        let ti = rest.find(marker)?;
        let tail = &rest[ti + marker.len()..];
        let end = tail.find(|c: char| c == '&' || c == ' ' || c == '\r').unwrap_or(tail.len());
        Some(tail[..end].to_string())
    };

    if first_line.contains("GET /owa/sync") {
        let token = match extract_token(&raw) {
            Some(t) => t,
            None => { respond(stream, "400 Bad Request", "{\"error\":\"falta token\"}"); return; }
        };
        let valid = with_shared(|sh| sh.tokens.contains(&token));
        if !valid {
            respond(stream, "401 Unauthorized", "{\"error\":\"token inválido\"}");
            return;
        }
        let state = with_shared(|sh| sh.state_json.clone());
        respond(stream, "200 OK", &format!("{{\"state\":{}}}", state));
        return;
    }

    if first_line.contains("POST /owa/state") {
        let token = match extract_token(&raw) {
            Some(t) => t,
            None => { respond(stream, "400 Bad Request", "{\"error\":\"falta token\"}"); return; }
        };
        let valid = with_shared(|sh| sh.tokens.contains(&token));
        if !valid {
            respond(stream, "401 Unauthorized", "{\"error\":\"token inválido\"}");
            return;
        }
        let new_state: String = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("state").map(|s| s.to_string()))
            .unwrap_or_default();
        if new_state.is_empty() {
            respond(stream, "400 Bad Request", "{\"error\":\"state faltante\"}");
            return;
        }
        with_shared(|sh| sh.state_json = new_state.clone());
        respond(stream, "200 OK", "{\"ok\":true}");
        return;
    }

    respond(stream, "404 Not Found", "{\"error\":\"ruta desconocida\"}");
}

static SERVER_STARTED: std::sync::Once = std::sync::Once::new();

pub fn start_windows_server(app: tauri::AppHandle) -> Result<(), String> {
    let mut start_err: Option<String> = None;
    SERVER_STARTED.call_once(|| {
        with_shared(|sh| { sh.state_json = "{\"folders\":[],\"blocks\":[],\"openRequests\":[]}".to_string(); });
        let listener = match TcpListener::bind("127.0.0.1:44117") {
            Ok(l) => l,
            Err(e) => { start_err = Some(format!("puerto 44117 ocupado: {}", e)); return; }
        };
        let app_handle = app.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                match stream {
                    Ok(s) => { std::thread::spawn(move || serve_once(s)); }
                    Err(_) => continue,
                }
            }
        });
        // mantener el AppHandle vivo para emitir eventos
        std::mem::forget(app_handle);
    });
    match start_err {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

#[tauri::command]
pub fn windows_server_start(app: tauri::AppHandle) -> Result<String, String> {
    start_windows_server(app)?;
    Ok("127.0.0.1:44117".to_string())
}

#[tauri::command]
pub fn windows_server_register_code(code: String) -> Result<serde_json::Value, String> {
    let code = code.trim().to_uppercase();
    if code.len() != 6 {
        return Err("el código debe tener 6 caracteres".to_string());
    }
    let exp = now_ms() + 5 * 60 * 1000;
    with_shared(|sh| sh.link_code = Some((code.clone(), exp)));
    Ok(serde_json::json!({ "code": code, "expiresInMs": 5 * 60 * 1000 }))
}

#[tauri::command]
pub fn windows_server_status() -> Result<serde_json::Value, String> {
    let (tokens, paired) = with_shared(|sh| (sh.tokens.len(), sh.link_code.is_some()));
    Ok(serde_json::json!({ "tokens": tokens, "codeActivo": paired }))
}

#[tauri::command]
pub fn windows_server_set_state(state: String) -> Result<(), String> {
    if state.trim().is_empty() { return Err("state vacío".to_string()); }
    with_shared(|sh| sh.state_json = state);
    Ok(())
}

#[tauri::command]
pub fn windows_server_get_state() -> Result<String, String> {
    Ok(with_shared(|sh| sh.state_json.clone()))
}
