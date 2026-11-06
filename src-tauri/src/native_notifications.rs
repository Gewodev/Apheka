use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NotificationTarget {
    kind: TargetKind,
    id: Option<String>,
    date: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum TargetKind {
    Task,
    Event,
    Session,
    Study,
    Tasks,
    Settings,
    Music,
    Downloads,
}
impl NotificationTarget {
    fn validate(&self) -> Result<(), String> {
        if matches!(
            self.kind,
            TargetKind::Task | TargetKind::Event | TargetKind::Session
        ) && self
            .id
            .as_deref()
            .is_none_or(|id| id.is_empty() || id.len() > 512 || id.chars().any(char::is_control))
        {
            return Err("La notificación no tiene un destino válido".into());
        }
        if self.date.as_deref().is_some_and(|date| {
            date.len() != 10
                || date.bytes().enumerate().any(|(i, b)| {
                    if i == 4 || i == 7 {
                        b != b'-'
                    } else {
                        !b.is_ascii_digit()
                    }
                })
        }) {
            return Err("La fecha de la notificación no es válida".into());
        }
        Ok(())
    }
    fn label(&self) -> &'static str {
        match self.kind {
            TargetKind::Task => "Ver tarea",
            TargetKind::Event => "Ver evento",
            TargetKind::Session => "Ver sesión",
            TargetKind::Study => "Ir a Estudio",
            TargetKind::Tasks => "Ver tareas",
            TargetKind::Settings => "Abrir configuración",
            TargetKind::Music => "Abrir música",
            TargetKind::Downloads => "Ver descargas",
        }
    }
}

/// Native Windows activation is independent from the webview's focus and timer loop.
#[tauri::command]
pub async fn send_workspace_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    target: NotificationTarget,
) -> Result<(), String> {
    target.validate()?;
    if title.is_empty() || title.chars().count() > 200 || body.chars().count() > 2000 {
        return Err("La notificación excede el tamaño permitido".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use tauri_winrt_notification::{Duration, Toast};
            let app_id = app.config().identifier.clone();
            let handle = app.clone();
            // Only navigation: dismissing a toast never deletes its task/event.
            Toast::new(&app_id)
                .title(&title)
                .text1(&body)
                .duration(Duration::Short)
                .add_button(target.label(), "open")
                .on_activated(move |action| {
                    if action
                        .as_deref()
                        .is_none_or(|value| value.is_empty() || value == "open")
                    {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("apheka:notification-open", &target);
                        }
                    }
                    Ok(())
                })
                .show()
                .map_err(|error| error.to_string())
        }
        #[cfg(not(windows))]
        {
            use tauri_plugin_notification::NotificationExt;
            app.notification()
                .builder()
                .title(title)
                .body(body)
                .show()
                .map_err(|error| error.to_string())
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_missing_target_and_arbitrary_route() {
        assert!(
            serde_json::from_str::<NotificationTarget>(r#"{"kind":"javascript","id":"x"}"#)
                .is_err()
        );
        assert!(NotificationTarget {
            kind: TargetKind::Task,
            id: None,
            date: None
        }
        .validate()
        .is_err());
        assert!(NotificationTarget {
            kind: TargetKind::Event,
            id: Some("e".into()),
            date: Some("2026-11-05".into())
        }
        .validate()
        .is_ok());
        assert!(NotificationTarget {
            kind: TargetKind::Event,
            id: Some("e".into()),
            date: Some("bad-date".into())
        }
        .validate()
        .is_err());
    }
}
