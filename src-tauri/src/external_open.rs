use std::path::PathBuf;

/// Validate one argument; never a shell command. External browsers cannot use asset.localhost.
pub fn target(value: &str) -> Result<String, String> {
    if let Ok(url) = tauri::Url::parse(value) {
        if matches!(url.scheme(), "http" | "https") {
            if url.host_str() == Some("asset.localhost") {
                return Err("Una URL interna no puede abrirse fuera de APHEKA".into());
            }
            return Ok(url.to_string());
        }
        if url.scheme() == "file" {
            let path = url.to_file_path().map_err(|_| "Ruta de archivo inválida")?;
            return existing_file(path);
        }
    }
    let path = PathBuf::from(value);
    if !path.is_absolute() { return Err("Se requiere una ruta absoluta o un enlace http(s)".into()); }
    existing_file(path)
}

fn existing_file(path: PathBuf) -> Result<String, String> {
    if !path.is_file() { return Err("El archivo ya no existe en la ruta guardada".into()); }
    // Preserve the ordinary Windows path: Chromium and PDF viewers accept it as one argument.
    // canonicalize() can introduce a \\?\ prefix that some viewers interpret as a URL.
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_internal_urls_and_commands() {
        for value in ["https://asset.localhost/C%3A%5Cdoc.pdf", "javascript:alert(1)", "--new-window", "data:application/pdf;base64,AA", "relative.pdf"] {
            assert!(target(value).is_err(), "{value}");
        }
        assert_eq!(target("https://example.com/doc.pdf?q=1").unwrap(), "https://example.com/doc.pdf?q=1");
    }
    #[test] fn real_pdf_path_is_one_unchanged_argument() {
        let path = std::env::temp_dir().join(format!("APHEKA á espacios # {}.pdf", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"%PDF-1.4").unwrap();
        assert_eq!(target(path.to_str().unwrap()).unwrap(), path.to_string_lossy());
        let url = tauri::Url::from_file_path(&path).unwrap();
        assert_eq!(target(url.as_str()).unwrap(), path.to_string_lossy());
        std::fs::remove_file(path).unwrap();
    }
}
