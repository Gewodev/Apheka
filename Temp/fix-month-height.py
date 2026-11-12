from pathlib import Path
p=Path('src/components/views/Planificacion.tsx');s=p.read_text('utf-8').replace("style={{ height:130, padding:'10px 12px'","style={{ height:164, padding:'10px 12px'");p.write_text(s,'utf-8')
