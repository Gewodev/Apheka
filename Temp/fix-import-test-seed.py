from pathlib import Path
p=Path('scripts/test-import-ui-6265.cjs');s=p.read_text('utf-8').replace("await p.addInitScript(()=>{localStorage.setItem('owa_studio_data'","await p.addInitScript(()=>{if(localStorage.getItem('qa6265import'))return;localStorage.setItem('qa6265import','1');localStorage.setItem('owa_studio_data'");p.write_text(s,'utf-8')
