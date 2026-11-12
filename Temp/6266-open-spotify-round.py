from pathlib import Path
p=Path('src/components/music/MusicLinkImport.tsx');s=p.read_text('utf-8').replace('pages?:number;elapsedMs?:number','pages?:number;elapsedMs?:number;totalKnown?:boolean;note?:string');s=s.replace(' · {items.length} canciones ·',' · {items.length} canciones ·');s=s.replace(' s</p>}{collection&&',' s{diagnostics.note&&<span className="playlist-public-note">{diagnostics.note}</span>}</p>}{collection&&');s=s.replace('Requiere un token de acceso con permiso de lectura para esta lista. Se usa solo en esta consulta y no se guarda.','Opcional: la consulta normal usa los metadatos públicos sin clave. Para una lista autorizada puedes usar un token propio de lectura; no se guarda.');p.write_text(s,'utf-8')
p=Path('src-tauri/Cargo.toml');s=p.read_text('utf-8').replace('"Win32_UI_WindowsAndMessaging",','"Win32_UI_WindowsAndMessaging", "Win32_Graphics_Gdi",');p.write_text(s,'utf-8')
p=Path('src-tauri/src/floating_timer.rs');s=p.read_text('utf-8');fn='''
#[cfg(windows)]
fn round_corners(timer:&WebviewWindow){
    let Ok(handle)=timer.hwnd() else{return;};let Ok(size)=timer.outer_size() else{return;};
    let radius=(16.0*timer.scale_factor().unwrap_or(1.0)).round() as i32;let hwnd=handle.0 as usize;
    let _=timer.run_on_main_thread(move||unsafe{
      use windows_sys::Win32::{Graphics::Gdi::*,UI::WindowsAndMessaging::*};
      let hwnd=hwnd as *mut core::ffi::c_void;if IsWindow(hwnd)==0{return;}
      let region=CreateRoundRectRgn(0,0,size.width as i32+1,size.height as i32+1,radius*2,radius*2);
      if !region.is_null()&&SetWindowRgn(hwnd,region,1)==0{DeleteObject(region);}
    });
}
''';s=s.replace('const LABEL:',fn+'\nconst LABEL:');s=s.replace('    if let Err(error) = timer.show()', '''    #[cfg(windows)]
    {round_corners(&timer);let on_scale=timer.clone();timer.on_window_event(move|event|{if matches!(event,tauri::WindowEvent::ScaleFactorChanged{..}){round_corners(&on_scale);}});}
    if let Err(error) = timer.show()''');p.write_text(s,'utf-8')
p=Path('src/components/FloatingTimer.tsx');s=p.read_text('utf-8').replace("width: '100vw', height: '100vh',","width: '100vw', height: '100vh', borderRadius:16, overflow:'hidden',");p.write_text(s,'utf-8')
