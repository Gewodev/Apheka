from pathlib import Path
for name in ['package.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json','src-tauri/tauri.prod.conf.json']:
 p=Path(name);s=p.read_text(encoding='utf-8');s=s.replace('6.26.6','6.26.7');p.write_text(s,encoding='utf-8')
s=Path('scripts/build-pohu-6266.ps1').read_text(encoding='utf-8').replace('6.26.6','6.26.7');Path('scripts/build-pohu-6267.ps1').write_text(s,encoding='utf-8')
s=Path('scripts/capture-pohu-6266.cjs').read_text(encoding='utf-8').replace('6266','6267');Path('scripts/capture-pohu-6267.cjs').write_text(s,encoding='utf-8')
