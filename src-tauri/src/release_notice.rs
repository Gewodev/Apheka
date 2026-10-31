use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Installation { version: String, installation_id: String, had_previous_install: bool, previous_version: String, previous_name: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseNotice { version: String, installation_id: String, previous_version: String, previous_name: String }

fn should_show(installation: &Installation, running_version: &str, acknowledged: Option<&str>) -> bool {
    installation.had_previous_install && installation.version == running_version && acknowledged != Some(&installation.installation_id)
}

#[tauri::command]
pub fn get_release_notice(app: tauri::AppHandle) -> Result<Option<ReleaseNotice>, String> {
    if cfg!(debug_assertions) { return Ok(None); }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let Some(parent) = exe.parent() else { return Ok(None); };
    let Ok(raw) = std::fs::read_to_string(parent.join("apheka-install.json")) else { return Ok(None); };
    let Ok(installation) = serde_json::from_str::<Installation>(&raw) else { return Ok(None); };
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("apheka-release-ack.json");
    let acknowledgement = std::fs::read_to_string(path).ok().and_then(|raw|serde_json::from_str::<serde_json::Value>(&raw).ok());
    if !should_show(&installation, &app.package_info().version.to_string(), acknowledgement.as_ref().and_then(|v|v["installationId"].as_str())) { return Ok(None); }
    Ok(Some(ReleaseNotice { version: installation.version, installation_id: installation.installation_id, previous_version: installation.previous_version, previous_name: installation.previous_name }))
}

#[tauri::command]
pub fn acknowledge_release(app: tauri::AppHandle, installation_id: String) -> Result<(), String> {
    let folder = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let raw = serde_json::json!({"installationId": installation_id, "version": app.package_info().version.to_string()}).to_string();
    let temporary = folder.join("apheka-release-ack.tmp");
    std::fs::write(&temporary, raw).map_err(|e| e.to_string())?;
    std::fs::rename(temporary, folder.join("apheka-release-ack.json")).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn installation(previous: bool) -> Installation {
        Installation {version:"6.7.2".into(),installation_id:"install-new".into(),had_previous_install:previous,previous_version:"6.7.1".into(),previous_name:"APHEKA".into()}
    }
    #[test] fn first_install_is_quiet() {assert!(!should_show(&installation(false),"6.7.2",None));}
    #[test] fn update_has_a_notice() {assert!(should_show(&installation(true),"6.7.2",None));}
    #[test] fn acknowledged_install_does_not_repeat() {assert!(!should_show(&installation(true),"6.7.2",Some("install-new")));}
    #[test] fn new_install_after_old_ack_shows() {assert!(should_show(&installation(true),"6.7.2",Some("install-old")));}
    #[test] fn stale_context_from_another_binary_is_ignored() {assert!(!should_show(&installation(true),"6.7.1",None));}
    #[test] fn installer_json_contract_is_readable() {let value:Installation=serde_json::from_str(r#"{"version":"6.7.2","installationId":"new","hadPreviousInstall":true,"previousName":"OWA Studio","previousVersion":"6.7.0"}"#).unwrap();assert!(should_show(&value,"6.7.2",None));assert_eq!(value.previous_name,"OWA Studio");}
}
