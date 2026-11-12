//! Native Windows media flyout (SMTC) for the app's music player.
//!
//! The session is created lazily on the UI thread and kept alive for the whole
//! process. Re-creating it would register duplicate button handlers, so every
//! hardware media key would act twice on the same player.

use serde::Deserialize;

/// Now-playing snapshot pushed by the frontend.
///
/// `cover` uses three states: `None` means "unchanged", `Some("")` clears the
/// artwork and `Some(data)` replaces it. That keeps large data URLs out of the
/// per-second timeline ticks.
#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MediaUpdate {
    pub active: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub cover: Option<String>,
    pub can_next: bool,
    pub can_prev: bool,
}

#[cfg(windows)]
mod platform {
    use std::cell::RefCell;

    use tauri::Emitter;
    use windows::core::{Interface, Result as WinResult, HSTRING};
    use windows::Foundation::{TimeSpan, TypedEventHandler, Uri};
    use windows::Media::{
        MediaPlaybackStatus, MediaPlaybackType, SystemMediaTransportControls,
        SystemMediaTransportControlsButton, SystemMediaTransportControlsButtonPressedEventArgs,
        SystemMediaTransportControlsTimelineProperties,
    };
    use windows::Storage::Streams::{
        DataWriter, IOutputStream, IRandomAccessStream, InMemoryRandomAccessStream,
        RandomAccessStreamReference,
    };
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::{ISystemMediaTransportControlsInterop, RoGetActivationFactory};

    use super::MediaUpdate;

    /// 100-nanosecond units per second (the unit used by `TimeSpan`).
    const TICKS: f64 = 10_000_000.0;

    struct Session {
        controls: SystemMediaTransportControls,
        title: String,
        artist: String,
        album: String,
        playing: bool,
        can_next: bool,
        can_prev: bool,
        position: f64,
        duration: f64,
        cover_key: Option<String>,
        cover: Option<RandomAccessStreamReference>,
    }

    thread_local! {
        static SESSION: RefCell<Option<Session>> = RefCell::new(None);
    }

    fn cover_from_spec(spec: &str) -> Option<RandomAccessStreamReference> {
        if spec.is_empty() {
            return None;
        }
        if let Some(rest) = spec.strip_prefix("data:") {
            let (meta, payload) = rest.split_once(',')?;
            if !meta.contains("base64") {
                return None;
            }
            use base64::Engine as _;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(payload.trim())
                .ok()?;
            return cover_from_bytes(&bytes);
        }
        if spec.starts_with("http://") || spec.starts_with("https://") {
            let uri = Uri::CreateUri(&HSTRING::from(spec)).ok()?;
            return RandomAccessStreamReference::CreateFromUri(&uri).ok();
        }
        None
    }

    fn cover_from_bytes(bytes: &[u8]) -> Option<RandomAccessStreamReference> {
        let stream = InMemoryRandomAccessStream::new().ok()?;
        let output: IOutputStream = stream.cast().ok()?;
        let writer = DataWriter::CreateDataWriter(&output).ok()?;
        writer.WriteBytes(bytes).ok()?;
        // An in-memory store completes immediately; waiting keeps the read below
        // from racing an unfinished flush.
        writer.StoreAsync().ok()?.get().ok()?;
        let _ = writer.DetachStream();
        stream.Seek(0).ok()?;
        let source: IRandomAccessStream = stream.cast().ok()?;
        RandomAccessStreamReference::CreateFromStream(&source).ok()
    }

    fn create(hwnd: usize, app: &tauri::AppHandle) -> Option<Session> {
        let interop: ISystemMediaTransportControlsInterop =
            unsafe { RoGetActivationFactory(&HSTRING::from("Windows.Media.SystemMediaTransportControls")) }.ok()?;
        let controls: SystemMediaTransportControls =
            unsafe { interop.GetForWindow(HWND(hwnd as *mut core::ffi::c_void)) }.ok()?;

        let _ = controls.SetIsEnabled(true);
        let _ = controls.SetIsPlayEnabled(true);
        let _ = controls.SetIsPauseEnabled(true);
        let _ = controls.SetIsStopEnabled(false);
        let _ = controls.SetIsFastForwardEnabled(false);
        let _ = controls.SetIsRewindEnabled(false);

        // The handler lives as long as the controls object, which is cached in
        // SESSION for the whole process.
        let handle = app.clone();
        let handler = TypedEventHandler::<
            SystemMediaTransportControls,
            SystemMediaTransportControlsButtonPressedEventArgs,
        >::new(move |_sender, args| -> WinResult<()> {
            let Some(args) = args.as_ref() else {
                return Ok(());
            };
            let Ok(button) = args.Button() else {
                return Ok(());
            };
            let name = match button {
                SystemMediaTransportControlsButton::Play => "play",
                SystemMediaTransportControlsButton::Pause => "pause",
                SystemMediaTransportControlsButton::Stop => "stop",
                SystemMediaTransportControlsButton::Next => "next",
                SystemMediaTransportControlsButton::Previous => "previous",
                _ => return Ok(()),
            };
            let _ = handle.emit("pouh-media-button", name);
            Ok(())
        });
        let _ = controls.ButtonPressed(&handler);

        Some(Session {
            controls,
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            playing: false,
            can_next: true,
            can_prev: true,
            position: 0.0,
            duration: 0.0,
            cover_key: None,
            cover: None,
        })
    }

    fn with_session<R>(
        hwnd: usize,
        app: &tauri::AppHandle,
        run: impl FnOnce(&mut Session) -> R,
    ) -> Option<R> {
        SESSION.with(|cell| {
            let mut slot = cell.borrow_mut();
            if slot.is_none() {
                *slot = create(hwnd, app);
            }
            slot.as_mut().map(run)
        })
    }

    pub fn apply(app: &tauri::AppHandle, hwnd: usize, update: MediaUpdate) {
        if !update.active {
            clear();
            return;
        }
        let Some(()) = with_session(hwnd, app, |s| {
            let _ = s.controls.SetIsEnabled(true);

            let mut refresh = s.title != update.title
                || s.artist != update.artist
                || s.album != update.album;
            if let Some(spec) = update.cover.as_deref() {
                if s.cover_key.as_deref() != Some(spec) {
                    s.cover_key = Some(spec.to_string());
                    s.cover = cover_from_spec(spec);
                    refresh = true;
                }
            }
            if refresh {
                s.title = update.title.clone();
                s.artist = update.artist.clone();
                s.album = update.album.clone();
                if let Ok(updater) = s.controls.DisplayUpdater() {
                    let _ = updater.SetType(MediaPlaybackType::Music);
                    if let Ok(props) = updater.MusicProperties() {
                        let _ = props.SetTitle(&HSTRING::from(update.title.as_str()));
                        let _ = props.SetArtist(&HSTRING::from(update.artist.as_str()));
                        let _ = props.SetAlbumArtist(&HSTRING::from(update.artist.as_str()));
                        let _ = props.SetAlbumTitle(&HSTRING::from(update.album.as_str()));
                    }
                    match s.cover.as_ref() {
                        Some(cover) => {
                            let _ = updater.SetThumbnail(cover);
                        }
                        None => {
                            let _ = updater.SetThumbnail(None::<&RandomAccessStreamReference>);
                        }
                    }
                    let _ = updater.Update();
                }
            }

            if s.playing != update.playing {
                s.playing = update.playing;
                let status = if update.playing {
                    MediaPlaybackStatus::Playing
                } else {
                    MediaPlaybackStatus::Paused
                };
                let _ = s.controls.SetPlaybackStatus(status);
            }
            if s.can_next != update.can_next {
                s.can_next = update.can_next;
                let _ = s.controls.SetIsNextEnabled(update.can_next);
            }
            if s.can_prev != update.can_prev {
                s.can_prev = update.can_prev;
                let _ = s.controls.SetIsPreviousEnabled(update.can_prev);
            }

            let position = if update.position.is_finite() { update.position.max(0.0) } else { 0.0 };
            let duration = if update.duration.is_finite() { update.duration.max(0.0) } else { 0.0 };
            if (s.position - position).abs() >= 0.9 || (s.duration - duration).abs() >= 0.5 {
                s.position = position;
                s.duration = duration;
                let timeline = SystemMediaTransportControlsTimelineProperties::new();
                if let Ok(timeline) = timeline {
                    let end = TimeSpan { Duration: (duration * TICKS) as i64 };
                    let _ = timeline.SetStartTime(TimeSpan { Duration: 0 });
                    let _ = timeline.SetMinSeekTime(TimeSpan { Duration: 0 });
                    let _ = timeline.SetEndTime(end);
                    let _ = timeline.SetMaxSeekTime(end);
                    let _ = timeline.SetPosition(TimeSpan { Duration: (position * TICKS) as i64 });
                    let _ = s.controls.UpdateTimelineProperties(&timeline);
                }
            }
        }) else {
            return;
        };
    }

    pub fn clear() {
        SESSION.with(|cell| {
            let mut slot = cell.borrow_mut();
            let Some(s) = slot.as_mut() else { return };
            let _ = s.controls.SetPlaybackStatus(MediaPlaybackStatus::Stopped);
            let _ = s.controls.SetIsEnabled(false);
            if let Ok(updater) = s.controls.DisplayUpdater() {
                let _ = updater.ClearAll();
                let _ = updater.Update();
            }
            s.title.clear();
            s.artist.clear();
            s.album.clear();
            s.playing = false;
            s.can_next = false;
            s.can_prev = false;
            s.position = 0.0;
            s.duration = 0.0;
            s.cover_key = None;
            s.cover = None;
        });
    }
}

#[cfg(windows)]
fn main_hwnd(app: &tauri::AppHandle) -> Result<usize, String> {
    use tauri::Manager;
    app.get_webview_window("main")
        .and_then(|window| window.hwnd().ok())
        .map(|handle| handle.0 as usize)
        .ok_or_else(|| "main window unavailable".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn media_controls_update(app: tauri::AppHandle, payload: MediaUpdate) -> Result<(), String> {
    let hwnd = main_hwnd(&app)?;
    let handle = app.clone();
    app.run_on_main_thread(move || platform::apply(&handle, hwnd, payload))
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn media_controls_clear(app: tauri::AppHandle) -> Result<(), String> {
    app.run_on_main_thread(platform::clear)
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn media_controls_update(_app: tauri::AppHandle, _payload: MediaUpdate) -> Result<(), String> {
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn media_controls_clear(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}
