//! Native Windows identity for the product.
//!
//! The machine identity stays `com.owa.studio` on purpose: it keeps the app
//! data folder, the stored permissions, the notifications history and the
//! previous installs attached to the same application id. What changes is the
//! *visible* identity. Windows is told that this application id is called
//! `West` and which artwork belongs to it, so the shell (notification header,
//! Action Center, taskbar) never falls back to the raw id or to the generic
//! WebView2 icon.
//!
//! Everything here is per user (HKCU) and best effort: a failure never stops
//! the app, it only leaves the previous behaviour in place.

/// Machine identity. Stable on purpose: it is what links this build to the
/// data, permissions and notifications of every previous install.
pub const APP_USER_MODEL_ID: &str = "com.owa.studio";

/// Visible product name used by the Windows shell.
pub const DISPLAY_NAME: &str = "West";

/// Original artwork, embedded so the shell always has a real West logo even
/// when the app runs from a folder it cannot write to.
const LOGO_PNG: &[u8] = include_bytes!("../icons/icon.png");

/// Absolute path of the logo written next to the app data.
/// Cached, so a notification never touches the disk twice.
fn logo_path() -> Option<&'static std::path::PathBuf> {
    static LOGO: std::sync::OnceLock<Option<std::path::PathBuf>> = std::sync::OnceLock::new();
    LOGO.get_or_init(|| {
        let base = dirs::data_local_dir()?;
        let dir = base.join("com.owa.studio");
        std::fs::create_dir_all(&dir).ok()?;
        let path = dir.join("west-logo.png");
        // Written only when missing or different, so repeated launches stay cheap.
        if std::fs::read(&path).ok().as_deref() != Some(LOGO_PNG) {
            std::fs::write(&path, LOGO_PNG).ok()?;
        }
        Some(path)
    })
    .as_ref()
}

/// Logo path with forward slashes, ready to be embedded in a `file:///` URI.
pub fn logo_uri_file() -> Option<std::path::PathBuf> {
    logo_path().map(|path| std::path::PathBuf::from(path.to_string_lossy().replace('\\', "/")))
}

/// Same path as text, ready to be embedded in a `file:///` URI.
pub fn logo_uri_path() -> Option<String> {
    logo_path().map(|path| path.to_string_lossy().replace('\\', "/"))
}

/// Registers the process identity and the shell display name.
/// Call it before creating any window or notification.
pub fn init() {
    set_process_app_user_model_id();
    register_app_user_model_id();
}

#[cfg(windows)]
fn set_process_app_user_model_id() {
    use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
    let id: Vec<u16> = APP_USER_MODEL_ID.encode_utf16().chain(Some(0)).collect();
    // Failing here is harmless: the id may already be set for this process.
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(id.as_ptr());
    }
}

#[cfg(not(windows))]
fn set_process_app_user_model_id() {}

#[cfg(windows)]
fn register_app_user_model_id() {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_OPTION_NON_VOLATILE,
    };
    let mut key: HKEY = std::ptr::null_mut();
    let subkey: Vec<u16> = format!(r"Software\Classes\AppUserModelId\{APP_USER_MODEL_ID}")
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let status = unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            0,
            std::ptr::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            std::ptr::null(),
            &mut key,
            std::ptr::null_mut(),
        )
    };
    if status != 0 {
        return;
    }
    unsafe {
        write_reg_sz(key, "DisplayName", DISPLAY_NAME);
        if let Some(icon) = logo_uri_path() {
            write_reg_sz(key, "IconUri", &format!("file:///{icon}"));
        }
        let _ = RegCloseKey(key);
    }
}

#[cfg(not(windows))]
fn register_app_user_model_id() {}

#[cfg(windows)]
unsafe fn write_reg_sz(
    key: windows_sys::Win32::System::Registry::HKEY,
    name: &str,
    value: &str,
) {
    use windows_sys::Win32::System::Registry::{RegSetValueExW, REG_SZ};
    let name_wide: Vec<u16> = name.encode_utf16().chain(Some(0)).collect();
    let data: Vec<u16> = value.encode_utf16().chain(Some(0)).collect();
    let bytes = (data.len() * std::mem::size_of::<u16>()) as u32;
    let _ = RegSetValueExW(
        key,
        name_wide.as_ptr(),
        0,
        REG_SZ,
        data.as_ptr() as *const u8,
        bytes,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_is_stable_and_visible_name_is_the_product() {
        // The machine id must not change: it carries data and permissions.
        assert_eq!(APP_USER_MODEL_ID, "com.owa.studio");
        assert_eq!(DISPLAY_NAME, "West");
    }

    #[test]
    fn embedded_logo_is_a_real_png() {
        assert!(LOGO_PNG.len() > 1024);
        assert_eq!(&LOGO_PNG[..8], b"\x89PNG\r\n\x1a\n");
    }
}
