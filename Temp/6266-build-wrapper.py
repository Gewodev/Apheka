from pathlib import Path
s=Path('scripts/build-apheka-6265.ps1').read_text('utf-8-sig').replace('6.26.5','6.26.6');Path('scripts/build-pohu-6266.ps1').write_text(s,'utf-8')
