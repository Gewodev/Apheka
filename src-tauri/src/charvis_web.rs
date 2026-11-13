//! Bounded public web reads; DNS is checked and pinned for every redirect.
use serde::Serialize;
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Mutex,
    time::{Duration, Instant},
};
pub struct WebState {
    clients: Mutex<HashMap<String, (Instant, reqwest::Client)>>,
    requests: Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>,
    slots: tokio::sync::Semaphore,
}
impl Default for WebState {
    fn default() -> Self {
        Self {
            clients: Mutex::new(HashMap::new()),
            requests: Mutex::new(HashMap::new()),
            slots: tokio::sync::Semaphore::new(2),
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReply {
    url: String,
    status: u16,
    content_type: String,
    body: String,
}
fn public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(a == 0
                || a == 10
                || a == 127
                || a >= 224
                || (a == 100 && (64..=127).contains(&b))
                || (a == 169 && b == 254)
                || (a == 172 && (16..=31).contains(&b))
                || (a == 192 && (b == 168 || b == 0 || b == 2))
                || (a == 198 && (b == 18 || b == 19 || b == 51 && c == 100))
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(v4));
            }
            let s = ip.segments();
            (s[0] & 0xe000) == 0x2000
                && !(s[0] == 0x2001 && (s[1] == 0xdb8 || s[1] <= 0x1ff))
                && s[0] != 0x2002
        }
    }
}
fn web_target(raw: &str, mode: &str) -> Result<reqwest::Url, String> {
    if raw.len() > 4096 {
        return Err("El enlace es demasiado largo.".into());
    }
    let mut url = reqwest::Url::parse(raw).map_err(|_| "Enlace no válido.")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port_or_known_default() != Some(443)
    {
        return Err("La consulta web requiere un enlace HTTPS público, sin credenciales.".into());
    }
    let host = url.host_str().unwrap_or_default();
    if host == "wikipedia.org" || host.ends_with(".wikipedia.org") {
        return Err("Wikipedia está excluida de las fuentes de Charvis.".into());
    }
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.parse::<IpAddr>().map_or(false, |ip| !public_ip(ip))
    {
        return Err("No se consultan direcciones privadas ni servicios locales.".into());
    }
    if mode == "search"
        && !matches!(
            host,
            "html.duckduckgo.com" | "lite.duckduckgo.com" | "api.duckduckgo.com" | "www.bing.com"
        )
    {
        return Err("Motor de búsqueda no permitido.".into());
    }
    if !matches!(mode, "search" | "read") {
        return Err("Consulta web no válida.".into());
    }
    url.set_fragment(None);
    Ok(url)
}
async fn client(state: &WebState, url: &reqwest::Url) -> Result<reqwest::Client, String> {
    let host = url.host_str().ok_or("Enlace sin dominio.")?;
    if let Some((_, client)) = state
        .clients
        .lock()
        .map_err(|_| "Conexión ocupada.")?
        .get(host)
        .filter(|(at, _)| at.elapsed() < Duration::from_secs(60))
    {
        return Ok(client.clone());
    }
    let addresses: Vec<SocketAddr> =
        tokio::time::timeout(Duration::from_secs(4), tokio::net::lookup_host((host, 443)))
            .await
            .map_err(|_| "El dominio no respondió a tiempo.")?
            .map_err(|_| "No se pudo resolver el dominio.")?
            .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !public_ip(address.ip())) {
        return Err("El dominio apunta a una dirección no pública.".into());
    }
    let client = reqwest::Client::builder()
        .https_only(true)
        .no_proxy()
        .resolve_to_addrs(host, &addresses)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(8))
        .user_agent("APHEKA/6.23 (study research)")
        .build()
        .map_err(|_| "No se pudo preparar la lectura web.")?;
    let mut cache = state.clients.lock().map_err(|_| "Conexión ocupada.")?;
    if cache.len() >= 16 {
        cache.retain(|_, (at, _)| at.elapsed() < Duration::from_secs(60));
        if cache.len() >= 16 {
            cache.clear();
        }
    }
    cache.insert(host.into(), (Instant::now(), client.clone()));
    Ok(client)
}
async fn read(
    state: &WebState,
    raw: String,
    mode: String,
    method: String,
    body: Option<String>,
) -> Result<WebReply, String> {
    if method != "GET"
        && !(method == "POST" && mode == "search" && raw == "https://html.duckduckgo.com/html/")
    {
        return Err("Método de consulta web no permitido.".into());
    }
    if body.as_ref().map_or(false, |value| value.len() > 2048) {
        return Err("Consulta demasiado larga.".into());
    }
    let mut url = web_target(&raw, &mode)?;
    let mut post = method == "POST";
    for _ in 0..4 {
        let client = client(state, &url).await?;
        let mut request = if post {
            client
                .post(url.clone())
                .header("content-type", "application/x-www-form-urlencoded")
                .body(body.clone().unwrap_or_default())
        } else {
            client.get(url.clone())
        };
        request = request.header("accept", "text/html,application/json,text/plain;q=0.8");
        let mut response = request
            .send()
            .await
            .map_err(|_| "La página no pudo consultarse dentro del tiempo disponible.")?;
        if response.status().is_redirection() {
            let target = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("La página devolvió una redirección incompleta.")?;
            url = web_target(
                url.join(target)
                    .map_err(|_| "Redirección no válida.")?
                    .as_str(),
                &mode,
            )?;
            post = false;
            continue;
        }
        let status = response.status().as_u16();
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("text/plain")
            .to_string();
        if !response.status().is_success() {
            return Err(format!(
                "La fuente no está disponible para esta consulta (HTTP {status})."
            ));
        }
        if ![
            "text/html",
            "text/plain",
            "application/json",
            "application/xhtml+xml",
        ]
        .iter()
        .any(|kind| content_type.to_ascii_lowercase().starts_with(kind))
        {
            return Err("La fuente no es una página de texto. Adjunta los PDF como material para leerlos por páginas.".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "La lectura de la página se interrumpió.")?
        {
            if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
                return Err("La página supera el límite de lectura de 2 MB.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        return Ok(WebReply {
            url: url.into(),
            status,
            content_type,
            body: String::from_utf8_lossy(&bytes).into_owned(),
        });
    }
    Err("La página tiene demasiadas redirecciones.".into())
}
#[tauri::command]
pub fn charvis_web_cancel(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, WebState>,
    request_id: String,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Ventana no permitida.".into());
    }
    if let Some(cancel) = state
        .requests
        .lock()
        .map_err(|_| "Consulta ocupada.")?
        .remove(&request_id)
    {
        let _ = cancel.send(());
    }
    Ok(())
}
#[tauri::command]
pub async fn charvis_web_request(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, WebState>,
    url: String,
    mode: String,
    method: String,
    body: Option<String>,
    request_id: String,
) -> Result<WebReply, String> {
    if window.label() != "main" {
        return Err("Ventana no permitida.".into());
    }
    web_target(&url, &mode)?;
    if request_id.is_empty()
        || request_id.len() > 64
        || !request_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err("Identificador de consulta no válido.".into());
    }
    let (sender, cancel) = tokio::sync::oneshot::channel();
    {
        let mut pending = state.requests.lock().map_err(|_| "Consulta ocupada.")?;
        if pending.len() >= 6 || pending.contains_key(&request_id) {
            return Err("Ya hay varias consultas web en curso.".into());
        }
        pending.insert(request_id.clone(), sender);
    }
    let result = tokio::select! {_=cancel=>Err("Consulta cancelada.".into()),result=tokio::time::timeout(Duration::from_secs(12),async{let _slot=state.slots.acquire().await.map_err(|_|"Conexión cerrada.")?;read(&state,url,mode,method,body).await})=>result.unwrap_or_else(|_|Err("La lectura web agotó el tiempo de espera.".into()))};
    if let Ok(mut pending) = state.requests.lock() {
        pending.remove(&request_id);
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_and_special_targets_are_rejected() {
        for ip in [
            "127.0.0.1",
            "10.2.3.4",
            "172.20.1.1",
            "192.168.0.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "fe80::1",
            "fc00::1",
            "::ffff:127.0.0.1",
            "2001:db8::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()), "{ip}");
        }
        for ip in ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"] {
            assert!(public_ip(ip.parse().unwrap()), "{ip}");
        }
        for url in [
            "http://example.com",
            "https://localhost/x",
            "https://127.0.0.1/",
            "https://user:secret@example.com",
            "https://example.com:8000/",
            "https://es.wikipedia.org/wiki/Physics",
        ] {
            assert!(web_target(url, "read").is_err());
        }
        assert!(web_target("https://example.com/article", "read").is_ok());
        assert!(web_target("https://example.com/search", "search").is_err());
    }
    #[tokio::test]
    #[ignore = "Requires an actual Internet connection"]
    async fn live_public_source() {
        let result = read(
            &WebState::default(),
            "https://www.rust-lang.org/".into(),
            "read".into(),
            "GET".into(),
            None,
        )
        .await
        .expect("Public HTTPS source must respond");
        assert_eq!(result.status, 200);
        assert!(result.body.contains("Rust"));
        assert!(result.url.starts_with("https://"));
    }
}
