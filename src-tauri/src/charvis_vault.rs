//! Private Charvis history is bound to the signed-in Windows account using DPAPI.
use base64::{engine::general_purpose::STANDARD, Engine};
#[cfg(windows)]
fn crypt(bytes: &[u8], protect: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::*};
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    let success = unsafe {
        if protect {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if success == 0 {
        return Err("No se pudo abrir el almacén protegido de Charvis con esta cuenta de Windows. Los datos originales se conservan.".into());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        LocalFree(output.pbData as *mut _);
    }
    Ok(result)
}
#[cfg(not(windows))]
fn crypt(_bytes: &[u8], _protect: bool) -> Result<Vec<u8>, String> {
    Err("El almacén nativo protegido requiere Windows.".into())
}
pub fn seal(bytes: &[u8]) -> Result<Vec<u8>, String> {
    crypt(bytes, true)
}
pub fn open(bytes: &[u8]) -> Result<Vec<u8>, String> {
    crypt(bytes, false)
}
#[tauri::command]
pub async fn charvis_vault(
    window: tauri::WebviewWindow,
    operation: String,
    value: String,
) -> Result<String, String> {
    if window.label() != "main" || value.len() > 80 * 1024 * 1024 {
        return Err("Petición al almacén no permitida.".into());
    }
    tauri::async_runtime::spawn_blocking(move || match operation.as_str() {
        "seal" => Ok(STANDARD.encode(seal(value.as_bytes())?)),
        "open" => String::from_utf8(open(
            &STANDARD.decode(value).map_err(|_| "Cifrado no válido")?,
        )?)
        .map_err(|_| "Contenido protegido no válido".into()),
        _ => Err("Operación no permitida".into()),
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn private_text_roundtrip_and_tampering() {
        let text = "Una conversación privada: ΔE, Física y música.".as_bytes();
        let sealed = seal(text).unwrap();
        assert_ne!(sealed, text);
        assert!(!sealed.windows(8).any(|part| part == b"privada:"));
        assert_eq!(open(&sealed).unwrap(), text);
        let mut changed = sealed;
        let i = changed.len() / 2;
        changed[i] ^= 1;
        assert!(open(&changed).is_err());
    }
}
