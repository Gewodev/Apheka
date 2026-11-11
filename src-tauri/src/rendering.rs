use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all="lowercase")]
pub enum Mode { Standard, #[default] Compatible, Software }
#[derive(Deserialize,Serialize)]
struct Preference { mode: Mode }
pub struct RenderingState(pub Mode);

fn arguments(mode:Mode)->Option<&'static str> {
    match mode {Mode::Standard=>None,Mode::Compatible=>Some("--disable-direct-composition"),Mode::Software=>Some("--disable-gpu")}
}
pub fn configure(identifier:&str)->RenderingState {
    // Avoid the fullscreen DirectComposition presentation path that can leave the
    // Windows hardware cursor stale. GPU rendering remains enabled; no global OS change.
    let mode=dirs::config_dir().and_then(|p|std::fs::read(p.join(identifier).join("graphics.json")).ok())
        .and_then(|v|serde_json::from_slice::<Preference>(&v).ok()).map(|v|v.mode).unwrap_or_default();
    #[cfg(windows)]
    if let Some(extra)=arguments(mode) {
        // Process-local only. Existing administrator/browser arguments are preserved.
        let current=std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",format!("{current} {extra}"));
    }
    RenderingState(mode)
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Status {active:Mode,selected:Mode,restart_required:bool}
#[tauri::command]
pub fn graphics_status(window:tauri::WebviewWindow,state:tauri::State<RenderingState>)->Result<Status,String> {
    if window.label()!="main" {return Err("Solo disponible en la ventana principal".into());}
    let path=window.app_handle().path().app_config_dir().map_err(|e|e.to_string())?.join("graphics.json");
    let selected=std::fs::read(path).ok().and_then(|v|serde_json::from_slice::<Preference>(&v).ok()).map(|v|v.mode).unwrap_or_default();
    Ok(Status{active:state.inner().0,selected,restart_required:state.inner().0!=selected})
}
#[tauri::command]
pub fn graphics_set_mode(window:tauri::WebviewWindow,mode:Mode,state:tauri::State<RenderingState>)->Result<Status,String> {
    if window.label()!="main" {return Err("Solo disponible en la ventana principal".into());}
    let dir=window.app_handle().path().app_config_dir().map_err(|e|e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    let temporary=dir.join("graphics.json.tmp");
    std::fs::write(&temporary,serde_json::to_vec(&Preference{mode}).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    std::fs::rename(&temporary,dir.join("graphics.json")).map_err(|e|e.to_string())?;
    Ok(Status{active:state.inner().0,selected:mode,restart_required:state.inner().0!=mode})
}
#[cfg(test)]mod tests {
    use super::*;
    #[test]fn limited_graphics_profiles(){
        assert_eq!(Mode::default(),Mode::Compatible);
        assert_eq!(arguments(Mode::Standard),None);
        assert_eq!(arguments(Mode::Compatible),Some("--disable-direct-composition"));
        assert_eq!(arguments(Mode::Software),Some("--disable-gpu"));
        assert!(serde_json::from_str::<Preference>(r#"{"mode":"--disable-web-security"}"#).is_err());
    }
}
