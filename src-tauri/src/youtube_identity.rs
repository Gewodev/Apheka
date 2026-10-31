use tauri::Manager;
/// Identify only embedded YouTube documents, as required for desktop WebView players.
pub fn configure(app:&tauri::AppHandle){
 #[cfg(windows)]
 if let Some(window)=app.get_webview_window("main"){
  let identity=format!("https://{}/",app.config().identifier);
  let _=window.with_webview(move|webview|unsafe{
   use webview2_com::{Microsoft::Web::WebView2::Win32::*,WebResourceRequestedEventHandler};
   use windows_core::HSTRING;
   let Ok(core)=webview.controller().CoreWebView2() else{return;};
   for pattern in ["https://www.youtube.com/embed/*","https://www.youtube-nocookie.com/embed/*"]{let _=core.AddWebResourceRequestedFilter(&HSTRING::from(pattern),COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT);}
   let handler=WebResourceRequestedEventHandler::create(Box::new(move|_,args|{if let Some(args)=args{let request=args.Request()?;request.Headers()?.SetHeader(&HSTRING::from("Referer"),&HSTRING::from(&identity))?;}Ok(())}));
   let mut token=0;let _=core.add_WebResourceRequested(&handler,&mut token);
  });
 }
}
