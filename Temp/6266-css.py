from pathlib import Path
p=Path('src/App.tsx');s=p.read_text('utf-8');s="import './workspace-6266.css';\n"+s;p.write_text(s,'utf-8')
