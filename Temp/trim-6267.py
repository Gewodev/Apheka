from pathlib import Path
for name in ['src/App.tsx','src/components/ui/CommandsSettings.tsx']:
 p=Path(name);p.write_text(p.read_text(encoding='utf-8-sig').rstrip()+'\n',encoding='utf-8')
