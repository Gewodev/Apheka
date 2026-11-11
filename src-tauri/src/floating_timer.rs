use tauri::{Manager, WebviewWindow};

const LABEL: &str = "floating-timer";
// One lifecycle for both the study button and the timer's X. Never create while
// destruction is still queued on the native event loop.
static LIFECYCLE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn destroy(app: &tauri::AppHandle) -> Result<(), String> {
    let Some(timer) = app.get_webview_window(LABEL) else { return Ok(()); };
    timer.destroy().map_err(|e| e.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(3), async {
        while app.get_webview_window(LABEL).is_some() {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    }).await.map_err(|_| "El contador no terminó de cerrarse. Vuelve a intentarlo.".to_string())
}

#[tauri::command]
pub async fn close_floating_timer(window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" && window.label() != LABEL {
        return Err("Esta ventana no puede cerrar el contador.".into());
    }
    let _guard = LIFECYCLE.lock().await;
    destroy(window.app_handle()).await
}

#[tauri::command]
pub async fn toggle_floating_timer(window: WebviewWindow) -> Result<bool, String> {
    if window.label() != "main" { return Err("Solo disponible en Estudio.".into()); }
    let _guard = LIFECYCLE.lock().await;
    let app = window.app_handle();
    if app.get_webview_window(LABEL).is_some() {
        destroy(app).await?;
        return Ok(false);
    }
    let builder = tauri::WebviewWindowBuilder::new(app, LABEL, tauri::WebviewUrl::App("/".into()))
        .title("Timer")
        .inner_size(156., 112.)
        .resizable(false)
        .decorations(false)
        // The timer already paints an opaque background. A transparent native
        // surface adds an unnecessary composition path over a fullscreen window.
        .transparent(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false);
    #[cfg(windows)]
    let builder = builder.owner(&window).map_err(|e| e.to_string())?;
    let timer = builder.build().map_err(|e| e.to_string())?;
    if let Err(error) = timer.show() {
        let _ = destroy(app).await;
        return Err(error.to_string());
    }
    if window.is_focused().unwrap_or(false) { let _ = timer.set_focus(); }
    Ok(true)
}
