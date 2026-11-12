from pathlib import Path
p=Path('src-tauri/src/playlist_import.rs');s=p.read_text('utf-8').replace('use tauri::Manager;\n','');p.write_text(s,'utf-8')
p=Path('src/components/views/Ajustes.tsx');s=p.read_text('utf-8').replace('<span>{settingsOutline.length} secciones</span>','{settingsOutline.length>0&&<span>{settingsOutline.length} secciones</span>}');p.write_text(s,'utf-8')
