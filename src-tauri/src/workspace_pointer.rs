/// Recover the native pointer only in our focused workspace, never move it or change system settings.
#[tauri::command]
pub fn restore_workspace_pointer(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" || !window.is_focused().unwrap_or(false) { return Ok(()); }
    window.set_cursor_grab(false).map_err(|e| e.to_string())?;
    window.set_cursor_visible(true).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        let handle = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
        window.run_on_main_thread(move || unsafe {
            use windows_sys::Win32::UI::WindowsAndMessaging::*;
            let hwnd = handle as *mut core::ffi::c_void;
            if GetForegroundWindow() != hwnd { return; }
            let mut info: CURSORINFO = std::mem::zeroed();
            info.cbSize = std::mem::size_of::<CURSORINFO>() as u32;
            // CURSOR_SUPPRESSED is a touch/pen interaction. Do not interfere with it.
            if GetCursorInfo(&mut info) == 0 || info.flags != 0 { return; }
            let under_pointer = WindowFromPoint(info.ptScreenPos);
            if under_pointer != hwnd && IsChild(hwnd, under_pointer) == 0 { return; }
            SetCursor(LoadCursorW(std::ptr::null_mut(), IDC_ARROW));
            if GetCursorInfo(&mut info) == 0 || info.flags != 0 { return; }
            // WebView2 may leave ShowCursor's display counter negative after a media transition.
            // Bound recovery; no ongoing polling, pointer warping or global preference change.
            for _ in 0..8 { if ShowCursor(1) >= 0 { break; } }
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}
