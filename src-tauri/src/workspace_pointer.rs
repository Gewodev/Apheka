use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

static TIMER_CLOSE_RECOVERY: AtomicBool = AtomicBool::new(false);

/// Destruction can reset WebView2's cursor after the first focus notification.
/// Two deferred passes cover that teardown, without polling or activating another app.
pub fn recover_after_timer_close(app: &tauri::AppHandle) {
    if TIMER_CLOSE_RECOVERY.swap(true, Ordering::AcqRel) { return; }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        for delay in [80, 240] {
            tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            // A reopened timer owns the next focus cycle; an old close must not
            // refocus its parent or change its cursor after recreation.
            if app.get_webview_window("floating-timer").is_some() { continue; }
            if let Some(main) = app.get_webview_window("main") {
                if main.is_visible().unwrap_or(false) && main.is_focused().unwrap_or(false) {
                    // Focus the content, not the top-level window: never raise the app.
                    let webview: &tauri::Webview = main.as_ref();
                    let _ = webview.set_focus();
                    let _ = restore_workspace_pointer(main);
                }
            }
        }
        TIMER_CLOSE_RECOVERY.store(false, Ordering::Release);
    });
}

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
            if GetCursorInfo(&mut info) == 0 || info.flags & CURSOR_SUPPRESSED != 0 { return; }
            let under_pointer = WindowFromPoint(info.ptScreenPos);
            if under_pointer != hwnd && IsChild(hwnd, under_pointer) == 0 { return; }
            // Ask the actual child under the pointer to refresh its cursor. Windows can
            // report SHOWING while a destroyed transparent surface leaves it undrawn.
            // WM_SETCURSOR preserves the child's text/link cursor, without moving input.
            PostMessageW(under_pointer, WM_SETCURSOR, under_pointer as usize,
                ((WM_MOUSEMOVE << 16) | HTCLIENT as u32) as isize);
            if info.flags != 0 { return; }
            SetCursor(LoadCursorW(std::ptr::null_mut(), IDC_ARROW));
            if GetCursorInfo(&mut info) == 0 || info.flags != 0 { return; }
            // WebView2 may leave ShowCursor's display counter negative after a media transition.
            // Bound recovery; no ongoing polling, pointer warping or global preference change.
            for _ in 0..8 { if ShowCursor(1) >= 0 { break; } }
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Lightweight pointer repaint for the fullscreen presentation.
///
/// Some drivers keep the drawn Windows cursor frozen while the pointer keeps
/// moving. Asking the child under the pointer to set its cursor again redraws it
/// at the current position, without moving the pointer, without touching global
/// settings and without activating another application. The child is also
/// invalidated once, which reproduces the recomposition that a separate native
/// window used to cause by accident.
#[tauri::command]
pub fn refresh_workspace_cursor(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" { return Ok(()); }
    #[cfg(windows)]
    {
        let handle = window.hwnd().map_err(|e| e.to_string())?.0 as usize;
        window.run_on_main_thread(move || unsafe {
            use windows_sys::Win32::Graphics::Gdi::{RedrawWindow, RDW_INVALIDATE, RDW_NOERASE, RDW_UPDATENOW};
            use windows_sys::Win32::UI::WindowsAndMessaging::*;
            let hwnd = handle as *mut core::ffi::c_void;
            if GetForegroundWindow() != hwnd { return; }
            let mut info: CURSORINFO = std::mem::zeroed();
            info.cbSize = std::mem::size_of::<CURSORINFO>() as u32;
            // CURSOR_SUPPRESSED is a touch/pen interaction. Do not interfere with it.
            if GetCursorInfo(&mut info) == 0 || info.flags & CURSOR_SUPPRESSED != 0 { return; }
            let under_pointer = WindowFromPoint(info.ptScreenPos);
            if under_pointer != hwnd && IsChild(hwnd, under_pointer) == 0 { return; }
            PostMessageW(under_pointer, WM_SETCURSOR, under_pointer as usize,
                ((WM_MOUSEMOVE << 16) | HTCLIENT as u32) as isize);
            // Repaint only that child: no global invalidation, no other window
            // is touched and the layered surfaces keep their own composition.
            RedrawWindow(under_pointer, std::ptr::null(), std::ptr::null_mut(),
                RDW_INVALIDATE | RDW_UPDATENOW | RDW_NOERASE);
            // Only a hidden cursor needs the display counter repaired. The counter is
            // balanced afterwards so a repeated refresh cannot keep it positive.
            if info.flags != 0 {
                for _ in 0..8 { if ShowCursor(1) >= 0 { break; } }
                for _ in 0..8 { if ShowCursor(-1) <= 0 { break; } }
            }
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}
